import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const targets = ['Phùng Nguyên Tân', 'Nguyễn Bá Điền'];

async function main() {
  console.log('--- Bắt đầu quy trình xóa sinh viên và cập nhật nhóm ---');

  for (const name of targets) {
    console.log(`\n🔍 Đang tìm kiếm sinh viên: "${name}"...`);

    const student = await prisma.user.findFirst({
      where: {
        full_name: {
          contains: name,
          mode: 'insensitive'
        },
        role: 'STUDENT'
      }
    });

    if (!student) {
      console.log(`❌ Không tìm thấy sinh viên: "${name}"`);
      continue;
    }

    console.log(`✅ Tìm thấy: ${student.full_name} (ID: ${student.id}, Email: ${student.email})`);

    // 1. Kiểm tra xem sinh viên có trong nhóm nào không
    const groupMember = await prisma.groupMember.findFirst({
      where: { user_id: student.id },
      include: {
        group: {
          include: {
            members: true
          }
        }
      }
    });

    if (groupMember) {
      const group = groupMember.group;
      console.log(`- Sinh viên đang ở trong nhóm: "${group.name}" (ID: ${group.id})`);

      // Kiểm tra xem sinh viên này có phải là trưởng nhóm không
      if (group.leader_id === student.id) {
        console.log(`  ⚠️ Sinh viên này là trưởng nhóm. Đang tìm thành viên khác để làm trưởng nhóm mới...`);

        // Tìm thành viên khác trong nhóm
        const otherMember = group.members.find((m) => m.user_id !== student.id && m.status === 'ACCEPTED');

        if (otherMember) {
          // Chỉ định trưởng nhóm mới
          await prisma.group.update({
            where: { id: group.id },
            data: { leader_id: otherMember.user_id }
          });
          const newLeader = await prisma.user.findUnique({ where: { id: otherMember.user_id } });
          console.log(`  👑 Đã chuyển chức trưởng nhóm sang sinh viên: ${newLeader?.full_name || otherMember.user_id}`);
        } else {
          console.log(`  ⚠️ Nhóm không còn thành viên nào khác. Nhóm sẽ bị xóa.`);
        }
      }

      // Xóa thành viên khỏi GroupMember
      await prisma.groupMember.delete({
        where: { id: groupMember.id }
      });
      console.log(`  🗑️ Đã xóa sinh viên khỏi danh sách thành viên nhóm.`);

      // Kiểm tra lại số lượng thành viên còn lại trong nhóm
      const remainingCount = await prisma.groupMember.count({
        where: { group_id: group.id }
      });

      if (remainingCount === 0) {
        // Nếu nhóm không còn ai thì xóa hẳn nhóm
        await prisma.group.delete({
          where: { id: group.id }
        });
        console.log(`  🗑️ Đã xóa nhóm "${group.name}" vì không còn thành viên nào.`);
      } else {
        console.log(`  👥 Nhóm "${group.name}" hiện tại còn lại ${remainingCount} thành viên và vẫn hoạt động bình thường.`);
      }
    }

    // 2. Kiểm tra đăng ký đề tài của sinh viên
    const registration = await prisma.topicRegistration.findFirst({
      where: { student_id: student.id }
    });

    if (registration) {
      console.log(`- Sinh viên có đăng ký đề tài ID: ${registration.topic_id}`);
      
      // Giảm số lượng sinh viên hiện tại đăng ký đề tài (nếu đăng ký đã được CONFIRMED)
      if (registration.status === 'CONFIRMED') {
        const topic = await prisma.topic.findUnique({
          where: { id: registration.topic_id }
        });

        if (topic) {
          const newCount = Math.max(0, (topic.current_students || 0) - 1);
          await prisma.topic.update({
            where: { id: topic.id },
            data: { current_students: newCount }
          });
          console.log(`  📉 Đã giảm số lượng sinh viên đăng ký đề tài "${topic.title}" xuống còn ${newCount}`);
        }
      }

      // Xóa TopicRegistration
      await prisma.topicRegistration.delete({
        where: { id: registration.id }
      });
      console.log(`  🗑️ Đã xóa bản ghi đăng ký đề tài.`);
    }

    // 3. Xóa dữ liệu điểm/yêu cầu điểm liên quan trực tiếp đến sinh viên để tránh lỗi khóa ngoại
    await prisma.grade.deleteMany({ where: { student_id: student.id } });
    await prisma.finalScore.deleteMany({ where: { student_id: student.id } });
    await prisma.gradeHistory.deleteMany({ where: { student_id: student.id } });
    await prisma.gradeChangeRequest.deleteMany({ where: { student_id: student.id } });
    await prisma.extraPointRequest.deleteMany({ where: { student_id: student.id } });
    await prisma.notification.deleteMany({ where: { user_id: student.id } });
    await prisma.refreshToken.deleteMany({ where: { user_id: student.id } });

    // 4. Xóa tài khoản sinh viên
    await prisma.user.delete({
      where: { id: student.id }
    });
    console.log(`✨ Đã XÓA THÀNH CÔNG tài khoản sinh viên: ${student.full_name}`);
  }

  console.log('\n=== QUY TRÌNH HOÀN TẤT ===');
}

main()
  .catch((e) => {
    console.error('❌ Lỗi khi thực thi script:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
