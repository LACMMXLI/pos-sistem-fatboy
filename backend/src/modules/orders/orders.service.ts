import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../prisma/prisma.service';
import {
  AddItemsDto,
  CreateOrderDto,
  OrderType,
  OrderStatus,
  PaymentStatus,
  UpdateOrderStatusDto,
} from './dto/order.dto';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { buildOrderSummary } from './order-summary.util';
import { UsersService } from '../users/users.service';
import { Prisma } from '@prisma/client';
import { LoyaltyService } from '../loyalty/loyalty.service';

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    private prisma: PrismaService,
    private realtimeGateway: RealtimeGateway,
    private usersService: UsersService,
    private loyaltyService: LoyaltyService = {
      addPoints: async () => undefined,
    } as unknown as LoyaltyService,
  ) {}

  private async getSystemConfig() {
    const config = await this.prisma.systemConfig.findUnique({ where: { id: 1 } });

    return {
      taxEnabled: config?.taxEnabled ?? true,
      taxRate: Number(config?.taxRate ?? 16),
    };
  }

  private getOrderInclude(): Prisma.OrderInclude {
    return {
      items: {
        orderBy: [
          { submissionBatch: 'asc' },
          { id: 'asc' },
        ],
        include: {
          product: true,
          modifiers: true,
          redeemableProduct: true,
        },
      },
      user: {
        select: {
          id: true,
          name: true,
        },
      },
      customer: true,
      customerAddress: true,
      table: true,
      waiter: {
        select: {
          id: true,
          name: true,
          role: {
            select: {
              name: true,
            },
          },
        },
      },
      payments: true,
      discounts: true,
      kitchenOrder: true,
    };
  }

  private async enrichOrder<T extends { items: any[]; discounts?: any[]; payments?: any[] }>(
    order: T,
  ) {
    const config = await this.getSystemConfig();

    return {
      ...order,
      ...buildOrderSummary(order, config),
    };
  }

  private async enrichOrders<T extends { items: any[]; discounts?: any[]; payments?: any[] }>(
    orders: T[],
  ) {
    const config = await this.getSystemConfig();

    return orders.map((order) => ({
      ...order,
      ...buildOrderSummary(order, config),
    }));
  }

  private async validateWaiter(waiterId?: number | null) {
    if (!waiterId) return;

    const waiter = await this.prisma.user.findUnique({
      where: { id: waiterId },
      include: { role: true },
    });

    if (!waiter || waiter.role.name !== 'MESERO' || !waiter.isActive) {
      throw new BadRequestException('El mesero asignado no es válido');
    }
  }

  private async validateTableForOrder(
    tx: any,
    tableId?: number | null,
  ) {
    if (!tableId) return null;

    const table = await tx.table.findUnique({ where: { id: tableId } });
    if (!table) {
      throw new NotFoundException('La mesa especificada no existe');
    }
    if (!table.isActive) {
      throw new BadRequestException('La mesa seleccionada está inactiva');
    }
    const activeOrder = await tx.order.findFirst({
      where: {
        tableId,
        status: { notIn: [OrderStatus.CLOSED, OrderStatus.CANCELLED] },
        paymentStatus: { in: [PaymentStatus.PENDING, PaymentStatus.PARTIAL] },
      },
      select: { id: true, orderNumber: true },
    });

    if (activeOrder) {
      throw new BadRequestException(
        `La mesa ya tiene una cuenta activa: ${activeOrder.orderNumber}`,
      );
    }
    if (table.status !== 'AVAILABLE') {
      throw new BadRequestException('La mesa seleccionada no está disponible');
    }

    return table;
  }

  private async resolveOrderItems(items: AddItemsDto['items']) {
    const productIds = [...new Set(items.map((item) => item.productId))];
    const redeemableProductIds = [
      ...new Set(items.map((item) => item.redeemableProductId).filter(Boolean)),
    ] as number[];
    const modifierIds = [
      ...new Set(
        items.flatMap((item) => item.selectedModifierIds ?? []).filter(Boolean),
      ),
    ];

    const products = await this.prisma.product.findMany({
      where: { id: { in: productIds } },
      include: {
        modifiers: modifierIds.length > 0
          ? {
              where: { id: { in: modifierIds } },
            }
          : true,
      },
    });

    if (products.length !== productIds.length) {
      throw new BadRequestException('Uno o más productos no existen');
    }

    const productMap = new Map(products.map((product) => [product.id, product]));
    const redeemableProducts = redeemableProductIds.length > 0
      ? await this.prisma.redeemableProduct.findMany({
          where: {
            id: { in: redeemableProductIds },
          },
        })
      : [];
    const redeemableMap = new Map(redeemableProducts.map((entry) => [entry.id, entry]));

    return items.map((item) => {
      const product = productMap.get(item.productId);
      if (!product) {
        throw new BadRequestException(`El producto ${item.productId} no existe`);
      }
      if (!product.isAvailable) {
        throw new BadRequestException(`El producto ${product.name} no está disponible`);
      }

      const redeemableProduct = item.redeemableProductId
        ? redeemableMap.get(item.redeemableProductId)
        : null;

      if (item.redeemableProductId && !redeemableProduct) {
        throw new BadRequestException('El producto canjeable seleccionado no existe');
      }

      if (redeemableProduct && (!redeemableProduct.isActive || redeemableProduct.productId !== product.id)) {
        throw new BadRequestException(`El producto ${product.name} no está disponible para canje`);
      }

      const selectedModifiers = (item.selectedModifierIds ?? []).map((modifierId) => {
        const modifier = product.modifiers.find((entry) => entry.id === modifierId);
        if (!modifier) {
          throw new BadRequestException(
            `El modificador ${modifierId} no pertenece al producto ${product.name}`,
          );
        }

        return modifier;
      });

      return {
        product,
        quantity: item.quantity,
        notes: item.notes,
        modifiers: selectedModifiers,
        redeemableProduct,
      };
    });
  }

  private buildOrderItemCreates(items: Awaited<ReturnType<OrdersService['resolveOrderItems']>>) {
    return items.map((item) => ({
      productId: item.product.id,
      redeemableProductId: item.redeemableProduct?.id,
      quantity: item.quantity,
      price: item.redeemableProduct ? 0 : item.product.price,
      notes: item.notes,
      modifiers: item.modifiers.length > 0
        ? {
            create: item.modifiers.map((modifier) => ({
              modifierId: modifier.id,
              name: modifier.name,
              price: modifier.price,
            })),
          }
        : undefined,
    }));
  }

  private buildOrderItemCreatesWithSubmission(
    items: Awaited<ReturnType<OrdersService['resolveOrderItems']>>,
    options?: { submittedAt?: Date | null; submissionBatch?: number | null; status?: string },
  ) {
    return this.buildOrderItemCreates(items).map((item) => ({
      ...item,
      status: options?.status ?? 'PENDING',
      submittedAt: options?.submittedAt ?? undefined,
      submissionBatch: options?.submissionBatch ?? undefined,
    }));
  }

  private shouldDispatchToKitchen(orderType: OrderType) {
    return orderType === OrderType.DINE_IN || orderType === OrderType.DELIVERY;
  }

  private validateItemsRequirement(
    orderType: OrderType,
    items: CreateOrderDto['items'],
    manualSubmit?: boolean,
  ) {
    if ((items?.length ?? 0) > 0) {
      return;
    }

    if (manualSubmit && orderType === OrderType.DINE_IN) {
      return;
    }

    throw new BadRequestException('La orden debe incluir al menos un producto');
  }

  private ensureMeseroCanOperateOrder(
    order: { tableId?: number | null; waiterId?: number | null },
    actor?: { id: number; role: string },
  ) {
    if (actor?.role !== 'MESERO') {
      return;
    }

    if (!order.tableId) {
      throw new ForbiddenException(
        'El mesero solo puede operar pedidos en mesa',
      );
    }

    if (order.waiterId && order.waiterId !== actor.id) {
      throw new ForbiddenException(
        'El mesero solo puede operar sus propias mesas',
      );
    }
  }

  private mapOrderWithTabletState<T extends { items: any[] }>(order: T) {
    const draftItems = order.items.filter((item) => !item.submittedAt);
    const submittedItems = order.items.filter((item) => !!item.submittedAt);

    return {
      ...order,
      draftItems,
      submittedItems,
    };
  }

  private requiresImmediatePayment(orderType: OrderType) {
    return orderType === OrderType.TAKE_AWAY;
  }

  private async resolveOperationalShift(actor: { id: number; role: string }, providedShiftId?: number) {
    if (providedShiftId) {
      const shift = await this.prisma.cashShift.findUnique({
        where: { id: providedShiftId },
      });

      if (!shift) {
        throw new NotFoundException(`Turno con ID ${providedShiftId} no encontrado`);
      }

      if (shift.status !== 'OPEN') {
        throw new BadRequestException(`El turno #${providedShiftId} ya está cerrado`);
      }

      // Validación de pertenencia: Los cajeros solo pueden operar su propio turno
      if (actor.role === 'CAJERO' && shift.userId !== actor.id) {
        throw new ForbiddenException(
          'Seguridad: No puedes registrar pedidos en un turno que pertenece a otro cajero',
        );
      }

      return shift;
    }

    if (actor.role === 'MESERO') {
      const openShifts = await this.prisma.cashShift.findMany({
        where: { status: 'OPEN' },
        orderBy: { openedAt: 'desc' },
      });

      if (openShifts.length === 0) {
        throw new BadRequestException(
          'No hay ningún turno de caja abierto. Por favor, abre caja antes de comandar.',
        );
      }

      // Si hay múltiples turnos abiertos (ej. varias cajas), por defecto los meseros
      // se ligan al turno más reciente (openShifts[0]) si el dispositivo no especifica uno.
      return openShifts[0];
    }

    const openShift = await this.prisma.cashShift.findFirst({
      where: { userId: actor.id, status: 'OPEN' },
    });

    if (!openShift) {
      throw new BadRequestException(
        'Debes abrir un turno de caja antes de realizar pedidos',
      );
    }

    return openShift;
  }

  private async getShiftFilter(actor?: { id: number; role: string }) {
    if (!actor || actor.role === 'ADMIN' || actor.role === 'SUPERVISOR' || actor.role === 'COCINA') {
      return {};
    }

    if (actor.role === 'CAJERO') {
      const activeShift = await this.prisma.cashShift.findFirst({
        where: { userId: actor.id, status: 'OPEN' },
      });
      // Si no hay turno abierto, forzamos un ID inexistente para no mostrar nada
      if (!activeShift) return { shiftId: -1 };
      
      return { shiftId: activeShift.id };
    }

    return {};
  }

  private async ensureShiftAccess(order: any, actor?: { id: number; role: string }) {
    if (!actor || actor.role === 'ADMIN' || actor.role === 'SUPERVISOR' || actor.role === 'COCINA') {
      return;
    }

    if (actor.role === 'CAJERO') {
      const activeShift = await this.prisma.cashShift.findFirst({
        where: { userId: actor.id, status: 'OPEN' },
      });
      
      if (!activeShift || order.shiftId !== activeShift.id) {
        throw new ForbiddenException(
          'Seguridad: No tienes permiso para acceder a órdenes de otros turnos',
        );
      }
    }
  }

  private buildAddressSnapshot(address: any): Prisma.InputJsonValue | undefined {
    if (!address) return undefined;

    return {
      id: address.id,
      label: address.label,
      recipientName: address.recipientName,
      phone: address.phone,
      street: address.street,
      exteriorNumber: address.exteriorNumber,
      interiorNumber: address.interiorNumber,
      neighborhood: address.neighborhood,
      city: address.city,
      state: address.state,
      postalCode: address.postalCode,
      references: address.references,
      isDefault: address.isDefault,
    };
  }

  private buildManualDeliveryAddressSnapshot(address: any): Prisma.InputJsonValue | undefined {
    if (!address) return undefined;

    return {
      label: address.label ?? null,
      recipientName: address.recipientName ?? null,
      phone: address.phone ?? null,
      street: address.street ?? null,
      exteriorNumber: address.exteriorNumber ?? null,
      interiorNumber: address.interiorNumber ?? null,
      neighborhood: address.neighborhood ?? null,
      city: address.city ?? null,
      state: address.state ?? null,
      postalCode: address.postalCode ?? null,
      references: address.references ?? null,
      source: 'MANUAL',
    };
  }

  private getAllowedStatuses(orderType: OrderType) {
    if (orderType === OrderType.DELIVERY) {
      return [
        OrderStatus.OPEN,
        OrderStatus.IN_PROGRESS,
        OrderStatus.READY,
        OrderStatus.OUT_FOR_DELIVERY,
        OrderStatus.DELIVERED,
        OrderStatus.CLOSED,
        OrderStatus.CANCELLED,
      ];
    }

    return [
      OrderStatus.OPEN,
      OrderStatus.IN_PROGRESS,
      OrderStatus.READY,
      OrderStatus.CLOSED,
      OrderStatus.CANCELLED,
    ];
  }

  private canTransitionToStatus(
    orderType: OrderType,
    currentStatus: OrderStatus,
    nextStatus: OrderStatus,
  ) {
    if (currentStatus === nextStatus) return true;

    const transitionsByType: Record<OrderType, Partial<Record<OrderStatus, OrderStatus[]>>> = {
      [OrderType.DINE_IN]: {
        [OrderStatus.OPEN]: [OrderStatus.IN_PROGRESS, OrderStatus.READY, OrderStatus.CANCELLED],
        [OrderStatus.IN_PROGRESS]: [OrderStatus.READY, OrderStatus.CANCELLED],
        [OrderStatus.READY]: [OrderStatus.CLOSED, OrderStatus.CANCELLED],
        [OrderStatus.CLOSED]: [OrderStatus.CANCELLED],
      },
      [OrderType.TAKE_AWAY]: {
        [OrderStatus.OPEN]: [OrderStatus.IN_PROGRESS, OrderStatus.READY, OrderStatus.CANCELLED],
        [OrderStatus.IN_PROGRESS]: [OrderStatus.READY, OrderStatus.CANCELLED],
        [OrderStatus.READY]: [OrderStatus.CLOSED, OrderStatus.CANCELLED],
        [OrderStatus.CLOSED]: [OrderStatus.CANCELLED],
      },
      [OrderType.DELIVERY]: {
        [OrderStatus.OPEN]: [OrderStatus.IN_PROGRESS, OrderStatus.READY, OrderStatus.CANCELLED],
        [OrderStatus.IN_PROGRESS]: [OrderStatus.READY, OrderStatus.CANCELLED],
        [OrderStatus.READY]: [OrderStatus.OUT_FOR_DELIVERY, OrderStatus.CANCELLED],
        [OrderStatus.OUT_FOR_DELIVERY]: [OrderStatus.DELIVERED, OrderStatus.CANCELLED],
        [OrderStatus.DELIVERED]: [OrderStatus.CLOSED],
        [OrderStatus.CLOSED]: [OrderStatus.CANCELLED],
      },
    };

    return transitionsByType[orderType]?.[currentStatus]?.includes(nextStatus) ?? false;
  }

  private isCashPayment(paymentMethod: string) {
    return ['CASH', 'EFECTIVO'].includes(paymentMethod.toUpperCase());
  }

  private normalizeCurrency(currency?: string | null) {
    const normalized = String(currency ?? 'MXN').trim().toUpperCase();
    return normalized === 'USD' ? 'USD' : 'MXN';
  }

  private emitOrderPrintJob(payload: {
    orderId: number;
    type: 'CLIENT' | 'KITCHEN';
    source: string;
    copies?: number;
    openDrawer?: boolean;
  }) {
    this.realtimeGateway.emitPrintJob({
      jobId: `${payload.source}:${payload.orderId}:${payload.type}:${Date.now()}`,
      orderId: payload.orderId,
      type: payload.type,
      copies: payload.copies ?? 1,
      openDrawer: payload.openDrawer ?? false,
      source: payload.source,
    });
  }

  async create(createOrderDto: CreateOrderDto, actor: { id: number; role: string }) {
    try {
      const userId = actor.id;
      const openShift = await this.resolveOperationalShift(actor, createOrderDto.shiftId);

      this.validateItemsRequirement(
        createOrderDto.orderType,
        createOrderDto.items,
        createOrderDto.manualSubmit,
      );

      const waiterId =
        actor.role === 'MESERO'
          ? actor.id
          : createOrderDto.waiterId;

      if (actor.role === 'MESERO' && createOrderDto.orderType !== OrderType.DINE_IN) {
        throw new ForbiddenException(
          'El mesero solo puede registrar pedidos en mesa',
        );
      }

      if (
        actor.role === 'MESERO' &&
        createOrderDto.waiterId &&
        createOrderDto.waiterId !== actor.id
      ) {
        throw new ForbiddenException(
          'El mesero solo puede registrar pedidos a su nombre',
        );
      }

      if (createOrderDto.orderType === OrderType.DINE_IN) {
        if (!createOrderDto.tableId) {
          throw new BadRequestException('Las órdenes en mesa requieren una mesa asignada');
        }

        if (!waiterId) {
          throw new BadRequestException('Las órdenes en mesa requieren un mesero asignado');
        }
      } else {
        if (createOrderDto.tableId) {
          throw new BadRequestException(
            'Las ventas de barra o servicio rápido no deben llevar mesa asignada',
          );
        }

        if (waiterId) {
          throw new BadRequestException(
            'Las ventas de barra o servicio rápido no deben llevar mesero asignado',
          );
        }
      }

      await this.validateWaiter(waiterId);
      let customer: any = null;
      let customerAddress: any = null;

      if (createOrderDto.customerId) {
        customer = await this.prisma.customer.findUnique({
          where: { id: createOrderDto.customerId },
          include: {
            addresses: true,
            loyaltyAccount: true,
          },
        });

        if (!customer) {
          throw new BadRequestException('El cliente especificado no existe');
        }
      }

      if (createOrderDto.customerAddressId) {
        customerAddress = await this.prisma.customerAddress.findUnique({
          where: { id: createOrderDto.customerAddressId },
        });

        if (!customerAddress) {
          throw new BadRequestException('El domicilio especificado no existe');
        }

        if (customer && customerAddress.customerId !== customer.id) {
          throw new BadRequestException(
            'El domicilio seleccionado no pertenece al cliente indicado',
          );
        }

        if (!customer) {
          customer = await this.prisma.customer.findUnique({
            where: { id: customerAddress.customerId },
            include: { addresses: true, loyaltyAccount: true },
          });
        }
      }

      if (createOrderDto.orderType === OrderType.DELIVERY && !customerAddress && customer) {
        customerAddress = customer.addresses.find((address: any) => address.isDefault) ?? null;
      }

      const resolvedItems = await this.resolveOrderItems(createOrderDto.items);
      const redeemableItems = resolvedItems.filter((item) => !!item.redeemableProduct);
      const regularItems = resolvedItems.filter((item) => !item.redeemableProduct);

      if (redeemableItems.length > 0 && !customer?.id) {
        throw new BadRequestException('Debes asignar un cliente para agregar productos canjeables');
      }

      if (redeemableItems.length > 0 && regularItems.length === 0) {
        throw new BadRequestException('Los productos canjeables solo se permiten dentro de una orden con productos normales');
      }

      const totalRedeemablePoints = redeemableItems.reduce(
        (sum, item) => sum + (item.redeemableProduct?.pointsCost ?? 0) * item.quantity,
        0,
      );

      if (totalRedeemablePoints > 0) {
        const customerPoints = customer?.loyaltyAccount?.points ?? 0;
        if (customerPoints < totalRedeemablePoints) {
          throw new BadRequestException('El cliente no tiene suficientes puntos para incluir estos canjes');
        }
      }

      const config = await this.getSystemConfig();
      const itemsForSummary = resolvedItems.map((item) => ({
        quantity: item.quantity,
        price: Number(item.redeemableProduct ? 0 : item.product.price),
        modifiers: item.modifiers.map((modifier) => ({
          price: Number(modifier.price),
        })),
      }));
      const subtotal = itemsForSummary.reduce(
        (sum, item) =>
          sum +
          (Number(item.price) +
            item.modifiers.reduce((modifierSum, modifier) => modifierSum + Number(modifier.price), 0)) *
            item.quantity,
        0,
      );
      const taxAmount = config.taxEnabled ? subtotal * (config.taxRate / 100) : 0;
      const totalAmount = Number((subtotal + taxAmount).toFixed(2));
      const requiresImmediatePayment = this.requiresImmediatePayment(createOrderDto.orderType);

      if (
        createOrderDto.orderType === OrderType.DELIVERY &&
        !customerAddress &&
        !createOrderDto.deliveryAddress
      ) {
        throw new BadRequestException(
          'Las órdenes a domicilio requieren un domicilio registrado o un domicilio manual',
        );
      }

      if (requiresImmediatePayment && !createOrderDto.payment) {
        throw new BadRequestException(
          'Las órdenes de servicio rápido deben registrarse con pago confirmado',
        );
      }

      if (!requiresImmediatePayment && createOrderDto.payment) {
        throw new BadRequestException(
          'Las órdenes de mesa no deben cobrarse al momento de abrir la cuenta',
        );
      }

      if (createOrderDto.payment) {
        const paymentAmount = Number(createOrderDto.payment.amount.toFixed(2));
        if (Math.abs(paymentAmount - totalAmount) > 0.01) {
          throw new BadRequestException(
            `El pago inmediato debe cubrir el total exacto de la orden ($${totalAmount.toFixed(2)})`,
          );
        }

        const paymentCurrency = this.normalizeCurrency(createOrderDto.payment.paymentCurrency);
        const exchangeRate =
          paymentCurrency === 'USD'
            ? Number(createOrderDto.payment.exchangeRate ?? 0)
            : null;
        const receivedAmount = Number(createOrderDto.payment.receivedAmount);
        const receivedAmountMxn =
          paymentCurrency === 'USD'
            ? Number((receivedAmount * Number(exchangeRate)).toFixed(2))
            : receivedAmount;

        if (paymentCurrency === 'USD' && !this.isCashPayment(createOrderDto.payment.paymentMethod)) {
          throw new BadRequestException('Solo los pagos en efectivo pueden registrarse en dolares');
        }

        if (paymentCurrency === 'USD' && (!exchangeRate || exchangeRate <= 0)) {
          throw new BadRequestException('Debes capturar un tipo de cambio valido para pagos en USD');
        }

        if (receivedAmountMxn + 0.01 < paymentAmount) {
          throw new BadRequestException('El monto recibido es menor al monto del pago');
        }
      }

      const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const count = await this.prisma.order.count();
      const orderNumber = `ORD-${date}-${(count + 1).toString().padStart(4, '0')}`;

      const createdOrder = await this.prisma.$transaction(async (tx) => {
        if (createOrderDto.orderType === OrderType.DINE_IN) {
          await this.validateTableForOrder(tx as any, createOrderDto.tableId);
          await tx.table.update({
            where: { id: createOrderDto.tableId! },
            data: { status: 'OCCUPIED' },
          });
        }

        const order = await tx.order.create({
          data: {
            orderNumber,
            customerId: customer?.id,
            customerAddressId: customerAddress?.id,
            customerName: customer?.name ?? createOrderDto.customerName,
            customerPhoneSnapshot:
              customerAddress?.phone ??
              customer?.phone ??
              createOrderDto.customerPhone ??
              null,
            deliveryAddressSnapshot:
              this.buildAddressSnapshot(customerAddress) ??
              this.buildManualDeliveryAddressSnapshot(createOrderDto.deliveryAddress),
            orderType: createOrderDto.orderType,
            userId,
            shiftId: openShift.id,
            waiterId,
            tableId: createOrderDto.tableId,
            status: OrderStatus.OPEN,
            paymentStatus: createOrderDto.payment ? PaymentStatus.PAID : PaymentStatus.PENDING,
            items: {
              create: this.buildOrderItemCreatesWithSubmission(resolvedItems, {
                submittedAt:
                  createOrderDto.manualSubmit || resolvedItems.length === 0
                    ? null
                    : new Date(),
                submissionBatch:
                  createOrderDto.manualSubmit || resolvedItems.length === 0
                    ? null
                    : 1,
                status:
                  createOrderDto.manualSubmit || resolvedItems.length === 0
                    ? 'DRAFT'
                    : 'PENDING',
              }),
            },
          },
          include: this.getOrderInclude(),
        });

        if (totalRedeemablePoints > 0 && customer?.id) {
          const loyaltyAccount =
            customer.loyaltyAccount ??
            (await tx.loyaltyAccount.create({
              data: {
                customerId: customer.id,
              },
            }));

          if (loyaltyAccount.points < totalRedeemablePoints) {
            throw new BadRequestException('El cliente no tiene suficientes puntos para incluir estos canjes');
          }

          await tx.loyaltyAccount.update({
            where: { id: loyaltyAccount.id },
            data: {
              points: {
                decrement: totalRedeemablePoints,
              },
            },
          });

          await tx.loyaltyTransaction.create({
            data: {
              customerId: customer.id,
              orderId: order.id,
              type: 'REDEEM',
              points: -totalRedeemablePoints,
              description: `Canje aplicado en orden ${order.orderNumber}`,
            },
          });
        }

        if (createOrderDto.payment) {
          const paymentMethod = createOrderDto.payment.paymentMethod.toUpperCase();
          const paymentCurrency = this.normalizeCurrency(createOrderDto.payment.paymentCurrency);
          const exchangeRate =
            paymentCurrency === 'USD'
              ? Number(createOrderDto.payment.exchangeRate ?? 0)
              : null;
          const receivedAmount = Number(createOrderDto.payment.receivedAmount);
          const receivedAmountMxn =
            paymentCurrency === 'USD'
              ? Number((receivedAmount * Number(exchangeRate)).toFixed(2))
              : receivedAmount;
          const changeAmount = Number((receivedAmountMxn - Number(createOrderDto.payment.amount)).toFixed(2));
          const cashReceivedMxn = this.isCashPayment(paymentMethod) && paymentCurrency === 'MXN' ? receivedAmount : 0;
          const cashReceivedUsd = this.isCashPayment(paymentMethod) && paymentCurrency === 'USD' ? receivedAmount : 0;

          await tx.payment.create({
            data: {
              orderId: order.id,
              shiftId: openShift.id,
              paymentMethod,
              paymentCurrency,
              amount: createOrderDto.payment.amount,
              receivedAmount,
              receivedAmountMxn,
              cashReceivedMxn,
              cashReceivedUsd,
              exchangeRate,
              changeAmount,
            },
          });

          if (this.isCashPayment(paymentMethod)) {
            const reasonSuffix =
              paymentCurrency === 'USD'
                ? `Efectivo USD @ ${Number(exchangeRate).toFixed(2)}`
                : 'Efectivo MXN';
            await tx.cashMovement.create({
              data: {
                shiftId: openShift!.id,
                movementType: 'IN',
                amount: createOrderDto.payment.amount,
                reason: `Pago de orden ${order.orderNumber} (${reasonSuffix})`,
                createdBy: userId,
              },
            });
          }
        }

        if (
          resolvedItems.length > 0 &&
          !createOrderDto.manualSubmit &&
          (this.shouldDispatchToKitchen(createOrderDto.orderType) || !!createOrderDto.payment)
        ) {
          await tx.kitchenOrder.create({
            data: {
              orderId: order.id,
              status: 'PENDING',
            },
          });
        }

        return order;
      });

      const enrichedOrder = this.mapOrderWithTabletState(
        await this.enrichOrder(createdOrder),
      );

      this.realtimeGateway.emitOrderCreated({
        id: enrichedOrder.id,
        orderNumber: enrichedOrder.orderNumber,
        orderType: enrichedOrder.orderType,
        tableId: enrichedOrder.tableId,
        paymentStatus: enrichedOrder.paymentStatus,
        status: enrichedOrder.status,
        totalAmount: enrichedOrder.totalAmount,
        remainingAmount: enrichedOrder.remainingAmount,
      });

      if (
        resolvedItems.length > 0 &&
        !createOrderDto.manualSubmit &&
        (this.shouldDispatchToKitchen(createOrderDto.orderType) || !!createOrderDto.payment)
      ) {
        this.emitOrderPrintJob({
          orderId: enrichedOrder.id,
          type: 'KITCHEN',
          source: 'ORDER_CREATED',
        });
      }

      if (createOrderDto.payment) {
        const settings = (await this.prisma.systemConfig.findUnique({ where: { id: 1 } })) as any;
        if (settings?.receiptAutoPrint) {
          const paymentMethod = createOrderDto.payment.paymentMethod.toUpperCase();
          this.emitOrderPrintJob({
            orderId: enrichedOrder.id,
            type: 'CLIENT',
            source: 'ORDER_CREATED_AUTO_CLIENT',
            openDrawer: Boolean(
              settings?.cashDrawerEnabled &&
              settings?.cashDrawerOpenOnCash &&
              this.isCashPayment(paymentMethod),
            ),
          });
        }
      }

      if (createOrderDto.payment && enrichedOrder.customerId) {
        this.loyaltyService
          .addPoints(enrichedOrder.customerId, enrichedOrder.id, enrichedOrder.totalAmount)
          .catch((loyaltyError: any) => {
            this.logger.warn(
              `No se pudieron registrar puntos para la orden ${enrichedOrder.id}: ${loyaltyError.message}`,
            );
          });
      }

      return enrichedOrder;
    } catch (error: any) {
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException ||
        error instanceof ForbiddenException
      ) {
        throw error;
      }
      this.logger.error(`Error creating order: ${error.message}`, error.stack);
      if (error.code === 'P2002') {
        throw new BadRequestException('El número de orden ya existe');
      }
      throw new InternalServerErrorException('Error interno al crear la orden');
    }
  }

  async addItems(id: number, addItemsDto: AddItemsDto, actor?: { id: number; role: string }) {
    try {
      const operationalShift = actor
        ? await this.resolveOperationalShift(actor)
        : null;
      const order = await this.prisma.order.findUnique({
        where: { id },
        include: { kitchenOrder: true },
      });

      if (!order) throw new NotFoundException('Orden no encontrada');
      if (order.status === OrderStatus.CLOSED || order.status === OrderStatus.CANCELLED) {
        throw new BadRequestException(
          'No se pueden añadir productos a una orden cerrada o cancelada',
        );
      }
      this.ensureMeseroCanOperateOrder(order, actor);

      const resolvedItems = await this.resolveOrderItems(addItemsDto.items);

      const updatedOrder = await this.prisma.$transaction(async (tx) => {
        const lastSubmission = await tx.orderItem.aggregate({
          where: {
            orderId: id,
            submittedAt: { not: null },
          },
          _max: {
            submissionBatch: true,
          },
        });

        const nextBatch = (lastSubmission._max.submissionBatch ?? 0) + 1;
        const submittedAt = addItemsDto.manualSubmit ? null : new Date();

        const nextOrder = await tx.order.update({
          where: { id },
          data: {
            shiftId: order.shiftId ?? operationalShift?.id ?? undefined,
            items: {
              create: this.buildOrderItemCreatesWithSubmission(resolvedItems, {
                submittedAt,
                submissionBatch: submittedAt ? nextBatch : null,
                status: submittedAt ? 'PENDING' : 'DRAFT',
              }),
            },
            status: addItemsDto.manualSubmit ? order.status : OrderStatus.IN_PROGRESS,
          },
          include: this.getOrderInclude(),
        });

        if (!addItemsDto.manualSubmit && order.kitchenOrder) {
          await tx.kitchenOrder.update({
            where: { id: order.kitchenOrder.id },
            data: { status: 'PENDING', startedAt: null, completedAt: null },
          });
        }

        if (order.tableId) {
          await tx.table.update({
            where: { id: order.tableId },
            data: { status: 'OCCUPIED' },
          });
        }

        return nextOrder;
      });

      const enrichedOrder = this.mapOrderWithTabletState(
        await this.enrichOrder(updatedOrder),
      );

      this.realtimeGateway.emitOrderUpdated({
        id: enrichedOrder.id,
        status: enrichedOrder.status,
        paymentStatus: enrichedOrder.paymentStatus,
        totalAmount: enrichedOrder.totalAmount,
        remainingAmount: enrichedOrder.remainingAmount,
      });

      if (!addItemsDto.manualSubmit && resolvedItems.length > 0) {
        this.emitOrderPrintJob({
          orderId: enrichedOrder.id,
          type: 'KITCHEN',
          source: 'ORDER_ITEMS_ADDED',
        });
      }

      return enrichedOrder;
    } catch (error: any) {
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException ||
        error instanceof ForbiddenException
      ) {
        throw error;
      }
      this.logger.error(`Error adding items: ${error.message}`, error.stack);
      throw new InternalServerErrorException(
        'Error al añadir productos a la orden',
      );
    }
  }

  async attemptAutoClose(id: number) {
    this.logger.log(`Intentando auto-cierre para orden ${id}`);

    const order = await this.prisma.order.findUnique({
      where: { id },
      include: {
        payments: true,
        items: {
          include: {
            modifiers: true,
          },
        },
        discounts: true,
        kitchenOrder: true,
      },
    });

    if (!order) return;
    if (order.status === OrderStatus.CLOSED || order.status === OrderStatus.CANCELLED) return;

    const summary = await this.enrichOrder(order);
    const isPaid = summary.remainingAmount <= 0.01;

    // Se considera terminado si no requiere cocina o si la comanda de cocina está READY o COMPLETED
    const kitchenDone =
      !order.kitchenOrder ||
      order.kitchenOrder.status === 'READY' ||
      order.kitchenOrder.status === 'COMPLETED';

    // Caso especial para domicilio: debe estar marcado como entregado antes de cerrar
    const isDelivered =
      order.orderType !== OrderType.DELIVERY || order.status === OrderStatus.DELIVERED;

    if (isPaid && kitchenDone && isDelivered) {
      this.logger.log(`Condiciones de cierre cumplidas para orden ${id}. Cerrando...`);

      await this.prisma.$transaction(async (tx) => {
        await tx.order.update({
          where: { id },
          data: { status: OrderStatus.CLOSED },
        });

        if (order.tableId) {
          await tx.table.update({
            where: { id: order.tableId },
            data: { status: 'AVAILABLE' },
          });

          this.realtimeGateway.emitTableUpdated({
            id: order.tableId,
            status: 'AVAILABLE',
          });
        }
      });

      this.realtimeGateway.emitOrderUpdated({
        id: order.id,
        status: OrderStatus.CLOSED,
        tableId: order.tableId ?? undefined,
      });
    }
  }

  async findAll(filters?: { paymentStatus?: string }, actor?: { id: number; role: string }) {
    const paymentStatuses = filters?.paymentStatus
      ? filters.paymentStatus
          .split(',')
          .map((status) => status.trim())
          .filter(Boolean)
      : [];

    const shiftFilter = await this.getShiftFilter(actor);

    const orders = await this.prisma.order.findMany({
      where: {
        ...(paymentStatuses.length > 0
          ? {
              paymentStatus: {
                in: paymentStatuses,
              },
            }
          : {}),
        ...shiftFilter,
      },
      orderBy: { createdAt: 'desc' },
      include: this.getOrderInclude(),
    });

    return (await this.enrichOrders(orders)).map((order) => this.mapOrderWithTabletState(order));
  }

  async findOne(id: number, actor?: { id: number; role: string }) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: this.getOrderInclude(),
    });

    if (!order) {
      throw new NotFoundException(`Orden con ID ${id} no encontrada`);
    }

    await this.ensureShiftAccess(order, actor);
    this.ensureMeseroCanOperateOrder(order, actor);

    return this.mapOrderWithTabletState(await this.enrichOrder(order));
  }

  async submit(id: number, actor?: { id: number; role: string }) {
    try {
      const operationalShift = actor
        ? await this.resolveOperationalShift(actor)
        : null;
      const order = await this.prisma.order.findUnique({
        where: { id },
        include: {
          kitchenOrder: true,
          items: true,
          table: true,
        },
      });

      if (!order) {
        throw new NotFoundException('Orden no encontrada');
      }

      if (order.status === OrderStatus.CLOSED || order.status === OrderStatus.CANCELLED) {
        throw new BadRequestException(
          'No se puede enviar una comanda de una orden cerrada o cancelada',
        );
      }

      this.ensureMeseroCanOperateOrder(order, actor);

      const draftItems = order.items.filter((item) => !item.submittedAt);
      if (draftItems.length === 0) {
        throw new BadRequestException('La orden no tiene productos pendientes por enviar');
      }

      const currentMaxBatch = order.items.reduce((maxBatch, item) => {
        return Math.max(maxBatch, item.submissionBatch ?? 0);
      }, 0);
      const nextBatch = currentMaxBatch + 1;
      const submittedAt = new Date();

      await this.prisma.$transaction(async (tx) => {
        await tx.orderItem.updateMany({
          where: {
            orderId: id,
            submittedAt: null,
          },
          data: {
            status: 'PENDING',
            submittedAt,
            submissionBatch: nextBatch,
          },
        });

        await tx.order.update({
          where: { id },
          data: {
            status: OrderStatus.IN_PROGRESS,
            shiftId: order.shiftId ?? operationalShift?.id ?? undefined,
          },
        });

        if (order.kitchenOrder) {
          await tx.kitchenOrder.update({
            where: { id: order.kitchenOrder.id },
            data: {
              status: 'PENDING',
              startedAt: null,
              completedAt: null,
            },
          });
        } else {
          await tx.kitchenOrder.create({
            data: {
              orderId: id,
              status: 'PENDING',
            },
          });
        }

        if (order.tableId) {
          await tx.table.update({
            where: { id: order.tableId },
            data: { status: 'OCCUPIED' },
          });
        }
      });

      const updatedOrder = await this.findOne(id, actor);

      this.realtimeGateway.emitOrderUpdated({
        id: updatedOrder.id,
        status: updatedOrder.status,
        paymentStatus: updatedOrder.paymentStatus,
        totalAmount: updatedOrder.totalAmount,
        remainingAmount: updatedOrder.remainingAmount,
      });

      this.emitOrderPrintJob({
        orderId: updatedOrder.id,
        type: 'KITCHEN',
        source: 'ORDER_SUBMITTED',
      });

      if (updatedOrder.tableId) {
        this.realtimeGateway.emitTableUpdated({
          id: updatedOrder.tableId,
          status: 'OCCUPIED',
        });
      }

      return updatedOrder;
    } catch (error: any) {
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException ||
        error instanceof ForbiddenException
      ) {
        throw error;
      }

      this.logger.error(`Error submitting order: ${error.message}`, error.stack);
      throw new InternalServerErrorException(
        'Error interno al enviar la comanda',
      );
    }
  }

  async updateStatus(
    id: number,
    updateStatusDto: UpdateOrderStatusDto,
    actor?: { id: number; role: string },
  ) {
    try {
      const order = await this.findOne(id);
      this.ensureMeseroCanOperateOrder(order, actor);
      const orderType = order.orderType as OrderType;
      const currentStatus = order.status as OrderStatus;

      if (!this.getAllowedStatuses(orderType).includes(updateStatusDto.status)) {
        throw new BadRequestException(
          `El estado ${updateStatusDto.status} no es válido para órdenes ${orderType}`,
        );
      }

      if (!this.canTransitionToStatus(orderType, currentStatus, updateStatusDto.status)) {
        throw new BadRequestException(
          `No se puede cambiar la orden ${orderType} de ${currentStatus} a ${updateStatusDto.status}`,
        );
      }

      if (updateStatusDto.status === OrderStatus.CANCELLED) {
        if (!updateStatusDto.adminPassword) {
          throw new BadRequestException(
            'Se requiere la contraseña del administrador para cancelar la cuenta',
          );
        }

        const authorizedAdmin = await this.usersService.validateActiveAdminPassword(
          updateStatusDto.adminPassword,
        );

        if (!authorizedAdmin) {
          throw new UnauthorizedException('Contraseña de administrador incorrecta');
        }
      } else if (actor?.role === 'MESERO') {
        throw new ForbiddenException(
          'El mesero solo puede cambiar el estado de una orden al cancelarla con autorización de administrador',
        );
      }

      if (
        updateStatusDto.status === OrderStatus.CLOSED &&
        order.remainingAmount > 0.01
      ) {
        throw new BadRequestException(
          'No se puede cerrar una orden con saldo pendiente',
        );
      }

      if (
        orderType === OrderType.DELIVERY &&
        updateStatusDto.status === OrderStatus.CLOSED &&
        currentStatus !== OrderStatus.DELIVERED
      ) {
        throw new BadRequestException(
          'La orden a domicilio solo puede cerrarse después de marcarse como entregada',
        );
      }

      const updatedOrder = await this.prisma.$transaction(async (tx) => {
        const nextOrder = await tx.order.update({
          where: { id },
          data: { status: updateStatusDto.status },
          include: this.getOrderInclude(),
        });

        if (
          (updateStatusDto.status === OrderStatus.CLOSED ||
            updateStatusDto.status === OrderStatus.CANCELLED) &&
          order.tableId
        ) {
          await tx.table.update({
            where: { id: order.tableId },
            data: { status: 'AVAILABLE' },
          });
        }

        return nextOrder;
      });

      const enrichedOrder = await this.enrichOrder(updatedOrder);

      this.realtimeGateway.emitOrderUpdated({
        id: enrichedOrder.id,
        status: enrichedOrder.status,
        paymentStatus: enrichedOrder.paymentStatus,
        totalAmount: enrichedOrder.totalAmount,
        remainingAmount: enrichedOrder.remainingAmount,
      });

      return enrichedOrder;
    } catch (error: any) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      this.logger.error(`Error updating order status: ${error.message}`, error.stack);
      throw new InternalServerErrorException(
        'Error interno al actualizar el estado de la orden',
      );
    }
  }

  async getActiveOrders(actor?: { id: number; role: string }) {
    const shiftFilter = await this.getShiftFilter(actor);
    const orders = await this.prisma.order.findMany({
      where: {
        status: { notIn: [OrderStatus.CLOSED, OrderStatus.CANCELLED] },
        ...(actor?.role === 'MESERO' ? { waiterId: actor.id } : {}),
        ...shiftFilter,
      },
      include: this.getOrderInclude(),
      orderBy: { createdAt: 'desc' },
    });

    return (await this.enrichOrders(orders)).map((order) => this.mapOrderWithTabletState(order));
  }

  async getOpenOrders(filters?: { orderType?: string }, actor?: { id: number; role: string }) {
    const shiftFilter = await this.getShiftFilter(actor);
    const orders = await this.prisma.order.findMany({
      where: {
        paymentStatus: {
          in: [PaymentStatus.PENDING, PaymentStatus.PARTIAL],
        },
        status: { notIn: [OrderStatus.CLOSED, OrderStatus.CANCELLED] },
        ...(filters?.orderType ? { orderType: filters.orderType } : {}),
        ...(actor?.role === 'MESERO' ? { waiterId: actor.id } : {}),
        ...shiftFilter,
      },
      include: this.getOrderInclude(),
      orderBy: { createdAt: 'desc' },
    });

    return (await this.enrichOrders(orders)).map((order) => this.mapOrderWithTabletState(order));
  }

  async findByShift(shiftId: number, actor?: { id: number; role: string }) {
    if (actor?.role === 'CAJERO') {
      const activeShift = await this.prisma.cashShift.findFirst({
        where: { userId: actor.id, status: 'OPEN' },
      });
      if (activeShift && shiftId !== activeShift.id) {
        throw new ForbiddenException(
          'Seguridad: No tienes permiso para acceder a órdenes de otros turnos',
        );
      }
    }

    const orders = await this.prisma.order.findMany({
      where: { shiftId },
      include: this.getOrderInclude(),
      orderBy: { createdAt: 'desc' },
    });

    return (await this.enrichOrders(orders)).map((order) => this.mapOrderWithTabletState(order));
  }

  async printAccount(id: number, actor?: { id: number; role: string }) {
    try {
      const order = await this.prisma.order.findUnique({
        where: { id },
        include: { table: true, payments: true },
      });

      if (!order) throw new NotFoundException('Orden no encontrada');
      this.ensureMeseroCanOperateOrder(order, actor);
      if (!order.tableId) {
        throw new BadRequestException(
          'Solo las órdenes de mesa pueden marcarse como cuenta impresa',
        );
      }
      if (order.status === OrderStatus.CLOSED || order.status === OrderStatus.CANCELLED) {
        throw new BadRequestException(
          'No se puede imprimir una cuenta de una orden cerrada o cancelada',
        );
      }

      await this.prisma.table.update({
        where: { id: order.tableId },
        data: { status: 'ACCOUNT_PRINTED' },
      });

      this.realtimeGateway.emitTableUpdated({
        id: order.tableId,
        status: 'ACCOUNT_PRINTED',
      });

      this.realtimeGateway.emitOrderUpdated({
        id: order.id,
        isPrinted: true,
      });

      return { message: 'Cuenta impresa exitosamente' };
    } catch (error: any) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      this.logger.error(`Error printing account: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Error al imprimir la cuenta');
    }
  }

  async clearBusinessData(userId: number, password?: string) {
    // Verify admin password
    const user = await this.usersService.findOneWithPassword(userId);
    if (!user || user.role.name !== 'ADMIN') {
      throw new UnauthorizedException('Solo el administrador puede realizar esta acción.');
    }

    if (!password) {
      throw new BadRequestException('Se requiere la contraseña para confirmar el borrado.');
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Contraseña incorrecta.');
    }
    
    try {
      await this.prisma.$transaction(async (tx) => {
        // Enforce specific deletion order (referential integrity)
        await tx.orderItemModifier.deleteMany({});
        await tx.orderItem.deleteMany({});
        await tx.kitchenOrder.deleteMany({});
        await tx.payment.deleteMany({});
        await tx.discount.deleteMany({});
        await tx.externalOrder.deleteMany({});
        await tx.cashMovement.deleteMany({});
        await tx.order.deleteMany({});
        await tx.cashShift.deleteMany({});
        
        // Reset tables to available
        await tx.table.updateMany({
          data: { status: 'AVAILABLE' }
        });
      });

      this.realtimeGateway.server.emit('tables-updated');
      return { message: 'Datos de negocio eliminados correctamente' };
    } catch (error) {
      this.logger.error(`Error limpieza de datos: ${error.message}`);
      throw new InternalServerErrorException('Error al limpiar los datos de negocio.');
    }
  }
}
