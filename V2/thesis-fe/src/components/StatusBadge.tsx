import React from 'react';
import { useTranslation } from 'react-i18next';
import { Tag, Tooltip } from 'antd';
import { EyeInvisibleOutlined, LockOutlined } from '@ant-design/icons';
import type {
    TopicStatus,
    ProgressStage,
    RegistrationStatus,

    AssignmentStatus,
    ExtraPointsStatus,
    SemesterPhase,
    SemesterStatus
} from '@/types';

// --- CONFIGURATIONS ---

const topicStatusConfig: Record<TopicStatus, { labelKey: string; color: string }> = {
    DRAFT: { labelKey: 'status.topic.DRAFT', color: 'default' },
    PENDING_APPROVAL: { labelKey: 'status.topic.PENDING_APPROVAL', color: 'processing' },
    REQUIRES_REVISION: { labelKey: 'status.topic.REQUIRES_REVISION', color: 'warning' },
    APPROVED: { labelKey: 'status.topic.APPROVED', color: 'success' },
    REJECTED: { labelKey: 'status.topic.REJECTED', color: 'error' },
    REGISTERED: { labelKey: 'status.topic.REGISTERED', color: 'cyan' },
    WAITING_FOR_DEFENSE_ASSIGNMENT: { labelKey: 'status.topic.WAITING_FOR_DEFENSE_ASSIGNMENT', color: 'geekblue' },
    DEFENDING: { labelKey: 'status.topic.DEFENDING', color: 'magenta' },
    COMPLETED: { labelKey: 'status.topic.COMPLETED', color: 'green' },
    FINALIZED: { labelKey: 'status.topic.FINALIZED', color: '#87d068' },
};

const progressStageConfig: Record<ProgressStage, { labelKey: string; color: string }> = {
    WORKING: { labelKey: 'status.progress.WORKING', color: 'blue' },
    REVIEWING: { labelKey: 'status.progress.REVIEWING', color: 'orange' },
    READY_FOR_DEFENSE: { labelKey: 'status.progress.READY_FOR_DEFENSE', color: 'gold' },
    DEFENDING: { labelKey: 'status.progress.DEFENDING', color: 'magenta' },
    DONE: { labelKey: 'status.progress.DONE', color: 'green' },
};

const registrationStatusConfig: Record<RegistrationStatus, { labelKey: string; color: string }> = {
    PENDING: { labelKey: 'status.registration.PENDING', color: 'processing' },
    CONFIRMED: { labelKey: 'status.registration.CONFIRMED', color: 'success' },
    REJECTED: { labelKey: 'status.registration.REJECTED', color: 'error' },
    CANCELLED: { labelKey: 'status.registration.CANCELLED', color: 'default' },
    NO_REGISTRATION: { labelKey: 'status.registration.NO_REGISTRATION', color: 'warning' },
};



const assignmentStatusConfig: Record<AssignmentStatus, { labelKey: string; color: string }> = {
    PENDING: { labelKey: 'status.assignment.PENDING', color: 'processing' },
    ACCEPTED: { labelKey: 'status.assignment.ACCEPTED', color: 'success' },
    DECLINED: { labelKey: 'status.assignment.DECLINED', color: 'error' },
    AUTO_ACCEPTED: { labelKey: 'status.assignment.AUTO_ACCEPTED', color: 'success' },
    AUTO_DECLINED: { labelKey: 'status.assignment.AUTO_DECLINED', color: 'error' },
};

const extraPointsStatusConfig: Record<ExtraPointsStatus, { labelKey: string; color: string }> = {
    PENDING: { labelKey: 'status.extraPoints.PENDING', color: 'processing' },
    APPROVED: { labelKey: 'status.extraPoints.APPROVED', color: 'success' },
    REJECTED: { labelKey: 'status.extraPoints.REJECTED', color: 'error' },
    WITHDRAWN: { labelKey: 'status.extraPoints.WITHDRAWN', color: 'default' },
};


const semesterPhaseConfig: Record<SemesterPhase, { labelKey: string; color: string }> = {
    PLANNING: { labelKey: 'status.semester.PLANNING', color: 'default' },
    PREVIEW: { labelKey: 'status.semester.PREVIEW', color: 'blue' },
    REGISTRATION: { labelKey: 'status.semester.REGISTRATION', color: 'cyan' },
    WORK: { labelKey: 'status.semester.WORK', color: 'processing' },
    REVIEWING: { labelKey: 'status.semester.REVIEWING', color: 'warning' },
    DEFENSE: { labelKey: 'status.semester.DEFENSE', color: 'purple' },
    FINAL: { labelKey: 'status.semester.FINAL', color: 'success' },
};

const semesterStatusConfig: Record<SemesterStatus, { labelKey: string; color: string }> = {
    PLANNING: { labelKey: 'status.semester.PLANNING', color: 'default' },
    ACTIVE: { labelKey: 'status.semester.ACTIVE', color: 'processing' },
    COMPLETED: { labelKey: 'status.semester.COMPLETED', color: 'success' },
};

// --- DOMAIN-SPECIFIC COMPONENTS ---

