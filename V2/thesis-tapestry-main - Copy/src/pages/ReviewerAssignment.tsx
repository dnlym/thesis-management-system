import { useState, useEffect } from 'react';
import { Card, Table, Button, Tag, Select, Space, Avatar, Empty, Spin, Alert, DatePicker } from 'antd';
import { notify } from '@/utils/notification';
import { UserOutlined, CheckCircleOutlined, PlusOutlined, ClockCircleOutlined, SaveOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { AssignmentsApi } from '@/api/assignments';
import dayjs from 'dayjs';

interface TopicForReviewer {
    id: string;
    code: string;
    title: string;
    supervisor: { id: string; full_name: string; email: string };
    registrations: any[];
    assignments: any[];
    reviewerCount: number;
    assignmentStatus: 'NOT_ASSIGNED' | 'PARTIALLY_ASSIGNED' | 'FULLY_ASSIGNED';
    canAssignMore: boolean;
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
}

/**
 * Reviewer Assignment Page (HEAD only)
 * Assign PB1 and PB2 in one go per topic
 */
const ReviewerAssignment = () => {
    const { t } = useTranslation();
    const queryClient = useQueryClient();

    // Track selections per topic
    const [selections, setSelections] = useState<Record<string, ReviewerSelection>>({});
    const [submittingTopicId, setSubmittingTopicId] = useState<string | null>(null);

    // Fetch topics eligible for reviewer assignment
    const { data: topics, isLoading, isError } = useQuery<TopicForReviewer[]>({
        queryKey: ['topics-for-reviewer'],
        queryFn: () => AssignmentsApi.getTopicsForReviewerAssignment(),
    });

    // Fetch available lecturers once for the whole page
    const { data: lecturers } = useQuery({
        queryKey: ['lecturers'],
        queryFn: () => AssignmentsApi.getAvailableReviewersForDepartment(),
    });

    const getAvailableReviewersForTopic = (topic: TopicForReviewer) => {
        if (!lecturers) return [];
        const assignedIds = topic.assignments.map(a => a.reviewer_id);
        const supervisorId = topic.supervisor?.id;
        // Filter out supervisor and already assigned IDs
        return lecturers.filter(l => l.id !== supervisorId && !assignedIds.includes(l.id));
    };

    // Assign reviewer mutation
    const assignMutation = useMutation({
        mutationFn: (data: { topicId: string; reviewerId: string; reviewerOrder: number; deadlineAt: Date }) =>
            AssignmentsApi.assignReviewer(data),
        onError: (error: any) => {
            notify.error(error?.response?.data?.error || t('reviewerAssignment.assignError'));
        },
    });

    const getSelection = (topicId: string): ReviewerSelection => {
        return selections[topicId] || { reviewer1: null, reviewer2: null, deadline: dayjs().add(14, 'day') };
    };

    const updateSelection = (topicId: string, field: keyof ReviewerSelection, value: any) => {
        setSelections(prev => ({
            ...prev,
            [topicId]: {
                ...getSelection(topicId),
                [field]: value,
            },
        }));
    };

    // Get already assigned reviewer orders for a topic
    const getAssignedOrders = (topic: TopicForReviewer): number[] => {
        return topic.assignments.map(a => a.reviewer_order);
    };

    const handleAssignBoth = async (topic: TopicForReviewer) => {
        const sel = getSelection(topic.id);
        const assignedOrders = getAssignedOrders(topic);

        if (!sel.reviewer1 && !sel.reviewer2) {
            notify.warning(t('reviewerAssignment.noReviewersSelected'));
            return;
        }

        if (sel.reviewer1 && sel.reviewer2 && sel.reviewer1 === sel.reviewer2) {
            notify.warning(t('reviewerAssignment.sameReviewerError'));
            return;
        }

        setSubmittingTopicId(topic.id);

        try {
            // Assign PB1 if selected and not already assigned
            if (sel.reviewer1 && !assignedOrders.includes(1)) {
                await AssignmentsApi.assignReviewer({
                    topicId: topic.id,
                    reviewerId: sel.reviewer1,
                    reviewerOrder: 1,
                    deadlineAt: sel.deadline.toDate(),
                });
            }

            // Assign PB2 if selected and not already assigned
            if (sel.reviewer2 && !assignedOrders.includes(2)) {
                await AssignmentsApi.assignReviewer({
                    topicId: topic.id,
                    reviewerId: sel.reviewer2,
                    reviewerOrder: 2,
                    deadlineAt: sel.deadline.toDate(),
                });
            }

            notify.success(t('reviewerAssignment.assignSuccess'));
            // Clear selection for this topic
            setSelections(prev => {
                const newSel = { ...prev };
                delete newSel[topic.id];
                return newSel;
            });
            queryClient.invalidateQueries({ queryKey: ['topics-for-reviewer'] });
        } catch (error: any) {
            notify.error(error?.response?.data?.error || t('reviewerAssignment.assignError'));
        } finally {
            setSubmittingTopicId(null);
        }
    };

    const getStatusTag = (status: string) => {
        switch (status) {
            case 'NOT_ASSIGNED':
                return <Tag color="default">{t('reviewerAssignment.notAssigned')}</Tag>;
            case 'PARTIALLY_ASSIGNED':
                return <Tag color="processing">{t('reviewerAssignment.partiallyAssigned')}</Tag>;
            case 'FULLY_ASSIGNED':
                return <Tag color="success" icon={<CheckCircleOutlined />}>{t('reviewerAssignment.fullyAssigned')}</Tag>;
            default:
                return <Tag>{status}</Tag>;
        }
    };

    const columns = [
        {
            title: t('topics.code'),
            dataIndex: 'code',
            key: 'code',
            width: 110,
            render: (text: string) => <Tag>{text || 'N/A'}</Tag>,
        },
        {
            title: t('common.name'),
            dataIndex: 'title',
            key: 'title',
            width: 250,
            render: (text: string, record: TopicForReviewer) => (
                <div>
                    <div className="font-medium text-sm">{text}</div>
                    <div className="text-xs text-gray-500 mt-1">
                        {t('topics.supervisor')}: {record.supervisor?.full_name}
                    </div>
                </div>
            ),
        },
        {
            title: `${t('roles.REVIEWER')} 1`,
            key: 'reviewer1',
            width: 200,
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
                const sel = getSelection(record.id);
                // Filter out reviewer2 selection
                const filteredReviewers = reviewers.filter(r => r.id !== sel.reviewer2);
                return (
                    <Select
                        value={sel.reviewer1}
                        onChange={(val) => updateSelection(record.id, 'reviewer1', val)}
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
            width: 200,
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
                const sel = getSelection(record.id);
                // Filter out reviewer1 selection
                const filteredReviewers = reviewers.filter(r => r.id !== sel.reviewer1);
                return (
                    <Select
                        value={sel.reviewer2}
                        onChange={(val) => updateSelection(record.id, 'reviewer2', val)}
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
                const sel = getSelection(record.id);
                return (
                    <DatePicker
                        value={sel.deadline}
                        onChange={(val) => updateSelection(record.id, 'deadline', val || dayjs().add(14, 'day'))}
                        format="DD/MM/YYYY"
                        size="small"
                        style={{ width: '100%' }}
                        disabledDate={(current) => current && current < dayjs().startOf('day')}
                    />
                );
            },
        },
        {
            title: t('common.status'),
            dataIndex: 'assignmentStatus',
            key: 'assignmentStatus',
            width: 130,
            render: (status: string) => getStatusTag(status),
        },
        {
            title: '',
            key: 'action',
            width: 110,
            render: (_: any, record: TopicForReviewer) => {
                if (!record.canAssignMore) return null;
                const sel = getSelection(record.id);
                const hasSelection = sel.reviewer1 || sel.reviewer2;
                return (
                    <Button
                        type="primary"
                        icon={<SaveOutlined />}
                        onClick={() => handleAssignBoth(record)}
                        disabled={!hasSelection}
                        loading={submittingTopicId === record.id}
                        size="small"
                    >
                        {t('common.save')}
                    </Button>
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
        <div className="p-6">
            {/* Header */}
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-gray-800">{t('reviewerAssignment.title')}</h1>
                <p className="text-gray-500">{t('reviewerAssignment.description')}</p>
            </div>

            {/* Statistics */}
            <div className="grid grid-cols-3 gap-4 mb-6">
                <Card className="bg-gray-50">
                    <div className="text-center">
                        <div className="text-3xl font-bold text-gray-600">
                            {topics?.filter(t => t.assignmentStatus === 'NOT_ASSIGNED').length || 0}
                        </div>
                        <div className="text-gray-500">{t('reviewerAssignment.notAssigned')}</div>
                    </div>
                </Card>
                <Card className="bg-blue-50">
                    <div className="text-center">
                        <div className="text-3xl font-bold text-blue-600">
                            {topics?.filter(t => t.assignmentStatus === 'PARTIALLY_ASSIGNED').length || 0}
                        </div>
                        <div className="text-gray-500">{t('reviewerAssignment.partiallyAssigned')}</div>
                    </div>
                </Card>
                <Card className="bg-green-50">
                    <div className="text-center">
                        <div className="text-3xl font-bold text-green-600">
                            {topics?.filter(t => t.assignmentStatus === 'FULLY_ASSIGNED').length || 0}
                        </div>
                        <div className="text-gray-500">{t('reviewerAssignment.fullyAssigned')}</div>
                    </div>
                </Card>
            </div>

            {/* Table */}
            <Card className="shadow-soft">
                {topics?.length === 0 ? (
                    <Empty description={t('reviewerAssignment.noTopics')} />
                ) : (
                    <Table
                        dataSource={topics || []}
                        columns={columns}
                        rowKey="id"
                        pagination={{ pageSize: 10 }}
                        scroll={{ x: 1200 }}
                        size="middle"
                    />
                )}
            </Card>
        </div>
    );
};

export default ReviewerAssignment;
