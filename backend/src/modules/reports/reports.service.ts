import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { startOfDay, endOfDay } from 'date-fns';
import { buildOrderSummary } from '../orders/order-summary.util';

@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);

  constructor(private prisma: PrismaService) {}

  private async getSystemConfig() {
    const config = await this.prisma.systemConfig.findUnique({ where: { id: 1 } });

    return {
      taxEnabled: config?.taxEnabled ?? true,
      taxRate: Number(config?.taxRate ?? 16),
    };
  }

  async getSalesHistory(filters: { startDate?: string; endDate?: string; searchTerm?: string; shiftId?: number }) {
    const { startDate, endDate, searchTerm, shiftId } = filters;

    const where: Prisma.OrderWhereInput = {
      payments: {
        some: shiftId
          ? { shiftId: Number(shiftId) }
          : {},
      },
    };

    if (!shiftId && startDate && endDate) {
      where.createdAt = {
        gte: new Date(startDate),
        lte: new Date(endDate),
      };
    }

    if (searchTerm) {
      where.OR = [
        { orderNumber: { contains: searchTerm, mode: 'insensitive' } },
        { customerName: { contains:searchTerm, mode: 'insensitive' } },
        { table: { name: { contains: searchTerm, mode: 'insensitive' } } },
      ];
    }

    try {
      const orders: any[] = await this.prisma.order.findMany({
        where,
        include: {
          user: { select: { id: true, name: true } },
          waiter: { select: { id: true, name: true } },
          table: { select: { id: true, name: true } },
          items: {
            include: {
              product: { select: { id: true, name: true } },
              modifiers: true,
              redeemableProduct: true,
            },
          },
          payments: shiftId
            ? {
                where: {
                  shiftId: Number(shiftId),
                },
              }
            : true,
          discounts: true,
        } as any,
        orderBy: {
          createdAt: 'desc',
        },
      });
      const config = await this.getSystemConfig();
      return orders.map((order) => ({
        ...order,
        ...buildOrderSummary(order, config),
      }));
    } catch (error) {
      this.logger.error(`Error fetching sales history: ${error.message}`, error.stack);
      throw new Error('Could not fetch sales history.');
    }
  }

  async getDailySummary(query: { date?: string; shiftId?: number }) {
    const { date, shiftId } = query;
    let selectedShiftId = shiftId ? Number(shiftId) : undefined;
    let where: Prisma.OrderWhereInput = {
      payments: { some: {} },
      status: { not: 'CANCELLED' },
    };

    if (selectedShiftId) {
      where.payments = {
        some: {
          shiftId: selectedShiftId,
        },
      };
    } else if (date) {
      const targetDate = new Date(date);
      where.createdAt = {
        gte: startOfDay(targetDate),
        lte: endOfDay(targetDate),
      };
    } else {
      // DEFAULT: Current active shift (any)
      const currentShift = await this.prisma.cashShift.findFirst({
        where: { status: 'OPEN' },
        orderBy: { openedAt: 'desc' },
      });

      if (currentShift) {
        selectedShiftId = currentShift.id;
        where.payments = {
          some: {
            shiftId: currentShift.id,
          },
        };
      } else {
        // Fallback to today if no shift
        const today = new Date();
        where.createdAt = {
          gte: startOfDay(today),
          lte: endOfDay(today),
        };
      }
    }

    const config = await this.getSystemConfig();
    const orders: any[] = await this.prisma.order.findMany({
      where,
      include: {
        payments: selectedShiftId
          ? {
              where: {
                shiftId: selectedShiftId,
              },
            }
          : true,
        discounts: true,
        user: { select: { id: true, name: true } },
        items: {
          include: {
            modifiers: true,
            redeemableProduct: true,
            product: {
              include: {
                category: true,
              },
            },
          },
        },
      } as any,
    });

    const orderSummaries = orders.map((order) => buildOrderSummary(order, config));
    const totalOrders = orders.length;
    const totalRevenue = orderSummaries.reduce((sum, order) => sum + order.paidAmount, 0);
    const averageTicket = totalOrders > 0 ? totalRevenue / totalOrders : 0;
    const activeUsers = new Set(orders.map((order) => order.userId)).size;

    const payments = orders.flatMap((order) => order.payments);

    // 2. Aggregate sales by payment method
    const salesByPaymentMethod = payments.reduce((acc, payment) => {
      acc[payment.paymentMethod] = (acc[payment.paymentMethod] || 0) + Number(payment.amount);
      return acc;
    }, {} as Record<string, number>);

    // 3. Aggregate top products and sales by category
    const orderItems = orders.flatMap((order) => order.items);

    const productSales = orderItems.reduce((acc, item) => {
      const { product } = item;
      if (!acc[product.id]) {
        acc[product.id] = { id: product.id, name: product.name, quantity: 0, total: 0 };
      }
      acc[product.id].quantity += item.quantity;
      acc[product.id].total += item.quantity * Number(item.price);
      return acc;
    }, {} as Record<string, any>);

    const topProducts = Object.values(productSales)
      .sort((a: any, b: any) => b.quantity - a.quantity)
      .slice(0, 5);

    const salesByCategory = orderItems.reduce((acc, item) => {
      const { category } = item.product;
      if (category) {
         if (!acc[category.id]) {
          acc[category.id] = { id: category.id, name: category.name, total: 0 };
        }
        acc[category.id].total += item.quantity * Number(item.price);
      }
      return acc;
    }, {} as Record<string, any>);

    return {
      totalRevenue,
      totalOrders,
      averageTicket,
      activeUsers,
      salesByPaymentMethod,
      topProducts,
      salesByCategory: Object.values(salesByCategory).sort((a: any, b: any) => b.total - a.total),
    };
  }
}
