import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkAssignments() {
  const user = await prisma.user.findFirst({ where: { full_name: 'ThS. Bùi Văn Đồng' } });
  if (!user) {
    console.log('Không tìm thấy giảng viên Bùi Văn Đồng');
    return;
  }

  const assignments = await prisma.assignment.findMany({
    where: { 
      reviewer_id: user.id,
      assignment_type: 'REVIEWER'
    },
    include: {
      topic: { select: { title: true, code: true } }
    }
  });

  console.log(`--- PHÂN CÔNG PHẢN BIỆN CỦA ${user.full_name} ---`);
  assignments.forEach((a, i) => {
    console.log(`${i + 1}. Đề tài: ${a.topic.title} (${a.topic.code})`);
    console.log(`   - Thứ tự phản biện: ${a.reviewer_order}`);
    console.log(`   - ID phân công: ${a.id}`);
    console.log('---');
  });
}

checkAssignments()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
