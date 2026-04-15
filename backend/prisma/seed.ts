import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as bcrypt from 'bcrypt';
import 'dotenv/config';

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool as any);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('Starting seed...');

  // 1. Create Roles
  const roles = [
    { name: 'ADMIN', description: 'Administrador con acceso total' },
    { name: 'CAJERO', description: 'Personal de caja y pedidos' },
    { name: 'MESERO', description: 'Atención de salón y mesas' },
    { name: 'COCINA', description: 'Visualización y gestión de pedidos en cocina' },
    { name: 'SUPERVISOR', description: 'Supervisión de caja y reportes' },
  ];

  for (const role of roles) {
    await prisma.role.upsert({
      where: { name: role.name },
      update: {},
      create: role,
    });
  }
  console.log('Roles created/verified.');

  // 2. Create Initial Admin User
  const adminRole = await prisma.role.findUnique({ where: { name: 'ADMIN' } });

  if (adminRole) {
    const hashedPassword = await bcrypt.hash('admin123', 10);
    
    await prisma.user.upsert({
      where: { email: 'admin@fatboy.com' },
      update: {},
      create: {
        name: 'Administrador Principal',
        email: 'admin@fatboy.com',
        password: hashedPassword,
        roleId: adminRole.id,
        isActive: true,
      },
    });
    console.log('Admin user created (admin@fatboy.com / admin123).');
  }

  console.log('Seed finished successfully.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
