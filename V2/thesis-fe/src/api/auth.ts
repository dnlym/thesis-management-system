import api from './client';
import type { ApiResponse, User } from '@/types';

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    fullName: string;
    email: string;
    role: string;
    departmentId: string;
    department?: any;
  };
}

export const AuthApi = {
  async login(email: string, password: string) {
    const res = await api.post<ApiResponse<LoginResponse>>('/auth/login', { email, password });
    return res.data;
  },

  async register(fullName: string, email: string, password: string) {
    const res = await api.post<ApiResponse<User>>('/auth/register', { fullName, email, password });
    return res.data;
  },

  async refresh() {
    const res = await api.post<ApiResponse<{ accessToken: string }>>('/auth/refresh-token');
    return res.data;
  },

  async logout() {
    const res = await api.post<ApiResponse<null>>('/auth/logout');
    return res.data;
  },

    async getProfile() {
        const res = await api.get<ApiResponse<{
            id: string; full_name: string; email: string; role: string; avatar_url?: string | null; joined_at?: string; department?: any;
        }>>('/auth/profile');
        return res.data;
    },

  async updateProfile(data: { fullName?: string; avatarUrl?: string }) {
    const res = await api.put<ApiResponse<User>>('/auth/profile', data);
    return res.data;
  },

  async changePassword(currentPassword: string, newPassword: string) {
    const res = await api.post<ApiResponse<null>>('/auth/change-password', { currentPassword, newPassword });
    return res.data;
  },

  // Legacy compatibility - alias for getProfile
  async me() {
    return this.getProfile();
  },
};


