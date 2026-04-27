import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function cleanup() {
  console.log('--- Cleaning up old semesters ---');
  
  const oldSemester = await prisma.semester.findUnique({
    where: { code: 'HK2_2023_2024' }
  });

  if (oldSemester) {
    // Delete related data first to avoid FK errors
    // Topics, Groups, etc. are handled by Cascade if defined, 
    // but let's be safe for some relations
    await prisma.topic.deleteMany({ where: { semester_id: oldSemester.id } });
    await prisma.group.deleteMany({ where: { semester_id: oldSemester.id } });
    await prisma.topicRegistration.deleteMany({ where: { semester_id: oldSemester.id } });
    
    await prisma.semester.delete({
      where: { id: oldSemester.id }
    });
    console.log('Xóa thành công Học kỳ 2 năm 2023-2024');
  } else {
    console.log('Không tìm thấy Học kỳ 2 năm 2023-2024');
  }

  // Ensure HK1 2025-2026 is COMPLETED
  await prisma.semester.updateMany({
    where: { code: 'HK1_2025_2026' },
    data: { status: 'COMPLETED' }
  });

  // Ensure HK2 2025-2026 is ACTIVE
  await prisma.semester.updateMany({
    where: { code: 'HK2_2025_2026' },
    data: { status: 'ACTIVE' }
  });

  console.log('Đã cập nhật trạng thái các học kỳ còn lại.');
}

cleanup().catch(console.error).finally(() => prisma.$disconnect());
