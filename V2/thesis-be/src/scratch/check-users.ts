import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function check() {
  const users = await prisma.user.findMany({
    select: { role: true }
  });
  console.log('User counts by role:');
  const counts = users.reduce((acc, user) => {
    acc[user.role] = (acc[user.role] || 0) + 1;
    return acc;
  }, {} as any);
  console.log(counts);
  process.exit(0);
}

check();
