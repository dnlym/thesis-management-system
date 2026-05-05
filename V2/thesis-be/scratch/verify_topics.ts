import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const topics = await prisma.topic.findMany({
    include: { supervisor: true }
  });
  
  const broken = topics.filter(t => !t.supervisor);
  console.log('Total topics:', topics.length);
  console.log('Topics with missing supervisor:', broken.length);
  
  if (broken.length > 0) {
    console.log('Sample broken topic codes:', broken.map(t => t.code).slice(0, 5));
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
