import { PrismaClient } from '@prisma/client';

async function debugOrder() {
  const prisma = new PrismaClient();
  try {
    const orders = await prisma.order.findMany({
      where: { status: { not: 'CLOSED' } },
      include: {
        items: { include: { product: true } },
        payments: true,
        discounts: true
      }
    });

    console.log('--- Orders Debug ---');
    orders.forEach(order => {
      const subtotal = order.items.reduce((acc, item) => acc + Number(item.price) * item.quantity, 0);
      const paid = order.payments.reduce((acc, p) => acc + Number(p.amount), 0);
      console.log(`Order ID: ${order.id}, Subtotal: ${subtotal}, Paid: ${paid}, TableID: ${order.tableId}`);
    });

  } catch (e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
}

debugOrder();
