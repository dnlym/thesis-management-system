import prisma from '../config/database';
import { SemesterPhase, UserRole } from '@prisma/client';

// ─── Phase Order (for transition validation only) ────────────────────────────
export const PHASES_ORDER: SemesterPhase[] = [
  SemesterPhase.PLANNING,
  SemesterPhase.PREVIEW,
  SemesterPhase.REGISTRATION,
  SemesterPhase.WORK,
  SemesterPhase.REVIEWING,
  SemesterPhase.DEFENSE,
  SemesterPhase.FINAL,
];

// ─── Timeline Context Object ─────────────────────────────────────────────────
export interface TimelineContext {
  phase: SemesterPhase;
  isMidtermActive: boolean;
  midtermStart: Date | null;
  midtermEnd: Date | null;
}

/**
 * SemesterGuard — Pure Context Provider
 * -----------------------------------------------
 * This class is ONLY responsible for:
 *   1. Resolving the current phase from real-time dates (calculateCurrentPhase)
 *   2. Providing the full timeline context (getTimelineContext)
 *   3. Validating phase transitions (canTransition)
 *   4. Getting effective registration deadline (getEffectiveDeadline)
 *
 * ❌ It NO LONGER decides what actions are allowed.
 *    That responsibility belongs to AcademicPolicy (academic-policy.ts).
 */
export class SemesterGuard {
  /**
   * Calculate the effective phase of a semester based on real-time dates.
   * Priority: manual_phase_override > date-based > FINAL
   */
  static calculateCurrentPhase(semester: any): SemesterPhase {
    // 1. Manual override takes highest priority
    if (semester.manual_phase_override) {
      return semester.manual_phase_override as SemesterPhase;
    }

    // 2. Process-based status takes second priority
    // If Admin marked as COMPLETED -> Phase is definitively FINAL
    if (semester.status === 'COMPLETED') {
      return SemesterPhase.FINAL;
    }

    const now = new Date();

    // 3. Timeline-based phase calculation
    
    // Pre-semester
    if (semester.start_date && now < new Date(semester.start_date)) {
      return SemesterPhase.PLANNING;
    }

    // [1] PREVIEW: topic_viewing_start → topic_viewing_end
    if (
      semester.topic_viewing_start &&
      now >= new Date(semester.topic_viewing_start) &&
      semester.topic_viewing_end &&
      now < new Date(semester.topic_viewing_end)
    ) {
      return SemesterPhase.PREVIEW;
    }

    // [2] REGISTRATION: topic_registration_start → topic_registration_end
    if (
      semester.topic_registration_start &&
      now >= new Date(semester.topic_registration_start) &&
      semester.topic_registration_end &&
      now < new Date(semester.topic_registration_end)
    ) {
      return SemesterPhase.REGISTRATION;
    }

    // [3] WORK: topic_registration_end → proposal_deadline
    if (
      semester.topic_registration_end &&
      now >= new Date(semester.topic_registration_end) &&
      semester.proposal_deadline &&
      now < new Date(semester.proposal_deadline)
    ) {
      return SemesterPhase.WORK;
    }

    // [4] REVIEWING: proposal_deadline → defense_start (or thesis_deadline)
    if (
      semester.proposal_deadline &&
      now >= new Date(semester.proposal_deadline) &&
      semester.defense_start &&
      now < new Date(semester.defense_start)
    ) {
      return SemesterPhase.REVIEWING;
    }

    // [5] DEFENSE: defense_start → defense_end
    if (
      semester.defense_start &&
      now >= new Date(semester.defense_start) &&
      semester.defense_end &&
      now < new Date(semester.defense_end)
    ) {
      return SemesterPhase.DEFENSE;
    }

    // 4. Default / End-of-Timeline
    // If we passed defense_end but status is not COMPLETED, 
    // we stay in DEFENSE phase (waiting for Admin to finalize).
    if (semester.defense_end && now >= new Date(semester.defense_end)) {
      return SemesterPhase.DEFENSE;
    }

    return semester.current_phase || SemesterPhase.PLANNING;
  }

  /**
   * Get the full timeline context for this semester at the current moment.
   * This is the single object passed to PolicyEngine.
   */
  static getTimelineContext(semester: any): TimelineContext {
    const phase = this.calculateCurrentPhase(semester);
    const now = new Date();

    const isMidtermActive =
      !!semester.midterm_start &&
      !!semester.midterm_end &&
      now >= new Date(semester.midterm_start) &&
      now <= new Date(semester.midterm_end);

    return {
      phase,
      isMidtermActive,
      midtermStart: semester.midterm_start ? new Date(semester.midterm_start) : null,
      midtermEnd: semester.midterm_end ? new Date(semester.midterm_end) : null,
    };
  }

  /**
   * Get the effective deadline for registration, considering extensions.
   */
  static async getEffectiveDeadline(semesterId: string): Promise<Date> {
    const semester = await prisma.semester.findUnique({
      where: { id: semesterId },
      include: {
        registration_extensions: {
          orderBy: { created_at: 'desc' },
          take: 1,
        },
      },
    });

    if (!semester) throw new Error('Semester not found');

    const originalDeadline = semester.topic_registration_end || semester.proposal_deadline;
    const latestExtension = semester.registration_extensions[0]?.extended_until;

    if (!latestExtension) return originalDeadline as Date;
    return latestExtension > (originalDeadline as Date) ? latestExtension : (originalDeadline as Date);
  }

  /**
   * Validate if a phase transition is logically allowed.
   */
  static canTransition(from: SemesterPhase, to: SemesterPhase, role: UserRole): boolean {
    if (role === UserRole.ADMIN) return true;
    if (!to) return true;

    const fromIndex = PHASES_ORDER.indexOf(from);
    const toIndex = PHASES_ORDER.indexOf(to);

    if (fromIndex === -1 || toIndex === -1) return false;

    const diff = toIndex - fromIndex;
    return diff === 0 || diff === 1 || diff === -1;
  }
}
