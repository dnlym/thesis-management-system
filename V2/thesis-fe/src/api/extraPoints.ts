import api from './client';
import type { ApiResponse, ExtraPoints, ExtraPointsStatus } from '@/types';

export interface ExtraPointsFilters {
    topicId?: string;
    studentId?: string;
    status?: ExtraPointsStatus;
}

export interface ExtraPointsStatusResponse {
    midtermPassed: boolean;
    confirmed: boolean;
    hasRequest: boolean;
    request: ExtraPoints | null;
}

export const ExtraPointsApi = {
    /**
     * Student submit extra points request
     * POST /extra-points
     */
    async create(data: {
        topicId: string;
        reason: string;
        pointsRequested: number;
        evidenceUrl?: string;
    }) {
        const res = await api.post<ApiResponse<ExtraPoints>>('/extra-points', data);
        return res.data.data;
    },

    /**
     * Upload evidence file
     * POST /extra-points/upload
     */
    async uploadEvidence(file: File) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('type', 'EXTRA_POINT_EVIDENCE'); // Required by safe upload middleware

        const res = await api.post<{ data: { url: string; filename: string; originalName: string } }>(
            '/extra-points/upload',
            formData,
            {
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
            }
        );
        return res.data.data;
    },

    /**
     * Get list of extra points requests
     * GET /extra-points
     */
    async getAll(filters?: ExtraPointsFilters) {
        const res = await api.get<ApiResponse<ExtraPoints[]>>('/extra-points', { params: filters });
        return res.data.data;
    },

    /**
     * Get extra points request detail
     * GET /extra-points/:id
     */
    async getById(id: string) {
        const res = await api.get<ApiResponse<ExtraPoints>>(`/extra-points/${id}`);
        return res.data.data;
    },

    /**
     * HEAD approve extra points request
     * POST /extra-points/:id/approve
     */
    async approve(id: string, approvedPoints: number) {
        const res = await api.post<ApiResponse<ExtraPoints>>(`/extra-points/${id}/approve`, { approvedPoints });
        return res.data.data;
    },

    /**
     * HEAD reject extra points request
     * POST /extra-points/:id/reject
     */
    async reject(id: string, rejectionReason: string) {
        const res = await api.post<ApiResponse<ExtraPoints>>(`/extra-points/${id}/reject`, { rejectionReason });
        return res.data.data;
    },

    /**
     * Student withdraw extra points request
     * DELETE /extra-points/:id
     */
    async withdraw(id: string) {
        const res = await api.delete<ApiResponse<void>>(`/extra-points/${id}`);
        return res.data.data;
    },

    /**
     * Confirm student has NO extra points
     * POST /extra-points/confirm-no-points
     */
    async confirmNoPoints(topicId: string) {
        const res = await api.post<ApiResponse<{ message: string }>>('/extra-points/confirm-no-points', { topicId });
        return res.data.data;
    },

    /**
     * Get my extra points status for a topic
     * GET /extra-points/my-status/:topicId
     */
    async getMyStatus(topicId: string) {
        const res = await api.get<ApiResponse<ExtraPointsStatusResponse>>(`/extra-points/my-status/${topicId}`);
        return res.data.data;
    },
};
