const fs = require('fs');
const { execSync } = require('child_process');

try {
    const envContent = fs.readFileSync('.env', 'utf-8');
    const dbUrlLine = envContent.split('\n').find(line => line.startsWith('DATABASE_URL'));
    const dbUrl = dbUrlLine.split('=')[1].replace(/"/g, '').trim();
    process.env.DATABASE_URL = dbUrl;
    
    // Hardcoded Prisma configuration to avoid constructor error
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient({
      datasourceUrl: dbUrl,
    });
    
    async function main() {
        const shifts = await prisma.cashShift.findMany({
            where: { status: 'OPEN' },
            include: { user: true }
        });
        console.log('--- OPEN SHIFTS ---');
        shifts.forEach(s => {
            console.log(`ID: ${s.id} | Opened: ${s.openedAt} | User: ${s.user.name} | Status: ${s.status}`);
        });
        process.exit(0);
    }
    main();
} catch (e) {
    console.error(e);
    process.exit(1);
}
