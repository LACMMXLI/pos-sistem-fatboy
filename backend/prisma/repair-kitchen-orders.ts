import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import 'dotenv/config';
import { buildOrderSummary } from '../src/modules/orders/order-summary.util';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL no esta configurada');
}

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool as any);
const prisma = new PrismaClient({ adapter });

const args = process.argv.slice(2);
const apply = args.includes('--apply');
const listActive = args.includes('--list-active');
const completeReadyOlderThanMinutesArg = args.find((arg) =>
  arg.startsWith('--complete-ready-older-than-minutes='),
);
const completeReadyOlderThanMinutes = completeReadyOlderThanMinutesArg
  ? Number(completeReadyOlderThanMinutesArg.split('=')[1])
  : 120;
const forceCompleteOlderThanMinutesArg = args.find((arg) =>
  arg.startsWith('--force-complete-older-than-minutes='),
);
const forceCompleteOlderThanMinutes = forceCompleteOlderThanMinutesArg
  ? Number(forceCompleteOlderThanMinutesArg.split('=')[1])
  : null;

type RepairAction = {
  kitchenOrderId: number;
  orderId: number;
  orderNumber: string;
  reasons: string[];
  kitchenStatus?: string;
  orderStatus?: string;
  paymentStatus?: string;
  tableId?: number | null;
  setKitchenStatus?: string;
  setOrderStatus?: string;
  setPaymentStatus?: string;
  setTableStatus?: string;
  setItemStatus?: string;
};

const now = Date.now();

async function getSystemConfig() {
  const config = await prisma.systemConfig.findUnique({ where: { id: 1 } });

  return {
    taxEnabled: config?.taxEnabled ?? true,
    taxRate: Number(config?.taxRate ?? 16),
  };
}

function buildRepairAction(kitchenOrder: any, config: { taxEnabled: boolean; taxRate: number }) {
  const summary = buildOrderSummary(kitchenOrder.order, config);
  const reasons: string[] = [];
  const action: RepairAction = {
    kitchenOrderId: kitchenOrder.id,
    orderId: kitchenOrder.order.id,
    orderNumber: kitchenOrder.order.orderNumber,
    kitchenStatus: kitchenOrder.status,
    orderStatus: kitchenOrder.order.status,
    paymentStatus: kitchenOrder.order.paymentStatus,
    tableId: kitchenOrder.order.tableId,
    reasons,
  };

  const normalizedPaymentStatus =
    summary.remainingAmount <= 0.01
      ? 'PAID'
      : summary.paidAmount > 0
        ? 'PARTIAL'
        : 'PENDING';

  if (kitchenOrder.order.paymentStatus !== normalizedPaymentStatus) {
    action.setPaymentStatus = normalizedPaymentStatus;
    reasons.push(
      `paymentStatus inconsistente (${kitchenOrder.order.paymentStatus} -> ${normalizedPaymentStatus})`,
    );
  }

  if (
    summary.remainingAmount <= 0.01 &&
    kitchenOrder.order.status !== 'CLOSED' &&
    kitchenOrder.order.status !== 'CANCELLED'
  ) {
    action.setOrderStatus = 'CLOSED';
    reasons.push('orden pagada completamente pero sigue abierta');
  }

  if (
    kitchenOrder.order.status === 'CLOSED' ||
    kitchenOrder.order.status === 'CANCELLED'
  ) {
    if (kitchenOrder.status !== 'COMPLETED') {
      action.setKitchenStatus = 'COMPLETED';
      action.setItemStatus = 'READY';
      reasons.push('comanda sigue activa aunque la orden ya esta cerrada/cancelada');
    }

    if (kitchenOrder.order.tableId) {
      action.setTableStatus = 'AVAILABLE';
    }
  }

  if (kitchenOrder.status === 'READY') {
    const createdAt = new Date(kitchenOrder.order.createdAt).getTime();
    const ageMinutes = Math.floor((now - createdAt) / 60000);

    if (ageMinutes >= completeReadyOlderThanMinutes) {
      action.setKitchenStatus = 'COMPLETED';
      action.setItemStatus = 'READY';
      reasons.push(
        `comanda en READY con ${ageMinutes} min de antiguedad (umbral ${completeReadyOlderThanMinutes})`,
      );
    }
  }

  if (
    forceCompleteOlderThanMinutes !== null &&
    ['PENDING', 'PREPARING', 'READY'].includes(kitchenOrder.status)
  ) {
    const createdAt = new Date(kitchenOrder.order.createdAt).getTime();
    const ageMinutes = Math.floor((now - createdAt) / 60000);

    if (ageMinutes >= forceCompleteOlderThanMinutes) {
      action.setKitchenStatus = 'COMPLETED';
      action.setItemStatus = 'READY';
      reasons.push(
        `comanda activa con ${ageMinutes} min de antiguedad forzada a COMPLETED (umbral ${forceCompleteOlderThanMinutes})`,
      );
    }
  }

  if (
    action.setOrderStatus === 'CLOSED' &&
    kitchenOrder.order.tableId
  ) {
    action.setTableStatus = 'AVAILABLE';
  }

  return reasons.length > 0 ? action : null;
}

