import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  EmployeeLedgerEntryStatus,
  EmployeeLedgerEntryType,
  PayrollStatus,
  Prisma,
} from '../../prisma/client';
import { ClosePayrollDto } from '../employees/dto/employee.dto';
import { PayrollListQueryDto } from './dto/payroll.dto';

@Injectable()
export class PayrollsService {
  private readonly logger = new Logger(PayrollsService.name);

  constructor(private readonly prisma: PrismaService) {}

  private toNumber(value: Prisma.Decimal | number | null | undefined) {
    return Number(value ?? 0);
  }

  private calculateShiftBalance(shift: any) {
    let totalCashMxnIn = 0;
    let totalChangeGivenMxn = 0;
    let totalManualIn = 0;
    let totalManualOut = 0;

    shift.orders.forEach((order: any) => {
      order.payments.forEach((payment: any) => {
        const method = payment.paymentMethod.toUpperCase();
        if (['CASH', 'EFECTIVO'].includes(method)) {
          totalCashMxnIn += this.toNumber(payment.cashReceivedMxn);
          totalChangeGivenMxn += this.toNumber(payment.changeAmount);
        }
      });
    });

    shift.movements.forEach((move: any) => {
      const isAuto = move.reason?.includes('Pago de orden');
      if (!isAuto) {
        if (move.movementType === 'IN') totalManualIn += Number(move.amount);
        else if (move.movementType === 'OUT') totalManualOut += Number(move.amount);
      }
    });

    return {
      expectedBalance:
        this.toNumber(shift.openingAmount) + totalCashMxnIn - totalChangeGivenMxn + totalManualIn - totalManualOut,
    };
  }

  private parsePeriod(periodStart: string, periodEnd: string) {
    const start = new Date(`${periodStart}T00:00:00.000Z`);
    const end = new Date(`${periodEnd}T23:59:59.999Z`);

    if (start > end) {
      throw new BadRequestException('La fecha inicial no puede ser mayor a la fecha final');
    }

    return { start, end };
  }

  private async getEmployeeOrThrow(employeeId: number, tx: PrismaService | Prisma.TransactionClient = this.prisma) {
    const employee = await tx.employee.findUnique({ where: { id: employeeId } });

    if (!employee) {
      throw new NotFoundException(`Empleado con ID ${employeeId} no encontrado`);
    }

    return employee;
  }

  private async ensureNoOverlap(
    employeeId: number,
    periodStart: Date,
    periodEnd: Date,
    tx: PrismaService | Prisma.TransactionClient = this.prisma,
  ) {
    const overlap = await tx.payroll.findFirst({
      where: {
        employeeId,
        periodStart: { lte: periodEnd },
        periodEnd: { gte: periodStart },
      },
      select: { id: true },
    });

    if (overlap) {
      throw new BadRequestException(
        `Ya existe una nómina cerrada que traslapa este periodo. ID de nómina: ${overlap.id}`,
      );
    }
  }

  private buildPreview(employee: { weeklySalary: Prisma.Decimal | number }, entries: Array<any>, range: { start: Date; end: Date }) {
    return this.buildPreviewWithAttendance(employee, entries, [], range);
  }

