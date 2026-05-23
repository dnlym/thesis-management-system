import { PrismaClient, StudentProgressStatus } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('--- Bắt đầu reset toàn bộ phân công phản biện và hội đồng ---');

  // 1. Xóa toàn bộ Assignment (cả REVIEWER và COMMITTEE)
  const deletedAssignments = await prisma.assignment.deleteMany();
  console.log(`- Đã xóa ${deletedAssignments.count} bản ghi phân công (Assignment).`);

  // 2. Xóa toàn bộ DefenseSchedule (lịch bảo vệ hội đồng)
  const deletedSchedules = await prisma.defenseSchedule.deleteMany();
  console.log(`- Đã xóa ${deletedSchedules.count} bản ghi lịch bảo vệ (DefenseSchedule).`);

  // 3. Reset trạng thái tiến độ của sinh viên về trạng thái trước khi phân công (HAS_TOPIC)
  const resetProgress = await prisma.topicRegistration.updateMany({
    where: {
      student_progress_status: {
        in: [
          StudentProgressStatus.REVIEWER_GRADED,
          StudentProgressStatus.DEFENSE_SCHEDULED,
          StudentProgressStatus.DEFENSE_COMPLETED,
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

  console.log('=== Đã HOÀN THÀNH reset phân công thành công! ===');
}

main()
  .catch((e) => {
    console.error('❌ Lỗi khi thực thi script:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
