import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Bắt đầu reset điểm giữa kỳ cho học kỳ hiện tại...');

  // 1. Tìm học kỳ ACTIVE
  const activeSemester = await prisma.semester.findFirst({
    where: { status: 'ACTIVE' }
  });

  if (!activeSemester) {
    console.log('❌ Không tìm thấy học kỳ nào đang ACTIVE');
    return;
  }

  console.log(`Tìm thấy học kỳ ACTIVE: ${activeSemester.name} (ID: ${activeSemester.id})`);

  // 2. Cập nhật tất cả TopicRegistration thuộc các đề tài của học kỳ này
  const result = await prisma.topicRegistration.updateMany({
    where: {
      topic: {
        semester_id: activeSemester.id
      }
    },
    data: {
      midterm_status: null
    }
  });

  console.log(`✅ Đã reset thành công ${result.count} bản ghi đăng ký về trạng thái Chưa đánh giá giữa kỳ!`);
}

main()
  .catch((e) => {
    console.error('Lỗi khi thực thi script:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