  private buildPreviewWithAttendance(
    employee: { weeklySalary: Prisma.Decimal | number },
    entries: Array<any>,
    attendanceRecords: Array<any>,
    range: { start: Date; end: Date },
  ) {
    const totals = entries.reduce(
      (acc, entry) => {
        const amount = this.toNumber(entry.amount);
        if (entry.type === EmployeeLedgerEntryType.SALARY_ADVANCE) acc.totalAdvances += amount;
        if (entry.type === EmployeeLedgerEntryType.MANUAL_DEBT) acc.totalManualDebts += amount;
        if (entry.type === EmployeeLedgerEntryType.PRODUCT_CONSUMPTION) acc.totalProductConsumption += amount;
        acc.totalDeductions += amount;
        return acc;
      },
      {
        totalAdvances: 0,
        totalManualDebts: 0,
        totalProductConsumption: 0,
        totalDeductions: 0,
      },
    );

    const attendanceTotals = attendanceRecords.reduce(
      (acc, record) => {
        acc.totalHoursWorked += this.toNumber(record.hoursWorked);
        acc.totalRegularHours += this.toNumber(record.regularHours);
        acc.totalOvertimeHours += this.toNumber(record.overtimeHours);
        acc.totalOvertimePay += this.toNumber(record.overtimePay);
        return acc;
      },
      {
        totalHoursWorked: 0,
        totalRegularHours: 0,
        totalOvertimeHours: 0,
        totalOvertimePay: 0,
      },
    );

    const weeklySalary = this.toNumber(employee.weeklySalary);
    if (totals.totalDeductions > weeklySalary) {
      throw new BadRequestException(
        'Los descuentos acumulados exceden el sueldo semanal configurado para el empleado',
      );
    }

    return {
      periodStart: range.start,
      periodEnd: range.end,
      weeklySalary,
      ...attendanceTotals,
      ...totals,
      netPay: weeklySalary + attendanceTotals.totalOvertimePay - totals.totalDeductions,
      includedAttendance: attendanceRecords.map((record) => ({
        id: record.id,
        workDate: record.workDate,
        hoursWorked: this.toNumber(record.hoursWorked),
        regularHours: this.toNumber(record.regularHours),
        overtimeHours: this.toNumber(record.overtimeHours),
        overtimeRate: this.toNumber(record.overtimeRate),
        overtimePay: this.toNumber(record.overtimePay),
        notes: record.notes,
        createdBy: record.createdBy,
      })),
      includedEntries: entries.map((entry) => ({
        id: entry.id,
        type: entry.type,
        amount: this.toNumber(entry.amount),
        description: entry.description,
        entryDate: entry.entryDate,
        createdBy: entry.createdBy,
        productSnapshot: entry.productSnapshot,
      })),
    };
  }

  async preview(employeeId: number, query: ClosePayrollDto) {
    const range = this.parsePeriod(query.periodStart, query.periodEnd);
    const employee = await this.getEmployeeOrThrow(employeeId);
    await this.ensureNoOverlap(employeeId, range.start, range.end);

    const entries = await this.prisma.employeeLedgerEntry.findMany({
      where: {
        employeeId,
        status: EmployeeLedgerEntryStatus.PENDING,
        entryDate: {
          gte: range.start,
          lte: range.end,
        },
      },
      include: {
        createdBy: { select: { id: true, name: true } },
      },
      orderBy: [{ entryDate: 'asc' }, { id: 'asc' }],
    });

    const attendanceRecords = await this.prisma.employeeAttendance.findMany({
      where: {
        employeeId,
        workDate: {
          gte: range.start,
          lte: range.end,
        },
      },
      include: {
        createdBy: { select: { id: true, name: true } },
      },
      orderBy: [{ workDate: 'asc' }, { id: 'asc' }],
    });

    return {
      employee: {
        id: employee.id,
        fullName: employee.fullName,
        weeklySalary: this.toNumber(employee.weeklySalary),
      },
      ...this.buildPreviewWithAttendance(employee, entries, attendanceRecords, range),
    };
  }

