import api from './client';
import type { ApiResponse, Department } from '@/types';

export const DepartmentsApi = {
    /**
     * Create a new department (ADMIN only)
     * POST /departments
     */
    async create(data: Omit<Department, 'id' | 'createdAt' | 'updatedAt'>) {
        const res = await api.post<ApiResponse<Department>>('/departments', data);
        return res.data.data;
    },

    /**
     * Get list of all departments
     * GET /departments
     */
    async getAll() {
        const res = await api.get<ApiResponse<Department[]>>('/departments');
        return res.data.data;
    },

    /**
     * Get department detail
     * GET /departments/:id
     */
    async getById(id: string) {
        const res = await api.get<ApiResponse<Department>>(`/departments/${id}`);
        return res.data.data;
    },

    /**
     * Update department
     * PUT /departments/:id
     */
    async update(id: string, data: Partial<Omit<Department, 'id' | 'createdAt' | 'updatedAt'>>) {
        const res = await api.put<ApiResponse<Department>>(`/departments/${id}`, data);
        return res.data.data;
    },

    /**
     * Delete department (ADMIN only)
     * DELETE /departments/:id
     */
    async delete(id: string) {
        const res = await api.delete<ApiResponse<void>>(`/departments/${id}`);
        return res.data;
    },
};
