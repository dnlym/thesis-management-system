const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const topics = await prisma.topic.findMany({
    take: 1,
    include: {
      defense_schedules: { include: { committee: true } }
    }
  });
  console.log(JSON.stringify(topics[0], null, 2));
}
main().catch(console.error).finally(() => prisma.$disconnect());
