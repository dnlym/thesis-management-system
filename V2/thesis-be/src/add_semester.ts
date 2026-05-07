import { PrismaClient, SemesterStatus } from '@prisma/client';

const prisma = new PrismaClient();

async function addOldSemester() {
  console.log('📅 Đang tạo Học kỳ 1 2025-2026 (Trạng thái COMPLETED)...');
  
  await prisma.semester.upsert({
    where: { code: 'HK1_2025_2026' },
    update: { status: SemesterStatus.COMPLETED },
    create: {
      code: 'HK1_2025_2026',
      name: 'Học kỳ 1 2025-2026',
      status: SemesterStatus.COMPLETED,
      start_date: new Date('2025-09-01'),
      end_date: new Date('2026-01-15'),
      proposal_deadline: new Date('2025-10-15'),
      thesis_deadline: new Date('2025-12-30'),
    },
  });

  console.log('✅ Đã thêm Học kỳ 1 thành công!');
}

addOldSemester()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
