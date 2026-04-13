import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DepartmentsApi } from '@/api/departments';
import type { Department, CreateDepartmentDto, UpdateDepartmentDto } from '@/types';
import { message } from 'antd';

const QUERY_KEY = 'departments';

// Query key factory
export const departmentKeys = {
    all: [QUERY_KEY] as const,
    lists: () => [...departmentKeys.all, 'list'] as const,
    list: (filters: Record<string, any>) => [...departmentKeys.lists(), filters] as const,
    details: () => [...departmentKeys.all, 'detail'] as const,
    detail: (id: string) => [...departmentKeys.details(), id] as const,
};

// Get all departments
export function useDepartments() {
    return useQuery({
        queryKey: departmentKeys.lists(),
        queryFn: async () => {
            const response = await DepartmentsApi.getAll();
            return response;
        },
    });
}

// Get department by ID
export function useDepartment(id?: string) {
    return useQuery({
        queryKey: departmentKeys.detail(id!),
        queryFn: async () => {
            const response = await DepartmentsApi.getById(id!);
            return response;
        },
        enabled: !!id,
    });
}

// Create department
export function useCreateDepartment() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (data: CreateDepartmentDto) => DepartmentsApi.create(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: departmentKeys.lists() });
            message.success('Tạo bộ môn thành công');
        },
        onError: () => {
            message.error('Tạo bộ môn thất bại');
        },
    });
}

// Update department
export function useUpdateDepartment() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ id, data }: { id: string; data: UpdateDepartmentDto }) =>
            DepartmentsApi.update(id, data),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: departmentKeys.lists() });
            queryClient.invalidateQueries({ queryKey: departmentKeys.detail(variables.id) });
            message.success('Cập nhật bộ môn thành công');
        },
        onError: () => {
            message.error('Cập nhật bộ môn thất bại');
        },
    });
}

// Delete department
export function useDeleteDepartment() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (id: string) => DepartmentsApi.delete(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: departmentKeys.lists() });
            message.success('Xóa bộ môn thành công');
        },
        onError: () => {
            message.error('Xóa bộ môn thất bại');
        },
    });
}
