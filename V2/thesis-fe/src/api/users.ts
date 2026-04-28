import api from './client';
import type { ApiResponse } from '@/types';

// User type matching backend response (snake_case)
interface UserResponse {
  id: string;
  full_name: string;
  email: string;
  role: string;
  avatar_url?: string | null;
  student_code?: string;
  phone?: string;
  department_id?: string;
  department?: any;
  created_at?: string;
  updated_at?: string;
}

export const UsersApi = {
  async getAll(filters?: { role?: string; departmentId?: string; search?: string }) {
    const res = await api.get<ApiResponse<Array<UserResponse>>>('/users', { params: filters });
    return res.data.data;
  },

  async getById(id: string) {
    return (await api.get<ApiResponse<UserResponse>>(`/users/${id}`)).data;
  },

  async update(id: string, data: Partial<{ full_name: string; email: string; avatar_url?: string; phone?: string }>) {
    return (await api.put<ApiResponse<UserResponse>>(`/users/${id}`, data)).data;
  },

  async getRoleSummary() {
    const res = await api.get<ApiResponse<Array<{ id: string; userCount: number }>>>('/users/roles/summary');
    return res.data.data;
  },

  async uploadAvatar(id: string, formData: FormData) {
    return (await api.post<ApiResponse<UserResponse>>(`/users/${id}/avatar`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    })).data;
  },
};
