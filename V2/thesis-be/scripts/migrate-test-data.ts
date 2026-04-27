import { PrismaClient, SemesterStatus } from '@prisma/client';
const prisma = new PrismaClient();

async function migrate() {
  console.log('--- Starting Data Migration for Testing ---');

  // 1. Find IS Department (Hệ thống thông tin)
  const isDept = await prisma.department.findFirst({
    where: { name: { contains: 'Hệ thống thông tin' } }
  });

  if (!isDept) {
    console.error('Không tìm thấy bộ môn Hệ thống thông tin!');
    return;
  }
  console.log(`Found IS Dept: ${isDept.name} (${isDept.id})`);

  // 2. Setup Semesters
  const hk1 = await prisma.semester.upsert({
    where: { code: 'HK1_2025_2026' },
    update: { status: SemesterStatus.COMPLETED, name: 'Học kỳ 1 2025-2026' },
    create: {
      code: 'HK1_2025_2026',
      name: 'Học kỳ 1 2025-2026',
      status: SemesterStatus.COMPLETED,
      start_date: new Date('2025-08-15'),
      end_date: new Date('2025-12-31'),
      proposal_deadline: new Date('2025-09-15'),
      thesis_deadline: new Date('2025-12-15')
    }
  });

  const hk2 = await prisma.semester.upsert({
    where: { code: 'HK2_2025_2026' },
    update: { status: SemesterStatus.ACTIVE, name: 'Học kỳ 2 2025-2026' },
    create: {
      code: 'HK2_2025_2026',
      name: 'Học kỳ 2 2025-2026',
      status: SemesterStatus.ACTIVE,
      start_date: new Date('2026-01-15'),
      end_date: new Date('2026-06-30'),
      proposal_deadline: new Date('2026-04-30'),
      thesis_deadline: new Date('2026-05-30'),
      defense_start: new Date('2026-06-15'),
      defense_end: new Date('2026-06-25')
    }
  });

  // 3. Migrate Topics
  // IS topics -> HK2 (Active)
  const isUpdated = await prisma.topic.updateMany({
    where: { departmentId: isDept.id },
    data: { semester_id: hk2.id }
  });

  // Non-IS topics -> HK1 (Completed)
  const othersUpdated = await prisma.topic.updateMany({
    where: { departmentId: { not: isDept.id } },
    data: { semester_id: hk1.id }
  });

  console.log(`Migration Complete:`);
  console.log(`- ${isUpdated.count} topics moved to HK2 (Active) - Hệ thống thông tin`);
  console.log(`- ${othersUpdated.count} topics moved to HK1 (Completed) - Các bộ môn khác`);
}

migrate().catch(console.error).finally(() => prisma.$disconnect());
