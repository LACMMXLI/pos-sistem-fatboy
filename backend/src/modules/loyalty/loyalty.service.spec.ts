import { BadRequestException, NotFoundException } from '@nestjs/common';
import { LoyaltyService } from './loyalty.service';

describe('LoyaltyService', () => {
  const createPrismaMock = () => ({
    customer: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    loyaltyAccount: {
      create: jest.fn(),
      update: jest.fn(),
    },
    loyaltyTransaction: {
      create: jest.fn(),
    },
    $transaction: jest.fn(),
  });

  it('creates a loyalty customer and account when phone does not exist', async () => {
    const prisma = createPrismaMock();
    prisma.customer.findMany.mockResolvedValue([]);
    prisma.customer.findFirst.mockResolvedValue(null);
    prisma.customer.findUnique.mockResolvedValue({
      id: 7,
      name: 'Cliente 6641234567',
      phone: '6641234567',
      loyaltyAccount: { id: 9, points: 0 },
    });
    prisma.$transaction.mockImplementation(async (callback: any) =>
      callback({
        customer: {
          create: jest.fn().mockResolvedValue({
            id: 7,
            name: 'Cliente 6641234567',
            phone: '6641234567',
          }),
        },
        loyaltyAccount: {
          create: jest.fn().mockResolvedValue({ id: 9, customerId: 7, points: 0 }),
        },
      }),
    );

    const service = new LoyaltyService(prisma as any);
    const result = await service.findOrCreateCustomer('664-123-4567');

    expect(result).toEqual({
      id: 7,
      name: 'Cliente 6641234567',
      phone: '6641234567',
      loyaltyPoints: 0,
    });
  });

  it('adds points based on the order total', async () => {
    const prisma = createPrismaMock();
    const txLoyaltyUpdate = jest.fn().mockResolvedValue({ id: 4, points: 18 });
    const txLoyaltyTransactionCreate = jest.fn();

    prisma.$transaction.mockImplementation(async (callback: any) =>
      callback({
        customer: {
          findUnique: jest.fn().mockResolvedValue({
            id: 5,
            loyaltyAccount: { id: 4, points: 10 },
          }),
        },
        loyaltyAccount: {
          create: jest.fn(),
          update: txLoyaltyUpdate,
        },
        loyaltyTransaction: {
          create: txLoyaltyTransactionCreate,
        },
      }),
    );

    const service = new LoyaltyService(prisma as any);
    const result = await service.addPoints(5, 99, 80);

    expect(result).toEqual({
      customerId: 5,
      orderId: 99,
      pointsAdded: 8,
      balance: 18,
    });
    expect(txLoyaltyUpdate).toHaveBeenCalledWith({
      where: { id: 4 },
      data: {
        points: {
          increment: 8,
        },
      },
    });
    expect(txLoyaltyTransactionCreate).toHaveBeenCalledWith({
      data: {
        customerId: 5,
        orderId: 99,
        type: 'EARN',
        points: 8,
        description: 'Puntos generados por orden #99',
      },
    });
  });

  it('blocks redeeming more points than available', async () => {
    const prisma = createPrismaMock();
    prisma.$transaction.mockImplementation(async (callback: any) =>
      callback({
        customer: {
          findUnique: jest.fn().mockResolvedValue({
            id: 6,
            loyaltyAccount: { id: 3, points: 5 },
          }),
        },
        loyaltyAccount: {
          create: jest.fn(),
          update: jest.fn(),
        },
        loyaltyTransaction: {
          create: jest.fn(),
        },
      }),
    );

    const service = new LoyaltyService(prisma as any);

    await expect(service.redeemPoints(6, 10)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('throws when requesting points for an unknown customer', async () => {
    const prisma = createPrismaMock();
    prisma.customer.findUnique.mockResolvedValue(null);

    const service = new LoyaltyService(prisma as any);

    await expect(service.getCustomerPoints(404)).rejects.toBeInstanceOf(NotFoundException);
  });
});
