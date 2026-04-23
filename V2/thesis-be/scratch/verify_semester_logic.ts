import { SemesterStatus, SemesterPhase } from '@prisma/client';
import { SemesterGuard } from '../src/utils/semester-guard';
import dayjs from '../src/config/dayjs';

async function verifyLogic() {
    console.log('--- Testing Semester Phase Calculation ---');
    console.log('Current Time (Asia/Ho_Chi_Minh):', dayjs().format());

    const mockSemester = {
        status: SemesterStatus.ACTIVE,
        topic_viewing_start: dayjs().subtract(2, 'days').toDate(),
        topic_registration_start: dayjs().subtract(1, 'day').toDate(),
        topic_registration_end: dayjs().add(1, 'day').toDate(),
        proposal_deadline: dayjs().add(10, 'days').toDate(),
        defense_start: dayjs().add(20, 'days').toDate(),
        defense_end: dayjs().add(22, 'days').toDate(),
    };

    const phase = SemesterGuard.calculateCurrentPhase(mockSemester);
    console.log('Expected Phase: REGISTRATION');
    console.log('Calculated Phase:', phase);

    if (phase === SemesterPhase.REGISTRATION) {
        console.log('✅ Phase calculation logic is correct for Active/Registration case.');
    } else {
        console.error('❌ Phase calculation logic failed.');
    }

    // Test Completed Priority
    const mockCompleted = { ...mockSemester, status: SemesterStatus.COMPLETED };
    const phaseCompleted = SemesterGuard.calculateCurrentPhase(mockCompleted);
    console.log('Test Completed Priority: Expected FINAL, Got:', phaseCompleted);

    // Test PLANNING Priority
    const mockPlanning = { ...mockSemester, status: SemesterStatus.PLANNING };
    const phasePlanning = SemesterGuard.calculateCurrentPhase(mockPlanning);
    console.log('Test Planning Case: Expected null, Got:', phasePlanning);
}

verifyLogic().catch(console.error);
