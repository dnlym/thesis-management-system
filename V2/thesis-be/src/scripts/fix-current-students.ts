import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fixCurrentStudents() {
    console.log('=== FIXING current_students FOR ALL TOPICS ===\n');

    // Get all topics with their registrations
    const topics = await prisma.topic.findMany({
        include: {
            registrations: {
                where: {
                    status: { in: ['PENDING', 'CONFIRMED', 'GROUPED'] },
                },
            },
        },
    });

    let fixedCount = 0;

    for (const topic of topics) {
        const actualCount = topic.registrations.length;

        if (topic.current_students !== actualCount) {
            console.log(`Fixing topic ${topic.code || topic.id}:`);
            console.log(`  current_students: ${topic.current_students} → ${actualCount}`);

            await prisma.topic.update({
                where: { id: topic.id },
                data: { current_students: actualCount },
            });

            fixedCount++;
        }
    }

    console.log(`\n=== DONE! Fixed ${fixedCount} topics ===`);
}

fixCurrentStudents()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
