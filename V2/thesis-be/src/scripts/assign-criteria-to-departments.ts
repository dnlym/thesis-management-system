/**
 * Script: assign-criteria-to-departments.ts
 * 
 * Mục đích: Gán tất cả tiêu chí global (departmentId=null) thành tiêu chí
 * riêng cho từng bộ môn. Nội dung giống nhau, chỉ thêm departmentId.
 * 
 * Chạy: npx ts-node src/scripts/assign-criteria-to-departments.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('=== Bắt đầu gán tiêu chí global vào từng bộ môn ===\n');

  // 1. Lấy tất cả tiêu chí global (departmentId = null)
  const globalCriteria = await prisma.gradingCriterion.findMany({
    where: { departmentId: null, active: true },
    orderBy: [{ role: 'asc' }, { order_index: 'asc' }],
  });

  if (globalCriteria.length === 0) {
    console.log('❌ Không có tiêu chí global nào để gán.');
    return;
  }

  console.log(`✅ Tìm thấy ${globalCriteria.length} tiêu chí global.\n`);

  // 2. Lấy tất cả bộ môn
  const departments = await prisma.department.findMany({
    select: { id: true, name: true },
  });

  if (departments.length === 0) {
    console.log('❌ Không có bộ môn nào trong hệ thống.');
    return;
  }

  console.log(`✅ Tìm thấy ${departments.length} bộ môn: ${departments.map(d => d.name).join(', ')}\n`);

  let totalCreated = 0;
  let totalSkipped = 0;

  // 3. Với mỗi bộ môn, tạo bản sao tiêu chí (bỏ qua nếu đã có)
  for (const dept of departments) {
    console.log(`\n--- Xử lý bộ môn: ${dept.name} (${dept.id}) ---`);

    // Lấy tiêu chí đã tồn tại của bộ môn này
    const existingCriteria = await prisma.gradingCriterion.findMany({
      where: { departmentId: dept.id, active: true },
      select: { name: true, role: true },
    });

    let created = 0;
    let skipped = 0;

    for (const c of globalCriteria) {
      const alreadyExists = existingCriteria.some(
        e => e.name === c.name && e.role === c.role
      );

      if (alreadyExists) {
        console.log(`  ⏭ Bỏ qua (đã có): ${c.name} [${c.role}]`);
        skipped++;
        continue;
      }

      await prisma.gradingCriterion.create({
        data: {
          name: c.name,
          description: c.description,
          weight: c.weight,
          max_score: c.max_score,
          min_score: c.min_score,
          role: c.role,
          order_index: c.order_index,
          departmentId: dept.id,
          active: true,
        },
      });

      console.log(`  ✅ Tạo mới: ${c.name} [${c.role}]`);
      created++;
    }

    console.log(`  → Tạo mới: ${created}, Bỏ qua: ${skipped}`);
    totalCreated += created;
    totalSkipped += skipped;
  }

  console.log('\n=== KẾT QUẢ ===');
  console.log(`Tổng tiêu chí tạo mới: ${totalCreated}`);
  console.log(`Tổng tiêu chí bỏ qua:  ${totalSkipped}`);
  console.log('\n✅ Hoàn thành! Mỗi bộ môn giờ có bộ tiêu chí riêng.');
  console.log('💡 Gợi ý: Có thể ẩn/xóa tiêu chí global nếu không cần dùng nữa.');
}

main()
  .catch(e => {
    console.error('❌ Lỗi:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
