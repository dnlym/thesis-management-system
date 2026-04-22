import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { GradingApi, type CriteriaFilters } from '@/api/grading';
import type { GradeSubmissionForm } from '@/types';
import { Alert } from 'react-native';

/**
 * Query key factory for grading
 */
export const gradingKeys = {
    all: ['grading'] as const,
    topicGrades: (topicId: string) => [...gradingKeys.all, 'topic', topicId] as const,
    criteria: (filters?: CriteriaFilters) => [...gradingKeys.all, 'criteria', filters] as const,
};

/**
 * Get grades for a topic
 */
export function useTopicGrades(topicId: string | undefined) {
    return useQuery({
        queryKey: gradingKeys.topicGrades(topicId!),
        queryFn: async () => {
            const response = await GradingApi.getTopicGrades(topicId!);
            return response;
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
        onSuccess: (response, variables) => {
            queryClient.invalidateQueries({ queryKey: gradingKeys.topicGrades(variables.topic_id) });
            Alert.alert('Thành công', 'Nộp điểm thành công');
        },
        onError: (error: any) => {
            Alert.alert('Lỗi', error?.response?.data?.message || 'Nộp điểm thất bại');
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
            Alert.alert('Thành công', 'Tính điểm tổng hợp thành công');
        },
        onError: (error: any) => {
            Alert.alert('Lỗi', error?.response?.data?.message || 'Tính điểm tổng hợp thất bại');
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
            Alert.alert('Thành công', 'Hoàn tất chấm điểm thành công');
        },
        onError: (error: any) => {
            Alert.alert('Lỗi', error?.response?.data?.message || 'Hoàn tất chấm điểm thất bại');
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
            Alert.alert('Thành công', 'Tạo tiêu chí thành công');
        },
        onError: (error: any) => {
            Alert.alert('Lỗi', error?.response?.data?.message || 'Tạo tiêu chí thất bại');
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
            Alert.alert('Thành công', 'Cập nhật kết quả giữa kỳ thành công');
        },
        onError: (error: any) => {
            Alert.alert('Lỗi', error?.response?.data?.message || 'Cập nhật kết quả giữa kỳ thất bại');
        },
    });
}
