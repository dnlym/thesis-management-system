import { PrismaClient, TopicStatus } from '@prisma/client';

const prisma = new PrismaClient();

async function migrateData() {
  console.log('🚀 Starting Topic architectural migration...');

  // 1. Handle HIDDEN topics
  const hiddenTopics = await (prisma.topic as any).findMany({
    where: { status: 'HIDDEN' }
  });
  console.log(`Found ${hiddenTopics.length} HIDDEN topics.`);

  for (const topic of hiddenTopics) {
    let restoredStatus: any = 'APPROVED';
    if (topic.edit_notes?.startsWith('Previous status:')) {
      restoredStatus = topic.edit_notes.replace('Previous status:', '').trim();
    }
    
    await (prisma.topic as any).update({
      where: { id: topic.id },
      data: {
        status: restoredStatus,
        is_visible: false,
        edit_notes: null
      }
    });
  }

  // 2. Handle REQUIRE_EDIT -> REQUIRES_REVISION
  const requireEditTopics = await (prisma.topic as any).findMany({
    where: { status: 'REQUIRE_EDIT' }
  });
  console.log(`Found ${requireEditTopics.length} topics requiring edit.`);
  for (const topic of requireEditTopics) {
    await (prisma.topic as any).update({
      where: { id: topic.id },
      data: { status: 'REQUIRES_REVISION' }
    });
  }

  // 3. Handle Phase-based statuses -> REGISTERED + progress_stage
  const phaseStatusMap: Record<string, string> = {
    'UNDER_REVIEW': 'REVIEWING',
    'WAITING_FOR_DEFENSE': 'READY_FOR_DEFENSE',
    'WAITING_FOR_DEFENSE_ASSIGNMENT': 'READY_FOR_DEFENSE',
    'DEFENDING': 'DEFENDING'
  };

  for (const [oldStatus, newStage] of Object.entries(phaseStatusMap)) {
    const topics = await (prisma.topic as any).findMany({
      where: { status: oldStatus }
    });
    console.log(`Mapping ${topics.length} topics from ${oldStatus} to REGISTERED/${newStage}.`);
    
    for (const topic of topics) {
      await (prisma.topic as any).update({
        where: { id: topic.id },
        data: {
          status: 'REGISTERED',
          progress_stage: newStage
        }
      });
    }
  }

  // 4. Handle PENDING_INTERDISCIPLINARY
  const interTopics = await (prisma.topic as any).findMany({
    where: { status: 'PENDING_INTERDISCIPLINARY' }
  });
  console.log(`Mapping ${interTopics.length} interdisciplinary topics to PENDING_APPROVAL.`);
  for (const topic of interTopics) {
    await (prisma.topic as any).update({
      where: { id: topic.id },
      data: { status: 'PENDING_APPROVAL' }
    });
  }

  console.log('✅ Migration complete!');
}

migrateData()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
