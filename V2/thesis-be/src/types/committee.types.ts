import { CommitteeRole, ScheduleStatus, CommitteeType } from '@prisma/client';

export interface CreateCommitteeRequest {
  name: string;
  type?: CommitteeType;
  semesterId: string;
  departmentId: string;
  roomPreference?: string;
  members: {
    lecturerId: string;
    role: CommitteeRole;
  }[];
}

export interface UpdateCommitteeRequest extends Partial<Omit<CreateCommitteeRequest, 'semesterId'>> { }

export interface AssignTopicToCommitteeRequest {
  topicId: string;
  groupId: string;
  committeeId: string;
  defenseDate: string; // YYYY-MM-DD
  startTime: string;   // HH:mm
  endTime: string;     // HH:mm
  room?: string;
  notes?: string;
}

export interface CommitteeScheduleResponse {
  committee: {
    id: string;
    name: string;
    roomPreference?: string | null;
    members: {
      lecturerId: string;
      fullName: string;
      role: CommitteeRole;
    }[];
  };
  schedules: {
    topicId: string;
    groupId?: string;
    topicName: string;
    groupCode?: string;
    students: {
      studentCode: string;
      fullName: string;
    }[];
    date: Date;
    startTime?: Date | null;
    endTime?: Date | null;
    room?: string | null;
    status: ScheduleStatus;
  }[];
}