async function main() {
  const config = await getSystemConfig();
  const kitchenOrders = await prisma.kitchenOrder.findMany({
    include: {
      order: {
        include: {
          items: {
            include: {
              modifiers: true,
            },
          },
          payments: true,
          discounts: true,
        },
      },
    },
    orderBy: {
      order: {
        createdAt: 'asc',
      },
    },
  });

  const repairs = kitchenOrders
    .map((kitchenOrder) => buildRepairAction(kitchenOrder, config))
    .filter(Boolean) as RepairAction[];

  const activeKitchenOrders = kitchenOrders.filter((kitchenOrder) =>
    ['PENDING', 'PREPARING', 'READY'].includes(kitchenOrder.status),
  );

  console.log(`Kitchen orders analizadas: ${kitchenOrders.length}`);
  console.log(`Kitchen orders activas: ${activeKitchenOrders.length}`);
  console.log(`Reparaciones candidatas: ${repairs.length}`);

  if (listActive) {
    console.log('');
    console.log('Comandas activas:');
    for (const kitchenOrder of activeKitchenOrders) {
      const createdAt = new Date(kitchenOrder.order.createdAt).getTime();
      const ageMinutes = Math.floor((now - createdAt) / 60000);
      console.log(
        [
          `#${kitchenOrder.id}`,
          kitchenOrder.order.orderNumber,
          `kitchen=${kitchenOrder.status}`,
          `order=${kitchenOrder.order.status}`,
          `payment=${kitchenOrder.order.paymentStatus}`,
          `type=${kitchenOrder.order.orderType}`,
          `age=${ageMinutes}m`,
        ].join(' | '),
      );
    }
  }

  if (repairs.length === 0) {
    console.log('No se detectaron comandas atascadas o inconsistentes.');
    return;
  }

  for (const repair of repairs) {
    console.log(
      [
        `#${repair.kitchenOrderId}`,
        repair.orderNumber,
        `kitchen=${repair.kitchenStatus}`,
        `order=${repair.orderStatus}`,
        `payment=${repair.paymentStatus}`,
        `reasons=${repair.reasons.join('; ')}`,
      ].join(' | '),
    );
  }

  if (!apply) {
    console.log('');
    console.log(
      'Modo seguro: no se aplicaron cambios. Ejecuta con --apply para reparar.',
    );
    return;
  }

  for (const repair of repairs) {
    await prisma.$transaction(async (tx) => {
      if (repair.setPaymentStatus || repair.setOrderStatus) {
        await tx.order.update({
          where: { id: repair.orderId },
          data: {
            ...(repair.setPaymentStatus ? { paymentStatus: repair.setPaymentStatus } : {}),
            ...(repair.setOrderStatus ? { status: repair.setOrderStatus } : {}),
          },
        });
      }

      if (repair.setKitchenStatus) {
        await tx.kitchenOrder.update({
          where: { id: repair.kitchenOrderId },
          data: {
            status: repair.setKitchenStatus,
            ...(repair.setKitchenStatus === 'COMPLETED'
              ? { completedAt: new Date() }
              : {}),
          },
        });
      }

      if (repair.setItemStatus) {
        await tx.orderItem.updateMany({
          where: { orderId: repair.orderId },
          data: { status: repair.setItemStatus },
        });
      }

      if (repair.setTableStatus && repair.tableId) {
        await tx.table.update({
          where: { id: repair.tableId },
          data: { status: repair.setTableStatus },
        });
      }
    });
  }

  console.log('');
  console.log(`Reparaciones aplicadas: ${repairs.length}`);
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
