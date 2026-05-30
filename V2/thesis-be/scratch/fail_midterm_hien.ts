import { PrismaClient, MidtermStatus, RegistrationStatus, StudentProgressStatus } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const studentCodes = ['21004421', '21078891', '21027161'];
  
  console.log(`=== Setting Midterm status to FAIL for students: ${studentCodes.join(', ')} ===`);
  
  // Find the users
  const users = await prisma.user.findMany({
    where: {
      student_code: {
        in: studentCodes
      }
    }
  });

  if (users.length === 0) {
    console.log('No students found with the provided student codes.');
    return;
  }

  console.log(`Found ${users.length} students in the database.`);

  for (const user of users) {
    console.log(`\nUpdating student: ${user.full_name} (${user.student_code})`);

    // Find active registration for this student
    const registration = await prisma.topicRegistration.findFirst({
      where: {
        student_id: user.id
      },
      include: {
        topic: true
      }
    });

    if (!registration) {
      console.log(`- Active registration not found for student ${user.full_name}. Skipping.`);
      continue;
    }

    console.log(`- Found registration for topic: "${registration.topic.title}"`);

    // Update the registration
    const updated = await prisma.topicRegistration.update({
      where: {
        id: registration.id
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
}

main()
  .catch(e => {
    console.error(e);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
