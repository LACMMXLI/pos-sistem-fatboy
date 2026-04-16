require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({});
async function run() {
  const users = await prisma.user.findMany({ 
    where: { 
        isActive: true,
        NOT: { tabletPin: null } 
    },
    include: { role: true }
  });
  console.log('Users found:', users.length);
  users.forEach(u => {
    console.log(`ID: ${u.id}, Name: ${u.name}, Role: ${u.role.name}, PIN (hashed): ${u.tabletPin}`);
  });
  process.exit(0);
}
run().catch(e => { console.error(e); process.exit(1); });
