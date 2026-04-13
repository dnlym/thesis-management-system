import { useState } from 'react';
import { Card, Table, Button, Modal, Descriptions, Tag, Spin, Input } from 'antd';
import { CheckOutlined, CloseOutlined, EyeOutlined, DownloadOutlined } from '@ant-design/icons';
import { StatusBadge } from '@/components/StatusBadge';
import { useAuthStore } from '@/store/auth';
import { useAssignments, useAcceptAssignment, useDeclineAssignment } from '@/hooks/useAssignments';

const { TextArea } = Input;

const ReviewerAssignments = () => {
    const { user } = useAuthStore();
    const [detailModalVisible, setDetailModalVisible] = useState(false);
    const [declineModalVisible, setDeclineModalVisible] = useState(false);
    const [selectedAssignment, setSelectedAssignment] = useState<any>(null);
    const [declineReason, setDeclineReason] = useState('');

    // Fetch assignments for current user
    const { data: assignments, isLoading } = useAssignments({
        assignmentType: 'REVIEWER',
        teacherId: user?.id
    });
    const acceptMutation = useAcceptAssignment();
    const declineMutation = useDeclineAssignment();

    const viewDetail = (assignment: any) => {
        setSelectedAssignment(assignment);
        setDetailModalVisible(true);
    };

    const handleAccept = (id: string) => {
        Modal.confirm({
            title: 'Chấp nhận phân công',
            content: 'Bạn xác nhận chấp nhận phân công phản biện này?',
            okText: 'Chấp nhận',
            cancelText: 'Hủy',
            onOk: () => {
                acceptMutation.mutate(id);
            },
        });
    };

    const handleDecline = (assignment: any) => {
        setSelectedAssignment(assignment);
        setDeclineModalVisible(true);
    };

    const confirmDecline = () => {
        if (!selectedAssignment || !declineReason.trim()) {
            return;
        }

        declineMutation.mutate(
            { id: selectedAssignment.id, reason: declineReason },
            {
                onSuccess: () => {
                    setDeclineModalVisible(false);
                    setSelectedAssignment(null);
                    setDeclineReason('');
                },
            }
        );
    };

    const columns = [
        {
            title: 'Đề tài',
            dataIndex: 'topicTitle',
            key: 'topicTitle',
            render: (text: string) => (
                <span className="font-medium">{text}</span>
            ),
        },
        {
            title: 'Vai trò',
            dataIndex: 'reviewerOrder',
            key: 'reviewerOrder',
            render: (order: number) => (
                <Tag color="blue">GVPB {order}</Tag>
            ),
        },
        {
            title: 'Trạng thái',
            dataIndex: 'status',
            key: 'status',
            render: (status: any) => <StatusBadge status={status} />,
        },
        {
            title: 'Ngày phân công',
            dataIndex: 'assignedAt',
            key: 'assignedAt',
            render: (date: string) => new Date(date).toLocaleDateString('vi-VN'),
        },
        {
            title: 'Deadline',
            dataIndex: 'deadline',
            key: 'deadline',
            render: (date: string) => new Date(date).toLocaleDateString('vi-VN'),
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
                    {/* Note: In the new mandatory system, assignments are AUTO_ACCEPTED or ACCEPTED immediately */}
                    {(record.status === 'ACCEPTED' || record.status === 'AUTO_ACCEPTED') && (
                        <Button
                            type="primary"
                            size="small"
                            onClick={() => window.location.href = '/evaluation'}
                        >
                            Chấm điểm
                        </Button>
                    )}
                </div>
            ),
        },
    ];

    return (
        <div className="p-6 space-y-6">
            <div>
                <h1 className="text-3xl font-bold text-foreground">Phân công phản biện</h1>
                <p className="text-muted-foreground">
                    Quản lý các đề tài được phân công phản biện
                </p>
            </div>

            {/* Info Card */}
            <Card className="bg-blue-50 border-blue-200">
                <div className="space-y-2">
                    <h3 className="font-semibold text-blue-900">Lưu ý</h3>
                    <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
                        <li>Đây là danh sách các đề tài bạn đã được phân công phản biện chính thức</li>
                        <li>Trưởng bộ môn đã phê duyệt và gán bạn vào các đề tài này</li>
                        <li>Vui lòng hoàn thành chấm điểm đúng thời hạn (Deadline) quy định</li>
                        <li>Tải xuống tài liệu để đánh giá kỹ trước khi thực hiện chấm điểm</li>
                    </ul>
                </div>
            </Card>

            {/* Assignments Table */}
            <Card className="shadow-soft">
                <Spin spinning={isLoading}>
                    <Table
                        columns={columns}
                        dataSource={assignments}
                        rowKey="id"
                        pagination={{
                            pageSize: 10,
                            showTotal: (total) => `Tổng ${total} phân công`,
                        }}
                        locale={{
                            emptyText: 'Chưa có phân công nào',
                        }}
                    />
                </Spin>
            </Card>

            {/* Detail Modal */}
            <Modal
                title="Chi tiết phân công"
                open={detailModalVisible}
                onCancel={() => setDetailModalVisible(false)}
                footer={[
                    <Button key="close" onClick={() => setDetailModalVisible(false)}>
                        Đóng
                    </Button>,
                    (selectedAssignment?.status === 'ACCEPTED' || selectedAssignment?.status === 'AUTO_ACCEPTED') && (
                        <Button
                            key="grade"
                            type="primary"
                            onClick={() => window.location.href = '/evaluation'}
                        >
                            Chấm điểm
                        </Button>
                    ),
                ].filter(Boolean)}
                width={700}
            >
                {selectedAssignment && (
                    <div className="space-y-4">
                        <Descriptions bordered column={1}>
                            <Descriptions.Item label="Đề tài">
                                {selectedAssignment.topicTitle}
                            </Descriptions.Item>
                            <Descriptions.Item label="Vai trò">
                                <Tag color="blue">GVPB {selectedAssignment.reviewerOrder}</Tag>
                            </Descriptions.Item>
                            <Descriptions.Item label="Trạng thái">
                                <StatusBadge status={selectedAssignment.status} />
                            </Descriptions.Item>
                            <Descriptions.Item label="Ngày phân công">
                                {new Date(selectedAssignment.assignedAt).toLocaleString('vi-VN')}
                            </Descriptions.Item>
                            <Descriptions.Item label="Deadline">
                                {new Date(selectedAssignment.deadline).toLocaleDateString('vi-VN')}
                            </Descriptions.Item>
                            {selectedAssignment.respondedAt && (
                                <Descriptions.Item label="Ngày phản hồi">
                                    {new Date(selectedAssignment.respondedAt).toLocaleString('vi-VN')}
                                </Descriptions.Item>
                            )}
                        </Descriptions>

                        <div>
                            <h4 className="font-semibold mb-2">Tài liệu đề tài:</h4>
                            <Button
                                icon={<DownloadOutlined />}
                                className="mr-2"
                            >
                                Tải đề cương
                            </Button>
                            <Button
                                icon={<DownloadOutlined />}
                            >
                                Tải báo cáo
                            </Button>
                        </div>
                    </div>
                )}
            </Modal>

            {/* Decline Modal */}
            <Modal
                title="Từ chối phân công"
                open={declineModalVisible}
                onOk={confirmDecline}
                onCancel={() => {
                    setDeclineModalVisible(false);
                    setSelectedAssignment(null);
                    setDeclineReason('');
                }}
                okText="Xác nhận từ chối"
                cancelText="Hủy"
                okButtonProps={{ danger: true }}
            >
                <div className="space-y-4 my-4">
                    <p>Vui lòng cho biết lý do từ chối để Trưởng BM có thể phân công người khác:</p>
                    <TextArea
                        rows={4}
                        value={declineReason}
                        onChange={(e) => setDeclineReason(e.target.value)}
                        placeholder="Ví dụ: Tôi đang có quá nhiều công việc trong thời gian này..."
                        required
                    />
                    {!declineReason.trim() && (
                        <p className="text-sm text-red-500">Vui lòng nhập lý do từ chối</p>
                    )}
                </div>
            </Modal>
        </div>
    );
};

export default ReviewerAssignments;
