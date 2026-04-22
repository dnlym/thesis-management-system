import api from './client';
import type { ApiResponse, Topic, TopicForm, TopicStatus } from '@/types';

export interface TopicFilters {
    status?: TopicStatus | TopicStatus[];
    semesterId?: string;
    departmentId?: string;
    supervisorId?: string;
    search?: string;
    page?: number;
    size?: number;
    midtermStatus?: 'PASS' | 'FAIL';
}

export const TopicsApi = {
    /**
     * Create a new topic
     * POST /topics
     */
    async create(data: TopicForm) {
        const res = await api.post<ApiResponse<Topic>>('/topics', data);
        return res.data.data;
    },

    /**
     * Get list of topics with filters
     * GET /topics
     */
    async getAll(filters?: TopicFilters & { includeAll?: boolean }) {
        const res = await api.get<ApiResponse<{ topics: Topic[], pagination: any }>>('/topics', { params: filters });
        return res.data.data;
    },

    /**
     * Clone a topic into a new semester
     * POST /topics/:id/clone
     */
    async clone(topicId: string, semesterId: string) {
        const res = await api.post<ApiResponse<Topic>>(`/topics/${topicId}/clone`, { semesterId });
        return res.data.data;
    },

    /**
     * Get topic detail by ID
     * GET /topics/:id
     */
    async getById(id: string) {
        const res = await api.get<ApiResponse<Topic>>(`/topics/${id}`);
        return res.data.data;
    },

    /**
     * Update topic
     * PUT /topics/:id
     */
    async update(id: string, data: Partial<TopicForm>) {
        const res = await api.put<ApiResponse<Topic>>(`/topics/${id}`, data);
        return res.data.data;
    },

    /**
     * Delete topic
     * DELETE /topics/:id
     */
    async delete(id: string) {
        const res = await api.delete<ApiResponse<null>>(`/topics/${id}`);
        return res.data.data;
    },

    /**
     * Approve topic (HEAD only)
     * PUT /topics/:id/approve
     */
    async approve(id: string) {
        const res = await api.post<ApiResponse<Topic>>(`/topics/${id}/approve`);
        return res.data.data;
    },

    /**
     * Reject topic (HEAD only)
     * PUT /topics/:id/reject
     */
    async reject(id: string, rejectionReason: string) {
        const res = await api.post<ApiResponse<Topic>>(`/topics/${id}/reject`, { rejectionReason });
        return res.data.data;
    },

    /**
     * Submit topic for approval (SUPERVISOR only)
     * PUT /topics/:id/submit
     */
    async submitForApproval(id: string) {
        const res = await api.put<ApiResponse<Topic>>(`/topics/${id}/submit`);
        return res.data.data;
    },

    /**
     * Require edit (HEAD only)
     * PUT /topics/:id/require-edit
     */
    async requireEdit(id: string, notes: string) {
        const res = await api.put<ApiResponse<Topic>>(`/topics/${id}/require-edit`, { notes });
        return res.data.data;
    },

    /**
     * Hide a topic (SUPERVISOR only)
     * POST /topics/:id/hide
     */
    async hide(id: string) {
        const res = await api.post<ApiResponse<Topic>>(`/topics/${id}/hide`);
        return res.data;
    },

    /**
     * Unhide a topic (restore to previous status)
     * POST /topics/:id/unhide
     */
    async unhide(id: string) {
        const res = await api.post<ApiResponse<Topic>>(`/topics/${id}/unhide`);
        return res.data;
    },

    /**
     * Get topic approval history
     * GET /topics/:id/history
     */
    async getHistory(id: string) {
        const res = await api.get<ApiResponse<any>>(`/topics/${id}/history`);
        return res.data.data;
    },

    /**
     * Get topic statistics (counts by status)
     * GET /topics/stats
     */
    async getStats() {
        const res = await api.get<ApiResponse<Record<string, number>>>('/topics/stats');
        return res.data.data;
    },
    /**
     * Finalize defense eligibility and type (HEAD only)
     * POST /topics/:id/finalize-defense-pivot
     */
    async finalizeDefensePivot(id: string, data: { isEligible: boolean; defenseType?: string }) {
        const res = await api.post<ApiResponse<Topic>>(`/topics/${id}/finalize-defense-pivot`, data);
        return res.data;
    },
};
