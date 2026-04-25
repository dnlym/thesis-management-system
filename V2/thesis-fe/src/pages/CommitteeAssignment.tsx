import { useState } from 'react';
import { Card, Table, Button, Tag, Modal, Select, Space, Avatar, Empty, Spin, Alert, DatePicker, Divider, TimePicker, Input } from 'antd';
import { notify } from '@/utils/notification';
import { UserOutlined, TeamOutlined, CrownOutlined, EnvironmentOutlined, CalendarOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { AssignmentsApi } from '@/api/assignments';
import { CommitteeApi } from '@/api/committee';
import { useActiveSemester } from '@/hooks/useActiveSemester';
import dayjs from 'dayjs';

interface TopicForCommittee {
    id: string;
    code: string;
    title: string;
    supervisor: { id: string; full_name: string; email: string };
    registrations: any[];
    hasCommittee: boolean;
    avgReviewerScore: number | null;
    defense_type?: string | null;
    currentSchedule?: {
        committee_id: string;
        committee_name: string;
        defense_date: string;
        start_time?: string;
        end_time?: string;
        room?: string;
    };
}

/**
 * Committee Assignment Page (HEAD only)
 * Assign pre-defined committees to topics
 */
const CommitteeAssignment = () => {
    const { t } = useTranslation();
    const queryClient = useQueryClient();
    const { data: activeSemester } = useActiveSemester();
    const semesterId = activeSemester?.id;

    // Modal state
    const [selectedTopic, setSelectedTopic] = useState<TopicForCommittee | null>(null);
    const [assignModalVisible, setAssignModalVisible] = useState(false);
    const [committeeId, setCommitteeId] = useState<string | null>(null);
    const [timeRange, setTimeRange] = useState<[dayjs.Dayjs | null, dayjs.Dayjs | null]>([null, null]);
    const [room, setRoom] = useState<string>('');

    // Fetch topics eligible for committee assignment
    const { data: topics, isLoading, isError } = useQuery<TopicForCommittee[]>({
        queryKey: ['topics-for-committee', semesterId],
        queryFn: () => AssignmentsApi.getTopicsForCommitteeAssignment(),
        enabled: !!semesterId,
    });

    // Fetch available committees
    const { data: committees } = useQuery({
        queryKey: ['committees', semesterId],
        queryFn: () => CommitteeApi.getCommittees(semesterId!),
        enabled: !!semesterId,
    });

    // Assign committee mutation
    const assignMutation = useMutation({
        mutationFn: CommitteeApi.assignTopic,
        onSuccess: () => {
            notify.success(t('committeeAssignment.assignSuccess'));
            setAssignModalVisible(false);
            queryClient.invalidateQueries({ queryKey: ['topics-for-committee'] });
        },
        onError: (error: any) => {
            notify.error(error?.response?.data?.error || t('committeeAssignment.assignError'));
        },
    });

    const handleOpenAssignModal = (topic: TopicForCommittee) => {
        setSelectedTopic(topic);
        setCommitteeId(topic.currentSchedule?.committee_id || null);
        setRoom(topic.currentSchedule?.room || '');
        if (topic.currentSchedule?.start_time && topic.currentSchedule?.end_time) {
            setTimeRange([
                dayjs(`2000-01-01 ${topic.currentSchedule.start_time}`),
                dayjs(`2000-01-01 ${topic.currentSchedule.end_time}`)
            ]);
        } else {
            setTimeRange([null, null]);
        }
        setAssignModalVisible(true);
    };

    const handleAssign = () => {
        if (!selectedTopic || !committeeId || !activeSemester?.defense_start) {
            if (!activeSemester?.defense_start) {
                notify.error(t('committeeAssignment.setDefenseDateFirst', 'Vui lòng thiết lập ngày bảo vệ học kỳ trước'));
            } else {
                notify.warning(t('committeeAssignment.validationError'));
            }
            return;
        }

        assignMutation.mutate({
            topicId: selectedTopic.id,
            committeeId,
            defenseDate: dayjs(activeSemester.defense_start).format('YYYY-MM-DD'),
            startTime: timeRange[0]?.format('HH:mm'),
            endTime: timeRange[1]?.format('HH:mm'),
            room: room,
        });
    };

    const columns = [
        {
            title: t('topics.code'),
            dataIndex: 'code',
            key: 'code',
            width: 100,
            render: (text: string) => <Tag color="blue">{text || 'N/A'}</Tag>,
        },
        {
            title: t('common.name'),
            dataIndex: 'title',
            key: 'title',
            render: (text: string, record: TopicForCommittee) => (
                <div className="max-w-md">
                    <div className="text-sm font-semibold text-slate-800 uppercase mb-1">{text}</div>
                    <div className="text-xs text-slate-400">
                        {t('topics.supervisor')}: <span className="font-medium text-slate-600">{record.supervisor?.full_name}</span>
                    </div>
                </div>
            ),
        },
        {
            title: t('topics.student'),
            key: 'students',
            width: 200,
            render: (_: any, record: TopicForCommittee) => {
                const reg = record.registrations?.[0];
                return reg?.student ? (
                    <div className="flex items-center gap-2">
                        <Avatar size="small" icon={<UserOutlined />} />
                        <div className="text-xs">
                            <div className="font-medium">{reg.student.full_name}</div>
                            <div className="text-gray-400 font-mono">{reg.student.student_code}</div>
                        </div>
                    </div>
                ) : <span className="text-gray-400 text-xs">{t('topics.noStudent')}</span>;
            },
        },
        {
            title: t('evaluation.reviewerScore'),
            dataIndex: 'avgReviewerScore',
            key: 'avgReviewerScore',
            width: 120,
            render: (val: number | null) => (
                val ? <Tag color="gold" className="font-bold">{val.toFixed(2)}</Tag> : <span className="text-gray-400">—</span>
            ),
        },
        {
            title: t('committeeAssignment.assignCommittee'),
            key: 'committee',
            render: (_: any, record: TopicForCommittee) => {
                if (record.hasCommittee && record.currentSchedule) {
                    return (
                        <div className="flex flex-col gap-1">
                            <Tag color="cyan" icon={<TeamOutlined />}>{record.currentSchedule.committee_name}</Tag>
                            <div className="text-xs text-gray-500">
                                {dayjs(record.currentSchedule.defense_date).format('DD/MM/YYYY')}
                                {record.currentSchedule.start_time ? ` | ${record.currentSchedule.start_time}` : ''}
                            </div>
                        </div>
                    );
                }
                return <Tag color="default">{t('reviewerAssignment.notAssigned')}</Tag>;
            },
        },
        {
            title: t('common.actions'),
            key: 'action',
            render: (_: any, record: TopicForCommittee) => (
                <Button
                    type="primary"
                    icon={<CrownOutlined />}
                    ghost
                    onClick={() => handleOpenAssignModal(record)}
                >
                    {record.hasCommittee ? t('common.edit') : t('committeeAssignment.assignCommittee')}
                </Button>
            ),
        },
    ];

    if (isLoading) return <div className="p-10 text-center"><Spin size="large" /></div>;
    if (isError) return <div className="p-6"><Alert message={t('common.errorLoadingData')} type="error" showIcon /></div>;

    return (
        <div className="page-container">
            <div className="page-inner">
            {/* Header */}
            <Card className="page-header-card">
                <div className="flex items-center gap-3">
                    <div className="page-header-icon"><TeamOutlined className="text-base" /></div>
                    <div>
                        <div className="page-header-title">{t('committeeAssignment.title')}</div>
                        <div className="page-header-subtitle">{t('committeeAssignment.description')}</div>
                    </div>
                </div>
            </Card>

            <Card className="page-card-flush">
                <Table
                    dataSource={topics || []}
                    columns={columns}
                    rowKey="id"
                    size="middle"
                    className="sys-table"
                    pagination={{ pageSize: 10 }}
                />
            </Card>

            <Modal
                title={t('committeeAssignment.assignCommittee')}
                open={assignModalVisible}
                onOk={handleAssign}
                onCancel={() => setAssignModalVisible(false)}
                confirmLoading={assignMutation.isPending}
                width={750}
                className="rounded-lg overflow-hidden"
            >
                {selectedTopic && (
                    <div className="space-y-6 py-4">
                        <div>
                            <div className="text-gray-400 text-xs uppercase font-bold tracking-wider mb-1">{t('common.name')}</div>
                            <div className="text-base font-medium text-gray-800">{selectedTopic.title}</div>
                        </div>

                        <Divider className="my-0" />

                        <div className="grid grid-cols-1 gap-6">
                            <Space direction="vertical" style={{ width: '100%' }}>
                                <label className="text-sm font-semibold text-gray-700">{t('committeeAssignment.selectCommittee')}</label>
                                <Select
                                    placeholder={t('committeeAssignment.selectPlaceholder')}
                                    style={{ width: '100%' }}
                                    size="large"
                                    value={committeeId}
                                    onChange={setCommitteeId}
                                    options={committees?.map(c => ({
                                        value: c.id,
                                        label: (
                                            <div className="flex justify-between items-center w-full pr-4">
                                                <span className="font-bold">{c.name}</span>
                                                <span className="text-[10px] text-gray-400 italic">{t('committeeManagement.roomPreference')}: {c.room_preference || 'N/A'}</span>
                                            </div>
                                        )
                                    }))}
                                />
                            </Space>

                            <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                                <div className="md:col-span-5">
                                    <label className="block text-xs font-bold text-gray-400 uppercase mb-2">
                                        {t('committeeAssignment.defenseDate')}
                                    </label>
                                    <div className="flex items-center gap-3 bg-blue-50/50 p-3 rounded-lg border border-blue-100 h-[50px]">
                                        <CalendarOutlined className="text-blue-500 text-lg" />
                                        <div className="flex flex-col">
                                            <span className="text-sm font-bold text-gray-800 leading-none">
                                                {activeSemester?.defense_start
                                                    ? dayjs(activeSemester.defense_start).format('DD/MM/YYYY')
                                                    : <span className="text-red-500">{t('committeeAssignment.dateNotSet', 'Chưa thiết lập')}</span>}
                                            </span>
                                            <span className="text-[10px] text-blue-500 font-medium">
                                                {t('committeeAssignment.fixedDate', 'Ngày cố định')}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                                <div className="md:col-span-7">
                                    <label className="block text-xs font-bold text-gray-400 uppercase mb-2">{t('committeeAssignment.defenseTimeLabel')}</label>
                                    <TimePicker.RangePicker
                                        style={{ width: '100%' }}
                                        size="large"
                                        format="HH:mm"
                                        value={timeRange}
                                        onChange={setTimeRange}
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-400 uppercase mb-2">{t('committeeAssignment.roomLabel')}</label>
                                <Input
                                    size="large"
                                    placeholder={t('committeeAssignment.roomPlaceholder')}
                                    prefix={<EnvironmentOutlined className="text-gray-300" />}
                                    value={room}
                                    onChange={e => setRoom(e.target.value)}
                                />
                                <div className="text-[10px] text-gray-400 mt-1 italic">
                                    {t('committeeAssignment.roomHint')}
                                </div>
                            </div>
                        </div>

                        <Alert
                            type="info"
                            showIcon
                            message={<span className="text-xs">{t('committeeAssignment.autoCheckHint')}</span>}
                        />
                    </div>
                )}
            </Modal>
            </div>
        </div>
    );
};

export default CommitteeAssignment;
