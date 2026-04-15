import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { CashShiftsService } from './cash-shifts.service';

describe('CashShiftsService', () => {
  const createPrismaMock = () => ({
    systemConfig: {
      findUnique: jest.fn().mockResolvedValue({ id: 1, taxEnabled: true, taxRate: 16 }),
    },
    cashShift: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    cashMovement: {
      create: jest.fn(),
    },
    order: {
      findMany: jest.fn(),
    },
    table: {
      update: jest.fn(),
    },
    $transaction: jest.fn(async (callback: any) =>
      callback({
        order: { update: jest.fn() },
        table: { update: jest.fn() },
      }),
    ),
  });

  it('builds shift summary using opening fund plus sales of the shift', async () => {
    const prisma = createPrismaMock();
    prisma.cashShift.findUnique.mockResolvedValue({
      id: 7,
      status: 'OPEN',
      openedAt: new Date('2026-04-01T09:00:00.000Z'),
      closedAt: null,
      openingAmount: '100.00',
      closingAmount: null,
      closingCardAmount: null,
      payments: [
        {
          amount: '150.00',
          paymentMethod: 'CASH',
          paymentCurrency: 'MXN',
          cashReceivedMxn: '150.00',
          cashReceivedUsd: '0.00',
          receivedAmountMxn: '150.00',
          changeAmount: '0.00',
          order: { id: 1, orderNumber: 'ORD-1', status: 'CLOSED', user: { id: 1, name: 'Caja 1' } },
        },
        {
          amount: '50.00',
          paymentMethod: 'CARD',
          order: { id: 1, orderNumber: 'ORD-1', status: 'CLOSED', user: { id: 1, name: 'Caja 1' } },
        },
        {
          amount: '25.00',
          paymentMethod: 'CASH',
          paymentCurrency: 'MXN',
          cashReceivedMxn: '25.00',
          cashReceivedUsd: '0.00',
          receivedAmountMxn: '25.00',
          changeAmount: '0.00',
          order: { id: 2, orderNumber: 'ORD-2', status: 'CLOSED', user: { id: 1, name: 'Caja 1' } },
        },
      ],
      movements: [],
    });

    const service = new CashShiftsService(prisma as any);
    const summary = await service.getShiftSummary(7);

    expect(summary.totalSalesCash).toBe(175);
    expect(summary.totalSalesCard).toBe(50);
    expect(summary.totalSalesRegistered).toBe(225);
    expect(summary.expectedBalance).toBe(275);
    expect(summary.expectedCardBalance).toBe(50);
    expect(summary.totalExpectedSystem).toBe(325);
  });

  it('excludes cancelled paid orders from shift totals', async () => {
    const prisma = createPrismaMock();
    prisma.cashShift.findUnique.mockResolvedValue({
      id: 8,
      status: 'OPEN',
      openedAt: new Date('2026-04-01T09:00:00.000Z'),
      closedAt: null,
      openingAmount: '100.00',
      closingAmount: null,
      closingCardAmount: null,
      payments: [
        {
          amount: '150.00',
          paymentMethod: 'CASH',
          paymentCurrency: 'MXN',
          cashReceivedMxn: '150.00',
          cashReceivedUsd: '0.00',
          receivedAmountMxn: '150.00',
          changeAmount: '0.00',
          order: { id: 10, orderNumber: 'ORD-10', status: 'CLOSED', user: { id: 1, name: 'Caja 1' } },
        },
        {
          amount: '80.00',
          paymentMethod: 'CARD',
          order: { id: 11, orderNumber: 'ORD-11', status: 'CANCELLED', user: { id: 1, name: 'Caja 1' } },
        },
      ],
      movements: [],
    });

    const service = new CashShiftsService(prisma as any);
    const summary = await service.getShiftSummary(8);

    expect(summary.totalSalesCash).toBe(150);
    expect(summary.totalSalesCard).toBe(0);
    expect(summary.totalSalesRegistered).toBe(150);
    expect(summary.expectedBalance).toBe(250);
    expect(summary.expectedCardBalance).toBe(0);
    expect(summary.cancelledOrdersCount).toBe(1);
    expect(summary.cancelledSalesExcluded).toBe(80);
  });

  it('normalizes fully paid stale orders before closing the shift', async () => {
    const prisma = createPrismaMock();
    prisma.cashShift.findUnique.mockResolvedValue({ id: 1, status: 'OPEN', userId: 1 });
    prisma.cashShift.update.mockResolvedValue({ id: 1, status: 'CLOSED' });
    prisma.order.findMany
      .mockResolvedValueOnce([
        {
          id: 2,
          orderNumber: 'ORD-20260325-0002',
          status: 'IN_PROGRESS',
          paymentStatus: 'PARTIAL',
          tableId: null,
          items: [{ quantity: 1, price: 100, modifiers: [] }],
          discounts: [],
          payments: [{ amount: 116 }],
        },
      ])
      .mockResolvedValueOnce([]);

    const service = new CashShiftsService(prisma as any);
    jest.spyOn(service, 'getShiftSummary').mockResolvedValue({ shiftId: 1 } as any);

    const result = await service.close(1, {
      closingAmount: 100,
      closingCardAmount: 16,
    }, { id: 1, role: 'CAJERO' });

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.cashShift.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: {
        closingAmount: 100,
        closingUsdAmount: 0,
        closingCardAmount: 16,
        status: 'CLOSED',
        closedAt: expect.any(Date),
      },
    });
    expect(result.shift.status).toBe('CLOSED');
  });

  it('blocks shift closing when there are operational orders even if they are fully paid', async () => {
    const prisma = createPrismaMock();
    prisma.cashShift.findUnique.mockResolvedValue({ id: 1, status: 'OPEN', userId: 1 });
    prisma.order.findMany
      .mockResolvedValueOnce([
        {
          id: 4,
          orderNumber: 'ORD-20260401-0004',
          status: 'IN_PROGRESS',
          paymentStatus: 'PAID',
          tableId: null,
          items: [{ quantity: 1, price: 100, modifiers: [] }],
          discounts: [],
          payments: [{ amount: 116 }],
        },
      ])
      .mockResolvedValueOnce([
        {
          id: 4,
          orderNumber: 'ORD-20260401-0004',
          status: 'IN_PROGRESS',
          paymentStatus: 'PAID',
          tableId: 7,
        },
      ]);

    const service = new CashShiftsService(prisma as any);

    await expect(
      service.close(
        1,
        {
          closingAmount: 100,
          closingCardAmount: 16,
        },
        { id: 1, role: 'CAJERO' },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(prisma.cashShift.update).not.toHaveBeenCalled();
  });

  it('keeps blocking the shift when an order still has outstanding balance', async () => {
    const prisma = createPrismaMock();
    prisma.cashShift.findUnique.mockResolvedValue({ id: 1, status: 'OPEN', userId: 1 });
    prisma.order.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          id: 2,
          orderNumber: 'ORD-20260325-0003',
          status: 'IN_PROGRESS',
          paymentStatus: 'PARTIAL',
          tableId: 5,
        },
      ]);

    const service = new CashShiftsService(prisma as any);

    await expect(
      service.close(1, {
        closingAmount: 100,
        closingCardAmount: 0,
      }, { id: 1, role: 'CAJERO' }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(prisma.cashShift.update).not.toHaveBeenCalled();
  });

  it('does not block closing because of cancelled orders with pending payment status', async () => {
    const prisma = createPrismaMock();
    prisma.cashShift.findUnique.mockResolvedValue({ id: 1, status: 'OPEN', userId: 1 });
    prisma.cashShift.update.mockResolvedValue({ id: 1, status: 'CLOSED' });
    prisma.order.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    const service = new CashShiftsService(prisma as any);
    jest.spyOn(service, 'getShiftSummary').mockResolvedValue({ shiftId: 1 } as any);

    const result = await service.close(
      1,
      {
        closingAmount: 100,
        closingCardAmount: 0,
      },
      { id: 1, role: 'CAJERO' },
    );

    expect(result.shift.status).toBe('CLOSED');
    expect(prisma.cashShift.update).toHaveBeenCalled();
  });

  it('blocks a cashier from closing a shift that belongs to another user', async () => {
    const prisma = createPrismaMock();
    prisma.cashShift.findUnique.mockResolvedValue({ id: 1, status: 'OPEN', userId: 999 });

    const service = new CashShiftsService(prisma as any);

    await expect(
      service.close(
        1,
        {
          closingAmount: 100,
          closingCardAmount: 0,
        },
        { id: 10, role: 'CAJERO' },
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('allows an admin to close another user shift', async () => {
    const prisma = createPrismaMock();
    prisma.cashShift.findUnique.mockResolvedValue({ id: 1, status: 'OPEN', userId: 999 });
    prisma.cashShift.update.mockResolvedValue({ id: 1, status: 'CLOSED' });
    prisma.order.findMany.mockResolvedValue([]);

    const service = new CashShiftsService(prisma as any);
    jest.spyOn(service, 'getShiftSummary').mockResolvedValue({ shiftId: 1 } as any);

    const result = await service.close(
      1,
      {
        closingAmount: 100,
        closingCardAmount: 0,
      },
      { id: 1, role: 'ADMIN' },
    );

    expect(result.shift.status).toBe('CLOSED');
  });

  it('blocks a cashier from registering movements on another user shift', async () => {
    const prisma = createPrismaMock();
    prisma.cashShift.findUnique.mockResolvedValue({ id: 1, status: 'OPEN', userId: 999 });

    const service = new CashShiftsService(prisma as any);

    await expect(
      service.addMovement(
        1,
        { id: 10, role: 'CAJERO' },
        { movementType: 'IN', amount: 25, reason: 'Prueba' } as any,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('returns a graceful failure when resending the shift email throws', async () => {
    const prisma = createPrismaMock();
    prisma.cashShift.findUnique.mockResolvedValue({
      id: 112,
      userId: 1,
      status: 'CLOSED',
    });

    const cashShiftEmailService = {
      sendShiftReportEmail: jest.fn().mockRejectedValue(new Error('SMTP connection failed')),
    };
    const notificationDispatchService = {
      createManualDispatch: jest.fn(),
    };

    const service = new CashShiftsService(
      prisma as any,
      cashShiftEmailService as any,
      notificationDispatchService as any,
    );
    jest.spyOn(service, 'getShiftSummary').mockResolvedValue({ shiftId: 112 } as any);

    const result = await service.resendShiftEmail(112, { id: 1, role: 'CAJERO' });

    expect(cashShiftEmailService.sendShiftReportEmail).toHaveBeenCalledWith(
      112,
      { shiftId: 112 },
      undefined,
    );
    expect(result).toEqual({
      attempted: true,
      sent: false,
      message: 'SMTP connection failed',
    });
  });
});
