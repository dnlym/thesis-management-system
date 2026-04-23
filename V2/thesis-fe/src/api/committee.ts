import api from './client';
import type { ApiResponse } from '@/types';

export interface CommitteeMember {
  lecturerId: string;
  fullName?: string;
  role: 'CHAIR' | 'SECRETARY' | 'MEMBER';
}

export interface Committee {
  id: string;
  name: string;
  type: 'ORAL' | 'POSTER';
  semester_id: string;
  room_preference?: string;
  members: CommitteeMember[];
}

export interface CreateCommitteeRequest {
  name: string;
  type: 'ORAL' | 'POSTER';
  semesterId: string;
  roomPreference?: string;
  members: { lecturerId: string; role: 'CHAIR' | 'SECRETARY' | 'MEMBER' }[];
}

export interface MasterSchedule {
  committee: {
    id: string;
    name: string;
    roomPreference?: string;
    members: CommitteeMember[];
  };
  schedules: {
    topicId: string;
    topicCode?: string;
    topicName: string;
    groupCode?: string;
    students: { studentCode: string; fullName: string }[];
    date: string;
    startTime?: string;
    endTime?: string;
    room?: string;
    status: string;
  }[];
}

export const CommitteeApi = {
  getCommittees: async (semesterId: string) => {
    const res = await api.get<ApiResponse<Committee[]>>('/committees', { params: { semesterId } });
    return res.data.data;
  },
  createCommittee: async (data: CreateCommitteeRequest) => {
    const res = await api.post<ApiResponse<Committee>>('/committees', data);
    return res.data.data;
  },
  updateCommittee: async (id: string, data: Partial<CreateCommitteeRequest>) => {
    const res = await api.put<ApiResponse<Committee>>(`/committees/${id}`, data);
    return res.data.data;
  },
  deleteCommittee: async (id: string) => {
    const res = await api.delete<ApiResponse<{ success: boolean; message: string }>>(`/committees/${id}`);
    return res.data.data;
  },
  assignTopic: async (data: {
    topicId: string;
    committeeId: string;
    defenseDate: string;
    startTime?: string;
    endTime?: string;
    room?: string;
  }) => {
    const res = await api.post<ApiResponse<any>>('/committees/assign-topic', data);
    return res.data.data;
  },
  getMasterSchedules: async (semesterId: string) => {
    const res = await api.get<ApiResponse<MasterSchedule[]>>('/committees/schedules', { params: { semesterId } });
    return res.data.data;
  },
  getBusyLecturers: async (semesterId: string) => {
    const res = await api.get<ApiResponse<string[]>>('/committees/busy-lecturers', { params: { semesterId } });
    return res.data.data;
  }
};
