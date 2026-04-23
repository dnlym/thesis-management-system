import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { SemestersApi } from '@/api/semesters';
import type { Semester, CreateSemesterDto, UpdateSemesterDto } from '@/types';
import { message, notification } from 'antd';
import { semesterBroadcast } from '@/utils/broadcast';

const QUERY_KEY = 'semesters';

// Query key factory
export const semesterKeys = {
    all: [QUERY_KEY] as const,
    lists: () => [...semesterKeys.all, 'list'] as const,
    list: (filters: Record<string, any>) => [...semesterKeys.lists(), filters] as const,
    details: () => [...semesterKeys.all, 'detail'] as const,
    detail: (id: string) => [...semesterKeys.details(), id] as const,
};

/**
 * Helper to invalidate all workflow-relevant queries
 */
const invalidateWorkflowQueries = (queryClient: any) => {
    queryClient.invalidateQueries({
        predicate: (query: any) =>
            query.queryKey.some((key: string) =>
                ['semesters', 'active-semester', 'permissions', 'topics', 'topic', 'dashboard'].includes(key)
            )
    });
};

// Get all semesters
export function useSemesters() {
    return useQuery({
        queryKey: semesterKeys.lists(),
        queryFn: async () => {
            const response = await SemestersApi.getAll();
            return response;
        },
    });
}

// Get current active semester
export function useActiveSemester() {
    return useQuery({
        queryKey: [...semesterKeys.all, 'active'],
        queryFn: async () => {
            const response = await SemestersApi.getActive();
            return response;
        },
    });
}

// Get semester by ID
export function useSemester(id?: string) {
    return useQuery({
        queryKey: semesterKeys.detail(id!),
        queryFn: async () => {
            const response = await SemestersApi.getById(id!);
            return response;
        },
        enabled: !!id,
    });
}

// Create semester
export function useCreateSemester() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (data: CreateSemesterDto) => SemestersApi.create(data),
        onSuccess: (data: any) => {
            invalidateWorkflowQueries(queryClient);
            semesterBroadcast.postUpdate({
                semesterId: data.id,
                newPhase: data.calculated_phase,
                updatedAt: new Date().toISOString()
            });
            message.success('Tạo học kỳ thành công');
        }
    });
}

// Update semester
export function useUpdateSemester() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ id, data }: { id: string; data: UpdateSemesterDto }) =>
            SemestersApi.update(id, data),
        onSuccess: (data: any) => {
            // Precise invalidation + local feedback
            invalidateWorkflowQueries(queryClient);

            // Cross-tab broadcast (Ensures all UI elements like dates/names stay in sync)
            semesterBroadcast.postUpdate({
                semesterId: data.id,
                oldPhase: data.previous_phase,
                newPhase: data.calculated_phase,
                updatedAt: new Date().toISOString()
            });
            message.success('Cập nhật học kỳ thành công');
        }
    });
}

// Delete semester
export function useDeleteSemester() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (id: string) => SemestersApi.delete(id),
        onSuccess: () => {
            invalidateWorkflowQueries(queryClient);
            semesterBroadcast.postUpdate({
                semesterId: 'deleted',
                updatedAt: new Date().toISOString()
            });
            message.success('Xóa học kỳ thành công');
        },
        onError: () => {
            message.error('Xóa học kỳ thất bại');
        },
    });
}

// Activate semester (set as current)
export function useActivateSemester() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (id: string) => SemestersApi.activate(id),
        onSuccess: (data: any) => {
            invalidateWorkflowQueries(queryClient);
            semesterBroadcast.postUpdate({
                semesterId: data.id,
                newPhase: data.calculated_phase,
                updatedAt: new Date().toISOString()
            });
            message.success('Kích hoạt học kỳ thành công');
        },
        onError: (error: any) => {
            const errorMsg = error.response?.data?.error || error.response?.data?.message || 'Có lỗi xảy ra, vui lòng thử lại sau.';
            notification.error({
                message: 'Kích hoạt học kỳ thất bại',
                description: errorMsg,
                placement: 'topRight'
            });
        },
    });
}

// Finalize semester (move to COMPLETED)
export function useFinalizeSemester() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (id: string) => SemestersApi.finalize(id),
        onSuccess: (data: any) => {
            invalidateWorkflowQueries(queryClient);
            semesterBroadcast.postUpdate({
                semesterId: data.id,
                newPhase: data.calculated_phase,
                updatedAt: new Date().toISOString()
            });
            message.success('Tổng kết học kỳ thành công');
        },
        onError: (error: any) => {
            const errorMsg = error.response?.data?.error || error.response?.data?.message || 'Có lỗi xảy ra, vui lòng thử lại sau.';
            notification.error({
                message: 'Tổng kết học kỳ thất bại',
                description: errorMsg,
                placement: 'topRight'
            });
        },
    });
}
