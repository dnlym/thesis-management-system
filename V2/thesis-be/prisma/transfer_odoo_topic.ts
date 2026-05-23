import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const supervisorName = 'Nguyễn Hữu Quang';
  const topicTitleKeyword = 'Phân tích dữ liệu ứng dụng trong bài toán dự đoán';

  console.log('--- Bắt đầu chuyển đề tài này sang Nguyễn Hữu Quang ---');

  // 1. Tìm giảng viên Nguyễn Hữu Quang
  const supervisor = await prisma.user.findFirst({
    where: {
      full_name: {
        contains: supervisorName,
        mode: 'insensitive'
      },
      role: {
        in: ['LECTURER', 'HEAD', 'COORDINATOR']
      }
    }
  });

  if (!supervisor) {
    console.log(`❌ Không tìm thấy giảng viên: ${supervisorName}`);
    return;
  }

  console.log(`✅ Tìm thấy giảng viên: ${supervisor.full_name} (${supervisor.email})`);

  // 2. Tìm đề tài
  const topic = await prisma.topic.findFirst({
    where: {
      title: {
        contains: topicTitleKeyword,
        mode: 'insensitive'
      }
    },
    include: {
      supervisor: true
    }
  });

  if (!topic) {
    console.log(`❌ Không tìm thấy đề tài nào chứa từ khóa: "${topicTitleKeyword}"`);
    return;
  }

  console.log(`✅ Tìm thấy đề tài: "${topic.title}"`);
  console.log(`   - ID: ${topic.id}`);
  console.log(`   - GVHD cũ: ${topic.supervisor.full_name} (${topic.supervisor.id})`);

  // 3. Thực hiện cập nhật
  if (topic.supervisor_id === supervisor.id) {
    console.log('ℹ️ Đề tài đã thuộc giảng viên hướng dẫn này sẵn rồi.');
  } else {
    await prisma.topic.update({
      where: { id: topic.id },
      data: {
        supervisor_id: supervisor.id
      }
    });
    console.log(`🎉 Đã chuyển đổi thành công đề tài sang GVHD mới: ${supervisor.full_name}`);
  }
}

main()
  .catch((e) => {
    console.error('❌ Lỗi khi thực thi script:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
