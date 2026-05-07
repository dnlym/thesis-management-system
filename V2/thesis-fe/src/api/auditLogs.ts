import api from './client';
import type { ApiResponse } from '@/types';

export interface AuditLogEntry {
  id: string;
  user_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string;
  old_value: Record<string, any> | null;
  new_value: Record<string, any> | null;
  ip_address: string | null;
  reason: string | null;
  description: string | null;
  created_at: string;
  user: {
    id: string;
    full_name: string;
    email: string;
    role: string;
    avatar_url?: string | null;
  } | null;
}

export interface AuditLogPagination {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface AuditLogResponse {
  data: AuditLogEntry[];
  pagination: AuditLogPagination;
}

export interface AuditLogFilters {
  page?: number;
  limit?: number;
  userId?: string;
  action?: string;
  entityType?: string;
  startDate?: string;
  endDate?: string;
  search?: string;
}

export const AuditLogsApi = {
  async getAll(filters?: AuditLogFilters): Promise<AuditLogResponse> {
    const res = await api.get<AuditLogResponse>('/audit-logs', { params: filters });
    return res.data;
  },

  async getByEntity(entityType: string, entityId: string): Promise<AuditLogEntry[]> {
    const res = await api.get<ApiResponse<AuditLogEntry[]>>(`/audit-logs/${entityType}/${entityId}`);
    return res.data.data;
  },
};
