import { Semester } from '@prisma/client';
import dayjs from '../config/dayjs';

/**
 * DeadlineResolver — Specialized component for computing the system's "Effective State".
 * It combines static configuration (Semester table) with dynamic adjustments (Extensions).
 */
export class DeadlineResolver {
  /**
   * Calculates the final deadline for topic registration, taking extensions into account.
   */
  static resolveRegistrationDeadline(semester: any): dayjs.Dayjs | null {
    const originalDeadline = semester.topic_registration_end;
    if (!originalDeadline) return null;
    return dayjs(originalDeadline);
  }

  /**
   * Returns a clean map of all effective deadlines for a semester.
   */
  static getEffectiveTimeline(semester: any) {
    const registrationDeadline = this.resolveRegistrationDeadline(semester);
    
    return {
      registrationEnd: registrationDeadline,
      proposalDeadline: dayjs(semester.proposal_deadline),
      midtermStart: semester.midterm_start ? dayjs(semester.midterm_start) : null,
      midtermEnd: semester.midterm_end ? dayjs(semester.midterm_end) : null,
      thesisDeadline: dayjs(semester.thesis_deadline),
      defenseStart: semester.defense_start ? dayjs(semester.defense_start) : null,
      defenseEnd: semester.defense_end ? dayjs(semester.defense_end) : null,
      semesterEnd: dayjs(semester.end_date)
    };
  }
}
