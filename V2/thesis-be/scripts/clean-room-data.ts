import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function formatRoom(room: string | null | undefined): string | null {
    if (!room) return null;
    let result = room.replace(/^(phòng|phong|room)\s+/i, '');
    return result.trim();
}

async function main() {
    console.log('🧹 Starting room data cleanup...');

    // 1. Clean Assignment table
    const assignments = await prisma.assignment.findMany({
        where: {
            room: { not: null }
        }
    });
    console.log(`Found ${assignments.length} assignments with room data.`);
    
    for (const a of assignments) {
        const cleaned = formatRoom(a.room);
        if (cleaned !== a.room) {
            await prisma.assignment.update({
                where: { id: a.id },
                data: { room: cleaned }
            });
            console.log(`  Updated Assignment ${a.id}: "${a.room}" -> "${cleaned}"`);
        }
    }

    // 2. Clean DefenseSchedule table
    const schedules = await prisma.defenseSchedule.findMany({
        where: {
            room: { not: null }
        }
    });
    console.log(`Found ${schedules.length} defense schedules with room data.`);

    for (const s of schedules) {
        const cleaned = formatRoom(s.room);
        if (cleaned !== s.room) {
            await prisma.defenseSchedule.update({
                where: { id: s.id },
                data: { room: cleaned }
            });
            console.log(`  Updated DefenseSchedule ${s.id}: "${s.room}" -> "${cleaned}"`);
        }
    }

    // 3. Clean Committee table
    const committees = await prisma.committee.findMany({
        where: {
            room_preference: { not: null }
        }
    });
    console.log(`Found ${committees.length} committees with room preference.`);

    for (const c of committees) {
        const cleaned = formatRoom(c.room_preference);
        if (cleaned !== c.room_preference) {
            await prisma.committee.update({
                where: { id: c.id },
                data: { room_preference: cleaned }
            });
            console.log(`  Updated Committee ${c.id}: "${c.room_preference}" -> "${cleaned}"`);
        }
    }

    console.log('✅ Room data cleanup complete.');
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
