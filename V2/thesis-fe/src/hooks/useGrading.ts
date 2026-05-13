import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { GradingApi, type CriteriaFilters } from '@/api/grading';
import type { GradeSubmissionForm } from '@/types';
import { toast } from 'sonner';

/**
 * Query key factory for grading
 */
export const gradingKeys = {
    all: ['grading'] as const,
    topicGrades: (topicId: string) => [...gradingKeys.all, 'topic', topicId] as const,
    criteria: (filters?: CriteriaFilters) => [...gradingKeys.all, 'criteria', filters] as const,
    summary: () => [...gradingKeys.all, 'summary'] as const,
};

/**
 * Get grade summary for HOD dashboard
 */
export function useGradeSummary() {
    return useQuery({
        queryKey: gradingKeys.summary(),
        queryFn: async () => {
            const response = await GradingApi.getGradeSummary();
            return response;
        },
    });
}

/**
 * Get grades for a topic
 */
export function useTopicGrades(topicId: string | undefined) {
    return useQuery({
        queryKey: gradingKeys.topicGrades(topicId!),
        queryFn: async () => {
            return await GradingApi.getTopicGrades(topicId!);
        },
        enabled: !!topicId,
    });
}

/**
 * Get grading criteria with filters
 */
export function useGradingCriteria(filters?: CriteriaFilters) {
    return useQuery({
        queryKey: gradingKeys.criteria(filters),
        queryFn: async () => {
            const response = await GradingApi.getCriteria(filters);
            return response;
        },
    });
}

/**
 * Submit grade mutation
 */
export function useSubmitGrade() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (data: GradeSubmissionForm) => GradingApi.submitGrade(data),
        onSuccess: (response: any, variables) => {
            queryClient.invalidateQueries({ queryKey: gradingKeys.topicGrades(variables.topic_id) });
            if (response?.status === 'PENDING_APPROVAL') {
                toast.info(response.message || 'Yêu cầu sửa điểm đã được gửi tới Trưởng bộ môn');
            } else {
                toast.success('Nộp điểm thành công');
            }
        },
        onError: (error: any) => {
            toast.error(error?.response?.data?.message || 'Nộp điểm thất bại');
        },
    });
}

/**
 * Compute final score mutation (HEAD only)
 */
export function useComputeFinalScore() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (topicId: string) => GradingApi.computeFinalScore(topicId),
        onSuccess: (response, topicId) => {
            queryClient.invalidateQueries({ queryKey: gradingKeys.topicGrades(topicId) });
            toast.success('Tính điểm tổng hợp thành công');
        },
        onError: (error: any) => {
            toast.error(error?.response?.data?.message || 'Tính điểm tổng hợp thất bại');
        },
    });
}

/**
 * Finalize grades mutation (HEAD only)
 */
export function useFinalizeGrades() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (topicId: string) => GradingApi.finalizeGrades(topicId),
        onSuccess: (response, topicId) => {
            queryClient.invalidateQueries({ queryKey: gradingKeys.topicGrades(topicId) });
            toast.success('Hoàn tất chấm điểm thành công');
        },
        onError: (error: any) => {
            toast.error(error?.response?.data?.message || 'Hoàn tất chấm điểm thất bại');
        },
    });
}

/**
 * Create grading criterion mutation (ADMIN only)
 */
export function useCreateCriterion() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (data: any) => GradingApi.createCriterion(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: gradingKeys.all });
            toast.success('Tạo tiêu chí thành công');
        },
        onError: (error: any) => {
            toast.error(error?.response?.data?.message || 'Tạo tiêu chí thất bại');
        },
    });
}

/**
 * Get registrations for midterm grading (SUPERVISOR only)
 */
export function useMidtermRegistrations() {
    return useQuery({
        queryKey: [...gradingKeys.all, 'midterm'],
        queryFn: async () => {
            const response = await GradingApi.getMidtermRegistrations();
            return response;
        },
    });
}

/**
 * Update midterm status mutation (SUPERVISOR only)
 */
export function useUpdateMidtermStatus() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ registrationId, status, feedback }: { registrationId: string; status: 'PASS' | 'FAIL'; feedback?: string }) =>
            GradingApi.updateMidtermStatus(registrationId, { status, feedback }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: [...gradingKeys.all, 'midterm'] });
            toast.success('Cập nhật kết quả giữa kỳ thành công');
        },
        onError: (error: any) => {
            toast.error(error?.response?.data?.message || 'Cập nhật kết quả giữa kỳ thất bại');
        },
    });
}

