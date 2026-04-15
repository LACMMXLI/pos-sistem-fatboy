
import { PrismaClient } from '@prisma/client';

async function main() {
  const prisma = new PrismaClient();
  try {
    const orders = await prisma.order.findMany({
      where: {
        OR: [
          { status: { not: 'CLOSED' } },
          { paymentStatus: { not: 'PAID' } }
        ]
      },
      select: {
          id: true,
          orderNumber: true,
          status: true,
          paymentStatus: true,
          shiftId: true
      }
    });

    console.log('--- Orders that might block shift closure ---');
    console.log(JSON.stringify(orders, null, 2));

    const shifts = await prisma.cashShift.findMany({
        where: { status: 'OPEN' },
        select: { id: true, userId: true }
    });
    console.log('--- Open Shifts ---');
    console.log(JSON.stringify(shifts, null, 2));

  } catch (e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
}

main();
