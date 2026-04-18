const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  try {
    const areas = await prisma.area.findMany();
    console.log('AREAS_START');
    console.log(JSON.stringify(areas, null, 2));
    console.log('AREAS_END');
  } catch (e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
}
main();
