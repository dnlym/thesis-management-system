import { useQuery } from '@tanstack/react-query';
import { UsersApi } from '@/api/users';

export const userKeys = {
    all: ['users'] as const,
    lists: () => [...userKeys.all, 'list'] as const,
    list: (filters?: any) => [...userKeys.lists(), filters] as const,
    details: () => [...userKeys.all, 'detail'] as const,
    detail: (id: string) => [...userKeys.details(), id] as const,
};

export function useUsers(filters?: { role?: string; departmentId?: string; search?: string }) {
    return useQuery({
        queryKey: userKeys.list(filters),
        queryFn: () => UsersApi.getAll(filters),
    });
}

export function useUser(id: string) {
    return useQuery({
        queryKey: userKeys.detail(id),
        queryFn: () => UsersApi.getById(id),
        enabled: !!id,
    });
}
