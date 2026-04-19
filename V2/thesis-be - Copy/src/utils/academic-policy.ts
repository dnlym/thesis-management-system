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
  
  // Submission & Work
  SUBMIT_PROPOSAL = 'SUBMIT_PROPOSAL',
  SUBMIT_MIDTERM = 'SUBMIT_MIDTERM',
  SUBMIT_THESIS = 'SUBMIT_THESIS',
  SUBMIT_SOURCE_CODE = 'SUBMIT_SOURCE_CODE',
  
  // Grading
  GRADE_MIDTERM = 'GRADE_MIDTERM',
  GRADE_SUPERVISOR = 'GRADE_SUPERVISOR',
  GRADE_REVIEWER = 'GRADE_REVIEWER',
  GRADE_COMMITTEE = 'GRADE_COMMITTEE',
  FINALIZE_SCORE = 'FINALIZE_SCORE',
  SUBMIT_EXTRA_POINTS = 'SUBMIT_EXTRA_POINTS',
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
    return SemesterGuard.calculateCurrentPhase(semester);
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

    switch (action) {
      // ─── TOPIC MANAGEMENT ──────────────────────────────────────────────
      case AcademicAction.CREATE_TOPIC:
      case AcademicAction.UPDATE_TOPIC:
      case AcademicAction.DELETE_TOPIC:
        // Allowed only during PLANNING (preparation) or PREVIEW (proposal window)
        if (!this.isPlanning(semester) && phase !== SemesterPhase.PREVIEW) {
          return { allowed: false, reason: 'Chỉ được phép quản lý đề tài trong giai đoạn Chuẩn bị hoặc Công bố (PREVIEW).' };
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

      // ─── WORK & SUBMISSIONS ───────────────────────────────────────────
      case AcademicAction.SUBMIT_PROPOSAL:
        if (phase !== SemesterPhase.WORK) {
          return { allowed: false, reason: 'Chỉ được nộp đề cương trong giai đoạn Thực hiện (WORK).', code: 'INVALID_PHASE' };
        }
        return { allowed: user.role === UserRole.STUDENT, code: 'ALLOWED' };

      case AcademicAction.SUBMIT_MIDTERM:
        if (phase !== SemesterPhase.WORK) {
          return { allowed: false, reason: 'Chỉ được nộp báo cáo giữa kỳ trong giai đoạn Thực hiện (WORK).', code: 'INVALID_PHASE' };
        }
        if (!timeline.isMidtermActive) {
          return { allowed: false, reason: 'Hiện không trong khoảng thời gian nộp báo cáo giữa kỳ.', code: 'OUT_OF_TIME' };
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

      case AcademicAction.SUBMIT_THESIS:
      case AcademicAction.SUBMIT_SOURCE_CODE:
        if (phase !== SemesterPhase.REVIEWING) {
          return { allowed: false, reason: 'Chỉ được nộp báo cáo cuối kỳ/source code trong giai đoạn Phản biện.', code: 'INVALID_PHASE' };
        }
        if (!registration || (registration.midterm_status !== 'PASS' && registration.midterm_status !== 'pass')) {
          return { allowed: false, reason: 'Bạn chưa đạt điểm giữa kỳ để thực hiện bước này.', code: 'MIDTERM_REQUIRED' };
        }
        return { allowed: user.role === UserRole.STUDENT, code: 'ALLOWED' };

      case AcademicAction.SUBMIT_EXTRA_POINTS:
        if (phase !== SemesterPhase.WORK && phase !== SemesterPhase.REVIEWING) {
          return { allowed: false, reason: 'Chỉ được nộp minh chứng điểm cộng trong giai đoạn Thực hiện hoặc Phản biện.', code: 'INVALID_PHASE' };
        }
        if (!registration || (registration.midterm_status !== 'PASS' && registration.midterm_status !== 'pass')) {
          return { allowed: false, reason: 'Bạn cần đạt điểm giữa kỳ (PASS) trước khi nộp minh chứng NCKH.', code: 'MIDTERM_REQUIRED' };
        }
        return { allowed: user.role === UserRole.STUDENT, code: 'ALLOWED' };

      // ─── GRADING & DEFENSE ─────────────────────────────────────────────
      case AcademicAction.GRADE_SUPERVISOR:
        if (!semester) return { allowed: false, reason: 'Thiếu thông tin học kỳ.', code: 'NO_SEMESTER' };
        if (phase !== SemesterPhase.FINAL) {
          return { allowed: false, reason: 'GVHD chỉ được chấm điểm trong giai đoạn Tổng hợp (FINAL).', code: 'INVALID_PHASE' };
        }
        return { allowed: (user.role === UserRole.LECTURER || user.role === UserRole.HEAD), code: 'ALLOWED' };

      case AcademicAction.GRADE_REVIEWER:
        if (!semester) return { allowed: false, reason: 'Thiếu thông tin học kỳ.', code: 'NO_SEMESTER' };
        if (phase !== SemesterPhase.REVIEWING) {
          return { allowed: false, reason: 'GVPB chỉ được chấm điểm trong giai đoạn Phản biện (REVIEWING).', code: 'INVALID_PHASE' };
        }
        return { allowed: (user.role === UserRole.LECTURER || user.role === UserRole.HEAD), code: 'ALLOWED' };

      case AcademicAction.GRADE_COMMITTEE:
        if (!semester) return { allowed: false, reason: 'Thiếu thông tin học kỳ.', code: 'NO_SEMESTER' };
        if (phase !== SemesterPhase.DEFENSE) {
          return { allowed: false, reason: 'Hội đồng chỉ được chấm điểm trong giai đoạn Bảo vệ (DEFENSE).', code: 'INVALID_PHASE' };
        }
        return { allowed: (user.role === UserRole.LECTURER || user.role === UserRole.HEAD), code: 'ALLOWED' };

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

