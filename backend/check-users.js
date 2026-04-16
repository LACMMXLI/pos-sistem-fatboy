require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const users = await prisma.user.findMany({ include: { role: true } });
  console.log(JSON.stringify(users.map(u => ({ 
    id: u.id, 
    name: u.name, 
    role: u.role.name, 
    hasPin: !!u.tabletPin, 
    isActive: u.isActive,
    email: u.email
  })), null, 2));
}
main().catch(console.error).finally(() => prisma.$disconnect());
