import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function check() {
  const semesters = await prisma.semester.findMany({
    orderBy: { start_date: 'desc' }
  });
  
  console.log('--- All Semesters ---');
  semesters.forEach(s => {
    console.log(`- ${s.name} (${s.code}): Status=${s.status}, Start=${s.start_date.toISOString()}`);
  });
}

check().catch(console.error).finally(() => prisma.$disconnect());
