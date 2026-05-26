import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Searching for student: Đào Hoa Anh Thư');
  
  // Find the student user
  const user = await prisma.user.findFirst({
    where: {
      full_name: {
        contains: 'Đào Hoa Anh Thư'
      }
    }
  });

  if (!user) {
    console.log('❌ Student not found in User table!');
    return;
  }

  console.log('Found Student User:', {
    id: user.id,
    full_name: user.full_name,
    email: user.email,
    role: user.role
  });

  // Find their topic registration
  const registrations = await prisma.topicRegistration.findMany({
    where: {
      student_id: user.id
    },
    include: {
      topic: true,
      group: true
    }
  });

  console.log(`Found ${registrations.length} registrations:`);
  for (const reg of registrations) {
    console.log({
      registrationId: reg.id,
      status: reg.status,
      topicId: reg.topic_id,
      topicTitle: reg.topic?.title,
      groupId: reg.group_id
    });
  }
}

main()
  .catch(e => {
    console.error(e);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
