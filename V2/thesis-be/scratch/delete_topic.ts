import { PrismaClient } from '@prisma/client';
import { GradingService } from '../src/services/grading.service';

const prisma = new PrismaClient();

async function main() {
  const topicId = '6c1391b0-e675-4c2c-8aa4-e8aa894470d3';
  const groupId = 'ba0a0cd3-98ab-4b9a-b00c-15a8d67ac8ed';

  console.log('Starting deletion of Topic, Group, and all related references for:');
  console.log(`Topic ID: ${topicId}`);
  console.log(`Group ID: ${groupId}`);

  // Delete records in order to avoid foreign key violations
  await prisma.$transaction(async (tx) => {
    // 1. Delete Grades
    const deletedGrades = await tx.grade.deleteMany({
      where: { topic_id: topicId }
    });
    console.log(`Deleted ${deletedGrades.count} Grade records.`);

    // 2. Delete Assignments
    const deletedAssignments = await tx.assignment.deleteMany({
      where: { topic_id: topicId }
    });
    console.log(`Deleted ${deletedAssignments.count} Assignment records.`);

    // 3. Delete Final Score
    const deletedFinalScores = await tx.finalScore.deleteMany({
      where: { topic_id: topicId }
    });
    console.log(`Deleted ${deletedFinalScores.count} FinalScore records.`);

    // 4. Delete Topic Registrations
    const deletedRegistrations = await tx.topicRegistration.deleteMany({
      where: { topic_id: topicId }
    });
    console.log(`Deleted ${deletedRegistrations.count} TopicRegistration records.`);

    // 5. Delete Group
    const deletedGroup = await tx.group.delete({
      where: { id: groupId }
    });
    console.log(`Deleted Group: ${deletedGroup.name} (${deletedGroup.id})`);

    // 6. Delete Topic
    const deletedTopic = await tx.topic.delete({
      where: { id: topicId }
    });
    console.log(`Deleted Topic: ${deletedTopic.title} (${deletedTopic.id})`);
  });

  // Clear caches
  GradingService.clearGradeSummaryCache();
  console.log('✅ Deletion completed successfully! Caches cleared.');
}

main()
  .catch(e => {
    console.error('❌ Deletion failed:', e);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
