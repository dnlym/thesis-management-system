import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AssignmentsApi, type AssignmentFilters } from '@/api/assignments';
import type { ReviewerAssignmentForm, DefenseScheduleForm } from '@/types';
import { Alert } from 'react-native';
import { useAuthStore } from '@/store/auth';

/**
 * Query key factory for assignments
 */
export const assignmentKeys = {
    all: ['assignments'] as const,
    lists: () => [...assignmentKeys.all, 'list'] as const,
    list: (filters?: AssignmentFilters) => [...assignmentKeys.lists(), filters] as const,
};

/**
 * Get list of assignments with filters
 */
export function useAssignments(filters?: AssignmentFilters) {
    const { isAuthenticated } = useAuthStore();
    return useQuery({
        queryKey: assignmentKeys.list(filters),
        queryFn: async () => {
            const response = await AssignmentsApi.getAll(filters);
            return response;
        },
        enabled: isAuthenticated,
    });
}

/**
 * Assign reviewer mutation
 */
export function useAssignReviewer() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (data: ReviewerAssignmentForm) => AssignmentsApi.assignReviewer(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: assignmentKeys.lists() });
            Alert.alert('Thành công', 'Phân công phản biện thành công');
        },
        onError: (error: any) => {
            Alert.alert('Lỗi', error?.response?.data?.message || 'Phân công phản biện thất bại');
        },
    });
}

/**
 * Accept assignment mutation
 */
export function useAcceptAssignment() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (id: string) => AssignmentsApi.accept(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: assignmentKeys.lists() });
            Alert.alert('Thành công', 'Đã chấp nhận phân công');
        },
        onError: (error: any) => {
            Alert.alert('Lỗi', error?.response?.data?.message || 'Chấp nhận phân công thất bại');
        },
    });
}

/**
 * Decline assignment mutation
 */
export function useDeclineAssignment() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ id, reason }: { id: string; reason: string }) => AssignmentsApi.decline(id, reason),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: assignmentKeys.lists() });
            Alert.alert('Thành công', 'Đã từ chối phân công');
        },
        onError: (error: any) => {
            Alert.alert('Lỗi', error?.response?.data?.message || 'Từ chối phân công thất bại');
        },
    });
}

/**
 * Create defense schedule mutation
 */
export function useCreateDefenseSchedule() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (data: DefenseScheduleForm) => AssignmentsApi.createDefenseSchedule(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: assignmentKeys.lists() });
            Alert.alert('Thành công', 'Tạo lịch bảo vệ thành công');
        },
        onError: (error: any) => {
            Alert.alert('Lỗi', error?.response?.data?.message || 'Tạo lịch bảo vệ thất bại');
        },
    });
}

/**
 * Delete assignment mutation
 */
export function useDeleteAssignment() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (id: string) => AssignmentsApi.delete(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: assignmentKeys.lists() });
            Alert.alert('Thành công', 'Xóa phân công thành công');
        },
        onError: (error: any) => {
            Alert.alert('Lỗi', error?.response?.data?.message || 'Xóa phân công thất bại');
        },
    });
}
