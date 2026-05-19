import { TopicStatus } from '@prisma/client';

export interface CreateTopicRequest {
  title: string;
  description: string;
  objectives: string;
  requirements: string;
  maxStudents: number;
  semesterId: string;
  departmentId?: string;
  isDraft?: boolean;
  isInterdisciplinary?: boolean;
  coSupervisorId?: string;
  secondaryDepartmentId?: string;
}

export interface UpdateTopicRequest {
  title?: string;
  description?: string;
  objectives?: string;
  requirements?: string;
  maxStudents?: number;
  changeReason?: string;
  isInterdisciplinary?: boolean;
  coSupervisorId?: string;
}

export interface SubmitTopicForApprovalRequest {
  topicId: string;
}

export interface ApproveTopicRequest {
  topicId: string;
}

export interface RejectTopicRequest {
  topicId: string;
  rejectionReason: string;
}

export interface RequireEditRequest {
  topicId: string;
  editNotes: string;
}

export interface TopicFilter {
  status?: TopicStatus;
  supervisorId?: string;
  departmentId?: string;
  semesterId?: string;
  search?: string;
  includeAll?: boolean;
  page?: number;
  limit?: number;
  midtermStatus?: 'PASS' | 'FAIL'; // Filter by registration midterm status
  hasRegistrations?: boolean;
}
