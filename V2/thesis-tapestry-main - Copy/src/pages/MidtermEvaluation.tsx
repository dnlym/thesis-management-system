import { useState } from 'react';
import { Card, Table, Button, Tag, Modal, Input, Space, Avatar, Empty, Spin, Alert } from 'antd';
import { CheckCircleOutlined, CloseCircleOutlined, UserOutlined, ExclamationCircleOutlined } from '@ant-design/icons';
import { useMidtermRegistrations, useUpdateMidtermStatus } from '@/hooks/useGrading';
import { useAuthStore } from '@/store/auth';
import dayjs from 'dayjs';

const { TextArea } = Input;

interface MidtermRegistration {
    id: string;
    topic: {
        id: string;
        title: string;
        supervisor_id: string;
    };
    group: {
        id: string;
        name: string;
        members: {
            user: {
                id: string;
                full_name: string;
                student_code: string;
                email: string;
                avatar_url?: string;
            };
        }[];
    } | null;
    student?: {
        id: string;
        full_name: string;
        student_code: string;
        email: string;
        avatar_url?: string;
    };
    midterm_status: 'PASS' | 'FAIL' | null;
    midterm_feedback: string | null;
    midterm_graded_at: string | null;
    registered_at: string;
    status: string;
}

/**
 * Midterm Evaluation Page
 * Only GVHD (Supervisor) can access this page to grade PASS/FAIL for their students
 */
const MidtermEvaluation = () => {
    const { user } = useAuthStore();
    const { data: registrations, isLoading, isError } = useMidtermRegistrations();
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

    const columns = [
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
            render: (title: string) => (
                <div className="font-medium text-gray-800">{title}</div>
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

                // Can grade
                return (
                    <Space>
                        <Button
                            type="primary"
                            icon={<CheckCircleOutlined />}
                            className="bg-green-600 hover:bg-green-700"
                            onClick={() => handleOpenGradeModal(record, 'PASS')}
                        >
                            PASS
                        </Button>
                        <Button
                            danger
                            icon={<CloseCircleOutlined />}
                            onClick={() => handleOpenGradeModal(record, 'FAIL')}
                        >
                            FAIL
                        </Button>
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
        <div className="p-6">
            {/* Header */}
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-gray-800">Đánh giá giữa kỳ</h1>
                <p className="text-gray-500">Đánh giá PASS/FAIL cho các nhóm sinh viên được phân công hướng dẫn</p>
            </div>

            {/* Statistics */}
            <div className="grid grid-cols-3 gap-4 mb-6">
                <Card className="bg-orange-50 border-orange-200">
                    <div className="text-center">
                        <div className="text-3xl font-bold text-orange-600">{pendingCount}</div>
                        <div className="text-gray-600">Chưa đánh giá</div>
                    </div>
                </Card>
                <Card className="bg-green-50 border-green-200">
                    <div className="text-center">
                        <div className="text-3xl font-bold text-green-600">{passedCount}</div>
                        <div className="text-gray-600">PASS</div>
                    </div>
                </Card>
                <Card className="bg-red-50 border-red-200">
                    <div className="text-center">
                        <div className="text-3xl font-bold text-red-600">{failedCount}</div>
                        <div className="text-gray-600">FAIL</div>
                    </div>
                </Card>
            </div>

            {/* Table */}
            <Card className="shadow-soft">
                {registrations?.length === 0 ? (
                    <Empty description="Không có nhóm nào cần đánh giá giữa kỳ" />
                ) : (
                    <Table
                        dataSource={registrations || []}
                        columns={columns}
                        rowKey="id"
                        pagination={{ pageSize: 10 }}
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
    );
};

export default MidtermEvaluation;
