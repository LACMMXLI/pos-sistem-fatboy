import { BadRequestException } from '@nestjs/common';
import { TablesService } from './tables.service';

describe('TablesService', () => {
  const createPrismaMock = () => ({
    order: {
      findFirst: jest.fn(),
    },
    table: {
      update: jest.fn(),
    },
  });

  const createRealtimeGatewayMock = () => ({
    emitTableUpdated: jest.fn(),
  });

  it('blocks marking a table as occupied without an active order', async () => {
    const prisma = createPrismaMock();
    prisma.order.findFirst.mockResolvedValue(null);

    const service = new TablesService(
      prisma as any,
      createRealtimeGatewayMock() as any,
    );

    await expect(
      service.updateStatus(3, { status: 'OCCUPIED' } as any),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('allows freeing a table only when there is no active order', async () => {
    const prisma = createPrismaMock();
    prisma.order.findFirst.mockResolvedValue({ id: 55, orderNumber: 'ORD-20260331-0055' });

    const service = new TablesService(
      prisma as any,
      createRealtimeGatewayMock() as any,
    );

    await expect(
      service.updateStatus(3, { status: 'AVAILABLE' } as any),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(prisma.table.update).not.toHaveBeenCalled();
  });

  it('applies the same status validation when updating a table from the general endpoint', async () => {
    const prisma = createPrismaMock();
    prisma.order.findFirst.mockResolvedValue(null);

    const service = new TablesService(
      prisma as any,
      createRealtimeGatewayMock() as any,
    );

    await expect(
      service.update(9, { status: 'ACCOUNT_PRINTED' } as any),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
