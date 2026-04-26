import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ExtraPointsApi, type ExtraPointsFilters } from '@/api/extraPoints';
import { toast } from 'sonner';

/**
 * Query key factory for extra points
 */
export const extraPointsKeys = {
    all: ['extraPoints'] as const,
    lists: () => [...extraPointsKeys.all, 'list'] as const,
    list: (filters?: ExtraPointsFilters) => [...extraPointsKeys.lists(), filters] as const,
    details: () => [...extraPointsKeys.all, 'detail'] as const,
    detail: (id: string) => [...extraPointsKeys.details(), id] as const,
};

/**
 * Get list of extra points requests
 */
export function useExtraPoints(filters?: ExtraPointsFilters) {
    return useQuery({
        queryKey: extraPointsKeys.list(filters),
        queryFn: async () => {
            const response = await ExtraPointsApi.getAll(filters);
            return response;
        },
    });
}

/**
 * Get extra points request detail
 */
export function useExtraPointRequest(id: string | undefined) {
    return useQuery({
        queryKey: extraPointsKeys.detail(id!),
        queryFn: async () => {
            const response = await ExtraPointsApi.getById(id!);
            return response;
        },
        enabled: !!id,
    });
}

/**
 * Student create extra points request mutation
 */
export function useCreateExtraPointsRequest() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (data: {
            topicId: string;
            reason: string;
            pointsRequested: number;
            evidenceUrl?: string;
        }) => ExtraPointsApi.create(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: extraPointsKeys.lists() });
            toast.success('Gửi yêu cầu cộng điểm thành công');
        },
        onError: (error: any) => {
            toast.error(error?.response?.data?.message || 'Gửi yêu cầu cộng điểm thất bại');
        },
    });
}

/**
 * HEAD approve extra points mutation
 */
export function useApproveExtraPoints() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ id, approvedPoints }: { id: string; approvedPoints: number }) =>
            ExtraPointsApi.approve(id, approvedPoints),
        onSuccess: (response, variables) => {
            queryClient.invalidateQueries({ queryKey: extraPointsKeys.lists() });
            queryClient.invalidateQueries({ queryKey: extraPointsKeys.detail(variables.id) });
            toast.success('Phê duyệt cộng điểm thành công');
        },
        onError: (error: any) => {
            toast.error(error?.response?.data?.message || 'Phê duyệt cộng điểm thất bại');
        },
    });
}

/**
 * HEAD reject extra points mutation
 */
export function useRejectExtraPoints() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ id, reason }: { id: string; reason: string }) =>
            ExtraPointsApi.reject(id, reason),
        onSuccess: (response, variables) => {
            queryClient.invalidateQueries({ queryKey: extraPointsKeys.lists() });
            queryClient.invalidateQueries({ queryKey: extraPointsKeys.detail(variables.id) });
            toast.success('Từ chối cộng điểm thành công');
        },
        onError: (error: any) => {
            toast.error(error?.response?.data?.message || 'Từ chối cộng điểm thất bại');
        },
    });
}

/**
 * Student withdraw extra points request mutation
 */
export function useWithdrawExtraPoints() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (id: string) => ExtraPointsApi.withdraw(id),
        onSuccess: (response, id) => {
            queryClient.invalidateQueries({ queryKey: extraPointsKeys.lists() });
            queryClient.invalidateQueries({ queryKey: extraPointsKeys.detail(id) });
            toast.success('Rút yêu cầu cộng điểm thành công');
        },
        onError: (error: any) => {
            toast.error(error?.response?.data?.message || 'Rút yêu cầu cộng điểm thất bại');
        },
    });
}
