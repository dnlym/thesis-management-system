import { useState, useMemo } from 'react';
import { Card, Table, Button, Tag, Modal, Input, Space, Avatar, Spin, Alert, Tooltip, message, Empty, Tabs } from 'antd';
import { CheckCircleOutlined, CloseCircleOutlined, UserOutlined, ExclamationCircleOutlined, AuditOutlined } from '@ant-design/icons';
import { useMidtermRegistrations, useUpdateMidtermStatus } from '@/hooks/useGrading';
import { useAuthStore } from '@/store/auth';
import { useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { MidtermRegistration } from '@/types';

const { TextArea } = Input;


/**
 * Midterm Evaluation Page
 * Only GVHD (Supervisor) can access this page to grade PASS/FAIL for their students
 */
const MidtermEvaluation = () => {
    const { user } = useAuthStore();
    const queryClient = useQueryClient();
    
    const { 
        data: registrations, 
        isLoading, 
        isError 
    } = useMidtermRegistrations();

    const updateMidtermMutation = useUpdateMidtermStatus();

    // Grade Modal states
    const [selectedRegistration, setSelectedRegistration] = useState<MidtermRegistration | null>(null);
    const [gradeModalVisible, setGradeModalVisible] = useState(false);
    const [feedback, setFeedback] = useState('');
    const [selectedStatus, setSelectedStatus] = useState<'PASS' | 'FAIL' | null>(null);
    const [filterStatus, setFilterStatus] = useState<string>('ALL');

    // Detail Modal states
    const [detailModalVisible, setDetailModalVisible] = useState(false);
    const [selectedDetail, setSelectedDetail] = useState<MidtermRegistration | null>(null);

    const handleOpenDetailModal = (registration: MidtermRegistration) => {
        setSelectedDetail(registration);
        setDetailModalVisible(true);
    };

    const handleOpenGradeModal = (registration: MidtermRegistration, status: 'PASS' | 'FAIL') => {
        setSelectedRegistration(registration);
        setSelectedStatus(status);
        setFeedback('');
        setGradeModalVisible(true);
    };

    const handleSubmitGrade = () => {
        if (!selectedRegistration || !selectedStatus) return;

        updateMidtermMutation.mutate(
            {
                registrationId: selectedRegistration.id,
                status: selectedStatus,
                feedback: feedback.trim() || undefined,
            },
            {
                onSuccess: () => {
                    setGradeModalVisible(false);
                    setSelectedRegistration(null);
                    setSelectedStatus(null);
                    setFeedback('');
                },
            }
        );
    };

    const getMidtermStatusTag = (status: string | null) => {
        if (!status) return <Tag color="default">Chưa đánh giá</Tag>;
        if (status === 'PASS') return <Tag color="success" icon={<CheckCircleOutlined />}>PASS</Tag>;
        return <Tag color="error" icon={<CloseCircleOutlined />}>FAIL</Tag>;
    };

    const hasAnyRestrictedPhase = useMemo(() => {
        if (!registrations) return false;
        return registrations.some(r => r.permissions && !r.permissions.grade_midterm);
    }, [registrations]);

    const columns: any[] = [
        {
            title: 'STT',
            key: 'index',
            width: 60,
            render: (_: any, __: any, index: number) => index + 1,
        },
        {
            title: 'Đề tài',
            dataIndex: ['topic', 'title'],
            key: 'topic',
            render: (title: string, record: MidtermRegistration) => (
                <div 
                    className="cursor-pointer group max-w-[400px]" 
                    onClick={() => handleOpenDetailModal(record)}
                >
                   <div className="font-bold text-blue-600 group-hover:text-blue-800 group-hover:underline transition-all leading-snug">
                       {title}
                   </div>
                   <div className="mt-1.5 flex items-center gap-2">
                       {record.group?.name && (
                           <Tag className="m-0 bg-indigo-50 text-indigo-600 border-indigo-100 font-bold px-1.5 py-0 text-[10px]">
                               NHÓM: {record.group.name}
                           </Tag>
                       )}
                       {!record.topic?.semester && (
                           <Tag color="warning" className="m-0 text-[10px]">Thiếu thông tin học kỳ</Tag>
                       )}
                   </div>
                </div>
            ),
        },
        {
            title: 'Nhóm sinh viên',
            key: 'students',
            width: 250,
            render: (_: any, record: MidtermRegistration) => (
                <div className="space-y-1.5">
                    {record.group && record.group.members ? (
                        record.group.members.map((m) => (
                            <div key={m.user.id} className="flex items-center gap-2.5">
                                <Avatar size={24} src={m.user.avatar_url} icon={<UserOutlined />} className="border border-slate-200" />
                                <div className="flex flex-col">
                                    <span className="font-bold text-slate-700 text-[13px] leading-none">{m.user.full_name}</span>
                                    <span className="text-slate-400 text-[11px] mt-0.5">{m.user.student_code}</span>
                                </div>
                            </div>
                        ))
                    ) : record.student ? (
                        <div className="flex items-center gap-2.5">
                            <Avatar size={24} src={record.student.avatar_url} icon={<UserOutlined />} className="border border-slate-200" />
                            <div className="flex flex-col">
                                <span className="font-bold text-slate-700 text-[13px] leading-none">{record.student.full_name}</span>
                                <span className="text-slate-400 text-[11px] mt-0.5">{record.student.student_code}</span>
                            </div>
                        </div>
                    ) : (
                        <span className="text-gray-400 italic">No student info</span>
                    )}
                </div>
            ),
        },
        {
            title: 'Ngày đăng ký',
            dataIndex: 'registered_at',
            key: 'registered_at',
            width: 120,
            render: (date: string) => <span className="text-slate-500 font-medium">{dayjs(date).format('DD/MM/YYYY')}</span>,
        },
        {
            title: 'Kết quả giữa kỳ',
            dataIndex: 'midterm_status',
            key: 'midterm_status',
            width: 130,
            render: (status: string | null) => (
                <div className="flex justify-center">
                    {getMidtermStatusTag(status)}
                </div>
            ),
        },
        {
            title: 'Hành động',
            key: 'action',
            width: 220,
            render: (_: any, record: MidtermRegistration) => {
                // Already graded
                if (record.midterm_status) {
                    const gradedAt = dayjs(record.midterm_graded_at);
                    return (
                        <div className="flex flex-col">
                            <span className="text-slate-400 text-[11px] font-medium uppercase tracking-tight">Đã đánh giá lúc</span>
                            <span className="text-slate-600 font-bold text-[13px]">
                                {gradedAt.isValid() ? gradedAt.format('DD/MM/YYYY HH:mm') : '---'}
                            </span>
                        </div>
                    );
                }

                // Per-record permission from backend
                const canGrade = record.permissions?.grade_midterm ?? false;
                const reason = record.permissions?.grade_midterm_reason || 'Không có quyền chấm điểm.';

                // Can grade
                return (
                    <Space size="middle">
                        <Tooltip title={!canGrade ? reason : ''}>
                            <Button
                                type="primary"
                                icon={<CheckCircleOutlined />}
                                className={canGrade ? "bg-emerald-600 hover:bg-emerald-700 border-none shadow-sm h-9 px-4 font-bold" : "h-9"}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleOpenGradeModal(record, 'PASS');
                                }}
                                disabled={!canGrade}
                            >
                                PASS
                            </Button>
                        </Tooltip>
                        <Tooltip title={!canGrade ? reason : ''}>
                            <Button
                                danger
                                icon={<CloseCircleOutlined />}
                                className="h-9 px-4 font-bold shadow-sm"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleOpenGradeModal(record, 'FAIL');
                                }}
                                disabled={!canGrade}
                            >
                                FAIL
                            </Button>
                        </Tooltip>
                    </Space>
                );
            },
        },
    ];

    const pendingCount = registrations?.filter((r: MidtermRegistration) => !r.midterm_status).length || 0;
    const passedCount = registrations?.filter((r: MidtermRegistration) => r.midterm_status === 'PASS').length || 0;
    const failedCount = registrations?.filter((r: MidtermRegistration) => r.midterm_status === 'FAIL').length || 0;

    const filteredRegistrations = useMemo(() => {
        if (!registrations) return [];
        if (filterStatus === 'ALL') return registrations;
        if (filterStatus === 'PENDING') return registrations.filter(r => !r.midterm_status);
        return registrations.filter(r => r.midterm_status === filterStatus);
    }, [registrations, filterStatus]);

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
                <Alert message="Không thể tải dữ liệu đánh giá giữa kỳ" type="error" showIcon />
            </div>
        );
    }

    return (
        <div className="page-container">
            <div className="page-inner">
                {/* Header */}
                <Card className="page-header-card">
                    <div className="flex items-center gap-3">
                        <div className="page-header-icon"><CheckCircleOutlined className="text-base" /></div>
                        <div>
                            <div className="page-header-title">Đánh giá giữa kỳ</div>
                            <div className="page-header-subtitle">Đánh giá PASS/FAIL cho các nhóm sinh viên được phân công hướng dẫn</div>
                        </div>
                    </div>
                </Card>

            {hasAnyRestrictedPhase && (
                <Alert
                    message={
                        <span className="text-[13px] text-blue-800">
                            <strong>Lưu ý:</strong> Một số nút đánh giá bị khóa do ngoài thời gian quy định hoặc thiếu dữ liệu. Rê chuột vào nút để xem lý do.
                        </span>
                    }
                    type="info"
                    showIcon
                    className="mb-4 py-2 px-4 rounded-xl border-blue-100 bg-blue-50/50"
                />
            )}

            {/* Filter & Stats Tabs */}
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
                                    <span>Tất cả</span>
                                    <Tag className="m-0 rounded-full bg-slate-100 text-slate-600 border-none font-bold px-2">{registrations?.length || 0}</Tag>
                                </div>
                            )
                        },
                        { 
                            key: 'PENDING', 
                            label: (
                                <div className="flex items-center gap-2">
                                    <span>Chưa đánh giá</span>
                                    <Tag className="m-0 rounded-full bg-orange-50 text-orange-600 border-none font-bold px-2">{pendingCount}</Tag>
                                </div>
                            )
                        },
                        { 
                            key: 'PASS', 
                            label: (
                                <div className="flex items-center gap-2">
                                    <span>PASS</span>
                                    <Tag className="m-0 rounded-full bg-green-50 text-green-600 border-none font-bold px-2">{passedCount}</Tag>
                                </div>
                            )
                        },
                        { 
                            key: 'FAIL', 
                            label: (
                                <div className="flex items-center gap-2">
                                    <span>FAIL</span>
                                    <Tag className="m-0 rounded-full bg-red-50 text-red-600 border-none font-bold px-2">{failedCount}</Tag>
                                </div>
                            )
                        },
                    ]}
                />
            </Card>

            {/* Table */}
            <Card className="page-card-flush">
                {registrations?.length === 0 ? (
                    <Empty description="Không có nhóm nào cần đánh giá giữa kỳ" className="py-12" />
                ) : (
                    <Table
                        dataSource={filteredRegistrations}
                        columns={columns}
                        rowKey="id"
                        pagination={{ pageSize: 10, className: 'px-6 py-4' }}
                        className="sys-table"
                    />
                )}
            </Card>

            {/* Detail Modal */}
            <Modal
                title={
                    <div className="flex items-center gap-2">
                        <AuditOutlined className="text-blue-600" />
                        <span>Chi tiết đề tài & Đánh giá</span>
                    </div>
                }
                open={detailModalVisible}
                onCancel={() => {
                    setDetailModalVisible(false);
                    setSelectedDetail(null);
                }}
                footer={[
                    <Button key="close" type="primary" onClick={() => setDetailModalVisible(false)} className="px-6 rounded-lg font-bold h-9">
                        Đóng
                    </Button>
                ]}
                width={540}
                className="sys-modal"
            >
                {selectedDetail && (
                    <div className="space-y-4 py-1">
                        <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Tên đề tài</div>
                            <div className="text-[14px] font-bold text-slate-800 leading-snug">
                                {selectedDetail.topic.title}
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Mã nhóm</div>
                                <div className="text-[13px] font-bold text-indigo-600">
                                    {selectedDetail.group?.name || '---'}
                                </div>
                            </div>
                            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Ngày đăng ký</div>
                                <div className="text-[13px] font-bold text-slate-700">
                                    {dayjs(selectedDetail.registered_at).format('DD/MM/YYYY')}
                                </div>
                            </div>
                        </div>

                        <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Thành viên nhóm</div>
                            <div className="space-y-2">
                                {selectedDetail.group?.members ? (
                                    selectedDetail.group.members.map((m) => (
                                        <div key={m.user.id} className="flex items-center justify-between bg-white p-2 rounded-lg border border-slate-100 shadow-sm">
                                            <div className="flex items-center gap-2.5">
                                                <Avatar size={28} src={m.user.avatar_url} icon={<UserOutlined />} className="border border-slate-100" />
                                                <div className="flex flex-col">
                                                    <span className="font-bold text-slate-700 text-[12px] leading-none">{m.user.full_name}</span>
                                                    <span className="text-slate-400 text-[10px] mt-0.5">{m.user.student_code}</span>
                                                </div>
                                            </div>
                                            <Tag color="blue" className="m-0 text-[9px] rounded-md border-none font-bold px-1.5 py-0">SINH VIÊN</Tag>
                                        </div>
                                    ))
                                ) : (
                                    <div className="flex items-center gap-2.5 bg-white p-2 rounded-lg border border-slate-100 shadow-sm">
                                        <Avatar size={28} src={selectedDetail.student?.avatar_url} icon={<UserOutlined />} className="border border-slate-100" />
                                        <div className="flex flex-col">
                                            <span className="font-bold text-slate-700 text-[12px] leading-none">{selectedDetail.student?.full_name}</span>
                                            <span className="text-slate-400 text-[10px] mt-0.5">{selectedDetail.student?.student_code}</span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="p-4 bg-white rounded-xl border-2 border-slate-100 shadow-sm relative overflow-hidden">
                            <div className="absolute top-0 left-0 w-1 h-full bg-blue-500" />
                            <div className="flex items-center justify-between mb-3">
                                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Kết quả đánh giá</div>
                                {getMidtermStatusTag(selectedDetail.midterm_status)}
                            </div>
                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Nhận xét của Giảng viên</div>
                            <div className="text-[13px] text-slate-600 italic bg-slate-50 p-3 rounded-lg border border-dashed border-slate-200">
                                {selectedDetail.midterm_feedback || 'Chưa có nhận xét nào.'}
                            </div>
                            {selectedDetail.midterm_graded_at && (
                                <div className="mt-3 text-[10px] text-slate-400 text-right font-medium">
                                    Cập nhật lúc: {dayjs(selectedDetail.midterm_graded_at).format('DD/MM/YYYY HH:mm')}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </Modal>

            {/* Grade Modal */}
            <Modal
                title={
                    <div className="flex items-center gap-2">
                        <ExclamationCircleOutlined className={selectedStatus === 'PASS' ? 'text-green-600' : 'text-red-600'} />
                        <span>Xác nhận đánh giá {selectedStatus}</span>
                    </div>
                }
                open={gradeModalVisible}
                onCancel={() => {
                    setGradeModalVisible(false);
                    setSelectedRegistration(null);
                    setSelectedStatus(null);
                    setFeedback('');
                }}
                onOk={handleSubmitGrade}
                confirmLoading={updateMidtermMutation.isPending}
                okText="Xác nhận"
                cancelText="Hủy"
                width={480}
                okButtonProps={{
                    danger: selectedStatus === 'FAIL',
                    className: selectedStatus === 'PASS' ? 'bg-green-600 hover:bg-green-700' : undefined,
                }}
            >
                {selectedRegistration && (
                    <div className="space-y-4">
                        <div className="bg-gray-50 p-4 rounded-lg">
                            <div className="text-sm text-gray-500 mb-1">Đề tài</div>
                            <div className="font-medium">{selectedRegistration.topic.title}</div>
                        </div>

                        <div className="bg-gray-50 p-4 rounded-lg">
                            <div className="text-sm text-gray-500 mb-2">Sinh viên</div>
                            {selectedRegistration.group && selectedRegistration.group.members ? (
                                selectedRegistration.group.members.map((m) => (
                                    <div key={m.user.id} className="flex items-center gap-2 mb-1">
                                        <Avatar size="small" src={m.user.avatar_url} icon={<UserOutlined />} />
                                        <span>{m.user.full_name}</span>
                                        <span className="text-gray-500">({m.user.student_code})</span>
                                    </div>
                                ))
                            ) : selectedRegistration.student ? (
                                <div className="flex items-center gap-2 mb-1">
                                    <Avatar size="small" src={selectedRegistration.student.avatar_url} icon={<UserOutlined />} />
                                    <span>{selectedRegistration.student.full_name}</span>
                                    <span className="text-gray-500">({selectedRegistration.student.student_code})</span>
                                </div>
                            ) : null}
                        </div>

                        <div>
                            <div className="text-sm text-gray-500 mb-2">
                                Nhận xét {selectedStatus === 'FAIL' && <span className="text-red-500">*</span>}
                            </div>
                            <TextArea
                                rows={4}
                                value={feedback}
                                onChange={(e) => setFeedback(e.target.value)}
                                placeholder={
                                    selectedStatus === 'FAIL'
                                        ? 'Vui lòng nhập lý do FAIL (bắt buộc)...'
                                        : 'Nhận xét (không bắt buộc)...'
                                }
                            />
                            {selectedStatus === 'FAIL' && !feedback.trim() && (
                                <div className="text-red-500 text-sm mt-1">
                                    Vui lòng nhập lý do khi FAIL sinh viên
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </Modal>
            </div>
        </div>
    );
};

export default MidtermEvaluation;
