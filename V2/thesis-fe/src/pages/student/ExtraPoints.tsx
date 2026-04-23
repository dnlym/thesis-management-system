import { useState } from 'react';
import { Card, Button, Table, Modal, Input, Form, Spin, Tag, Descriptions } from 'antd';
import { PlusOutlined, EyeOutlined, DeleteOutlined } from '@ant-design/icons';
import { FileUpload } from '@/components/FileUpload';
import { ExtraPointsStatusBadge } from '@/components/StatusBadge';
import {
    useExtraPoints,
    useCreateExtraPointsRequest,
    useWithdrawExtraPoints
} from '@/hooks/useExtraPoints';
import type { ExtraPoints } from '@/types';

const { TextArea } = Input;

const StudentExtraPoints = () => {
    const [isModalVisible, setIsModalVisible] = useState(false);
    const [detailModalVisible, setDetailModalVisible] = useState(false);
    const [selectedRequest, setSelectedRequest] = useState<ExtraPoints | null>(null);
    const [form] = Form.useForm();
    const [proofFiles, setProofFiles] = useState<File[]>([]);

    // TODO: Get studentId and topicId from auth/registration context
    const studentId = 'student-1';
    const topicId = 'topic-1';

    const { data: requests, isLoading } = useExtraPoints({ studentId });
    const createMutation = useCreateExtraPointsRequest();
    const withdrawMutation = useWithdrawExtraPoints();

    const handleSubmit = async () => {
        try {
            const values = await form.validateFields();

            if (proofFiles.length === 0) {
                return;
            }

            const formData = new FormData();
            formData.append('topicId', topicId);
            formData.append('description', values.description);
            if (values.requestedPoints) {
                formData.append('requestedPoints', values.requestedPoints.toString());
            }
            formData.append('proofFile', proofFiles[0]);

            createMutation.mutate(formData, {
                onSuccess: () => {
                    setIsModalVisible(false);
                    form.resetFields();
                    setProofFiles([]);
                },
            });
        } catch (error) {
            console.error('Validation failed:', error);
        }
    };

    const handleWithdraw = (id: string) => {
        Modal.confirm({
            title: 'Xác nhận rút yêu cầu',
            content: 'Bạn có chắc chắn muốn rút yêu cầu cộng điểm này?',
            okText: 'Xác nhận',
            cancelText: 'Hủy',
            onOk: () => {
                withdrawMutation.mutate(id);
            },
        });
    };

    const viewDetail = (request: ExtraPoints) => {
        setSelectedRequest(request);
        setDetailModalVisible(true);
    };

    const columns = [
        {
            title: 'Mô tả thành tích',
            dataIndex: 'reason',
            key: 'reason',
            ellipsis: true,
            render: (text: string) => (
                <div className="max-w-md">
                    <div className="line-clamp-2">{text}</div>
                </div>
            ),
        },
        {
            title: 'Điểm đề nghị',
            dataIndex: 'points_requested',
            key: 'points_requested',
            width: 120,
            render: (points: number) => (
                points ? `+${points.toFixed(2)}` : 'Chưa xác định'
            ),
        },
        {
            title: 'Điểm được duyệt',
            dataIndex: 'approved_points',
            key: 'approved_points',
            width: 130,
            render: (points: number | null) => (
                points !== null ? (
                    <span className="font-semibold text-green-600">+{points.toFixed(2)}</span>
                ) : (
                    <span className="text-gray-400">-</span>
                )
            ),
        },
        {
            title: 'Trạng thái',
            dataIndex: 'status',
            key: 'status',
            width: 130,
            render: (status: any) => <ExtraPointsStatusBadge status={status} />,
        },
        {
            title: 'Ngày gửi',
            dataIndex: 'created_at',
            key: 'created_at',
            width: 120,
            render: (date: string) => new Date(date).toLocaleDateString('vi-VN'),
        },
        {
            title: 'Thao tác',
            key: 'actions',
            width: 150,
            render: (_: any, record: ExtraPoints) => (
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
                        <Button
                            type="link"
                            danger
                            size="small"
                            icon={<DeleteOutlined />}
                            onClick={() => handleWithdraw(record.id)}
                            loading={withdrawMutation.isPending}
                        >
                            Rút
                        </Button>
                    )}
                </div>
            ),
        },
    ];

    return (
        <div className="p-6 space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-foreground">Điểm Cộng</h1>
                    <p className="text-muted-foreground">
                        Gửi yêu cầu cộng điểm cho các thành tích đạt được
                    </p>
                </div>
                <Button
                    type="primary"
                    icon={<PlusOutlined />}
                    onClick={() => setIsModalVisible(true)}
                    size="large"
                >
                    Gửi yêu cầu mới
                </Button>
            </div>

            {/* Info Card */}
            <Card className="bg-blue-50 border-blue-200">
                <div className="space-y-2">
                    <h3 className="font-semibold text-blue-900">Hướng dẫn cộng điểm</h3>
                    <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
                        <li>Điểm cộng tối đa: <strong>1.0 điểm</strong></li>
                        <li>Các thành tích được cộng điểm: giải thưởng khoa học, bài báo, sáng chế, v.v.</li>
                        <li>Cần cung cấp minh chứng (giấy chứng nhận, link bài báo, v.v.)</li>
                        <li>Trưởng bộ môn sẽ xét duyệt yêu cầu trong vòng 7 ngày</li>
                    </ul>
                </div>
            </Card>

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
                        locale={{
                            emptyText: 'Chưa có yêu cầu cộng điểm nào',
                        }}
                    />
                </Spin>
            </Card>

            {/* Create Request Modal */}
            <Modal
                title="Gửi yêu cầu cộng điểm"
                open={isModalVisible}
                onOk={handleSubmit}
                onCancel={() => {
                    setIsModalVisible(false);
                    form.resetFields();
                    setProofFiles([]);
                }}
                width={700}
                confirmLoading={createMutation.isPending}
                okText="Gửi yêu cầu"
                cancelText="Hủy"
            >
                <Form form={form} layout="vertical" className="mt-4">
                    <Form.Item
                        label="Mô tả thành tích"
                        name="description"
                        rules={[{ required: true, message: 'Vui lòng mô tả thành tích' }]}
                    >
                        <TextArea
                            rows={4}
                            placeholder="Mô tả chi tiết thành tích của bạn (giải thưởng, bài báo, sáng chế, v.v.)"
                        />
                    </Form.Item>

                    <Form.Item
                        label="Điểm đề nghị cộng (không bắt buộc)"
                        name="requestedPoints"
                        help="Trưởng bộ môn sẽ xem xét và quyết định điểm thực tế"
                    >
                        <Input
                            type="number"
                            step="0.1"
                            min="0"
                            max="1"
                            placeholder="Ví dụ: 0.5"
                            suffix="điểm"
                        />
                    </Form.Item>

                    <Form.Item
                        label="Minh chứng"
                        required
                        help="Upload file hoặc ảnh minh chứng (giấy chứng nhận, ảnh sản phẩm, v.v.)"
                    >
                        <FileUpload
                            onFilesSelected={setProofFiles}
                            value={proofFiles}
                            accept={{
                                'image/*': ['.png', '.jpg', '.jpeg'],
                                'application/pdf': ['.pdf'],
                            }}
                            maxSize={10 * 1024 * 1024} // 10MB
                            maxFiles={1}
                        />
                    </Form.Item>

                    <div className="bg-yellow-50 border border-yellow-200 rounded p-3">
                        <p className="text-sm text-yellow-800">
                            <strong>Lưu ý:</strong> Hãy đảm bảo minh chứng rõ ràng và đầy đủ.
                            Yêu cầu không đủ minh chứng sẽ bị từ chối.
                        </p>
                    </div>
                </Form>
            </Modal>

            {/* Detail Modal */}
            <Modal
                title="Chi tiết yêu cầu cộng điểm"
                open={detailModalVisible}
                onCancel={() => setDetailModalVisible(false)}
                footer={[
                    <Button key="close" onClick={() => setDetailModalVisible(false)}>
                        Đóng
                    </Button>,
                ]}
                width={700}
            >
                {selectedRequest && (
                    <div className="space-y-4">
                        <Descriptions bordered column={1}>
                            <Descriptions.Item label="Trạng thái">
                                <ExtraPointsStatusBadge status={selectedRequest.status} />
                            </Descriptions.Item>
                            <Descriptions.Item label="Mô tả thành tích">
                                {selectedRequest.reason}
                            </Descriptions.Item>
                            <Descriptions.Item label="Điểm đề nghị">
                                {selectedRequest.points_requested
                                    ? `+${selectedRequest.points_requested.toFixed(2)}`
                                    : 'Chưa xác định'}
                            </Descriptions.Item>
                            <Descriptions.Item label="Điểm được duyệt">
                                {selectedRequest.approved_points !== null
                                    ? <span className="font-semibold text-green-600">
                                        +{selectedRequest.approved_points.toFixed(2)}
                                    </span>
                                    : <span className="text-gray-400">Chưa duyệt</span>}
                            </Descriptions.Item>
                            <Descriptions.Item label="Ngày gửi">
                                {new Date(selectedRequest.created_at).toLocaleString('vi-VN')}
                            </Descriptions.Item>
                            {selectedRequest.reviewed_at && (
                                <Descriptions.Item label="Ngày xét duyệt">
                                    {new Date(selectedRequest.reviewed_at).toLocaleString('vi-VN')}
                                </Descriptions.Item>
                            )}
                        </Descriptions>

                        {selectedRequest.rejection_reason && (
                            <div className="bg-red-50 border border-red-200 rounded p-4">
                                <h4 className="font-semibold text-red-900 mb-2">Lý do từ chối:</h4>
                                <p className="text-red-800">{selectedRequest.rejection_reason}</p>
                            </div>
                        )}

                        {selectedRequest.evidence_url && (
                            <div>
                                <h4 className="font-medium mb-2">Minh chứng:</h4>
                                <a
                                    href={selectedRequest.evidence_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-blue-600 hover:underline"
                                >
                                    Xem minh chứng
                                </a>
                            </div>
                        )}
                    </div>
                )}
            </Modal>
        </div>
    );
};

export default StudentExtraPoints;
