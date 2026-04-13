import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { SubmissionsApi, type SubmissionFilters } from '@/api/submissions';
import type { Submission, SubmissionVersion } from '@/types';
import { toast } from 'sonner';

/**
 * Query key factory for submissions
 */
export const submissionKeys = {
    all: ['submissions'] as const,
    lists: () => [...submissionKeys.all, 'list'] as const,
    list: (filters?: SubmissionFilters) => [...submissionKeys.lists(), filters] as const,
    versions: (submissionId: string) => [...submissionKeys.all, 'versions', submissionId] as const,
};

/**
 * Get list of submissions with filters
 */
export function useSubmissions(filters?: SubmissionFilters, options?: any) {
    return useQuery<Submission[]>({
        queryKey: submissionKeys.list(filters),
        queryFn: async () => {
            const response = await SubmissionsApi.getAll(filters);
            return response;
        },
        ...options,
    });
}

/**
 * Get submission version history
 */
export function useSubmissionVersions(submissionId: string | undefined) {
    return useQuery<SubmissionVersion[]>({
        queryKey: submissionKeys.versions(submissionId!),
        queryFn: async () => {
            const response = await SubmissionsApi.getVersions(submissionId!);
            return response;
        },
        enabled: !!submissionId,
    });
}

/**
 * Upload file submission mutation
 */
export function useUploadFile() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (formData: FormData) => SubmissionsApi.upload(formData),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: submissionKeys.lists() });
            toast.success('Upload file thành công');
        },
        onError: (error: any) => {
            toast.error(error?.response?.data?.message || 'Upload file thất bại');
        },
    });
}

/**
 * Supervisor approve submission mutation
 */
export function useApproveSubmission() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (id: string) => SubmissionsApi.approve(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: submissionKeys.lists() });
            toast.success('Phê duyệt file thành công');
        },
        onError: (error: any) => {
            toast.error(error?.response?.data?.message || 'Phê duyệt file thất bại');
        },
    });
}

/**
 * Supervisor request revision mutation
 */
export function useRejectSubmission() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ id, reason }: { id: string; reason: string }) =>
            SubmissionsApi.reject(id, reason),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: submissionKeys.lists() });
            toast.success('Yêu cầu chỉnh sửa file thành công');
        },
        onError: (error: any) => {
            toast.error(error?.response?.data?.message || 'Yêu cầu chỉnh sửa file thất bại');
        },
    });
}

/**
 * HEAD lock submission mutation
 */
export function useLockSubmission() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (id: string) => SubmissionsApi.lock(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: submissionKeys.lists() });
            toast.success('Khóa file thành công');
        },
        onError: (error: any) => {
            toast.error(error?.response?.data?.message || 'Khóa file thất bại');
        },
    });
}

/**
 * HEAD unlock submission mutation
 */
export function useUnlockSubmission() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (id: string) => SubmissionsApi.unlock(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: submissionKeys.lists() });
            toast.success('Mở khóa file thành công');
        },
        onError: (error: any) => {
            toast.error(error?.response?.data?.message || 'Mở khóa file thất bại');
        },
    });
}

/**
 * Download file version
 */
export function useDownloadVersion() {
    return useMutation({
        mutationFn: async (versionId: string) => {
            const blob = await SubmissionsApi.downloadVersion(versionId);
            return blob;
        },
        onError: (error: any) => {
            toast.error(error?.response?.data?.message || 'Tải file thất bại');
        },
    });
}
