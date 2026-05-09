import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fix() {
  try {
    const deleted = await prisma.assignment.delete({
      where: { id: 'b36dd02a-30c2-4c07-8ca8-67c9edea3a18' }
    });
    console.log('✅ Đã xóa bản ghi trùng thành công:', deleted.id);
  } catch (error) {
    console.error('❌ Lỗi hoặc bản ghi không tồn tại:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fix();
