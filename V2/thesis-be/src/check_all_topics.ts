import prisma from './config/database';

async function main() {
  console.log('--- SCANNING ALL TOPICS & REGISTRATIONS ---');
  
  const topics = await prisma.topic.findMany({
    include: {
      registrations: {
        include: {
          student: { select: { full_name: true, student_code: true, class_name: true } },
        }
      }
    }
  });

  topics.forEach(t => {
    if (t.registrations.length > 0) {
        console.log(`Topic: "${t.title}" (ID: ${t.id})`);
        t.registrations.forEach(r => {
            console.log(`  - Student: ${r.student.full_name}, Code: ${r.student.student_code}, Class: ${r.student.class_name}`);
        });
    }
  });
}

main().catch(console.error).finally(() => prisma.$disconnect());
