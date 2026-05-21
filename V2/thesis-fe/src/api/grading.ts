import api from './client';
import type { ApiResponse, Grade, GradingCriteria, FinalScore, GradeSubmissionForm, RaterRole } from '@/types';

export interface CriteriaFilters {
    role?: string;
    topicId?: string;
    departmentId?: string;
    criteriaType?: string;
}

export const GradingApi = {
    /**
     * Submit grades for a topic (optionally per-student)
     * POST /grading/submit
     * Body includes studentId for per-student grading
     */
    async submitGrade(data: GradeSubmissionForm) {
        // Map frontend format to backend format
        const payload = {
            topicId: data.topic_id,
            groupId: data.group_id,
            studentId: data.student_id,  // For per-student grading
            raterRole: data.rater_role,  // SUPERVISOR, REVIEWER, COMMITTEE
            reviewerOrder: data.reviewer_order,
            committeeRole: data.committee_role,
            reason: data.reason,
            grades: data.scores.map(s => ({
                criterionId: s.criterion_id,
                score: s.score,
                comments: s.comment,
            })),
        };
        const res = await api.post<ApiResponse<Grade>>('/grading/submit', payload);
        return res.data.data;
    },

    /**
     * Compute final score for a topic
     * POST /grading/:topicId/compute
     */
    async computeFinalScore(topicId: string) {
        const res = await api.post<ApiResponse<FinalScore>>(`/grading/${topicId}/compute`);
        return res.data.data;
    },

    /**
     * Finalize grades (HEAD only)
     * POST /grading/:topicId/finalize
     */
    async finalizeGrades(topicId: string) {
        const res = await api.post<ApiResponse<FinalScore>>(`/grading/${topicId}/finalize`);
        return res.data.data;
    },

    /**
     * Get grades for a topic
     * GET /grading/topics/:topicId/grades
     */
    async getTopicGrades(topicId: string) {
        const res = await api.get<ApiResponse<{
            advisorGrades: Grade[];
            reviewerGrades: Grade[];
            councilGrades: Grade[];
            reviewerAssignments: any[];
            councilAssignments: any[];
            finalScores: FinalScore[];
            permissions?: any;
            gradingStatus?: any;
            topic?: any;
        }>>(`/grading/${topicId}/grades`);
        return res.data.data;
    },

    /**
     * Get grade summary for all topics categorized for HOD dashboard
     * GET /grading/grade-summary
     */
    async getGradeSummary() {
        const res = await api.get<ApiResponse<{
            allTopics: any[];
            missingSupervisor: any[];
            missingReviewer: any[];
            ready: any[];
            finalized: any[];
        }>>('/grading/grade-summary');
        return res.data.data;
    },

    /**
     * Get current user's grades for a topic (for read-only confirmed state)
     * GET /grading/:topicId/my-grades
     */
    async getMyGrades(topicId: string, raterRole?: RaterRole, reviewerOrder?: number, committeeRole?: string) {
        const res = await api.get<ApiResponse<any>>(`/grading/${topicId}/my-grades`, {
            params: { raterRole, reviewerOrder, committeeRole }
        });
        return res.data.data;
    },

    /**
     * Create grading criterion (ADMIN only)
     * POST /grading/criteria
     */
    async createCriterion(data: Omit<GradingCriteria, 'id' | 'createdAt' | 'updatedAt'>) {
        const res = await api.post<ApiResponse<GradingCriteria>>('/grading/criteria', data);
        return res.data.data;
    },

    /**
     * Update grading criterion (ADMIN only)
     * PUT /grading/criteria/:id
     */
    async updateCriterion(id: string, data: Partial<Omit<GradingCriteria, 'id' | 'createdAt' | 'updatedAt'>>) {
        const res = await api.put<ApiResponse<GradingCriteria>>(`/grading/criteria/${id}`, data);
        return res.data.data;
    },

    /**
     * Delete grading criterion (ADMIN only)
     * DELETE /grading/criteria/:id
     */
    async deleteCriterion(id: string) {
        const res = await api.delete<ApiResponse<GradingCriteria>>(`/grading/criteria/${id}`);
        return res.data.data;
    },

    /**
     * Get grading criteria with filters
     * GET /grading/criteria
     */
    async getCriteria(filters?: CriteriaFilters) {
        const res = await api.get<ApiResponse<GradingCriteria[]>>('/grading/criteria', { params: filters });
        return res.data.data;
    },

    /**
     * Get registrations for midterm grading (SUPERVISOR only)
     * GET /grading/midterm
     */
    async getMidtermRegistrations() {
        const res = await api.get<ApiResponse<any[]>>('/grading/midterm');
        return res.data.data;
    },

    /**
     * Update midterm status (PASS/FAIL)
     * PUT /grading/midterm/:registrationId
     */
    async updateMidtermStatus(registrationId: string, data: { status: 'PASS' | 'FAIL'; feedback?: string }) {
        const res = await api.put<ApiResponse<any>>(`/grading/midterm/${registrationId}`, data);
        return res.data.data;
    },
    async getGradeHistoryByTopic(topicId: string) {
        const res = await api.get<ApiResponse<any[]>>(`/grading/${topicId}/history`);
        return res.data.data;
    },

    /**
     * Finalize grades for a specific group
     * POST /grading/groups/:groupId/finalize
     */
    async finalizeGroupGrades(groupId: string) {
        const res = await api.post<ApiResponse<any>>(`/grading/groups/${groupId}/finalize`);
        return res.data.data;
    },

    /**
     * Get global grade history with filters
     * GET /grading/history
     */
    async getGradeHistory(studentId?: string, groupId?: string) {
        const res = await api.get<ApiResponse<any[]>>('/grading/history', {
            params: { studentId, groupId }
        });
        return res.data.data;
    },

    /**
     * Get pending grade change requests (HOD only)
     */
    async getPendingChangeRequests() {
        const res = await api.get<ApiResponse<any[]>>('/grading/change-requests/pending');
        return res.data.data;
    },

    /**
     * Approve a grade change request
     */
    async approveChangeRequest(requestId: string) {
        const res = await api.post<ApiResponse<any>>(`/grading/change-requests/${requestId}/approve`);
        return res.data.data;
    },

    /**
     * Reject a grade change request
     */
    async rejectChangeRequest(requestId: string, reason: string) {
        const res = await api.post<ApiResponse<any>>(`/grading/change-requests/${requestId}/reject`, { reason });
        return res.data.data;
    },
};

