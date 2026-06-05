const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const groupName = 'IS.252.21';
  console.log(`Checking current state for group: ${groupName}`);

  const group = await prisma.group.findFirst({
    where: { name: groupName },
    include: {
      topic: {
        include: {
          grades: {
            include: {
              grader: {
                select: {
                  full_name: true,
                  role: true
                }
              },
              criterion: {
                select: {
                  name: true
                }
              }
            }
          },
          final_scores: {
            include: {
              student: {
                select: {
                  full_name: true,
                  student_code: true
                }
              }
            }
          },
          registrations: {
            include: {
              student: {
                select: {
                  full_name: true,
                  student_code: true
                }
              }
            }
          }
        }
      }
    }
  });

  if (!group) {
    console.log(`No group found with name: ${groupName}`);
    return;
  }

  console.log('\n=========================================');
  console.log(`Group ID: ${group.id}`);
  console.log(`Group Name: ${group.name}`);
  console.log(`Topic ID: ${group.topic_id}`);
  console.log(`Topic Code: ${group.topic?.code}`);
  console.log(`Topic Title: ${group.topic?.title}`);
  console.log(`Topic Status: ${group.topic?.status}`);
  console.log(`Topic Progress Stage: ${group.topic?.progress_stage}`);
  
  console.log('\n--- Registrations ---');
  for (const reg of group.topic.registrations) {
    console.log(`- Student: ${reg.student.full_name} (${reg.student.student_code}), Status: ${reg.status}, Progress: ${reg.student_progress_status}`);
  }

  console.log('\n--- Remaining Grades (Supervisor/Reviewer) ---');
  const nonCommitteeGrades = group.topic.grades.filter(g => 
    !['COMMITTEE', 'COMMITTEE_CHAIR', 'COMMITTEE_SECRETARY', 'COMMITTEE_MEMBER', 'COMMITTEE_MEMBER_1', 'COMMITTEE_MEMBER_2', 'ORAL_COMMITTEE', 'POSTER_COMMITTEE'].includes(g.rater_role)
  );
  console.log(`Total remaining grades count: ${nonCommitteeGrades.length}`);
  const roles = [...new Set(nonCommitteeGrades.map(g => g.rater_role))];
  console.log(`Roles with remaining grades: ${roles.join(', ')}`);

  console.log('\n--- Final Scores ---');
  for (const fs of group.topic.final_scores) {
    console.log(`- Student: ${fs.student.full_name} (${fs.student.student_code})`);
    console.log(`  Supervisor Score: ${fs.supervisor_score}`);
    console.log(`  Reviewer Avg Score: ${fs.reviewer_avg_score}`);
    console.log(`  Committee Score: ${fs.committee_score}`);
    console.log(`  Computed Score: ${fs.computed_score}`);
    console.log(`  Bonus Points: ${fs.extra_points}`);
    console.log(`  Final Score: ${fs.final_score}`);
    console.log(`  Grade Classification: ${fs.grade_classification}`);
    console.log(`  Finalized: ${fs.finalized}`);
  }
  console.log('=========================================');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
