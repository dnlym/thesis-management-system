import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function check() {
  const user = await prisma.user.findFirst({ where: { full_name: { contains: 'Huỳnh Nam' } } });
  if (!user) {
    console.log('Không tìm thấy giảng viên Huỳnh Nam');
    return;
  }

  const assignments = await prisma.assignment.findMany({
    where: { reviewer_id: user.id },
    include: { topic: true }
  });

  console.log(`--- PHÂN CÔNG CỦA ${user.full_name} ---`);
  assignments.forEach((a, i) => {
    console.log(`${i+1}. Đề tài: ${a.topic.title} | Vai trò: ${a.assignment_type} | Order: ${a.reviewer_order}`);
  });
}

check().catch(console.error).finally(() => prisma.$disconnect());
