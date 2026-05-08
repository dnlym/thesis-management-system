import { RaterRole } from '@prisma/client';

export interface SubmitGradeRequest {
  topicId: string;
  groupId?: string;    // Added for multi-group support
  studentId?: string;  // For per-student grading (optional for backward compatibility)
  reviewerOrder?: number; // To distinguish between PB1, PB2, PB3
  grades: Array<{
    criterionId: string;
    score: number;
    comments?: string;
  }>;
}

export interface CreateGradingCriterionRequest {
  name: string;
  description: string;
  weight: number;
  maxScore: number;
  minScore: number;
  role: RaterRole;
  orderIndex: number;
  departmentId?: string;
}

export interface ComputeFinalScoreRequest {
  topicId: string;
}

export interface FinalizeFinalScoreRequest {
  topicId: string;
}

export interface SubmitExtraPointRequest {
  topicId: string;
  reason: string;
  pointsRequested: number;
  evidenceUrl?: string;
  evidenceVersions?: any;
}

export interface ApproveExtraPointRequest {
  requestId: string;
  approvedPoints: number;
}

export interface RejectExtraPointRequest {
  requestId: string;
  rejectionReason: string;
}

export interface UpdateGradingCriterionRequest {
  name?: string;
  description?: string;
  weight?: number;
  maxScore?: number;
  minScore?: number;
  role?: RaterRole;
  orderIndex?: number;
  active?: boolean;
  departmentId?: string;
}
