import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fix() {
  const user = await prisma.user.findFirst({ where: { full_name: { contains: 'Huỳnh Nam' } } });
  if (!user) return;
  
  const dups = await prisma.assignment.findMany({ 
    where: { 
      reviewer_id: user.id, 
      topic: { code: 'IS14' } 
    } 
  });
  
  if (dups.length > 1) {
    await prisma.assignment.delete({ where: { id: dups[1].id } });
    console.log('✅ Đã xóa bản ghi trùng cho thầy Huỳnh Nam.');
  } else {
    console.log('Bản ghi đã duy nhất.');
  }
}

fix().catch(console.error).finally(() => prisma.$disconnect());
