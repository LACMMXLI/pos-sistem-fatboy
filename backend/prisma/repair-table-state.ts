import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import 'dotenv/config';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL no esta configurada');
}

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool as any);
const prisma = new PrismaClient({ adapter });
const apply = process.argv.slice(2).includes('--apply');

async function main() {
  const tables = await prisma.table.findMany({
    include: {
      orders: {
        where: {
          status: { in: ['OPEN', 'IN_PROGRESS', 'READY'] },
          paymentStatus: { in: ['PENDING', 'PARTIAL'] },
        },
        select: {
          id: true,
          orderNumber: true,
          status: true,
          paymentStatus: true,
        },
      },
    },
    orderBy: { id: 'asc' },
  });

  const candidates = tables.filter(
    (table) =>
      table.orders.length === 0 &&
      ['OCCUPIED', 'ACCOUNT_PRINTED'].includes(table.status),
  );

  console.log(`Mesas analizadas: ${tables.length}`);
  console.log(`Mesas candidatas a reparacion: ${candidates.length}`);

  for (const table of candidates) {
    console.log(
      `Mesa #${table.id} (${table.name}) | status=${table.status} | activeOrders=${table.orders.length}`,
    );
  }

  if (!apply) {
    console.log('Modo seguro: no se aplicaron cambios. Ejecuta con --apply para reparar.');
    return;
  }

  for (const table of candidates) {
    await prisma.table.update({
      where: { id: table.id },
      data: { status: 'AVAILABLE' },
    });
  }

  console.log(`Mesas reparadas: ${candidates.length}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
