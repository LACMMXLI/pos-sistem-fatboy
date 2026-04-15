import { BadRequestException } from '@nestjs/common';
import { PayrollStatus } from '../../prisma/client';
import { PayrollsService } from './payrolls.service';

describe('PayrollsService', () => {
  const createPrismaMock = () => ({
    payroll: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    cashShift: {
      findFirst: jest.fn(),
    },
    cashMovement: {
      create: jest.fn(),
    },
    $transaction: jest.fn(async (callback: any) =>
      callback({
        payroll: {
          update: jest.fn().mockResolvedValue({
            id: 12,
            status: PayrollStatus.PAID,
            netPay: 800,
            employee: { fullName: 'Juan Perez' },
          }),
        },
        cashMovement: {
          create: jest.fn(),
        },
      }),
    ),
  });

  it('requires an open shift to mark payroll as paid because cash must leave the current register', async () => {
    const prisma = createPrismaMock();
    prisma.payroll.findUnique.mockResolvedValue({
      id: 12,
      status: PayrollStatus.GENERATED,
      netPay: 800,
      employee: { fullName: 'Juan Perez' },
      closedBy: { id: 1, name: 'Admin', email: 'admin@test.com' },
      attendanceRecords: [],
      ledgerEntries: [],
    });
    prisma.cashShift.findFirst.mockResolvedValue(null);

    const service = new PayrollsService(prisma as any);

    await expect(service.markPaid(12, 5)).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('registers the payroll payment as a cash OUT movement before marking it paid', async () => {
    const prisma = createPrismaMock();
    const txCashMovementCreate = jest.fn();
    const txPayrollUpdate = jest.fn().mockResolvedValue({
      id: 12,
      status: PayrollStatus.PAID,
      netPay: 800,
      employee: { fullName: 'Juan Perez' },
    });

    prisma.payroll.findUnique.mockResolvedValue({
      id: 12,
      status: PayrollStatus.GENERATED,
      netPay: 800,
      employee: { fullName: 'Juan Perez' },
      closedBy: { id: 1, name: 'Admin', email: 'admin@test.com' },
      attendanceRecords: [],
      ledgerEntries: [],
    });
    prisma.cashShift.findFirst.mockResolvedValue({
      id: 7,
      openingAmount: 1000,
      movements: [],
      orders: [],
    });
    prisma.$transaction.mockImplementation(async (callback: any) =>
      callback({
        payroll: {
          update: txPayrollUpdate,
        },
        cashMovement: {
          create: txCashMovementCreate,
        },
      }),
    );

    const service = new PayrollsService(prisma as any);
    const result = await service.markPaid(12, 5);

    expect(txCashMovementCreate).toHaveBeenCalledWith({
      data: {
        shiftId: 7,
        movementType: 'OUT',
        amount: 800,
        reason: 'Pago de nómina: Juan Perez (Nómina #12)',
        createdBy: 5,
      },
    });
    expect(txPayrollUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 12 },
        data: { status: PayrollStatus.PAID },
      }),
    );
    expect(result.status).toBe(PayrollStatus.PAID);
  });
});
