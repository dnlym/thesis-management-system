import AsyncStorage from '@react-native-async-storage/async-storage';

export const OfflineStorage = {
    /**
     * Save a draft with a unique scoped key
     */
    saveDraft: async (userId: string, topicId: string, role: string, studentId: string, data: any) => {
        const key = `draft_${userId}_${topicId}_${role}_${studentId}`;
        await AsyncStorage.setItem(key, JSON.stringify({
            ...data,
            timestamp: new Date().toISOString(),
        }));
    },

    /**
     * Get a specific draft
     */
    getDraft: async (userId: string, topicId: string, role: string, studentId: string) => {
        const key = `draft_${userId}_${topicId}_${role}_${studentId}`;
        const value = await AsyncStorage.getItem(key);
        return value ? JSON.parse(value) : null;
    },

    /**
     * Add a submission to the sync queue
     */
    addToQueue: async (userId: string, topicId: string, role: string, studentId: string, data: any) => {
        const queueKey = 'sync_queue';
        const queueStr = await AsyncStorage.getItem(queueKey);
        const queue = queueStr ? JSON.parse(queueStr) : [];

        const entry = {
            id: `${userId}_${topicId}_${role}_${studentId}`,
            userId,
            topicId,
            role,
            studentId,
            data,
            attempts: 0,
        };

        // Replace if exists, or append
        const index = queue.findIndex((item: any) => item.id === entry.id);
        if (index > -1) {
            queue[index] = entry;
        } else {
            queue.push(entry);
        }

        await AsyncStorage.setItem(queueKey, JSON.stringify(queue));
    },

    /**
     * Get all pending items in queue
     */
    getQueue: async () => {
        const queueStr = await AsyncStorage.getItem('sync_queue');
        return queueStr ? JSON.parse(queueStr) : [];
    },

    /**
     * Remove item from queue after successful sync
     */
    removeFromQueue: async (id: string) => {
        const queue = await OfflineStorage.getQueue();
        const newQueue = queue.filter((item: any) => item.id !== id);
        await AsyncStorage.setItem('sync_queue', JSON.stringify(newQueue));
    }
};
