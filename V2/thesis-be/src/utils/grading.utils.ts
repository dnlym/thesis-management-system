import { RaterRole } from '@prisma/client';
import { ROLE_GROUP_MAP, RoleGroup, GRADING } from '../constants';

/**
 * Check if a rater role belongs to a specific group
 */
export const isRoleGroup = (role: RaterRole, group: RoleGroup): boolean => {
    return ROLE_GROUP_MAP[role] === group;
};

/**
 * Get the RoleGroup for a specific RaterRole
 */
export const getRoleGroup = (role: RaterRole): RoleGroup => {
    return ROLE_GROUP_MAP[role];
};

/**
 * Check if a role is a committee member
 */
export const isCommittee = (role: RaterRole): boolean => {
    return isRoleGroup(role, RoleGroup.COMMITTEE);
};

/**
 * Check if a role is a reviewer
 */
export const isReviewer = (role: RaterRole): boolean => {
    return isRoleGroup(role, RoleGroup.REVIEWER);
};

/**
 * Centralized rounding to 2 decimal places
 */
export const roundScore = (score: number): number => {
    return Math.round(score * 100) / 100;
};

/**
 * Calculate the weighted score for a set of criteria grades
 */
export const calculateWeightedScore = (grades: { score: number; criterion: { weight: number } }[]): number => {
    if (grades.length === 0) return 0;
    const score = grades.reduce((sum, grade) => sum + grade.score * grade.criterion.weight, 0);
    return roundScore(score);
};

/**
 * Production-grade final score calculator
 */
export const calculateFinalScore = (input: {
    supervisor: number;
    reviewerAvg: number;
    committeeAvg: number;
    bonus: number;
}): number => {
    const { supervisor, reviewerAvg, committeeAvg, bonus } = input;

    // 1. Calculate base weighted score
    const baseScore = (
        (supervisor * GRADING.WEIGHTS.SUPERVISOR) +
        (reviewerAvg * GRADING.WEIGHTS.REVIEWER) +
        (committeeAvg * GRADING.WEIGHTS.COMMITTEE)
    );

    // 2. Add bonus and clamp AFTER bonus
    const totalScore = baseScore + bonus;
    const clampedScore = Math.min(Math.max(totalScore, GRADING.CONFIG.MIN_SCORE), GRADING.CONFIG.MAX_SCORE);

    // 3. Round to 2 decimals
    return roundScore(clampedScore);
};

/**
 * Validate that all scores are within valid range
 */
export const validateScores = (scores: number[]): boolean => {
    return scores.every(s => typeof s === 'number' && s >= GRADING.CONFIG.MIN_SCORE && s <= GRADING.CONFIG.MAX_SCORE);
};

/**
 * Ensure all required grading components are present for finalization
 */
export const isGradingComplete = (input: {
    hasSupervisor: boolean;
    reviewerCount: number;
    committeeCount: number;
    defenseType?: string;
}): boolean => {
    if (!input.hasSupervisor) return false;

    // Check reviewers
    if (input.reviewerCount < GRADING.CONFIG.MIN_REVIEWERS) return false;

    // Check committee based on defense type
    const minCommittee = input.defenseType === 'POSTER'
        ? GRADING.CONFIG.MIN_POSTER
        : GRADING.CONFIG.MIN_ORAL;

    if (input.committeeCount < minCommittee) return false;

    return true;
};

/**
 * Get all rater roles belonging to a group
 */
export const getRolesByGroup = (group: RoleGroup): RaterRole[] => {
    return (Object.keys(ROLE_GROUP_MAP) as RaterRole[])
        .filter(role => ROLE_GROUP_MAP[role] === group);
};
