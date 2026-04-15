import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../prisma/prisma.service';
import {
  EmployeeLedgerEntryStatus,
  EmployeeLedgerEntryType,
  Prisma,
} from '../../prisma/client';
import { UsersService } from '../users/users.service';
import {
  AttendanceQueryDto,
  CreateAttendanceDto,
  CreateAdvanceDto,
  CreateConsumptionDto,
  CreateDebtDto,
  CreateEmployeeDto,
  LedgerQueryDto,
  UpdateEmployeeDto,
} from './dto/employee.dto';

type PrismaTx = PrismaService | Prisma.TransactionClient;

@Injectable()
export class EmployeesService {
  private readonly logger = new Logger(EmployeesService.name);
  private readonly regularHoursPerDay = 10;
  private readonly defaultOvertimeRate = 100;
  private readonly employeeCodeLength = 4;

  constructor(
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
  ) {}

  private toNumber(value: Prisma.Decimal | number | null | undefined) {
    return Number(value ?? 0);
  }

  private parseEntryDate(entryDate?: string) {
    return entryDate ? new Date(entryDate) : new Date();
  }

  private parseWorkDate(workDate: string) {
    return new Date(`${workDate}T00:00:00.000Z`);
  }

  private normalizeEmployeeCode(employeeCode?: string | null) {
    return employeeCode?.trim();
  }

  private buildRangeFilter(startDate?: string, endDate?: string) {
    if (!startDate && !endDate) return undefined;

    return {
      gte: startDate ? new Date(`${startDate}T00:00:00.000Z`) : undefined,
      lte: endDate ? new Date(`${endDate}T23:59:59.999Z`) : undefined,
    };
  }

  private async getEmployeeOrThrow(employeeId: number, tx: PrismaTx = this.prisma) {
    const employee = await tx.employee.findUnique({
      where: { id: employeeId },
    });

    if (!employee) {
      throw new NotFoundException(`Empleado con ID ${employeeId} no encontrado`);
    }

    return employee;
  }

  private async getPendingAmount(employeeId: number, tx: PrismaTx = this.prisma) {
    const aggregate = await tx.employeeLedgerEntry.aggregate({
      where: {
        employeeId,
        status: EmployeeLedgerEntryStatus.PENDING,
      },
      _sum: { amount: true },
    });

    return this.toNumber(aggregate._sum.amount);
  }

  private async validatePendingCapacity(
    employeeId: number,
    newAmount: number,
    tx: PrismaTx = this.prisma,
  ) {
    const employee = await this.getEmployeeOrThrow(employeeId, tx);
    const pendingAmount = await this.getPendingAmount(employeeId, tx);
    const nextPendingAmount = pendingAmount + newAmount;
    const weeklySalary = this.toNumber(employee.weeklySalary);

    if (nextPendingAmount > weeklySalary) {
      throw new BadRequestException(
        `El saldo pendiente no puede exceder el sueldo semanal del empleado. Pendiente actual: $${pendingAmount.toFixed(2)}, nuevo total: $${nextPendingAmount.toFixed(2)}, sueldo semanal: $${weeklySalary.toFixed(2)}`,
      );
    }

    return employee;
  }

  private buildLedgerDescription(
    defaultDescription: string,
    customDescription?: string,
  ) {
    if (customDescription?.trim()) {
      return customDescription.trim();
    }

    return defaultDescription;
  }

  private async ensureEmployeeCodeAvailable(
    employeeCode: string,
    employeeId?: number,
    tx: PrismaTx = this.prisma,
  ) {
    const existingEmployee = await tx.employee.findUnique({
      where: { employeeCode },
      select: { id: true },
    });

    if (existingEmployee && existingEmployee.id !== employeeId) {
      throw new BadRequestException('La clave de checador ya está asignada a otro empleado');
    }
  }

  private async generateUniqueEmployeeCode(tx: PrismaTx = this.prisma) {
    const maxAttempts = 200;

    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      const generatedCode = Math.floor(Math.random() * 10000)
        .toString()
        .padStart(this.employeeCodeLength, '0');

      const existingEmployee = await tx.employee.findUnique({
        where: { employeeCode: generatedCode },
        select: { id: true },
      });

      if (!existingEmployee) {
        return generatedCode;
      }
    }

