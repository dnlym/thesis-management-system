import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const topicId = '6c1391b0-e675-4c2c-8aa4-e8aa894470d3';
  const groupId = 'ba0a0cd3-98ab-4b9a-b00c-15a8d67ac8ed';

  console.log('=== Checking Related Table Counts for Topic & Group ===');

  const topicCount = await prisma.topic.count({ where: { id: topicId } });
  const groupCount = await prisma.group.count({ where: { id: groupId } });
  const regCount = await prisma.topicRegistration.count({ where: { topic_id: topicId } });

  // Check grades
  const gradeCount = await prisma.grade.count({ where: { topic_id: topicId } });
  
  // Check assignments
  const assignmentCount = await prisma.assignment.count({ where: { topic_id: topicId } });

  // Check defense schedules
  const defenseCount = await prisma.defenseSchedule.count({ where: { topic_id: topicId } });

  // Check final scores
  const finalScoreCount = await prisma.finalScore.count({ where: { topic_id: topicId } });

  // Check grade histories
  const gradeHistoryCount = await prisma.gradeHistory.count({ where: { topic_id: topicId } });

  // Check grade change requests
  const changeRequestCount = await prisma.gradeChangeRequest.count({ where: { topic_id: topicId } });

  // Check group invites
  const groupInviteCount = await prisma.groupInvite.count({ where: { topic_id: topicId } });

  console.log({
    topicCount,
    groupCount,
    regCount,
    gradeCount,
    assignmentCount,
    defenseCount,
    finalScoreCount,
    gradeHistoryCount,
    changeRequestCount,
    groupInviteCount
  });
}

main()
  .catch(e => {
    console.error(e);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
