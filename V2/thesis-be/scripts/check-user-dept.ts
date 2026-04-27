import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function check() {
  const admin = await prisma.user.findFirst({
    where: { email: 'admin@university.edu.vn' }
  });
  
  const topicsDept = await prisma.topic.groupBy({
    by: ['departmentId'],
    _count: { id: true }
  });

  console.log('--- User & Topic Dept Check ---');
  console.log('User Admin Email:', admin?.email);
  console.log('User Admin DeptId:', admin?.departmentId || 'GLOBAL/ADMIN');
  console.log('Phân bổ đề tài theo DepartmentId:', topicsDept);
}

check().catch(console.error).finally(() => prisma.$disconnect());
