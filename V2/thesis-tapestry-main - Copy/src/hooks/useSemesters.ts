import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { SemestersApi } from '@/api/semesters';
import type { Semester, CreateSemesterDto, UpdateSemesterDto } from '@/types';
import { message } from 'antd';

const QUERY_KEY = 'semesters';

// Query key factory
export const semesterKeys = {
    all: [QUERY_KEY] as const,
    lists: () => [...semesterKeys.all, 'list'] as const,
    list: (filters: Record<string, any>) => [...semesterKeys.lists(), filters] as const,
    details: () => [...semesterKeys.all, 'detail'] as const,
    detail: (id: string) => [...semesterKeys.details(), id] as const,
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
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: semesterKeys.lists() });
            queryClient.invalidateQueries({ queryKey: ['active-semester'] });
            message.success('Tạo học kỳ thành công');
        },
        onError: () => {
            message.error('Tạo học kỳ thất bại');
        },
    });
}

// Update semester
export function useUpdateSemester() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ id, data }: { id: string; data: UpdateSemesterDto }) =>
            SemestersApi.update(id, data),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: semesterKeys.lists() });
            queryClient.invalidateQueries({ queryKey: semesterKeys.detail(variables.id) });
            queryClient.invalidateQueries({ queryKey: ['active-semester'] });
            message.success('Cập nhật học kỳ thành công');
        },
        onError: () => {
            message.error('Cập nhật học kỳ thất bại');
        },
    });
}

// Delete semester
export function useDeleteSemester() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (id: string) => SemestersApi.delete(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: semesterKeys.lists() });
            queryClient.invalidateQueries({ queryKey: ['active-semester'] });
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
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: semesterKeys.lists() });
            queryClient.invalidateQueries({ queryKey: ['active-semester'] });
            message.success('Kích hoạt học kỳ thành công');
        },
        onError: () => {
            message.error('Kích hoạt học kỳ thất bại');
        },
    });
}
