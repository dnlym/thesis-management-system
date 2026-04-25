import { useState } from 'react';
import { Card, Table, Button, Modal, Input, Tag, Spin, Descriptions, Avatar } from 'antd';
import { CheckOutlined, CloseOutlined, EyeOutlined, UserOutlined } from '@ant-design/icons';
import { RegistrationStatusBadge } from '@/components/StatusBadge';
import {
    useRegistrations,
    useConfirmRegistration,
    useRejectRegistration
} from '@/hooks/useRegistrations';
import { useAuthStore } from '@/store/auth';
import type { Registration } from '@/types';

const { TextArea } = Input;

const SupervisorManageRegistrations = () => {
    const { user } = useAuthStore();
    const [detailModalVisible, setDetailModalVisible] = useState(false);
    const [rejectModalVisible, setRejectModalVisible] = useState(false);
    const [selectedRegistration, setSelectedRegistration] = useState<Registration | null>(null);
    const [rejectionReason, setRejectionReason] = useState('');

    // Get all registrations for supervisor's topics (no status filter)
    const { data: registrations, isLoading } = useRegistrations();
    const confirmMutation = useConfirmRegistration();
    const rejectMutation = useRejectRegistration();

    // Group registrations by topic_id to prevent duplicate topic display
    const groupedByTopic = registrations?.reduce((acc: any, reg: any) => {
        const topicId = reg.topic_id || reg.topic?.id;
        if (!topicId) return acc;

        if (!acc[topicId]) {
            acc[topicId] = {
                ...reg,
                allStudents: [],
                allRegistrations: [],
            };
        }

        // Add student info
        if (reg.student) {
            acc[topicId].allStudents.push({
                id: reg.student.id,
                full_name: reg.student.full_name,
                student_code: reg.student.student_code,
                email: reg.student.email,
                registration_id: reg.id,
                status: reg.status,
            });
        }

        acc[topicId].allRegistrations.push(reg);

        return acc;
    }, {} as Record<string, any>);

    // Convert to array for table
    const groupedRegistrations = Object.values(groupedByTopic || {});

    const viewDetail = (registration: Registration) => {
        setSelectedRegistration(registration);
        setDetailModalVisible(true);
    };

    const handleConfirm = (id: string) => {
        Modal.confirm({
            title: 'Xác nhận đăng ký',
            content: 'Bạn có chắc chắn muốn xác nhận đăng ký này? Sau khi xác nhận, sinh viên sẽ chính thức được gắn với đề tài.',
            okText: 'Xác nhận',
            cancelText: 'Hủy',
            onOk: () => {
                confirmMutation.mutate(id);
            },
        });
    };

    const handleReject = (registration: Registration) => {
        setSelectedRegistration(registration);
        setRejectModalVisible(true);
    };

    const confirmReject = () => {
        if (!selectedRegistration || !rejectionReason.trim()) {
            return;
        }

        rejectMutation.mutate(
            { id: selectedRegistration.id, reason: rejectionReason },
            {
                onSuccess: () => {
                    setRejectModalVisible(false);
                    setSelectedRegistration(null);
                    setRejectionReason('');
                },
            }
        );
    };

    const columns = [
        {
            title: 'Sinh viên',
            key: 'students',
            render: (_: any, record: any) => (
                <div className="space-y-1">
                    {record.allStudents?.length > 0 ? (
                        record.allStudents.map((student: any) => (
                            <div key={student.id} className="flex items-center space-x-2 whitespace-nowrap">
                                <Avatar icon={<UserOutlined />} size="small" />
                                <div>
                                    <span className="font-medium">{student.full_name}</span>
                                    <span className="text-gray-500 text-xs ml-2">({student.student_code})</span>
                                </div>
                            </div>
                        ))
                    ) : record.group?.members?.length > 0 ? (
                        record.group.members.map((member: any) => (
                            <div key={member.user_id} className="flex items-center space-x-2 whitespace-nowrap">
                                <Avatar icon={<UserOutlined />} size="small" />
                                <div>
                                    <span className="font-medium">{member.user?.full_name}</span>
                                    <span className="text-gray-500 text-xs ml-2">({member.user?.student_code})</span>
                                </div>
                            </div>
                        ))
                    ) : (
                        <span className="text-gray-400">Không có thành viên</span>
                    )}
                </div>
            ),
        },
        {
            title: 'Đề tài',
            key: 'topic',
            render: (_: any, record: any) => (
                <div style={{ maxWidth: 350 }}>
                    <div className="font-medium" style={{ wordBreak: 'break-word' }}>{record.topic?.title || 'N/A'}</div>
                    <div className="text-xs text-gray-500">GVHD: {record.topic?.supervisor?.full_name}</div>
                </div>
            ),
        },
        {
            title: 'Nhóm',
            key: 'group',
            render: (_: any, record: any) => (
                record.group ? (
                    <Tag color="blue">{record.group.name}</Tag>
                ) : (
                    <Tag>Chưa có nhóm</Tag>
                )
            ),
        },
        {
            title: 'Ngày đăng ký',
            dataIndex: 'registered_at',
            key: 'registered_at',
            render: (date: string) => date ? new Date(date).toLocaleDateString('vi-VN') : 'N/A',
        },
        {
            title: 'Trạng thái',
            dataIndex: 'status',
            key: 'status',
            render: (status: any) => <RegistrationStatusBadge status={status} />,
        },
        {
            title: 'Thao tác',
            key: 'actions',
            render: (_: any, record: any) => (
                <div className="space-x-2">
                    <Button
                        type="link"
                        size="small"
                        icon={<EyeOutlined />}
                        onClick={() => viewDetail(record)}
                    >
                        Chi tiết
                    </Button>
                    {record.status === 'PENDING' && (
                        <>
                            <Button
                                type="link"
                                size="small"
                                icon={<CheckOutlined />}
                                onClick={() => handleConfirm(record.id)}
                                className="text-green-600 hover:text-green-700"
                                loading={confirmMutation.isPending}
                            >
                                Xác nhận
                            </Button>
                            <Button
                                type="link"
                                danger
                                size="small"
                                icon={<CloseOutlined />}
                                onClick={() => handleReject(record)}
                                loading={rejectMutation.isPending}
                            >
                                Từ chối
                            </Button>
                        </>
                    )}
                </div>
            ),
        },
    ];

    return (
        <div className="p-6 space-y-6">
            <div>
                <h1>Quản lý đăng ký</h1>
                <p className="text-muted-foreground">
                    Xem và xử lý đăng ký đề tài từ sinh viên
                </p>
            </div>

            {/* Statistics Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="shadow-soft">
                    <div className="text-center">
                        <div className="text-sm text-gray-600 mb-1">Chờ xử lý</div>
                        <div className="font-bold text-blue-600">
                            {registrations?.filter(r => r.status === 'PENDING').length || 0}
                        </div>
                    </div>
                </Card>
                <Card className="shadow-soft">
                    <div className="text-center">
                        <div className="text-sm text-gray-600 mb-1">Đã xác nhận</div>
                        <div className="font-bold text-green-600">
                            {registrations?.filter(r => r.status === 'CONFIRMED').length || 0}
                        </div>
                    </div>
                </Card>
                <Card className="shadow-soft">
                    <div className="text-center">
                        <div className="text-sm text-gray-600 mb-1">Đã từ chối</div>
                        <div className="font-bold text-red-600">
                            {registrations?.filter(r => r.status === 'REJECTED').length || 0}
                        </div>
                    </div>
                </Card>
            </div>

            {/* Registrations Table */}
            <Card className="shadow-soft">
                <Spin spinning={isLoading}>
                    <Table
                        columns={columns}
                        dataSource={groupedRegistrations || []}
                        rowKey={(record: any) => record.topic_id || record.topic?.id || record.id}
                        pagination={{
                            pageSize: 10,
                            showTotal: (total) => `Tổng ${total} đề tài`,
                        }}
                        locale={{
                            emptyText: 'Chưa có đăng ký nào',
                        }}
                    />
                </Spin>
            </Card>

            {/* Detail Modal */}
            <Modal
                title="Chi tiết đăng ký"
                open={detailModalVisible}
                onCancel={() => setDetailModalVisible(false)}
                footer={[
                    <Button key="close" onClick={() => setDetailModalVisible(false)}>
                        Đóng
                    </Button>,
                    selectedRegistration?.status === 'PENDING' && (
                        <>
                            <Button
                                key="confirm"
                                type="primary"
                                icon={<CheckOutlined />}
                                onClick={() => {
                                    handleConfirm(selectedRegistration.id);
                                    setDetailModalVisible(false);
                                }}
                                loading={confirmMutation.isPending}
                            >
                                Xác nhận
                            </Button>
                            <Button
                                key="reject"
                                danger
                                icon={<CloseOutlined />}
                                onClick={() => {
                                    setDetailModalVisible(false);
                                    handleReject(selectedRegistration);
                                }}
                            >
                                Từ chối
                            </Button>
                        </>
                    ),
                ]}
                width={700}
            >
                {selectedRegistration && (
                    <Descriptions bordered column={1}>
                        <Descriptions.Item label="Sinh viên">
                            <div className="space-y-2">
                                {(selectedRegistration as any).group?.members?.map((member: any) => (
                                    <div key={member.user_id} className="flex items-center space-x-2">
                                        <Avatar icon={<UserOutlined />} size="small" />
                                        <span className="font-medium">{member.user?.full_name}</span>
                                        <span className="text-gray-500">({member.user?.student_code})</span>
                                    </div>
                                )) || 'Không có thành viên'}
                            </div>
                        </Descriptions.Item>
                        <Descriptions.Item label="Đề tài">
                            <div>
                                <div className="font-medium">{(selectedRegistration as any).topic?.title || 'N/A'}</div>
                                <div className="text-sm text-gray-500">GVHD: {(selectedRegistration as any).topic?.supervisor?.full_name}</div>
                            </div>
                        </Descriptions.Item>
                        <Descriptions.Item label="Nhóm">
                            {(selectedRegistration as any).group?.name || 'Chưa có nhóm'}
                        </Descriptions.Item>
                        <Descriptions.Item label="Ngày đăng ký">
                            {(selectedRegistration as any).registered_at
                                ? new Date((selectedRegistration as any).registered_at).toLocaleString('vi-VN')
                                : 'N/A'}
                        </Descriptions.Item>
                        <Descriptions.Item label="Trạng thái">
                            <RegistrationStatusBadge status={selectedRegistration.status} />
                        </Descriptions.Item>
                        {(selectedRegistration as any).confirmed_at && (
                            <Descriptions.Item label="Ngày xác nhận">
                                {new Date((selectedRegistration as any).confirmed_at).toLocaleString('vi-VN')}
                            </Descriptions.Item>
                        )}
                        {(selectedRegistration as any).rejection_reason && (
                            <Descriptions.Item label="Lý do từ chối">
                                <div className="bg-red-50 p-2 rounded">
                                    {(selectedRegistration as any).rejection_reason}
                                </div>
                            </Descriptions.Item>
                        )}
                    </Descriptions>
                )}
            </Modal>

            {/* Reject Modal */}
            <Modal
                title="Từ chối đăng ký"
                open={rejectModalVisible}
                onOk={confirmReject}
                onCancel={() => {
                    setRejectModalVisible(false);
                    setSelectedRegistration(null);
                    setRejectionReason('');
                }}
                confirmLoading={rejectMutation.isPending}
                okText="Xác nhận từ chối"
                cancelText="Hủy"
                okButtonProps={{ danger: true }}
            >
                <div className="space-y-4 my-4">
                    <p>Vui lòng nhập lý do từ chối để sinh viên biết và có thể đăng ký đề tài khác:</p>
                    <TextArea
                        rows={4}
                        value={rejectionReason}
                        onChange={(e) => setRejectionReason(e.target.value)}
                        placeholder="Ví dụ: Đề tài này yêu cầu kiến thức về AI/ML nâng cao..."
                        required
                    />
                    {!rejectionReason.trim() && (
                        <p className="text-sm text-red-500">Vui lòng nhập lý do từ chối</p>
                    )}
                </div>
            </Modal>
        </div>
    );
};

export default SupervisorManageRegistrations;
