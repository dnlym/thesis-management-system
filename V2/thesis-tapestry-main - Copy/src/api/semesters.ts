import api from './client';
import type { ApiResponse, Semester } from '@/types';

export const SemestersApi = {
    /**
     * Create a new semester (ADMIN only)
     * POST /semesters
     */
    async create(data: Omit<Semester, 'id' | 'isActive' | 'createdAt' | 'updatedAt'>) {
        const res = await api.post<ApiResponse<Semester>>('/semesters', data);
        return res.data.data;
    },

    /**
     * Get list of all semesters
     * GET /semesters
     */
    async getAll() {
        const res = await api.get<ApiResponse<Semester[]>>('/semesters');
        return res.data.data;
    },

    /**
     * Get semester detail
     * GET /semesters/:id
     */
    async getById(id: string) {
        const res = await api.get<ApiResponse<Semester>>(`/semesters/${id}`);
        return res.data.data;
    },

    /**
     * Update semester
     * PUT /semesters/:id
     */
    async update(id: string, data: Partial<Omit<Semester, 'id' | 'createdAt' | 'updatedAt'>>) {
        const res = await api.put<ApiResponse<Semester>>(`/semesters/${id}`, data);
        return res.data.data;
    },

    /**
     * Get active semester
     * GET /semesters/active
     */
    async getActive() {
        const res = await api.get<ApiResponse<Semester>>('/semesters/active');
        return res.data.data;
    },

    /**
     * Activate a semester (ADMIN only)
     * PUT /semesters/:id/activate
     */
    async activate(id: string) {
        const res = await api.put<ApiResponse<Semester>>(`/semesters/${id}/activate`);
        return res.data.data;
    },
    /**
     * Delete semester (ADMIN only)
     * DELETE /semesters/:id
     */
    async delete(id: string) {
        const res = await api.delete<ApiResponse<void>>(`/semesters/${id}`);
        return res.data;
    },
    /**
     * Update defense date for a semester (HEAD/ADMIN only)
     * PATCH /semesters/:id/defense-date
     */
    async updateDefenseDate(id: string, defenseDate: string) {
        const res = await api.patch<ApiResponse<Semester>>(`/semesters/${id}/defense-date`, { defense_start: defenseDate });
        return res.data.data;
    },
    async setPhaseOverride(id: string, phase: string | null) {
        const res = await api.post<ApiResponse<Semester>>(`/semesters/${id}/phase-override`, { phase });
        return res.data.data;
    },

    /**
     * Create a registration extension
     * POST /registration-extensions
     */
    async createRegistrationExtension(data: { semesterId: string; extendedUntil: string; reason: string }) {
        const res = await api.post<ApiResponse<any>>('/registration-extensions', data);
        return res.data.data;
    },

    /**
     * Get registration extension history for a semester
     * GET /registration-extensions/semester/:semesterId
     */
    async getRegistrationExtensions(semesterId: string) {
        const res = await api.get<ApiResponse<any[]>>(`/registration-extensions/semester/${semesterId}`);
        return res.data.data;
    },
};