  async closePayroll(employeeId: number, dto: ClosePayrollDto, closedByUserId: number) {
    const range = this.parsePeriod(dto.periodStart, dto.periodEnd);

    try {
      const payrollId = await this.prisma.$transaction(async (tx) => {
        const employee = await this.getEmployeeOrThrow(employeeId, tx);
        await this.ensureNoOverlap(employeeId, range.start, range.end, tx);

        const entries = await tx.employeeLedgerEntry.findMany({
          where: {
            employeeId,
            status: EmployeeLedgerEntryStatus.PENDING,
            entryDate: {
              gte: range.start,
              lte: range.end,
            },
          },
          include: {
            createdBy: { select: { id: true, name: true } },
          },
          orderBy: [{ entryDate: 'asc' }, { id: 'asc' }],
        });

        const attendanceRecords = await tx.employeeAttendance.findMany({
          where: {
            employeeId,
            workDate: {
              gte: range.start,
              lte: range.end,
            },
          },
          include: {
            createdBy: { select: { id: true, name: true } },
          },
          orderBy: [{ workDate: 'asc' }, { id: 'asc' }],
        });

        const preview = this.buildPreviewWithAttendance(
          employee,
          entries,
          attendanceRecords,
          range,
        );

        const payroll = await tx.payroll.create({
          data: {
            employeeId,
            periodStart: range.start,
            periodEnd: range.end,
            weeklySalarySnapshot: preview.weeklySalary,
            totalHoursWorked: preview.totalHoursWorked,
            totalRegularHours: preview.totalRegularHours,
            totalOvertimeHours: preview.totalOvertimeHours,
            totalOvertimePay: preview.totalOvertimePay,
            totalAdvances: preview.totalAdvances,
            totalManualDebts: preview.totalManualDebts,
            totalProductConsumption: preview.totalProductConsumption,
            totalDeductions: preview.totalDeductions,
            netPay: preview.netPay,
            closedByUserId,
            status: PayrollStatus.GENERATED,
          },
        });

        if (entries.length > 0) {
          await tx.employeeLedgerEntry.updateMany({
            where: { id: { in: entries.map((entry) => entry.id) } },
            data: {
              status: EmployeeLedgerEntryStatus.SETTLED,
              payrollId: payroll.id,
            },
          });
        }

        if (attendanceRecords.length > 0) {
          await tx.employeeAttendance.updateMany({
            where: { id: { in: attendanceRecords.map((record) => record.id) } },
            data: {
              payrollId: payroll.id,
            },
          });
        }

        return payroll.id;
      });

      return this.findOne(payrollId);
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }

      this.logger.error(`Error closing payroll: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Error interno al cerrar la nómina');
    }
  }

  async findAll(query: PayrollListQueryDto) {
    return this.prisma.payroll.findMany({
      where: {
        employeeId: query.employeeId ? Number(query.employeeId) : undefined,
        status: query.status,
        closedAt:
          query.startDate || query.endDate
            ? {
                gte: query.startDate
                  ? new Date(`${query.startDate}T00:00:00.000Z`)
                  : undefined,
                lte: query.endDate
                  ? new Date(`${query.endDate}T23:59:59.999Z`)
                  : undefined,
              }
            : undefined,
      },
      include: {
        employee: true,
        closedBy: {
          select: { id: true, name: true, email: true },
        },
      },
      orderBy: [{ closedAt: 'desc' }, { id: 'desc' }],
    });
  }

  async findOne(id: number) {
    const payroll = await this.prisma.payroll.findUnique({
      where: { id },
      include: {
        employee: true,
        closedBy: {
          select: { id: true, name: true, email: true },
        },
        attendanceRecords: {
          include: {
            createdBy: {
              select: { id: true, name: true, email: true },
            },
          },
          orderBy: [{ workDate: 'asc' }, { id: 'asc' }],
        },
        ledgerEntries: {
          include: {
            createdBy: {
              select: { id: true, name: true, email: true },
            },
          },
          orderBy: [{ entryDate: 'asc' }, { id: 'asc' }],
        },
      },
    });

    if (!payroll) {
      throw new NotFoundException(`Nómina con ID ${id} no encontrada`);
    }

    return payroll;
  }

  async markPaid(id: number, paidByUserId: number) {
    try {
      const payroll = await this.findOne(id);
      if (payroll.status === PayrollStatus.PAID) {
        return payroll;
      }

      const openShift = await this.prisma.cashShift.findFirst({
        where: { userId: paidByUserId, status: 'OPEN' },
        include: {
          movements: true,
          orders: {
            include: {
              payments: true,
            },
          },
        },
      });

      if (!openShift) {
        throw new BadRequestException(
          'No se puede pagar la nómina sin un turno de caja abierto. El efectivo debe salir de la caja del día.',
        );
      }

      const amountToPay = this.toNumber(payroll.netPay);
      const shiftBalance = this.calculateShiftBalance(openShift);

      if (amountToPay > shiftBalance.expectedBalance) {
        throw new BadRequestException(
          `Saldo insuficiente en caja para pagar la nómina. Saldo disponible: $${shiftBalance.expectedBalance.toFixed(2)}`,
        );
      }

      return await this.prisma.$transaction(async (tx) => {
        await tx.cashMovement.create({
          data: {
            shiftId: openShift.id,
            movementType: 'OUT',
            amount: amountToPay,
            reason: `Pago de nómina: ${payroll.employee.fullName} (Nómina #${payroll.id})`,
            createdBy: paidByUserId,
          },
        });

        return tx.payroll.update({
          where: { id },
          data: { status: PayrollStatus.PAID },
          include: {
            employee: true,
            closedBy: {
              select: { id: true, name: true, email: true },
            },
            attendanceRecords: {
              include: {
                createdBy: {
                  select: { id: true, name: true, email: true },
                },
              },
              orderBy: [{ workDate: 'asc' }, { id: 'asc' }],
            },
            ledgerEntries: true,
          },
        });
      });
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }

      this.logger.error(`Error marking payroll as paid: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Error interno al marcar la nómina como pagada');
    }
  }
}
