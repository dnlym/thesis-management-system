import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { NotificationsApi } from '@/api/notifications';
import { toast } from 'sonner';

/**
 * Query key factory for notifications
 */
export const notificationKeys = {
    all: ['notifications'] as const,
    lists: () => [...notificationKeys.all, 'list'] as const,
    list: (unreadOnly?: boolean) => [...notificationKeys.lists(), { unreadOnly }] as const,
    unreadCount: () => [...notificationKeys.all, 'unreadCount'] as const,
};

/**
 * Get list of notifications
 */
export function useNotifications(unreadOnly?: boolean) {
    return useQuery({
        queryKey: notificationKeys.list(unreadOnly),
        queryFn: () => NotificationsApi.getAll(unreadOnly),
        refetchInterval: 30000, // Poll every 30 seconds
    });
}

/**
 * Get unread notification count
 */
export function useUnreadCount() {
    return useQuery({
        queryKey: notificationKeys.unreadCount(),
        queryFn: () => NotificationsApi.getUnreadCount(),
        refetchInterval: 15000, // Poll every 15 seconds
    });
}

/**
 * Mark notification as read mutation
 */
export function useMarkAsRead() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (id: string) => NotificationsApi.markAsRead(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: notificationKeys.lists() });
            queryClient.invalidateQueries({ queryKey: notificationKeys.unreadCount() });
        },
        onError: (error: any) => {
            toast.error(error?.response?.data?.message || 'Đánh dấu đã đọc thất bại');
        },
    });
}

/**
 * Mark all notifications as read mutation
 */
export function useMarkAllAsRead() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: () => NotificationsApi.markAllAsRead(),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: notificationKeys.lists() });
            queryClient.invalidateQueries({ queryKey: notificationKeys.unreadCount() });
            toast.success('Đã đánh dấu tất cả là đã đọc');
        },
        onError: (error: any) => {
            toast.error(error?.response?.data?.message || 'Đánh dấu đã đọc thất bại');
        },
    });
}

/**
 * Delete notification mutation
 */
export function useDeleteNotification() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (id: string) => NotificationsApi.delete(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: notificationKeys.lists() });
            queryClient.invalidateQueries({ queryKey: notificationKeys.unreadCount() });
            toast.success('Xóa thông báo thành công');
        },
        onError: (error: any) => {
            toast.error(error?.response?.data?.message || 'Xóa thông báo thất bại');
        },
    });
}
