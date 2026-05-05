import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const criteria = await prisma.gradingCriterion.findMany({
        where: { active: true },
        orderBy: { order_index: 'asc' }
    });
    console.log(JSON.stringify(criteria, null, 2));
}

main()
    .catch((e) => { console.error(e); process.exit(1); })
    .finally(async () => { await prisma.$disconnect(); });
