/**
 * Broadcast Event Types
 */
export type SemesterSyncMessage = {
    type: 'SEMESTER_UPDATED';
    payload: {
        semesterId: string;
        oldPhase?: string;
        newPhase?: string;
        updatedAt: string;
    }
};

const CHANNEL_NAME = 'semester_sync_channel';

/**
 * Global Broadcast Channel for multi-tab synchronization
 */
export const semesterBroadcast = {
    /**
     * Post an update to other tabs
     */
    postUpdate: (payload: SemesterSyncMessage['payload']) => {
        try {
            const channel = new BroadcastChannel(CHANNEL_NAME);
            
            // Broadcast every update to ensure multi-tab date synchronization
            channel.postMessage({ type: 'SEMESTER_UPDATED', payload });
            
            channel.close();
        } catch (e) {
            console.warn('BroadcastChannel not supported in this browser', e);
        }
    },

    /**
     * Listen for updates from other tabs
     */
    setupListener: (onUpdate: (payload: SemesterSyncMessage['payload']) => void) => {
        try {
            const channel = new BroadcastChannel(CHANNEL_NAME);
            
            channel.onmessage = (event: MessageEvent<SemesterSyncMessage>) => {
                if (event.data?.type === 'SEMESTER_UPDATED') {
                    onUpdate(event.data.payload);
                }
            };
            
            return () => channel.close();
        } catch (e) {
            console.warn('BroadcastChannel not supported in this browser', e);
            return () => {};
        }
    }
};
