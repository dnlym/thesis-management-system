import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkData() {
  const topics = await prisma.topic.findMany({
    include: {
      registrations: {
        include: {
          student: true
        }
      }
    },
    take: 10
  });

  console.log('--- Data Audit ---');
  topics.forEach(t => {
    console.log(`Topic: ${t.title} (${t.id})`);
    console.log(`Registrations Count: ${t.registrations.length}`);
    t.registrations.forEach(r => {
      console.log(`  - Student: ${r.student.full_name} (${r.student.student_code})`);
    });
    console.log('------------------');
  });
}

checkData().catch(console.error).finally(() => prisma.$disconnect());
