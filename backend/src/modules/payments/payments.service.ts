import { Injectable, NotFoundException, InternalServerErrorException, Logger, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreatePaymentDto } from './dto/payment.dto';
import { OrderStatus, OrderType, PaymentStatus } from '../orders/dto/order.dto';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { buildOrderSummary } from '../orders/order-summary.util';
import { LoyaltyService } from '../loyalty/loyalty.service';
import { OrdersService } from '../orders/orders.service';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private prisma: PrismaService,
    private realtimeGateway: RealtimeGateway,
    private loyaltyService: LoyaltyService,
    private ordersService: OrdersService,
  ) { }

  private normalizeCurrency(currency?: string | null) {
    const normalized = String(currency ?? 'MXN').trim().toUpperCase();
    return normalized === 'USD' ? 'USD' : 'MXN';
  }

  async create(createPaymentDto: CreatePaymentDto, actor: { id: number; role: string }) {
    try {
      const userId = actor.id;
      // 1. Verify user has an open cash shift
      const openShift = await this.prisma.cashShift.findFirst({
        where: { userId, status: 'OPEN' }
      });

      if (!openShift) {
        throw new BadRequestException('No hay turno activo. Debe abrir un turno antes de registrar pagos.');
      }

      // 2. Verify order exists and isn't already paid/cancelled
      const order: any = await this.prisma.order.findUnique({
        where: { id: createPaymentDto.orderId },
        include: { 
          kitchenOrder: true,
          payments: true,
          items: {
            include: {
              modifiers: true,
            },
          },
          discounts: true
        } as any,
      });

      if (!order) {
        throw new NotFoundException(`Orden con ID ${createPaymentDto.orderId} no encontrada`);
      }

      // Seguridad: Asegurar que el cajero esté cobrando una orden de SU turno
      if (actor.role === 'CAJERO' && order.shiftId !== openShift.id) {
        throw new ForbiddenException(
          'Seguridad: No puedes procesar pagos de órdenes que pertenecen a otro turno de caja',
        );
      }

      if (order.status === OrderStatus.CANCELLED) {
        throw new BadRequestException('No se puede pagar una orden cancelada');
      }

      if (order.status === OrderStatus.CLOSED) {
        throw new BadRequestException('Esta orden ya está cerrada y pagada');
      }

      // 3. Calculate system totals (including tax & discounts)
      const config = await this.prisma.systemConfig.findUnique({ where: { id: 1 } });
      const summary = buildOrderSummary(order, {
        taxEnabled: config?.taxEnabled ?? true,
        taxRate: Number(config?.taxRate ?? 16),
      });
      const remaining = summary.remainingAmount;
      const requiresImmediateSettlement =
        order.orderType === OrderType.TAKE_AWAY && !order.kitchenOrder;

      if (Number(createPaymentDto.amount.toFixed(2)) > remaining + 0.01) {
        throw new BadRequestException(`El monto a pagar ($${createPaymentDto.amount}) excede el saldo pendiente ($${remaining})`);
      }

      if (
        requiresImmediateSettlement &&
        Number(createPaymentDto.amount.toFixed(2)) < remaining - 0.01
      ) {
        throw new BadRequestException(
          'Las órdenes de servicio rápido deben liquidarse por completo antes de enviarse a producción',
        );
      }

      const paymentMethod = createPaymentDto.paymentMethod.toUpperCase();
      const paymentCurrency = this.normalizeCurrency(createPaymentDto.paymentCurrency);
      const isCash = ['CASH', 'EFECTIVO'].includes(paymentMethod);

      if (paymentCurrency === 'USD' && !isCash) {
        throw new BadRequestException('Solo los pagos en efectivo pueden registrarse en dolares');
      }

      const exchangeRate =
        paymentCurrency === 'USD'
          ? Number(createPaymentDto.exchangeRate ?? 0)
          : null;

      if (paymentCurrency === 'USD' && (!exchangeRate || exchangeRate <= 0)) {
        throw new BadRequestException('Debes capturar un tipo de cambio valido para pagos en USD');
      }

      const receivedAmount = Number(createPaymentDto.receivedAmount);
      const amount = Number(createPaymentDto.amount);
      const receivedAmountMxn =
        paymentCurrency === 'USD'
          ? Number((receivedAmount * Number(exchangeRate)).toFixed(2))
          : receivedAmount;
      const changeAmount = Number((receivedAmountMxn - amount).toFixed(2));

      if (changeAmount < -0.01) {
        throw new BadRequestException('El monto recibido es menor al monto del pago');
      }

      const cashReceivedMxn = isCash && paymentCurrency === 'MXN' ? receivedAmount : 0;
      const cashReceivedUsd = isCash && paymentCurrency === 'USD' ? receivedAmount : 0;

      // 5. Create payment, movement and update order status in a transaction
      const result = await this.prisma.$transaction(async (tx) => {
        const payment = await tx.payment.create({
          data: {
            orderId: createPaymentDto.orderId,
            shiftId: openShift.id,
            paymentMethod,
            paymentCurrency,
            amount: createPaymentDto.amount,
            receivedAmount,
            receivedAmountMxn,
            cashReceivedMxn,
            cashReceivedUsd,
            exchangeRate,
            changeAmount,
          },
        });

        if (isCash) {
          const reasonSuffix =
            paymentCurrency === 'USD'
              ? `Efectivo USD @ ${Number(exchangeRate).toFixed(2)}`
              : 'Efectivo MXN';
          await tx.cashMovement.create({
            data: {
              shiftId: openShift.id,
              movementType: 'IN',
              amount: createPaymentDto.amount,
              reason: `Pago de orden ${order.orderNumber} (${reasonSuffix})`,
              createdBy: userId,
            }
          });
        }

        // Determine new statuses
        const newTotalPaid = summary.paidAmount + Number(createPaymentDto.amount);
        const isFullyPaid = newTotalPaid >= summary.totalAmount - 0.01;

        const newPaymentStatus = isFullyPaid ? PaymentStatus.PAID : PaymentStatus.PARTIAL;
        const shouldDispatchToKitchen =
          isFullyPaid &&
          order.orderType !== OrderType.DINE_IN &&
          !order.kitchenOrder;
        
        // El estado de la orden ya no se cierra automáticamente aquí.
        // Se delega a attemptAutoClose al final para validar cocina.
        const shiftIdForOrder = order.shiftId ?? openShift.id;

        const updatedOrder = await tx.order.update({
          where: { id: createPaymentDto.orderId },
          data: { 
            shiftId: shiftIdForOrder,
            paymentStatus: newPaymentStatus,
            // status: newOrderStatus // Quitamos la actualización directa aquí
          },
          select: {
            id: true,
            orderNumber: true,
            orderType: true,
            paymentStatus: true,
            status: true,
            tableId: true,
          },
        });

        if (shouldDispatchToKitchen) {
          await tx.kitchenOrder.create({
            data: {
              orderId: updatedOrder.id,
              status: 'PENDING',
            },
          });
        }

        return { payment, updatedOrder };
      });

      // Intentar auto-cierre centralizado (valida saldo + cocina)
      await this.ordersService.attemptAutoClose(result.updatedOrder.id);

      this.realtimeGateway.emitPaymentCreated({
        id: result.payment.id,
        orderId: result.payment.orderId,
        amount: result.payment.amount,
        paymentMethod: result.payment.paymentMethod,
      });

      this.realtimeGateway.emitOrderUpdated({
        id: result.updatedOrder.id,
        orderNumber: result.updatedOrder.orderNumber,
        orderType: result.updatedOrder.orderType,
        paymentStatus: result.updatedOrder.paymentStatus,
        status: result.updatedOrder.status,
        tableId: result.updatedOrder.tableId,
      });

      const settings = (await this.prisma.systemConfig.findUnique({ where: { id: 1 } })) as any;

      this.realtimeGateway.emitPrintJob({
        jobId: `payment:${result.payment.id}:CLIENT:${Date.now()}`,
        orderId: result.payment.orderId,
        type: 'CLIENT',
        copies: 1,
        openDrawer: Boolean(settings?.cashDrawerEnabled && settings?.cashDrawerOpenOnCash && isCash),
        source: 'PAYMENT_CREATED',
      });

      if (order.customerId) {
        this.loyaltyService
          .addPoints(order.customerId, order.id, summary.totalAmount)
          .catch((loyaltyError: any) => {
            this.logger.warn(
              `No se pudieron registrar puntos para la orden ${order.id}: ${loyaltyError.message}`,
            );
          });
      }

      return result.payment;
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      this.logger.error(`Error processing payment: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Error interno al procesar el pago');
    }
  }

  async findAll() {
    return this.prisma.payment.findMany({
      include: {
        order: {
          select: { orderNumber: true, customerName: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  async findByOrder(orderId: number) {
    return this.prisma.payment.findMany({
      where: { orderId }
    });
  }
}
