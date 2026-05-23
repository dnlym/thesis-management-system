import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const topicId = '765f762d-4283-4451-9eec-b3d803967012';
  const newSupervisorId = '82f141af-e8e2-4ef4-ab59-43b11d4816d3'; // ThS. Trần Thị Kim Chi

  console.log('=== Chuyển đề tài sang GVHD mới ===');
  console.log(`Topic ID: ${topicId}`);
  console.log(`New supervisor ID: ${newSupervisorId} (ThS. Trần Thị Kim Chi)`);

  const updated = await prisma.topic.update({
    where: { id: topicId },
    data: {
      supervisor_id: newSupervisorId,
    },
    include: {
      supervisor: { select: { full_name: true, email: true } }
    }
  });

  console.log(`\n✅ Done!`);
  console.log(`  Title: ${updated.title}`);
  console.log(`  New supervisor: ${updated.supervisor.full_name} (${updated.supervisor.email})`);
  console.log(`  Status: ${updated.status}`);
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
