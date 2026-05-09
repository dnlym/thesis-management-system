import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function deepClean() {
  console.log('--- ĐANG QUÉT SÂU PHÂN CÔNG TRÙNG LẶP ---');
  
  const assignments = await prisma.assignment.findMany();
  const map = new Map();
  const toDelete = [];

  for (const a of assignments) {
    // Không tính group_id vào key để bắt các trường hợp gán trùng nhưng lệch group_id
    const key = `${a.topic_id}-${a.reviewer_id}-${a.assignment_type}-${a.reviewer_order}`;
    
    if (map.has(key)) {
      toDelete.push(a.id);
    } else {
      map.set(key, a.id);
    }
  }

  if (toDelete.length > 0) {
    console.log(`Tìm thấy ${toDelete.length} phân công dư thừa. Đang dọn dẹp...`);
    await prisma.assignment.deleteMany({
      where: { id: { in: toDelete } }
    });
    console.log('✅ Hệ thống đã được dọn dẹp sạch sẽ hoàn toàn!');
  } else {
    console.log('✨ Không còn phân công nào bị trùng lặp.');
  }
}

deepClean().catch(console.error).finally(() => prisma.$disconnect());
