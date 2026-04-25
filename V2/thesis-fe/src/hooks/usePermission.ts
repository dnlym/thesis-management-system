import { useActiveSemester } from './useActiveSemester';
import { UserRole } from '@/types';

export enum AcademicAction {
  CREATE_TOPIC = 'CREATE_TOPIC',
  UPDATE_TOPIC = 'UPDATE_TOPIC',
  DELETE_TOPIC = 'DELETE_TOPIC',
  APPROVE_TOPIC = 'APPROVE_TOPIC',
  REGISTER_TOPIC = 'REGISTER_TOPIC',
  JOIN_GROUP = 'JOIN_GROUP',
  CANCEL_REGISTRATION = 'CANCEL_REGISTRATION',
  SUBMIT_EXTRA_POINTS = 'SUBMIT_EXTRA_POINTS',
  GRADE_MIDTERM = 'GRADE_MIDTERM',
  GRADE_SUPERVISOR = 'GRADE_SUPERVISOR',
  GRADE_REVIEWER = 'GRADE_REVIEWER',
  GRADE_COMMITTEE = 'GRADE_COMMITTEE',
  ASSIGN_DEFENSE_PIVOT = 'ASSIGN_DEFENSE_PIVOT',
  FINALIZE_SCORE = 'FINALIZE_SCORE',
}

export const usePermission = () => {
    const { data: semester, isLoading } = useActiveSemester();

    /**
     * Check if an action is allowed in the current semester context.
     * Note: This ONLY checks semester phase and global role permissions.
     * It does NOT check per-topic context (e.g. is user the supervisor).
     * Per-topic context should be handled via per-topic API responses or the backend.
     */
    const can = (action: AcademicAction): boolean => {
        if (!semester || !semester.allowedActions) return false;
        
        const permission = semester.allowedActions[action];
        return permission ? permission.allowed : false;
    };

    /**
     * Get the reason why an action is blocked.
     */
    const getReason = (action: AcademicAction): string | undefined => {
        if (!semester || !semester.allowedActions) return 'Đang tải dữ liệu học kỳ...';
        
        const permission = semester.allowedActions[action];
        return permission ? permission.reason : 'Hành động không xác định.';
    };

    /**
     * Get the error code for a blocked action.
     */
    const getCode = (action: AcademicAction): string | undefined => {
        if (!semester || !semester.allowedActions) return undefined;
        
        const permission = semester.allowedActions[action];
        return permission ? permission.code : undefined;
    };

    return {
        can,
        getReason,
        getCode,
        isLoading,
        phase: semester?.calculated_phase,
    };
};
