import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { TopicsApi, type TopicFilters } from '@/api/topics';
import type { TopicForm } from '@/types';
import { toast } from 'sonner';

/**
 * Query key factory for topics
 */
export const topicKeys = {
    all: ['topics'] as const,
    lists: () => [...topicKeys.all, 'list'] as const,
    list: (filters?: TopicFilters) => [...topicKeys.lists(), filters] as const,
    details: () => [...topicKeys.all, 'detail'] as const,
    detail: (id: string) => [...topicKeys.details(), id] as const,
    stats: () => [...topicKeys.all, 'stats'] as const,
};

/**
 * Get list of topics with filters
 */
export function useTopics(filters?: TopicFilters & { includeAll?: boolean }) {
    return useQuery({
        queryKey: topicKeys.list(filters),
        queryFn: async () => {
            const response = await TopicsApi.getAll(filters);
            return response;
        },
        placeholderData: (previousData) => previousData,
        // Enable the query if we have a semester filter, includeAll, OR if we're filtering by status (common for HEAD/ADMIN)
        enabled: !!(filters?.semesterId || filters?.includeAll || filters?.status || !filters),
    });
}

/**
 * Clone topic mutation
 */
export function useCloneTopic() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ topicId, semesterId }: { topicId: string; semesterId: string }) =>
            TopicsApi.clone(topicId, semesterId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: topicKeys.lists() });
            queryClient.invalidateQueries({ queryKey: topicKeys.stats() });
            toast.success('Sao chép đề tài thành công');
        },
        onError: (error: any) => {
            toast.error(error?.response?.data?.message || 'Sao chép đề tài thất bại');
        },
    });
}

/**
 * Get topic statistics (counts by status)
 */
export function useTopicStats() {
    return useQuery({
        queryKey: topicKeys.stats(),
        queryFn: async () => {
            const response = await TopicsApi.getStats();
            return response;
        },
    });
}

/**
 * Get topic detail by ID
 */
export function useTopic(id: string | undefined) {
    return useQuery({
        queryKey: topicKeys.detail(id!),
        queryFn: async () => {
            const response = await TopicsApi.getById(id!);
            return response;
        },
        enabled: !!id,
    });
}

/**
 * Create new topic mutation
 */
export function useCreateTopic() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (data: TopicForm) => TopicsApi.create(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: topicKeys.lists() });
            queryClient.invalidateQueries({ queryKey: topicKeys.stats() });
            toast.success('Tạo đề tài thành công');
        },
        onError: (error: any) => {
            const errorMsg = error?.response?.data?.message || error?.response?.data?.error || 'Tạo đề tài thất bại';
            toast.error(errorMsg);
        },
    });
}

/**
 * Update topic mutation
 */
export function useUpdateTopic() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ id, data }: { id: string; data: Partial<TopicForm> }) =>
            TopicsApi.update(id, data),
        onSuccess: (response, variables) => {
            queryClient.invalidateQueries({ queryKey: topicKeys.lists() });
            queryClient.invalidateQueries({ queryKey: topicKeys.stats() });
            queryClient.invalidateQueries({ queryKey: topicKeys.detail(variables.id) });
            toast.success('Cập nhật đề tài thành công');
        },
        onError: (error: any) => {
            toast.error(error?.response?.data?.message || 'Cập nhật đề tài thất bại');
        },
    });
}

/**
 * Delete topic mutation
 */
export function useDeleteTopic() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (id: string) => TopicsApi.delete(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: topicKeys.lists() });
            queryClient.invalidateQueries({ queryKey: topicKeys.stats() });
            toast.success('Xóa đề tài thành công');
        },
        onError: (error: any) => {
            toast.error(error?.response?.data?.message || 'Xóa đề tài thất bại');
        },
    });
}

/**
 * Approve topic mutation (HEAD only)
 */
