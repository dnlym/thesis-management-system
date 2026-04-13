import { UserRole, SemesterPhase } from '@prisma/client';
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
  GRADE_REVIEWER = 'GRADE_REVIEWER',
  GRADE_COMMITTEE = 'GRADE_COMMITTEE',
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
 * AcademicPolicy — The Data-driven Gatekeeper.
 * -------------------------------------------
 * It evaluates rules based on:
 *   1. User Role
 *   2. Semester Phase
 *   3. Custom Data Logic (e.g., Midterm PASS status)
 *   4. Time Windows (derived from semester dates)
 */
export class AcademicPolicy {
  
  /**
   * Main gatekeeper entry point.
   */
  static canPerform(
    action: AcademicAction,
    user: { id: string; role: UserRole },
    semester: any,
    registration?: any // Optional data context (e.g., current student's registration)
  ): PolicyResult {
    // 0. Global Lock for Completed Semesters
    // If the semester is in the FINAL phase (Status: COMPLETED), all mutations are blocked.
    const context = SemesterGuard.getTimelineContext(semester);
    if (context.phase === SemesterPhase.FINAL) {
        // Allow absolutely nothing that changes data
        return { 
          allowed: false, 
          reason: 'Học kỳ này đã kết thúc và được lưu trữ. Bạn không thể thực hiện thêm thay đổi.',
          code: 'SEMESTER_COMPLETED'
        };
    }

    // Admin bypasses PHASE/DATETIME restrictions but still follows basic logic if needed
    if (user.role === UserRole.ADMIN) {
      return { allowed: true };
    }
    
    switch (action) {
      // ─── TOPIC MANAGEMENT ──────────────────────────────────────────────
      case AcademicAction.CREATE_TOPIC:
      case AcademicAction.UPDATE_TOPIC:
      case AcademicAction.DELETE_TOPIC:
        // Allowed in PREVIEW or PLANNING phases for LECTURERS/HEADs
        if (context.phase !== SemesterPhase.PREVIEW && context.phase !== SemesterPhase.PLANNING) {
          return { allowed: false, reason: 'Chỉ được phép quản lý đề tài trong giai đoạn Chuẩn bị hoặc Công bố.' };
        }
        return { allowed: user.role === UserRole.LECTURER || user.role === UserRole.HEAD };

      case AcademicAction.APPROVE_TOPIC:
        // HEAD approves during PREVIEW
        if (context.phase !== SemesterPhase.PREVIEW) {
          return { allowed: false, reason: 'Chỉ được duyệt đề tài trong giai đoạn Công bố.' };
        }
        return { allowed: user.role === UserRole.HEAD };

      // ─── REGISTRATION ──────────────────────────────────────────────────
      case AcademicAction.REGISTER_TOPIC:
      case AcademicAction.JOIN_GROUP:
      case AcademicAction.CANCEL_REGISTRATION:
        if (context.phase !== SemesterPhase.REGISTRATION) {
          // Exception: JOIN_GROUP might be allowed in WORK phase but only if both pass midterm
          // For now, follow the strict phase rule, but add fail check if registration is provided
          return { allowed: false, reason: 'Hiện không phải thời gian đăng ký đề tài hoặc lập nhóm.' };
        }

        // Midterm Check (if data is available)
        // Hardcoding 'FAIL' string to prevent dependency on Prisma Enum which may fail to generate
        if (registration && (registration.midterm_status === 'FAIL' || registration.midterm_status === 'fail')) {
          return { allowed: false, reason: 'Bạn không thể thực hiện thao tác này do không đạt điểm giữa kỳ.' };
        }

        return { allowed: user.role === UserRole.STUDENT };

      // ─── WORK & SUBMISSIONS ───────────────────────────────────────────
      case AcademicAction.SUBMIT_PROPOSAL:
        if (context.phase !== SemesterPhase.WORK) {
          return { allowed: false, reason: 'Chỉ được nộp đề cương trong giai đoạn Thực hiện.' };
        }
        return { allowed: user.role === UserRole.STUDENT };

      case AcademicAction.SUBMIT_MIDTERM:
        // Must be in WORK phase AND within the Midterm window
        if (context.phase !== SemesterPhase.WORK) {
          return { allowed: false, reason: 'Chỉ được nộp báo cáo giữa kỳ trong giai đoạn Thực hiện.' };
        }
        if (!context.isMidtermActive) {
          return { allowed: false, reason: 'Hiện đang nằm ngoài khoảng thời gian nộp báo cáo giữa kỳ.' };
        }
        return { allowed: user.role === UserRole.STUDENT };

      case AcademicAction.GRADE_MIDTERM:
        // Supervisor grades during WORK (usually within or after midterm window)
        if (context.phase !== SemesterPhase.WORK) {
          return { allowed: false, reason: 'Chỉ được chấm giữa kỳ trong giai đoạn Thực hiện.' };
        }
        return { allowed: user.role === UserRole.LECTURER || user.role === UserRole.HEAD };

      case AcademicAction.SUBMIT_THESIS:
      case AcademicAction.SUBMIT_SOURCE_CODE:
        // Allowed in REVIEWING phase
        if (context.phase !== SemesterPhase.REVIEWING) {
          return { allowed: false, reason: 'Chỉ được nộp báo cáo cuối kỳ/source code trong giai đoạn Phản biện.' };
        }
        
        // STATUS GATE: Must have passed Midterm
        if (!registration) {
          return { allowed: false, reason: 'Không tìm thấy thông tin đăng ký của sinh viên.' };
        }
        // Hardcoding 'PASS' string to prevent dependency on Prisma Enum
        if (registration.midterm_status !== 'PASS' && registration.midterm_status !== 'pass') {
          return { 
            allowed: false, 
            reason: 'Bạn không đủ điều kiện nộp khóa luận vì chưa đạt (PASS) ở kỳ đánh giá giữa kỳ.',
            code: 'MIDTERM_REQUIRED'
          };
        }
        
        return { allowed: user.role === UserRole.STUDENT };

      // ─── GRADING & DEFENSE ─────────────────────────────────────────────
      case AcademicAction.GRADE_REVIEWER:
        if (context.phase !== SemesterPhase.REVIEWING) {
          return { allowed: false, reason: 'Chỉ được chấm phản biện trong giai đoạn Phản biện.' };
        }
        return { allowed: user.role === UserRole.LECTURER || user.role === UserRole.HEAD };

      case AcademicAction.GRADE_COMMITTEE:
        if (context.phase !== SemesterPhase.DEFENSE) {
          return { allowed: false, reason: 'Chỉ được chấm hội đồng trong giai đoạn Bảo vệ.' };
        }
        return { allowed: user.role === UserRole.LECTURER || user.role === UserRole.HEAD };

      case AcademicAction.FINALIZE_SCORE:
        // HOD finalizes during DEFENSE phase (the end-state of the timeline before COMPLETED)
        if (context.phase !== SemesterPhase.DEFENSE) {
          return { allowed: false, reason: 'Chỉ được tổng kết điểm sau khi đã hoàn thành các hội đồng bảo vệ.' };
        }
        return { allowed: user.role === UserRole.HEAD };

      default:
        return { allowed: false, reason: 'Hành động không xác định trong hệ thống chính sách.' };
    }
  }

  /**
   * Helper to throw error if not allowed.
   */
  static enforce(
    action: AcademicAction,
    user: { id: string; role: UserRole },
    semester: any,
    registration?: any
  ): void {
    const result = this.canPerform(action, user, semester, registration);
    if (!result.allowed) {
      throw new Error(result.reason || 'Hành động bị chặn bởi chính sách học thuật.');
    }
  }

  /**
   * Returns a map of all actions and their current status for UI synchronization.
   */
  static getAllAllowedActions(
    user: { id: string; role: UserRole },
    semester: any,
    registration?: any
  ): Record<string, PolicyResult> {
    const results: Record<string, PolicyResult> = {};
    const actions = Object.values(AcademicAction) as AcademicAction[];

    for (const action of actions) {
      results[action] = this.canPerform(action, user, semester, registration);
    }

    return results;
  }
}
