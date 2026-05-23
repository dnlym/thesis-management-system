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
   * Supports department-specific overrides (fallback: Dept Config -> Semester Config).
   */
  static calculateCurrentPhase(semester: any, deptConfig?: any): SemesterPhase | null {
    if (semester.status === SemesterStatus.COMPLETED) return SemesterPhase.FINAL;
    if (semester.status !== SemesterStatus.ACTIVE) return null;

    const now = dayjs().tz('Asia/Ho_Chi_Minh');
    const timeline = DeadlineResolver.getEffectiveTimeline(semester);

    const parseDate = (d: any) => d ? dayjs(d).tz('Asia/Ho_Chi_Minh') : null;

    // [1] PREVIEW: topic_viewing_start → topic_registration_start
    if (
      semester.topic_viewing_start &&
      now.isSameOrAfter(parseDate(semester.topic_viewing_start)) &&
      now.isBefore(parseDate(semester.topic_registration_start))
    ) {
      return SemesterPhase.PREVIEW;
    }

    // [2] REGISTRATION Rule (User Refined): 
    // If is_registration_open (dept) or is_registration_override (global) is true -> allow registration
    const isDeptOpen = deptConfig?.is_registration_open === true;
    const isGlobalOverride = (semester as any).is_registration_override === true;
    const isOverrideActive = isDeptOpen || isGlobalOverride;
    
    if (
      semester.topic_registration_start &&
      now.isSameOrAfter(parseDate(semester.topic_registration_start)) &&
      (isOverrideActive || (timeline.registrationEnd && now.isBefore(timeline.registrationEnd)))
    ) {
      return SemesterPhase.REGISTRATION;
    }

    // [3] WORK: Registration End → proposal_deadline
    if (
      timeline.registrationEnd &&
      now.isSameOrAfter(timeline.registrationEnd) &&
      semester.proposal_deadline &&
      now.isBefore(parseDate(semester.proposal_deadline))
    ) {
      return SemesterPhase.WORK;
    }

    // [4] REVIEWING: proposal_deadline → defense_start
    const proposalDeadline = parseDate(semester.proposal_deadline);
    const thesisDeadline = parseDate(semester.thesis_deadline);
    const endDate = parseDate(semester.end_date);

    let defenseStart = parseDate(semester.defense_start);
    let defenseEnd = parseDate(semester.defense_end);

    if (!defenseStart) {
      if (thesisDeadline) {
        defenseStart = thesisDeadline;
      } else if (proposalDeadline) {
        defenseStart = proposalDeadline.add(7, 'day');
      } else if (endDate) {
        defenseStart = endDate.subtract(7, 'day');
      }
    }

    if (!defenseEnd) {
      if (endDate) {
        defenseEnd = endDate;
      } else if (defenseStart) {
        defenseEnd = defenseStart.add(7, 'day');
      }
    }

    const originalGlobalDefenseStart = defenseStart;

    if (deptConfig?.defense_date) {
      const deptDate = parseDate(deptConfig.defense_date);
      if (deptDate) {
        const effectiveDeptDate = (originalGlobalDefenseStart && deptDate.isBefore(originalGlobalDefenseStart)) 
          ? originalGlobalDefenseStart 
          : deptDate;
        defenseStart = effectiveDeptDate;
      }
    }

    if (
      proposalDeadline &&
      now.isSameOrAfter(proposalDeadline) &&
      defenseStart &&
      now.isBefore(defenseStart)
    ) {
      return SemesterPhase.REVIEWING;
    }

    // [5] DEFENSE: defense_start → defense_end
    // Ceiling Logic: Dept dates must be WITHIN the global semester defense window.
    const globalStart = originalGlobalDefenseStart;
    const globalEnd = defenseEnd;
    
    let effectiveDefenseStart = globalStart;
    let effectiveDefenseEnd = globalEnd;

    if (deptConfig?.defense_date) {
      const deptDate = parseDate(deptConfig.defense_date);
      if (deptDate) {
        // If dept date is before global start, use global start.
        effectiveDefenseStart = (globalStart && deptDate.isBefore(globalStart)) ? globalStart : deptDate;
        // If dept date is after global end, use global end (Ceiling).
        effectiveDefenseEnd = (globalEnd && deptDate.isAfter(globalEnd)) ? globalEnd : deptDate;
      }
    }

    if (
      effectiveDefenseStart &&
      now.isSameOrAfter(effectiveDefenseStart.startOf('day')) &&
      effectiveDefenseEnd &&
      now.isBefore(effectiveDefenseEnd.endOf('day'))
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
    const now = dayjs().tz('Asia/Ho_Chi_Minh');

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
