import dayjs from '../config/dayjs';
import prisma from '../config/database';
import { Semester, SemesterPhase, UserRole, SemesterStatus } from '@prisma/client';

// ─── Phase Order (for transition validation only) ────────────────────────────
export const PHASES_ORDER: SemesterPhase[] = [
  SemesterPhase.PREVIEW,
  SemesterPhase.REGISTRATION,
  SemesterPhase.WORK,
  SemesterPhase.REVIEWING,
  SemesterPhase.DEFENSE,
  SemesterPhase.FINAL,
];

// ─── Timeline Context Object ─────────────────────────────────────────────────
export interface TimelineContext {
  phase: SemesterPhase | null;
  isMidtermActive: boolean;
  midtermStart: Date | null;
  midtermEnd: Date | null;
}

/**
 * SemesterGuard — Pure Context Provider
 * -----------------------------------------------
 * This class is responsible for:
 *   1. Resolving the current phase from real-time dates (calculateCurrentPhase)
 *   2. Providing the full timeline context (getTimelineContext)
 *   3. Validating phase transitions
 */
export class SemesterGuard {
  /**
   * Calculate the effective phase of a semester based on real-time dates.
   * Locked to Asia/Ho_Chi_Minh timezone.
   */
  static calculateCurrentPhase(semester: Semester): SemesterPhase | null {
    // Priority 1: If Admin marked as COMPLETED -> Phase is definitively FINAL
    if (semester.status === SemesterStatus.COMPLETED) {
      return SemesterPhase.FINAL;
    }

    // Priority 2: If the semester is not ACTIVE, it doesn't have an operational phase
    if (semester.status !== SemesterStatus.ACTIVE) {
      return null;
    }

    // Priority 3: Timeline-driven phase calculation
    const now = dayjs();

    // [1] PREVIEW: topic_viewing_start → topic_registration_start
    if (
      semester.topic_viewing_start &&
      now.isSameOrAfter(dayjs(semester.topic_viewing_start)) &&
      now.isBefore(dayjs(semester.topic_registration_start))
    ) {
      return SemesterPhase.PREVIEW;
    }

    // [2] REGISTRATION: topic_registration_start → topic_registration_end
    if (
      semester.topic_registration_start &&
      now.isSameOrAfter(dayjs(semester.topic_registration_start)) &&
      now.isBefore(dayjs(semester.topic_registration_end))
    ) {
      return SemesterPhase.REGISTRATION;
    }

    // [3] WORK: topic_registration_end → proposal_deadline
    if (
      semester.topic_registration_end &&
      now.isSameOrAfter(dayjs(semester.topic_registration_end)) &&
      now.isBefore(dayjs(semester.proposal_deadline))
    ) {
      return SemesterPhase.WORK;
    }

    // [4] REVIEWING: proposal_deadline → defense_start
    if (
      semester.proposal_deadline &&
      now.isSameOrAfter(dayjs(semester.proposal_deadline)) &&
      now.isBefore(dayjs(semester.defense_start))
    ) {
      return SemesterPhase.REVIEWING;
    }

    // [5] DEFENSE: defense_start → defense_end
    if (
      semester.defense_start &&
      now.isSameOrAfter(dayjs(semester.defense_start)) &&
      now.isBefore(dayjs(semester.defense_end))
    ) {
      return SemesterPhase.DEFENSE;
    }

    // Final Fallback: If we passed defense_end, we stay in FINAL phase
    return SemesterPhase.FINAL;
  }

  /**
   * Get the full timeline context for this semester at the current moment.
   * This is the single object passed to PolicyEngine.
   */
  static getTimelineContext(semester: Semester): TimelineContext {
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
