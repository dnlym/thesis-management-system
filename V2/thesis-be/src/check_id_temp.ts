import prisma from './config/database';

async function main() {
  const topicId = '7db85761-f678-44d9-a512-3def5703d5ab';
  console.log('Checking registrations for Topic:', topicId);
  
  const regs = await prisma.topicRegistration.findMany({
    where: { topic_id: topicId },
    include: {
      student: { select: { full_name: true, student_code: true, class_name: true } },
    }
  });

  console.log('Total registrations:', regs.length);
  regs.forEach(r => {
    console.log(`Student: ${r.student.full_name}, Code: ${r.student.student_code}, Class: ${r.student.class_name}`);
  });
}

main().catch(console.error).finally(() => prisma.$disconnect());
