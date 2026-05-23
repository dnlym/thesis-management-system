import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// =========================================================================
// CẤU HÌNH ĐỔI TÊN ĐỀ TÀI
// =========================================================================

/** 
 * Tên đề tài CŨ (dùng để tìm kiếm)
 * Bạn có thể dán nguyên tên đề tài cũ vào đây
 */
const OLD_TOPIC_TITLE: string = 'Phân tích dữ liệu ứng dụng nâng cao trong bài toán dự báo';

/** 
 * Tên đề tài MỚI muốn đổi thành
 */
const NEW_TOPIC_TITLE: string = 'Dự đoán kết quả tốt nghiệp sinh viên theo phân loại đa lớp có xét nguyên nhân';

// =========================================================================

/**
 * Chuẩn hóa tên đề tài (giống hệ thống)
 */
function normalizeTitle(title: string): string {
  if (!title) return '';

  let result = title.toLowerCase();
  result = result.normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'd');
  result = result.replace(/[^a-z0-9\s\+\#-]/g, '');
  result = result.trim().replace(/\s+/g, ' ');

  return result;
}

async function main() {
  console.log('=== KHỞI CHẠY SCRIPT ĐỔI TÊN ĐỀ TÀI ===\n');

  if (!OLD_TOPIC_TITLE || !NEW_TOPIC_TITLE) {
    console.log('❌ Lỗi: Vui lòng nhập đầy đủ OLD_TOPIC_TITLE và NEW_TOPIC_TITLE');
    return;
  }

  const oldTitle = OLD_TOPIC_TITLE.trim();
  const newTitle = NEW_TOPIC_TITLE.trim();

  if (oldTitle === newTitle) {
    console.log('ℹ️ Tên cũ và tên mới giống nhau, không cần thay đổi.');
    return;
  }

  console.log(`🔍 Đang tìm đề tài có tên: "${oldTitle}"...`);

  const topics = await prisma.topic.findMany({
    where: {
      title: {
        contains: oldTitle,
        mode: 'insensitive'
      }
    },
    include: {
      supervisor: true,
      semester: true
    }
  });

  if (topics.length === 0) {
    console.log(`❌ Không tìm thấy đề tài nào có chứa: "${oldTitle}"`);
    return;
  }

  if (topics.length > 1) {
    console.log(`⚠️ Tìm thấy ${topics.length} đề tài khớp với từ khóa:`);
    topics.forEach((t, i) => {
      console.log(` ${i + 1}. ID: ${t.id}`);
      console.log(`    Tên: "${t.title}"`);
      console.log(`    GVHD: ${t.supervisor.full_name} | HK: ${t.semester.name}`);
    });
    console.log('\n❌ Có nhiều đề tài khớp. Hãy dùng ID chính xác để tránh nhầm lẫn.');
    return;
  }

  const topic = topics[0];

  console.log(`✅ Đã tìm thấy đề tài:`);
  console.log(` - ID: ${topic.id}`);
  console.log(` - Tên hiện tại: "${topic.title}"`);
  console.log(` - GVHD: ${topic.supervisor.full_name}`);
  console.log(` - Học kỳ: ${topic.semester.name}`);

  const normalizedTitle = normalizeTitle(newTitle);

  console.log(`\n🔄 Đang cập nhật tên đề tài...`);

  const updated = await prisma.topic.update({
    where: { id: topic.id },
    data: {
      title: newTitle,
      normalized_title: normalizedTitle
    }
  });

  console.log(`🎉 Cập nhật thành công!`);
  console.log(` - Tên cũ: "${topic.title}"`);
  console.log(` - Tên mới: "${updated.title}"`);
}

main()
  .catch((e) => {
    console.error('❌ Lỗi khi chạy script:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });