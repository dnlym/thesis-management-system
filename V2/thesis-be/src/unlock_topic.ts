import { PrismaClient, TopicStatus, ProgressStage } from '@prisma/client';
import dayjs from 'dayjs';

const prisma = new PrismaClient();

async function main() {
  const topicTitle = 'đề tài test hệ thống lần 2';
  
  // 1. Find the topic
  const topic = await prisma.topic.findFirst({
    where: { title: { contains: topicTitle } },
    include: { semester: true }
  });

  if (!topic) {
    console.error('Topic not found');
    return;
  }

  console.log(`Found topic: ${topic.title} (${topic.id})`);

  // 2. Unlock FinalScores
  const unlockScores = await prisma.finalScore.updateMany({
    where: { topic_id: topic.id },
    data: {
      finalized: false,
      finalized_by: null,
      finalized_at: null
    }
  });
  console.log(`Unlocked ${unlockScores.count} FinalScore records`);

  // 3. Revert Topic Status
  await prisma.topic.update({
    where: { id: topic.id },
    data: {
      status: TopicStatus.REGISTERED, // Revert to registered so it's not "FINALIZED"
      progress_stage: ProgressStage.DEFENDING, // Set back to defending stage
      is_locked: false
    }
  });
  console.log(`Reverted topic status and stage`);

  // 4. Extend Semester Deadlines (to ensure we are in DEFENSE phase)
  const newDeadline = dayjs().add(7, 'day').toDate();
  await prisma.semester.update({
    where: { id: topic.semester_id },
    data: {
      defense_end: newDeadline,
      council_grading_deadline: newDeadline,
      end_date: newDeadline
    }
  });
  console.log(`Extended semester deadlines to ${newDeadline.toISOString()}`);

  // 5. Update TopicRegistration status if needed
  await prisma.topicRegistration.updateMany({
    where: { topic_id: topic.id },
    data: {
      student_progress_status: 'DEFENSE_SCHEDULED' // Or another appropriate status
    }
  });
  console.log(`Updated registration progress status`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
