import { useState } from 'react';
import { Card, Table, Button, Tag, Modal, Select, Space, Avatar, Empty, Spin, Alert, DatePicker, Divider, TimePicker, Input } from 'antd';
import { notify } from '@/utils/notification';
import { UserOutlined, TeamOutlined, CrownOutlined, EnvironmentOutlined, CalendarOutlined, AlertOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { AssignmentsApi } from '@/api/assignments';
import { CommitteeApi } from '@/api/committee';
import { useActiveSemester } from '@/hooks/useActiveSemester';
import { useSemesterStore } from '@/store/semester';
import dayjs from 'dayjs';

interface TopicForCommittee {
    id: string;
    code: string;
    title: string;
    supervisor: { id: string; full_name: string; email: string };
    registrations: any[];
    hasCommittee: boolean;
    status: string;
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
    const [pageSize, setPageSize] = useState(10);
    const { data: activeSemester } = useActiveSemester();
    const { selectedSemesterId } = useSemesterStore();
    const semesterId = selectedSemesterId || activeSemester?.id;

    // Modal state
    const [selectedTopic, setSelectedTopic] = useState<TopicForCommittee | null>(null);
    const [assignModalVisible, setAssignModalVisible] = useState(false);
    const [committeeId, setCommitteeId] = useState<string | null>(null);
    const [timeRange, setTimeRange] = useState<[dayjs.Dayjs | null, dayjs.Dayjs | null]>([null, null]);

    // Fetch topics eligible for committee assignment
    const { data: response, isLoading, isError } = useQuery<{ topics: TopicForCommittee[], deptDefenseDate: string | null }>({
        queryKey: ['topics-for-committee', semesterId],
        queryFn: () => AssignmentsApi.getTopicsForCommitteeAssignment(semesterId || undefined),
        enabled: !!semesterId,
    });

    const topics = response?.topics || [];
    const deptDefenseDate = response?.deptDefenseDate;

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
        if (topic.currentSchedule?.start_time && topic.currentSchedule?.end_time) {
            setTimeRange([
                dayjs(topic.currentSchedule.start_time),
                dayjs(topic.currentSchedule.end_time)
            ]);
        } else {
            setTimeRange([null, null]);
        }
        setAssignModalVisible(true);
    };

    const handleAssign = () => {
        const effectiveDefenseDate = deptDefenseDate || activeSemester?.defense_start;

        if (!selectedTopic || !committeeId || !effectiveDefenseDate) {
            if (!effectiveDefenseDate) {
                notify.error(t('committeeAssignment.setDefenseDateFirst', 'Vui lòng thiết lập ngày bảo vệ học kỳ trước'));
            } else {
                notify.warning(t('committeeAssignment.validationError'));
            }
            return;
        }

        assignMutation.mutate({
            topicId: selectedTopic.id,
            groupId: selectedTopic.registrations[0]?.group_id,
            committeeId,
            defenseDate: dayjs(effectiveDefenseDate).format('YYYY-MM-DD'),
            startTime: timeRange?.[0] ? timeRange[0].format('HH:mm') : undefined,
            endTime: timeRange?.[1] ? timeRange[1].format('HH:mm') : undefined,
        });
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
            width: 240,
            render: (_: any, record: TopicForCommittee) => {
                const registrations = record.registrations || [];
                if (registrations.length === 0) return <span className="text-gray-400 text-xs">{t('topics.noStudent')}</span>;

                return (
                    <div className="flex flex-col gap-2.5">
                        {registrations.map((reg: any) => (
                            <div key={reg.student.id} className="flex items-start gap-2">
                                <Avatar size="small" icon={<UserOutlined />} className="bg-blue-100 text-blue-600 mt-0.5 flex-shrink-0" />
                                <div className="flex-1 min-w-0">
                                    <div className="text-[11px] font-semibold text-slate-700 leading-tight truncate">{reg.student.full_name}</div>
                                    <div className="text-[10px] text-slate-400 font-mono">{reg.student.student_code}</div>
                                    <div className="flex items-center gap-1 mt-1 flex-wrap">
                                        {reg.supervisorScore !== null && reg.supervisorScore !== undefined && (
                                            <Tag color="blue" className="m-0 text-[10px] font-bold h-fit px-1.5">
                                                HD: {reg.supervisorScore.toFixed(2)}
                                            </Tag>
                                        )}
                                        {reg.avgReviewerScore !== null && reg.avgReviewerScore !== undefined && (
                                            <Tag color="gold" className="m-0 text-[10px] font-bold h-fit px-1.5">
                                                PB: {reg.avgReviewerScore.toFixed(2)}
                                            </Tag>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                );
            },
        },
        {
            title: t('committeeAssignment.assignCommittee'),
            key: 'committee',
            render: (_: any, record: TopicForCommittee) => {
                if (record.currentSchedule) {
                    const startTime = record.currentSchedule.start_time ? dayjs(record.currentSchedule.start_time).format('HH:mm') : '';
                    const endTime = record.currentSchedule.end_time ? dayjs(record.currentSchedule.end_time).format('HH:mm') : '';
                    const assignedCommittee = committees?.find(c => c.id === record.currentSchedule.committee_id);

                    return (
                        <div className="flex flex-col gap-1.5 py-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                                <Tag color="cyan" className="m-0 flex items-center gap-1 w-fit border-none font-semibold bg-cyan-50 text-cyan-700">
                                    <TeamOutlined /> {record.currentSchedule.committee_name || t('common.unknown', 'Không rõ')}
                                </Tag>
                                {record.currentSchedule.room && (
                                    <Tag className="m-0 text-[10px] bg-slate-100 border-none text-slate-500 font-mono">
                                        P. {record.currentSchedule.room}
                                    </Tag>
                                )}
                            </div>

                            {/* Committee Members list */}
                            {assignedCommittee && assignedCommittee.members && assignedCommittee.members.length > 0 && (
                                <div className="bg-slate-50/80 p-2 rounded-lg border border-slate-100/80 text-[11px] space-y-1 max-w-[240px] shadow-sm">
                                    {assignedCommittee.members.map((m: any) => {
                                        let rolePrefix = 'TV:';
                                        let roleColor = 'text-slate-400';
                                        if (m.role === 'CHAIR') { rolePrefix = 'CT:'; roleColor = 'text-red-500 font-bold'; }
                                        else if (m.role === 'SECRETARY') { rolePrefix = 'TK:'; roleColor = 'text-green-600 font-bold'; }
                                        return (
                                            <div key={m.lecturerId} className="flex items-center gap-1 truncate">
                                                <span className={`${roleColor} text-[10px] scale-90 origin-left`}>{rolePrefix}</span>
                                                <span className="text-slate-600 font-medium truncate">{m.fullName}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}

                            <div className="text-[10px] text-slate-500 font-medium flex items-center gap-1 flex-wrap">
                                <span>
                                    <CalendarOutlined className="mr-1" />
                                    {dayjs(record.currentSchedule.defense_date).format('DD/MM/YYYY')}
                                </span>
                                <span className="text-slate-300">|</span>
                                <span className="text-blue-600 font-mono">
                                    {startTime}{endTime ? ` - ${endTime}` : ''}
                                </span>
                            </div>
                        </div>
                    );
                }
                return <Tag color="default" className="m-0 text-[10px] opacity-60 border-dashed">{t('reviewerAssignment.notAssigned')}</Tag>;
            },
        },
        {
            title: t('common.actions'),
            key: 'action',
            render: (_: any, record: TopicForCommittee) => {
                // Nếu đề tài đã chấm xong (COMPLETED hoặc FINALIZED), ẩn luôn chức năng
                if (record.status === 'COMPLETED' || record.status === 'FINALIZED') {
                    return null;
                }

                return (
                    <Button
                        type="primary"
                        icon={<CrownOutlined />}
                        ghost
                        disabled={!activeSemester || !['DEFENSE', 'FINAL'].includes(activeSemester.calculated_phase || '')}
                        onClick={() => handleOpenAssignModal(record)}
                    >
                        {record.hasCommittee || record.currentSchedule ? t('common.edit') : 'Phân công'}
                    </Button>
                );
            },
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

                {/* Phase Check Alert */}
                {activeSemester && !['DEFENSE', 'FINAL'].includes(activeSemester.calculated_phase || '') && (
                    <Alert
                        message="Chưa đến hạn phân công hội đồng"
                        description="Tính năng phân công chỉ khả dụng trong giai đoạn Bảo vệ cuối kỳ."
                        type="warning"
                        showIcon
                        className="mb-4 rounded-xl border-orange-200 bg-orange-50/50 text-orange-800"
                    />
                )}

                <Card className="page-card-flush">
                    <Table
                        dataSource={topics || []}
                        columns={columns}
                        rowKey="id"
                        size="middle"
                        className="sys-table"
                        pagination={{
                            pageSize: pageSize,
                            showSizeChanger: true,
                            pageSizeOptions: ['10', '20', '50', '100'],
                            onShowSizeChange: (_, size) => setPageSize(size)
                        }}
                    />
                </Card>

                <Modal
                    title={<div className="text-lg font-bold text-slate-800">{t('committeeAssignment.assignCommittee', 'Gán hội đồng')}</div>}
                    open={assignModalVisible}
                    onOk={handleAssign}
                    onCancel={() => setAssignModalVisible(false)}
                    confirmLoading={assignMutation.isPending}
                    width={700}
                    centered
                    className="custom-modal"
                    footer={[
                        <Button key="cancel" onClick={() => setAssignModalVisible(false)} className="rounded-md border-slate-200">
                            {t('common.cancel', 'Hủy')}
                        </Button>,
                        <Button key="submit" type="primary" onClick={handleAssign} loading={assignMutation.isPending} className="rounded-md bg-blue-600 hover:bg-blue-700 px-8">
                            {t('common.save', 'Xác nhận')}
                        </Button>
                    ]}
                >
                    {selectedTopic && (
                        <div className="py-2 space-y-6">
                            {/* Topic Summary Card */}
                            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                                <div className="flex items-start gap-3">
                                    <div className="bg-blue-600 p-2 rounded-lg mt-1">
                                        <CrownOutlined className="text-white text-base" />
                                    </div>
                                    <div className="flex-1">
                                        <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">{t('common.name', 'Tên đề tài')}</div>
                                        <div className="text-base font-bold text-slate-800 leading-snug uppercase">{selectedTopic.title}</div>
                                        <div className="mt-2 flex gap-4">
                                            <Tag color="blue" className="m-0 border-none bg-blue-100 text-blue-700 font-mono text-[10px]">{selectedTopic.code}</Tag>
                                            <div className="text-[11px] text-slate-500 italic">GVHD: <span className="font-semibold text-slate-700">{selectedTopic.supervisor?.full_name}</span></div>
                                        </div>
                                    </div>
                                </div>
                                                         {/* Committee Select */}
                                <div>
                                    <label className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase mb-2">
                                        <TeamOutlined className="text-blue-500" />
                                        {t('committeeAssignment.selectCommittee', 'Chọn hội đồng')}
                                    </label>
                                    <Select
                                        placeholder={t('committeeAssignment.selectPlaceholder', 'Tìm và chọn hội đồng...')}
                                        style={{ width: '100%' }}
                                        size="large"
                                        value={committeeId}
                                        onChange={setCommitteeId}
                                        className="sys-select"
                                        optionLabelProp="label"
                                        dropdownStyle={{ padding: 4 }}
                                    >
                                        {committees?.map((c) => {
                                            const chair = c.members?.find(m => m.role === 'CHAIR')?.fullName;
                                            const secretary = c.members?.find(m => m.role === 'SECRETARY')?.fullName;
                                            const membersList = c.members?.filter(m => m.role === 'MEMBER').map(m => m.fullName).join(', ');
                                            const memberText = [
                                                chair ? `CT: ${chair}` : null,
                                                secretary ? `TK: ${secretary}` : null,
                                                membersList ? `TV: ${membersList}` : null
                                            ].filter(Boolean).join(' | ');

                                            return (
                                                <Select.Option key={c.id} value={c.id} label={c.name}>
                                                    <div className="flex flex-col py-1.5 w-full border-b border-slate-50 last:border-none">
                                                        <div className="flex justify-between items-center w-full">
                                                            <span className="font-bold text-slate-800">{c.name}</span>
                                                            {c.room_preference && (
                                                                <Tag className="text-[10px] m-0 bg-blue-50 border-none text-blue-600 font-medium">
                                                                    <EnvironmentOutlined /> {c.room_preference}
                                                                </Tag>
                                                            )}
                                                        </div>
                                                        <span className="text-[11px] text-slate-400 mt-1 truncate">
                                                            {memberText || 'Chưa cấu hình thành viên'}
                                                        </span>
                                                    </div>
                                                </Select.Option>
                                            );
                                        })}
                                    </Select>

                                    {/* Selected Committee Details & Members */}
                                    {committeeId && (() => {
                                        const selectedComm = committees?.find(c => c.id === committeeId);
                                        if (!selectedComm) return null;
                                        return (
                                            <div className="mt-3 bg-slate-50/80 p-3.5 rounded-xl border border-slate-200/60 shadow-sm">
                                                <div className="text-[11px] font-bold text-slate-400 mb-2.5 uppercase tracking-wider flex justify-between items-center">
                                                    <span>Thành viên hội đồng</span>
                                                    {selectedComm.room_preference && (
                                                        <Tag color="blue" className="m-0 border-none font-bold scale-90">
                                                            Phòng: {selectedComm.room_preference}
                                                        </Tag>
                                                    )}
                                                </div>
                                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                                                    {selectedComm.members?.map((m: any) => {
                                                        let roleName = 'Thành viên';
                                                        let roleColor = 'default';
                                                        if (m.role === 'CHAIR') { roleName = 'Chủ tịch'; roleColor = 'red'; }
                                                        else if (m.role === 'SECRETARY') { roleName = 'Thư ký'; roleColor = 'green'; }
                                                        return (
                                                            <div key={m.lecturerId} className="flex flex-col bg-white p-2.5 rounded-lg border border-slate-100 shadow-sm">
                                                                <span className="text-[12px] font-bold text-slate-700 truncate">{m.fullName}</span>
                                                                <div className="mt-1">
                                                                    <Tag color={roleColor} className="m-0 text-[9px] px-1.5 py-0.5 border-none uppercase font-extrabold">{roleName}</Tag>
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        );
                                    })()}
                                </div>

                                {/* Date & Time Row */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                    <div>
                                        <label className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase mb-2">
                                            <CalendarOutlined className="text-blue-500" />
                                            {t('committeeAssignment.defenseDate', 'Ngày bảo vệ')}
                                        </label>
                                        <div className="flex items-center gap-3 bg-white p-3 rounded-lg border border-slate-200 h-[50px] shadow-sm">
                                            <div className="bg-blue-50 p-2 rounded-md">
                                                <CalendarOutlined className="text-blue-600" />
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="text-sm font-bold text-slate-800">
                                                    {deptDefenseDate || activeSemester?.defense_start
                                                        ? dayjs(deptDefenseDate || activeSemester?.defense_start).format('DD/MM/YYYY')
                                                        : <span className="text-red-500">{t('committeeAssignment.dateNotSet', 'Chưa thiết lập')}</span>}
                                                </span>
                                                <span className={`text-[10px] font-medium ${deptDefenseDate ? 'text-green-600' : 'text-slate-400'}`}>
                                                    {deptDefenseDate
                                                        ? t('committeeAssignment.deptDate', 'Ngày của bộ môn')
                                                        : t('committeeAssignment.fixedDate', 'Ngày mặc định')}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    <div>
                                        <label className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase mb-2">
                                            <EnvironmentOutlined className="text-blue-500" />
                                            {t('committeeAssignment.defenseTimeLabel', 'Giờ thực hiện')}
                                        </label>
                                        <TimePicker.RangePicker
                                            style={{ width: '100%', height: '50px' }}
                                            size="large"
                                            format="HH:mm"
                                            value={timeRange}
                                            onChange={setTimeRange}
                                            className="rounded-lg shadow-sm"
                                        />
                                    </div>
                                </div>

                            </div>

                            <Alert
                                type="info"
                                showIcon
                                className="bg-blue-50 border-blue-100 rounded-xl mt-2"
                                message={<span className="text-[11px] text-blue-700 font-medium">{t('committeeAssignment.autoCheckHint', 'Hệ thống sẽ tự động kiểm tra trùng lịch và xung đột GVHD sau khi bạn nhấn Xác nhận.')}</span>}
                            />
                        </div>
                    )}
                </Modal>
            </div>
        </div>
    );
};

export default CommitteeAssignment;
