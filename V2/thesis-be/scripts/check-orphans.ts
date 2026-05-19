import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const regs = await prisma.topicRegistration.findMany({
    include: { student: true }
  });
  console.log(`Total registrations: ${regs.length}`);
  const orphans = regs.filter(r => !r.student);
  console.log(`Orphan registrations (no student): ${orphans.length}`);
  if (orphans.length > 0) {
    console.log('Orphan IDs:', orphans.map(o => o.id));
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
