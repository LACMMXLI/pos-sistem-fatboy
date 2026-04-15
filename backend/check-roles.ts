import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import 'dotenv/config';

async function main() {
  const connectionString = process.env.DATABASE_URL;
  const pool = new Pool({ connectionString });
  const adapter = new PrismaPg(pool as any);
  const prisma = new PrismaClient({ adapter });

  try {
    const roles = await prisma.role.findMany();
    console.log('Current Roles in DB:');
    console.table(roles);
  } catch (error) {
    console.error('Error fetching roles:', error);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main();
