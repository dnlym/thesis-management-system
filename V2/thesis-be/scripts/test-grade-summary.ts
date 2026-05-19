import { PrismaClient } from '@prisma/client';
import { GradingService } from '../src/services/grading.service';

const prisma = new PrismaClient();
const gradingService = new GradingService();

async function main() {
  const activeSemester = await prisma.semester.findFirst({
    where: { status: 'ACTIVE' }
  });
  if (!activeSemester) {
    console.error('No active semester found');
    return;
  }

  const headUser = await prisma.user.findFirst({
    where: { email: 'ts.ngohuudung@iuh.edu.vn' }
  });
  if (!headUser) {
    console.error('No HOD user found');
    return;
  }

  console.log(`Fetching grade summary for HOD: ${headUser.email} in Semester: ${activeSemester.name}`);
  const summary = await gradingService.getGradeSummary(headUser.id, activeSemester.id);
  const topics = summary.allTopics;
  console.log(`Fetched ${topics.length} records.`);
  
  if (topics.length > 0) {
    console.log('Sample record structure:');
    console.log(JSON.stringify(topics[0], null, 2));
    
    console.log('\nChecking students array structure:');
    topics.forEach((item, index) => {
      console.log(`Record ${index + 1}: ${item.title}`);
      item.students.forEach((s: any, sIdx: number) => {
        console.log(`  Student ${sIdx + 1}:`, {
          hasStudent: !!s.student,
          studentKeys: s.student ? Object.keys(s.student) : [],
          hasFinalScore: !!s.finalScore,
          finalScoreKeys: s.finalScore ? Object.keys(s.finalScore) : [],
          studentVal: s.student
        });
      });
    });
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
