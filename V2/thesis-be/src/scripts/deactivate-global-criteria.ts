import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const result = await prisma.gradingCriterion.updateMany({
    where: { departmentId: null },
    data: { active: false },
  });
  console.log(`✅ Đã ẩn ${result.count} tiêu chí global (departmentId=null).`);
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
