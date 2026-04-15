import { Injectable, NotFoundException, InternalServerErrorException, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { UpdateKitchenOrderStatusDto, KitchenStatus } from './dto/kitchen-order.dto';
import { OrderStatus } from '../orders/dto/order.dto';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { OrdersService } from '../orders/orders.service';

@Injectable()
export class KitchenService {
  private readonly logger = new Logger(KitchenService.name);

  constructor(
    private prisma: PrismaService,
    private realtimeGateway: RealtimeGateway,
    private ordersService: OrdersService,
  ) {}

  async findAllPending() {
    const activeKitchenOrders = await this.prisma.kitchenOrder.findMany({
      where: {
        status: {
          in: [KitchenStatus.PENDING, KitchenStatus.PREPARING, KitchenStatus.READY]
        }
      },
      include: {
        order: {
          include: {
            table: true,
            items: {
              where: {
                submittedAt: {
                  not: null,
                },
              },
              include: { 
                product: true,
                modifiers: true
              }
            }
          }
        }
      },
      orderBy: { order: { createdAt: 'asc' } }
    });

    return activeKitchenOrders;
  }

  async updateItemStatus(itemId: number, updateDto: UpdateKitchenOrderStatusDto) {
    try {
      const orderItem = await this.prisma.orderItem.findUnique({
        where: { id: itemId },
        include: { order: { include: { kitchenOrder: true, items: true } } }
      });

      if (!orderItem) {
        throw new NotFoundException(`Ítem de orden con ID ${itemId} no encontrado`);
      }

      const updatedItem = await this.prisma.orderItem.update({
        where: { id: itemId },
        data: { status: updateDto.status }
      });

      // Si todos los ítems están LISTOS, marcar la comanda de cocina como LISTA automáticamente
      if (updateDto.status === KitchenStatus.READY || updateDto.status === KitchenStatus.COMPLETED) {
        const remainingItems = orderItem.order.items.filter(
          item =>
            item.id !== itemId &&
            item.submittedAt &&
            item.status !== KitchenStatus.READY &&
            item.status !== KitchenStatus.COMPLETED
        );

        if (remainingItems.length === 0 && orderItem.order.kitchenOrder) {
          await this.prisma.kitchenOrder.update({
            where: { id: orderItem.order.kitchenOrder.id },
            data: { status: KitchenStatus.READY, completedAt: new Date() }
          });
        }
      }

      this.realtimeGateway.emitOrderUpdated({
        id: orderItem.orderId,
      });

      return updatedItem;
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      this.logger.error(`Error updating item status: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Error al actualizar el estado del ítem');
    } finally {
      // Re-evaluar cierre de la orden centralizadamente
      const orderItem = await this.prisma.orderItem.findUnique({ where: { id: itemId } });
      if (orderItem) {
        await this.ordersService.attemptAutoClose(orderItem.orderId);
      }
    }
  }

  async updateStatus(id: number, updateDto: UpdateKitchenOrderStatusDto) {
    try {
      const kitchenOrder = await this.prisma.kitchenOrder.findUnique({
        where: { id },
        include: { order: { include: { items: true } } }
      });

      if (!kitchenOrder) {
        throw new NotFoundException(`Comanda de cocina con ID ${id} no encontrada`);
      }

      const data: any = { status: updateDto.status };

      // Log timestamps based on status
      if (updateDto.status === KitchenStatus.PREPARING && !kitchenOrder.startedAt) {
        data.startedAt = new Date();
      } else if (updateDto.status === KitchenStatus.READY || updateDto.status === KitchenStatus.COMPLETED) {
        data.completedAt = new Date();
      }

      const updatedKitchenOrder = await this.prisma.$transaction(async (tx) => {
        const updated = await tx.kitchenOrder.update({
          where: { id },
          data,
        });

        // Sync main order status ONLY if order is not already CLOSED or CANCELLED
        if (kitchenOrder.order.status !== OrderStatus.CLOSED && kitchenOrder.order.status !== OrderStatus.CANCELLED) {
          let newOrderStatus: OrderStatus | null = null;
          if (updateDto.status === KitchenStatus.PREPARING) newOrderStatus = OrderStatus.IN_PROGRESS;
          if (updateDto.status === KitchenStatus.READY) newOrderStatus = OrderStatus.READY;
          if (
            updateDto.status === KitchenStatus.COMPLETED &&
            kitchenOrder.order.orderType === 'DINE_IN'
          ) {
            newOrderStatus = OrderStatus.READY;
          }
          if (
            updateDto.status === KitchenStatus.COMPLETED &&
            kitchenOrder.order.orderType === 'TAKE_AWAY' &&
            kitchenOrder.order.paymentStatus === 'PAID'
          ) {
            // newOrderStatus = OrderStatus.CLOSED; // Quitamos cierre automático aquí
          }

          if (newOrderStatus) {
            await tx.order.update({
              where: { id: kitchenOrder.orderId },
              data: { status: newOrderStatus }
            });
          }
        }

        // Si se marca la comanda completa, marcar todos sus ítems como listos
        if (updateDto.status === KitchenStatus.READY || updateDto.status === KitchenStatus.COMPLETED) {
          await tx.orderItem.updateMany({
            where: {
              orderId: kitchenOrder.orderId,
              submittedAt: { not: null },
            },
            data: { status: KitchenStatus.READY }
          });
        }

        return updated;
      });

      this.realtimeGateway.emitOrderUpdated({
        id: kitchenOrder.orderId,
        status:
          updateDto.status === KitchenStatus.PREPARING
            ? OrderStatus.IN_PROGRESS
            : updateDto.status === KitchenStatus.READY
              ? OrderStatus.READY
              : kitchenOrder.order.status,
        kitchenStatus: updateDto.status,
        tableId: kitchenOrder.order.tableId,
      });

      return updatedKitchenOrder;
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      this.logger.error(`Error updating kitchen order: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Error interno al actualizar la comanda de cocina');
    } finally {
      // Re-evaluar cierre de la orden centralizadamente
      const kitchenOrder = await this.prisma.kitchenOrder.findUnique({ where: { id } });
      if (kitchenOrder) {
        await this.ordersService.attemptAutoClose(kitchenOrder.orderId);
      }
    }
  }

  async findOne(id: number) {
    const kitchenOrder = await this.prisma.kitchenOrder.findUnique({
      where: { id },
      include: {
        order: {
          include: {
            items: {
              where: {
                submittedAt: {
                  not: null,
                },
              },
              include: { product: true }
            }
          }
        }
      }
    });

    if (!kitchenOrder) {
      throw new NotFoundException(`Comanda de cocina con ID ${id} no encontrada`);
    }

    return kitchenOrder;
  }
}
