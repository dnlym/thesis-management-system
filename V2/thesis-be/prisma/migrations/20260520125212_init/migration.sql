-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('STUDENT', 'LECTURER', 'HEAD', 'ADMIN', 'COORDINATOR');

-- CreateEnum
CREATE TYPE "DefenseType" AS ENUM ('ORAL', 'POSTER');

-- CreateEnum
CREATE TYPE "TopicStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'REQUIRES_REVISION', 'REJECTED', 'APPROVED', 'REGISTERED', 'COMPLETED', 'FINALIZED');

-- CreateEnum
CREATE TYPE "ProgressStage" AS ENUM ('WORKING', 'REVIEWING', 'READY_FOR_DEFENSE', 'DEFENDING', 'DONE');

-- CreateEnum
CREATE TYPE "RegistrationStatus" AS ENUM ('PENDING', 'GROUPED', 'CONFIRMED', 'REJECTED', 'CANCELLED', 'FAILED');

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
CREATE TYPE "SemesterStatus" AS ENUM ('PLANNING', 'ACTIVE', 'COMPLETED');

-- CreateEnum
CREATE TYPE "InterdisciplinaryStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "RaterRole" AS ENUM ('SUPERVISOR', 'REVIEWER', 'REVIEWER_1', 'REVIEWER_2', 'REVIEWER_3', 'COMMITTEE', 'COMMITTEE_CHAIR', 'COMMITTEE_SECRETARY', 'COMMITTEE_MEMBER', 'COMMITTEE_MEMBER_1', 'COMMITTEE_MEMBER_2', 'ORAL_COMMITTEE', 'POSTER_COMMITTEE');

-- CreateEnum
CREATE TYPE "StudentProgressStatus" AS ENUM ('NOT_STARTED', 'HAS_TOPIC', 'ADVISOR_GRADED', 'REVIEWER_GRADED', 'DEFENSE_SCHEDULED', 'DEFENSE_COMPLETED', 'COUNCIL_GRADED', 'COMPLETED', 'MIDTERM_FAILED');

-- CreateEnum
CREATE TYPE "MidtermStatus" AS ENUM ('PASS', 'FAIL');

-- CreateEnum
CREATE TYPE "ScheduleStatus" AS ENUM ('PENDING', 'COMPLETED');

