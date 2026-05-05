import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany();
  const nameMap: Record<string, any[]> = {};
  
  for (const u of users) {
    if (!nameMap[u.full_name]) nameMap[u.full_name] = [];
    nameMap[u.full_name].push(u);
  }
  
  const duplicates = Object.entries(nameMap).filter(([name, list]) => list.length > 1);
  console.log(JSON.stringify(duplicates, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
