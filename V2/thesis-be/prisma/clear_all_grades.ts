import { PrismaClient, StudentProgressStatus } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('--- Bắt đầu xóa dữ liệu điểm trên Database ---');

  // 1. Xóa các bảng liên quan đến điểm
  const deletedGrades = await prisma.grade.deleteMany();
  console.log(`- Đã xóa ${deletedGrades.count} bản ghi điểm chi tiết (Grade).`);

  const deletedHistory = await prisma.gradeHistory.deleteMany();
  console.log(`- Đã xóa ${deletedHistory.count} bản ghi lịch sử sửa điểm (GradeHistory).`);

  const deletedRequests = await prisma.gradeChangeRequest.deleteMany();
  console.log(`- Đã xóa ${deletedRequests.count} bản ghi yêu cầu sửa điểm (GradeChangeRequest).`);

  const deletedFinalScores = await prisma.finalScore.deleteMany();
  console.log(`- Đã xóa ${deletedFinalScores.count} bản ghi điểm tổng kết (FinalScore).`);

  // 2. Reset trạng thái tiến độ sinh viên về HAS_TOPIC để giảng viên có thể chấm lại từ đầu
  const resetProgress = await prisma.topicRegistration.updateMany({
    where: {
      student_progress_status: {
        in: [
          StudentProgressStatus.ADVISOR_GRADED,
          StudentProgressStatus.REVIEWER_GRADED,
          StudentProgressStatus.COUNCIL_GRADED,
          StudentProgressStatus.COMPLETED
        ]
      }
    },
    data: {
      student_progress_status: StudentProgressStatus.HAS_TOPIC
    }
  });
  console.log(`- Đã reset trạng thái tiến độ cho ${resetProgress.count} đăng ký đề tài về HAS_TOPIC.`);

  console.log('=== Đã HOÀN THÀNH xóa toàn bộ dữ liệu điểm thành công! ===');
}

main()
  .catch((e) => {
    console.error('❌ Lỗi khi thực thi script:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
