import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('=== Kiểm tra dữ liệu hiện tại ===\n');

  // Find topic
  const topic = await prisma.topic.findFirst({
    where: {
      title: {
        contains: 'Tìm hiểu và ứng dụng công nghệ mới trong xây dựng hệ thống quản lý rạp chiếu phim',
        mode: 'insensitive'
      }
    },
    include: {
      supervisor: { select: { id: true, full_name: true, email: true } },
      registrations: {
        include: {
          student: { select: { id: true, full_name: true, student_code: true } }
        }
      },
      semester: { select: { id: true, name: true } }
    }
  });

  if (!topic) {
    throw new Error('Không tìm thấy đề tài!');
  }

  console.log(`Topic: ${topic.title}`);
  console.log(`Topic ID: ${topic.id}`);
  console.log(`Semester: ${topic.semester.name} (${topic.semester.id})`);
  console.log(`Current supervisor: ${topic.supervisor.full_name}`);
  console.log(`Status: ${topic.status}`);
  console.log(`Current registrations:`);
  topic.registrations.forEach(r => {
    console.log(`  - ${r.student.full_name} (${r.student.student_code}) | Status: ${r.status} | Midterm: ${r.midterm_status}`);
  });

  // Find Kim Chi
  const kimChi = await prisma.user.findFirst({
    where: { full_name: { contains: 'Kim Chi', mode: 'insensitive' } },
    select: { id: true, full_name: true, email: true, departmentId: true }
  });
  if (!kimChi) throw new Error('Không tìm thấy ThS. Trần Thị Kim Chi!');
  console.log(`\nNew supervisor: ${kimChi.full_name} (${kimChi.id})`);

  // Find students by student code
  const studentCodes = ['21028331', '21083181'];
  const students = await prisma.user.findMany({
    where: { student_code: { in: studentCodes } },
    select: { id: true, full_name: true, student_code: true }
  });
  console.log(`\nStudents found:`);
  students.forEach(s => console.log(`  - ${s.full_name} (${s.student_code}) | ID: ${s.id}`));

  if (students.length !== 2) {
    throw new Error(`Expected 2 students, found ${students.length}. Check student codes!`);
  }

  // ============================================================
  // STEP 1: Update topic supervisor to Kim Chi
  // ============================================================
  console.log('\n=== STEP 1: Cập nhật GVHD ===');
  await prisma.topic.update({
    where: { id: topic.id },
    data: { supervisor_id: kimChi.id }
  });
  console.log(`✅ Supervisor -> ${kimChi.full_name}`);

  // ============================================================
  // STEP 2: Remove existing registrations that are NOT these 2 students
  // ============================================================
  const targetStudentIds = students.map(s => s.id);
  const existingRegStudentIds = topic.registrations.map(r => r.student.id);

  const regsToRemove = topic.registrations.filter(r => !targetStudentIds.includes(r.student.id));
  if (regsToRemove.length > 0) {
    console.log(`\n=== STEP 2: Xóa ${regsToRemove.length} đăng ký không thuộc 2 sinh viên trên ===`);
    for (const reg of regsToRemove) {
      await prisma.topicRegistration.delete({ where: { id: reg.id } });
      console.log(`  ✅ Deleted registration for ${reg.student.full_name} (${reg.student.student_code})`);
    }
    // Update current_students count
    await prisma.topic.update({
      where: { id: topic.id },
      data: { current_students: { decrement: regsToRemove.length } }
    });
  } else {
    console.log('\n=== STEP 2: Không cần xóa đăng ký cũ ===');
  }

  // ============================================================
  // STEP 3: Upsert registrations for target students
  // ============================================================
  console.log('\n=== STEP 3: Đảm bảo 2 sinh viên đã đăng ký đề tài ===');
  let addedCount = 0;
  for (const student of students) {
    const existing = topic.registrations.find(r => r.student.id === student.id);
    if (existing) {
      // Already registered - just make sure status is CONFIRMED and midterm is PASS
      await prisma.topicRegistration.update({
        where: { id: existing.id },
        data: {
          status: 'CONFIRMED',
          midterm_status: 'PASS',
          student_progress_status: 'HAS_TOPIC',
        }
      });
      console.log(`  ✅ Updated existing registration: ${student.full_name} (${student.student_code})`);
    } else {
      // Check if student has any existing registration in this semester
      const existingInSemester = await prisma.topicRegistration.findFirst({
        where: {
          student_id: student.id,
          semester_id: topic.semester_id,
        }
      });

      if (existingInSemester) {
        // Update the existing record to point to new topic
        await prisma.topicRegistration.update({
          where: { id: existingInSemester.id },
          data: {
            topic_id: topic.id,
            status: 'CONFIRMED',
            midterm_status: 'PASS',
            student_progress_status: 'HAS_TOPIC',
          }
        });
        console.log(`  ✅ Moved existing registration to this topic: ${student.full_name} (${student.student_code})`);
      } else {
        // Create new registration
        await prisma.topicRegistration.create({
          data: {
            student_id: student.id,
            topic_id: topic.id,
            semester_id: topic.semester_id,
            status: 'CONFIRMED',
            midterm_status: 'PASS',
            student_progress_status: 'HAS_TOPIC',
            confirmed_at: new Date(),
          }
        });
        addedCount++;
        console.log(`  ✅ Created new registration: ${student.full_name} (${student.student_code})`);
      }
    }
  }

  // ============================================================
  // STEP 4: Update current_students count on topic
  // ============================================================
  const finalCount = await prisma.topicRegistration.count({
    where: { topic_id: topic.id, status: 'CONFIRMED' }
  });
  await prisma.topic.update({
    where: { id: topic.id },
    data: { current_students: finalCount }
  });
  console.log(`\n=== STEP 4: Cập nhật current_students = ${finalCount} ===`);

  // ============================================================
  // Final check
  // ============================================================
  const finalTopic = await prisma.topic.findUnique({
    where: { id: topic.id },
    include: {
      supervisor: { select: { full_name: true, email: true } },
      registrations: {
        include: {
          student: { select: { full_name: true, student_code: true } }
        }
      }
    }
  });

  console.log('\n=== KẾT QUẢ CUỐI ===');
  console.log(`Topic: ${finalTopic!.title}`);
  console.log(`GVHD: ${finalTopic!.supervisor.full_name} (${finalTopic!.supervisor.email})`);
  console.log(`Status: ${finalTopic!.status} | Progress: ${finalTopic!.progress_stage}`);
  console.log(`current_students: ${finalTopic!.current_students}`);
  console.log(`Registrations (${finalTopic!.registrations.length}):`);
  finalTopic!.registrations.forEach(r => {
    console.log(`  - ${r.student.full_name} (${r.student.student_code}) | Status: ${r.status} | Midterm: ${r.midterm_status}`);
  });
}

main()
  .catch(e => {
    console.error('❌ Error:', e.message);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
