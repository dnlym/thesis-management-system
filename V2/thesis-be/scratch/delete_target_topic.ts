import { PrismaClient } from '@prisma/client';
import { GradingService } from '../src/services/grading.service';

const prisma = new PrismaClient();

async function main() {
  console.log('=== Searching for topic "G1-IS028" ===');
  
  const topic = await prisma.topic.findFirst({
    where: {
      OR: [
        { code: 'G1-IS028' },
        { code: 'IS028' },
        { title: { contains: 'G1-IS028' } },
        { title: { contains: 'IS028' } },
      ]
    },
    include: {
      groups: true,
      registrations: {
        include: {
          student: true
        }
      },
      assignments: true
    }
  });

  if (!topic) {
    console.log('Topic "G1-IS028" or "IS028" not found in the database.');
    return;
  }

  console.log('\nFound Topic to delete:');
  console.log(`- ID: ${topic.id}`);
  console.log(`- Title: ${topic.title}`);
  console.log(`- Code: ${topic.code}`);
  console.log(`- Status: ${topic.status}`);
  console.log(`- Associated Groups: ${topic.groups.map(g => `${g.name} (${g.id})`).join(', ') || 'None'}`);
  console.log(`- Registered Students: ${topic.registrations.map(r => `${r.student?.full_name} (${r.student?.student_code})`).join(', ') || 'None'}`);

  const topicId = topic.id;
  const groupIds = topic.groups.map(g => g.id);

  console.log('\n=== Starting Deletion Transaction ===');
  
  await prisma.$transaction(async (tx) => {
    // 1. Delete Defense Schedules
    const deletedSchedules = await tx.defenseSchedule.deleteMany({
      where: {
        OR: [
          { topic_id: topicId },
          { group_id: { in: groupIds } }
        ]
      }
    });
    console.log(`- Deleted ${deletedSchedules.count} Defense Schedule records.`);

    // 2. Delete Extra Point Requests
    const deletedExtraPoints = await tx.extraPointRequest.deleteMany({
      where: { topic_id: topicId }
    });
    console.log(`- Deleted ${deletedExtraPoints.count} ExtraPointRequest records.`);

    // 3. Delete Grade Change Requests
    const deletedGradeChangeRequests = await tx.gradeChangeRequest.deleteMany({
      where: { topic_id: topicId }
    });
    console.log(`- Deleted ${deletedGradeChangeRequests.count} GradeChangeRequest records.`);

    // 4. Delete Grade History
    const deletedGradeHistory = await tx.gradeHistory.deleteMany({
      where: { topic_id: topicId }
    });
    console.log(`- Deleted ${deletedGradeHistory.count} GradeHistory records.`);

    // 5. Delete Grades
    const deletedGrades = await tx.grade.deleteMany({
      where: { topic_id: topicId }
    });
    console.log(`- Deleted ${deletedGrades.count} Grade records.`);

    // 6. Delete Assignments
    const deletedAssignments = await tx.assignment.deleteMany({
      where: { topic_id: topicId }
    });
    console.log(`- Deleted ${deletedAssignments.count} Assignment records.`);

    // 7. Delete Final Scores
    const deletedFinalScores = await tx.finalScore.deleteMany({
      where: { topic_id: topicId }
    });
    console.log(`- Deleted ${deletedFinalScores.count} FinalScore records.`);

    // 8. Delete Group Invites
    const deletedGroupInvites = await tx.groupInvite.deleteMany({
      where: { topic_id: topicId }
    });
    console.log(`- Deleted ${deletedGroupInvites.count} GroupInvite records.`);

    // 9. Delete Topic Registrations
    const deletedRegistrations = await tx.topicRegistration.deleteMany({
      where: { topic_id: topicId }
    });
    console.log(`- Deleted ${deletedRegistrations.count} TopicRegistration records.`);

    // 10. Delete Topic Versions
    const deletedVersions = await tx.topicVersion.deleteMany({
      where: { topic_id: topicId }
    });
    console.log(`- Deleted ${deletedVersions.count} TopicVersion records.`);

    // 11. Delete Group Members
    if (groupIds.length > 0) {
      const deletedGroupMembers = await tx.groupMember.deleteMany({
        where: { group_id: { in: groupIds } }
      });
      console.log(`- Deleted ${deletedGroupMembers.count} GroupMember records.`);

      // 12. Delete Groups
      const deletedGroups = await tx.group.deleteMany({
        where: { id: { in: groupIds } }
      });
      console.log(`- Deleted ${deletedGroups.count} Group records.`);
    }

    // 13. Delete Topic
    const deletedTopic = await tx.topic.delete({
      where: { id: topicId }
    });
    console.log(`- Deleted Topic: "${deletedTopic.title}" (ID: ${deletedTopic.id})`);
  });

  // Clear grading caches
  GradingService.clearGradeSummaryCache();
  console.log('\n✅ Deletion completed successfully! Caches cleared.');
}

main()
  .catch(e => {
    console.error('\n❌ Deletion failed:', e);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
