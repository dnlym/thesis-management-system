import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.findUnique({
    where: { email: 'admin@university.edu.vn' }
  });
  console.log('User with admin@university.edu.vn:', user ? 'FOUND' : 'NOT FOUND');
  
  const allUsers = await prisma.user.findMany({
    select: { email: true, full_name: true }
  });
  console.log('All emails in DB:', allUsers.map(u => u.email).slice(0, 10));
}

main().catch(console.error).finally(() => prisma.$disconnect());
