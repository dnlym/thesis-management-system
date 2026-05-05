import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const result = await prisma.user.deleteMany({
    where: {
      email: { endsWith: '@vnu.edu.vn' },
      created_at: { gte: new Date('2026-05-05T00:00:00Z') }
    }
  });
  console.log('Deleted users:', result.count);
}

main().catch(console.error).finally(() => prisma.$disconnect());
