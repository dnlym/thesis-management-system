import api from './client';
import type { ApiResponse, PermissionMatrix } from '@/types';

export const PermissionsApi = {
    /**
     * Get the role-permission matrix
     * GET /permissions/matrix
     */
    async getMatrix() {
        const res = await api.get<ApiResponse<PermissionMatrix>>('/permissions/matrix');
        return res.data.data;
    },

    /**
     * Update permissions for a role
     * POST /permissions/update
     */
    async updateRolePermissions(role: string, permissionIds: string[]) {
        const res = await api.post<ApiResponse<any>>('/permissions/update', { role, permissionIds });
        return res.data.data;
    },

    /**
     * Seed initial permissions (ADMIN only)
     * POST /permissions/seed
     */
    async seed() {
        const res = await api.post<ApiResponse<any>>('/permissions/seed');
        return res.data;
    },
};
