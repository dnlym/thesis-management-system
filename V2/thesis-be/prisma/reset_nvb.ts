import { PrismaClient, TopicStatus } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Bắt đầu reset dữ liệu cho sinh viên nvb@student.iuh.edu.vn...');

  const student = await prisma.user.findUnique({
    where: { email: 'nvb@student.iuh.edu.vn' }
  });

  if (!student) {
    console.log('❌ Không tìm thấy sinh viên với email nvb@student.iuh.edu.vn');
    return;
  }

  console.log(`Tìm thấy sinh viên: ${student.full_name} (ID: ${student.id})`);

  // 1. Tìm các TopicRegistration của sinh viên này
  const registrations = await prisma.topicRegistration.findMany({
    where: { student_id: student.id }
  });

  console.log(`Tìm thấy ${registrations.length} đăng ký đề tài.`);

  for (const reg of registrations) {
    const topic = await prisma.topic.findUnique({ where: { id: reg.topic_id } });
    if (topic) {
      const newCount = Math.max(0, (topic.current_students || 0) - 1);
      const updateData: any = { current_students: newCount };
      if (newCount < topic.max_students) {
        updateData.status = TopicStatus.APPROVED;
      }
      await prisma.topic.update({
        where: { id: topic.id },
        data: updateData
      });
      console.log(`Đã giảm số lượng sinh viên của đề tài "${topic.title}" xuống ${newCount}`);
    }

    await prisma.topicRegistration.delete({
      where: { id: reg.id }
    });
    console.log(`Đã xóa bản ghi TopicRegistration ID: ${reg.id}`);
  }

  // 2. Tìm và xóa GroupMember nếu có
  const groupMembers = await prisma.groupMember.findMany({
    where: { user_id: student.id }
  });

  console.log(`Tìm thấy ${groupMembers.length} thành viên nhóm.`);

  for (const gm of groupMembers) {
    const groupId = gm.group_id;
    await prisma.groupMember.delete({ where: { id: gm.id } });
    console.log(`Đã xóa GroupMember ID: ${gm.id}`);

    // Kiểm tra xem group còn thành viên nào không
    const remaining = await prisma.groupMember.count({ where: { group_id: groupId } });
    if (remaining === 0) {
      await prisma.group.delete({ where: { id: groupId } });
      console.log(`Đã xóa Group ID: ${groupId} vì không còn thành viên nào.`);
    }
  }

  console.log('✅ Đã đưa sinh viên nvb@student.iuh.edu.vn về trạng thái chưa có đề tài thành công!');
}

main()
  .catch((e) => {
    console.error('Lỗi khi thực thi script:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