    throw new InternalServerErrorException(
      'No fue posible generar una clave única para el empleado',
    );
  }

  async create(createEmployeeDto: CreateEmployeeDto) {
    try {
      const normalizedEmployeeCode = this.normalizeEmployeeCode(
        createEmployeeDto.employeeCode,
      );

      if (normalizedEmployeeCode) {
        await this.ensureEmployeeCodeAvailable(normalizedEmployeeCode);
      }

      return await this.prisma.employee.create({
        data: {
          fullName: createEmployeeDto.fullName,
          employeeCode:
            normalizedEmployeeCode ?? (await this.generateUniqueEmployeeCode()),
          weeklySalary: createEmployeeDto.weeklySalary,
          isActive: createEmployeeDto.isActive ?? true,
          notes: createEmployeeDto.notes,
        },
      });
    } catch (error) {
      this.logger.error(`Error creating employee: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Error interno al crear el empleado');
    }
  }

  async findAll() {
    const employees = await this.prisma.employee.findMany({
      orderBy: [{ isActive: 'desc' }, { fullName: 'asc' }],
      include: {
        _count: {
          select: {
            ledgerEntries: true,
            payrolls: true,
          },
        },
      },
    });

    const pendingEntries = await this.prisma.employeeLedgerEntry.groupBy({
      by: ['employeeId'],
      where: { status: EmployeeLedgerEntryStatus.PENDING },
      _sum: { amount: true },
    });

    const pendingMap = new Map(
      pendingEntries.map((entry) => [entry.employeeId, this.toNumber(entry._sum.amount)]),
    );

    return employees.map((employee) => ({
      ...employee,
      pendingBalance: pendingMap.get(employee.id) ?? 0,
    }));
  }

  async findBasicList() {
    return this.prisma.employee.findMany({
      orderBy: [{ isActive: 'desc' }, { fullName: 'asc' }],
      select: {
        id: true,
        fullName: true,
        employeeCode: true,
        isActive: true,
      },
    });
  }

  async findOne(employeeId: number) {
    const employee = await this.prisma.employee.findUnique({
      where: { id: employeeId },
      include: {
        payrolls: {
          take: 5,
          orderBy: { closedAt: 'desc' },
          include: {
            closedBy: { select: { id: true, name: true } },
          },
        },
      },
    });

    if (!employee) {
      throw new NotFoundException(`Empleado con ID ${employeeId} no encontrado`);
    }

    const pendingBalance = await this.getPendingAmount(employeeId);

    return {
      ...employee,
      pendingBalance,
    };
  }

  async update(employeeId: number, updateEmployeeDto: UpdateEmployeeDto) {
    try {
      const existingEmployee = await this.getEmployeeOrThrow(employeeId);
      const normalizedEmployeeCode = this.normalizeEmployeeCode(
        updateEmployeeDto.employeeCode,
      );

      if (
        typeof updateEmployeeDto.weeklySalary === 'number' &&
        updateEmployeeDto.weeklySalary < (await this.getPendingAmount(employeeId))
      ) {
        throw new BadRequestException(
          'El sueldo semanal no puede quedar por debajo del saldo pendiente actual del empleado',
        );
      }

      if (normalizedEmployeeCode) {
        await this.ensureEmployeeCodeAvailable(normalizedEmployeeCode, employeeId);
      }

      return await this.prisma.employee.update({
        where: { id: existingEmployee.id },
        data: {
          ...updateEmployeeDto,
          employeeCode: normalizedEmployeeCode,
        },
      });
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }

      this.logger.error(`Error updating employee: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Error interno al actualizar el empleado');
    }
  }

  async findLedger(employeeId: number, query: LedgerQueryDto) {
    await this.getEmployeeOrThrow(employeeId);

    return this.prisma.employeeLedgerEntry.findMany({
      where: {
        employeeId,
        type: query.type,
        entryDate: this.buildRangeFilter(query.startDate, query.endDate),
      },
      include: {
        createdBy: {
          select: { id: true, name: true, email: true },
        },
        payroll: {
          select: {
            id: true,
            periodStart: true,
            periodEnd: true,
            status: true,
          },
        },
      },
      orderBy: [{ entryDate: 'desc' }, { id: 'desc' }],
    });
  }

  async findAttendance(employeeId: number, query: AttendanceQueryDto) {
    await this.getEmployeeOrThrow(employeeId);

    return this.prisma.employeeAttendance.findMany({
      where: {
        employeeId,
        workDate: this.buildRangeFilter(query.startDate, query.endDate),
      },
      include: {
        createdBy: {
          select: { id: true, name: true, email: true },
        },
        payroll: {
          select: {
            id: true,
            periodStart: true,
            periodEnd: true,
            status: true,
          },
        },
      },
      orderBy: [{ workDate: 'desc' }, { id: 'desc' }],
    });
  }

  async createAttendance(
    employeeId: number,
    createAttendanceDto: CreateAttendanceDto,
    createdByUserId: number,
  ) {
    try {
      await this.getEmployeeOrThrow(employeeId);

      const workDate = this.parseWorkDate(createAttendanceDto.workDate);
      const hoursWorked = Number(createAttendanceDto.hoursWorked);
      const regularHours = Math.min(hoursWorked, this.regularHoursPerDay);
      const overtimeHours = Math.max(hoursWorked - this.regularHoursPerDay, 0);
      const overtimeRate = Number(
        createAttendanceDto.overtimeRate ?? this.defaultOvertimeRate,
      );
      const overtimePay = overtimeHours * overtimeRate;

      return await this.prisma.employeeAttendance.create({
        data: {
          employeeId,
          workDate,
          hoursWorked,
          regularHours,
          overtimeHours,
          overtimeRate,
          overtimePay,
          notes: createAttendanceDto.notes?.trim() || undefined,
          createdByUserId,
        },
        include: {
          createdBy: { select: { id: true, name: true, email: true } },
        },
      });
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }

      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new BadRequestException(
          `Ya existe un registro de asistencia para la fecha ${createAttendanceDto.workDate}`,
        );
      }

      this.logger.error(`Error creating attendance: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Error interno al registrar la asistencia');
    }
  }

  async createAdvance(
    employeeId: number,
    createAdvanceDto: CreateAdvanceDto,
    createdByUserId: number,
  ) {
    try {
      const employee = await this.getEmployeeOrThrow(employeeId);
      await this.validatePendingCapacity(employeeId, createAdvanceDto.amount);

      // Check for an open shift for the user
      const openShift = await this.prisma.cashShift.findFirst({
        where: { userId: createdByUserId, status: 'OPEN' },
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
          'No se puede registrar un adelanto de sueldo sin un turno de caja abierto. El efectivo debe salir de la caja.',
        );
      }

      // Calculate current expected balance to ensure there's enough cash
      const report = this.calculateShiftBalance(openShift);
      if (createAdvanceDto.amount > report.expectedBalance) {
        throw new BadRequestException(
          `Saldo insuficiente en caja para realizar el adelanto. Saldo disponible: $${report.expectedBalance.toFixed(2)}`,
        );
      }

      return await this.prisma.$transaction(async (tx) => {
        const description = this.buildLedgerDescription(
          'Adelanto de sueldo',
          createAdvanceDto.description,
        );

        // 1. Create Ledger Entry
        const ledgerEntry = await tx.employeeLedgerEntry.create({
          data: {
            employeeId,
            type: EmployeeLedgerEntryType.SALARY_ADVANCE,
            amount: createAdvanceDto.amount,
            description,
            entryDate: this.parseEntryDate(createAdvanceDto.entryDate),
            createdByUserId,
            status: EmployeeLedgerEntryStatus.PENDING,
          },
          include: {
            createdBy: { select: { id: true, name: true } },
          },
        });

        // 2. Register Cash Movement
        await tx.cashMovement.create({
          data: {
            shiftId: openShift.id,
            movementType: 'OUT',
            amount: createAdvanceDto.amount,
            reason: `Adelanto de sueldo: ${employee.fullName}. ${description}`,
            createdBy: createdByUserId,
          },
        });

        return ledgerEntry;
      });
    } catch (error) {
      if (error instanceof BadRequestException || error instanceof NotFoundException) {
        throw error;
      }

      this.logger.error(`Error creating salary advance: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Error interno al registrar el adelanto');
    }
  }

  /**
   * Helper to calculate shift balance (simplified version of buildShiftReport in CashShiftsService)
   */
  private calculateShiftBalance(shift: any) {
    let totalCashMxnIn = 0;
    let totalChangeGivenMxn = 0;
    let totalManualIn = 0;
    let totalManualOut = 0;

    shift.orders.forEach((order: any) => {
      order.payments.forEach((payment: any) => {
        const method = payment.paymentMethod.toUpperCase();
        if (['CASH', 'EFECTIVO'].includes(method)) {
          totalCashMxnIn += Number(payment.cashReceivedMxn ?? 0);
          totalChangeGivenMxn += Number(payment.changeAmount ?? 0);
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

    const expectedBalance =
      Number(shift.openingAmount) + totalCashMxnIn - totalChangeGivenMxn + totalManualIn - totalManualOut;

    return { expectedBalance };
  }

  async createDebt(
    employeeId: number,
    createDebtDto: CreateDebtDto,
    createdByUserId: number,
  ) {
    try {
      await this.validatePendingCapacity(employeeId, createDebtDto.amount);

      return await this.prisma.employeeLedgerEntry.create({
        data: {
          employeeId,
          type: EmployeeLedgerEntryType.MANUAL_DEBT,
          amount: createDebtDto.amount,
          description: createDebtDto.description.trim(),
          entryDate: this.parseEntryDate(createDebtDto.entryDate),
          createdByUserId,
          status: EmployeeLedgerEntryStatus.PENDING,
        },
        include: {
          createdBy: { select: { id: true, name: true } },
        },
      });
    } catch (error) {
      if (error instanceof BadRequestException || error instanceof NotFoundException) {
        throw error;
      }

      this.logger.error(`Error creating manual debt: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Error interno al registrar la deuda');
    }
  }

  async createConsumption(
    employeeId: number,
    createConsumptionDto: CreateConsumptionDto,
    createdByUserId: number,
  ) {
    try {
      await this.getEmployeeOrThrow(employeeId);

      const productIds = createConsumptionDto.items
        .map((item) => item.productId)
        .filter((productId): productId is number => typeof productId === 'number');

      const catalogProducts = productIds.length
        ? await this.prisma.product.findMany({
            where: { id: { in: productIds } },
            select: { id: true, name: true, price: true },
          })
        : [];

      const catalogMap = new Map(catalogProducts.map((product) => [product.id, product]));

      if (productIds.length !== catalogProducts.length) {
        throw new BadRequestException('Uno o más productos del consumo no existen');
      }

      const snapshotItems = createConsumptionDto.items.map((item) => {
        if (item.productId) {
          const product = catalogMap.get(item.productId)!;
          const unitPrice = this.toNumber(product.price);
          const lineTotal = unitPrice * item.quantity;

          return {
            productId: product.id,
            productName: product.name,
            quantity: item.quantity,
            unitPrice,
            lineTotal,
            source: 'CATALOG',
          };
        }

        const unitPrice = Number(item.unitPrice);
        const lineTotal = unitPrice * item.quantity;

        return {
          productId: null,
          productName: item.productName.trim(),
          quantity: item.quantity,
          unitPrice,
          lineTotal,
          source: 'MANUAL',
        };
      });

      const totalAmount = snapshotItems.reduce((sum, item) => sum + item.lineTotal, 0);
      await this.validatePendingCapacity(employeeId, totalAmount);

      return await this.prisma.employeeLedgerEntry.create({
        data: {
          employeeId,
          type: EmployeeLedgerEntryType.PRODUCT_CONSUMPTION,
          amount: totalAmount,
          description: this.buildLedgerDescription(
            `Consumo interno: ${snapshotItems.map((item) => item.productName).join(', ')}`,
            createConsumptionDto.description,
          ),
          entryDate: this.parseEntryDate(createConsumptionDto.entryDate),
          createdByUserId,
          status: EmployeeLedgerEntryStatus.PENDING,
          productSnapshot: {
            items: snapshotItems,
            totalAmount,
          },
        },
        include: {
          createdBy: { select: { id: true, name: true } },
        },
      });
    } catch (error) {
      if (error instanceof BadRequestException || error instanceof NotFoundException) {
        throw error;
      }

      this.logger.error(`Error creating product consumption: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Error interno al registrar el consumo');
    }
  }

  async clearEmployeesData(userId: number, password?: string) {
    const user = await this.usersService.findOneWithPassword(userId);
    if (!user || user.role.name !== 'ADMIN') {
      throw new UnauthorizedException('Solo el administrador puede realizar esta accion.');
    }

    if (!password) {
      throw new BadRequestException('Se requiere la contrasena para confirmar el borrado.');
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Contrasena incorrecta.');
    }

    try {
      const result = await this.prisma.$transaction(async (tx) => {
        const deletedAttendance = await tx.employeeAttendance.deleteMany({});
        const deletedLedgerEntries = await tx.employeeLedgerEntry.deleteMany({});
        const deletedPayrolls = await tx.payroll.deleteMany({});
        const deletedEmployees = await tx.employee.deleteMany({});

        return {
          deletedAttendance: deletedAttendance.count,
          deletedLedgerEntries: deletedLedgerEntries.count,
          deletedPayrolls: deletedPayrolls.count,
          deletedEmployees: deletedEmployees.count,
        };
      });

      return {
        message: 'Datos de empleados eliminados correctamente',
        ...result,
      };
    } catch (error: any) {
      this.logger.error(`Error limpieza de empleados: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Error al limpiar los datos de empleados.');
    }
  }
}
