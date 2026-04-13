// System constants and configurations
import { RaterRole } from '@prisma/client';

export const JWT_CONFIG = {
  ACCESS_TOKEN_EXPIRY: '2h',
  REFRESH_TOKEN_EXPIRY: '7d',
};

export const FILE_UPLOAD = {
  MAX_SIZE: {
    PROPOSAL: 10 * 1024 * 1024, // 10MB
    THESIS: 50 * 1024 * 1024, // 50MB
    SOURCE_CODE: 100 * 1024 * 1024, // 100MB
    PRESENTATION: 20 * 1024 * 1024, // 20MB
    EXTRA_POINT_EVIDENCE: 10 * 1024 * 1024, // 10MB
  },
  ALLOWED_TYPES: {
    PROPOSAL: ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
    THESIS: ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
    SOURCE_CODE: ['application/zip', 'application/x-rar-compressed'],
    PRESENTATION: ['application/pdf', 'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation'],
    EXTRA_POINT_EVIDENCE: [
      'application/pdf', 
      'image/jpeg', 
      'image/png',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ],
  },
  STORAGE_PATH: './uploads',
};

export const VALIDATION = {
  TOPIC: {
    TITLE_MIN: 20,
    TITLE_MAX: 500,
    DESCRIPTION_MIN: 100,
    OBJECTIVES_MIN: 50,
    REQUIREMENTS_MIN: 50,
  },
  GROUP: {
    NAME_MIN: 5,
    NAME_MAX: 100,
  },
  REASON: {
    REJECTION_MIN: 20,
    EDIT_NOTES_MIN: 20,
    DECLINE_MIN: 30,
    EXTRA_POINT_MIN: 50,
  },
};

export enum RoleGroup {
  SUPERVISOR = 'SUPERVISOR',
  REVIEWER = 'REVIEWER',
  COMMITTEE = 'COMMITTEE',
}

export const ROLE_GROUP_MAP: Record<RaterRole, RoleGroup> = {
  [RaterRole.SUPERVISOR]: RoleGroup.SUPERVISOR,

  [RaterRole.REVIEWER_1]: RoleGroup.REVIEWER,
  [RaterRole.REVIEWER_2]: RoleGroup.REVIEWER,
  [RaterRole.REVIEWER_3]: RoleGroup.REVIEWER,

  [RaterRole.COMMITTEE_CHAIR]: RoleGroup.COMMITTEE,
  [RaterRole.COMMITTEE_SECRETARY]: RoleGroup.COMMITTEE,
  [RaterRole.COMMITTEE_MEMBER]: RoleGroup.COMMITTEE,
  [RaterRole.COMMITTEE_MEMBER_1]: RoleGroup.COMMITTEE,
  [RaterRole.COMMITTEE_MEMBER_2]: RoleGroup.COMMITTEE,
  [RaterRole.ORAL_COMMITTEE]: RoleGroup.COMMITTEE,
  [RaterRole.POSTER_COMMITTEE]: RoleGroup.COMMITTEE,
};

export const GRADING = {
  WEIGHTS: {
    SUPERVISOR: 1 / 3,
    REVIEWER: 1 / 3,
    COMMITTEE: 1 / 3,
  },
  CLASSIFICATION: {
    EXCELLENT: { min: 9.0, max: 10.0, label: 'Xuất sắc' },
    GOOD: { min: 8.0, max: 8.9, label: 'Giỏi' },
    FAIR: { min: 7.0, max: 7.9, label: 'Khá' },
    AVERAGE: { min: 6.0, max: 6.9, label: 'Trung bình' },
    FAIL: { min: 0, max: 5.9, label: 'Không đạt' },
  },
  CONFIG: {
    MIN_REVIEWERS: 2,
    MIN_ORAL: 3,
    MIN_POSTER: 2,
    PASS_THRESHOLD: 6.0,
    MAX_EXTRA_POINTS: 1.0,
    MAX_SCORE: 10.0,
    MIN_SCORE: 0.0,
  },
};

export const WORKLOAD_LIMITS = {
  SUPERVISOR: {
    LECTURER: 4,
    ASSOCIATE_PROFESSOR: 6,
    PROFESSOR: 8,
  },
  REVIEWER: {
    LECTURER: 8,
    ASSOCIATE_PROFESSOR: 10,
    PROFESSOR: 12,
  },
  COMMITTEE: {
    LECTURER: 10,
    ASSOCIATE_PROFESSOR: 12,
    PROFESSOR: 15,
  },
};

export const NOTIFICATION_TYPES = {
  TOPIC_CREATED: 'TOPIC_CREATED',
  TOPIC_SUBMITTED: 'TOPIC_SUBMITTED',
  TOPIC_APPROVED: 'TOPIC_APPROVED',
  TOPIC_REJECTED: 'TOPIC_REJECTED',
  TOPIC_REQUIRE_EDIT: 'TOPIC_REQUIRE_EDIT',
  GROUP_INVITATION: 'GROUP_INVITATION',
  REGISTRATION_PENDING: 'REGISTRATION_PENDING',
  REGISTRATION_CONFIRMED: 'REGISTRATION_CONFIRMED',
  REGISTRATION_REJECTED: 'REGISTRATION_REJECTED',
  ASSIGNMENT_CREATED: 'ASSIGNMENT_CREATED',
  ASSIGNMENT_REMINDER: 'ASSIGNMENT_REMINDER',
  ASSIGNMENT_OVERDUE: 'ASSIGNMENT_OVERDUE',
  GRADE_SUBMITTED: 'GRADE_SUBMITTED',
  SCORE_FINALIZED: 'SCORE_FINALIZED',
  DEFENSE_SCHEDULED: 'DEFENSE_SCHEDULED',
  EXTRA_POINT_REQUESTED: 'EXTRA_POINT_REQUESTED',
  EXTRA_POINT_APPROVED: 'EXTRA_POINT_APPROVED',
  EXTRA_POINT_REJECTED: 'EXTRA_POINT_REJECTED',
};

export const ERROR_CODES = {
  // Authentication
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  INVALID_TOKEN: 'INVALID_TOKEN',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',

  // Topic
  TOPIC_NOT_FOUND: 'TOPIC_NOT_FOUND',
  TOPIC_ALREADY_REGISTERED: 'TOPIC_ALREADY_REGISTERED',
  TOPIC_FULL: 'TOPIC_FULL',
  INVALID_TOPIC_STATUS: 'INVALID_TOPIC_STATUS',

  // Group
  GROUP_NOT_FOUND: 'GROUP_NOT_FOUND',
  ALREADY_IN_GROUP: 'ALREADY_IN_GROUP',
  NOT_GROUP_LEADER: 'NOT_GROUP_LEADER',

  // Assignment
  ASSIGNMENT_NOT_FOUND: 'ASSIGNMENT_NOT_FOUND',
  SUPERVISOR_CONFLICT: 'SUPERVISOR_CONFLICT',
  REVIEWER_DUPLICATE: 'REVIEWER_DUPLICATE',
  WORKLOAD_EXCEEDED: 'WORKLOAD_EXCEEDED',

  // Grading
  GRADE_NOT_FOUND: 'GRADE_NOT_FOUND',
  ALREADY_FINALIZED: 'ALREADY_FINALIZED',
  INCOMPLETE_GRADES: 'INCOMPLETE_GRADES',

  // General
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
};
