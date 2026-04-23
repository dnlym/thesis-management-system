import { Semester } from '@/types';

/**
 * Semester Business Rule Engine
 * Centralizes all logic for phase-based and status-based permissions.
 * Useful for Thesis business rule encapsulation.
 */

/**
 * Checks if a semester is in a state where topics can be proposed/created.
 * Rule: Semester status is 'PLANNING' OR current phase is 'PREVIEW'.
 */
export const canCreateTopic = (semester: Semester | null | undefined): boolean => {
    if (!semester) return false;
    return (
        semester.status === 'PLANNING' || 
        semester.calculated_phase === 'PREVIEW'
    );
};

/**
 * Checks if a semester is in the registration phase.
 */
export const isRegistrationPhase = (semester: Semester | null | undefined): boolean => {
    if (!semester) return false;
    return semester.calculated_phase === 'REGISTRATION';
};

/**
 * Checks if a semester is in the reviewing phase.
 */
export const isReviewingPhase = (semester: Semester | null | undefined): boolean => {
    if (!semester) return false;
    return semester.calculated_phase === 'REVIEWING';
};

/**
 * Checks if a supervisor can grade the thesis. 
 * Rule: Phase is 'FINAL' (after defense).
 */
export const canSupervisorGrade = (semester: Semester | null | undefined): boolean => {
    if (!semester) return false;
    return semester.calculated_phase === 'FINAL';
};

/**
 * Checks if a reviewer can grade the thesis.
 * Rule: Phase is 'REVIEWING'.
 */
export const canReviewerGrade = (semester: Semester | null | undefined): boolean => {
    if (!semester) return false;
    return semester.calculated_phase === 'REVIEWING';
};

/**
 * Checks if a committee member can grade the thesis.
 * Rule: Phase is 'DEFENSE'.
 */
export const canCommitteeGrade = (semester: Semester | null | undefined): boolean => {
    if (!semester) return false;
    return semester.calculated_phase === 'DEFENSE';
};

/**
 * Checks if midterm grading is currently active.
 */
export const canGradeMidterm = (semester: Semester | null | undefined): boolean => {
    if (!semester) return false;
    const now = new Date();
    const start = semester.midterm_start ? new Date(semester.midterm_start) : null;
    const end = semester.midterm_end ? new Date(semester.midterm_end) : null;
    
    return !!start && !!end && now >= start && now <= end;
};

/**
 * Checks if a semester is finalized/completed.
 */
export const isSemesterCompleted = (semester: Semester | null | undefined): boolean => {
    if (!semester) return false;
    return semester.status === 'COMPLETED' || semester.calculated_phase === 'FINAL';
};
