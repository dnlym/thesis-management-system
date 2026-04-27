import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function list() {
  const depts = await prisma.department.findMany();
  console.log('--- Departments List ---');
  depts.forEach(d => console.log(`- ${d.name} (${d.id})`));
}

list().finally(() => prisma.$disconnect());
