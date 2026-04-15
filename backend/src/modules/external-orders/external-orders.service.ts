import { Injectable, NotFoundException, InternalServerErrorException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateExternalOrderDto, UpdateExternalOrderStatusDto } from './dto/external-order.dto';

@Injectable()
export class ExternalOrdersService {
  private readonly logger = new Logger(ExternalOrdersService.name);

  constructor(private prisma: PrismaService) {}

  async create(createDto: CreateExternalOrderDto) {
    try {
      return await (this.prisma as any).externalOrder.create({
        data: {
          externalSource: createDto.externalSource,
          externalOrderId: createDto.externalOrderId,
          customerName: createDto.customerName,
          payload: createDto.payload,
          status: 'PENDING',
        },
      });
    } catch (error) {
      this.logger.error(`Error creating external order: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Error interno al registrar el pedido externo');
    }
  }

  async findAll() {
    return (this.prisma as any).externalOrder.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: number) {
    const order = await (this.prisma as any).externalOrder.findUnique({
      where: { id },
    });

    if (!order) {
      throw new NotFoundException(`Pedido externo con ID ${id} no encontrado`);
    }

    return order;
  }

  async updateStatus(id: number, updateDto: UpdateExternalOrderStatusDto) {
    try {
      await this.findOne(id);

      return await (this.prisma as any).externalOrder.update({
        where: { id },
        data: { status: updateDto.status },
      });
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      this.logger.error(`Error updating external order status: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Error interno al actualizar el estado del pedido externo');
    }
  }
}
