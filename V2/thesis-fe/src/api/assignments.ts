import api from './client';
import type { ApiResponse, Assignment, AssignmentType, DefenseSchedule, DefenseScheduleForm, ReviewerAssignmentForm } from '@/types';

export interface AssignmentFilters {
    topicId?: string;
    assignmentType?: AssignmentType;
    teacherId?: string;
    status?: string;
}

export const AssignmentsApi = {
    /**
     * Assign a reviewer to a topic
     * POST /assignments/reviewer
     */
    async assignReviewer(data: ReviewerAssignmentForm) {
        const res = await api.post<ApiResponse<Assignment>>('/assignments/reviewer', data);
        return res.data.data;
    },

    /**
     * Reviewer accept assignment
     * POST /assignments/:id/accept
     */
    async accept(id: string) {
        const res = await api.post<ApiResponse<Assignment>>(`/assignments/${id}/accept`);
        return res.data.data;
    },

    /**
     * Reviewer decline assignment
     * POST /assignments/:id/decline
     */
    async decline(id: string, declineReason: string) {
        const res = await api.post<ApiResponse<Assignment>>(`/assignments/${id}/decline`, { declineReason });
        return res.data.data;
    },

    /**
     * Create defense schedule with committee
     * POST /assignments/defense-schedule
     */
    async createDefenseSchedule(data: DefenseScheduleForm) {
        const res = await api.post<ApiResponse<DefenseSchedule>>('/assignments/defense-schedule', data);
        return res.data.data;
    },

    /**
     * Get list of assignments with filters
     * GET /assignments
     */
    async getAll(filters?: AssignmentFilters) {
        const res = await api.get<ApiResponse<Assignment[]>>('/assignments', { params: filters });
        return res.data.data;
    },

    /**
     * Cancel/delete an assignment
     * DELETE /assignments/:id
     */
    async delete(id: string) {
        const res = await api.delete<ApiResponse<null>>(`/assignments/${id}`);
        return res.data.data;
    },

    // ============ HEAD-only methods ============

    /**
     * Get topics eligible for reviewer assignment
     * GET /assignments/topics-for-reviewer
     */
    async getTopicsForReviewerAssignment() {
        const res = await api.get<ApiResponse<any[]>>('/assignments/topics-for-reviewer');
        return res.data.data;
    },

    /**
     * Get topics eligible for committee assignment
     * GET /assignments/topics-for-committee
     */
    async getTopicsForCommitteeAssignment() {
        const res = await api.get<ApiResponse<{ topics: any[], deptDefenseDate: string | null }>>('/assignments/topics-for-committee');
        return res.data.data;
    },

    /**
     * Get all potential reviewers for a department (HEAD only)
     * GET /assignments/available-reviewers
     */
    async getAvailableReviewersForDepartment() {
        const res = await api.get<ApiResponse<any[]>>('/assignments/available-reviewers');
        return res.data.data;
    },

    /**
     * Get available reviewers for a topic (excluding GVHD)
     * GET /assignments/available-reviewers/:topicId
     */
    async getAvailableReviewers(topicId: string) {
        const res = await api.get<ApiResponse<any[]>>(`/assignments/available-reviewers/${topicId}`);
        return res.data.data;
    },

    /**
     * Assign committee members to a topic
     * POST /assignments/committee
     */
    async assignCommittee(data: {
        topicId: string;
        chairId: string;
        secretaryId: string;
        memberIds: string[];
        defenseDate: string;
    }) {
        const res = await api.post<ApiResponse<any>>('/assignments/committee', data);
        return res.data.data;
    },

    /**
     * Update defense type of a topic (HEAD only)
     * PATCH /assignments/:topicId/defense-type
     */
    async updateDefenseType(topicId: string, type: 'ORAL' | 'POSTER' | null) {
        const res = await api.patch<ApiResponse<any>>(`/assignments/${topicId}/defense-type`, { type });
        return res.data.data;
    },

    /**
     * Update reviewer schedule (date, start/end time, room/Zoom details)
     * PUT /assignments/reviewer/schedule
     */
    async updateReviewerSchedule(data: {
        topicId: string;
        groupId: string;
        defenseFormat: 'ONLINE' | 'OFFLINE';
        room?: string;
        zoomPassword?: string;
        startTime?: string;
        endTime?: string;
    }) {
        const res = await api.put<ApiResponse<any>>('/assignments/reviewer/schedule', data);
        return res.data.data;
    },
};
