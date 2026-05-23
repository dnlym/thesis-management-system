// Core types for the thesis management system - Aligned with Backend API

export type UserRole =
    | 'STUDENT'
    | 'LECTURER'
    | 'HEAD'
    | 'ADMIN'
    | 'COORDINATOR';

export type CommitteeType = 'ORAL' | 'POSTER';

export type CommitteeRole = 'CHAIR' | 'SECRETARY' | 'MEMBER' | 'MEMBER_1' | 'MEMBER_2';

// Topic Status - Backend version
export type TopicStatus =
    | 'DRAFT'
    | 'PENDING_APPROVAL'
    | 'REQUIRES_REVISION'
    | 'APPROVED'
    | 'REJECTED'
    | 'REGISTERED'
    | 'WAITING_FOR_DEFENSE_ASSIGNMENT'
    | 'DEFENDING'
    | 'COMPLETED'
    | 'FINALIZED';

export type ProgressStage =
    | 'WORKING'
    | 'REVIEWING'
    | 'READY_FOR_DEFENSE'
    | 'DEFENDING'
    | 'DONE';

// Student Progress Status
export type StudentProgressStatus =
    | 'NOT_STARTED'
    | 'HAS_TOPIC'
    | 'HAS_TOPIC'
    | 'ADVISOR_GRADED'
    | 'REVIEWER_GRADED'
    | 'ADVISOR_GRADED'
    | 'REVIEWER_GRADED'
    | 'DEFENSE_SCHEDULED'
    | 'DEFENSE_COMPLETED'
    | 'COUNCIL_GRADED'
    | 'COMPLETED';



// Assignment Types
export type AssignmentType = 'REVIEWER' | 'COMMITTEE';

// Assignment Status
export type AssignmentStatus = 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'AUTO_ACCEPTED';

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
    | 'COMMITTEE_MEMBER_2'
    | 'ORAL_COMMITTEE'
    | 'POSTER_COMMITTEE'
    | 'ADVISOR' // For legacy support
    | 'REVIEWER' // For legacy support
    | 'COMMITTEE' // For legacy support
    | 'COUNCIL_MEMBER'; // For legacy support

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
    midterm_status?: 'PASS' | 'FAIL' | null;
    midtermStatus?: 'PASS' | 'FAIL' | null;
}

export interface Department {
    id: string;
    name: string;
    code: string;
    head_id?: string;
    created_at: string;
    updated_at: string;
}

export type SemesterPhase = 'PLANNING' | 'PREVIEW' | 'REGISTRATION' | 'WORK' | 'REVIEWING' | 'DEFENSE' | 'FINAL';
export type SemesterStatus = 'PLANNING' | 'ACTIVE' | 'COMPLETED';

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
    status: SemesterStatus;
    calculated_phase?: SemesterPhase | null;
    deptConfig?: {
        defense_date?: string;
        is_registration_open?: boolean;
    } | null;
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
    defense_schedules?: DefenseSchedule[];
    committee?: Committee;
    students?: User[];
    is_interdisciplinary?: boolean;
    is_visible?: boolean;
    is_locked?: boolean;
    progress_stage?: ProgressStage;
    co_supervisor_id?: string | null;
    secondary_department_id?: string | null;
    interdisciplinary_status?: 'PENDING' | 'APPROVED' | 'REJECTED' | null;
    source_topic_id?: string | null;
    source_topic?: Topic | null;
    grades?: Grade[];
    final_scores?: FinalScore[];
    room?: string | null;
    assignments?: Assignment[];
    allowedActions?: Record<string, ActionPermission>;
    topicId?: string; // Add topicId for group-flattened topics from backend
    groupId?: string; // Add groupId for group-flattened topics from backend
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



export interface Assignment {
    id: string;
    topic_id: string;
    assignment_type: AssignmentType;
    reviewer_id: string;
    reviewer_order?: number | null;
    committee_role?: string | null; // CHAIR, SECRETARY, MEMBER
    status: AssignmentStatus;
    assigned_at: string;
    deadline_at?: string;
    room?: string | null;
    deadline?: string; // Alias for frontend
    responded_at?: string | null;
    decline_reason?: string | null;
    topic?: Topic;
    group_id?: string | null;
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
    student_id?: string | null;
    grader_id: string;
    criterion_id: string;
    rater_role: RaterRole;
    reviewer_order?: number | null;
    committee_role?: 'CHAIR' | 'SECRETARY' | 'MEMBER' | null;
    group_id?: string | null;
    score: number;
    comments?: string | null;
    graded_at: string;
    created_at?: string;
    updated_at?: string;
    criterion?: GradingCriteria;
    grader?: User;
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
    group_id?: string | null;
    total_score?: number;
    result?: string;
    topic?: Topic;
    student?: User;
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
    isInterdisciplinary?: boolean;
    coSupervisorId?: string;
}



export interface GradeSubmissionForm {
    topic_id: string;
    group_id?: string;
    student_id?: string;
    rater_role: string; // Chuyển từ RaterRole sang string để nới lỏng
    reviewer_order?: number | null;
    committee_role?: 'CHAIR' | 'SECRETARY' | 'MEMBER' | null;
    scores: {
        criterion_id: string;
        score: number;
        comment?: string;
    }[];
    general_comment?: string; // THÊM TẬN GỐC TẠI ĐÂY
}

export type GradeSubmissionResult = Grade[] | { message: string; status: 'PENDING_APPROVAL'; requestCount: number };

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
// Workflow & Permissions
export interface ActionPermission {
    allowed: boolean;
    code: string;
    reason?: string;
}

export interface EntityPermissions {
    grade_midterm: boolean;
    grade_midterm_code: string;
    grade_midterm_reason?: string;
    grade_supervisor: boolean;
    grade_supervisor_code: string;
    grade_supervisor_reason?: string;
    grade_reviewer: boolean;
    grade_reviewer_code: string;
    grade_reviewer_reason?: string;
    grade_committee: boolean;
    grade_committee_code: string;
    grade_committee_reason?: string;
}

export interface MidtermRegistration extends Registration {
    topic: Topic;
    student?: User;
    group?: Group & { members: { user: User }[] };
    midterm_status: 'PASS' | 'FAIL' | null;
    midterm_feedback?: string;
    midterm_graded_at?: string;
    permissions?: EntityPermissions;
}
