import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { RegistrationsApi, type RegistrationFilters } from '@/api/registrations';
import type { RegistrationForm } from '@/types';
import { toast } from 'sonner';

/**
 * Query key factory for registrations
 */
export const registrationKeys = {
    all: ['registrations'] as const,
    lists: () => [...registrationKeys.all, 'list'] as const,
    list: (filters?: RegistrationFilters) => [...registrationKeys.lists(), filters] as const,
    details: () => [...registrationKeys.all, 'detail'] as const,
    detail: (id: string) => [...registrationKeys.details(), id] as const,
};

/**
 * Get list of registrations with filters
 */
export function useRegistrations(filters?: RegistrationFilters) {
    return useQuery({
        queryKey: registrationKeys.list(filters),
        queryFn: async () => {
            const response = await RegistrationsApi.getAll(filters);
            return response;
        },
    });
}

/**
 * Get registration detail by ID
 */
export function useRegistration(id: string | undefined) {
    return useQuery({
        queryKey: registrationKeys.detail(id!),
        queryFn: async () => {
            const response = await RegistrationsApi.getById(id!);
            return response;
        },
        enabled: !!id,
    });
}

/**
 * Student register for topic mutation (individual registration)
 */
export function useRegisterTopic() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (topicId: string) => RegistrationsApi.registerIndividual(topicId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: registrationKeys.lists() });
            // Invalidate my-topic-registration to show data immediately
            queryClient.invalidateQueries({ queryKey: ['my-topic-registration'] });
            // Also invalidate topics to update registration status
            queryClient.invalidateQueries({ queryKey: ['topics'] });

            toast.success('Đăng ký đề tài thành công! Bạn có thể tìm đồng đội để lập nhóm.');
        },
        onError: (error: any) => {
            toast.error(error?.response?.data?.error || 'Đăng ký đề tài thất bại');
        },
    });
}

/**
 * GVHD registers a topic on behalf of a student (optional flow)
 */
export function useRegisterForStudent() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ studentId, topicId }: { studentId: string; topicId: string }) =>
            RegistrationsApi.registerForStudent(studentId, topicId),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: registrationKeys.lists() });
            queryClient.invalidateQueries({ queryKey: ['topics'] });
            toast.success('Đã đăng ký đề tài cho sinh viên thành công');
        },
        onError: (error: any) => {
            toast.error(error?.response?.data?.error || 'Đăng ký cho sinh viên thất bại');
        },
    });
}

/**
 * Supervisor confirm registration mutation
 */
export function useConfirmRegistration() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (id: string) => RegistrationsApi.confirm(id),
        onSuccess: (response, id) => {
            queryClient.invalidateQueries({ queryKey: registrationKeys.lists() });
            queryClient.invalidateQueries({ queryKey: registrationKeys.detail(id) });
            toast.success('Xác nhận đăng ký thành công');
        },
        onError: (error: any) => {
            toast.error(error?.response?.data?.message || 'Xác nhận đăng ký thất bại');
        },
    });
}

/**
 * Supervisor reject registration mutation
 */
export function useRejectRegistration() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ id, reason }: { id: string; reason: string }) =>
            RegistrationsApi.reject(id, reason),
        onSuccess: (response, variables) => {
            queryClient.invalidateQueries({ queryKey: registrationKeys.lists() });
            queryClient.invalidateQueries({ queryKey: registrationKeys.detail(variables.id) });
            toast.success('Từ chối đăng ký thành công');
        },
        onError: (error: any) => {
            toast.error(error?.response?.data?.message || 'Từ chối đăng ký thất bại');
        },
    });
}

/**
 * Student cancel registration (only when PENDING)
 */
export function useCancelRegistration() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (id: string) => RegistrationsApi.cancel(id),
        onSuccess: (response, id) => {
            queryClient.invalidateQueries({ queryKey: registrationKeys.lists() });
            queryClient.invalidateQueries({ queryKey: registrationKeys.detail(id) });
            toast.success('Hủy đăng ký thành công');
        },
        onError: (error: any) => {
            toast.error(error?.response?.data?.message || 'Hủy đăng ký thất bại');
        },
    });
}

/**
 * Update student progress mutation
 */
export function useUpdateProgress() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ id, status, feedback }: { id: string; status: string; feedback?: string }) =>
            RegistrationsApi.updateProgress(id, status, feedback),
        onSuccess: (response, variables) => {
            queryClient.invalidateQueries({ queryKey: registrationKeys.lists() });
            queryClient.invalidateQueries({ queryKey: registrationKeys.detail(variables.id) });
            toast.success('Cập nhật tiến độ thành công');
        },
        onError: (error: any) => {
            toast.error(error?.response?.data?.message || 'Cập nhật tiến độ thất bại');
        },
    });
}

/**
 * Get my topic registration for current semester
 */
export function useMyTopicRegistration() {
    return useQuery({
        queryKey: ['my-topic-registration'],
        queryFn: async () => {
            const response = await RegistrationsApi.getMyTopic();
            return response;
        },
    });
}

/**
 * Get students registered for the same topic
 */
export function useStudentsSameTopic(topicId: string | undefined) {
    return useQuery({
        queryKey: ['students-same-topic', topicId],
        queryFn: async () => {
            const response = await RegistrationsApi.getStudentsSameTopic(topicId!);
            return response;
        },
        enabled: !!topicId,
    });
}

/**
 * Create group with another student
 */
export function useCreateGroup() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ topicId, partnerId }: { topicId: string; partnerId: string }) =>
            RegistrationsApi.createGroup(topicId, partnerId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['my-topic-registration'] });
            queryClient.invalidateQueries({ queryKey: ['students-same-topic'] });

            toast.success('Đã lập nhóm thành công!');
        },
        onError: (error: any) => {
            toast.error(error?.response?.data?.error || 'Lập nhóm thất bại');
        },
    });
}

/**
 * Get registration logs
 */
export function useRegistrationLogs(id: string | undefined) {
    return useQuery({
        queryKey: [...registrationKeys.detail(id!), 'logs'],
        queryFn: async () => {
            const response = await RegistrationsApi.getLogs(id!);
            return response;
        },
        enabled: !!id,
    });
}
