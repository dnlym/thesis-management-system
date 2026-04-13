import { useQuery } from '@tanstack/react-query';
import { DefenseApi } from '@/api/defense';

export const useDefenseSchedules = (semesterId?: string) => {
    return useQuery({
        queryKey: ['defense-schedules', semesterId],
        queryFn: () => DefenseApi.getSchedules(semesterId),
    });
};
