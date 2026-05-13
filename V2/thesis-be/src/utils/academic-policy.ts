import { UserRole, SemesterPhase, SemesterStatus } from '@prisma/client';
import { SemesterGuard, TimelineContext } from './semester-guard';

/**
 * AcademicAction — The central registry of all protected operations in the system.
 */
export enum AcademicAction {
  // Topic related
  CREATE_TOPIC = 'CREATE_TOPIC',
  UPDATE_TOPIC = 'UPDATE_TOPIC',
  DELETE_TOPIC = 'DELETE_TOPIC',
  APPROVE_TOPIC = 'APPROVE_TOPIC',

  // Registration related
  REGISTER_TOPIC = 'REGISTER_TOPIC',
  JOIN_GROUP = 'JOIN_GROUP',
  CANCEL_REGISTRATION = 'CANCEL_REGISTRATION',

  // Work & Extra Points
  SUBMIT_EXTRA_POINTS = 'SUBMIT_EXTRA_POINTS',

  // Grading
  GRADE_MIDTERM = 'GRADE_MIDTERM',
  GRADE_SUPERVISOR = 'GRADE_SUPERVISOR',
  GRADE_REVIEWER = 'GRADE_REVIEWER',
  GRADE_COMMITTEE = 'GRADE_COMMITTEE',
  ASSIGN_DEFENSE_PIVOT = 'ASSIGN_DEFENSE_PIVOT',
  ASSIGN_REVIEWER = 'ASSIGN_REVIEWER',
  ASSIGN_COMMITTEE = 'ASSIGN_COMMITTEE',
  FINALIZE_SCORE = 'FINALIZE_SCORE',
}

/**
 * PolicyResult — Structured response from the policy engine.
 */
export interface PolicyResult {
  allowed: boolean;
  reason?: string;
  code?: string;
  context?: any;
}

/**
 * AcademicPolicy — The Modular Gatekeeper.
 */
export class AcademicPolicy {

  // ─── Core Helpers ─────────────────────────────────────────────────────────

  static isActive(semester: any): boolean {
    return semester.status === SemesterStatus.ACTIVE;
  }

  static isCompleted(semester: any): boolean {
    return semester.status === SemesterStatus.COMPLETED;
  }

  static isPlanning(semester: any): boolean {
    return semester.status === SemesterStatus.PLANNING;
  }

  static getPhase(semester: any): SemesterPhase | null {
    // Priority: deptConfig attached to semester object -> global semester dates
    return SemesterGuard.calculateCurrentPhase(semester, semester.deptConfig);
  }

  private static isTopicFailed(phase: SemesterPhase | null, registration: any): { failed: boolean; reason?: string } {
    if (!registration || !registration.topic) return { failed: false };
    const topic = registration.topic;

    // 1. Manual Lock
    if (topic.is_locked) {
      return { failed: true, reason: 'Đề tài này đã bị khóa bởi quản trị viên.' };
    }

    // 2. Eligibility for Defense Check
    // If we are at Defense phase, the topic MUST be marked as eligible
    if (phase === SemesterPhase.DEFENSE || phase === SemesterPhase.FINAL) {
      if (topic.is_eligible_for_defense === false) {
        return { failed: true, reason: 'Đề tài này đã bị chốt không đủ điều kiện bảo vệ cuối kỳ.' };
      }
    }

    // 3. Grading Completion Check
    // For Defense phase, we require Supervisor and Reviewer to have finished
    const isAtDefensePhaseOrLater = phase === SemesterPhase.DEFENSE || phase === SemesterPhase.FINAL;
    if (isAtDefensePhaseOrLater) {
      const grades = topic.grades || [];
      const hasSupervisorGraded = grades.some((g: any) => g.rater_role?.startsWith('SUPERVISOR'));
      const hasReviewerGraded = grades.some((g: any) => g.rater_role?.startsWith('REVIEWER'));

      if (!hasSupervisorGraded) {
        return { failed: true, reason: 'Sinh viên bị loại do thiếu điểm Giảng viên hướng dẫn.' };
      }
      
      if (!hasReviewerGraded) {
        return { failed: true, reason: 'Sinh viên bị loại do thiếu điểm Phản biện.' };
      }
    }

    return { failed: false };
  }

  // ─── Main Policy logic ────────────────────────────────────────────────────

