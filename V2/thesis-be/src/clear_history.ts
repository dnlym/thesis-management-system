import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function clearGradeHistory() {
  try {
    const deleted = await prisma.gradeHistory.deleteMany({});
    console.log(`✅ Đã xóa ${deleted.count} bản ghi lịch sử điểm.`);
  } catch (error) {
    console.error('❌ Lỗi khi dọn dẹp lịch sử:', error);
  } finally {
    await prisma.$disconnect();
  }
}

clearGradeHistory();
