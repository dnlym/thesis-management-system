import { useState } from 'react';
import { Card, Table, Button, Modal, Input, Tag, Spin, Descriptions, Avatar, Tabs, Badge } from 'antd';
import { CheckOutlined, CloseOutlined, EyeOutlined, UserOutlined, SearchOutlined } from '@ant-design/icons';
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
    const [activeTab, setActiveTab] = useState('ALL');
    const [searchTerm, setSearchTerm] = useState('');

    // Get all registrations for supervisor's topics (no status filter)
    const { data: registrations, isLoading } = useRegistrations();
    const confirmMutation = useConfirmRegistration();
    const rejectMutation = useRejectRegistration();

    // Filter registrations
    const filteredRegistrations = registrations?.filter((reg: any) => {
        const matchesStatus = activeTab === 'ALL' || reg.status === activeTab;
        const searchLower = searchTerm.toLowerCase();
        const matchesSearch = !searchTerm || 
            reg.student?.full_name?.toLowerCase().includes(searchLower) ||
            reg.student?.student_code?.toLowerCase().includes(searchLower) ||
            reg.topic?.title?.toLowerCase().includes(searchLower);
        
        return matchesStatus && matchesSearch;
    });

    // Group registrations by topic_id to prevent duplicate topic display
    const groupedByTopic = filteredRegistrations?.reduce((acc: any, reg: any) => {
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
            title: 'STT',
            key: 'stt',
            width: 60,
            align: 'center' as const,
            render: (_: any, __: any, index: number) => index + 1,
        },
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
        <div className="page-container">
            <div className="page-inner">
                {/* Header */}
                <Card className="page-header-card">
                    <div className="flex items-center gap-3">
                        <div className="page-header-icon"><CheckOutlined className="text-base" /></div>
                        <div>
                            <div className="page-header-title">Quản lý đăng ký</div>
                            <div className="page-header-subtitle">Xem và xử lý đăng ký đề tài từ sinh viên</div>
                        </div>
                    </div>
                </Card>

            {/* Filters Row */}
            <div className="bg-white p-2 rounded-xl border border-slate-100 shadow-sm mb-6">
                <div className="flex flex-col md:flex-row justify-between items-center gap-4 px-2">
                    <div className="flex flex-wrap items-center gap-2 py-2">
                        {[
                            { key: 'ALL', label: 'Tất cả', count: registrations?.length || 0, color: 'blue' },
                            { key: 'PENDING', label: 'Chờ xử lý', count: registrations?.filter(r => r.status === 'PENDING').length || 0, color: 'orange' },
                            { key: 'CONFIRMED', label: 'Đã xác nhận', count: registrations?.filter(r => r.status === 'CONFIRMED').length || 0, color: 'green' },
                            { key: 'REJECTED', label: 'Đã từ chối', count: registrations?.filter(r => r.status === 'REJECTED').length || 0, color: 'red' },
                        ].map((tab) => (
                            <button
                                key={tab.key}
                                onClick={() => setActiveTab(tab.key)}
                                className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold transition-all duration-200 border-none outline-none cursor-pointer ${
                                    activeTab === tab.key
                                        ? 'bg-blue-50 text-blue-600 shadow-sm ring-1 ring-blue-100'
                                        : 'bg-slate-50 text-slate-500 hover:bg-slate-100'
                                }`}
                            >
                                <span className="text-sm">{tab.label}</span>
                                <Badge 
                                    count={tab.count} 
                                    size="small" 
                                    overflowCount={99} 
                                    style={{ 
                                        backgroundColor: activeTab === tab.key ? '#3b82f6' : '#94a3b8', 
                                        color: '#fff', 
                                        boxShadow: 'none',
                                        fontSize: '10px',
                                        minWidth: '18px',
                                        height: '18px',
                                        lineHeight: '18px'
                                    }} 
                                />
                            </button>
                        ))}
                    </div>
                    <div className="w-full md:w-auto">
                        <Input
                            placeholder="Tìm tên sinh viên, mã số, đề tài..."
                            prefix={<SearchOutlined className="text-slate-400" />}
                            allowClear
                            className="sys-input-search"
                            style={{ width: '100%', minWidth: 320, height: 40, borderRadius: 12 }}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>
            </div>

            {/* Registrations Table */}
            <Card className="page-card-flush">
                <Spin spinning={isLoading}>
                    <Table
                        columns={columns}
                        dataSource={groupedRegistrations || []}
                        rowKey={(record: any) => record.topic_id || record.topic?.id || record.id}
                        className="sys-table"
                        pagination={{
                            pageSize: 10,
                            className: 'px-6 py-4'
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
        </div>
    );
};

export default SupervisorManageRegistrations;
