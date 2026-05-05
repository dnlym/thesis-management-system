import prisma from '../src/config/database';
import { SemesterGuard } from '../src/utils/semester-guard';
import dayjs from 'dayjs';

async function main() {
    try {
        const activeSem = await prisma.semester.findFirst({
            where: { status: 'ACTIVE' }
        });
        
        if (!activeSem) {
            console.log('No active semester found.');
            return;
        }
        
        const phase = SemesterGuard.calculateCurrentPhase(activeSem);
        console.log(`Active Semester: ${activeSem.name} (${activeSem.id})`);
        console.log(`Current Phase: ${phase}`);
        console.log(`Timeline:`, {
            proposal_deadline: activeSem.proposal_deadline,
            topic_viewing_start: activeSem.topic_viewing_start,
            topic_viewing_end: activeSem.topic_viewing_end,
            topic_registration_start: activeSem.topic_registration_start,
            topic_registration_end: activeSem.topic_registration_end,
        });
        console.log(`Now: ${new Date().toISOString()}`);
    } catch (error) {
        console.error('Error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
