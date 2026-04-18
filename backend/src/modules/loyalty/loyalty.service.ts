import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AdjustCustomerPointsDto, RedeemProductDto } from './dto/loyalty.dto';
import { RealtimeGateway } from '../realtime/realtime.gateway';

@Injectable()
export class LoyaltyService {
  private readonly logger = new Logger(LoyaltyService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly realtimeGateway: RealtimeGateway,
  ) {}

  private normalizePhone(phone: string) {
    return phone.replace(/\D/g, '');
  }

  private async findMatchingCustomerByPhone(phone: string) {
    const normalizedPhone = this.normalizePhone(phone);
    const customers = await this.prisma.customer.findMany({
      where: {
        phone: {
          not: null,
        },
      },
      include: {
        loyaltyAccount: true,
      },
    });

    return (
      customers.find((customer) => this.normalizePhone(customer.phone ?? '') === normalizedPhone) ??
      null
    );
  }

  async findOrCreateCustomer(phone: string, name?: string) {
    const normalizedPhone = this.normalizePhone(phone);

    if (normalizedPhone.length < 7) {
      throw new BadRequestException('Debes capturar un telefono valido');
    }

    try {
      const existingCustomer = await this.findMatchingCustomerByPhone(normalizedPhone);

      if (existingCustomer) {
        if (!existingCustomer.loyaltyAccount) {
          await this.prisma.loyaltyAccount.create({
            data: {
              customerId: existingCustomer.id,
            },
          });
        }

        return this.getCustomerSummary(existingCustomer.id);
      }

      const customer = await this.prisma.$transaction(async (tx) => {
        const createdCustomer = await tx.customer.create({
          data: {
            name: name?.trim() || `Cliente ${normalizedPhone}`,
            phone: normalizedPhone,
          },
        });

        await tx.loyaltyAccount.create({
          data: {
            customerId: createdCustomer.id,
          },
        });

        return createdCustomer;
      });

      return this.getCustomerSummary(customer.id);
    } catch (error: any) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      this.logger.error(`Error al buscar o crear cliente de fidelizacion: ${error.message}`, error.stack);
      throw new InternalServerErrorException('No fue posible preparar el cliente de fidelizacion');
    }
  }

  async getCustomerByPhone(phone: string) {
    const normalizedPhone = this.normalizePhone(phone);

    if (normalizedPhone.length < 7) {
      throw new BadRequestException('Debes capturar un telefono valido');
    }

    const customer = await this.findMatchingCustomerByPhone(normalizedPhone);

    if (!customer) {
      throw new NotFoundException('Cliente no encontrado');
    }

    return this.getCustomerSummary(customer.id);
  }

  async getCustomerPoints(customerId: number) {
    const customer = await this.prisma.customer.findUnique({
      where: { id: customerId },
      include: {
        loyaltyAccount: true,
      },
    });

    if (!customer) {
      throw new NotFoundException('Cliente no encontrado');
    }

    return {
      customerId: customer.id,
      customerName: customer.name,
      phone: customer.phone,
      points: customer.loyaltyAccount?.points ?? 0,
    };
  }

  async getCustomerLoyaltySummary(customerId: number) {
    const customer = await this.prisma.customer.findUnique({
      where: { id: customerId },
      include: {
        loyaltyAccount: true,
        loyaltyTransactions: {
          orderBy: { createdAt: 'desc' },
          take: 50,
          include: {
            order: {
              select: {
                id: true,
                orderNumber: true,
                createdAt: true,
                paymentStatus: true,
                status: true,
              },
            },
          },
        },
      },
    });

    if (!customer) {
      throw new NotFoundException('Cliente no encontrado');
    }

    return {
      customerId: customer.id,
      customerName: customer.name,
      phone: customer.phone,
      points: customer.loyaltyAccount?.points ?? 0,
      transactions: customer.loyaltyTransactions.map((transaction) => ({
        id: transaction.id,
        type: transaction.type,
        points: transaction.points,
        description: transaction.description,
        createdAt: transaction.createdAt,
        order: transaction.order
          ? {
              id: transaction.order.id,
              orderNumber: transaction.order.orderNumber,
              createdAt: transaction.order.createdAt,
              paymentStatus: transaction.order.paymentStatus,
              status: transaction.order.status,
            }
          : null,
      })),
    };
  }

  async getCustomerSummary(customerId: number) {
    const customer = await this.prisma.customer.findUnique({
      where: { id: customerId },
      include: {
        loyaltyAccount: true,
      },
    });

    if (!customer) {
      throw new NotFoundException('Cliente no encontrado');
    }

    return {
      id: customer.id,
      name: customer.name,
      phone: customer.phone,
      loyaltyPoints: customer.loyaltyAccount?.points ?? 0,
    };
  }

  previewPoints(total: number) {
    return Math.max(0, Math.floor(total / 10));
  }

  async addPoints(customerId: number, orderId: number, total: number) {
    const pointsToAdd = this.previewPoints(total);

    if (pointsToAdd <= 0) {
      return {
        customerId,
        orderId,
        pointsAdded: 0,
        balance: (await this.getCustomerPoints(customerId)).points,
      };
    }

    try {
      const result = await this.prisma.$transaction(async (tx) => {
        const customer = await tx.customer.findUnique({
          where: { id: customerId },
          include: {
            loyaltyAccount: true,
          },
        });

        if (!customer) {
          throw new NotFoundException('Cliente no encontrado para fidelizacion');
        }

        const loyaltyAccount =
          customer.loyaltyAccount ??
          (await tx.loyaltyAccount.create({
            data: {
              customerId,
            },
          }));

        const updatedAccount = await tx.loyaltyAccount.update({
          where: { id: loyaltyAccount.id },
          data: {
            points: {
              increment: pointsToAdd,
            },
          },
        });

        await tx.loyaltyTransaction.create({
          data: {
            customerId,
            orderId,
            type: 'EARN',
            points: pointsToAdd,
            description: `Puntos generados por orden #${orderId}`,
          },
        });

        return updatedAccount;
      });

      this.logger.log(
        `Se generaron ${pointsToAdd} puntos para el cliente ${customerId} en la orden ${orderId}`,
      );

      return {
        customerId,
        orderId,
        pointsAdded: pointsToAdd,
        balance: result.points,
      };
    } catch (error: any) {
      if (error instanceof NotFoundException) {
        throw error;
      }

      this.logger.error(`Error al agregar puntos: ${error.message}`, error.stack);
      throw new InternalServerErrorException('No fue posible agregar puntos');
    }
  }

  async redeemPoints(customerId: number, points: number, description?: string, orderId?: number | null) {
    if (!Number.isInteger(points) || points <= 0) {
      throw new BadRequestException('Los puntos a canjear deben ser mayores a cero');
    }

    try {
      const result = await this.prisma.$transaction(async (tx) => {
        const customer = await tx.customer.findUnique({
          where: { id: customerId },
          include: {
            loyaltyAccount: true,
          },
        });

        if (!customer) {
          throw new NotFoundException('Cliente no encontrado');
        }

        const loyaltyAccount =
          customer.loyaltyAccount ??
          (await tx.loyaltyAccount.create({
            data: {
              customerId,
            },
          }));

        if (loyaltyAccount.points < points) {
          throw new BadRequestException('Saldo de puntos insuficiente');
        }

        const updatedAccount = await tx.loyaltyAccount.update({
          where: { id: loyaltyAccount.id },
          data: {
            points: {
              decrement: points,
            },
          },
        });

        await tx.loyaltyTransaction.create({
          data: {
            customerId,
            orderId: orderId ?? undefined,
            type: 'REDEEM',
            points: -points,
            description: description?.trim() || 'Canje de puntos',
          },
        });

        return updatedAccount;
      });

      this.logger.log(`Se canjearon ${points} puntos del cliente ${customerId}`);

      return {
        customerId,
        pointsRedeemed: points,
        balance: result.points,
      };
    } catch (error: any) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }

      this.logger.error(`Error al canjear puntos: ${error.message}`, error.stack);
      throw new InternalServerErrorException('No fue posible canjear puntos');
    }
  }

  async adjustCustomerPoints(
    dto: AdjustCustomerPointsDto,
    actor?: { id?: number; name?: string; role?: string },
  ) {
    const { customerId, operation, points, description } = dto;

    if (!Number.isInteger(points) || points < 0) {
      throw new BadRequestException('La cantidad de puntos debe ser un entero igual o mayor a cero');
    }

    try {
      const result = await this.prisma.$transaction(async (tx) => {
        const customer = await tx.customer.findUnique({
          where: { id: customerId },
          include: {
            loyaltyAccount: true,
          },
        });

        if (!customer) {
          throw new NotFoundException('Cliente no encontrado');
        }

        const loyaltyAccount =
          customer.loyaltyAccount ??
          (await tx.loyaltyAccount.create({
            data: {
              customerId: customer.id,
            },
          }));

        const currentPoints = loyaltyAccount.points;
        const nextPoints =
          operation === 'SET'
            ? points
            : operation === 'ADD'
              ? currentPoints + points
              : currentPoints - points;

        if (nextPoints < 0) {
          throw new BadRequestException('El ajuste no puede dejar puntos negativos');
        }

        const delta = nextPoints - currentPoints;

        const updatedAccount = await tx.loyaltyAccount.update({
          where: { id: loyaltyAccount.id },
          data: {
            points: nextPoints,
          },
        });

        if (delta !== 0) {
          const actionLabel =
            operation === 'SET'
              ? `Ajuste manual de saldo a ${nextPoints} puntos`
              : operation === 'ADD'
                ? `Suma manual de ${points} puntos`
                : `Descuento manual de ${points} puntos`;
          const actorLabel = actor?.name?.trim() ? ` por ${actor.name.trim()}` : '';

          await tx.loyaltyTransaction.create({
            data: {
              customerId: customer.id,
              type: 'ADJUSTMENT',
              points: delta,
              description: description?.trim() || `${actionLabel}${actorLabel}`,
            },
          });
        }

        return {
          customer,
          currentPoints,
          updatedAccount,
          delta,
        };
      });

      this.logger.log(
        `Ajuste manual de puntos para cliente ${customerId}: ${operation} ${points} -> saldo ${result.updatedAccount.points}`,
      );

      return {
        customerId: result.customer.id,
        customerName: result.customer.name,
        operation,
        previousBalance: result.currentPoints,
        pointsApplied: operation === 'SET' ? result.delta : points,
        balance: result.updatedAccount.points,
      };
    } catch (error: any) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }

      this.logger.error(`Error al ajustar puntos manualmente: ${error.message}`, error.stack);
      throw new InternalServerErrorException('No fue posible ajustar los puntos del cliente');
    }
  }

  private async buildRedemptionOrderNumber() {
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const count = await this.prisma.order.count();
    return `CANJE-${date}-${(count + 1).toString().padStart(4, '0')}`;
  }

  async redeemProduct(
    dto: RedeemProductDto,
    actor: { id: number; role: string },
  ) {
    const quantity = dto.quantity ?? 1;

    if (!actor?.id) {
      throw new ForbiddenException('Usuario no autorizado para registrar canjes');
    }

    try {
      const redeemableProduct = await this.prisma.redeemableProduct.findUnique({
        where: { id: dto.redeemableProductId },
        include: {
          product: true,
        },
      });

      if (!redeemableProduct || !redeemableProduct.isActive) {
        throw new NotFoundException('Producto canjeable no disponible');
      }

      if (!redeemableProduct.product.isAvailable) {
        throw new BadRequestException('El producto base no está disponible para producción');
      }

      const customer = await this.prisma.customer.findUnique({
        where: { id: dto.customerId },
        include: {
          loyaltyAccount: true,
        },
      });

      if (!customer) {
        throw new NotFoundException('Cliente no encontrado');
      }

      const totalPoints = redeemableProduct.pointsCost * quantity;
      const orderNumber = await this.buildRedemptionOrderNumber();

      const result = await this.prisma.$transaction(async (tx) => {
        const loyaltyAccount =
          customer.loyaltyAccount ??
          (await tx.loyaltyAccount.create({
            data: {
              customerId: customer.id,
            },
          }));

        if (loyaltyAccount.points < totalPoints) {
          throw new BadRequestException('Saldo de puntos insuficiente para este canje');
        }

        const order = await tx.order.create({
          data: {
            orderNumber,
            customerId: customer.id,
            customerName: customer.name,
            customerPhoneSnapshot: customer.phone ?? null,
            orderType: 'TAKE_AWAY',
            userId: actor.id,
            status: 'OPEN',
            paymentStatus: 'PAID',
            items: {
              create: [
                {
                  productId: redeemableProduct.productId,
                  quantity,
                  price: 0,
                  notes: dto.notes?.trim() || `Canje por ${totalPoints} puntos`,
                  status: 'PENDING',
                  submittedAt: new Date(),
                  submissionBatch: 1,
                },
              ],
            },
          },
          include: {
            items: true,
          },
        });

        await tx.kitchenOrder.create({
          data: {
            orderId: order.id,
            status: 'PENDING',
          },
        });

        const updatedAccount = await tx.loyaltyAccount.update({
          where: { id: loyaltyAccount.id },
          data: {
            points: {
              decrement: totalPoints,
            },
          },
        });

        await tx.loyaltyTransaction.create({
          data: {
            customerId: customer.id,
            orderId: order.id,
            type: 'REDEEM',
            points: -totalPoints,
            description: dto.notes?.trim() || `Canje de ${quantity} x ${redeemableProduct.product.name}`,
          },
        });

        return {
          order,
          balance: updatedAccount.points,
        };
      });

      this.realtimeGateway.emitOrderCreated({
        id: result.order.id,
        orderNumber: result.order.orderNumber,
        orderType: 'TAKE_AWAY',
        paymentStatus: 'PAID',
        status: 'OPEN',
        totalAmount: 0,
        remainingAmount: 0,
      });

      this.realtimeGateway.emitPrintJob({
        jobId: `redeem:${result.order.id}:KITCHEN:${Date.now()}`,
        orderId: result.order.id,
        type: 'KITCHEN',
        copies: 1,
        openDrawer: false,
        source: 'LOYALTY_REDEEM',
      });

      return {
        orderId: result.order.id,
        orderNumber: result.order.orderNumber,
        customerId: customer.id,
        customerName: customer.name,
        redeemableProductId: redeemableProduct.id,
        productId: redeemableProduct.productId,
        productName: redeemableProduct.product.name,
        quantity,
        pointsRedeemed: totalPoints,
        balance: result.balance,
      };
    } catch (error: any) {
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException ||
        error instanceof ForbiddenException
      ) {
        throw error;
      }

      this.logger.error(`Error redeeming product: ${error.message}`, error.stack);
      throw new InternalServerErrorException('No fue posible registrar el canje del producto');
    }
  }
}
