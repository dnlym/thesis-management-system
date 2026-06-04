import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const loNames = [
  "Phân tích vấn đề và mô hình hóa được yêu cầu của đề tài.",
  "Áp dụng các nguyên tắc, phương pháp chuyên môn để xác định được giải pháp cho đề tài.",
  "Thiết kế được một hệ thống hoặc quy trình đáp ứng được yêu cầu của đề tài.",
  "Hiện thực được một hệ thống hoặc quy trình đáp ứng được yêu cầu của đề tài.",
  "Đánh giá được một hệ thống, quy trình đáp ứng yêu cầu của đề tài.",
  "Thuyết trình hiệu quả trong các lĩnh vực chuyên môn của đề tài.",
  "Thu thập yêu cầu từ các bên liên quan bằng các kỹ thuật phù hợp",
  "Viết được báo cáo khóa luận tốt nghiệp",
  "Chứng tỏ được khả năng làm việc hiệu quả với các thành viên trong nhóm và phối hợp với các bên liên quan",
  "Khả năng hỗ trợ triển khai và vận hành hệ thống thông tin"
];

const raterRoles = ['SUPERVISOR', 'REVIEWER', 'COMMITTEE'];

async function main() {
  console.log('⚡ Đang cập nhật các tiêu chí đánh giá (Learning Outcomes) trong DB...');
  
  let successCount = 0;
  for (const role of raterRoles) {
    for (let i = 0; i < loNames.length; i++) {
      const name = loNames[i];
      const id = `${role}_LO${i+1}`;
      try {
        await prisma.gradingCriterion.upsert({
          where: { id },
          update: {
            name,
            description: name
          },
          create: {
            id,
            name,
            description: name,
            weight: 0.1,
            max_score: 10,
            min_score: 0,
            role: role as any,
            criteria_type: 'FINAL',
            order_index: i,
            active: true
          }
        });
        successCount++;
      } catch (err: any) {
        console.error(`❌ Lỗi khi cập nhật ${id}:`, err.message || err);
      }
    }
  }
  console.log(`🎉 Hoàn tất! Cập nhật thành công ${successCount}/30 tiêu chí. Hoàn toàn không ảnh hưởng đến điểm số hay dữ liệu hiện tại!`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
