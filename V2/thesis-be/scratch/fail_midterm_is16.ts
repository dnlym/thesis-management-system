import { PrismaClient, MidtermStatus, RegistrationStatus, StudentProgressStatus } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('=== Searching for topic/group matching "G1-IS16" ===');

  // Try finding group first
  let group = await prisma.group.findFirst({
    where: {
      OR: [
        { name: 'G1-IS16' },
        { name: 'G1-IS016' }
      ]
    },
    include: {
      registrations: {
        include: {
          student: true
        }
      },
      topic: true
    }
  });

  let registrationsToFail: any[] = [];
  let topicTitle = '';

  if (group) {
    console.log(`Found Group: ${group.name} (ID: ${group.id})`);
    registrationsToFail = group.registrations;
    topicTitle = group.topic?.title || 'Unknown Topic';
  } else {
    // If group not found by name, search for topic
    console.log('Group not found directly by name. Searching by topic code...');
    const topic = await prisma.topic.findFirst({
      where: {
        OR: [
          { code: 'G1-IS16' },
          { code: 'IS16' },
          { code: 'G1-IS016' },
          { code: 'IS016' }
        ]
      },
      include: {
        registrations: {
          include: {
            student: true
          }
        }
      }
    });

    if (topic) {
      console.log(`Found Topic: ${topic.title} (Code: ${topic.code}, ID: ${topic.id})`);
      registrationsToFail = topic.registrations;
      topicTitle = topic.title;
    }
  }

  if (registrationsToFail.length === 0) {
    console.log('No registrations or students found matching G1-IS16.');
    return;
  }

  console.log(`Found ${registrationsToFail.length} registrations to update.`);
  console.log(`Topic: "${topicTitle}"`);

  for (const reg of registrationsToFail) {
    console.log(`\nUpdating student: ${reg.student?.full_name} (${reg.student?.student_code})`);

    const updated = await prisma.topicRegistration.update({
      where: {
        id: reg.id
      },
      data: {
        midterm_status: MidtermStatus.FAIL,
        status: RegistrationStatus.FAILED,
        student_progress_status: StudentProgressStatus.MIDTERM_FAILED,
        midterm_feedback: 'Không đạt đánh giá giữa kỳ (Hệ thống cập nhật theo yêu cầu).'
      }
    });

    console.log(`- Status updated successfully:`);
    console.log(`  * Midterm Status: ${updated.midterm_status}`);
    console.log(`  * Registration Status: ${updated.status}`);
    console.log(`  * Progress Status: ${updated.student_progress_status}`);
    console.log(`  * Feedback: "${updated.midterm_feedback}"`);
  }

  console.log('\n✅ Process completed successfully!');
}

main()
  .catch(e => {
    console.error(e);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
