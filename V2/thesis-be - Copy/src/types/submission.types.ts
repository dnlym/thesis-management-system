import { SubmissionType, SubmissionStatus } from '@prisma/client';

export interface UploadFileRequest {
  topicId: string;
  groupId: string;
  type: SubmissionType;
  comments?: string;
}

export interface ApproveSubmissionRequest {
  submissionId: string;
}

export interface RejectSubmissionRequest {
  submissionId: string;
  rejectionReason: string;
}

export interface LockSubmissionRequest {
  submissionId: string;
}

export interface UnlockSubmissionRequest {
  submissionId: string;
  reason: string;
}