export function useApproveTopic() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (id: string) => TopicsApi.approve(id),
        onSuccess: (response, id) => {
            queryClient.invalidateQueries({ queryKey: topicKeys.lists() });
            queryClient.invalidateQueries({ queryKey: topicKeys.stats() });
            queryClient.invalidateQueries({ queryKey: topicKeys.detail(id) });
            toast.success('Phê duyệt đề tài thành công');
        },
        onError: (error: any) => {
            toast.error(error?.response?.data?.message || 'Phê duyệt đề tài thất bại');
        },
    });
}

/**
 * Reject topic mutation (HEAD only)
 */
export function useRejectTopic() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ id, reason }: { id: string; reason: string }) =>
            TopicsApi.reject(id, reason),
        onSuccess: (response, variables) => {
            queryClient.invalidateQueries({ queryKey: topicKeys.lists() });
            queryClient.invalidateQueries({ queryKey: topicKeys.stats() });
            queryClient.invalidateQueries({ queryKey: topicKeys.detail(variables.id) });
            toast.success('Từ chối đề tài thành công');
        },
        onError: (error: any) => {
            const data = error?.response?.data;
            const errorMsg = data?.errors?.[0]?.msg || data?.message || 'Từ chối đề tài thất bại';
            toast.error(errorMsg);
        },
    });
}

/**
 * Submit topic for approval mutation (SUPERVISOR only)
 */
export function useSubmitForApproval() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (id: string) => TopicsApi.submitForApproval(id),
        onSuccess: (response, id) => {
            queryClient.invalidateQueries({ queryKey: topicKeys.lists() });
            queryClient.invalidateQueries({ queryKey: topicKeys.stats() });
            queryClient.invalidateQueries({ queryKey: topicKeys.detail(id) });
            toast.success('Đã gửi đề tài chờ duyệt');
        },
        onError: (error: any) => {
            const errorMsg = error?.response?.data?.message || 'Gửi đề tài thất bại';
            toast.error(errorMsg);
        },
    });
}

/**
 * Require edit mutation (HEAD only)
 */
export function useRequireEdit() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ id, notes }: { id: string; notes: string }) =>
            TopicsApi.requireEdit(id, notes),
        onSuccess: (response, variables) => {
            queryClient.invalidateQueries({ queryKey: topicKeys.lists() });
            queryClient.invalidateQueries({ queryKey: topicKeys.stats() });
            queryClient.invalidateQueries({ queryKey: topicKeys.detail(variables.id) });
            toast.success('Đã yêu cầu chỉnh sửa');
        },
        onError: (error: any) => {
            const data = error?.response?.data;
            const errorMsg = data?.errors?.[0]?.msg || data?.message || 'Yêu cầu chỉnh sửa thất bại';
            toast.error(errorMsg);
        },
    });
}

/**
 * Hide topic mutation (SUPERVISOR can hide their own topics)
 */
export function useHideTopic() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (id: string) => TopicsApi.hide(id),
        onSuccess: (response, id) => {
            queryClient.invalidateQueries({ queryKey: topicKeys.lists() });
            queryClient.invalidateQueries({ queryKey: topicKeys.stats() });
            queryClient.invalidateQueries({ queryKey: topicKeys.detail(id) });
            toast.success('Đã ẩn đề tài');
        },
        onError: (error: any) => {
            toast.error(error?.response?.data?.error || 'Ẩn đề tài thất bại');
        },
    });
}

/**
 * Unhide topic mutation (restore to previous status)
 */
export function useUnhideTopic() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (id: string) => TopicsApi.unhide(id),
        onSuccess: (response, id) => {
            queryClient.invalidateQueries({ queryKey: topicKeys.lists() });
            queryClient.invalidateQueries({ queryKey: topicKeys.stats() });
            queryClient.invalidateQueries({ queryKey: topicKeys.detail(id) });
            toast.success('Đã hiện đề tài');
        },
        onError: (error: any) => {
            toast.error(error?.response?.data?.error || 'Hiện đề tài thất bại');
        },
    });
}

/**
 * Get topic approval history
 */
export function useTopicHistory(id: string | undefined) {
    return useQuery({
        queryKey: [...topicKeys.detail(id!), 'history'],
        queryFn: async () => {
            const response = await TopicsApi.getHistory(id!);
            return response;
        },
        enabled: !!id,
    });
}
