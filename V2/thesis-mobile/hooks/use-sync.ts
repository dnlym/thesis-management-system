import React from 'react';
import { OfflineStorage } from '@/api/offline';
import { GradingApi } from '@/api/grading';
import { useAuthStore } from '@/store/auth';

export const useSync = () => {
    const [status, setStatus] = React.useState<'PENDING' | 'SYNCING' | 'SUCCESS' | 'ERROR'>('PENDING');
    const [pendingCount, setPendingCount] = React.useState(0);
    const { isAuthenticated } = useAuthStore();

    const sync = React.useCallback(async () => {
        if (!isAuthenticated) return;

        const queue = await OfflineStorage.getQueue();
        if (queue.length === 0) {
            setStatus('SUCCESS');
            setPendingCount(0);
            return;
        }

        setPendingCount(queue.length);
        setStatus('SYNCING');

        let errorOccurred = false;

        for (const item of queue) {
            try {
                await GradingApi.submitGrade(item.data);
                OfflineStorage.removeFromQueue(item.id);
            } catch (err) {
                console.error('Failed to sync item:', item.id, err);
                errorOccurred = true;
            }
        }

        const remainingQueue = await OfflineStorage.getQueue();
        const remaining = remainingQueue.length;
        setPendingCount(remaining);
        setStatus(errorOccurred ? 'ERROR' : remaining === 0 ? 'SUCCESS' : 'PENDING');
    }, [isAuthenticated]);

    React.useEffect(() => {
        // Initial sync
        sync();

        // Periodically check queue
        const interval = setInterval(sync, 30000); // 30 seconds
        return () => clearInterval(interval);
    }, [sync]);

    return { status, pendingCount, sync };
};
