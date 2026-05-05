import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const count = await prisma.topic.count();
  console.log('Total topics in DB:', count);
  
  const topics = await prisma.topic.findMany({
    take: 5,
    select: { title: true, code: true }
  });
  console.log('Sample topics:', topics);
}

main().catch(console.error).finally(() => prisma.$disconnect());
