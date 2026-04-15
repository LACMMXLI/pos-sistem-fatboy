import { Injectable, NotFoundException, InternalServerErrorException, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateTableDto, UpdateTableDto, UpdateTableStatusDto, TableStatus } from './dto/table.dto';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { buildOrderSummary } from '../orders/order-summary.util';

@Injectable()
export class TablesService {
  private readonly logger = new Logger(TablesService.name);

  constructor(
    private prisma: PrismaService,
    private realtimeGateway: RealtimeGateway,
  ) { }

  private getActiveOrderWhere() {
    return {
      status: { notIn: ['CLOSED', 'CANCELLED'] },
      paymentStatus: { in: ['PENDING', 'PARTIAL'] },
    };
  }

  private async getSystemConfig() {
    const config = await this.prisma.systemConfig.findUnique({ where: { id: 1 } });

    return {
      taxEnabled: config?.taxEnabled ?? true,
      taxRate: Number(config?.taxRate ?? 16),
    };
  }

  private async validateManualStatusChange(id: number, status: TableStatus) {
    const activeOrder = await this.prisma.order.findFirst({
      where: {
        tableId: id,
        ...this.getActiveOrderWhere(),
      },
      select: { id: true, orderNumber: true },
    });

    if (status === 'AVAILABLE' && activeOrder) {
      throw new BadRequestException(
        `No se puede liberar la mesa porque la cuenta ${activeOrder.orderNumber} sigue activa`,
      );
    }

    if (
      ['OCCUPIED', 'ACCOUNT_PRINTED'].includes(status) &&
      !activeOrder
    ) {
      throw new BadRequestException(
        'No se puede marcar la mesa con ese estado sin una cuenta activa asociada',
      );
    }
  }

  async create(createTableDto: CreateTableDto) {
    try {
      const area = await this.prisma.area.findUnique({ where: { id: createTableDto.areaId } });
      if (!area) throw new NotFoundException(`Área con ID ${createTableDto.areaId} no encontrada`);

      return await this.prisma.table.create({
        data: createTableDto,
      });
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      this.logger.error(`Error creating table: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Error interno al crear la mesa');
    }
  }

  async createTabletTemporary(createTableDto: CreateTableDto) {
    const normalizedName = createTableDto.name?.trim();

    if (!normalizedName) {
      throw new BadRequestException('El nombre de la mesa es obligatorio');
    }

    return this.create({
      ...createTableDto,
      name: normalizedName,
      status: createTableDto.status ?? TableStatus.AVAILABLE,
      isActive: createTableDto.isActive ?? true,
    });
  }

  async findAll() {
    const tables = await this.prisma.table.findMany({
      include: {
        area: { select: { name: true } },
        orders: {
          where: this.getActiveOrderWhere(),
          select: {
            id: true,
            orderNumber: true,
            status: true,
            paymentStatus: true,
          },
        },
      },
      orderBy: [{ areaId: 'asc' }, { name: 'asc' }]
    });

    return tables.map((table: any) => {
      const hasActiveOrder = table.orders.length > 0;
      const effectiveStatus =
        !hasActiveOrder
          ? table.status
          : table.status === 'ACCOUNT_PRINTED'
            ? 'ACCOUNT_PRINTED'
            : 'OCCUPIED';

      return {
        ...table,
        status: effectiveStatus,
        _count: {
          orders: table.orders.length,
        },
      };
    });
  }

  async findByArea(areaId: number) {
    const tables = await this.prisma.table.findMany({
      where: { areaId },
      include: {
        area: { select: { name: true } },
        orders: {
          where: this.getActiveOrderWhere(),
          select: {
            id: true,
            orderNumber: true,
            status: true,
            paymentStatus: true,
          },
        },
      },
      orderBy: { name: 'asc' }
    });

    return tables.map((table: any) => {
      const hasActiveOrder = table.orders.length > 0;
      const effectiveStatus =
        !hasActiveOrder
          ? table.status
          : table.status === 'ACCOUNT_PRINTED'
            ? 'ACCOUNT_PRINTED'
            : 'OCCUPIED';

      return {
        ...table,
        status: effectiveStatus,
        _count: {
          orders: table.orders.length,
        },
      };
    });
  }

  async findOne(id: number) {
    const table: any = await this.prisma.table.findUnique({
      where: { id },
      include: {
        area: true,
        orders: {
          where: this.getActiveOrderWhere(),
          include: {
            items: {
              orderBy: [{ submissionBatch: 'asc' }, { id: 'asc' }],
              include: { product: true, modifiers: true },
            },
            waiter: { select: { id: true, name: true } },
            payments: true,
            discounts: true,
          }
        } as any
      }
    });

    if (!table) {
      throw new NotFoundException(`Mesa con ID ${id} no encontrada`);
    }

    const config = await this.getSystemConfig();

    return {
      ...table,
      orders: table.orders.map((order: any) => ({
        ...order,
        draftItems: order.items.filter((item: any) => !item.submittedAt),
        submittedItems: order.items.filter((item: any) => !!item.submittedAt),
        ...buildOrderSummary(order, config),
      })),
    };
  }

  async update(id: number, updateTableDto: UpdateTableDto) {
    try {
      if (updateTableDto.status) {
        await this.validateManualStatusChange(id, updateTableDto.status);
      }

      const updatedTable = await this.prisma.table.update({
        where: { id },
        data: updateTableDto,
      });

      this.realtimeGateway.emitTableUpdated({
        id: updatedTable.id,
        status: updatedTable.status
      });

      return updatedTable;
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      if (error.code === 'P2025') {
        throw new NotFoundException(`Mesa con ID ${id} no encontrada`);
      }
      this.logger.error(`Error updating table: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Error interno al actualizar la mesa');
    }
  }

  async updateStatus(id: number, updateStatusDto: UpdateTableStatusDto) {
    try {
      await this.validateManualStatusChange(id, updateStatusDto.status);

      const updatedTable = await this.prisma.table.update({
        where: { id },
        data: { status: updateStatusDto.status },
      });

      this.realtimeGateway.emitTableUpdated({
        id: updatedTable.id,
        status: updatedTable.status
      });

      return updatedTable;
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      if (error.code === 'P2025') {
        throw new NotFoundException(`Mesa con ID ${id} no encontrada`);
      }
      this.logger.error(`Error updating table status: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Error interno al actualizar el estado de la mesa');
    }
  }

  async remove(id: number) {
    try {
      // Check if it has active orders
      const table = await this.findOne(id);
      if (table.orders.length > 0) {
        throw new BadRequestException('No se puede eliminar una mesa que tiene cuentas activas');
      }

      return await this.prisma.table.delete({
        where: { id },
      });
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) throw error;
      this.logger.error(`Error removing table: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Error interno al eliminar la mesa');
    }
  }
}
