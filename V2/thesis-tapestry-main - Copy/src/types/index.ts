// Core types for the thesis management system - Aligned with Backend API

export type UserRole =
  | 'STUDENT'
  | 'LECTURER'
  | 'HEAD'
  | 'ADMIN';

export type CommitteeType = 'ORAL' | 'POSTER';

export type CommitteeRole = 'CHAIR' | 'SECRETARY' | 'MEMBER' | 'MEMBER_1' | 'MEMBER_2';

// Topic Status - Backend version
export type TopicStatus =
  | 'DRAFT'
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'REJECTED'
  | 'REQUIRE_EDIT'
  | 'REGISTERED'
  | 'UNDER_REVIEW'
  | 'WAITING_FOR_DEFENSE_ASSIGNMENT'
  | 'WAITING_FOR_DEFENSE'
  | 'DEFENDING'
  | 'COMPLETED'
  | 'FINALIZED'
  | 'HIDDEN';

// Student Progress Status
export type StudentProgressStatus =
  | 'NOT_STARTED'
  | 'HAS_TOPIC'
  | 'PROPOSAL_SUBMITTED'
  | 'PROPOSAL_APPROVED'
  | 'THESIS_IN_PROGRESS'
  | 'THESIS_SUBMITTED'
  | 'ADVISOR_GRADED'
  | 'REVIEWER_GRADED'
  | 'DEFENSE_SCHEDULED'
  | 'DEFENSE_COMPLETED'
  | 'COUNCIL_GRADED'
  | 'COMPLETED';

// Submission Types
export type SubmissionType = 'PROPOSAL' | 'REPORT' | 'SOURCE_CODE' | 'SLIDES';

// Submission Status
export type SubmissionStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'APPROVED_FOR_REVIEW'
  | 'REVISION_REQUIRED'
  | 'LOCKED';

// Assignment Types
export type AssignmentType = 'REVIEWER' | 'COMMITTEE';

// Assignment Status
export type AssignmentStatus = 'PENDING' | 'ACCEPTED' | 'DECLINED';

// Registration Status
export type RegistrationStatus = 'PENDING' | 'CONFIRMED' | 'REJECTED' | 'CANCELLED';

// Extra Points Status
export type ExtraPointsStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'WITHDRAWN';

// Rater Roles for Grading - Aligned with Backend
export type RaterRole =
  | 'SUPERVISOR'
  | 'REVIEWER_1'
  | 'REVIEWER_2'
  | 'REVIEWER_3'
  | 'COMMITTEE_CHAIR'
  | 'COMMITTEE_SECRETARY'
  | 'COMMITTEE_MEMBER'
  | 'COMMITTEE_MEMBER_1'
  | 'COMMITTEE_MEMBER_2';

// Criteria Types
export type CriteriaType = 'ADVISOR' | 'REVIEWER' | 'COUNCIL' | 'FINAL';

// Grading Criteria Types
export type GradingCriteriaType = 'ADVISOR' | 'REVIEWER' | 'COUNCIL' | 'FINAL';

export interface User {
  id: string;
  full_name: string;
  email: string;
  role: UserRole;
  department_id?: string;
  avatar_url?: string | null;
  student_code?: string;
  joined_at?: string;
  finalScore?: FinalScore;
}

export interface Department {
  id: string;
  name: string;
  code: string;
  head_id?: string;
  created_at: string;
  updated_at: string;
}

export type SemesterPhase = 'PLANNING' | 'TOPIC_PROPOSAL' | 'REGISTRATION' | 'IMPLEMENTATION' | 'REVIEWING' | 'DEFENSE' | 'CLOSED' | 'ARCHIVED';

export interface Semester {
  id: string;
  name: string;
  code: string;
  start_date: string;
  end_date: string;
  topic_registration_start?: string;
  topic_registration_end?: string;
  topic_viewing_start?: string;
  topic_viewing_end?: string;
  midterm_start?: string;
  midterm_end?: string;
  proposal_deadline: string;
  thesis_deadline: string;
  defense_start: string;
  defense_end: string;
  current_phase: SemesterPhase;
  manual_phase_override?: SemesterPhase | null;
  calculated_phase?: SemesterPhase;
  created_at: string;
  updated_at: string;
}

export interface Topic {
  id: string;
  code?: string;
  title: string;
  description: string;
  objectives?: string;
  requirements?: string;
  edit_notes?: string;
  semester_id: string;
  department_id: string;
  supervisor_id: string;
  max_students: number;
  current_students: number;
  status: TopicStatus;
  student_progress_status?: StudentProgressStatus;
  created_at: string;
  updated_at: string;
  supervisor?: {
    id: string;
    full_name: string;
    email: string;
    avatar_url?: string;
  };
  semester?: Semester;
  department?: Department;
  registrations?: any[]; // Using any[] for now to avoid circular dependencies or complex types, can be refined later
  defense_type?: 'ORAL' | 'POSTER';
  defense_schedule?: DefenseSchedule;
  committee?: Committee;
  students?: User[];
}

export interface Group {
  id: string;
  name: string;
  leader_id: string;
  member_ids: string[];
  topic_id?: string | null;
  created_at: string;
  updated_at: string;
  semester_id?: string;
  semester?: any;
  members?: any[];
  registrations?: any;
}

export interface Registration {
  id: string;
  topic_id: string;
  group_id?: string | null;
  student_id: string;
  status: RegistrationStatus;
  registered_at: string;
  confirmed_at?: string | null;
  rejection_reason?: string | null;
}

