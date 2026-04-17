import React from 'react';
import { useTranslation } from 'react-i18next';
import { Tag } from 'antd';
import type {
    TopicStatus,
    RegistrationStatus,
    SubmissionStatus,
    AssignmentStatus,
    ExtraPointsStatus,
    StudentProgressStatus,
    SemesterPhase,
    SemesterStatus
} from '@/types';

interface StatusBadgeProps {
    status:
    | TopicStatus
    | RegistrationStatus
    | SubmissionStatus
    | AssignmentStatus
    | ExtraPointsStatus
    | StudentProgressStatus
    | SemesterPhase
    | SemesterStatus;
    className?: string;
}

const topicStatusConfig: Record<TopicStatus, { labelKey: string; color: string }> = {
    DRAFT: { labelKey: 'status.topic.DRAFT', color: 'default' },
    PENDING_APPROVAL: { labelKey: 'status.topic.PENDING_APPROVAL', color: 'processing' },
    APPROVED: { labelKey: 'status.topic.APPROVED', color: 'success' },
    REJECTED: { labelKey: 'status.topic.REJECTED', color: 'error' },
    REQUIRE_EDIT: { labelKey: 'status.topic.REQUIRE_EDIT', color: 'warning' },
    REGISTERED: { labelKey: 'status.topic.REGISTERED', color: 'cyan' },
    UNDER_REVIEW: { labelKey: 'status.topic.UNDER_REVIEW', color: 'blue' },
    WAITING_FOR_DEFENSE_ASSIGNMENT: { labelKey: 'status.topic.WAITING_FOR_DEFENSE_ASSIGNMENT', color: 'purple' },
    WAITING_FOR_DEFENSE: { labelKey: 'status.topic.WAITING_FOR_DEFENSE', color: 'geekblue' },
    DEFENDING: { labelKey: 'status.topic.DEFENDING', color: 'magenta' },
    COMPLETED: { labelKey: 'status.topic.COMPLETED', color: 'green' },
    FINALIZED: { labelKey: 'status.topic.FINALIZED', color: '#87d068' },
    HIDDEN: { labelKey: 'status.topic.HIDDEN', color: 'default' },
};

const semesterPhaseConfig: Record<SemesterPhase, { labelKey: string; color: string }> = {
    PREVIEW: { labelKey: 'PREVIEW', color: 'default' },
    REGISTRATION: { labelKey: 'REGISTRATION', color: 'cyan' },
    WORK: { labelKey: 'WORK', color: 'processing' },
    REVIEWING: { labelKey: 'REVIEWING', color: 'warning' },
    DEFENSE: { labelKey: 'DEFENSE', color: 'purple' },
    FINAL: { labelKey: 'FINAL', color: 'success' },
};

const semesterStatusConfig: Record<SemesterStatus, { labelKey: string; color: string }> = {
    PLANNING: { labelKey: 'PLANNING', color: 'default' },
    ACTIVE: { labelKey: 'ACTIVE', color: 'processing' },
    COMPLETED: { labelKey: 'COMPLETED', color: 'success' },
};

const registrationStatusConfig: Record<RegistrationStatus, { labelKey: string; color: string }> = {
    PENDING: { labelKey: 'status.registration.PENDING', color: 'processing' },
    CONFIRMED: { labelKey: 'status.registration.CONFIRMED', color: 'success' },
    REJECTED: { labelKey: 'status.registration.REJECTED', color: 'error' },
    CANCELLED: { labelKey: 'status.registration.CANCELLED', color: 'default' },
};

const submissionStatusConfig: Record<SubmissionStatus, { labelKey: string; color: string }> = {
    DRAFT: { labelKey: 'status.submission.DRAFT', color: 'default' },
    SUBMITTED: { labelKey: 'status.submission.SUBMITTED', color: 'processing' },
    APPROVED_FOR_REVIEW: { labelKey: 'status.submission.APPROVED_FOR_REVIEW', color: 'success' },
    REVISION_REQUIRED: { labelKey: 'status.submission.REVISION_REQUIRED', color: 'warning' },
    LOCKED: { labelKey: 'status.submission.LOCKED', color: 'error' },
};