export const TopicStatusBadge = ({ 
    status, 
    progressStage, 
    isVisible = true, 
    isLocked = false, 
    className = '',
    singleTagOnly = false
}: { 
    status: TopicStatus; 
    progressStage?: ProgressStage; 
    isVisible?: boolean; 
    isLocked?: boolean; 
    className?: string;
    singleTagOnly?: boolean;
}) => {
    const { t } = useTranslation();
    const config = topicStatusConfig[status] || { labelKey: '', color: 'default' };
    const showProgressStage = status === 'REGISTERED' && progressStage && progressStageConfig[progressStage];

    return (
        <div className={`flex flex-wrap gap-1.5 items-center ${className}`}>
            {!isVisible && (
                <Tooltip title={t('topics.hiddenTooltip')}>
                    {singleTagOnly ? (
                        <Tag color="default" className="m-0 flex items-center justify-center p-0.5 border-dashed" icon={<EyeInvisibleOutlined className="text-[11px]" />} />
                    ) : (
                        <Tag color="default" icon={<i className="fas fa-eye-slash" />}>
                            {t('status.topic.HIDDEN')}
                        </Tag>
                    )}
                </Tooltip>
            )}
            
            {(!singleTagOnly || !showProgressStage) && (
                <Tag color={config.color}>
                    {config.labelKey ? t(config.labelKey) : status}
                </Tag>
            )}

            {showProgressStage && (
                <Tag color={progressStageConfig[progressStage].color} bordered={false}>
                    {t(progressStageConfig[progressStage].labelKey)}
                </Tag>
            )}

            {isLocked && (
                <Tooltip title={t('topics.lockedTooltip')}>
                    {singleTagOnly ? (
                        <Tag color="volcano" className="m-0 flex items-center justify-center p-0.5 border-dashed" icon={<LockOutlined className="text-[11px]" />} />
                    ) : (
                        <Tag color="volcano" icon={<i className="fas fa-lock" />}>
                            Locked
                        </Tag>
                    )}
                </Tooltip>
            )}
        </div>
    );
};

export const RegistrationStatusBadge = ({ status, className = '' }: { status: RegistrationStatus; className?: string }) => {
    const { t } = useTranslation();
    const config = registrationStatusConfig[status] || { labelKey: '', color: 'default' };
    return <Tag color={config.color} className={className}>{config.labelKey ? t(config.labelKey) : status}</Tag>;
};



export const AssignmentStatusBadge = ({ status, className = '' }: { status: AssignmentStatus; className?: string }) => {
    const { t } = useTranslation();
    const config = assignmentStatusConfig[status] || { labelKey: '', color: 'default' };
    return <Tag color={config.color} className={className}>{config.labelKey ? t(config.labelKey) : status}</Tag>;
};

export const ExtraPointsStatusBadge = ({ status, className = '' }: { status: ExtraPointsStatus; className?: string }) => {
    const { t } = useTranslation();
    const config = extraPointsStatusConfig[status] || { labelKey: '', color: 'default' };
    return <Tag color={config.color} className={className}>{config.labelKey ? t(config.labelKey) : status}</Tag>;
};


export const SemesterPhaseBadge = ({ phase, className = '' }: { phase: SemesterPhase; className?: string }) => {
    const { t } = useTranslation();
    const config = semesterPhaseConfig[phase] || { labelKey: '', color: 'default' };
    return <Tag color={config.color} className={className}>{config.labelKey ? t(config.labelKey) : phase}</Tag>;
};

export const SemesterStatusBadge = ({ status, className = '' }: { status: SemesterStatus; className?: string }) => {
    const { t } = useTranslation();
    const config = semesterStatusConfig[status] || { labelKey: '', color: 'default' };
    return <Tag color={config.color} className={className}>{config.labelKey ? t(config.labelKey) : status}</Tag>;
};

// --- LEGACY WRAPPER (DEPRECATED) ---

interface LegacyStatusBadgeProps {
    type: 'topic' | 'registration' | 'assignment' | 'extraPoints' | 'progress' | 'semesterPhase' | 'semesterStatus' | 'semester';
    status: any;
    progressStage?: ProgressStage;
    isVisible?: boolean;
    isLocked?: boolean;
    className?: string;
}

/**
 * @deprecated Use specific badge components instead (e.g. TopicStatusBadge, RegistrationStatusBadge)
 */
export const StatusBadge = ({ type, status, ...props }: LegacyStatusBadgeProps) => {
    if (process.env.NODE_ENV === 'development') {
        // console.warn(`[DEPRECATED] StatusBadge is deprecated. Used for type: ${type}. Migrate to specific badge components.`);
    }

    switch (type) {
        case 'topic':
            return <TopicStatusBadge status={status} {...props} />;
        case 'registration':
            return <RegistrationStatusBadge status={status} className={props.className} />;

        case 'assignment':
            return <AssignmentStatusBadge status={status} className={props.className} />;
        case 'extraPoints':
            return <ExtraPointsStatusBadge status={status} className={props.className} />;
        case 'semesterPhase':
            return <SemesterPhaseBadge phase={status} className={props.className} />;
        case 'semesterStatus':
            return <SemesterStatusBadge status={status} className={props.className} />;
        case 'semester':
            // Best effort for the union type in Settings.tsx
            if (['PLANNING', 'ACTIVE', 'COMPLETED'].includes(status)) {
                return <SemesterStatusBadge status={status as any} className={props.className} />;
            }
            return <SemesterPhaseBadge phase={status as any} className={props.className} />;
        default:
            return <Tag>{status}</Tag>;
    }
};
