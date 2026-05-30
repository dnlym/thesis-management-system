import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('--- Bắt đầu xóa toàn bộ dữ liệu hội đồng ---');

  // 1. Xóa toàn bộ Assignment thuộc dạng COMMITTEE
  const deletedAssignments = await prisma.assignment.deleteMany({
    where: {
      assignment_type: 'COMMITTEE'
    }
  });
  console.log(`- Đã xóa ${deletedAssignments.count} bản ghi phân công hội đồng (Assignment).`);

  // 2. Cập nhật DefenseSchedule để gỡ liên kết với hội đồng
  const updatedSchedules = await prisma.defenseSchedule.updateMany({
    data: {
      committee_id: null
    }
  });
  console.log(`- Đã gỡ liên kết hội đồng trong ${updatedSchedules.count} lịch bảo vệ (DefenseSchedule).`);

  // 3. Xóa toàn bộ thành viên hội đồng
  const deletedMembers = await prisma.committeeMember.deleteMany();
  console.log(`- Đã xóa ${deletedMembers.count} thành viên hội đồng (CommitteeMember).`);

  // 4. Xóa toàn bộ hội đồng
  const deletedCommittees = await prisma.committee.deleteMany();
  console.log(`- Đã xóa ${deletedCommittees.count} hội đồng (Committee).`);

  console.log('=== Đã HOÀN THÀNH xóa toàn bộ dữ liệu hội đồng thành công! ===');
}

main()
  .catch((e) => {
    console.error('❌ Lỗi khi thực thi script:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
