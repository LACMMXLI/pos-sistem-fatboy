import { BadRequestException } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { OrderStatus, OrderType } from '../orders/dto/order.dto';
import { PaymentMethod } from './dto/payment.dto';

describe('PaymentsService', () => {
  const createRealtimeGatewayMock = () => ({
    emitPaymentCreated: jest.fn(),
    emitOrderUpdated: jest.fn(),
    emitTableUpdated: jest.fn(),
    emitPrintJob: jest.fn(),
  });

  const createLoyaltyServiceMock = () => ({
    addPoints: jest.fn().mockResolvedValue(undefined),
  });

  const createPrismaMock = () => ({
    cashShift: {
      findFirst: jest.fn(),
    },
    order: {
      findUnique: jest.fn(),
    },
    systemConfig: {
      findUnique: jest.fn().mockResolvedValue({ id: 1, taxEnabled: true, taxRate: 16 }),
    },
    $transaction: jest.fn(),
  });

  it('assigns the cashier shift to dine-in orders created from tablet when they are paid', async () => {
    const prisma = createPrismaMock();
    const realtimeGateway = createRealtimeGatewayMock();

    prisma.cashShift.findFirst.mockResolvedValue({ id: 9, userId: 3, status: 'OPEN' });
    prisma.order.findUnique.mockResolvedValue({
      id: 15,
      orderNumber: 'ORD-20260403-0015',
      orderType: OrderType.DINE_IN,
      status: OrderStatus.READY,
      paymentStatus: 'PENDING',
      shiftId: null,
      tableId: 12,
      kitchenOrder: { id: 44, status: 'READY' },
      items: [{ quantity: 1, price: 100, modifiers: [] }],
      discounts: [],
      payments: [],
    });

    const txPaymentCreate = jest.fn().mockResolvedValue({
      id: 21,
      orderId: 15,
      amount: 116,
      paymentMethod: 'CASH',
    });
    const txCashMovementCreate = jest.fn();
    const txOrderUpdate = jest.fn().mockResolvedValue({
      id: 15,
      orderNumber: 'ORD-20260403-0015',
      orderType: OrderType.DINE_IN,
      paymentStatus: 'PAID',
      status: OrderStatus.CLOSED,
      tableId: 12,
    });
    const txTableUpdate = jest.fn();

    prisma.$transaction.mockImplementation(async (callback: any) =>
      callback({
        payment: { create: txPaymentCreate },
        cashMovement: { create: txCashMovementCreate },
        order: { update: txOrderUpdate },
        kitchenOrder: { create: jest.fn() },
        table: { update: txTableUpdate },
      }),
    );

    const service = new PaymentsService(
      prisma as any,
      realtimeGateway as any,
      createLoyaltyServiceMock() as any,
    );

    await service.create(
      {
        orderId: 15,
        paymentMethod: PaymentMethod.CASH,
        amount: 116,
        receivedAmount: 116,
      },
      3,
    );

    expect(txOrderUpdate).toHaveBeenCalledWith({
      where: { id: 15 },
      data: {
        shiftId: 9,
        paymentStatus: 'PAID',
        status: OrderStatus.CLOSED,
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
    expect(txPaymentCreate).toHaveBeenCalledWith({
      data: {
        orderId: 15,
        shiftId: 9,
        paymentMethod: 'CASH',
        paymentCurrency: 'MXN',
        amount: 116,
        receivedAmount: 116,
        receivedAmountMxn: 116,
        cashReceivedMxn: 116,
        cashReceivedUsd: 0,
        exchangeRate: null,
        changeAmount: 0,
      },
    });
  });

  it('keeps the original shift when the order is already assigned to one', async () => {
    const prisma = createPrismaMock();

    prisma.cashShift.findFirst.mockResolvedValue({ id: 9, userId: 3, status: 'OPEN' });
    prisma.order.findUnique.mockResolvedValue({
      id: 22,
      orderNumber: 'ORD-20260403-0022',
      orderType: OrderType.DINE_IN,
      status: OrderStatus.READY,
      paymentStatus: 'PENDING',
      shiftId: 5,
      tableId: 4,
      kitchenOrder: { id: 55, status: 'READY' },
      items: [{ quantity: 1, price: 100, modifiers: [] }],
      discounts: [],
      payments: [],
    });

    const txOrderUpdate = jest.fn().mockResolvedValue({
      id: 22,
      orderNumber: 'ORD-20260403-0022',
      orderType: OrderType.DINE_IN,
      paymentStatus: 'PAID',
      status: OrderStatus.CLOSED,
      tableId: 4,
    });

    prisma.$transaction.mockImplementation(async (callback: any) =>
      callback({
        payment: { create: jest.fn().mockResolvedValue({ id: 31, orderId: 22, amount: 116, paymentMethod: 'CARD' }) },
        cashMovement: { create: jest.fn() },
        order: { update: txOrderUpdate },
        kitchenOrder: { create: jest.fn() },
        table: { update: jest.fn() },
      }),
    );

    const service = new PaymentsService(
      prisma as any,
      createRealtimeGatewayMock() as any,
      createLoyaltyServiceMock() as any,
    );

    await service.create(
      {
        orderId: 22,
        paymentMethod: PaymentMethod.CARD,
        amount: 116,
        receivedAmount: 116,
      },
      3,
    );

    expect(txOrderUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          shiftId: 5,
        }),
      }),
    );
  });

  it('requires an open shift before processing a payment', async () => {
    const prisma = createPrismaMock();
    prisma.cashShift.findFirst.mockResolvedValue(null);

    const service = new PaymentsService(
      prisma as any,
      createRealtimeGatewayMock() as any,
      createLoyaltyServiceMock() as any,
    );

    await expect(
      service.create(
        {
          orderId: 1,
          paymentMethod: PaymentMethod.CASH,
          amount: 100,
          receivedAmount: 100,
        },
        10,
      ),
    ).rejects.toThrow('No hay turno activo. Debe abrir un turno antes de registrar pagos.');
  });

  it('supports cash payments received in USD with change in MXN', async () => {
    const prisma = createPrismaMock();
    const realtimeGateway = createRealtimeGatewayMock();

    prisma.cashShift.findFirst.mockResolvedValue({ id: 11, userId: 3, status: 'OPEN' });
    prisma.order.findUnique.mockResolvedValue({
      id: 40,
      orderNumber: 'ORD-20260404-0040',
      orderType: OrderType.DINE_IN,
      status: OrderStatus.READY,
      paymentStatus: 'PENDING',
      shiftId: null,
      tableId: 4,
      kitchenOrder: { id: 99, status: 'READY' },
      items: [{ quantity: 1, price: 100, modifiers: [] }],
      discounts: [],
      payments: [],
    });

    const txPaymentCreate = jest.fn().mockResolvedValue({
      id: 41,
      orderId: 40,
      amount: 116,
      paymentMethod: 'CASH',
      paymentCurrency: 'USD',
    });

    prisma.$transaction.mockImplementation(async (callback: any) =>
      callback({
        payment: { create: txPaymentCreate },
        cashMovement: { create: jest.fn() },
        order: { update: jest.fn().mockResolvedValue({
          id: 40,
          orderNumber: 'ORD-20260404-0040',
          orderType: OrderType.DINE_IN,
          paymentStatus: 'PAID',
          status: OrderStatus.CLOSED,
          tableId: 4,
        }) },
        kitchenOrder: { create: jest.fn() },
        table: { update: jest.fn() },
      }),
    );

    const service = new PaymentsService(
      prisma as any,
      realtimeGateway as any,
      createLoyaltyServiceMock() as any,
    );

    await service.create(
      {
        orderId: 40,
        paymentMethod: PaymentMethod.CASH,
        paymentCurrency: 'USD',
        exchangeRate: 20,
        amount: 116,
        receivedAmount: 20,
      },
      3,
    );

    expect(txPaymentCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        paymentCurrency: 'USD',
        receivedAmount: 20,
        receivedAmountMxn: 400,
        cashReceivedMxn: 0,
        cashReceivedUsd: 20,
        exchangeRate: 20,
        changeAmount: 284,
      }),
    });
  });
});
