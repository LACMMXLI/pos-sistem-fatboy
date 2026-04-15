#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const rootDir = process.cwd();
const backupsDir = path.join(rootDir, 'backups');
const resultPath = path.join(rootDir, 'productos', 'purge-test-catalog-result.json');

const testProductIds = [1, 3];
const testCategoryIds = [1];

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function loadEnv() {
  const dotenv = require(path.join(rootDir, 'backend', 'node_modules', 'dotenv'));
  dotenv.config({ path: path.join(rootDir, 'backend', '.env') });
}

function nowStamp() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

async function main() {
  loadEnv();
  ensureDir(backupsDir);

  const { Client } = require(path.join(rootDir, 'backend', 'node_modules', 'pg'));
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  const result = {
    generatedAt: new Date().toISOString(),
    testProductIds,
    testCategoryIds,
    orderIds: [],
    backupPath: null,
    deleted: {},
  };

  try {
    const orderIds = (
      await client.query(
        'select distinct order_id from order_items where product_id = any($1::int[]) order by order_id',
        [testProductIds],
      )
    ).rows.map((row) => row.order_id);

    result.orderIds = orderIds;

    const backup = {
      orders: [],
      orderItems: [],
      orderItemModifiers: [],
      kitchenOrders: [],
      payments: [],
      loyaltyTransactions: [],
      products: [],
      categories: [],
    };

    if (orderIds.length > 0) {
      backup.orders = (
        await client.query('select * from orders where id = any($1::int[]) order by id', [orderIds])
      ).rows;
      backup.orderItems = (
        await client.query('select * from order_items where order_id = any($1::int[]) order by id', [orderIds])
      ).rows;
      const orderItemIds = backup.orderItems.map((row) => row.id);
      if (orderItemIds.length > 0) {
        backup.orderItemModifiers = (
          await client.query(
            'select * from order_item_modifiers where order_item_id = any($1::int[]) order by id',
            [orderItemIds],
          )
        ).rows;
      }
      backup.kitchenOrders = (
        await client.query('select * from kitchen_orders where order_id = any($1::int[]) order by id', [orderIds])
      ).rows;
      backup.payments = (
        await client.query('select * from payments where order_id = any($1::int[]) order by id', [orderIds])
      ).rows;
      backup.loyaltyTransactions = (
        await client.query(
          'select * from loyalty_transactions where order_id = any($1::int[]) order by id',
          [orderIds],
        )
      ).rows;
    }

    backup.products = (
      await client.query('select * from products where id = any($1::int[]) order by id', [testProductIds])
    ).rows;
    backup.categories = (
      await client.query('select * from categories where id = any($1::int[]) order by id', [testCategoryIds])
    ).rows;

    const backupPath = path.join(backupsDir, `purge-test-catalog-backup-${nowStamp()}.json`);
    fs.writeFileSync(backupPath, JSON.stringify(backup, null, 2));
    result.backupPath = backupPath;

    await client.query('BEGIN');

    if (orderIds.length > 0) {
      result.deleted.loyaltyTransactions = (
        await client.query('delete from loyalty_transactions where order_id = any($1::int[])', [orderIds])
      ).rowCount;
      result.deleted.payments = (
        await client.query('delete from payments where order_id = any($1::int[])', [orderIds])
      ).rowCount;
      result.deleted.kitchenOrders = (
        await client.query('delete from kitchen_orders where order_id = any($1::int[])', [orderIds])
      ).rowCount;

      const orderItemIds = (
        await client.query('select id from order_items where order_id = any($1::int[])', [orderIds])
      ).rows.map((row) => row.id);

      result.deleted.orderItemModifiers = orderItemIds.length
        ? (
            await client.query('delete from order_item_modifiers where order_item_id = any($1::int[])', [
              orderItemIds,
            ])
          ).rowCount
        : 0;

      result.deleted.orderItems = (
        await client.query('delete from order_items where order_id = any($1::int[])', [orderIds])
      ).rowCount;
      result.deleted.orders = (
        await client.query('delete from orders where id = any($1::int[])', [orderIds])
      ).rowCount;
    } else {
      result.deleted.loyaltyTransactions = 0;
      result.deleted.payments = 0;
      result.deleted.kitchenOrders = 0;
      result.deleted.orderItemModifiers = 0;
      result.deleted.orderItems = 0;
      result.deleted.orders = 0;
    }

    result.deleted.products = (
      await client.query('delete from products where id = any($1::int[])', [testProductIds])
    ).rowCount;

    const remainingInCategories = (
      await client.query(
        'select category_id, count(*)::int as count from products where category_id = any($1::int[]) group by category_id',
        [testCategoryIds],
      )
    ).rows;
    const emptyCategoryIds = testCategoryIds.filter(
      (id) => !remainingInCategories.find((row) => row.category_id === id),
    );

    result.deleted.categories = emptyCategoryIds.length
      ? (await client.query('delete from categories where id = any($1::int[])', [emptyCategoryIds])).rowCount
      : 0;

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    await client.end();
  }

  fs.writeFileSync(resultPath, JSON.stringify(result, null, 2));
  console.log(`Resultado: ${resultPath}`);
  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
