import React from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { OfflineStorage } from '@/api/offline';
import { GradingApi } from '@/api/grading';
import { useAuthStore } from '@/store/auth';
import { gradingKeys } from './useGrading';
import { topicKeys } from './useTopics';

export const useSync = () => {
    const [status, setStatus] = React.useState<'PENDING' | 'SYNCING' | 'SUCCESS' | 'ERROR'>('PENDING');
    const [pendingCount, setPendingCount] = React.useState(0);
    const { isAuthenticated } = useAuthStore();
    const queryClient = useQueryClient();

    const sync = React.useCallback(async () => {
        if (!isAuthenticated) return;

        try {
            const queue = await OfflineStorage.getQueue();
            if (queue.length === 0) {
                setStatus('SUCCESS');
                setPendingCount(0);
                return;
            }

            setPendingCount(queue.length);
            setStatus('SYNCING');

            let errorOccurred = false;
            let successCount = 0;

            for (const item of queue) {
                try {
                    await GradingApi.submitGrade(item.data);
                    await OfflineStorage.removeFromQueue(item.id);
                    successCount++;
                } catch (err) {
                    console.error('Failed to sync item:', item.id, err);
                    errorOccurred = true;
                }
            }

            if (successCount > 0) {
                // Invalidate all related data to ensure consistency with backend
                queryClient.invalidateQueries({ queryKey: gradingKeys.all });
                queryClient.invalidateQueries({ queryKey: topicKeys.all });
                queryClient.invalidateQueries({ queryKey: topicKeys.stats() });
            }

            const remainingQueue = await OfflineStorage.getQueue();
            const remaining = remainingQueue.length;
            setPendingCount(remaining);
            setStatus(errorOccurred ? 'ERROR' : remaining === 0 ? 'SUCCESS' : 'PENDING');
        } catch (err) {
            console.error('Storage access error during sync:', err);
            setStatus('ERROR');
        }
    }, [isAuthenticated, queryClient]);

    React.useEffect(() => {
        // Initial sync
        sync();

        // Periodically check queue
        const interval = setInterval(sync, 30000); // 30 seconds
        return () => clearInterval(interval);
    }, [sync]);

    return { status, pendingCount, sync };
};
