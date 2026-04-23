import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('=== UPDATING PENDING REGISTRATIONS TO CONFIRMED ===\n');

    // Find all PENDING registrations
    const pendingRegs = await prisma.topicRegistration.findMany({
        where: {
            status: 'PENDING',
        },
        include: {
            student: { select: { full_name: true, student_code: true } },
            topic: { select: { title: true, code: true } },
        },
    });

    console.log(`Found ${pendingRegs.length} PENDING registrations:\n`);

    for (const reg of pendingRegs) {
        console.log(`- ${reg.student.full_name} (${reg.student.student_code})`);
        console.log(`  Topic: ${reg.topic.code}`);
    }

    // Update all PENDING to CONFIRMED
    const result = await prisma.topicRegistration.updateMany({
        where: {
            status: 'PENDING',
        },
        data: {
            status: 'CONFIRMED',
            confirmed_at: new Date(),
        },
    });

    console.log(`\n✅ Updated ${result.count} registrations from PENDING to CONFIRMED`);
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
