import api from './client';
import type { ApiResponse } from '@/types';

export interface DefenseSchedule {
    id: string;
    topicId: string;
    topicTitle: string;
    supervisor: string;
    date: string; // ISO Date
    time: string;
    room: string;
    status: string;
    type: string;
    students: {
        id: string;
        fullName: string;
        studentCode: string;
    }[];
    committee: {
        id: string;
        fullName: string;
        role?: string;
        type: string;
    }[];
}

export const DefenseApi = {
    /**
     * Get defense schedules
     * GET /defenses
     */
    async getSchedules(semesterId?: string) {
        const params = semesterId ? { semesterId } : {};
        const res = await api.get<ApiResponse<DefenseSchedule[]>>('/defenses', { params });
        return res.data.data;
    },
};
