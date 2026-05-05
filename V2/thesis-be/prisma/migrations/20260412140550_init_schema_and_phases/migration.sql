-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('STUDENT', 'LECTURER', 'HEAD', 'ADMIN');

-- CreateEnum
CREATE TYPE "DefenseType" AS ENUM ('ORAL', 'POSTER');

-- CreateEnum
CREATE TYPE "TopicStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'REQUIRE_EDIT', 'APPROVED', 'REJECTED', 'HIDDEN', 'REGISTERED', 'UNDER_REVIEW', 'WAITING_FOR_DEFENSE_ASSIGNMENT', 'WAITING_FOR_DEFENSE', 'DEFENDING', 'COMPLETED', 'FINALIZED');

-- CreateEnum
CREATE TYPE "RegistrationStatus" AS ENUM ('PENDING', 'GROUPED', 'CONFIRMED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "GroupStatus" AS ENUM ('FORMING', 'COMPLETE', 'LOCKED');

-- CreateEnum
CREATE TYPE "AssignmentStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'AUTO_DECLINED', 'AUTO_ACCEPTED');

-- CreateEnum
CREATE TYPE "AssignmentType" AS ENUM ('REVIEWER', 'COMMITTEE');

-- CreateEnum
CREATE TYPE "CommitteeType" AS ENUM ('ORAL', 'POSTER');

-- CreateEnum
CREATE TYPE "CommitteeRole" AS ENUM ('CHAIR', 'SECRETARY', 'MEMBER', 'MEMBER_1', 'MEMBER_2');

-- CreateEnum
CREATE TYPE "GroupMemberStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'LEFT');

-- CreateEnum
CREATE TYPE "GroupInviteStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ExtraPointStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "SemesterPhase" AS ENUM ('PLANNING', 'PREVIEW', 'REGISTRATION', 'WORK', 'REVIEWING', 'DEFENSE', 'FINAL');

-- CreateEnum
CREATE TYPE "SubmissionType" AS ENUM ('PROPOSAL', 'THESIS', 'SOURCE_CODE', 'PRESENTATION');

-- CreateEnum
CREATE TYPE "SubmissionStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED_FOR_REVIEW', 'REVISION_REQUIRED', 'FINAL_APPROVED', 'LOCKED');

-- CreateEnum
CREATE TYPE "RaterRole" AS ENUM ('SUPERVISOR', 'REVIEWER_1', 'REVIEWER_2', 'REVIEWER_3', 'COMMITTEE_CHAIR', 'COMMITTEE_SECRETARY', 'COMMITTEE_MEMBER', 'COMMITTEE_MEMBER_1', 'COMMITTEE_MEMBER_2', 'ORAL_COMMITTEE', 'POSTER_COMMITTEE');

-- CreateEnum
CREATE TYPE "ChangeLeaderStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "StudentProgressStatus" AS ENUM ('NOT_STARTED', 'HAS_TOPIC', 'PROPOSAL_SUBMITTED', 'PROPOSAL_APPROVED', 'THESIS_IN_PROGRESS', 'THESIS_SUBMITTED', 'ADVISOR_GRADED', 'REVIEWER_GRADED', 'DEFENSE_SCHEDULED', 'DEFENSE_COMPLETED', 'COUNCIL_GRADED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "MidtermStatus" AS ENUM ('PASS', 'FAIL');

-- CreateEnum
CREATE TYPE "ScheduleStatus" AS ENUM ('PENDING', 'COMPLETED');

-- CreateTable
CREATE TABLE "departments" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "topic_viewing_start" TIMESTAMP(3),
    "topic_viewing_end" TIMESTAMP(3),
    "topic_registration_start" TIMESTAMP(3),
    "topic_registration_end" TIMESTAMP(3),
    "auto_approve_proposal_on_midterm_pass" BOOLEAN NOT NULL DEFAULT true,
    "max_group_size" INTEGER NOT NULL DEFAULT 2,
    "min_group_size" INTEGER NOT NULL DEFAULT 1,
    "required_submission_types_for_review" "SubmissionType"[] DEFAULT ARRAY['PROPOSAL', 'THESIS', 'SOURCE_CODE']::"SubmissionType"[],
    "requires_midterm_eval" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "departments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "semesters" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "current_phase" "SemesterPhase" NOT NULL DEFAULT 'PLANNING',
    "manual_phase_override" "SemesterPhase",
    "start_date" TIMESTAMP(3) NOT NULL,
    "end_date" TIMESTAMP(3) NOT NULL,
    "proposal_deadline" TIMESTAMP(3) NOT NULL,
    "thesis_deadline" TIMESTAMP(3) NOT NULL,
    "defense_start" TIMESTAMP(3),
    "defense_end" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "topic_registration_end" TIMESTAMP(3),
    "topic_registration_start" TIMESTAMP(3),
    "topic_viewing_start" TIMESTAMP(3),
    "topic_viewing_end" TIMESTAMP(3),
    "midterm_start" TIMESTAMP(3),
    "midterm_end" TIMESTAMP(3),

    CONSTRAINT "semesters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "role" "UserRole" NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "avatar_url" VARCHAR(500),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "department_id" TEXT NOT NULL,
    "full_name" VARCHAR(255) NOT NULL,
    "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_login_at" TIMESTAMP(3),
    "last_login_ip" VARCHAR(50),
    "password_hash" VARCHAR(255) NOT NULL,
    "phone" VARCHAR(20),
    "student_code" VARCHAR(50),
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_ip" TEXT,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "replaced_by" TEXT,
    "revoked_at" TIMESTAMP(3),
    "user_agent" TEXT,
    "user_id" TEXT NOT NULL,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "topics" (
    "id" TEXT NOT NULL,
    "title" VARCHAR(500) NOT NULL,
    "description" TEXT NOT NULL,
    "objectives" TEXT NOT NULL,
    "requirements" TEXT NOT NULL,
    "normalized_title" TEXT NOT NULL,
    "status" "TopicStatus" NOT NULL DEFAULT 'DRAFT',
    "approved_at" TIMESTAMP(3),
    "approved_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "current_students" INTEGER NOT NULL DEFAULT 0,
    "department_id" TEXT NOT NULL,
    "edit_notes" TEXT,
    "max_students" INTEGER NOT NULL,
    "rejection_reason" TEXT,
    "semester_id" TEXT NOT NULL,
    "supervisor_id" TEXT NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "code" VARCHAR(50),
    "defense_type" "DefenseType" DEFAULT 'ORAL',

    CONSTRAINT "topics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "topic_versions" (
    "id" TEXT NOT NULL,
    "topic_id" TEXT NOT NULL,
    "version_number" INTEGER NOT NULL,
    "snapshot_data" JSONB NOT NULL,
    "changed_by" TEXT,
    "change_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "topic_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "groups" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "topic_id" TEXT,
    "leader_id" TEXT NOT NULL,
    "semester_id" TEXT NOT NULL,
    "status" "GroupStatus" NOT NULL DEFAULT 'FORMING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "group_members" (
    "id" TEXT NOT NULL,
    "group_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "status" "GroupMemberStatus" NOT NULL DEFAULT 'PENDING',
    "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "left_at" TIMESTAMP(3),

    CONSTRAINT "group_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "group_invites" (
    "id" TEXT NOT NULL,
    "topic_id" TEXT NOT NULL,
    "inviter_id" TEXT NOT NULL,
    "invitee_id" TEXT NOT NULL,
    "status" "GroupInviteStatus" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "responded_at" TIMESTAMP(3),

    CONSTRAINT "group_invites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "group_leader_change_requests" (
    "id" TEXT NOT NULL,
    "group_id" TEXT NOT NULL,
    "current_leader" TEXT NOT NULL,
    "new_leader" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "ChangeLeaderStatus" NOT NULL DEFAULT 'PENDING',
    "requested_by" TEXT NOT NULL,
    "approved_by" TEXT,
    "rejection_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "responded_at" TIMESTAMP(3),

    CONSTRAINT "group_leader_change_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "topic_registrations" (
    "id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "topic_id" TEXT NOT NULL,
    "semester_id" TEXT NOT NULL,
    "group_id" TEXT,
    "status" "RegistrationStatus" NOT NULL DEFAULT 'PENDING',
    "student_progress_status" "StudentProgressStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "rejection_reason" TEXT,
    "registered_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmed_at" TIMESTAMP(3),
    "midterm_feedback" TEXT,
    "midterm_graded_at" TIMESTAMP(3),
    "midterm_status" "MidtermStatus",
    "extra_points_confirmed" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "topic_registrations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "submissions" (
    "id" TEXT NOT NULL,
    "topic_id" TEXT NOT NULL,
    "group_id" TEXT NOT NULL,
    "type" "SubmissionType" NOT NULL,
    "status" "SubmissionStatus" NOT NULL DEFAULT 'DRAFT',
    "current_version" INTEGER NOT NULL DEFAULT 0,
    "is_locked" BOOLEAN NOT NULL DEFAULT false,
    "locked_by" TEXT,
    "locked_at" TIMESTAMP(3),
    "approved_by" TEXT,
    "approved_at" TIMESTAMP(3),
    "rejection_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "submissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "submission_versions" (
    "id" TEXT NOT NULL,
    "submission_id" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "file_url" VARCHAR(500) NOT NULL,
    "file_name" VARCHAR(255) NOT NULL,
    "file_size" INTEGER NOT NULL,
    "mime_type" VARCHAR(100) NOT NULL,
    "checksum" VARCHAR(64) NOT NULL,
    "uploaded_by" TEXT NOT NULL,
    "comments" TEXT,
    "uploaded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "submission_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assignments" (
    "id" TEXT NOT NULL,
    "topic_id" TEXT NOT NULL,
    "reviewer_id" TEXT NOT NULL,
    "assignment_type" "AssignmentType" NOT NULL,
    "reviewer_order" INTEGER,
    "committee_role" "CommitteeRole",
    "status" "AssignmentStatus" NOT NULL DEFAULT 'PENDING',
    "assigned_by" TEXT NOT NULL,
    "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deadline_at" TIMESTAMP(3) NOT NULL,
    "first_reminder_sent" TIMESTAMP(3),
    "second_reminder_sent" TIMESTAMP(3),
    "responded_at" TIMESTAMP(3),
    "auto_declined_at" TIMESTAMP(3),
    "decline_reason" TEXT,

    CONSTRAINT "assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "grading_criteria" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT NOT NULL,
    "weight" DOUBLE PRECISION NOT NULL,
    "max_score" DOUBLE PRECISION NOT NULL,
    "min_score" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "criteria_type" VARCHAR(100) NOT NULL,
    "order_index" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "department_id" TEXT,
    "role" "RaterRole" NOT NULL DEFAULT 'SUPERVISOR',

    CONSTRAINT "grading_criteria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "grades" (
    "id" TEXT NOT NULL,
    "topic_id" TEXT NOT NULL,
    "student_id" TEXT,
    "grader_id" TEXT NOT NULL,
    "criterion_id" TEXT NOT NULL,
    "rater_role" "RaterRole" NOT NULL,
    "reviewer_order" INTEGER,
    "score" DOUBLE PRECISION NOT NULL,
    "comments" TEXT,
    "graded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "grades_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "final_scores" (
    "id" TEXT NOT NULL,
    "topic_id" TEXT NOT NULL,
    "student_id" VARCHAR(36) NOT NULL,
    "supervisor_score" DOUBLE PRECISION NOT NULL,
    "reviewer_avg_score" DOUBLE PRECISION NOT NULL,
    "committee_score" DOUBLE PRECISION NOT NULL,
    "computed_score" DOUBLE PRECISION NOT NULL,
    "extra_points" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "final_score" DOUBLE PRECISION NOT NULL,
    "grade_classification" VARCHAR(10),
    "finalized" BOOLEAN NOT NULL DEFAULT false,
    "finalized_by" TEXT,
    "finalized_at" TIMESTAMP(3),
    "computed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "final_scores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "extra_point_requests" (
    "id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "topic_id" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "evidence_url" VARCHAR(500),
    "evidence_versions" JSONB,
    "points_requested" DOUBLE PRECISION NOT NULL,
    "status" "ExtraPointStatus" NOT NULL DEFAULT 'PENDING',
    "reviewed_by" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "rejection_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "extra_point_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "defense_schedules" (
    "id" TEXT NOT NULL,
    "topic_id" TEXT NOT NULL,
    "committee_id" TEXT,
    "semester_id" TEXT NOT NULL,
    "defense_date" TIMESTAMP(3) NOT NULL,
    "defense_time" VARCHAR(20),
    "start_time" TIMESTAMP(3),
    "end_time" TIMESTAMP(3),
    "room" VARCHAR(100),
    "committee_chair" TEXT,
    "committee_secretary" TEXT,
    "notes" TEXT,
    "status" "ScheduleStatus" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "defense_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "committees" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "semester_id" TEXT NOT NULL,
    "room_preference" VARCHAR(100),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "department_id" TEXT NOT NULL,
    "type" "CommitteeType" NOT NULL DEFAULT 'ORAL',

    CONSTRAINT "committees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "committee_members" (
    "id" TEXT NOT NULL,
    "committee_id" TEXT NOT NULL,
    "lecturer_id" TEXT NOT NULL,
    "semester_id" TEXT NOT NULL,
    "role" "CommitteeRole" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "committee_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_workload_limits" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "semester_id" TEXT NOT NULL,
    "role_type" VARCHAR(50) NOT NULL,
    "max_count" INTEGER NOT NULL,
    "current_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_workload_limits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" VARCHAR(100) NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "content" TEXT NOT NULL,
    "related_id" TEXT,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "action" VARCHAR(100) NOT NULL,
    "entity_type" VARCHAR(100) NOT NULL,
    "entity_id" TEXT NOT NULL,
    "old_value" JSONB,
    "new_value" JSONB,
    "ip_address" VARCHAR(50),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_config" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "value" TEXT NOT NULL,
    "description" TEXT,
    "updated_by_id" TEXT NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "system_config_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "registration_extensions" (
    "id" TEXT NOT NULL,
    "semester_id" TEXT NOT NULL,
    "extended_until" TIMESTAMP(3) NOT NULL,
    "reason" TEXT NOT NULL,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "registration_extensions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "departments_code_key" ON "departments"("code");

-- CreateIndex
CREATE INDEX "departments_code_idx" ON "departments"("code");

-- CreateIndex
CREATE INDEX "departments_active_idx" ON "departments"("active");

-- CreateIndex
CREATE UNIQUE INDEX "semesters_code_key" ON "semesters"("code");

-- CreateIndex
CREATE INDEX "semesters_code_idx" ON "semesters"("code");

-- CreateIndex
CREATE INDEX "semesters_current_phase_idx" ON "semesters"("current_phase");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_student_code_key" ON "users"("student_code");

-- CreateIndex
CREATE INDEX "users_email_idx" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_role_idx" ON "users"("role");

-- CreateIndex
CREATE INDEX "users_student_code_idx" ON "users"("student_code");

-- CreateIndex
CREATE INDEX "users_department_id_idx" ON "users"("department_id");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_key" ON "refresh_tokens"("token");

-- CreateIndex
CREATE INDEX "refresh_tokens_user_id_idx" ON "refresh_tokens"("user_id");

-- CreateIndex
CREATE INDEX "refresh_tokens_expires_at_idx" ON "refresh_tokens"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "topics_code_key" ON "topics"("code");

-- CreateIndex
CREATE INDEX "topics_code_idx" ON "topics"("code");

-- CreateIndex
CREATE INDEX "topics_supervisor_id_idx" ON "topics"("supervisor_id");

-- CreateIndex
CREATE INDEX "topics_department_id_idx" ON "topics"("department_id");

-- CreateIndex
CREATE INDEX "topics_semester_id_idx" ON "topics"("semester_id");

-- CreateIndex
CREATE INDEX "topics_status_idx" ON "topics"("status");

-- CreateIndex
CREATE INDEX "topics_created_at_idx" ON "topics"("created_at");

-- CreateIndex
CREATE INDEX "topics_normalized_title_idx" ON "topics"("normalized_title");

-- CreateIndex
CREATE UNIQUE INDEX "topics_normalized_title_semester_id_department_id_key" ON "topics"("normalized_title", "semester_id", "department_id");

-- CreateIndex
CREATE INDEX "topic_versions_topic_id_idx" ON "topic_versions"("topic_id");

-- CreateIndex
CREATE INDEX "topic_versions_created_at_idx" ON "topic_versions"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "topic_versions_topic_id_version_number_key" ON "topic_versions"("topic_id", "version_number");

-- CreateIndex
CREATE INDEX "groups_topic_id_idx" ON "groups"("topic_id");

-- CreateIndex
CREATE INDEX "groups_leader_id_idx" ON "groups"("leader_id");

-- CreateIndex
CREATE INDEX "groups_semester_id_idx" ON "groups"("semester_id");

-- CreateIndex
CREATE INDEX "groups_status_idx" ON "groups"("status");

-- CreateIndex
CREATE INDEX "group_members_group_id_idx" ON "group_members"("group_id");

-- CreateIndex
CREATE INDEX "group_members_user_id_idx" ON "group_members"("user_id");

-- CreateIndex
CREATE INDEX "group_members_status_idx" ON "group_members"("status");

-- CreateIndex
CREATE UNIQUE INDEX "group_members_group_id_user_id_key" ON "group_members"("group_id", "user_id");

-- CreateIndex
CREATE INDEX "group_invites_topic_id_idx" ON "group_invites"("topic_id");

-- CreateIndex
CREATE INDEX "group_invites_inviter_id_idx" ON "group_invites"("inviter_id");

-- CreateIndex
CREATE INDEX "group_invites_invitee_id_idx" ON "group_invites"("invitee_id");

-- CreateIndex
CREATE INDEX "group_invites_status_idx" ON "group_invites"("status");

-- CreateIndex
CREATE INDEX "group_invites_expires_at_idx" ON "group_invites"("expires_at");

-- CreateIndex
CREATE INDEX "group_leader_change_requests_group_id_idx" ON "group_leader_change_requests"("group_id");

-- CreateIndex
CREATE INDEX "group_leader_change_requests_status_idx" ON "group_leader_change_requests"("status");

-- CreateIndex
CREATE INDEX "topic_registrations_student_id_idx" ON "topic_registrations"("student_id");

-- CreateIndex
CREATE INDEX "topic_registrations_topic_id_idx" ON "topic_registrations"("topic_id");

-- CreateIndex
CREATE INDEX "topic_registrations_semester_id_idx" ON "topic_registrations"("semester_id");

-- CreateIndex
CREATE INDEX "topic_registrations_group_id_idx" ON "topic_registrations"("group_id");

-- CreateIndex
CREATE INDEX "topic_registrations_status_idx" ON "topic_registrations"("status");

-- CreateIndex
CREATE INDEX "topic_registrations_student_progress_status_idx" ON "topic_registrations"("student_progress_status");

-- CreateIndex
CREATE UNIQUE INDEX "topic_registrations_student_id_semester_id_key" ON "topic_registrations"("student_id", "semester_id");

-- CreateIndex
CREATE INDEX "submissions_topic_id_idx" ON "submissions"("topic_id");

-- CreateIndex
CREATE INDEX "submissions_group_id_idx" ON "submissions"("group_id");

-- CreateIndex
CREATE INDEX "submissions_status_idx" ON "submissions"("status");

-- CreateIndex
CREATE INDEX "submissions_is_locked_idx" ON "submissions"("is_locked");

-- CreateIndex
CREATE UNIQUE INDEX "submissions_topic_id_group_id_type_key" ON "submissions"("topic_id", "group_id", "type");

-- CreateIndex
CREATE INDEX "submission_versions_submission_id_idx" ON "submission_versions"("submission_id");

-- CreateIndex
CREATE INDEX "submission_versions_uploaded_at_idx" ON "submission_versions"("uploaded_at");

-- CreateIndex
CREATE UNIQUE INDEX "submission_versions_submission_id_version_key" ON "submission_versions"("submission_id", "version");

-- CreateIndex
CREATE INDEX "assignments_topic_id_idx" ON "assignments"("topic_id");

-- CreateIndex
CREATE INDEX "assignments_reviewer_id_idx" ON "assignments"("reviewer_id");

-- CreateIndex
CREATE INDEX "assignments_status_idx" ON "assignments"("status");

-- CreateIndex
CREATE INDEX "assignments_deadline_at_idx" ON "assignments"("deadline_at");

-- CreateIndex
CREATE UNIQUE INDEX "assignments_topic_id_reviewer_id_assignment_type_key" ON "assignments"("topic_id", "reviewer_id", "assignment_type");

-- CreateIndex
CREATE UNIQUE INDEX "assignments_topic_id_reviewer_order_key" ON "assignments"("topic_id", "reviewer_order");

-- CreateIndex
CREATE INDEX "grading_criteria_active_idx" ON "grading_criteria"("active");

-- CreateIndex
CREATE INDEX "grading_criteria_role_idx" ON "grading_criteria"("role");

-- CreateIndex
CREATE INDEX "grading_criteria_order_index_idx" ON "grading_criteria"("order_index");

-- CreateIndex
CREATE INDEX "grading_criteria_criteria_type_idx" ON "grading_criteria"("criteria_type");

-- CreateIndex
CREATE INDEX "grades_topic_id_idx" ON "grades"("topic_id");

-- CreateIndex
CREATE INDEX "grades_student_id_idx" ON "grades"("student_id");

-- CreateIndex
CREATE INDEX "grades_grader_id_idx" ON "grades"("grader_id");

-- CreateIndex
CREATE INDEX "grades_criterion_id_idx" ON "grades"("criterion_id");

-- CreateIndex
CREATE INDEX "grades_rater_role_idx" ON "grades"("rater_role");

-- CreateIndex
CREATE UNIQUE INDEX "grades_topic_id_student_id_grader_id_criterion_id_rater_rol_key" ON "grades"("topic_id", "student_id", "grader_id", "criterion_id", "rater_role", "reviewer_order");

-- CreateIndex
CREATE INDEX "final_scores_topic_id_idx" ON "final_scores"("topic_id");

-- CreateIndex
CREATE INDEX "final_scores_student_id_idx" ON "final_scores"("student_id");

-- CreateIndex
CREATE INDEX "final_scores_finalized_idx" ON "final_scores"("finalized");

-- CreateIndex
CREATE INDEX "final_scores_grade_classification_idx" ON "final_scores"("grade_classification");

-- CreateIndex
CREATE UNIQUE INDEX "final_scores_topic_id_student_id_key" ON "final_scores"("topic_id", "student_id");

-- CreateIndex
CREATE INDEX "extra_point_requests_student_id_idx" ON "extra_point_requests"("student_id");

-- CreateIndex
CREATE INDEX "extra_point_requests_topic_id_idx" ON "extra_point_requests"("topic_id");

-- CreateIndex
CREATE INDEX "extra_point_requests_status_idx" ON "extra_point_requests"("status");

-- CreateIndex
CREATE UNIQUE INDEX "extra_point_requests_student_id_topic_id_key" ON "extra_point_requests"("student_id", "topic_id");

-- CreateIndex
CREATE UNIQUE INDEX "defense_schedules_topic_id_key" ON "defense_schedules"("topic_id");

-- CreateIndex
CREATE INDEX "defense_schedules_topic_id_idx" ON "defense_schedules"("topic_id");

-- CreateIndex
CREATE INDEX "defense_schedules_defense_date_idx" ON "defense_schedules"("defense_date");

-- CreateIndex
CREATE INDEX "defense_schedules_committee_id_idx" ON "defense_schedules"("committee_id");

-- CreateIndex
CREATE INDEX "defense_schedules_semester_id_idx" ON "defense_schedules"("semester_id");

-- CreateIndex
CREATE INDEX "committees_semester_id_idx" ON "committees"("semester_id");

-- CreateIndex
CREATE INDEX "committees_department_id_idx" ON "committees"("department_id");

-- CreateIndex
CREATE INDEX "committee_members_committee_id_idx" ON "committee_members"("committee_id");

-- CreateIndex
CREATE INDEX "committee_members_lecturer_id_idx" ON "committee_members"("lecturer_id");

-- CreateIndex
CREATE INDEX "committee_members_semester_id_idx" ON "committee_members"("semester_id");

-- CreateIndex
CREATE UNIQUE INDEX "committee_members_lecturer_id_semester_id_key" ON "committee_members"("lecturer_id", "semester_id");

-- CreateIndex
CREATE INDEX "user_workload_limits_user_id_idx" ON "user_workload_limits"("user_id");

-- CreateIndex
CREATE INDEX "user_workload_limits_semester_id_idx" ON "user_workload_limits"("semester_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_workload_limits_user_id_semester_id_role_type_key" ON "user_workload_limits"("user_id", "semester_id", "role_type");

-- CreateIndex
CREATE INDEX "notifications_user_id_idx" ON "notifications"("user_id");

-- CreateIndex
CREATE INDEX "notifications_is_read_idx" ON "notifications"("is_read");

-- CreateIndex
CREATE INDEX "notifications_created_at_idx" ON "notifications"("created_at");

-- CreateIndex
CREATE INDEX "audit_logs_user_id_idx" ON "audit_logs"("user_id");

-- CreateIndex
CREATE INDEX "audit_logs_entity_type_idx" ON "audit_logs"("entity_type");

-- CreateIndex
CREATE INDEX "audit_logs_entity_id_idx" ON "audit_logs"("entity_id");

-- CreateIndex
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "system_config_name_key" ON "system_config"("name");

-- CreateIndex
CREATE INDEX "system_config_name_idx" ON "system_config"("name");

-- CreateIndex
CREATE INDEX "registration_extensions_semester_id_idx" ON "registration_extensions"("semester_id");

-- CreateIndex
CREATE INDEX "registration_extensions_created_by_idx" ON "registration_extensions"("created_by");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "topics" ADD CONSTRAINT "topics_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "topics" ADD CONSTRAINT "topics_semester_id_fkey" FOREIGN KEY ("semester_id") REFERENCES "semesters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "topics" ADD CONSTRAINT "topics_supervisor_id_fkey" FOREIGN KEY ("supervisor_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "topic_versions" ADD CONSTRAINT "topic_versions_topic_id_fkey" FOREIGN KEY ("topic_id") REFERENCES "topics"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "groups" ADD CONSTRAINT "groups_leader_id_fkey" FOREIGN KEY ("leader_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "groups" ADD CONSTRAINT "groups_semester_id_fkey" FOREIGN KEY ("semester_id") REFERENCES "semesters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "groups" ADD CONSTRAINT "groups_topic_id_fkey" FOREIGN KEY ("topic_id") REFERENCES "topics"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "group_members" ADD CONSTRAINT "group_members_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "group_members" ADD CONSTRAINT "group_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "group_invites" ADD CONSTRAINT "group_invites_invitee_id_fkey" FOREIGN KEY ("invitee_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "group_invites" ADD CONSTRAINT "group_invites_inviter_id_fkey" FOREIGN KEY ("inviter_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "group_invites" ADD CONSTRAINT "group_invites_topic_id_fkey" FOREIGN KEY ("topic_id") REFERENCES "topics"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "group_leader_change_requests" ADD CONSTRAINT "group_leader_change_requests_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "group_leader_change_requests" ADD CONSTRAINT "group_leader_change_requests_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "group_leader_change_requests" ADD CONSTRAINT "group_leader_change_requests_requested_by_fkey" FOREIGN KEY ("requested_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "topic_registrations" ADD CONSTRAINT "topic_registrations_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "topic_registrations" ADD CONSTRAINT "topic_registrations_semester_id_fkey" FOREIGN KEY ("semester_id") REFERENCES "semesters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "topic_registrations" ADD CONSTRAINT "topic_registrations_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "topic_registrations" ADD CONSTRAINT "topic_registrations_topic_id_fkey" FOREIGN KEY ("topic_id") REFERENCES "topics"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_locked_by_fkey" FOREIGN KEY ("locked_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_topic_id_fkey" FOREIGN KEY ("topic_id") REFERENCES "topics"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submission_versions" ADD CONSTRAINT "submission_versions_submission_id_fkey" FOREIGN KEY ("submission_id") REFERENCES "submissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submission_versions" ADD CONSTRAINT "submission_versions_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_assigned_by_fkey" FOREIGN KEY ("assigned_by") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_reviewer_id_fkey" FOREIGN KEY ("reviewer_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_topic_id_fkey" FOREIGN KEY ("topic_id") REFERENCES "topics"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grading_criteria" ADD CONSTRAINT "grading_criteria_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grades" ADD CONSTRAINT "grades_criterion_id_fkey" FOREIGN KEY ("criterion_id") REFERENCES "grading_criteria"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grades" ADD CONSTRAINT "grades_grader_id_fkey" FOREIGN KEY ("grader_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grades" ADD CONSTRAINT "grades_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grades" ADD CONSTRAINT "grades_topic_id_fkey" FOREIGN KEY ("topic_id") REFERENCES "topics"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "final_scores" ADD CONSTRAINT "final_scores_finalized_by_fkey" FOREIGN KEY ("finalized_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "final_scores" ADD CONSTRAINT "final_scores_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "final_scores" ADD CONSTRAINT "final_scores_topic_id_fkey" FOREIGN KEY ("topic_id") REFERENCES "topics"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "extra_point_requests" ADD CONSTRAINT "extra_point_requests_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "extra_point_requests" ADD CONSTRAINT "extra_point_requests_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "extra_point_requests" ADD CONSTRAINT "extra_point_requests_topic_id_fkey" FOREIGN KEY ("topic_id") REFERENCES "topics"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "defense_schedules" ADD CONSTRAINT "defense_schedules_committee_id_fkey" FOREIGN KEY ("committee_id") REFERENCES "committees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "defense_schedules" ADD CONSTRAINT "defense_schedules_semester_id_fkey" FOREIGN KEY ("semester_id") REFERENCES "semesters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "defense_schedules" ADD CONSTRAINT "defense_schedules_topic_id_fkey" FOREIGN KEY ("topic_id") REFERENCES "topics"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "committees" ADD CONSTRAINT "committees_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "committees" ADD CONSTRAINT "committees_semester_id_fkey" FOREIGN KEY ("semester_id") REFERENCES "semesters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "committee_members" ADD CONSTRAINT "committee_members_committee_id_fkey" FOREIGN KEY ("committee_id") REFERENCES "committees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "committee_members" ADD CONSTRAINT "committee_members_lecturer_id_fkey" FOREIGN KEY ("lecturer_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_workload_limits" ADD CONSTRAINT "user_workload_limits_semester_id_fkey" FOREIGN KEY ("semester_id") REFERENCES "semesters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_workload_limits" ADD CONSTRAINT "user_workload_limits_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "system_config" ADD CONSTRAINT "system_config_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registration_extensions" ADD CONSTRAINT "registration_extensions_semester_id_fkey" FOREIGN KEY ("semester_id") REFERENCES "semesters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registration_extensions" ADD CONSTRAINT "registration_extensions_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
