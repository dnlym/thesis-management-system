import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function check() {
  const totalTopics = await prisma.topic.count();
  const activeSemester = await prisma.semester.findFirst({
    where: { status: 'ACTIVE' },
    orderBy: { start_date: 'desc' }
  });
  
  const topicsInActiveSemester = activeSemester 
    ? await prisma.topic.count({ where: { semester_id: activeSemester.id } })
    : 0;

  console.log('--- Database Check ---');
  console.log('Tổng số đề tài trong hệ thống:', totalTopics);
  console.log('Học kỳ đang Active:', activeSemester?.name || 'Không có');
  console.log('Số đề tài trong học kỳ Active:', topicsInActiveSemester);
  
  if (activeSemester) {
    const pending = await prisma.topic.count({
      where: { semester_id: activeSemester.id, status: 'PENDING_APPROVAL' }
    });
    console.log('Số đề tài chờ duyệt (Học kỳ Active):', pending);
  }
}

check().catch(console.error).finally(() => prisma.$disconnect());
