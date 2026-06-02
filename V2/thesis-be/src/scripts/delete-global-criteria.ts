import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const result = await prisma.gradingCriterion.deleteMany({
    where: { departmentId: null },
  });
  console.log(`✅ Đã xóa vĩnh viễn ${result.count} tiêu chí global (departmentId=null).`);
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
