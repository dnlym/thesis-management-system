import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    where: {
      avatar_url: { not: null }
    }
  });
  console.log('Users with avatar:', users.map(u => ({ email: u.email, avatar: u.avatar_url })));
}

main().catch(console.error).finally(() => prisma.$disconnect());
