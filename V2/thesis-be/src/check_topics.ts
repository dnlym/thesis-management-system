import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const topics = await prisma.topic.findMany({
    select: {
      id: true,
      title: true,
      current_students: true,
      status: true,
      progress_stage: true,
      registrations: {
        select: {
          id: true,
          status: true,
          midterm_status: true,
          student: {
            select: {
              full_name: true,
              student_code: true
            }
          }
        }
      }
    }
  });

  console.log('--- ALL TOPICS IN DB ---');
  for (const t of topics) {
    console.log(`Title: ${t.title}`);
    console.log(`  ID: ${t.id}`);
    console.log(`  Current Students: ${t.current_students}`);
    console.log(`  Status: ${t.status}`);
    console.log(`  Progress Stage: ${t.progress_stage}`);
    console.log(`  Registrations count: ${t.registrations.length}`);
    for (const reg of t.registrations) {
      console.log(`    Reg ID: ${reg.id}, Status: ${reg.status}, Midterm: ${reg.midterm_status}, Student: ${reg.student?.full_name} (${reg.student?.student_code})`);
    }
  }
}

main()
  .catch((e) => {
    console.error(e);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
