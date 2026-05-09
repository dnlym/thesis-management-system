import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function check() {
  const topics = await prisma.topic.findMany({
    where: { code: 'IS14' }
  });
  console.log(`Số lượng đề tài mã IS14 tìm thấy: ${topics.length}`);
  topics.forEach((t, i) => {
    console.log(`${i+1}. ID: ${t.id} | Title: ${t.title}`);
  });
}

check().catch(console.error).finally(() => prisma.$disconnect());