-- CreateEnum
CREATE TYPE "GradeChangeStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "departments" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "auto_approve_proposal_on_midterm_pass" BOOLEAN NOT NULL DEFAULT true,
    "max_group_size" INTEGER NOT NULL DEFAULT 2,
    "min_group_size" INTEGER NOT NULL DEFAULT 1,
    "requires_midterm_eval" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "departments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "semesters" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "status" "SemesterStatus" NOT NULL DEFAULT 'PLANNING',
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
    "is_registration_override" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "semesters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "department_semester_configs" (
    "id" TEXT NOT NULL,
    "department_id" TEXT NOT NULL,
    "semester_id" TEXT NOT NULL,
    "defense_date" TIMESTAMP(3),
    "is_registration_open" BOOLEAN NOT NULL DEFAULT false,
    "updated_by" TEXT NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "department_semester_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "role" "UserRole" NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "avatar_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "department_id" TEXT NOT NULL,
    "full_name" VARCHAR(255) NOT NULL,
    "last_login_at" TIMESTAMP(3),
    "last_login_ip" VARCHAR(50),
    "password_hash" VARCHAR(255) NOT NULL,
    "phone" VARCHAR(20),
    "student_code" VARCHAR(50),
    "updated_at" TIMESTAMP(3) NOT NULL,
    "class_name" VARCHAR(50),

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
    "is_visible" BOOLEAN NOT NULL DEFAULT true,
    "is_locked" BOOLEAN NOT NULL DEFAULT false,
    "progress_stage" "ProgressStage" NOT NULL DEFAULT 'WORKING',
    "approved_at" TIMESTAMP(3),
    "approved_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "current_students" INTEGER NOT NULL DEFAULT 0,
    "department_id" TEXT NOT NULL,
    "max_students" INTEGER NOT NULL,
    "rejection_reason" TEXT,
    "edit_notes" TEXT,
    "semester_id" TEXT NOT NULL,
    "supervisor_id" TEXT NOT NULL,
    "co_supervisor_id" TEXT,
    "secondary_department_id" TEXT,
    "is_interdisciplinary" BOOLEAN NOT NULL DEFAULT false,
    "interdisciplinary_status" "InterdisciplinaryStatus",
    "updated_at" TIMESTAMP(3) NOT NULL,
    "code" VARCHAR(50),
    "defense_type" "DefenseType" DEFAULT 'ORAL',
    "is_eligible_for_defense" BOOLEAN,
    "reviewer_required_count" INTEGER NOT NULL DEFAULT 2,
    "source_topic_id" TEXT,

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
    "room" VARCHAR(100),
    "group_id" TEXT,
    "defense_format" VARCHAR(50) DEFAULT 'OFFLINE',
    "end_time" TIMESTAMP(3),
    "start_time" TIMESTAMP(3),
    "zoom_password" VARCHAR(100),

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
    "order_index" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "department_id" TEXT,
    "role" "RaterRole" NOT NULL DEFAULT 'SUPERVISOR',
    "criteria_type" VARCHAR(50),

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
    "group_id" TEXT,

    CONSTRAINT "grades_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "final_scores" (
    "id" TEXT NOT NULL,
    "topic_id" TEXT NOT NULL,
    "student_id" VARCHAR(36) NOT NULL,
    "supervisor_score" DOUBLE PRECISION,
    "reviewer_avg_score" DOUBLE PRECISION,
    "committee_score" DOUBLE PRECISION,
    "computed_score" DOUBLE PRECISION,
    "extra_points" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "final_score" DOUBLE PRECISION,
    "grade_classification" VARCHAR(30),
    "finalized" BOOLEAN NOT NULL DEFAULT false,
    "finalized_by" TEXT,
    "finalized_at" TIMESTAMP(3),
    "computed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "group_id" TEXT,

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
    "group_id" TEXT,

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
    "description" TEXT,
    "reason" TEXT,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "grade_history" (
    "id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "grader_id" TEXT NOT NULL,
    "topic_id" TEXT NOT NULL,
    "group_id" TEXT,
    "criterion_id" TEXT NOT NULL,
    "old_score" DOUBLE PRECISION,
    "new_score" DOUBLE PRECISION NOT NULL,
    "reason" TEXT,
    "changed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rater_role" "RaterRole",

    CONSTRAINT "grade_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "grade_change_requests" (
    "id" TEXT NOT NULL,
    "topic_id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "grader_id" TEXT NOT NULL,
    "criterion_id" TEXT NOT NULL,
    "rater_role" "RaterRole" NOT NULL,
    "old_score" DOUBLE PRECISION,
    "new_score" DOUBLE PRECISION NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "GradeChangeStatus" NOT NULL DEFAULT 'PENDING',
    "reviewed_by" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "rejection_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "grade_change_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permissions" (
    "id" TEXT NOT NULL,
    "code" VARCHAR(100) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "category" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_permissions" (
    "role" "UserRole" NOT NULL,
    "permissionId" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("role","permissionId")
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
CREATE INDEX "department_semester_configs_department_id_idx" ON "department_semester_configs"("department_id");

-- CreateIndex
CREATE INDEX "department_semester_configs_semester_id_idx" ON "department_semester_configs"("semester_id");

-- CreateIndex
CREATE UNIQUE INDEX "department_semester_configs_department_id_semester_id_key" ON "department_semester_configs"("department_id", "semester_id");

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
CREATE INDEX "topics_code_idx" ON "topics"("code");

-- CreateIndex
CREATE INDEX "topics_supervisor_id_idx" ON "topics"("supervisor_id");

-- CreateIndex
CREATE INDEX "topics_department_id_idx" ON "topics"("department_id");

-- CreateIndex
CREATE INDEX "topics_semester_id_idx" ON "topics"("semester_id");

-- CreateIndex
CREATE INDEX "topics_semester_id_department_id_idx" ON "topics"("semester_id", "department_id");

-- CreateIndex
CREATE INDEX "topics_status_idx" ON "topics"("status");

-- CreateIndex
CREATE INDEX "topics_created_at_idx" ON "topics"("created_at");

-- CreateIndex
CREATE INDEX "topics_normalized_title_idx" ON "topics"("normalized_title");

-- CreateIndex
CREATE INDEX "topics_source_topic_id_idx" ON "topics"("source_topic_id");

-- CreateIndex
CREATE UNIQUE INDEX "topics_code_semester_id_key" ON "topics"("code", "semester_id");

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
CREATE INDEX "assignments_topic_id_idx" ON "assignments"("topic_id");

-- CreateIndex
CREATE INDEX "assignments_group_id_idx" ON "assignments"("group_id");

-- CreateIndex
CREATE INDEX "assignments_reviewer_id_idx" ON "assignments"("reviewer_id");

-- CreateIndex
CREATE INDEX "assignments_status_idx" ON "assignments"("status");

-- CreateIndex
CREATE INDEX "assignments_deadline_at_idx" ON "assignments"("deadline_at");

-- CreateIndex
CREATE UNIQUE INDEX "assignments_topic_id_reviewer_id_assignment_type_group_id_key" ON "assignments"("topic_id", "reviewer_id", "assignment_type", "group_id");

-- CreateIndex
CREATE UNIQUE INDEX "assignments_topic_id_reviewer_order_group_id_key" ON "assignments"("topic_id", "reviewer_order", "group_id");

-- CreateIndex
CREATE INDEX "grading_criteria_active_idx" ON "grading_criteria"("active");

-- CreateIndex
CREATE INDEX "grading_criteria_role_idx" ON "grading_criteria"("role");

-- CreateIndex
CREATE INDEX "grading_criteria_order_index_idx" ON "grading_criteria"("order_index");

-- CreateIndex
CREATE INDEX "grades_topic_id_idx" ON "grades"("topic_id");

-- CreateIndex
CREATE INDEX "grades_group_id_idx" ON "grades"("group_id");

-- CreateIndex
CREATE INDEX "grades_student_id_idx" ON "grades"("student_id");

-- CreateIndex
CREATE INDEX "grades_grader_id_idx" ON "grades"("grader_id");

-- CreateIndex
CREATE INDEX "grades_criterion_id_idx" ON "grades"("criterion_id");

-- CreateIndex
CREATE INDEX "grades_rater_role_idx" ON "grades"("rater_role");

-- CreateIndex
CREATE UNIQUE INDEX "grades_topic_id_student_id_grader_id_criterion_id_rater_rol_key" ON "grades"("topic_id", "student_id", "grader_id", "criterion_id", "rater_role", "reviewer_order", "group_id");

-- CreateIndex
CREATE INDEX "final_scores_topic_id_idx" ON "final_scores"("topic_id");

-- CreateIndex
CREATE INDEX "final_scores_group_id_idx" ON "final_scores"("group_id");

-- CreateIndex
CREATE INDEX "final_scores_student_id_idx" ON "final_scores"("student_id");

-- CreateIndex
CREATE INDEX "final_scores_finalized_idx" ON "final_scores"("finalized");

-- CreateIndex
CREATE INDEX "final_scores_grade_classification_idx" ON "final_scores"("grade_classification");

-- CreateIndex
CREATE UNIQUE INDEX "final_scores_topic_id_student_id_group_id_key" ON "final_scores"("topic_id", "student_id", "group_id");

-- CreateIndex
CREATE INDEX "extra_point_requests_student_id_idx" ON "extra_point_requests"("student_id");

-- CreateIndex
CREATE INDEX "extra_point_requests_topic_id_idx" ON "extra_point_requests"("topic_id");

-- CreateIndex
CREATE INDEX "extra_point_requests_status_idx" ON "extra_point_requests"("status");

-- CreateIndex
CREATE UNIQUE INDEX "defense_schedules_group_id_key" ON "defense_schedules"("group_id");

-- CreateIndex
CREATE INDEX "defense_schedules_topic_id_idx" ON "defense_schedules"("topic_id");

-- CreateIndex
CREATE INDEX "defense_schedules_group_id_idx" ON "defense_schedules"("group_id");

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
CREATE INDEX "grade_history_student_id_idx" ON "grade_history"("student_id");

-- CreateIndex
CREATE INDEX "grade_history_grader_id_idx" ON "grade_history"("grader_id");

-- CreateIndex
CREATE INDEX "grade_history_topic_id_idx" ON "grade_history"("topic_id");

-- CreateIndex
CREATE INDEX "grade_history_group_id_idx" ON "grade_history"("group_id");

-- CreateIndex
CREATE INDEX "grade_change_requests_topic_id_idx" ON "grade_change_requests"("topic_id");

-- CreateIndex
CREATE INDEX "grade_change_requests_student_id_idx" ON "grade_change_requests"("student_id");

-- CreateIndex
CREATE INDEX "grade_change_requests_grader_id_idx" ON "grade_change_requests"("grader_id");

-- CreateIndex
CREATE INDEX "grade_change_requests_status_idx" ON "grade_change_requests"("status");

-- CreateIndex
CREATE UNIQUE INDEX "permissions_code_key" ON "permissions"("code");

-- AddForeignKey
ALTER TABLE "department_semester_configs" ADD CONSTRAINT "department_semester_configs_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "department_semester_configs" ADD CONSTRAINT "department_semester_configs_semester_id_fkey" FOREIGN KEY ("semester_id") REFERENCES "semesters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "topics" ADD CONSTRAINT "topics_co_supervisor_id_fkey" FOREIGN KEY ("co_supervisor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "topics" ADD CONSTRAINT "topics_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "topics" ADD CONSTRAINT "topics_secondary_department_id_fkey" FOREIGN KEY ("secondary_department_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "topics" ADD CONSTRAINT "topics_semester_id_fkey" FOREIGN KEY ("semester_id") REFERENCES "semesters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "topics" ADD CONSTRAINT "topics_source_topic_id_fkey" FOREIGN KEY ("source_topic_id") REFERENCES "topics"("id") ON DELETE SET NULL ON UPDATE CASCADE;

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
ALTER TABLE "topic_registrations" ADD CONSTRAINT "topic_registrations_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "topic_registrations" ADD CONSTRAINT "topic_registrations_semester_id_fkey" FOREIGN KEY ("semester_id") REFERENCES "semesters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "topic_registrations" ADD CONSTRAINT "topic_registrations_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "topic_registrations" ADD CONSTRAINT "topic_registrations_topic_id_fkey" FOREIGN KEY ("topic_id") REFERENCES "topics"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_assigned_by_fkey" FOREIGN KEY ("assigned_by") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

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
ALTER TABLE "grades" ADD CONSTRAINT "grades_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grades" ADD CONSTRAINT "grades_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grades" ADD CONSTRAINT "grades_topic_id_fkey" FOREIGN KEY ("topic_id") REFERENCES "topics"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "final_scores" ADD CONSTRAINT "final_scores_finalized_by_fkey" FOREIGN KEY ("finalized_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "final_scores" ADD CONSTRAINT "final_scores_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

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
ALTER TABLE "defense_schedules" ADD CONSTRAINT "defense_schedules_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

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
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grade_history" ADD CONSTRAINT "grade_history_criterion_id_fkey" FOREIGN KEY ("criterion_id") REFERENCES "grading_criteria"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grade_history" ADD CONSTRAINT "grade_history_grader_id_fkey" FOREIGN KEY ("grader_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grade_history" ADD CONSTRAINT "grade_history_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grade_history" ADD CONSTRAINT "grade_history_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grade_history" ADD CONSTRAINT "grade_history_topic_id_fkey" FOREIGN KEY ("topic_id") REFERENCES "topics"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grade_change_requests" ADD CONSTRAINT "grade_change_requests_criterion_id_fkey" FOREIGN KEY ("criterion_id") REFERENCES "grading_criteria"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grade_change_requests" ADD CONSTRAINT "grade_change_requests_grader_id_fkey" FOREIGN KEY ("grader_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grade_change_requests" ADD CONSTRAINT "grade_change_requests_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grade_change_requests" ADD CONSTRAINT "grade_change_requests_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grade_change_requests" ADD CONSTRAINT "grade_change_requests_topic_id_fkey" FOREIGN KEY ("topic_id") REFERENCES "topics"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
