import api from './client';
import type {
    ApiResponse,
    Grade,
    GradingCriteria,
    FinalScore,
    GradeSubmissionForm,
    GradeSubmissionResult,
    RaterRole,
} from '@/types';

/**
 * Filters for grading criteria
 */
export interface CriteriaFilters {
    semesterId?: string;
    gradingPhase?: string;
    raterRole?: string;
    isActive?: boolean;
}

/**
 * Normalize frontend role to backend canonical role
 */
const getBackendCanonicalRole = (role: string): string => {
    if (role === 'SUPERVISOR') return 'SUPERVISOR';

    if (role.startsWith('REVIEWER')) {
        return 'REVIEWER';
    }

    if (role.startsWith('COMMITTEE') || role.includes('COUNCIL')) {
        return 'COMMITTEE';
    }

    return role;
};

export const GradingApi = {
    /**
     * Submit grades
     */
    async submitGrade(data: GradeSubmissionForm) {
        const canonicalRole = getBackendCanonicalRole(data.rater_role);

        const payload = {
            topicId: data.topic_id,
            groupId: data.group_id,
            studentId: data.student_id,
            raterRole: canonicalRole,
            reviewerOrder: data.reviewer_order,
            committeeRole: data.committee_role,

            grades: data.scores.map((s) => ({
                criterionId: s.criterion_id,
                score: s.score,
                comments: s.comment || '',
            })),

            generalComment: (data as any).general_comment || '',
        };

        const res = await api.post<ApiResponse<GradeSubmissionResult>>(
            '/grading/submit',
            payload
        );

        return res.data.data;
    },

    /**
     * Get grade summary for all topics categorized for HOD dashboard
     * GET /grading/grade-summary
     */
    async getGradeSummary() {
        const res = await api.get<ApiResponse<any>>(
            '/grading/grade-summary'
        );
        return res.data.data;
    },

    /**
     * Get my grades
     */
    async getMyGrades(topicId: string, raterRole?: string) {
    const canonicalRole = raterRole
        ? getBackendCanonicalRole(raterRole)
        : undefined;

    // console.log('FETCH ROLE:', canonicalRole);

    const res = await api.get<ApiResponse<any>>(
        `/grading/${topicId}/my-grades`,
        {
            params: {
                raterRole: canonicalRole,
            },
        }
    );

    return res.data.data;
},

    /**
     * Get all grades of topic
     */
    async getTopicGrades(topicId: string) {
        const res = await api.get<ApiResponse<any>>(
            `/grading/${topicId}/grades`
        );

        return res.data.data;
    },

    /**
     * Compute final score
     */
    async computeFinalScore(topicId: string) {
        const res = await api.post<ApiResponse<any>>(
            `/grading/${topicId}/compute-final`
        );

        return res.data.data;
    },

    /**
     * Finalize grades
     */
    async finalizeGrades(topicId: string) {
        const res = await api.post<ApiResponse<any>>(
            `/grading/${topicId}/finalize`
        );

        return res.data.data;
    },

    /**
     * Create grading criterion
     */
    async createCriterion(
        data: Omit<
            GradingCriteria,
            'id' | 'createdAt' | 'updatedAt'
        >
    ) {
        const res = await api.post<ApiResponse<GradingCriteria>>(
            '/grading/criteria',
            data
        );

        return res.data.data;
    },

    /**
     * Update grading criterion
     */
    async updateCriterion(
        id: string,
        data: Partial<
            Omit<
                GradingCriteria,
                'id' | 'createdAt' | 'updatedAt'
            >
        >
    ) {
        const res = await api.put<ApiResponse<GradingCriteria>>(
            `/grading/criteria/${id}`,
            data
        );

        return res.data.data;
    },

    /**
     * Delete grading criterion
     */
    async deleteCriterion(id: string) {
        const res = await api.delete<ApiResponse<GradingCriteria>>(
            `/grading/criteria/${id}`
        );

        return res.data.data;
    },

    /**
     * Get grading criteria
     */
    async getCriteria(filters?: CriteriaFilters) {
        const res = await api.get<ApiResponse<GradingCriteria[]>>(
            '/grading/criteria',
            {
                params: filters,
            }
        );

        return res.data.data;
    },

    /**
     * Get midterm registrations
     */
    async getMidtermRegistrations() {
        const res = await api.get<ApiResponse<any[]>>(
            '/grading/midterm'
        );

        return res.data.data;
    },

    /**
     * Update midterm status
     */
    async updateMidtermStatus(
        registrationId: string,
        data: {
            status: 'PASS' | 'FAIL';
            feedback?: string;
        }
    ) {
        const res = await api.put<ApiResponse<any>>(
            `/grading/midterm/${registrationId}`,
            data
        );

        return res.data.data;
    },
};