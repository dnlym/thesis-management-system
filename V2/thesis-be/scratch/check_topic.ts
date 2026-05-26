import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const topicId = '6c1391b0-e675-4c2c-8aa4-e8aa894470d3';
  const groupId = 'ba0a0cd3-98ab-4b9a-b00c-15a8d67ac8ed';

  console.log('=== Checking Topic details ===');
  const topic = await prisma.topic.findUnique({
    where: { id: topicId },
    include: {
      supervisor: true,
      registrations: {
        include: {
          student: true
        }
      }
    }
  });

  if (!topic) {
    console.log('Topic not found!');
  } else {
    console.log({
      id: topic.id,
      title: topic.title,
      status: topic.status,
      supervisor: topic.supervisor?.full_name,
      registrationsCount: topic.registrations.length
    });
    console.log('Registered students:');
    for (const r of topic.registrations) {
      console.log(`- ${r.student?.full_name} (${r.student?.email}) [Status: ${r.status}]`);
    }
  }

  console.log('\n=== Checking Group details ===');
  const group = await prisma.group.findUnique({
    where: { id: groupId },
    include: {
      registrations: {
        include: {
          student: true
        }
      }
    }
  });

  if (!group) {
    console.log('Group not found!');
  } else {
    console.log({
      id: group.id,
      name: group.name,
      registrationsCount: group.registrations.length
    });
    console.log('Group registrations:');
    for (const r of group.registrations) {
      console.log(`- ${r.student?.full_name} (${r.student?.email})`);
    }
  }
}

main()
  .catch(e => {
    console.error(e);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
