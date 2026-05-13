
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function checkRequests() {
  console.log('--- KIỂM TRA CHI TIẾT YÊU CẦU SỬA ĐIỂM ---');
  
  const allRequests = await prisma.gradeChangeRequest.findMany({
    include: {
      topic: {
        select: { title: true, departmentId: true }
      },
      grader: {
        select: { full_name: true }
      }
    },
    orderBy: { created_at: 'desc' }
  });

  allRequests.forEach((r, i) => {
    console.log(`[${i+1}] Trạng thái: ${r.status}`);
    console.log(`    Đề tài: ${r.topic?.title}`);
    console.log(`    Giảng viên: ${r.grader?.full_name}`);
    console.log(`    LÝ DO THỰC TẾ: "${r.reason}"`); // ĐÂY LÀ CHỖ CẦN KIỂM TRA
    console.log(`    Thời gian tạo: ${r.created_at}`);
    console.log('---------------------------');
  });
}

checkRequests()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
