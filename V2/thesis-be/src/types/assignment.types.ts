import { AssignmentType, AssignmentStatus } from '@prisma/client';

export interface CreateAssignmentRequest {
  topicId: string;
  reviewerId: string;
  assignmentType: AssignmentType;
  reviewerOrder?: number;
  deadlineAt: Date;
  room?: string;
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
  defenseDate: Date;
  defenseTime: string;
  room: string;
  committeeChair: string;
  committeeSecretary: string;
  committeeMembers: string[];
  notes?: string;
}
