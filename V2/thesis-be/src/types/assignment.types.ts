import { AssignmentType, AssignmentStatus } from '@prisma/client';

export interface CreateAssignmentRequest {
  topicId: string;
  groupId: string;
  reviewerId: string;
  assignmentType: AssignmentType;
  reviewerOrder?: number;
  deadlineAt: Date;
  room?: string;
  defenseFormat?: string;
  zoomPassword?: string;
  startTime?: Date;
  endTime?: Date;
}

export interface AcceptAssignmentRequest {
  assignmentId: string;
}

export interface DeclineAssignmentRequest {
  assignmentId: string;
  declineReason: string;
}

export interface CreateDefenseScheduleRequest {
  topicId: string;
  groupId: string;
  defenseDate: Date;
  defenseTime: string;
  room: string;
  committeeChair: string;
  committeeSecretary: string;
  committeeMembers: string[];
  notes?: string;
}
