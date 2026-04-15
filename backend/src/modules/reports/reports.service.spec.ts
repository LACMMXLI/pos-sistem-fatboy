import { ReportsService } from './reports.service';

describe('ReportsService', () => {
  const createPrismaMock = () => ({
    systemConfig: {
      findUnique: jest.fn().mockResolvedValue({ id: 1, taxEnabled: true, taxRate: 16 }),
    },
    cashShift: {
      findFirst: jest.fn(),
    },
    order: {
      findMany: jest.fn(),
    },
  });

  it('excludes cancelled orders from the daily summary totals', async () => {
    const prisma = createPrismaMock();
    prisma.order.findMany.mockResolvedValue([
      {
        id: 1,
        status: 'CLOSED',
        userId: 10,
        payments: [{ amount: 116, paymentMethod: 'CASH' }],
        discounts: [],
        items: [
          {
            quantity: 1,
            price: 100,
            modifiers: [],
            product: { id: 1, name: 'Pizza', category: { id: 1, name: 'Comida' } },
          },
        ],
      },
    ]);

    const service = new ReportsService(prisma as any);
    const summary = await service.getDailySummary({ shiftId: 7 });

    expect(prisma.order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: { not: 'CANCELLED' },
          payments: {
            some: {
              shiftId: 7,
            },
          },
        }),
      }),
    );
    expect(summary.totalRevenue).toBe(116);
    expect(summary.totalOrders).toBe(1);
  });
});
