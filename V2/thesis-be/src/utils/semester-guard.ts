import dayjs from '../config/dayjs';
import prisma from '../config/database';
import { Semester, SemesterPhase, UserRole, SemesterStatus } from '@prisma/client';
import { DeadlineResolver } from './deadline-resolver';

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
  isRegistrationActive: boolean;
  isMidtermActive: boolean;
  isDefenseActive: boolean;
  effectiveRegistrationEnd: dayjs.Dayjs | null;
}

/**
 * SemesterGuard — The Centralized Domain Gatekeeper.
 * It determines the operational state (Phase) of the academic system.
 */
export class SemesterGuard {
  /**
   * Calculate the effective phase of a semester based on real-time dates.
   * Locked to Asia/Ho_Chi_Minh timezone.
   */
  static calculateCurrentPhase(semester: any): SemesterPhase | null {
    if (semester.status === SemesterStatus.COMPLETED) return SemesterPhase.FINAL;
    if (semester.status !== SemesterStatus.ACTIVE) return null;

    const now = dayjs();
    const timeline = DeadlineResolver.getEffectiveTimeline(semester);

    // [1] PREVIEW: topic_viewing_start → topic_registration_start
    if (
      semester.topic_viewing_start &&
      now.isSameOrAfter(dayjs(semester.topic_viewing_start)) &&
      now.isBefore(dayjs(semester.topic_registration_start))
    ) {
      return SemesterPhase.PREVIEW;
    }

    // [2] REGISTRATION: topic_registration_start → Effective Registration End OR Override Active
    const isOverrideActive = (semester as any).is_registration_override === true;
    
    if (
      semester.topic_registration_start &&
      now.isSameOrAfter(dayjs(semester.topic_registration_start)) &&
      (isOverrideActive || (timeline.registrationEnd && now.isBefore(timeline.registrationEnd)))
    ) {
      return SemesterPhase.REGISTRATION;
    }

    // [3] WORK: Registration End → proposal_deadline
    if (
      timeline.registrationEnd &&
      now.isSameOrAfter(timeline.registrationEnd) &&
      semester.proposal_deadline &&
      now.isBefore(dayjs(semester.proposal_deadline))
    ) {
      return SemesterPhase.WORK;
    }

    // [4] REVIEWING: proposal_deadline → defense_start
    if (
      semester.proposal_deadline &&
      now.isSameOrAfter(dayjs(semester.proposal_deadline)) &&
      semester.defense_start &&
      now.isBefore(dayjs(semester.defense_start))
    ) {
      return SemesterPhase.REVIEWING;
    }

    // [5] DEFENSE: defense_start → defense_end
    if (
      semester.defense_start &&
      now.isSameOrAfter(dayjs(semester.defense_start)) &&
      semester.defense_end &&
      now.isBefore(dayjs(semester.defense_end))
    ) {
      return SemesterPhase.DEFENSE;
    }

    return SemesterPhase.FINAL;
  }

  /**
   * Phase Lock Policy: Determines if a timeline shift is allowed.
   */
  static canShiftTimeline(semester: any): { allowed: boolean; reason?: string } {
    const phase = this.calculateCurrentPhase(semester);
    
    // Critical Lock: Cannot shift if we are already in Defense or Final phase
    if (phase === SemesterPhase.DEFENSE || phase === SemesterPhase.FINAL) {
      return { 
        allowed: false, 
        reason: 'Lộ trình đã bước vào giai đoạn Bảo vệ hoặc Tổng kết, không thể tịnh tiến thời gian.' 
      };
    }

    return { allowed: true };
  }

  /**
   * Get the full timeline context for this semester at the current moment.
   */
  static getTimelineContext(semester: any): TimelineContext {
    const phase = this.calculateCurrentPhase(semester);
    const timeline = DeadlineResolver.getEffectiveTimeline(semester);
    const now = dayjs();

    return {
      phase,
      isRegistrationActive: phase === SemesterPhase.REGISTRATION,
      isMidtermActive: phase === SemesterPhase.WORK && 
                       !!timeline.midtermStart && !!timeline.midtermEnd &&
                       now.isSameOrAfter(timeline.midtermStart) && now.isBefore(timeline.midtermEnd),
      isDefenseActive: phase === SemesterPhase.DEFENSE,
      effectiveRegistrationEnd: timeline.registrationEnd
    };
  }

  /**
   * Compatibility helper for older parts of the system.
   */
  static async getEffectiveDeadline(semesterId: string): Promise<Date> {
    const semester = await prisma.semester.findUnique({
      where: { id: semesterId }
    });
    if (!semester) throw new Error('Semester not found');
    const deadline = DeadlineResolver.resolveRegistrationDeadline(semester);
    return deadline ? deadline.toDate() : new Date();
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
