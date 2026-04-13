import { useQuery } from '@tanstack/react-query';
import { DashboardApi } from '@/api/dashboard';

export const useDashboardStats = () => {
    return useQuery({
        queryKey: ['dashboard-stats'],
        queryFn: DashboardApi.getStats,
    });
};

export const useDashboardCharts = () => {
    return useQuery({
        queryKey: ['dashboard-charts'],
        queryFn: DashboardApi.getCharts,
    });
};
