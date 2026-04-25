import { useState, useMemo } from 'react';
import { Card, Table, Button, Tag, Modal, Input, Space, Avatar, Spin, Alert, Tooltip, message, Empty } from 'antd';
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
                    {record.group ? (
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

    const pendingCount = registrations?.filter((r: MidtermRegistration) => !r.midterm_status).length || 0;
    const passedCount = registrations?.filter((r: MidtermRegistration) => r.midterm_status === 'PASS').length || 0;
    const failedCount = registrations?.filter((r: MidtermRegistration) => r.midterm_status === 'FAIL').length || 0;

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
                    message="Lưu ý về quyền đánh giá"
                    description="Một số đề tài có thể bị khóa nút đánh giá do nằm ngoài khoảng thời gian quy định hoặc thiếu dữ liệu học kỳ. Rê chuột vào nút bị khóa để xem chi tiết lý do."
                    type="info"
                    showIcon
                    className="mb-6 border-l-4 border-l-blue-500 shadow-sm"
                />
            )}

            {/* Statistics */}
            <div className="grid grid-cols-3 gap-6 mb-6">
                <Card className="shadow-soft border-l-4 border-l-orange-500 rounded-xl">
                    <div className="text-center">
                        <div className="text-3xl font-bold text-orange-600">{pendingCount}</div>
                        <div className="text-gray-500 font-medium mt-1">Chưa đánh giá</div>
                    </div>
                </Card>
                <Card className="shadow-soft border-l-4 border-l-green-500 rounded-xl">
                    <div className="text-center">
                        <div className="text-3xl font-bold text-green-600">{passedCount}</div>
                        <div className="text-gray-500 font-medium mt-1">PASS</div>
                    </div>
                </Card>
                <Card className="shadow-soft border-l-4 border-l-red-500 rounded-xl">
                    <div className="text-center">
                        <div className="text-3xl font-bold text-red-600">{failedCount}</div>
                        <div className="text-gray-500 font-medium mt-1">FAIL</div>
                    </div>
                </Card>
            </div>

            {/* Table */}
            <Card className="page-card-flush">
                {registrations?.length === 0 ? (
                    <Empty description="Không có nhóm nào cần đánh giá giữa kỳ" className="py-12" />
                ) : (
                    <Table
                        dataSource={registrations || []}
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
                            {selectedRegistration.group ? (
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
