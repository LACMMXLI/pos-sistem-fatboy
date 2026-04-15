import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { buildOrderSummary } from '../orders/order-summary.util';
import { CashShiftsService } from '../cash-shifts/cash-shifts.service';
import { PrintDocumentType } from './print-documents';

@Injectable()
export class PrintDataService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cashShiftsService: CashShiftsService,
  ) {}

  private async getSystemConfig() {
    const config = await this.prisma.systemConfig.findUnique({ where: { id: 1 } });

    return {
      restaurantName: config?.restaurantName ?? 'Mi negocio',
      restaurantAddress: config?.restaurantAddress ?? '',
      taxEnabled: config?.taxEnabled ?? true,
      taxRate: Number(config?.taxRate ?? 16),
      receiptPaperWidth: String(config?.receiptPaperWidth ?? '80'),
      receiptPrinterName: config?.receiptPrinterName ?? null,
      kitchenPrinterName: config?.kitchenPrinterName ?? null,
      kitchenPaperWidth: String(config?.kitchenPaperWidth ?? '80'),
      receiptCutEnabled: config?.receiptCutEnabled ?? true,
    };
  }

  private async getOrderPrintData(orderId: number) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        user: { select: { id: true, name: true } },
        waiter: { select: { id: true, name: true } },
        table: { include: { area: true } },
        customer: {
          include: {
            loyaltyAccount: true,
          },
        },
        customerAddress: true,
        payments: true,
        discounts: true,
        shift: {
          include: {
            user: { select: { id: true, name: true } },
          },
        },
        items: {
          orderBy: [{ submissionBatch: 'asc' }, { id: 'asc' }],
          include: {
            product: true,
            modifiers: true,
            redeemableProduct: true,
          },
        },
        loyaltyTransactions: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!order) {
      throw new NotFoundException('Orden no encontrada para impresión');
    }

    const config = await this.getSystemConfig();
    const summary = buildOrderSummary(order as any, {
      taxEnabled: config.taxEnabled,
      taxRate: config.taxRate,
    });

    const paymentDetail = (order.payments ?? []).map((payment) => ({
      method: payment.paymentMethod,
      currency: payment.paymentCurrency,
      amount: Number(payment.amount),
      receivedAmount: Number(payment.receivedAmount),
      changeAmount: Number(payment.changeAmount),
      exchangeRate: payment.exchangeRate ? Number(payment.exchangeRate) : null,
      createdAt: payment.createdAt,
    }));

    const loyaltyBalance = order.customer?.loyaltyAccount?.points ?? 0;
    const loyaltyEarned = (order.loyaltyTransactions ?? [])
      .filter((transaction) => transaction.type === 'EARN')
      .reduce((sum, transaction) => sum + Number(transaction.points), 0);
    const loyaltyRedeemed = Math.abs(
      (order.loyaltyTransactions ?? [])
        .filter((transaction) => transaction.type === 'REDEEM')
        .reduce((sum, transaction) => sum + Number(transaction.points), 0),
    );

    return {
      entityType: 'ORDER',
      entityId: String(order.id),
      config,
      order: {
        ...order,
        ...summary,
      },
      paymentDetail,
      loyaltyInfo: order.customerId
        ? {
            customerName: order.customer?.name ?? order.customerName,
            previousPoints: Math.max(loyaltyBalance - loyaltyEarned + loyaltyRedeemed, 0),
            pointsGenerated: loyaltyEarned,
            pointsRedeemed: loyaltyRedeemed,
            finalPoints: loyaltyBalance,
          }
        : null,
    };
  }

  private async getCashShiftPrintData(shiftId: number) {
    const shift = await this.prisma.cashShift.findUnique({
      where: { id: shiftId },
      include: {
        user: { select: { id: true, name: true } },
      },
    });

    if (!shift) {
      throw new NotFoundException('Turno no encontrado para impresión');
    }

    const report = await this.cashShiftsService.getShiftSummary(shiftId);
    const config = await this.getSystemConfig();

    return {
      entityType: 'CASH_SHIFT',
      entityId: String(shiftId),
      config,
      shift,
      report,
    };
  }

  private async getCashMovementPrintData(movementId: number) {
    const movement = await this.prisma.cashMovement.findUnique({
      where: { id: movementId },
      include: {
        creator: { select: { id: true, name: true } },
        shift: {
          include: {
            user: { select: { id: true, name: true } },
          },
        },
      },
    });

    if (!movement) {
      throw new NotFoundException('Movimiento de caja no encontrado para impresión');
    }

    const config = await this.getSystemConfig();

    return {
      entityType: 'CASH_MOVEMENT',
      entityId: String(movementId),
      config,
      movement,
    };
  }

  async getDocumentData(
    documentType: PrintDocumentType,
    entityType: string,
    entityId: string,
  ) {
    if (entityType === 'ORDER') {
      return this.getOrderPrintData(Number(entityId));
    }

    if (entityType === 'CASH_SHIFT' || documentType === 'CASH_CLOSING') {
      return this.getCashShiftPrintData(Number(entityId));
    }

    if (entityType === 'CASH_MOVEMENT' || documentType === 'CASH_MOVEMENT') {
      return this.getCashMovementPrintData(Number(entityId));
    }

    throw new NotFoundException(`No existe proveedor de datos para ${entityType}`);
  }
}