export interface Submission {
  id: string;
  topic_id: string;
  group_id: string;
  type: SubmissionType;
  current_version: number;
  status: SubmissionStatus;
  locked: boolean;
  locked_by?: string | null;
  locked_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface SubmissionVersion {
  id: string;
  submission_id: string;
  version: number;
  file_url: string;
  file_name: string;
  file_size: number;
  comments?: string | null;
  uploaded_by: string;
  uploaded_at: string;
  approved: boolean;
  approved_by?: string | null;
  approved_at?: string | null;
  rejection_reason?: string | null;
}

export interface Assignment {
  id: string;
  topic_id: string;
  assignment_type: AssignmentType;
  reviewer_id: string;
  reviewer_order?: number | null;
  committee_role?: CommitteeRole | null;
  status: AssignmentStatus;
  assigned_at: string;
  responded_at?: string | null;
  decline_reason?: string | null;
  topic?: Topic;
  reviewer?: {
    id: string;
    full_name: string;
    email: string;
  };
  assigner?: {
    id: string;
    full_name: string;
  };
}

export interface DefenseSchedule {
  id: string;
  topic_id: string;
  committee_id?: string | null;
  semester_id: string;
  defense_date: string;
  defense_time?: string | null;
  start_time?: string | null;
  end_time?: string | null;
  room?: string | null;
  status: 'PENDING' | 'SCHEDULED' | 'COMPLETED' | 'CANCELLED';
  committee_chair?: string | null;
  committee_secretary?: string | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;
  committee?: Committee;
}

export interface Committee {
  id: string;
  name: string;
  semester_id: string;
  room_preference?: string | null;
  type: CommitteeType;
  members: CommitteeMember[];
  created_at: string;
}

export interface CommitteeMember {
  id: string;
  committee_id: string;
  lecturer_id: string;
  role: CommitteeRole;
  lecturer?: User;
}

export interface GradingCriteria {
  id: string;
  name: string;
  description?: string;
  criteria_type: CriteriaType;
  max_score: number;
  min_score: number;
  weight: number;
  order_index: number;
  created_at: string;
  updated_at: string;
}

export interface Grade {
  id: string;
  topic_id: string;
  rater_id: string;
  rater_role: RaterRole;
  reviewer_order?: number | null;
  scores: GradeScore[];
  submitted_at: string;
}

export interface GradeScore {
  criterion_id: string;
  score: number;
  comment?: string;
}

export interface FinalScore {
  id: string;
  topic_id: string;
  advisor_score?: number | null;
  supervisor_score?: number | null;
  reviewer1_score?: number | null;
  reviewer2_score?: number | null;
  reviewer3_score?: number | null;
  avg_reviewer_score?: number | null;
  reviewer_avg_score?: number | null;
  council_scores?: number[];
  avg_council_score?: number | null;
  committee_score?: number | null;
  computed_score?: number | null;
  extra_points?: number | null;
  final_score?: number | null;
  classification?: string | null;
  grade_classification?: string | null;
  finalized: boolean;
  finalized_by?: string | null;
  finalized_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ExtraPoints {
  id: string;
  topic_id: string;
  student_id: string;
  reason: string;
  evidence_url?: string | null;
  evidence_versions?: any;
  points_requested: number;
  approved_points?: number | null;
  status: ExtraPointsStatus;
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  rejection_reason?: string | null;
  created_at: string;
  student?: User;
  topic?: Topic;
  reviewer?: User;
}

export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: 'INFO' | 'WARNING' | 'SUCCESS' | 'ERROR' | 'GROUP_INVITE' | 'GROUP_INVITE_ACCEPTED' | 'GROUP_INVITE_REJECTED' | 'GROUP_DISBANDED';
  read: boolean;
  actionUrl?: string | null;
  relatedId?: string | null; // ID of related entity (invite, group, etc.)
  createdAt: string;
}

// API Response types
export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    size: number;
    total: number;
    totalPages: number;
  };
}

// Form types
export interface LoginForm {
  email: string;
  password: string;
}

export interface RegistrationForm {
  topicId: string;
  groupId?: string;
  note?: string;
}

export interface TopicForm {
  title: string;
  description: string;
  objectives?: string;
  requirements?: string;
  semesterId: string;
  departmentId?: string;
  maxStudents: number;
  isDraft?: boolean;
}

export interface SubmissionUploadForm {
  topicId: string;
  groupId: string;
  type: SubmissionType;
  file: File;
  comments?: string;
}

export interface GradeSubmissionForm {
  topic_id: string;
  student_id?: string;  // For per-student grading
  rater_role: RaterRole;
  reviewer_order?: number;
  scores: GradeScore[];
}

export interface ExtraPointsForm {
  topic_id: string;
  description: string;
  requested_points?: number;
  proof_file: File;
}

export interface ReviewerAssignmentForm {
  topicId: string;
  reviewerId: string;
  reviewerOrder?: number;
  deadlineAt?: Date;
}

export interface DefenseScheduleForm {
  topic_id: string;
  date: string;
  start_time: string;
  end_time: string;
  location: string;
  chair_id: string;
  secretary_id: string;
  member_ids: string[];
}

// DTOs
export type CreateDepartmentDto = Omit<Department, 'id' | 'createdAt' | 'updatedAt'>;
export type UpdateDepartmentDto = Partial<CreateDepartmentDto>;

export type CreateSemesterDto = Omit<Semester, 'id' | 'createdAt' | 'updatedAt'>;
export type UpdateSemesterDto = Partial<CreateSemesterDto>;