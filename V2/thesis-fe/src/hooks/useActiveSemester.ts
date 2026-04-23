import { useQuery } from '@tanstack/react-query';
import { SemestersApi } from '@/api/semesters';

export const useActiveSemester = () => {
    return useQuery({
        queryKey: ['active-semester'],
        queryFn: () => SemestersApi.getActive(),
        staleTime: 60 * 1000, // 60 seconds (rely on BroadcastChannel for instant updates)
        refetchOnWindowFocus: true,
    });
};
