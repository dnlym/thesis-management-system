import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('=== Searching for lecturer "Phạm Thị Xuân Hiền" ===');
  const lecturer = await prisma.user.findFirst({
    where: {
      full_name: {
        contains: 'Phạm Thị Xuân Hiền',
      },
    },
  });

  if (!lecturer) {
    console.log('Lecturer "Phạm Thị Xuân Hiền" not found in the database!');
    return;
  }

  console.log(`Found Lecturer: ${lecturer.full_name} (ID: ${lecturer.id}, Email: ${lecturer.email})\n`);

  console.log('=== Checking topics where she is the Supervisor (Giảng viên hướng dẫn) ===');
  const supervisorTopics = await prisma.topic.findMany({
    where: {
      supervisor_id: lecturer.id,
    },
    include: {
      registrations: {
        include: {
          student: true,
        },
      },
      grades: {
        include: {
          grader: true,
          criterion: true,
        },
      },
      assignments: {
        include: {
          reviewer: true,
        },
      },
    },
  });

  console.log(`Found ${supervisorTopics.length} topics supervised by her:`);
  for (const topic of supervisorTopics) {
    console.log(`\n------------------------------------------------------------`);
    console.log(`ID: ${topic.id}`);
    console.log(`Title: ${topic.title}`);
    console.log(`Code: ${topic.code}`);
    console.log(`Status: ${topic.status}`);
    console.log(`Progress Stage: ${topic.progress_stage}`);
    console.log(`Eligible for Defense: ${topic.is_eligible_for_defense}`);
    console.log(`Current Students: ${topic.current_students}`);

    console.log('\nRegistered Students & Midterm Status:');
    if (topic.registrations.length === 0) {
      console.log('  (None)');
    }
    for (const r of topic.registrations) {
      console.log(`  - ${r.student?.full_name} (${r.student?.student_code})`);
      console.log(`    Midterm status: ${r.midterm_status || 'N/A'}`);
      console.log(`    Progress status: ${r.student_progress_status || 'N/A'}`);
    }

    console.log('\nAssignments (Reviewers):');
    if (topic.assignments.length === 0) {
      console.log('  (None)');
    }
    for (const a of topic.assignments) {
      console.log(`  - Reviewer: ${a.reviewer?.full_name} (Order: ${a.reviewer_order || 'N/A'}, Type: ${a.assignment_type})`);
    }

    console.log('\nGrades Recorded:');
    if (topic.grades.length === 0) {
      console.log('  (None)');
    } else {
      // Group grades by student
      const studentGradesMap: Record<string, any[]> = {};
      for (const g of topic.grades) {
        const studentName = g.student_id ? (topic.registrations.find(r => r.student_id === g.student_id)?.student?.full_name || g.student_id) : 'Unknown';
        if (!studentGradesMap[studentName]) {
          studentGradesMap[studentName] = [];
        }
        studentGradesMap[studentName].push(g);
      }

      for (const [studentName, grades] of Object.entries(studentGradesMap)) {
        console.log(`  * Student: ${studentName}`);
        for (const g of grades) {
          console.log(`    - Rater: ${g.grader?.full_name} (${g.rater_role}) | Criterion: ${g.criterion?.name} | Score: ${g.score} | Comment: ${g.comments || ''}`);
        }
      }
    }
  }

  console.log('\n=== Checking topics where she is assigned as a Reviewer (Giảng viên phản biện) ===');
  const reviewerAssignments = await prisma.assignment.findMany({
    where: {
      reviewer_id: lecturer.id,
      assignment_type: 'REVIEWER',
    },
    include: {
      topic: {
        include: {
          supervisor: true,
          registrations: {
            include: {
              student: true,
            },
          },
          grades: {
            include: {
              grader: true,
              criterion: true,
            },
          },
        },
      },
    },
  });

  console.log(`Found ${reviewerAssignments.length} reviewer assignments:`);
  for (const assignment of reviewerAssignments) {
    const topic = assignment.topic;
    if (!topic) continue;
    console.log(`\n------------------------------------------------------------`);
    console.log(`ID: ${topic.id}`);
    console.log(`Title: ${topic.title}`);
    console.log(`Supervisor: ${topic.supervisor?.full_name}`);
    console.log(`Status: ${topic.status}`);
    console.log(`Progress Stage: ${topic.progress_stage}`);

    console.log('\nRegistered Students:');
    for (const r of topic.registrations) {
      console.log(`  - ${r.student?.full_name} (${r.student?.student_code}) | Midterm: ${r.midterm_status || 'N/A'}`);
    }

    console.log('\nGrades Recorded:');
    if (topic.grades.length === 0) {
      console.log('  (None)');
    } else {
      const studentGradesMap: Record<string, any[]> = {};
      for (const g of topic.grades) {
        const studentName = g.student_id ? (topic.registrations.find(r => r.student_id === g.student_id)?.student?.full_name || g.student_id) : 'Unknown';
        if (!studentGradesMap[studentName]) {
          studentGradesMap[studentName] = [];
        }
        studentGradesMap[studentName].push(g);
      }

      for (const [studentName, grades] of Object.entries(studentGradesMap)) {
        console.log(`  * Student: ${studentName}`);
        for (const g of grades) {
          console.log(`    - Rater: ${g.grader?.full_name} (${g.rater_role}) | Criterion: ${g.criterion?.name} | Score: ${g.score} | Comment: ${g.comments || ''}`);
        }
      }
    }
  }
}

main()
  .catch(e => {
    console.error(e);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
