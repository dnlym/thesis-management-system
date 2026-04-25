import { useState } from 'react';
import { Card, Table, Button, Modal, Input, Tag, Spin, Descriptions, InputNumber } from 'antd';
import { CheckOutlined, CloseOutlined, EyeOutlined } from '@ant-design/icons';
import { ExtraPointsStatusBadge } from '@/components/StatusBadge';
import {
    useExtraPoints,
    useApproveExtraPoints,
    useRejectExtraPoints
} from '@/hooks/useExtraPoints';

const { TextArea } = Input;

const HeadManageExtraPoints = () => {
    const [detailModalVisible, setDetailModalVisible] = useState(false);
    const [approveModalVisible, setApproveModalVisible] = useState(false);
    const [rejectModalVisible, setRejectModalVisible] = useState(false);
    const [selectedRequest, setSelectedRequest] = useState<any>(null);
    const [approvedPoints, setApprovedPoints] = useState<number>(0);
    const [rejectionReason, setRejectionReason] = useState('');

    const { data: requests, isLoading } = useExtraPoints({ status: 'PENDING' });
    const approveMutation = useApproveExtraPoints();
    const rejectMutation = useRejectExtraPoints();

    const viewDetail = (request: any) => {
        setSelectedRequest(request);
        setDetailModalVisible(true);
    };

    const openApproveModal = (request: any) => {
        setSelectedRequest(request);
        setApprovedPoints(request.requestedPoints || 0);
        setApproveModalVisible(true);
    };

    const openRejectModal = (request: any) => {
        setSelectedRequest(request);
        setRejectModalVisible(true);
    };

    const handleApprove = () => {
        if (!selectedRequest || approvedPoints <= 0) {
            return;
        }

        approveMutation.mutate(
            { id: selectedRequest.id, approvedPoints: approvedPoints },
            {
                onSuccess: () => {
                    setApproveModalVisible(false);
                    setSelectedRequest(null);
                    setApprovedPoints(0);
                },
            }
        );
    };

    const handleReject = () => {
        if (!selectedRequest || !rejectionReason.trim()) {
            return;
        }

        rejectMutation.mutate(
            { id: selectedRequest.id, reason: rejectionReason },
            {
                onSuccess: () => {
                    setRejectModalVisible(false);
                    setSelectedRequest(null);
                    setRejectionReason('');
                },
            }
        );
    };

    const columns = [
        {
            title: 'Sinh viên',
            dataIndex: 'studentId',
            key: 'student',
            render: (id: string) => 'SV ' + id.substring(0, 8),
        },
        {
            title: 'Đề tài',
            dataIndex: 'topicId',
            key: 'topic',
            render: (id: string) => 'Đề tài ' + id.substring(0, 8),
        },
        {
            title: 'Mô tả thành tích',
            dataIndex: 'description',
            key: 'description',
            ellipsis: true,
            render: (text: string) => (
                <div className="max-w-md line-clamp-2">{text}</div>
            ),
        },
        {
            title: 'Điểm đề nghị',
            dataIndex: 'requestedPoints',
            key: 'requestedPoints',
            render: (points: number) => (
                points ? `+${points.toFixed(2)}` : 'Chưa xác định'
            ),
        },
        {
            title: 'Ngày gửi',
            dataIndex: 'createdAt',
            key: 'createdAt',
            render: (date: string) => new Date(date).toLocaleDateString('vi-VN'),
        },
        {
            title: 'Trạng thái',
            dataIndex: 'status',
            key: 'status',
            render: (status: any) => <ExtraPointsStatusBadge status={status} />,
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
                                className="text-green-600 hover:text-green-700"
                                onClick={() => openApproveModal(record)}
                                loading={approveMutation.isPending}
                            >
                                Duyệt
                            </Button>
                            <Button
                                type="link"
                                danger
                                size="small"
                                icon={<CloseOutlined />}
                                onClick={() => openRejectModal(record)}
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
                <h1>Quản lý điểm cộng</h1>
                <p className="text-muted-foreground">
                    Xét duyệt yêu cầu cộng điểm từ sinh viên
                </p>
            </div>

            {/* Info Card */}
            <Card className="bg-blue-50 border-blue-200">
                <div className="space-y-2">
                    <h3 className="font-semibold text-blue-900">Quy định điểm cộng</h3>
                    <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
                        <li>Điểm cộng tối đa: <strong>1.0 điểm</strong></li>
                        <li>Giải thưởng khoa học cấp quốc gia: 0.8-1.0 điểm</li>
                        <li>Bài báo tạp chí uy tín: 0.5-0.8 điểm</li>
                        <li>Giải thưởng cấp trường/tỉnh: 0.3-0.5 điểm</li>
                        <li>Cần có minh chứng rõ ràng và đầy đủ</li>
                    </ul>
                </div>
            </Card>

            {/* Statistics */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card className="shadow-soft">
                    <div className="text-center">
                        <div className="text-sm text-gray-600 mb-1">Chờ duyệt</div>
                        <div className="font-bold text-orange-600">
                            {requests?.filter(r => r.status === 'PENDING').length || 0}
                        </div>
                    </div>
                </Card>
                <Card className="shadow-soft">
                    <div className="text-center">
                        <div className="text-sm text-gray-600 mb-1">Đã duyệt</div>
                        <div className="font-bold text-green-600">
                            {requests?.filter(r => r.status === 'APPROVED').length || 0}
                        </div>
                    </div>
                </Card>
                <Card className="shadow-soft">
                    <div className="text-center">
                        <div className="text-sm text-gray-600 mb-1">Từ chối</div>
                        <div className="font-bold text-red-600">
                            {requests?.filter(r => r.status === 'REJECTED').length || 0}
                        </div>
                    </div>
                </Card>
                <Card className="shadow-soft">
                    <div className="text-center">
                        <div className="text-sm text-gray-600 mb-1">Tổng cộng</div>
                        <div className="font-bold text-blue-600">
                            {requests?.length || 0}
                        </div>
                    </div>
                </Card>
            </div>

            {/* Requests Table */}
            <Card className="shadow-soft">
                <Spin spinning={isLoading}>
                    <Table
                        columns={columns}
                        dataSource={requests || []}
                        rowKey="id"
                        pagination={{
                            pageSize: 10,
                            showTotal: (total) => `Tổng ${total} yêu cầu`,
                        }}
                        locale={{ emptyText: 'Chưa có yêu cầu nào' }}
                    />
                </Spin>
            </Card>

            {/* Detail Modal */}
            <Modal
                title="Chi tiết yêu cầu cộng điểm"
                open={detailModalVisible}
                onCancel={() => setDetailModalVisible(false)}
                footer={[
                    <Button key="close" onClick={() => setDetailModalVisible(false)}>
                        Đóng
                    </Button>,
                    selectedRequest?.status === 'PENDING' && (
                        <>
                            <Button
                                key="approve"
                                type="primary"
                                icon={<CheckOutlined />}
                                onClick={() => {
                                    setDetailModalVisible(false);
                                    openApproveModal(selectedRequest);
                                }}
                            >
                                Phê duyệt
                            </Button>
                            <Button
                                key="reject"
                                danger
                                icon={<CloseOutlined />}
                                onClick={() => {
                                    setDetailModalVisible(false);
                                    openRejectModal(selectedRequest);
                                }}
                            >
                                Từ chối
                            </Button>
                        </>
                    ),
                ]}
                width={700}
            >
                {selectedRequest && (
                    <div className="space-y-4">
                        <Descriptions bordered column={1}>
                            <Descriptions.Item label="Sinh viên">
                                SV {selectedRequest.studentId.substring(0, 8)}
                            </Descriptions.Item>
                            <Descriptions.Item label="Đề tài">
                                Đề tài {selectedRequest.topicId.substring(0, 8)}
                            </Descriptions.Item>
                            <Descriptions.Item label="Mô tả thành tích">
                                {selectedRequest.description}
                            </Descriptions.Item>
                            <Descriptions.Item label="Điểm đề nghị">
                                {selectedRequest.requestedPoints
                                    ? `+${selectedRequest.requestedPoints.toFixed(2)}`
                                    : 'Chưa xác định'}
                            </Descriptions.Item>
                            <Descriptions.Item label="Trạng thái">
                                <ExtraPointsStatusBadge status={selectedRequest.status} />
                            </Descriptions.Item>
                            <Descriptions.Item label="Ngày gửi">
                                {new Date(selectedRequest.createdAt).toLocaleString('vi-VN')}
                            </Descriptions.Item>
                        </Descriptions>

                        {selectedRequest.proofUrl && (
                            <div>
                                <h4 className="font-semibold mb-2">Minh chứng:</h4>
                                <a
                                    href={selectedRequest.proofUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-blue-600 hover:underline"
                                >
                                    Xem minh chứng
                                </a>
                            </div>
                        )}

                        {selectedRequest.approvedPoints !== null && (
                            <div className="bg-green-50 border border-green-200 rounded p-4">
                                <h4 className="font-semibold text-green-900 mb-2">Điểm được duyệt:</h4>
                                <div className="font-bold text-green-600">
                                    +{selectedRequest.approvedPoints.toFixed(2)}
                                </div>
                            </div>
                        )}

                        {selectedRequest.rejectionReason && (
                            <div className="bg-red-50 border border-red-200 rounded p-4">
                                <h4 className="font-semibold text-red-900 mb-2">Lý do từ chối:</h4>
                                <p className="text-red-800">{selectedRequest.rejectionReason}</p>
                            </div>
                        )}
                    </div>
                )}
            </Modal>

            {/* Approve Modal */}
            <Modal
                title="Phê duyệt điểm cộng"
                open={approveModalVisible}
                onOk={handleApprove}
                onCancel={() => {
                    setApproveModalVisible(false);
                    setSelectedRequest(null);
                    setApprovedPoints(0);
                }}
                confirmLoading={approveMutation.isPending}
                okText="Xác nhận phê duyệt"
                cancelText="Hủy"
            >
                <div className="space-y-4 my-4">
                    <div>
                        <label className="block mb-2 font-medium">Điểm cộng được duyệt:</label>
                        <InputNumber
                            min={0}
                            max={1}
                            step={0.1}
                            value={approvedPoints}
                            onChange={(value) => setApprovedPoints(value || 0)}
                            className="w-full"
                            size="large"
                            placeholder="Nhập điểm cộng (0-1.0)"
                        />
                        <p className="text-sm text-gray-600 mt-2">
                            Sinh viên đề nghị: +{selectedRequest?.requestedPoints?.toFixed(2) || '0.00'}
                        </p>
                    </div>

                    <div className="bg-yellow-50 border border-yellow-200 rounded p-3">
                        <p className="text-sm text-yellow-800">
                            <strong>Lưu ý:</strong> Điểm cộng tối đa là 1.0 và sẽ được cộng vào điểm tổng cuối cùng.
                        </p>
                    </div>
                </div>
            </Modal>

            {/* Reject Modal */}
            <Modal
                title="Từ chối yêu cầu cộng điểm"
                open={rejectModalVisible}
                onOk={handleReject}
                onCancel={() => {
                    setRejectModalVisible(false);
                    setSelectedRequest(null);
                    setRejectionReason('');
                }}
                confirmLoading={rejectMutation.isPending}
                okText="Xác nhận từ chối"
                cancelText="Hủy"
                okButtonProps={{ danger: true }}
            >
                <div className="space-y-4 my-4">
                    <p>Vui lòng nhập lý do từ chối:</p>
                    <TextArea
                        rows={4}
                        value={rejectionReason}
                        onChange={(e) => setRejectionReason(e.target.value)}
                        placeholder="Ví dụ: Minh chứng chưa rõ ràng. Cần bổ sung giấy chứng nhận chính thức..."
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

export default HeadManageExtraPoints;
