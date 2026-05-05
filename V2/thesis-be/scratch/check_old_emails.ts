import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    where: {
      email: { contains: 'university.edu.vn' }
    }
  });
  console.log('Old emails (@university.edu.vn) remaining:', users.length);
  if (users.length > 0) {
    console.log(users.map(u => u.email));
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
