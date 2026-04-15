import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

async function main() {
  const prisma = new PrismaClient();

  try {
    const orphanOrders = await prisma.order.findMany({
      where: {
        shiftId: null,
        paymentStatus: 'PAID',
        payments: {
          some: {},
        },
      },
      select: {
        id: true,
        orderNumber: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    console.log(`Ordenes pagadas sin turno detectadas: ${orphanOrders.length}`);

    let repaired = 0;
    let skipped = 0;

    for (const order of orphanOrders) {
      const matchingMovements = await prisma.cashMovement.findMany({
        where: {
          reason: {
            contains: order.orderNumber,
          },
        },
        select: {
          id: true,
          shiftId: true,
          reason: true,
          createdAt: true,
        },
        orderBy: {
          createdAt: 'asc',
        },
      });

      const uniqueShiftIds = [...new Set(matchingMovements.map((movement) => movement.shiftId))];

      if (uniqueShiftIds.length !== 1) {
        skipped += 1;
        console.log(
          `[SKIP] ${order.orderNumber} -> movimientos encontrados: ${matchingMovements.length}, turnos detectados: ${uniqueShiftIds.join(', ') || 'ninguno'}`,
        );
        continue;
      }

      await prisma.order.update({
        where: { id: order.id },
        data: {
          shiftId: uniqueShiftIds[0],
        },
      });

      repaired += 1;
      console.log(`[OK] ${order.orderNumber} -> shiftId ${uniqueShiftIds[0]}`);
    }

    console.log(`Reparadas: ${repaired}`);
    console.log(`Omitidas por ambiguedad o falta de movimiento: ${skipped}`);
  } catch (error) {
    console.error('Error reparando ordenes sin turno:', error);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

void main();
