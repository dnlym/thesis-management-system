import api from './client';
import type { ApiResponse, Notification } from '@/types';

export const NotificationsApi = {
    /**
     * Get list of notifications
     * GET /notifications
     */
    async getAll(unreadOnly?: boolean) {
        const res = await api.get<ApiResponse<Notification[]>>('/notifications', {
            params: { unreadOnly },
        });
        return res.data.data;
    },

    /**
     * Mark notification as read
     * PUT /notifications/:id/read
     */
    async markAsRead(id: string) {
        const res = await api.put<ApiResponse<Notification>>(`/notifications/${id}/read`);
        return res.data.data;
    },

    /**
     * Mark all notifications as read
     * PUT /notifications/read-all
     */
    async markAllAsRead() {
        const res = await api.put<ApiResponse<null>>('/notifications/read-all');
        return res.data.data;
    },

    /**
     * Get unread notification count
     * GET /notifications/unread-count
     */
    async getUnreadCount() {
        const res = await api.get<ApiResponse<{ count: number }>>('/notifications/unread-count');
        return res.data.data;
    },

    /**
     * Delete notification
     * DELETE /notifications/:id
     */
    async delete(id: string) {
        const res = await api.delete<ApiResponse<null>>(`/notifications/${id}`);
        return res.data.data;
    },
};
