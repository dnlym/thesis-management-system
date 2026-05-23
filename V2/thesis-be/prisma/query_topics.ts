import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const targetTopics = [
    {
      id: "7af77eda-877f-47fe-bb49-19d544478fc0",
      title: "Nghiên cứu các kỹ thuật bảo mật web..."
    },
    {
      id: "4b89def6-d1c8-4f3c-a921-adff8af610d8",
      title: "Xây dựng hệ thống điểm danh sinh viên tự động..."
    }
  ];

  for (const target of targetTopics) {
    console.log(`\n=== Resetting topic: "${target.title}" ===`);
    console.log(`ID: ${target.id}`);

    // 1. Reset topic status & progress stage
    const updatedTopic = await prisma.topic.update({
      where: { id: target.id },
      data: {
        status: 'REGISTERED',
        progress_stage: 'REVIEWING',
      }
    });
    console.log(`✅ Topic updated -> status: ${updatedTopic.status}, progress_stage: ${updatedTopic.progress_stage}`);

    // 2. Reset student_progress_status in registrations back to HAS_TOPIC
    const updatedRegs = await prisma.topicRegistration.updateMany({
      where: {
        topic_id: target.id,
        status: 'CONFIRMED',
      },
      data: {
        student_progress_status: 'HAS_TOPIC',
      }
    });
    console.log(`✅ Updated ${updatedRegs.count} registration(s) -> student_progress_status: HAS_TOPIC`);
  }

  console.log('\n=== Done! ===');
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
