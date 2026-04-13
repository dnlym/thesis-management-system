import api from './client';
import type { ApiResponse, Submission, SubmissionVersion, SubmissionType } from '@/types';

export interface SubmissionFilters {
    topicId?: string;
    groupId?: string;
    type?: SubmissionType;
    status?: string;
}

export const SubmissionsApi = {
    /**
     * Upload a file submission
     * POST /submissions/upload
     */
    async upload(data: FormData) {
        const res = await api.post<ApiResponse<Submission>>('/submissions/upload', data, {
            headers: {
                'Content-Type': 'multipart/form-data',
            },
        });
        return res.data.data;
    },

    /**
     * Supervisor approve submission
     * PUT /submissions/:id/approve
     */
    async approve(id: string) {
        const res = await api.post<ApiResponse<Submission>>(`/submissions/${id}/approve`);
        return res.data.data;
    },

    /**
     * Supervisor request revision
     * PUT /submissions/:id/reject
     */
    async reject(id: string, rejectionReason: string) {
        const res = await api.post<ApiResponse<Submission>>(`/submissions/${id}/reject`, { rejectionReason });
        return res.data.data;
    },

    /**
     * HEAD lock submission
     * PUT /submissions/:id/lock
     */
    async lock(id: string) {
        const res = await api.post<ApiResponse<Submission>>(`/submissions/${id}/lock`);
        return res.data.data;
    },

    /**
     * HEAD unlock submission
     * PUT /submissions/:id/unlock
     */
    async unlock(id: string) {
        const res = await api.post<ApiResponse<Submission>>(`/submissions/${id}/unlock`);
        return res.data.data;
    },

    /**
     * Get list of submissions with filters
     * GET /submissions
     */
    async getAll(filters?: SubmissionFilters) {
        const res = await api.get<ApiResponse<Submission[]>>('/submissions', { params: filters });
        return res.data.data;
    },

    /**
     * Get version history of a submission
     * GET /submissions/:id/versions
     */
    async getVersions(submissionId: string) {
        const res = await api.get<ApiResponse<SubmissionVersion[]>>(`/submissions/${submissionId}/versions`);
        return res.data.data;
    },

    /**
     * Download a specific version
     * GET /submissions/versions/:versionId/download
     */
    async downloadVersion(versionId: string) {
        const res = await api.get(`/submissions/download/${versionId}`, {
            responseType: 'blob',
        });
        return res.data;
    },
};
