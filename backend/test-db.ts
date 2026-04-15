import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

async function main() {
  const prisma = new PrismaClient();
  try {
    console.log('Probando conexión a base de datos... URL:', process.env.DATABASE_URL);
    const result = await prisma.$queryRaw`SELECT 1 as result`;
    console.log('Conexión exitosa:', result);
  } catch (e) {
    console.error('Error de conexión:', e);
  } finally {
    await prisma.$disconnect();
  }
}

main();
