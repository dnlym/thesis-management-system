import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const result = await prisma.user.deleteMany({
    where: { email: 'admin@university.edu.vn' }
  });
  console.log('Deleted old admin accounts:', result.count);
}

main().catch(console.error).finally(() => prisma.$disconnect());
