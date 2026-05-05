import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    where: { 
      OR: [
        { role: 'LECTURER' },
        { role: 'HEAD' }
      ]
    },
    take: 20
  });
  console.log(JSON.stringify(users.map(u => ({ name: u.full_name, email: u.email })), null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
