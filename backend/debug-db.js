const fs = require('fs');
const { execSync } = require('child_process');

try {
    const envContent = fs.readFileSync('.env', 'utf-8');
    const dbUrlLine = envContent.split('\n').find(line => line.startsWith('DATABASE_URL'));
    const dbUrl = dbUrlLine.split('=')[1].replace(/"/g, '').trim();
    process.env.DATABASE_URL = dbUrl;
    
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();
    
    async function main() {
        const users = await prisma.user.findMany({
            include: { role: true }
        });
        console.log('--- USERS IN DATABASE ---');
        users.forEach(u => {
            console.log(`ID: ${u.id} | Name: ${u.name} | Role: ${u.role.name} | hasPIN: ${!!u.tabletPin} | PIN: ${u.tabletPin ? u.tabletPin.substring(0, 10) + '...' : 'NULL'}`);
        });
        process.exit(0);
    }
    main();
} catch (e) {
    console.error(e);
    process.exit(1);
}
