import { Injectable, NotFoundException, InternalServerErrorException, Logger, BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { OpenCashShiftDto, CloseCashShiftDto, CreateCashMovementDto, TestCashShiftEmailDto } from './dto/cash-shift.dto';
import { OrderStatus, PaymentStatus } from '../orders/dto/order.dto';
import { buildOrderSummary } from '../orders/order-summary.util';
import { CashShiftEmailService } from './cash-shift-email.service';
import { NotificationDispatchService } from '../notification-dispatch/notification-dispatch.service';

@Injectable()
export class CashShiftsService {
  private readonly logger = new Logger(CashShiftsService.name);

  constructor(
    private prisma: PrismaService,
    private readonly cashShiftEmailService: CashShiftEmailService,
    private readonly notificationDispatchService: NotificationDispatchService,
  ) {}

  private async getSystemConfig() {
    const config = await this.prisma.systemConfig.findUnique({ where: { id: 1 } });

    return {
      taxEnabled: config?.taxEnabled ?? true,
      taxRate: Number(config?.taxRate ?? 16),
      whatsappAddonEnabled: Boolean(config?.whatsappAddonEnabled),
    };
  }

  private async enqueueShiftClosedWhatsappDispatch(
    shiftId: number,
    report: Awaited<ReturnType<CashShiftsService['getShiftSummary']>>,
  ) {
    const config = await this.getSystemConfig();
    if (!config.whatsappAddonEnabled) {
      return null;
    }

    return this.notificationDispatchService.createManualDispatch({
      type: 'SHIFT_CLOSED',
      title: `Corte de turno #${shiftId} cerrado`,
      priority: 'normal',
      entityId: shiftId,
      requiresAttachment: false,
      recipients: [],
      messageText: [
        `Corte de turno #${shiftId} cerrado.`,
        `Venta total registrada: $${Number(report.totalSalesRegistered ?? 0).toFixed(2)} MXN.`,
        `Efectivo esperado: $${Number(report.expectedBalance ?? 0).toFixed(2)} MXN.`,
        `Tarjeta esperada: $${Number(report.expectedCardBalance ?? 0).toFixed(2)} MXN.`,
      ].join('\n'),
    });
  }

  private getNormalizedPaymentStatus(order: any, remainingAmount: number) {
    if (remainingAmount <= 0.01) {
      return PaymentStatus.PAID;
    }

    const paidAmount = Number(
      (order.payments ?? []).reduce((sum: number, payment: any) => sum + Number(payment.amount), 0),
    );

    return paidAmount > 0 ? PaymentStatus.PARTIAL : PaymentStatus.PENDING;
  }

  private isAutomaticOrderCashMovement(reason?: string | null) {
    return String(reason ?? '').includes('Pago de orden');
  }

  private isFinalizedOrderStatus(status?: string | null) {
    return status === OrderStatus.CLOSED || status === OrderStatus.CANCELLED;
  }

  private getPaymentMethodLabel(method?: string | null) {
    const normalized = String(method ?? '').toUpperCase();

    if (['CASH', 'EFECTIVO'].includes(normalized)) return 'Efectivo';
    if (['CARD', 'TARJETA'].includes(normalized)) return 'Tarjeta';
    if (['TRANSFER', 'TRANSFERENCIA'].includes(normalized)) return 'Transferencia';
    if (normalized === 'OTHER') return 'Otro';
    return method || 'Pago';
  }

  private getPaymentCurrencyLabel(currency?: string | null) {
    return String(currency ?? 'MXN').toUpperCase() === 'USD' ? 'USD' : 'MXN';
  }

  private getOrderTypeLabel(orderType?: string | null) {
    const normalized = String(orderType ?? '').toUpperCase();

    if (normalized === 'DINE_IN') return 'Comedor';
    if (normalized === 'TAKE_AWAY') return 'Para llevar';
    if (normalized === 'DELIVERY') return 'Domicilio';
    return 'Sin clasificar';
  }

  private buildShiftTimeline(shift: any) {
    const paymentEntries = (shift.payments ?? []).map((payment: any) => ({
        id: `payment-${payment.id}`,
        sourceType: 'PAYMENT',
        movementType: 'IN',
        amount: Number(payment.amount),
        reason: `Pago de orden ${payment.order?.orderNumber ?? payment.orderId} (${this.getPaymentMethodLabel(payment.paymentMethod)} ${this.getPaymentCurrencyLabel(payment.paymentCurrency)})`,
        createdAt: payment.createdAt,
        paymentMethod: payment.paymentMethod?.toUpperCase() ?? null,
        paymentCurrency: this.getPaymentCurrencyLabel(payment.paymentCurrency),
        orderId: payment.order?.id ?? payment.orderId,
        orderNumber: payment.order?.orderNumber ?? null,
        createdByName: payment.order?.user?.name ?? null,
      }));

    const manualMovementEntries = (shift.movements ?? [])
      .filter((move: any) => !this.isAutomaticOrderCashMovement(move.reason))
      .map((move: any) => ({
        id: `movement-${move.id}`,
        sourceType: 'MANUAL_MOVEMENT',
        movementType: move.movementType,
        amount: Number(move.amount),
        reason: move.reason,
        createdAt: move.createdAt,
        paymentMethod: null,
        paymentCurrency: null,
        orderId: null,
        orderNumber: null,
        createdByName: move.creator?.name ?? null,
      }));

    return [...paymentEntries, ...manualMovementEntries].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }

  private async normalizeOrdersForShiftClosure() {
    const config = await this.getSystemConfig();
    const orders = await this.prisma.order.findMany({
      where: {
        status: { not: OrderStatus.CANCELLED },
      },
      include: {
        items: {
          include: {
            modifiers: true,
          },
        },
        payments: true,
        discounts: true,
      },
    });

    const staleOrders = orders
      .map((order) => {
        const summary = buildOrderSummary(order as any, config);
        const normalizedPaymentStatus = this.getNormalizedPaymentStatus(
          order,
          summary.remainingAmount,
        );

        const needsUpdate = order.paymentStatus !== normalizedPaymentStatus;

        return {
          order,
          summary,
          normalizedPaymentStatus,
          needsUpdate,
        };
      })
      .filter(({ needsUpdate }) => needsUpdate);

    if (staleOrders.length === 0) {
      return;
    }

    await this.prisma.$transaction(async (tx) => {
      for (const { order, normalizedPaymentStatus } of staleOrders) {
        await tx.order.update({
          where: { id: order.id },
          data: {
            paymentStatus: normalizedPaymentStatus,
          },
        });
      }
    });
  }

  private async getShiftBlockingSummary() {
    const orders = await this.prisma.order.findMany({
      where: {
        status: {
          notIn: [OrderStatus.CLOSED, OrderStatus.CANCELLED],
        },
      },
      select: {
        id: true,
        orderNumber: true,
        status: true,
        paymentStatus: true,
        tableId: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    const openOrders = orders.filter((order) => !this.isFinalizedOrderStatus(order.status));
    const pendingPaymentOrders = orders.filter((order) =>
      [PaymentStatus.PENDING, PaymentStatus.PARTIAL].includes(order.paymentStatus as PaymentStatus),
    );
    const activeAccounts = openOrders.filter((order) => !!order.tableId);

    return {
      orders,
      openOrders,
      pendingPaymentOrders,
      activeAccounts,
      pendingPayments: pendingPaymentOrders.length,
    };
  }

  private buildShiftReport(shift: any) {
    let totalSalesCash = 0;
    let totalSalesCard = 0;
    let totalManualIn = 0;
    let totalManualOut = 0;
    let totalCashMxnIn = 0;
    let totalCashUsdIn = 0;
    let totalCashUsdInMxn = 0;
    let totalChangeGivenMxn = 0;
    let cancelledOrdersCount = 0;
    let cancelledSalesExcluded = 0;
    let redeemedOrdersCount = 0;
    let redeemedItemsCount = 0;
    const salesByCashierMap = new Map<number, { userId: number; cashierName: string; totalSalesCash: number; totalSalesCard: number; totalSales: number }>();
    const serviceTypeMetricsMap = new Map<string, {
      orderType: string;
      label: string;
      ordersCount: number;
      itemsSold: number;
      totalSales: number;
      topProductsMap: Map<number, { productId: number; productName: string; quantitySold: number; grossSales: number }>;
    }>();
    const topProductsMap = new Map<number, {
      productId: number;
      productName: string;
      quantitySold: number;
      grossSales: number;
      orderTypesMap: Map<string, { orderType: string; label: string; quantitySold: number; grossSales: number }>;
    }>();
    const reportablePayments = (shift.payments ?? []).filter(
      (payment: any) => payment.order?.status !== OrderStatus.CANCELLED,
    );
    const cancelledPayments = (shift.payments ?? []).filter(
      (payment: any) => payment.order?.status === OrderStatus.CANCELLED,
    );
    const reportableOrdersMap = new Map<number, any>();

    cancelledOrdersCount = new Set(
      cancelledPayments
        .map((payment: any) => payment.order?.id)
        .filter((orderId: number | undefined) => typeof orderId === 'number'),
    ).size;
    cancelledSalesExcluded = cancelledPayments.reduce(
      (sum: number, payment: any) => sum + Number(payment.amount),
      0,
    );

    reportablePayments.forEach((payment: any) => {
      if (payment.order?.id) {
        const existingOrder = reportableOrdersMap.get(payment.order.id);
        if (!existingOrder) {
          reportableOrdersMap.set(payment.order.id, {
            ...payment.order,
            totalPaidInShift: 0,
          });
        }

        reportableOrdersMap.get(payment.order.id).totalPaidInShift += Number(payment.amount);
      }

      const userId = payment.order?.user?.id;
      const cashierName = payment.order?.user?.name || 'SIN ASIGNAR';

      if (userId && !salesByCashierMap.has(userId)) {
        salesByCashierMap.set(userId, {
          userId,
          cashierName,
          totalSalesCash: 0,
          totalSalesCard: 0,
          totalSales: 0,
        });
      }

      const amount = Number(payment.amount);
      const method = String(payment.paymentMethod ?? '').toUpperCase();
      const currency = this.getPaymentCurrencyLabel(payment.paymentCurrency);
      const isCash = ['CASH', 'EFECTIVO'].includes(method);
      const isCard = ['CARD', 'TARJETA'].includes(method);

      if (isCash) totalSalesCash += amount;
      else if (isCard) totalSalesCard += amount;

      if (isCash) {
        totalCashMxnIn += Number(payment.cashReceivedMxn ?? 0);
        totalCashUsdIn += Number(payment.cashReceivedUsd ?? 0);
        if (currency === 'USD') {
          totalCashUsdInMxn += Number(
            payment.receivedAmountMxn ??
            (Number(payment.receivedAmount ?? 0) * Number(payment.exchangeRate ?? 0)),
          );
        }
        totalChangeGivenMxn += Number(payment.changeAmount ?? 0);
      }

      if (userId) {
        const bucket = salesByCashierMap.get(userId)!;
        if (isCash) bucket.totalSalesCash += amount;
        else if (isCard) bucket.totalSalesCard += amount;
        bucket.totalSales += amount;
      }
    });

    Array.from(reportableOrdersMap.values()).forEach((order: any) => {
      const orderType = String(order.orderType ?? 'UNKNOWN').toUpperCase();
      const label = this.getOrderTypeLabel(orderType);
      const redeemableItems = (order.items ?? []).filter((item: any) => !!item.redeemableProductId);
      const regularItems = (order.items ?? []).filter((item: any) => !item.redeemableProductId);

      if (redeemableItems.length > 0) {
        redeemedOrdersCount += 1;
        redeemedItemsCount += redeemableItems.reduce(
          (sum: number, item: any) => sum + Number(item.quantity ?? 0),
          0,
        );
      }

      const existingServiceType =
        serviceTypeMetricsMap.get(orderType) ??
        {
          orderType,
          label,
          ordersCount: 0,
          itemsSold: 0,
          totalSales: 0,
          topProductsMap: new Map<number, { productId: number; productName: string; quantitySold: number; grossSales: number }>(),
        };

      existingServiceType.ordersCount += 1;
      existingServiceType.totalSales += Number(order.totalPaidInShift ?? 0);

      regularItems.forEach((item: any) => {
        const productId = Number(item.product?.id ?? item.productId ?? 0);
        const productName = item.product?.name || 'Producto sin nombre';
        const quantitySold = Number(item.quantity ?? 0);
        const modifiersTotal = (item.modifiers ?? []).reduce(
          (sum: number, modifier: any) => sum + Number(modifier.price ?? 0),
          0,
        );
        const unitGross = Number(item.price ?? 0) + modifiersTotal;
        const grossSales = unitGross * quantitySold;

        existingServiceType.itemsSold += quantitySold;

        if (!existingServiceType.topProductsMap.has(productId)) {
          existingServiceType.topProductsMap.set(productId, {
            productId,
            productName,
            quantitySold: 0,
            grossSales: 0,
          });
        }

        const serviceProduct = existingServiceType.topProductsMap.get(productId)!;
        serviceProduct.quantitySold += quantitySold;
        serviceProduct.grossSales += grossSales;

        if (!topProductsMap.has(productId)) {
          topProductsMap.set(productId, {
            productId,
            productName,
            quantitySold: 0,
            grossSales: 0,
            orderTypesMap: new Map<string, { orderType: string; label: string; quantitySold: number; grossSales: number }>(),
          });
        }

        const topProduct = topProductsMap.get(productId)!;
        topProduct.quantitySold += quantitySold;
        topProduct.grossSales += grossSales;

        if (!topProduct.orderTypesMap.has(orderType)) {
          topProduct.orderTypesMap.set(orderType, {
            orderType,
            label,
            quantitySold: 0,
            grossSales: 0,
          });
        }

        const orderTypeBucket = topProduct.orderTypesMap.get(orderType)!;
        orderTypeBucket.quantitySold += quantitySold;
        orderTypeBucket.grossSales += grossSales;
      });

      serviceTypeMetricsMap.set(orderType, existingServiceType);
    });

    shift.movements.forEach((move: any) => {
      const isAuto = move.reason?.includes('Pago de orden');
      if (!isAuto) {
        if (move.movementType === 'IN') totalManualIn += Number(move.amount);
        else if (move.movementType === 'OUT') totalManualOut += Number(move.amount);
      }
    });

    const openingAmount = Number(shift.openingAmount);
    const totalSalesRegistered = totalSalesCash + totalSalesCard;
    const expectedBalance = openingAmount + totalCashMxnIn - totalChangeGivenMxn + totalManualIn - totalManualOut;
    const expectedUsdBalance = totalCashUsdIn;
    const expectedUsdBalanceMxn = totalCashUsdInMxn;
    const expectedCardBalance = totalSalesCard;
    const closingAmount = shift.closingAmount !== null && shift.closingAmount !== undefined ? Number(shift.closingAmount) : null;
    const closingUsdAmount = shift.closingUsdAmount !== null && shift.closingUsdAmount !== undefined ? Number(shift.closingUsdAmount) : null;
    const closingCardAmount = shift.closingCardAmount !== null && shift.closingCardAmount !== undefined ? Number(shift.closingCardAmount) : null;
    const cashDifference = closingAmount !== null ? closingAmount - expectedBalance : null;
    const usdDifference = closingUsdAmount !== null ? closingUsdAmount - expectedUsdBalance : null;
    const cardDifference = closingCardAmount !== null ? closingCardAmount - expectedCardBalance : null;
    const usdRateForClose =
      expectedUsdBalance > 0
        ? expectedUsdBalanceMxn / expectedUsdBalance
        : 0;
    const totalExpectedSystem = expectedBalance + expectedUsdBalanceMxn + expectedCardBalance;
    const totalReported =
      (closingAmount ?? 0) +
      ((closingUsdAmount ?? 0) * usdRateForClose) +
      (closingCardAmount ?? 0);
    const totalDifference =
      (closingAmount !== null || closingUsdAmount !== null || closingCardAmount !== null)
        ? totalReported - totalExpectedSystem
        : null;

    return {
      shiftId: shift.id,
      status: shift.status,
      openedAt: shift.openedAt,
      closedAt: shift.closedAt,
      openingAmount,
      totalSalesCash,
      totalSalesCard,
      totalSalesRegistered,
      totalManualIn,
      totalManualOut,
      totalCashMxnIn,
      totalCashUsdIn,
      totalCashUsdInMxn,
      totalChangeGivenMxn,
      expectedBalance,
      expectedUsdBalance,
      expectedUsdBalanceMxn,
      expectedCardBalance,
      closingAmount,
      closingUsdAmount,
      closingCardAmount,
      difference: cashDifference,
      cashDifference,
      usdDifference,
      cardDifference,
      usdRateForClose,
      totalExpectedSystem,
      totalReported,
      totalDifference,
      cancelledOrdersCount,
      cancelledSalesExcluded,
      redeemedOrdersCount,
      redeemedItemsCount,
      salesByCashier: Array.from(salesByCashierMap.values()),
      serviceTypeMetrics: Array.from(serviceTypeMetricsMap.values())
        .map((metric) => ({
          orderType: metric.orderType,
          label: metric.label,
          ordersCount: metric.ordersCount,
          itemsSold: metric.itemsSold,
          totalSales: metric.totalSales,
          averageTicket: metric.ordersCount > 0 ? metric.totalSales / metric.ordersCount : 0,
          topProducts: Array.from(metric.topProductsMap.values())
            .sort((a, b) => b.quantitySold - a.quantitySold || b.grossSales - a.grossSales)
            .slice(0, 5),
        }))
        .sort((a, b) => b.totalSales - a.totalSales),
      topProducts: Array.from(topProductsMap.values())
        .map((product) => ({
          productId: product.productId,
          productName: product.productName,
          quantitySold: product.quantitySold,
          grossSales: product.grossSales,
          orderTypes: Array.from(product.orderTypesMap.values()).sort(
            (a, b) => b.quantitySold - a.quantitySold || b.grossSales - a.grossSales,
          ),
        }))
        .sort((a, b) => b.quantitySold - a.quantitySold || b.grossSales - a.grossSales)
        .slice(0, 12),
      timeline: this.buildShiftTimeline(shift),
    };
  }

  private assertShiftAccess(shift: { userId: number }, actor: { id: number; role: string }) {
    const isPrivileged = actor.role === 'ADMIN' || actor.role === 'SUPERVISOR';
    if (!isPrivileged && shift.userId !== actor.id) {
      throw new ForbiddenException('No puedes operar un turno que pertenece a otro usuario');
    }
  }

  async open(userId: number, openCashShiftDto: OpenCashShiftDto) {
    try {
      // Check if user already has an open shift
      const existingShift = await this.prisma.cashShift.findFirst({
        where: { userId, status: 'OPEN' }
      });

      if (existingShift) {
        throw new ConflictException('Ya tienes un turno de caja abierto');
      }

      return await this.prisma.cashShift.create({
        data: {
          userId,
          openingAmount: openCashShiftDto.openingAmount,
          status: 'OPEN',
        },
        include: { user: { select: { name: true } } }
      });
    } catch (error) {
      if (error instanceof ConflictException) throw error;
      this.logger.error(`Error opening cash shift: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Error interno al abrir el turno de caja');
    }
  }

  async findAnyOpenShift() {
    return this.prisma.cashShift.findFirst({
      where: { status: 'OPEN' },
      orderBy: { openedAt: 'desc' },
      include: {
        user: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
  }

  async close(id: number, closeCashShiftDto: CloseCashShiftDto, actor: { id: number; role: string }) {
    try {
      const shift = await this.prisma.cashShift.findUnique({ where: { id } });

      if (!shift) throw new NotFoundException('Turno de caja no encontrado');
      this.assertShiftAccess(shift, actor);
      if (shift.status === 'CLOSED') throw new BadRequestException('El turno ya está cerrado');

      // Normalize stale order states before checking whether the shift can be closed.
      await this.normalizeOrdersForShiftClosure();
      const blocking = await this.getShiftBlockingSummary();

      if (blocking.orders.length > 0) {
        const orderList = blocking.orders.map((order) => order.orderNumber).join(', ');
        throw new BadRequestException({
          message: 'No se puede cerrar el turno porque existen órdenes o cuentas pendientes.',
          totalOpenOrders: blocking.openOrders.length,
          totalPendingPayments: blocking.pendingPayments,
          totalActiveAccounts: blocking.activeAccounts.length,
          orderNumbers: orderList,
        });
      }

      const updatedShift = await this.prisma.cashShift.update({
        where: { id },
        data: {
          closingAmount: closeCashShiftDto.closingAmount,
          closingUsdAmount: closeCashShiftDto.closingUsdAmount ?? 0,
          closingCardAmount: closeCashShiftDto.closingCardAmount,
          status: 'CLOSED',
          closedAt: new Date(),
        }
      });

      const report = await this.getShiftSummary(id);
      let email: any = {
        attempted: false,
        sent: false,
        message: 'Envio de correo no ejecutado.',
      };

      try {
        email = await this.cashShiftEmailService.sendShiftReportEmail(id, report);
      } catch (emailError: any) {
        email = {
          attempted: true,
          sent: false,
          message: emailError?.message || 'No se pudo enviar el corte por correo.',
        };
        this.logger.error(`Error sending shift email for shift ${id}: ${emailError?.message}`, emailError?.stack);
      }

      try {
        await this.enqueueShiftClosedWhatsappDispatch(id, report);
      } catch (dispatchError: any) {
        this.logger.error(
          `Error creating WhatsApp dispatch for shift ${id}: ${dispatchError?.message}`,
          dispatchError?.stack,
        );
      }

      return {
        shift: updatedShift,
        report,
        email,
      };
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException ||
        error instanceof ForbiddenException
      ) throw error;
      this.logger.error(`Error closing cash shift: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Error interno al cerrar el turno de caja');
    }
  }


  async addMovement(
    shiftId: number,
    actor: { id: number; role: string },
    createCashMovementDto: CreateCashMovementDto,
  ) {
    try {
      const shift = await this.prisma.cashShift.findUnique({ where: { id: shiftId } });
      if (!shift) throw new NotFoundException('Turno de caja no encontrado');
      this.assertShiftAccess(shift, actor);
      if (shift.status === 'CLOSED') throw new BadRequestException('No se pueden añadir movimientos a un turno cerrado');

      // If it's an OUT movement, verify we have enough cash
      if (createCashMovementDto.movementType === 'OUT') {
        const summary = await this.getShiftSummary(shiftId);
        if (createCashMovementDto.amount > summary.expectedBalance) {
          throw new BadRequestException(`Saldo insuficiente en caja. Saldo disponible: $${summary.expectedBalance}`);
        }
      }

      return await this.prisma.cashMovement.create({
        data: {
          shiftId,
          movementType: createCashMovementDto.movementType,
          amount: createCashMovementDto.amount,
          reason: createCashMovementDto.reason,
          createdBy: actor.id,
        }
      });
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException ||
        error instanceof ForbiddenException
      ) throw error;
      this.logger.error(`Error adding cash movement: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Error interno al registrar el movimiento');
    }
  }

  async getShiftSummary(shiftId: number, actor?: { id: number; role: string }) {
    try {
      const shift = await this.prisma.cashShift.findUnique({
        where: { id: shiftId },
        include: {
          movements: {
            include: {
              creator: { select: { name: true } },
            },
          },
          payments: {
            include: {
              order: {
                select: {
                  id: true,
                  orderNumber: true,
                  orderType: true,
                  status: true,
                  items: {
                    select: {
                      productId: true,
                      quantity: true,
                      price: true,
                      modifiers: {
                        select: {
                          price: true,
                        },
                      },
                      redeemableProductId: true,
                      product: {
                        select: {
                          id: true,
                          name: true,
                        },
                      },
                    },
                  },
                  user: { select: { id: true, name: true } },
                },
              },
            },
          },
        }
      });

      if (!shift) throw new NotFoundException('Turno de caja no encontrado');
      if (actor) {
        this.assertShiftAccess(shift, actor);
      }
      return this.buildShiftReport(shift);
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      this.logger.error(`Error getting shift summary: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Error al generar el resumen del turno');
    }
  }

  async findCurrentByUser(userId: number) {
    const shift = await this.prisma.cashShift.findFirst({
      where: { userId, status: 'OPEN' },
      include: {
        movements: {
          include: {
            creator: {
              select: {
                name: true,
              },
            },
          },
        },
        payments: {
          include: {
            order: {
              select: {
                id: true,
                orderNumber: true,
                status: true,
                user: {
                  select: {
                    name: true,
                  },
                },
              },
            },
          },
        },
        orders: {
          include: {
            payments: true,
            user: {
              select: {
                name: true,
              },
            },
          },
        },
        user: { select: { name: true } }
      }
    });

    if (!shift) {
      return null;
    }

    return {
      ...shift,
      movements: this.buildShiftTimeline(shift),
    };
  }

  async findAll(actor: { id: number; role: string }) {
    return this.prisma.cashShift.findMany({
      where:
        actor.role === 'ADMIN' || actor.role === 'SUPERVISOR'
          ? undefined
          : { userId: actor.id },
      orderBy: { openedAt: 'desc' },
      include: { user: { select: { name: true } } }
    });
  }

  async getMovements(shiftId: number) {
    return this.prisma.cashMovement.findMany({
      where: { shiftId },
      include: { creator: { select: { name: true } } }
    });
  }

  async resendShiftEmail(
    shiftId: number,
    actor: { id: number; role: string },
    options?: { to?: string; cc?: string },
  ) {
    const shift = await this.prisma.cashShift.findUnique({
      where: { id: shiftId },
      select: {
        id: true,
        userId: true,
        status: true,
      },
    });

    if (!shift) throw new NotFoundException('Turno de caja no encontrado');
    this.assertShiftAccess(shift, actor);

    if (shift.status !== 'CLOSED') {
      throw new BadRequestException('Solo se pueden reenviar por correo turnos cerrados');
    }

    const report = await this.getShiftSummary(shiftId, actor);
    try {
      return await this.cashShiftEmailService.sendShiftReportEmail(shiftId, report, options);
    } catch (emailError: any) {
      this.logger.error(
        `Error resending shift email for shift ${shiftId}: ${emailError?.message}`,
        emailError?.stack,
      );

      return {
        attempted: true,
        sent: false,
        message: emailError?.message || 'No se pudo reenviar el corte por correo.',
      };
    }
  }

  async testShiftEmailConfiguration(options?: TestCashShiftEmailDto) {
    try {
      return await this.cashShiftEmailService.sendTestEmail({
        host: options?.shiftEmailHost,
        port: options?.shiftEmailPort,
        secure: options?.shiftEmailSecure,
        user: options?.shiftEmailUser,
        password: options?.shiftEmailPassword,
        from: options?.shiftEmailFrom,
        to: options?.shiftEmailTo,
        cc: options?.shiftEmailCc,
      });
    } catch (emailError: any) {
      this.logger.error(
        `Error testing shift email configuration: ${emailError?.message}`,
        emailError?.stack,
      );

      return {
        attempted: true,
        sent: false,
        verified: false,
        message: emailError?.message || 'No se pudo enviar el correo de prueba.',
      };
    }
  }
}
