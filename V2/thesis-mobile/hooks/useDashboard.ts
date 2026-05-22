import { useQuery } from '@tanstack/react-query';
import { DashboardApi } from '@/api/dashboard';
import { useAuthStore } from '@/store/auth';

export const useDashboardStats = () => {
    const { isAuthenticated } = useAuthStore();
    return useQuery({
        queryKey: ['dashboard-stats'],
        queryFn: DashboardApi.getStats,
        enabled: isAuthenticated,
    });
};

export const useDashboardCharts = () => {
    const { isAuthenticated } = useAuthStore();
    return useQuery({
        queryKey: ['dashboard-charts'],
        queryFn: DashboardApi.getCharts,
        enabled: isAuthenticated,
    });
};

export const useActiveSemester = () => {
    const { isAuthenticated } = useAuthStore();
    return useQuery({
        queryKey: ['active-semester'],
        queryFn: DashboardApi.getActiveSemester,
        enabled: isAuthenticated,
    });
};
