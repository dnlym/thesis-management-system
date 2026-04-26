import api from './client';
import type { ApiResponse } from '@/types';

export interface DashboardStats {
    role: 'STUDENT' | 'LECTURER' | 'HEAD' | 'ADMIN';
    // Student stats
    hasTopic?: boolean;
    topicStatus?: string;
    registrationStatus?: string;
    activeSemester?: any;
    registration?: any;

    // Lecturer stats
    supervisedTopicsCount?: number;
    pendingRegistrationsCount?: number;
    pendingSubmissionsCount?: number;
    reviewAssignmentsCount?: number;

    // Head stats
    totalTopics?: number;
    pendingApprovalTopics?: number;
    totalStudents?: number;
    totalLecturers?: number;
    completedTheses?: number;

    // Admin stats
    totalUsers?: number;
    totalSemesters?: number;
    totalDepartments?: number;
    userDistribution?: { role: string; count: number }[];
    // Report stats
    completionRate?: number;
    avgScore?: number;
    defendedCount?: number;
    milestones?: any[];
}

export interface DashboardCharts {
    topicStatus: { name: string; value: number; color: string }[];
    monthlyProgress: { month: string; registered: number; completed: number; defended: number }[];
    defenseType: { type: string; count: number; percentage: number }[];
    scoreDistribution: { range: string; count: number }[];
    leaderboard: { id: string; full_name: string; email: string; avatar_url?: string; topicCount: number }[];
}

export const DashboardApi = {
    /**
     * Get dashboard statistics
     * GET /dashboard/stats
     */
    async getStats() {
        const res = await api.get<ApiResponse<DashboardStats>>('/dashboard/stats');
        return res.data.data;
    },

    /**
     * Get dashboard charts
     * GET /dashboard/charts
     */
    async getCharts() {
        const res = await api.get<ApiResponse<DashboardCharts>>('/dashboard/charts');
        return res.data.data;
    },
};
