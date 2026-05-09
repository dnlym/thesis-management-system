import { useState, useEffect, useMemo } from 'react';
import { Card, Table, Button, Tag, Select, Space, Avatar, Empty, Spin, Alert, DatePicker, Input, Tabs, Tooltip } from 'antd';
import { notify } from '@/utils/notification';
import { 
    UserOutlined, CheckCircleOutlined, PlusOutlined, 
    ClockCircleOutlined, SaveOutlined, SearchOutlined,
    CheckCircleFilled, ExclamationCircleFilled
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { AssignmentsApi } from '@/api/assignments';
import dayjs from 'dayjs';
import GlobalSearch from '@/components/GlobalSearch';
import HighlightText from '@/components/HighlightText';
import { matchKeyword } from '@/utils/search';
import { useDebounce } from '@/hooks/useDebounce';
import { useActiveSemester } from '@/hooks/useActiveSemester';

interface TopicForReviewer {
    id: string;
    groupId: string;
    groupName: string;
    code: string;
    title: string;
    supervisor: { id: string; full_name: string; email: string };
    registrations: any[];
    assignments: any[];
    reviewerCount: number;
    assignmentStatus: 'NOT_ASSIGNED' | 'FULLY_ASSIGNED' | 'PARTIALLY_ASSIGNED';
    canAssignMore: boolean;
    room?: string | null;
}

interface Reviewer {
    id: string;
    full_name: string;
    email: string;
    avatar_url?: string;
}

// Track reviewer selections per topic
interface ReviewerSelection {
    reviewer1: string | null;
    reviewer2: string | null;
    deadline: dayjs.Dayjs;
    room: string;
}

/**
 * Reviewer Assignment Page (HEAD only)
 * Assign PB1 and PB2 in one go per topic
 */
const ReviewerAssignment = () => {
    const { t } = useTranslation();
    const queryClient = useQueryClient();
    const [pageSize, setPageSize] = useState(10);

    // Track selections per group
    const [selections, setSelections] = useState<Record<string, ReviewerSelection>>({});
    const [submittingGroupId, setSubmittingGroupId] = useState<string | null>(null);

    // Fetch topics eligible for reviewer assignment
    const { data: topics, isLoading, isError } = useQuery<TopicForReviewer[]>({
        queryKey: ['topics-for-reviewer'],
        queryFn: () => AssignmentsApi.getTopicsForReviewerAssignment(),
    });

    const { data: activeSemester } = useActiveSemester();

    // Fetch available lecturers once for the whole page
    const { data: lecturers } = useQuery({
        queryKey: ['lecturers'],
        queryFn: () => AssignmentsApi.getAvailableReviewersForDepartment(),
    });

    const [search, setSearch] = useState('');
    const debouncedSearch = useDebounce(search, 300);
    const [filterStatus, setFilterStatus] = useState<string>('ALL');

    const filteredTopics = useMemo(() => {
        if (!topics) return [];
        let result = topics;

        // Search logic
        if (debouncedSearch) {
            result = result.filter(t => {
                const reviewerNames = t.assignments.map(a => a.reviewer?.full_name);
                const studentNames = t.registrations?.map(r => r.student?.full_name);
                return matchKeyword(
                    debouncedSearch, 
                    t.title, 
                    t.code, 
                    t.supervisor?.full_name,
                    ...(reviewerNames || []),
                    ...(studentNames || [])
                );
            });
        }

        // Status filter logic
        if (filterStatus !== 'ALL') {
            result = result.filter(t => t.assignmentStatus === filterStatus);
        }

        return result;
    }, [topics, debouncedSearch, filterStatus]);

    const stats = useMemo(() => {
        if (!topics) return { ALL: 0, NOT_ASSIGNED: 0, FULLY_ASSIGNED: 0 };
        return {
            ALL: topics.length,
            NOT_ASSIGNED: topics.filter(t => t.assignmentStatus === 'NOT_ASSIGNED').length,
            FULLY_ASSIGNED: topics.filter(t => t.assignmentStatus === 'FULLY_ASSIGNED').length,
        };
    }, [topics]);

    const getAvailableReviewersForTopic = (topic: TopicForReviewer) => {
        if (!lecturers) return [];
        const assignedIds = topic.assignments.map(a => a.reviewer_id);
        const supervisorId = topic.supervisor?.id;
        // Filter out supervisor and already assigned IDs
        return lecturers.filter(l => l.id !== supervisorId && !assignedIds.includes(l.id));
    };

    // Assign reviewer mutation
    const assignMutation = useMutation({
        mutationFn: (data: { topicId: string; groupId: string; reviewerId: string; reviewerOrder: number; deadlineAt: Date; room?: string }) =>
            AssignmentsApi.assignReviewer(data),
        onError: (error: any) => {
            notify.error(error?.response?.data?.error || t('reviewerAssignment.assignError'));
        },
    });

    const getSelection = (groupId: string, initialRoom?: string | null): ReviewerSelection => {
        let defaultDeadline = dayjs().add(14, 'day');
        if (activeSemester?.thesis_deadline) {
            const max = dayjs(activeSemester.thesis_deadline);
            if (defaultDeadline.isAfter(max)) {
                defaultDeadline = max;
            }
        }
        
        return selections[groupId] || {
            reviewer1: null,
            reviewer2: null,
            deadline: defaultDeadline,
            room: initialRoom || ''
        };
    };

    const updateSelection = (groupId: string, field: keyof ReviewerSelection, value: any) => {
        setSelections(prev => ({
            ...prev,
            [groupId]: {
                ...getSelection(groupId),
                [field]: value,
            },
        }));
    };

    // Get already assigned reviewer orders for a topic
    const getAssignedOrders = (topic: TopicForReviewer): number[] => {
        return topic.assignments.map(a => a.reviewer_order);
    };

    const handleAssignBoth = async (topic: TopicForReviewer) => {
        const sel = getSelection(topic.groupId);
        const assignedOrders = getAssignedOrders(topic);

        if (!sel.reviewer1 && !sel.reviewer2) {
            notify.warning(t('reviewerAssignment.noReviewersSelected'));
            return;
        }

        if (sel.reviewer1 && sel.reviewer2 && sel.reviewer1 === sel.reviewer2) {
            notify.warning(t('reviewerAssignment.sameReviewerError'));
            return;
        }

        setSubmittingGroupId(topic.groupId);

        try {
            // Assign PB1 if selected and not already assigned
            if (sel.reviewer1 && !assignedOrders.includes(1)) {
                await AssignmentsApi.assignReviewer({
                    topicId: topic.id,
                    groupId: topic.groupId,
                    reviewerId: sel.reviewer1,
                    reviewerOrder: 1,
                    deadlineAt: sel.deadline.toDate(),
                    room: sel.room || undefined,
                });
            }

            // Assign PB2 if selected and not already assigned
            if (sel.reviewer2 && !assignedOrders.includes(2)) {
                await AssignmentsApi.assignReviewer({
                    topicId: topic.id,
                    groupId: topic.groupId,
                    reviewerId: sel.reviewer2,
                    reviewerOrder: 2,
                    deadlineAt: sel.deadline.toDate(),
                    room: sel.room || undefined,
                });
            }

            notify.success(t('reviewerAssignment.assignSuccess'));
            // Clear selection for this group
            setSelections(prev => {
                const newSel = { ...prev };
                delete newSel[topic.groupId];
                return newSel;
            });
            queryClient.invalidateQueries({ queryKey: ['topics-for-reviewer'] });
        } catch (error: any) {
            notify.error(error?.response?.data?.error || t('reviewerAssignment.assignError'));
        } finally {
            setSubmittingGroupId(null);
        }
    };

    const getStatusTag = (status: string) => {
        switch (status) {
            case 'NOT_ASSIGNED':
                return (
                    <Tooltip title={t('reviewerAssignment.notAssigned')}>
                        <ClockCircleOutlined className="text-gray-400 text-lg" />
                    </Tooltip>
                );
            case 'PARTIALLY_ASSIGNED':
                return (
                    <Tooltip title={t('reviewerAssignment.partiallyAssigned') || 'Chưa phân công đủ'}>
                        <ExclamationCircleFilled className="text-orange-400 text-lg" />
                    </Tooltip>
                );
            case 'FULLY_ASSIGNED':
                return (
                    <Tooltip title={t('reviewerAssignment.fullyAssigned')}>
                        <CheckCircleFilled className="text-green-500 text-lg" />
                    </Tooltip>
                );
            default:
                return <Tag>{status}</Tag>;
        }
    };

    const columns = [
        {
            title: 'STT',
            key: 'stt',
            width: 60,
            align: 'center' as const,
            render: (_: any, __: any, index: number) => index + 1,
        },
        {
            title: 'Mã nhóm',
            dataIndex: 'groupName',
            key: 'groupName',
            width: 120,
            render: (text: string) => (
                <Tag color="blue" className="font-mono">
                    <HighlightText text={text} keyword={debouncedSearch} />
                </Tag>
            ),
        },
        {
            title: t('common.name'),
            dataIndex: 'title',
            key: 'title',
            width: 250,
            render: (text: string, record: TopicForReviewer) => (
                <div>
                    <div className="font-medium text-sm leading-tight">
                        <HighlightText text={text} keyword={debouncedSearch} />
                    </div>
                    <div className="text-[11px] text-gray-500 mt-1">
                        {t('topics.supervisor')}: <HighlightText text={record.supervisor?.full_name} keyword={debouncedSearch} />
                    </div>
                </div>
            ),
        },
        {
            title: `${t('roles.REVIEWER')} 1`,
            key: 'reviewer1',
            width: 180,
            render: (_: any, record: TopicForReviewer) => {
                const assigned = record.assignments.find((a: any) => a.reviewer_order === 1);
                if (assigned) {
                    return (
                        <div className="flex items-center gap-2">
                            <Avatar size="small" icon={<UserOutlined />} />
                            <span className="text-sm font-medium">{assigned.reviewer?.full_name}</span>
                            <Tag color="green" className="ml-auto">✓</Tag>
                        </div>
                    );
                }
                const reviewers = getAvailableReviewersForTopic(record);
                const sel = getSelection(record.groupId, record.room);
                // Filter out reviewer2 selection
                const filteredReviewers = reviewers.filter(r => r.id !== sel.reviewer2);
                return (
                    <Select
                        value={sel.reviewer1}
                        onChange={(val) => updateSelection(record.groupId, 'reviewer1', val)}
                        style={{ width: '100%' }}
                        placeholder={t('reviewerAssignment.selectPB1')}
                        showSearch
                        allowClear
                        filterOption={(input, option) =>
                            (option?.label as string)?.toLowerCase().includes(input.toLowerCase())
                        }
                        options={filteredReviewers.map(r => ({
                            value: r.id,
                            label: r.full_name,
                        }))}
                        size="small"
                    />
                );
            },
        },
        {
            title: `${t('roles.REVIEWER')} 2`,
            key: 'reviewer2',
            width: 180,
            render: (_: any, record: TopicForReviewer) => {
                const assigned = record.assignments.find((a: any) => a.reviewer_order === 2);
                if (assigned) {
                    return (
                        <div className="flex items-center gap-2">
                            <Avatar size="small" icon={<UserOutlined />} />
                            <span className="text-sm font-medium">{assigned.reviewer?.full_name}</span>
                            <Tag color="green" className="ml-auto">✓</Tag>
                        </div>
                    );
                }
                const reviewers = getAvailableReviewersForTopic(record);
                const sel = getSelection(record.groupId, record.room);
                // Filter out reviewer1 selection
                const filteredReviewers = reviewers.filter(r => r.id !== sel.reviewer1);
                return (
                    <Select
                        value={sel.reviewer2}
                        onChange={(val) => updateSelection(record.groupId, 'reviewer2', val)}
                        style={{ width: '100%' }}
                        placeholder={t('reviewerAssignment.selectPB2')}
                        showSearch
                        allowClear
                        filterOption={(input, option) =>
                            (option?.label as string)?.toLowerCase().includes(input.toLowerCase())
                        }
                        options={filteredReviewers.map(r => ({
                            value: r.id,
                            label: r.full_name,
                        }))}
                        size="small"
                    />
                );
            },
        },
        {
            title: t('reviewerAssignment.deadline'),
            key: 'deadline',
            width: 140,
            render: (_: any, record: TopicForReviewer) => {
                if (!record.canAssignMore) {
                    const firstAssignment = record.assignments[0];
                    return firstAssignment?.deadline_at
                        ? <span className="text-sm">{dayjs(firstAssignment.deadline_at).format('DD/MM/YYYY')}</span>
                        : <span className="text-gray-400">—</span>;
                }
                const sel = getSelection(record.groupId, record.room);
                return (
                    <DatePicker
                        value={sel.deadline}
                        onChange={(val) => updateSelection(record.groupId, 'deadline', val || dayjs().add(14, 'day'))}
                        format="DD/MM/YYYY"
                        size="small"
                        style={{ width: '100%' }}
                        disabledDate={(current) => {
                            if (!activeSemester) return current && current < dayjs().startOf('day');
                            const start = dayjs(activeSemester.proposal_deadline).startOf('day');
                            const end = dayjs(activeSemester.thesis_deadline).endOf('day');
                            return current && (current < start || current > end);
                        }}
                    />
                );
            },
        },
        {
            title: t('defenseSchedule.room'),
            key: 'room',
            width: 100,
            render: (_: any, record: TopicForReviewer) => {
                if (!record.canAssignMore) {
                    return <span className="text-sm">{record.room || 'N/A'}</span>;
                }
                const sel = getSelection(record.groupId, record.room);
                return (
                    <input
                        className="ant-input ant-input-sm"
                        placeholder="Nhập"
                        value={sel.room}
                        onChange={(e) => updateSelection(record.groupId, 'room', e.target.value)}
                        style={{ width: '100%' }}
                    />
                );
            },
        },
        {
            title: t('common.status'),
            dataIndex: 'assignmentStatus',
            key: 'assignmentStatus',
            width: 80,
            align: 'center' as const,
            render: (status: string) => getStatusTag(status),
        },
        {
            title: '',
            key: 'actions',
            width: 80,
            onCell: () => ({ style: { paddingLeft: 0, paddingRight: 0 } }),
            render: (_: any, record: TopicForReviewer) => {
                if (!record.canAssignMore) return null;
                const sel = getSelection(record.groupId, record.room);
                const hasSelection = sel.reviewer1 || sel.reviewer2;
                return (
                    <Tooltip title={t('common.save')}>
                        <Button
                            type="primary"
                            icon={<SaveOutlined />}
                            onClick={() => handleAssignBoth(record)}
                            disabled={!hasSelection}
                            loading={submittingGroupId === record.groupId}
                            size="small"
                        >
                        </Button>
                    </Tooltip>
                );
            },
        },
    ];

    if (isLoading) {
        return (
            <div className="p-12 flex justify-center items-center">
                <Spin size="large" />
            </div>
        );
    }

    if (isError) {
        return (
            <div className="p-6">
                <Alert message={t('common.errorLoadingData')} type="error" showIcon />
            </div>
        );
    }

    return (
        <div className="page-container">
            <div className="page-inner">
                {/* Header */}
                <Card className="page-header-card">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                        <div className="flex items-center gap-3">
                            <div className="page-header-icon"><PlusOutlined className="text-base" /></div>
                            <div>
                                <div className="page-header-title">{t('navigation.reviewerAssignment')}</div>
                                <div className="page-header-subtitle">{t('reviewerAssignment.subtitle')}</div>
                            </div>
                        </div>

                        <GlobalSearch 
                            value={search} 
                            onChange={setSearch} 
                            className="w-full md:w-80" 
                            placeholder="Tìm đề tài, GV, mã ĐT..."
                        />
                    </div>
                </Card>

            {/* Filter Tabs */}
            <Card className="page-toolbar-card !mb-4">
                <Tabs 
                    activeKey={filterStatus} 
                    onChange={setFilterStatus}
                    className="sys-tabs sys-tabs-capsule"
                    items={[
                        { 
                            key: 'ALL', 
                            label: (
                                <div className="flex items-center gap-2">
                                    <span>{t('common.all')}</span>
                                    <Tag className="m-0 rounded-full bg-slate-100 text-slate-600 border-none font-bold px-2">{stats.ALL}</Tag>
                                </div>
                            )
                        },
                        { 
                            key: 'NOT_ASSIGNED', 
                            label: (
                                <div className="flex items-center gap-2">
                                    <span>{t('reviewerAssignment.notAssigned')}</span>
                                    <Tag className="m-0 rounded-full bg-orange-50 text-orange-600 border-none font-bold px-2">{stats.NOT_ASSIGNED}</Tag>
                                </div>
                            )
                        },
                        { 
                            key: 'FULLY_ASSIGNED', 
                            label: (
                                <div className="flex items-center gap-2">
                                    <span>{t('reviewerAssignment.fullyAssigned')}</span>
                                    <Tag className="m-0 rounded-full bg-green-50 text-green-600 border-none font-bold px-2">{stats.FULLY_ASSIGNED}</Tag>
                                </div>
                            )
                        },
                    ]}
                />
            </Card>

            {/* Table */}
            <Card className="page-card-flush">
                {topics?.length === 0 ? (
                    <Empty description={t('reviewerAssignment.noTopics')} className="py-12" />
                ) : (
                    <Table
                        dataSource={filteredTopics}
                        columns={columns}
                        rowKey="groupId"
                        pagination={{ 
                            pageSize: pageSize,
                            showSizeChanger: true,
                            pageSizeOptions: ['10', '20', '50', '100'],
                            onShowSizeChange: (_, size) => setPageSize(size)
                        }}
                        scroll={{ x: 'max-content' }}
                        size="middle"
                        className="sys-table"
                    />
                )}
            </Card>
            </div>
        </div>
    );
};

export default ReviewerAssignment;
