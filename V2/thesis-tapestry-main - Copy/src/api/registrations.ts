import api from './client';
import type { ApiResponse, Registration, RegistrationStatus, RegistrationForm } from '@/types';

export interface RegistrationFilters {
    status?: RegistrationStatus;
    semesterId?: string;
    topicId?: string;
    studentId?: string;
    page?: number;
    size?: number;
}

export const RegistrationsApi = {
    /**
     * Student register for a topic
     * POST /registrations
     */
    async create(data: RegistrationForm) {
        const res = await api.post<ApiResponse<Registration>>('/registrations', data);
        return res.data.data;
    },

    /**
     * Student register for a topic individually (no group required)
     * POST /api/registrations/topic/:topicId
     */
    async registerIndividual(topicId: string) {
        const res = await api.post<ApiResponse<Registration>>(`/registrations/topic/${topicId}`);
        return res.data.data;
    },

    /**
     * GVHD registers a topic on behalf of a student
     * POST /registrations/register-for-student
     */
    async registerForStudent(studentId: string, topicId: string) {
        const res = await api.post<ApiResponse<Registration>>('/registrations/register-for-student', { studentId, topicId });
        return res.data.data;
    },

    /**
     * Get my topic registration for current semester
     * GET /registrations/my-topic
     */
    async getMyTopic() {
        const res = await api.get<ApiResponse<any>>('/registrations/my-topic');
        return res.data.data;
    },

    /**
     * Get students registered for the same topic
     * GET /registrations/topic/:topicId/students
     */
    async getStudentsSameTopic(topicId: string) {
        const res = await api.get<ApiResponse<any>>(`/registrations/topic/${topicId}/students`);
        return res.data.data;
    },

    /**
     * Create group with another student
     * POST /registrations/topic/:topicId/create-group
     */
    async createGroup(topicId: string, partnerId: string) {
        const res = await api.post<ApiResponse<any>>(`/registrations/topic/${topicId}/create-group`, { partnerId });
        return res.data.data;
    },

    /**
     * Get list of registrations with filters
     * GET /registrations
     */
    async getAll(filters?: RegistrationFilters) {
        const res = await api.get<ApiResponse<Registration[]>>('/registrations', { params: filters });
        return res.data.data;
    },

    /**
     * Get registration detail
     * GET /registrations/:id
     */
    async getById(id: string) {
        const res = await api.get<ApiResponse<Registration>>(`/registrations/${id}`);
        return res.data.data;
    },

    /**
     * Supervisor confirm registration
     * PUT /registrations/:id/confirm
     */
    async confirm(id: string) {
        const res = await api.put<ApiResponse<Registration>>(`/registrations/${id}/confirm`);
        return res.data.data;
    },

    /**
     * Supervisor reject registration
     * PUT /registrations/:id/reject
     */
    async reject(id: string, rejectionReason: string) {
        const res = await api.put<ApiResponse<Registration>>(`/registrations/${id}/reject`, { rejectionReason });
        return res.data.data;
    },

    /**
     * Student cancel individual registration
     * DELETE /registrations/my-topic
     */
    async cancelIndividual() {
        const res = await api.delete<ApiResponse<any>>('/registrations/my-topic');
        return res.data.data;
    },

    /**
     * Update student progress status
     * PUT /registrations/:id/progress
     */
    async updateProgress(id: string, status: string, feedback?: string) {
        const res = await api.put<ApiResponse<Registration>>(`/registrations/${id}/progress`, { status, feedback });
        return res.data.data;
    },

    /**
     * Get registration activity logs
     * GET /registrations/:id/logs
     */
    async getLogs(id: string) {
        const res = await api.get<ApiResponse<any[]>>(`/registrations/${id}/logs`);
        return res.data.data;
    },

    // =====================================================
    // GROUP INVITE SYSTEM
    // =====================================================

    /**
     * Search student by MSSV for invite
     * GET /registrations/topic/:topicId/search-student?studentCode=xxx
     */
    async searchStudentForInvite(topicId: string, studentCode: string) {
        const res = await api.get<ApiResponse<any>>(`/registrations/topic/${topicId}/search-student`, {
            params: { studentCode }
        });
        return res.data.data;
    },

    /**
     * Send group invite
     * POST /registrations/topic/:topicId/invite
     */
    async sendInvite(topicId: string, studentCode: string) {
        const res = await api.post<ApiResponse<any>>(`/registrations/topic/${topicId}/invite`, { studentCode });
        return res.data.data;
    },

    /**
     * Get my invites (sent and received)
     * GET /registrations/invites
     */
    async getMyInvites(topicId?: string) {
        const res = await api.get<ApiResponse<{ sentInvites: any[]; receivedInvites: any[] }>>('/registrations/invites', {
            params: topicId ? { topicId } : {}
        });
        return res.data.data;
    },

    /**
     * Accept an invite
     * POST /registrations/invites/:inviteId/accept
     */
    async acceptInvite(inviteId: string) {
        const res = await api.post<ApiResponse<any>>(`/registrations/invites/${inviteId}/accept`);
        return res.data.data;
    },

    /**
     * Reject an invite
     * POST /registrations/invites/:inviteId/reject
     */
    async rejectInvite(inviteId: string) {
        const res = await api.post<ApiResponse<any>>(`/registrations/invites/${inviteId}/reject`);
        return res.data.data;
    },

    /**
     * Cancel an invite I sent
     * DELETE /registrations/invites/:inviteId
     */
    async cancelInvite(inviteId: string) {
        const res = await api.delete<ApiResponse<any>>(`/registrations/invites/${inviteId}`);
        return res.data.data;
    },

    /**
     * Disband my group
     * DELETE /registrations/my-group
     */
    async disbandGroup() {
        const res = await api.delete<ApiResponse<any>>('/registrations/my-group');
        return res.data.data;
    },

    /**
     * Remove member from group (Leader only)
     * POST /groups/remove-member
     */
    async removeMember(groupId: string, userId: string) {
        const res = await api.post<ApiResponse<any>>('/groups/remove-member', { groupId, userId });
        return res.data.data;
    },

    /**
     * Request change leader (Member only)
     * POST /groups/change-leader
     */
    async changeLeader(groupId: string, newLeaderId: string, reason: string) {
        const res = await api.post<ApiResponse<any>>('/groups/change-leader', { groupId, newLeaderId, reason });
        return res.data.data;
    },
};
