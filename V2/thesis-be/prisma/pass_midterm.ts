import { PrismaClient, MidtermStatus } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('--- Bắt đầu đặc cách ĐẠT GIỮA KỲ cho các đề tài chưa đánh giá ---');

  // Cập nhật tất cả TopicRegistration chưa có đánh giá giữa kỳ (midterm_status là null)
  const result = await prisma.topicRegistration.updateMany({
    where: {
      midterm_status: null
    },
    data: {
      midterm_status: MidtermStatus.PASS,
      midterm_feedback: 'Được đặc cách đạt giữa kỳ.',
      midterm_graded_at: new Date()
    }
  });

  console.log(`=== Đã cập nhật thành công ${result.count} đề tài chưa đánh giá sang trạng thái ĐẠT GIỮA KỲ! ===`);
}

main()
  .catch((e) => {
    console.error('❌ Lỗi khi thực thi script:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
