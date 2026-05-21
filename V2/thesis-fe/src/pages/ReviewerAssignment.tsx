import { useState, useEffect, useMemo } from 'react';
import { Card, Table, Button, Tag, Select, Space, Avatar, Empty, Spin, Alert, DatePicker, Input, Tabs, Tooltip, Row, Col, Divider, Radio, TimePicker } from 'antd';
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
    defenseFormat: 'ONLINE' | 'OFFLINE';
    onlinePlatform: 'ZOOM' | 'MS_TEAMS';
    meetingCode: string;
    meetingPassword?: string;
    room: string;
    defenseDate: dayjs.Dayjs | null;
    startTime: dayjs.Dayjs | null;
    endTime: dayjs.Dayjs | null;
}

const combineDateAndTime = (date: dayjs.Dayjs, time: dayjs.Dayjs) => {
    return date.hour(time.hour()).minute(time.minute()).second(0).millisecond(0);
};

/**
 * Reviewer Assignment Page (HEAD only)
 * Assign PB1 and PB2 in one go per topic
 */
const ReviewerAssignment = () => {
    const { t } = useTranslation();
    const queryClient = useQueryClient();
    const [pageSize, setPageSize] = useState(10);
    const [selectedTopic, setSelectedTopic] = useState<TopicForReviewer | null>(null);

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

    // Sync selectedTopic when topics data refreshes
    useEffect(() => {
        if (selectedTopic && topics) {
            const updated = topics.find(t => t.groupId === selectedTopic.groupId);
            if (updated) {
                setSelectedTopic(updated);
            } else {
                setSelectedTopic(null);
            }
        }
    }, [topics]);

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
            defenseFormat: 'OFFLINE',
            onlinePlatform: 'ZOOM',
            meetingCode: '',
            meetingPassword: '',
            room: initialRoom || '',
            defenseDate: null,
            startTime: null,
            endTime: null,
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

    // Prepopulate selections when a topic is selected
    useEffect(() => {
        if (selectedTopic) {
            const pb1 = selectedTopic.assignments.find((a: any) => a.reviewer_order === 1);
            const pb2 = selectedTopic.assignments.find((a: any) => a.reviewer_order === 2);
            const firstAssignment = selectedTopic.assignments[0] || pb1 || pb2;
            
            let defaultDeadline = dayjs().add(14, 'day');
            if (activeSemester?.thesis_deadline) {
                const max = dayjs(activeSemester.thesis_deadline);
                if (defaultDeadline.isAfter(max)) {
                    defaultDeadline = max;
                }
            }

            const defFormat = firstAssignment?.defense_format || 'OFFLINE';
            let platform: 'ZOOM' | 'MS_TEAMS' = 'ZOOM';
            let mCode = '';
            let roomVal = '';

            if (defFormat === 'ONLINE') {
                const rawRoom = firstAssignment?.room || '';
                if (rawRoom.startsWith('MS_TEAMS|') || rawRoom.startsWith('MSTEAMS|')) {
                    platform = 'MS_TEAMS';
                    mCode = rawRoom.substring(rawRoom.indexOf('|') + 1);
                } else if (rawRoom.startsWith('ZOOM|')) {
                    platform = 'ZOOM';
                    mCode = rawRoom.substring(5);
                } else {
                    if (rawRoom.includes('teams.microsoft.com') || rawRoom.includes('msteams')) {
                        platform = 'MS_TEAMS';
                    }
                    mCode = rawRoom;
                }
            } else {
                roomVal = firstAssignment?.room || selectedTopic.room || '';
            }

            const defenseDateVal = firstAssignment?.start_time ? dayjs(firstAssignment.start_time) : null;
            const startTimeVal = firstAssignment?.start_time ? dayjs(firstAssignment.start_time) : null;
            const endTimeVal = firstAssignment?.end_time ? dayjs(firstAssignment.end_time) : null;

            setSelections(prev => ({
                ...prev,
                [selectedTopic.groupId]: {
                    reviewer1: pb1?.reviewer_id || selections[selectedTopic.groupId]?.reviewer1 || null,
                    reviewer2: pb2?.reviewer_id || selections[selectedTopic.groupId]?.reviewer2 || null,
                    deadline: firstAssignment?.deadline_at ? dayjs(firstAssignment.deadline_at) : (selections[selectedTopic.groupId]?.deadline || defaultDeadline),
                    defenseFormat: defFormat as 'ONLINE' | 'OFFLINE',
                    onlinePlatform: platform,
                    meetingCode: mCode || selections[selectedTopic.groupId]?.meetingCode || '',
                    meetingPassword: firstAssignment?.zoom_password || selections[selectedTopic.groupId]?.meetingPassword || '',
                    room: roomVal || selections[selectedTopic.groupId]?.room || '',
                    defenseDate: defenseDateVal || selections[selectedTopic.groupId]?.defenseDate || null,
                    startTime: startTimeVal || selections[selectedTopic.groupId]?.startTime || null,
                    endTime: endTimeVal || selections[selectedTopic.groupId]?.endTime || null,
                }
            }));
        }
    }, [selectedTopic, activeSemester]);

    // Get already assigned reviewer orders for a topic
    const getAssignedOrders = (topic: TopicForReviewer): number[] => {
        return topic.assignments.map(a => a.reviewer_order);
    };

    const handleAssignBoth = async (topic: TopicForReviewer) => {
        const sel = getSelection(topic.groupId);
        const assignedOrders = getAssignedOrders(topic);

        if (!sel.reviewer1 && !sel.reviewer2 && topic.assignments.length === 0) {
            notify.warning(t('reviewerAssignment.noReviewersSelected'));
            return;
        }

        if (sel.reviewer1 && sel.reviewer2 && sel.reviewer1 === sel.reviewer2) {
            notify.warning(t('reviewerAssignment.sameReviewerError'));
            return;
        }

        // Validate schedule
        if (!sel.defenseDate) {
            notify.warning('Vui lòng chọn ngày bảo vệ');
            return;
        }
        if (!sel.startTime) {
            notify.warning('Vui lòng chọn giờ bắt đầu bảo vệ');
            return;
        }
        if (!sel.endTime) {
            notify.warning('Vui lòng chọn giờ kết thúc bảo vệ');
            return;
        }
        if (sel.startTime.isAfter(sel.endTime) || sel.startTime.isSame(sel.endTime)) {
            notify.warning('Giờ bắt đầu phải trước giờ kết thúc');
            return;
        }

        let finalRoom = '';
        if (sel.defenseFormat === 'ONLINE') {
            if (!sel.meetingCode) {
                notify.warning(`Vui lòng nhập Link hoặc Mã cuộc họp cho ${sel.onlinePlatform === 'ZOOM' ? 'Zoom' : 'MS Teams'}`);
                return;
            }
            finalRoom = `${sel.onlinePlatform}|${sel.meetingCode}`;
        } else {
            if (!sel.room) {
                notify.warning('Vui lòng nhập phòng bảo vệ');
                return;
            }
            finalRoom = sel.room;
        }

        const combinedStart = combineDateAndTime(sel.defenseDate, sel.startTime);
        const combinedEnd = combineDateAndTime(sel.defenseDate, sel.endTime);

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
                    room: finalRoom,
                    defenseFormat: sel.defenseFormat,
                    zoomPassword: sel.defenseFormat === 'ONLINE' ? sel.meetingPassword : undefined,
                    startTime: combinedStart.toDate(),
                    endTime: combinedEnd.toDate(),
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
                    room: finalRoom,
                    defenseFormat: sel.defenseFormat,
                    zoomPassword: sel.defenseFormat === 'ONLINE' ? sel.meetingPassword : undefined,
                    startTime: combinedStart.toDate(),
                    endTime: combinedEnd.toDate(),
                });
            }

            // If we have existing assignments, update their schedule too
            if (topic.assignments.length > 0) {
                await AssignmentsApi.updateReviewerSchedule({
                    topicId: topic.id,
                    groupId: topic.groupId,
                    defenseFormat: sel.defenseFormat,
                    room: finalRoom,
                    zoomPassword: sel.defenseFormat === 'ONLINE' ? sel.meetingPassword : '',
                    startTime: combinedStart.toISOString(),
                    endTime: combinedEnd.toISOString(),
                });
            }

            notify.success(t('reviewerAssignment.assignSuccess'));
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
                        <ClockCircleOutlined className="text-gray-400 text-base" />
                    </Tooltip>
                );
            case 'PARTIALLY_ASSIGNED':
                return (
                    <Tooltip title={t('reviewerAssignment.partiallyAssigned') || 'Chưa phân công đủ'}>
                        <ExclamationCircleFilled className="text-orange-400 text-base" />
                    </Tooltip>
                );
            case 'FULLY_ASSIGNED':
                return (
                    <Tooltip title={t('reviewerAssignment.fullyAssigned')}>
                        <CheckCircleFilled className="text-green-500 text-base" />
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
            width: 50,
            align: 'center' as const,
            render: (_: any, __: any, index: number) => index + 1,
        },
        {
            title: 'Mã nhóm',
            dataIndex: 'groupName',
            key: 'groupName',
            width: 100,
            render: (text: string) => (
                <Tag color="blue" className="font-mono m-0 text-xs">
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
                <div className="max-w-[250px]">
                    <div className="font-medium text-xs leading-snug truncate" title={text}>
                        <HighlightText text={text} keyword={debouncedSearch} />
                    </div>
                    <div className="text-[10px] text-gray-400 mt-0.5">
                        {t('topics.supervisor')}: <HighlightText text={record.supervisor?.full_name} keyword={debouncedSearch} />
                    </div>
                </div>
            ),
        },
        {
            title: 'Trạng thái',
            dataIndex: 'assignmentStatus',
            key: 'assignmentStatus',
            width: 80,
            align: 'center' as const,
            render: (status: string) => getStatusTag(status),
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
                    {/* Phase Check Alert */}
                    {activeSemester && !['REVIEWING', 'DEFENSE', 'FINAL'].includes(activeSemester.calculated_phase || '') && (
                        <Alert
                            message="Chưa đến hạn phân công phản biện"
                            description="Tính năng phân công chỉ khả dụng từ giai đoạn Phản biện (sau khi có kết quả giữa kỳ)."
                            type="warning"
                            showIcon
                            className="mb-4 rounded-xl border-orange-200 bg-orange-50/50 text-orange-800"
                        />
                    )}
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

                {/* Split-View Layout */}
                <Row gutter={16}>
                    {/* Left Column: Topics List */}
                    <Col xs={24} lg={15}>
                        <Card className="page-card-flush" style={{ minHeight: '580px' }}>
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
                                    size="small"
                                    className="sys-table cursor-pointer"
                                    rowClassName={(record) => record.groupId === selectedTopic?.groupId ? 'bg-blue-50/50 font-medium' : ''}
                                    onRow={(record) => ({
                                        onClick: () => {
                                            setSelectedTopic(record);
                                        }
                                    })}
                                />
                            )}
                        </Card>
                    </Col>

                    {/* Right Column: Detailed Assignment Panel */}
                    <Col xs={24} lg={9}>
                        {selectedTopic ? (
                            <Card 
                                title={
                                    <div className="flex items-center justify-between py-1">
                                        <span className="font-bold text-sm text-slate-800">
                                            Phân công phản biện
                                        </span>
                                        {selectedTopic.assignmentStatus === 'FULLY_ASSIGNED' && (
                                            <Tag color="success" className="m-0 text-[10px] font-bold">Đã phân công</Tag>
                                        )}
                                        {selectedTopic.assignmentStatus === 'PARTIALLY_ASSIGNED' && (
                                            <Tag color="warning" className="m-0 text-[10px] font-bold">Chưa đủ</Tag>
                                        )}
                                        {selectedTopic.assignmentStatus === 'NOT_ASSIGNED' && (
                                            <Tag color="default" className="m-0 text-[10px] font-bold">Chưa phân công</Tag>
                                        )}
                                    </div>
                                }
                                className="shadow-sm border-0"
                                bodyStyle={{ padding: '16px' }}
                            >
                                <div className="space-y-4">
                                    {/* Topic Title & Group Code */}
                                    <div>
                                        <Tag color="blue" className="font-mono mb-1 text-[11px]">Mã nhóm: {selectedTopic.groupName}</Tag>
                                        <h4 className="font-bold text-sm text-slate-800 leading-snug m-0">
                                            {selectedTopic.title}
                                        </h4>
                                    </div>

                                    <Divider className="my-2" />

                                    {/* Supervisor */}
                                    <div>
                                        <span className="text-gray-400 block mb-1 text-[10px] uppercase tracking-wider font-bold">Giảng viên hướng dẫn</span>
                                        <div className="flex items-center gap-2 bg-slate-50 p-2 rounded-lg">
                                            <Avatar size="small" icon={<UserOutlined />} className="bg-blue-100 text-blue-600 flex-shrink-0" />
                                            <div className="min-w-0">
                                                <div className="font-medium text-xs text-slate-800 truncate">{selectedTopic.supervisor?.full_name}</div>
                                                <div className="text-gray-400 font-mono text-[9px] truncate">{selectedTopic.supervisor?.email}</div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Students List */}
                                    <div>
                                        <span className="text-gray-400 block mb-1 text-[10px] uppercase tracking-wider font-bold">Sinh viên thực hiện</span>
                                        <div className="space-y-1.5">
                                            {selectedTopic.registrations
                                                ?.filter((reg: any) => reg.midterm_status !== 'FAIL' && reg.status !== 'FAILED')
                                                ?.map((reg: any) => {
                                                    return (
                                                        <div 
                                                            key={reg.id} 
                                                            className="flex items-center justify-between p-2 rounded-lg border border-slate-100 text-xs bg-white"
                                                        >
                                                            <div className="flex items-center gap-2 min-w-0">
                                                                <Avatar size={20} icon={<UserOutlined />} className="flex-shrink-0" />
                                                                <span className="truncate text-xs font-medium text-slate-700">
                                                                    {reg.student?.full_name}
                                                                </span>
                                                            </div>
                                                            <div className="flex items-center gap-1.5 flex-shrink-0">
                                                                <span className="font-mono text-slate-400 text-[11px]">{reg.student?.student_code}</span>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                        </div>
                                    </div>

                                    <Divider className="my-2" />

                                    {/* Assignment Form */}
                                    <div className="space-y-3">
                                        <span className="text-gray-400 block mb-1 text-[10px] uppercase tracking-wider font-bold">Cấu hình phản biện</span>
                                        
                                        {/* Reviewer 1 Select */}
                                        <div>
                                            <label className="text-[11px] font-semibold text-slate-600 block mb-1">Giảng viên Phản biện 1</label>
                                            {(() => {
                                                const assigned = selectedTopic.assignments.find((a: any) => a.reviewer_order === 1);
                                                if (assigned) {
                                                    return (
                                                        <div className="flex items-center justify-between p-2 rounded-lg bg-green-50/40 border border-green-100 text-xs">
                                                            <div className="flex items-center gap-2 min-w-0">
                                                                <Avatar size="small" icon={<UserOutlined />} className="bg-green-100 text-green-700 flex-shrink-0" />
                                                                <span className="font-medium text-slate-800 truncate">{assigned.reviewer?.full_name}</span>
                                                            </div>
                                                            <Button 
                                                                type="text" 
                                                                danger 
                                                                size="small" 
                                                                className="text-[10px] h-6 px-1.5 flex-shrink-0"
                                                                loading={submittingGroupId === selectedTopic.groupId}
                                                                disabled={!activeSemester || !['REVIEWING', 'DEFENSE', 'FINAL'].includes(activeSemester.calculated_phase || '')}
                                                                onClick={async () => {
                                                                    try {
                                                                        setSubmittingGroupId(selectedTopic.groupId);
                                                                        await AssignmentsApi.delete(assigned.id);
                                                                        notify.success('Đã hủy phân công phản biện 1');
                                                                        queryClient.invalidateQueries({ queryKey: ['topics-for-reviewer'] });
                                                                    } catch (err: any) {
                                                                        notify.error(err?.response?.data?.error || 'Không thể hủy phân công');
                                                                    } finally {
                                                                        setSubmittingGroupId(null);
                                                                    }
                                                                }}
                                                            >
                                                                Hủy gán
                                                            </Button>
                                                        </div>
                                                    );
                                                }
                                                const reviewers = getAvailableReviewersForTopic(selectedTopic);
                                                const sel = getSelection(selectedTopic.groupId, selectedTopic.room);
                                                const filteredReviewers = reviewers.filter(r => r.id !== sel.reviewer2);
                                                return (
                                                    <Select
                                                        value={sel.reviewer1}
                                                        onChange={(val) => updateSelection(selectedTopic.groupId, 'reviewer1', val)}
                                                        style={{ width: '100%' }}
                                                        placeholder="Chọn giảng viên phản biện 1"
                                                        showSearch
                                                        allowClear
                                                        size="small"
                                                        filterOption={(input, option) =>
                                                            (option?.label as string)?.toLowerCase().includes(input.toLowerCase())
                                                        }
                                                        options={filteredReviewers.map(r => ({
                                                            value: r.id,
                                                            label: r.full_name,
                                                        }))}
                                                    />
                                                );
                                            })()}
                                        </div>

                                        {/* Reviewer 2 Select */}
                                        <div>
                                            <label className="text-[11px] font-semibold text-slate-600 block mb-1">Giảng viên Phản biện 2</label>
                                            {(() => {
                                                const assigned = selectedTopic.assignments.find((a: any) => a.reviewer_order === 2);
                                                if (assigned) {
                                                    return (
                                                        <div className="flex items-center justify-between p-2 rounded-lg bg-green-50/40 border border-green-100 text-xs">
                                                            <div className="flex items-center gap-2 min-w-0">
                                                                <Avatar size="small" icon={<UserOutlined />} className="bg-green-100 text-green-700 flex-shrink-0" />
                                                                <span className="font-medium text-slate-800 truncate">{assigned.reviewer?.full_name}</span>
                                                            </div>
                                                            <Button 
                                                                type="text" 
                                                                danger 
                                                                size="small" 
                                                                className="text-[10px] h-6 px-1.5 flex-shrink-0"
                                                                loading={submittingGroupId === selectedTopic.groupId}
                                                                disabled={!activeSemester || !['REVIEWING', 'DEFENSE', 'FINAL'].includes(activeSemester.calculated_phase || '')}
                                                                onClick={async () => {
                                                                    try {
                                                                        setSubmittingGroupId(selectedTopic.groupId);
                                                                        await AssignmentsApi.delete(assigned.id);
                                                                        notify.success('Đã hủy phân công phản biện 2');
                                                                        queryClient.invalidateQueries({ queryKey: ['topics-for-reviewer'] });
                                                                    } catch (err: any) {
                                                                        notify.error(err?.response?.data?.error || 'Không thể hủy phân công');
                                                                    } finally {
                                                                        setSubmittingGroupId(null);
                                                                    }
                                                                }}
                                                            >
                                                                Hủy gán
                                                            </Button>
                                                        </div>
                                                    );
                                                }
                                                const reviewers = getAvailableReviewersForTopic(selectedTopic);
                                                const sel = getSelection(selectedTopic.groupId, selectedTopic.room);
                                                const filteredReviewers = reviewers.filter(r => r.id !== sel.reviewer1);
                                                return (
                                                    <Select
                                                        value={sel.reviewer2}
                                                        onChange={(val) => updateSelection(selectedTopic.groupId, 'reviewer2', val)}
                                                        style={{ width: '100%' }}
                                                        placeholder="Chọn giảng viên phản biện 2"
                                                        showSearch
                                                        allowClear
                                                        size="small"
                                                        filterOption={(input, option) =>
                                                            (option?.label as string)?.toLowerCase().includes(input.toLowerCase())
                                                        }
                                                        options={filteredReviewers.map(r => ({
                                                            value: r.id,
                                                            label: r.full_name,
                                                        }))}
                                                    />
                                                );
                                            })()}
                                        </div>

                                        {/* Defense Format */}
                                        <div>
                                            <label className="text-[11px] font-semibold text-slate-600 block mb-1">Hình thức bảo vệ</label>
                                            {(() => {
                                                const sel = getSelection(selectedTopic.groupId, selectedTopic.room);
                                                return (
                                                    <Radio.Group
                                                        value={sel.defenseFormat}
                                                        onChange={(e) => updateSelection(selectedTopic.groupId, 'defenseFormat', e.target.value)}
                                                        size="small"
                                                        className="w-full flex"
                                                    >
                                                        <Radio.Button value="OFFLINE" className="flex-1 text-center text-xs">Trực tiếp (Offline)</Radio.Button>
                                                        <Radio.Button value="ONLINE" className="flex-1 text-center text-xs">Trực tuyến (Online)</Radio.Button>
                                                    </Radio.Group>
                                                );
                                            })()}
                                        </div>

                                        {/* Conditional Format Fields */}
                                        {(() => {
                                            const sel = getSelection(selectedTopic.groupId, selectedTopic.room);
                                            if (sel.defenseFormat === 'ONLINE') {
                                                return (
                                                    <div className="p-2 rounded-lg bg-orange-50/30 border border-orange-100/50 space-y-2">
                                                        <Row gutter={8}>
                                                            <Col span={10}>
                                                                <label className="text-[10px] font-semibold text-slate-500 block mb-0.5">Nền tảng</label>
                                                                <Select
                                                                    value={sel.onlinePlatform}
                                                                    onChange={(val) => updateSelection(selectedTopic.groupId, 'onlinePlatform', val)}
                                                                    size="small"
                                                                    className="w-full"
                                                                    options={[
                                                                        { value: 'ZOOM', label: 'Zoom' },
                                                                        { value: 'MS_TEAMS', label: 'MS Teams' },
                                                                    ]}
                                                                />
                                                            </Col>
                                                            <Col span={14}>
                                                                <label className="text-[10px] font-semibold text-slate-500 block mb-0.5">Link / Mã cuộc họp</label>
                                                                <Input
                                                                    placeholder="Nhập link hoặc mã"
                                                                    value={sel.meetingCode}
                                                                    onChange={(e) => updateSelection(selectedTopic.groupId, 'meetingCode', e.target.value)}
                                                                    size="small"
                                                                />
                                                            </Col>
                                                        </Row>
                                                        <div>
                                                            <label className="text-[10px] font-semibold text-slate-500 block mb-0.5">Mật mã bảo mật (Passcode)</label>
                                                            <Input
                                                                placeholder="Mật mã cuộc họp"
                                                                value={sel.meetingPassword}
                                                                onChange={(e) => updateSelection(selectedTopic.groupId, 'meetingPassword', e.target.value)}
                                                                size="small"
                                                            />
                                                        </div>
                                                    </div>
                                                );
                                            } else {
                                                return (
                                                    <div>
                                                        <label className="text-[11px] font-semibold text-slate-600 block mb-1">Phòng bảo vệ</label>
                                                        <Input
                                                            placeholder="Nhập tên phòng (ví dụ: A101)"
                                                            value={sel.room}
                                                            onChange={(e) => updateSelection(selectedTopic.groupId, 'room', e.target.value)}
                                                            size="small"
                                                        />
                                                    </div>
                                                );
                                            }
                                        })()}

                                        {/* Defense Time (Date and Start/End Hours) */}
                                        <div className="p-2.5 rounded-lg bg-blue-50/20 border border-blue-100/40 space-y-2">
                                            <span className="text-[10px] font-bold text-blue-600 block uppercase tracking-wider">Thời gian bảo vệ</span>
                                            <Row gutter={8}>
                                                <Col span={24}>
                                                    <label className="text-[10px] font-semibold text-slate-500 block mb-0.5">Ngày bảo vệ</label>
                                                    {(() => {
                                                        const sel = getSelection(selectedTopic.groupId, selectedTopic.room);
                                                        return (
                                                            <DatePicker
                                                                value={sel.defenseDate}
                                                                onChange={(val) => updateSelection(selectedTopic.groupId, 'defenseDate', val)}
                                                                format="DD/MM/YYYY"
                                                                size="small"
                                                                style={{ width: '100%' }}
                                                                placeholder="Chọn ngày bảo vệ"
                                                                disabledDate={(current) => current && current < dayjs().startOf('day')}
                                                            />
                                                        );
                                                    })()}
                                                </Col>
                                            </Row>
                                            <Row gutter={8}>
                                                <Col span={12}>
                                                    <label className="text-[10px] font-semibold text-slate-500 block mb-0.5">Giờ bắt đầu</label>
                                                    {(() => {
                                                        const sel = getSelection(selectedTopic.groupId, selectedTopic.room);
                                                        return (
                                                            <TimePicker
                                                                value={sel.startTime}
                                                                onChange={(val) => updateSelection(selectedTopic.groupId, 'startTime', val)}
                                                                format="HH:mm"
                                                                size="small"
                                                                style={{ width: '100%' }}
                                                                placeholder="Giờ bắt đầu"
                                                            />
                                                        );
                                                    })()}
                                                </Col>
                                                <Col span={12}>
                                                    <label className="text-[10px] font-semibold text-slate-500 block mb-0.5">Giờ kết thúc</label>
                                                    {(() => {
                                                        const sel = getSelection(selectedTopic.groupId, selectedTopic.room);
                                                        return (
                                                            <TimePicker
                                                                value={sel.endTime}
                                                                onChange={(val) => updateSelection(selectedTopic.groupId, 'endTime', val)}
                                                                format="HH:mm"
                                                                size="small"
                                                                style={{ width: '100%' }}
                                                                placeholder="Giờ kết thúc"
                                                            />
                                                        );
                                                    })()}
                                                </Col>
                                            </Row>
                                        </div>

                                        {/* Deadline for Grading */}
                                        <div>
                                            <label className="text-[11px] font-semibold text-slate-600 block mb-1">Hạn nộp điểm</label>
                                            {(() => {
                                                const sel = getSelection(selectedTopic.groupId, selectedTopic.room);
                                                return (
                                                    <DatePicker
                                                        value={sel.deadline}
                                                        onChange={(val) => updateSelection(selectedTopic.groupId, 'deadline', val || dayjs().add(14, 'day'))}
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
                                            })()}
                                        </div>

                                        {/* Save / Cancel buttons */}
                                        <div className="pt-2 flex gap-2">
                                            <Button 
                                                type="primary" 
                                                icon={<SaveOutlined />} 
                                                className="flex-1 text-xs h-8"
                                                onClick={() => handleAssignBoth(selectedTopic)}
                                                loading={submittingGroupId === selectedTopic.groupId}
                                                disabled={(() => {
                                                    if (!activeSemester || !['REVIEWING', 'DEFENSE', 'FINAL'].includes(activeSemester.calculated_phase || '')) return true;
                                                    const sel = getSelection(selectedTopic.groupId, selectedTopic.room);
                                                    return !sel.reviewer1 && !sel.reviewer2 && selectedTopic.assignments.length === 0;
                                                })()}
                                            >
                                                Lưu phân công
                                            </Button>
                                            <Button 
                                                onClick={() => setSelectedTopic(null)}
                                                className="text-slate-500 text-xs h-8"
                                            >
                                                Hủy
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            </Card>
                        ) : (
                            <Card className="shadow-sm border-0 flex flex-col items-center justify-center min-h-[580px] bg-slate-50/50">
                                <Empty 
                                    description={
                                        <div className="text-slate-400 text-xs">
                                            Chọn một đề tài từ danh sách bên trái<br/>để bắt đầu phân công phản biện
                                        </div>
                                    } 
                                />
                            </Card>
                        )}
                    </Col>
                </Row>
            </div>
        </div>
    );
};

export default ReviewerAssignment;