  static canPerform(
    action: AcademicAction,
    user: { id: string; role: UserRole },
    semester: any,
    registration?: any
  ): PolicyResult {
    // 0. Global Lock: Block all mutations if COMPLETED
    if (this.isCompleted(semester)) {
      return {
        allowed: false,
        reason: 'Học kỳ này đã kết thúc và được lưu trữ. Dữ liệu đã được khóa.',
        code: 'SEMESTER_COMPLETED'
      };
    }

    // 1. Global Lock: Only Admin can see/act if PLANNING
    if (this.isPlanning(semester) && user.role !== UserRole.ADMIN) {
      return {
        allowed: false,
        reason: 'Học kỳ đang chuẩn bị, hiện chưa công bố cho người dùng.',
        code: 'SEMESTER_PLANNING'
      };
    }

    // Admin bypasses PHASE restrictions but still follows GLOBAL LOCK
    if (user.role === UserRole.ADMIN) {
      return { allowed: true };
    }

    const phase = this.getPhase(semester);
    const timeline = SemesterGuard.getTimelineContext(semester);

    // --- GLOBAL FAILED STATUS CHECK ---
    // Block subsequent actions if topic is failed
    const subsequentActions = [
      AcademicAction.ASSIGN_DEFENSE_PIVOT,
      AcademicAction.ASSIGN_REVIEWER,
      AcademicAction.ASSIGN_COMMITTEE,
      AcademicAction.GRADE_COMMITTEE,
      AcademicAction.FINALIZE_SCORE
    ];

    if (subsequentActions.includes(action)) {
      const failStatus = this.isTopicFailed(phase, registration);
      if (failStatus.failed) {
        return { allowed: false, reason: failStatus.reason, code: 'TOPIC_FAILED' };
      }
    }

    switch (action) {
      // ─── TOPIC MANAGEMENT ──────────────────────────────────────────────
      case AcademicAction.UPDATE_TOPIC:
      case AcademicAction.DELETE_TOPIC:
        // 1. Global Phase Lock: Locked from REVIEWING phase onwards
        const lockedPhases: string[] = [SemesterPhase.REVIEWING, SemesterPhase.DEFENSE, SemesterPhase.FINAL];
        if (phase && lockedPhases.includes(phase)) {
          return { allowed: false, reason: 'Đề tài đã bị khóa do đang trong giai đoạn Phản biện hoặc Bảo vệ.', code: 'PHASE_LOCKED' };
        }

        // 2. Manual Lock: If the specific topic is locked
        if (registration?.topic?.is_locked) {
          return { allowed: false, reason: 'Đề tài này đã bị khóa thủ công bởi quản trị viên.', code: 'MANUAL_LOCKED' };
        }

        // Allowed only during PLANNING (preparation) or PREVIEW (proposal window)
        // Note: We might allow updates in REGISTRATION/WORK if they are not locked yet (UX choice)
        if (!this.isPlanning(semester) && phase !== SemesterPhase.PREVIEW && phase !== SemesterPhase.REGISTRATION && phase !== SemesterPhase.WORK) {
          return { allowed: false, reason: 'Chỉ được phép quản lý đề tài trong các giai đoạn cho phép (Chuẩn bị, Đăng ký hoặc Thực hiện).' };
        }
        return { allowed: user.role === UserRole.LECTURER || user.role === UserRole.HEAD };

      case AcademicAction.CREATE_TOPIC:
        if (!this.isPlanning(semester) && phase !== SemesterPhase.PREVIEW) {
          return { allowed: false, reason: 'Chỉ được phép tạo đề tài trong giai đoạn Chuẩn bị hoặc Công bố (PREVIEW).' };
        }
        return { allowed: user.role === UserRole.LECTURER || user.role === UserRole.HEAD };

      case AcademicAction.APPROVE_TOPIC:
        if (!this.isPlanning(semester) && phase !== SemesterPhase.PREVIEW) {
          return { allowed: false, reason: 'Chỉ được duyệt đề tài trong giai đoạn Chuẩn bị hoặc Công bố (PREVIEW).' };
        }
        return { allowed: user.role === UserRole.HEAD };

      // ─── REGISTRATION ──────────────────────────────────────────────────
      case AcademicAction.REGISTER_TOPIC:
      case AcademicAction.JOIN_GROUP:
      case AcademicAction.CANCEL_REGISTRATION:
        if (phase !== SemesterPhase.REGISTRATION) {
          return { allowed: false, reason: 'Hiện không phải thời gian đăng ký đề tài hoặc lập nhóm.' };
        }
        if (registration && (registration.midterm_status === 'FAIL' || registration.midterm_status === 'fail')) {
          return { allowed: false, reason: 'Bạn không thể thực hiện thao tác này do không đạt điểm giữa kỳ.' };
        }
        return { allowed: user.role === UserRole.STUDENT };

      // ─── WORK & EXTRA POINTS ───────────────────────────────────────────
      case AcademicAction.SUBMIT_EXTRA_POINTS:
        if (phase !== SemesterPhase.WORK && phase !== SemesterPhase.REVIEWING) {
          return { allowed: false, reason: 'Chỉ được nộp minh chứng điểm cộng trong giai đoạn Thực hiện hoặc Phản biện.', code: 'INVALID_PHASE' };
        }
        if (!registration || (registration.midterm_status !== 'PASS' && registration.midterm_status !== 'pass')) {
          return { allowed: false, reason: 'Bạn cần đạt điểm giữa kỳ (PASS) trước khi nộp minh chứng NCKH.', code: 'MIDTERM_REQUIRED' };
        }
        return { allowed: user.role === UserRole.STUDENT, code: 'ALLOWED' };

      case AcademicAction.GRADE_MIDTERM:
        if (!semester) {
          return { allowed: false, reason: 'Không tìm thấy dữ liệu học kỳ.', code: 'NO_SEMESTER' };
        }
        if (phase !== SemesterPhase.WORK) {
          return { allowed: false, reason: 'Chỉ được chấm giữa kỳ trong giai đoạn Thực hiện (WORK).', code: 'INVALID_PHASE' };
        }
        if (!timeline.isMidtermActive) {
          return { allowed: false, reason: 'Đã hết thời gian (hoặc chưa tới ngày) đánh giá giữa kỳ.', code: 'OUT_OF_TIME' };
        }
        return { allowed: user.role === UserRole.LECTURER || user.role === UserRole.HEAD, code: 'ALLOWED' };

      // ─── GRADING & DEFENSE ─────────────────────────────────────────────
      case AcademicAction.GRADE_SUPERVISOR:
        if (!semester) return { allowed: false, reason: 'Thiếu thông tin học kỳ.', code: 'NO_SEMESTER' };
        if (phase !== SemesterPhase.REVIEWING && phase !== SemesterPhase.DEFENSE && phase !== SemesterPhase.FINAL) {
          return { allowed: false, reason: 'GVHD chỉ được chấm điểm từ giai đoạn Phản biện trở đi.', code: 'INVALID_PHASE' };
        }
        return { allowed: (user.role === UserRole.LECTURER || user.role === UserRole.HEAD), code: 'ALLOWED' };

      case AcademicAction.GRADE_REVIEWER:
        if (!semester) return { allowed: false, reason: 'Thiếu thông tin học kỳ.', code: 'NO_SEMESTER' };
        if (phase !== SemesterPhase.REVIEWING && phase !== SemesterPhase.DEFENSE && phase !== SemesterPhase.FINAL) {
          return { allowed: false, reason: 'GVPB chỉ được chấm điểm từ giai đoạn Phản biện trở đi.', code: 'INVALID_PHASE' };
        }
        return { allowed: (user.role === UserRole.LECTURER || user.role === UserRole.HEAD), code: 'ALLOWED' };

      case AcademicAction.GRADE_COMMITTEE:
        if (!semester) return { allowed: false, reason: 'Thiếu thông tin học kỳ.', code: 'NO_SEMESTER' };
        if (phase !== SemesterPhase.DEFENSE && phase !== SemesterPhase.FINAL) {
          return { allowed: false, reason: 'Hội đồng chỉ được chấm điểm từ giai đoạn Bảo vệ trở đi.', code: 'INVALID_PHASE' };
        }
        return { allowed: (user.role === UserRole.LECTURER || user.role === UserRole.HEAD), code: 'ALLOWED' };

      case AcademicAction.ASSIGN_DEFENSE_PIVOT:
        if (phase !== SemesterPhase.REVIEWING && phase !== SemesterPhase.DEFENSE) {
          return { allowed: false, reason: 'Chỉ được xét duyệt hình thức bảo vệ trong giai đoạn Phản biện hoặc Bảo vệ.', code: 'INVALID_PHASE' };
        }
        return { allowed: user.role === UserRole.HEAD, code: 'ALLOWED' };

      case AcademicAction.ASSIGN_REVIEWER:
        if (phase !== SemesterPhase.REVIEWING && phase !== SemesterPhase.DEFENSE && phase !== SemesterPhase.FINAL) {
          return { allowed: false, reason: 'Chỉ được phân công phản biện từ giai đoạn Phản biện trở đi (sau khi có kết quả giữa kỳ).', code: 'INVALID_PHASE' };
        }
        return { allowed: user.role === UserRole.HEAD, code: 'ALLOWED' };

      case AcademicAction.ASSIGN_COMMITTEE:
        if (phase !== SemesterPhase.DEFENSE && phase !== SemesterPhase.FINAL) {
          return { allowed: false, reason: 'Chỉ được phân công hội đồng trong giai đoạn Bảo vệ cuối kỳ.', code: 'INVALID_PHASE' };
        }
        return { allowed: user.role === UserRole.HEAD, code: 'ALLOWED' };

      case AcademicAction.FINALIZE_SCORE:
        if (phase !== SemesterPhase.DEFENSE && phase !== SemesterPhase.FINAL) {
          return { allowed: false, reason: 'Chỉ được chốt điểm trong giai đoạn Bảo vệ hoặc Tổng hợp.', code: 'INVALID_PHASE' };
        }
        return { allowed: user.role === UserRole.HEAD, code: 'ALLOWED' };

      default:
        return { allowed: false, reason: 'Hành động không xác định.' };
    }
  }

  /**
   * Helper to throw error if not allowed.
   */
  static enforce(action: AcademicAction, user: { id: string; role: UserRole }, semester: any, registration?: any): void {
    const result = this.canPerform(action, user, semester, registration);
    if (!result.allowed) {
      throw new Error(result.reason || 'Hành động bị chặn bởi chính sách học thuật.');
    }
  }

  /**
   * Returns a map of all actions for UI synchronization.
   */
  static getAllAllowedActions(user: { id: string; role: UserRole }, semester: any, registration?: any): Record<string, PolicyResult> {
    const results: Record<string, PolicyResult> = {};
    const actions = Object.values(AcademicAction) as AcademicAction[];
    for (const action of actions) {
      results[action] = this.canPerform(action, user, semester, registration);
    }
    return results;
  }
}

