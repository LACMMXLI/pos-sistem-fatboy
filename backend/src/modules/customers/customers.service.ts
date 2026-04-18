import { BadRequestException, Injectable, NotFoundException, InternalServerErrorException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CreateCustomerAddressDto,
  CreateCustomerDto,
  UpdateCustomerAddressDto,
  UpdateCustomerDto,
} from './dto/customer.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class CustomersService {
  private readonly logger = new Logger(CustomersService.name);

  constructor(private prisma: PrismaService) {}

  private getCustomerInclude(): Prisma.CustomerInclude {
    return {
      loyaltyAccount: true,
      addresses: {
        orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
      },
      _count: {
        select: {
          orders: true,
          addresses: true,
        },
      },
    };
  }

  private async getCustomerOrThrow(id: number) {
    const customer = await this.prisma.customer.findUnique({
      where: { id },
      include: this.getCustomerInclude(),
    });

    if (!customer) {
      throw new NotFoundException(`Cliente con ID ${id} no encontrado`);
    }

    return customer;
  }

  private async normalizeDefaultAddress(customerId: number, isDefault?: boolean, addressIdToKeep?: number) {
    if (!isDefault) return;

    await this.prisma.customerAddress.updateMany({
      where: {
        customerId,
        ...(addressIdToKeep ? { id: { not: addressIdToKeep } } : {}),
      },
      data: { isDefault: false },
    });
  }

  async create(createCustomerDto: CreateCustomerDto) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const addresses = createCustomerDto.addresses ?? [];
        const hasExplicitDefault = addresses.some((address) => address.isDefault);

        return tx.customer.create({
          data: {
            name: createCustomerDto.name,
            phone: createCustomerDto.phone,
            notes: createCustomerDto.notes,
            addresses: addresses.length
              ? {
                  create: addresses.map((address, index) => ({
                    ...address,
                    isDefault: hasExplicitDefault ? !!address.isDefault : index === 0,
                  })),
                }
              : undefined,
          },
          include: this.getCustomerInclude(),
        });
      });
    } catch (error) {
      this.logger.error(`Error creating customer: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Error interno al crear el cliente');
    }
  }

  async findAll(search?: string) {
    const normalizedSearch = search?.trim();

    return this.prisma.customer.findMany({
      where: normalizedSearch
        ? {
            OR: [
              {
                name: {
                  contains: normalizedSearch,
                  mode: 'insensitive',
                },
              },
              {
                phone: {
                  contains: normalizedSearch.replace(/\D/g, ''),
                },
              },
            ],
          }
        : undefined,
      orderBy: { name: 'asc' },
      include: this.getCustomerInclude(),
    });
  }

  async findOne(id: number) {
    const customer = await this.getCustomerOrThrow(id);

    const totalOrders = await this.prisma.order.count({
      where: { customerId: id },
    });

    const orders = await this.prisma.order.findMany({
      where: { customerId: id },
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: {
        payments: true,
        discounts: true,
        items: {
          include: {
            modifiers: true,
          },
        },
        customerAddress: true,
      },
    });

    const totalSpent = orders.reduce((sum, order) => {
      const itemsTotal = order.items.reduce((itemSum, item) => {
        const modifiersTotal = item.modifiers.reduce(
          (modifierSum, modifier) => modifierSum + Number(modifier.price),
          0,
        );
        return itemSum + (Number(item.price) + modifiersTotal) * item.quantity;
      }, 0);
      const discountTotal = order.discounts.reduce(
        (discountSum, discount) => discountSum + Number(discount.amount),
        0,
      );
      return sum + (itemsTotal - discountTotal);
    }, 0);

    return {
      ...customer,
      analytics: {
        totalOrders,
        recentOrdersCount: orders.length,
        sampleRecentSpend: totalSpent,
      },
      recentOrders: orders,
    };
  }

  async findByPhone(phone: string) {
    return this.prisma.customer.findMany({
      where: {
        phone: {
          contains: phone.replace(/\D/g, ''),
        },
      },
      include: this.getCustomerInclude(),
    });
  }

  async update(id: number, updateCustomerDto: UpdateCustomerDto) {
    try {
      await this.getCustomerOrThrow(id);

      return await this.prisma.customer.update({
        where: { id },
        data: updateCustomerDto,
        include: this.getCustomerInclude(),
      });
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      this.logger.error(`Error updating customer: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Error interno al actualizar el cliente');
    }
  }

  async remove(id: number) {
    try {
      const customer = await this.getCustomerOrThrow(id);

      await this.prisma.$transaction(async (tx) => {
        await tx.order.updateMany({
          where: { customerAddressId: { in: customer.addresses.map((address) => address.id) } },
          data: {
            customerAddressId: null,
          },
        });

        await tx.order.updateMany({
          where: { customerId: id },
          data: {
            customerId: null,
            customerAddressId: null,
          },
        });

        await tx.loyaltyTransaction.deleteMany({
          where: { customerId: id },
        });

        await tx.customerAddress.deleteMany({
          where: { customerId: id },
        });

        await tx.loyaltyAccount.deleteMany({
          where: { customerId: id },
        });

        await tx.customer.delete({
          where: { id },
        });
      });

      return {
        success: true,
        customerId: id,
      };
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      this.logger.error(`Error deleting customer: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Error interno al eliminar el cliente');
    }
  }

  async findOrders(id: number) {
    await this.getCustomerOrThrow(id);

    return this.prisma.order.findMany({
      where: { customerId: id },
      orderBy: { createdAt: 'desc' },
      include: {
        customerAddress: true,
        payments: true,
        discounts: true,
        items: {
          include: {
            product: true,
            modifiers: true,
          },
        },
      },
    });
  }

  async findAddresses(id: number) {
    await this.getCustomerOrThrow(id);

    return this.prisma.customerAddress.findMany({
      where: { customerId: id },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
    });
  }

  async createAddress(id: number, createCustomerAddressDto: CreateCustomerAddressDto) {
    try {
      await this.getCustomerOrThrow(id);
      await this.normalizeDefaultAddress(id, createCustomerAddressDto.isDefault);

      return await this.prisma.customerAddress.create({
        data: {
          customerId: id,
          ...createCustomerAddressDto,
        },
      });
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      this.logger.error(`Error creating customer address: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Error interno al crear el domicilio');
    }
  }

  async updateAddress(
    customerId: number,
    addressId: number,
    updateCustomerAddressDto: UpdateCustomerAddressDto,
  ) {
    try {
      await this.getCustomerOrThrow(customerId);
      const address = await this.prisma.customerAddress.findFirst({
        where: { id: addressId, customerId },
      });

      if (!address) {
        throw new NotFoundException(`Domicilio con ID ${addressId} no encontrado`);
      }

      await this.normalizeDefaultAddress(customerId, updateCustomerAddressDto.isDefault, addressId);

      return await this.prisma.customerAddress.update({
        where: { id: addressId },
        data: updateCustomerAddressDto,
      });
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      this.logger.error(`Error updating customer address: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Error interno al actualizar el domicilio');
    }
  }

  async removeAddress(customerId: number, addressId: number) {
    try {
      await this.getCustomerOrThrow(customerId);
      const address = await this.prisma.customerAddress.findFirst({
        where: { id: addressId, customerId },
        include: {
          orders: {
            select: { id: true },
            take: 1,
          },
        },
      });

      if (!address) {
        throw new NotFoundException(`Domicilio con ID ${addressId} no encontrado`);
      }

      if (address.orders.length > 0) {
        throw new BadRequestException(
          'No se puede eliminar un domicilio que ya está asociado a pedidos',
        );
      }

      return await this.prisma.customerAddress.delete({
        where: { id: addressId },
      });
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      this.logger.error(`Error deleting customer address: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Error interno al eliminar el domicilio');
    }
  }
}
