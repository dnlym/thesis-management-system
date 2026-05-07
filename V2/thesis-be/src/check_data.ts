import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkData() {
  const studentCount = await prisma.user.count({ where: { role: 'STUDENT' } });
  const topicCount = await prisma.topic.count();
  const criteriaCount = await prisma.gradingCriterion.count({ where: { active: true } });
  const departmentCount = await prisma.department.count();
  const facultyCount = await prisma.user.count({ where: { role: { in: ['LECTURER', 'HEAD'] } } });

  console.log('--- KẾT QUẢ KIỂM TRA DATA ---');
  console.log(`- Sinh viên: ${studentCount} / 49`);
  console.log(`- Đề tài: ${topicCount}`);
  console.log(`- Tiêu chí LO: ${criteriaCount} (10 tiêu chí x 3 vai trò)`);
  console.log(`- Bộ môn: ${departmentCount}`);
  console.log(`- Giảng viên: ${facultyCount}`);
  console.log('---------------------------');
}

checkData()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
