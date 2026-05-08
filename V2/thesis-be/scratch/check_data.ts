import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const topics = await prisma.topic.findMany({
    where: {
      OR: [
        { code: 'IS3' },
        { title: { contains: 'thi đua' } }
      ]
    },
    include: {
      registrations: {
        include: {
          student: {
            select: {
              full_name: true,
              student_code: true
            }
          },
          group: true
        }
      }
    }
  });

  console.log(JSON.stringify(topics, null, 2));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
