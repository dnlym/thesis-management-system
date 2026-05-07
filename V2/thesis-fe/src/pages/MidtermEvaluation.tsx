import { useState, useMemo } from 'react';
import { Card, Table, Button, Tag, Modal, Input, Space, Avatar, Spin, Alert, Tooltip, message, Empty, Tabs } from 'antd';
import { CheckCircleOutlined, CloseCircleOutlined, UserOutlined, ExclamationCircleOutlined } from '@ant-design/icons';
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

    // Modal states
    const [selectedRegistration, setSelectedRegistration] = useState<MidtermRegistration | null>(null);
    const [gradeModalVisible, setGradeModalVisible] = useState(false);
    const [feedback, setFeedback] = useState('');
    const [selectedStatus, setSelectedStatus] = useState<'PASS' | 'FAIL' | null>(null);
    const [filterStatus, setFilterStatus] = useState<string>('ALL');

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
                <div>
                   <div className="font-medium text-gray-800">{title}</div>
                   {!record.topic?.semester && (
                       <Tag color="warning" className="mt-1">Thiếu thông tin học kỳ</Tag>
                   )}
                </div>
            ),
        },
        {
            title: 'Nhóm sinh viên',
            key: 'students',
            render: (_: any, record: MidtermRegistration) => (
                <div className="space-y-1">
                    {record.group && record.group.members ? (
                        record.group.members.map((m) => (
                            <div key={m.user.id} className="flex items-center gap-2">
                                <Avatar size="small" src={m.user.avatar_url} icon={<UserOutlined />} />
                                <span className="font-medium">{m.user.full_name}</span>
                                <span className="text-gray-500 text-sm">({m.user.student_code})</span>
                            </div>
                        ))
                    ) : record.student ? (
                        <div className="flex items-center gap-2">
                            <Avatar size="small" src={record.student.avatar_url} icon={<UserOutlined />} />
                            <span className="font-medium">{record.student.full_name}</span>
                            <span className="text-gray-500 text-sm">({record.student.student_code})</span>
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
            render: (date: string) => dayjs(date).format('DD/MM/YYYY'),
        },
        {
            title: 'Kết quả giữa kỳ',
            dataIndex: 'midterm_status',
            key: 'midterm_status',
            width: 140,
            render: (status: string | null) => getMidtermStatusTag(status),
        },
        {
            title: 'Nhận xét',
            dataIndex: 'midterm_feedback',
            key: 'midterm_feedback',
            width: 200,
            render: (feedback: string | null) => feedback || <span className="text-gray-400 italic">Chưa có</span>,
        },
        {
            title: 'Hành động',
            key: 'action',
            width: 200,
            render: (_: any, record: MidtermRegistration) => {
                // Already graded
                if (record.midterm_status) {
                    return (
                        <span className="text-gray-500 text-sm">
                            Đã đánh giá lúc {dayjs(record.midterm_graded_at).format('DD/MM/YYYY HH:mm')}
                        </span>
                    );
                }

                // Per-record permission from backend
                const canGrade = record.permissions?.grade_midterm ?? false;
                const reason = record.permissions?.grade_midterm_reason || 'Không có quyền chấm điểm.';

                // Can grade
                return (
                    <Space>
                        <Tooltip title={!canGrade ? reason : ''}>
                            <Button
                                type="primary"
                                icon={<CheckCircleOutlined />}
                                className={canGrade ? "bg-green-600 hover:bg-green-700" : ""}
                                onClick={() => handleOpenGradeModal(record, 'PASS')}
                                disabled={!canGrade}
                            >
                                PASS
                            </Button>
                        </Tooltip>
                        <Tooltip title={!canGrade ? reason : ''}>
                            <Button
                                danger
                                icon={<CloseCircleOutlined />}
                                onClick={() => handleOpenGradeModal(record, 'FAIL')}
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