const assignmentStatusConfig: Record<AssignmentStatus, { labelKey: string; color: string }> = {
    PENDING: { labelKey: 'status.assignment.PENDING', color: 'processing' },
    ACCEPTED: { labelKey: 'status.assignment.ACCEPTED', color: 'success' },
    DECLINED: { labelKey: 'status.assignment.DECLINED', color: 'error' },
};

const extraPointsStatusConfig: Record<ExtraPointsStatus, { labelKey: string; color: string }> = {
    PENDING: { labelKey: 'status.extraPoints.PENDING', color: 'processing' },
    APPROVED: { labelKey: 'status.extraPoints.APPROVED', color: 'success' },
    REJECTED: { labelKey: 'status.extraPoints.REJECTED', color: 'error' },
    WITHDRAWN: { labelKey: 'status.extraPoints.WITHDRAWN', color: 'default' },
};

const progressStatusConfig: Record<StudentProgressStatus, { labelKey: string; color: string }> = {
    NOT_STARTED: { labelKey: 'status.progress.NOT_STARTED', color: 'default' },
    HAS_TOPIC: { labelKey: 'status.progress.HAS_TOPIC', color: 'blue' },
    PROPOSAL_SUBMITTED: { labelKey: 'status.progress.PROPOSAL_SUBMITTED', color: 'cyan' },
    PROPOSAL_APPROVED: { labelKey: 'status.progress.PROPOSAL_APPROVED', color: 'success' },
    THESIS_IN_PROGRESS: { labelKey: 'status.progress.THESIS_IN_PROGRESS', color: 'processing' },
    THESIS_SUBMITTED: { labelKey: 'status.progress.THESIS_SUBMITTED', color: 'geekblue' },
    ADVISOR_GRADED: { labelKey: 'status.progress.ADVISOR_GRADED', color: 'purple' },
    REVIEWER_GRADED: { labelKey: 'status.progress.REVIEWER_GRADED', color: 'magenta' },
    DEFENSE_SCHEDULED: { labelKey: 'status.progress.DEFENSE_SCHEDULED', color: 'gold' },
    DEFENSE_COMPLETED: { labelKey: 'status.progress.DEFENSE_COMPLETED', color: 'orange' },
    COUNCIL_GRADED: { labelKey: 'status.progress.COUNCIL_GRADED', color: 'volcano' },
    COMPLETED: { labelKey: 'status.progress.COMPLETED', color: 'green' },
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
    const { t } = useTranslation();

    const getStatusConfig = () => {
        if (status in topicStatusConfig) {
            return topicStatusConfig[status as TopicStatus];
        }
        if (status in registrationStatusConfig) {
            return registrationStatusConfig[status as RegistrationStatus];
        }
        if (status in submissionStatusConfig) {
            return submissionStatusConfig[status as SubmissionStatus];
        }
        if (status in assignmentStatusConfig) {
            return assignmentStatusConfig[status as AssignmentStatus];
        }
        if (status in extraPointsStatusConfig) {
            return extraPointsStatusConfig[status as ExtraPointsStatus];
        }
        if (status in progressStatusConfig) {
            return progressStatusConfig[status as StudentProgressStatus];
        }
        if (status in (semesterPhaseConfig as any)) {
            return semesterPhaseConfig[status as SemesterPhase];
        }
        if (status in semesterStatusConfig) {
            return semesterStatusConfig[status as SemesterStatus];
        }
        return { labelKey: '', color: 'default' };
    };

    const config = getStatusConfig();
    const label = config.labelKey ? t(config.labelKey) : status;

    return (
        <Tag color={config.color} className={className}>
            {label}
        </Tag>
    );
}
