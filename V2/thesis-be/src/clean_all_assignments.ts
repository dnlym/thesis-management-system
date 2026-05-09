import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function cleanAllDuplicateAssignments() {
  console.log('--- ĐANG KIỂM TRA PHÂN CÔNG TRÙNG LẶP TOÀN HỆ THỐNG ---');
  
  // Lấy tất cả assignments
  const allAssignments = await prisma.assignment.findMany();
  
  const seen = new Set();
  const duplicates = [];

  for (const a of allAssignments) {
    // Key định danh duy nhất cho một phân công: topic + reviewer + type + order + group
    const key = `${a.topic_id}-${a.reviewer_id}-${a.assignment_type}-${a.reviewer_order}-${a.group_id}`;
    
    if (seen.has(key)) {
      duplicates.push(a.id);
    } else {
      seen.add(key);
    }
  }

  if (duplicates.length > 0) {
    console.log(`Tìm thấy ${duplicates.length} bản ghi trùng lặp. Đang xóa...`);
    await prisma.assignment.deleteMany({
      where: {
        id: { in: duplicates }
      }
    });
    console.log('✅ Đã dọn dẹp sạch sẽ tất cả phân công trùng lặp!');
  } else {
    console.log('✨ Tuyệt vời! Không tìm thấy phân công nào bị trùng lặp.');
  }
}

cleanAllDuplicateAssignments()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
