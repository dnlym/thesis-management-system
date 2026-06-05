const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const topicId = '48b4127e-05bf-40c4-8cd3-83a5f00aab3c';
  const groupName = 'IS.252.21';

  console.log(`Starting deletion of committee grades for Topic ID: ${topicId} (Group: ${groupName})`);

  // Define committee rater roles to delete
  const committeeRoles = [
    'COMMITTEE',
    'COMMITTEE_CHAIR',
    'COMMITTEE_SECRETARY',
    'COMMITTEE_MEMBER',
    'COMMITTEE_MEMBER_1',
    'COMMITTEE_MEMBER_2',
    'ORAL_COMMITTEE',
    'POSTER_COMMITTEE'
  ];

  // Run everything in a transaction to ensure database integrity
  const result = await prisma.$transaction(async (tx) => {
    // 1. Delete committee grades
    const deletedGrades = await tx.grade.deleteMany({
      where: {
        topic_id: topicId,
        rater_role: {
          in: committeeRoles
        }
      }
    });

    // 2. Revert Topic Status and Progress Stage
    const updatedTopic = await tx.topic.update({
      where: { id: topicId },
      data: {
        status: 'REGISTERED',
        progress_stage: 'READY_FOR_DEFENSE'
      }
    });

    // 3. Revert TopicRegistration progress status
    const updatedRegistrations = await tx.topicRegistration.updateMany({
      where: { topic_id: topicId },
      data: {
        student_progress_status: 'DEFENSE_SCHEDULED'
      }
    });

    // 4. Reset FinalScores (set committee fields and final finalized fields to null/false)
    const updatedFinalScores = await tx.finalScore.updateMany({
      where: { topic_id: topicId },
      data: {
        committee_score: null,
        computed_score: null,
        final_score: null,
        grade_classification: null,
        finalized: false,
        finalized_by: null,
        finalized_at: null
      }
    });

    return {
      deletedGradesCount: deletedGrades.count,
      topicStatus: updatedTopic.status,
      topicProgressStage: updatedTopic.progress_stage,
      updatedRegistrationsCount: updatedRegistrations.count,
      updatedFinalScoresCount: updatedFinalScores.count
    };
  });

  console.log('\n=========================================');
  console.log('SUCCESSFULLY COMPLETED DATABASE OPERATION:');
  console.log(`- Deleted committee grades count: ${result.deletedGradesCount}`);
  console.log(`- Updated Topic status: ${result.topicStatus}`);
  console.log(`- Updated Topic progress stage: ${result.topicProgressStage}`);
  console.log(`- Updated Topic registrations count: ${result.updatedRegistrationsCount}`);
  console.log(`- Updated Final scores count: ${result.updatedFinalScoresCount}`);
  console.log('=========================================');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
