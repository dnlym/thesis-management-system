import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const topics = await prisma.topic.findMany({
    where: {
      status: {
        in: ['UNDER_REVIEW', 'WAITING_FOR_DEFENSE_ASSIGNMENT', 'REGISTERED']
      }
    },
    include: {
      assignments: {
        where: {
          assignment_type: 'REVIEWER'
        }
      },
      grades: {
        where: {
          rater_role: {
            in: ['REVIEWER_1', 'REVIEWER_2', 'REVIEWER_3']
          }
        }
      }
    }
  });

  console.log('--- Topic Status Check ---');
  topics.forEach(t => {
    const reviewerAssignments = t.assignments.filter(a => a.status === 'ACCEPTED' || a.status === 'AUTO_ACCEPTED');
    const reviewersWhoGraded = new Set(t.grades.map(g => g.grader_id));
    
    console.log(`Topic: ${t.title}`);
    console.log(`  ID: ${t.id}`);
    console.log(`  Status: ${t.status}`);
    console.log(`  Reviewer Assignments: ${reviewerAssignments.length}`);
    console.log(`  Reviewers Who Graded: ${reviewersWhoGraded.size}`);
    console.log(`  Eligible for Council: ${reviewerAssignments.length >= 2 && reviewersWhoGraded.size >= reviewerAssignments.length}`);
    console.log('-------------------------');
  });
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect());
