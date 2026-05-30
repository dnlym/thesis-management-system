import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const codes = ['IS029', 'IS030'];
  console.log(`Searching for topics with codes: ${codes.join(', ')}...`);

  const topics = await prisma.topic.findMany({
    where: {
      code: { in: codes }
    },
    include: {
      registrations: true,
      groups: true,
      assignments: true
    }
  });

  if (topics.length === 0) {
    console.log('No topics found with these codes.');
    return;
  }

  console.log(`Found ${topics.length} topics:`);
  for (const topic of topics) {
    console.log(`- ID: ${topic.id}, Code: ${topic.code}, Title: "${topic.title}"`);
    console.log(`  Registrations: ${topic.registrations.length}`);
    console.log(`  Groups: ${topic.groups.length}`);
    console.log(`  Assignments: ${topic.assignments.length}`);
  }

  const topicIds = topics.map(t => t.id);

  console.log('\nStarting deletion of related records inside transaction...');
  await prisma.$transaction(async (tx) => {
    // 1. Delete GradeChangeRequest
    const gcr = await tx.gradeChangeRequest.deleteMany({
      where: { topic_id: { in: topicIds } }
    });
    console.log(`Deleted ${gcr.count} GradeChangeRequests.`);

    // 2. Delete GradeHistory
    const gh = await tx.gradeHistory.deleteMany({
      where: { topic_id: { in: topicIds } }
    });
    console.log(`Deleted ${gh.count} GradeHistories.`);

    // 3. Delete Grade
    const g = await tx.grade.deleteMany({
      where: { topic_id: { in: topicIds } }
    });
    console.log(`Deleted ${g.count} Grades.`);

    // 4. Delete FinalScore
    const fs = await tx.finalScore.deleteMany({
      where: { topic_id: { in: topicIds } }
    });
    console.log(`Deleted ${fs.count} FinalScores.`);

    // 5. Delete ExtraPointRequest
    const epr = await tx.extraPointRequest.deleteMany({
      where: { topic_id: { in: topicIds } }
    });
    console.log(`Deleted ${epr.count} ExtraPointRequests.`);

    // 6. Delete DefenseSchedule
    const ds = await tx.defenseSchedule.deleteMany({
      where: { topic_id: { in: topicIds } }
    });
    console.log(`Deleted ${ds.count} DefenseSchedules.`);

    // 7. Delete Assignment
    const a = await tx.assignment.deleteMany({
      where: { topic_id: { in: topicIds } }
    });
    console.log(`Deleted ${a.count} Assignments.`);

    // 8. Delete GroupInvite
    const gi = await tx.groupInvite.deleteMany({
      where: { topic_id: { in: topicIds } }
    });
    console.log(`Deleted ${gi.count} GroupInvites.`);

    // 9. Delete TopicRegistration
    const tr = await tx.topicRegistration.deleteMany({
      where: { topic_id: { in: topicIds } }
    });
    console.log(`Deleted ${tr.count} TopicRegistrations.`);

    // 10. Delete TopicVersion
    const tv = await tx.topicVersion.deleteMany({
      where: { topic_id: { in: topicIds } }
    });
    console.log(`Deleted ${tv.count} TopicVersions.`);

    // 11. Delete GroupMembers belonging to groups associated with these topics
    const groups = await tx.group.findMany({
      where: { topic_id: { in: topicIds } }
    });
    const groupIds = groups.map(grp => grp.id);
    if (groupIds.length > 0) {
      const gm = await tx.groupMember.deleteMany({
        where: { group_id: { in: groupIds } }
      });
      console.log(`Deleted ${gm.count} GroupMembers.`);
      
      const grpDelete = await tx.group.deleteMany({
        where: { id: { in: groupIds } }
      });
      console.log(`Deleted ${grpDelete.count} Groups.`);
    }

    // 12. Delete Topic itself
    const tDelete = await tx.topic.deleteMany({
      where: { id: { in: topicIds } }
    });
    console.log(`Deleted ${tDelete.count} Topics.`);
  });

  console.log('\nDeletion completed successfully!');
}

main()
  .catch(err => {
    console.error('Error during execution:', err);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
