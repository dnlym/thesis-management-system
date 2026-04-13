import { useState, useEffect } from 'react';
import { Card, Table, Button, Modal, Tag, Tabs, Spin, Descriptions, Input, Select, Empty, Space } from 'antd';
import { EyeOutlined, CheckOutlined, CloseOutlined, DownloadOutlined, HistoryOutlined, SearchOutlined } from '@ant-design/icons';
import { StatusBadge } from '@/components/StatusBadge';
import {
    useSubmissions,
    useSubmissionVersions,
    useApproveSubmission,
    useRejectSubmission
} from '@/hooks/useSubmissions';
import { useTopics } from '@/hooks/useTopics';
import { useAuthStore } from '@/store/auth';
import type { Submission, SubmissionType, Topic } from '@/types';

const { TabPane } = Tabs;
const { TextArea } = Input;
const { Option } = Select;

const SupervisorReviewSubmissions = () => {
    const { user } = useAuthStore();
    const [activeTab, setActiveTab] = useState<SubmissionType>('PROPOSAL');
    const [selectedTopicId, setSelectedTopicId] = useState<string | null>(null);
    const [detailModalVisible, setDetailModalVisible] = useState(false);
    const [versionsModalVisible, setVersionsModalVisible] = useState(false);
    const [rejectModalVisible, setRejectModalVisible] = useState(false);
    const [selectedSubmission, setSelectedSubmission] = useState<Submission | null>(null);
    const [rejectionReason, setRejectionReason] = useState('');

    // Fetch supervisor's topics
    const { data: topicsData, isLoading: isLoadingTopics } = useTopics({
        supervisorId: user?.id,
        status: ['APPROVED', 'REGISTERED', 'DEFENDING', 'COMPLETED', 'FINALIZED']
    });

    const topics = topicsData?.topics || [];

    // Set first topic as default if available
    useEffect(() => {
        if (topics.length > 0 && !selectedTopicId) {
            setSelectedTopicId(topics[0].id);
        }
    }, [topics, selectedTopicId]);

    const { data: submissions, isLoading: isLoadingSubmissions } = useSubmissions(
        { topicId: selectedTopicId || undefined, type: activeTab },
        { enabled: !!selectedTopicId }
    );

    const { data: versions } = useSubmissionVersions(selectedSubmission?.id || undefined);
    const approveMutation = useApproveSubmission();
    const rejectMutation = useRejectSubmission();

    const viewDetail = (submission: Submission) => {
        setSelectedSubmission(submission);
        setDetailModalVisible(true);
    };

    const viewVersions = (submission: Submission) => {
        setSelectedSubmission(submission);
        setVersionsModalVisible(true);
    };

    const handleApprove = (id: string) => {
        Modal.confirm({
            title: 'Phê duyệt file',
            content: 'Xác nhận phê duyệt file này? Sinh viên có thể tiếp tục nộp phiên bản mới sau khi được duyệt.',
            okText: 'Phê duyệt',
            cancelText: 'Hủy',
            onOk: () => {
                approveMutation.mutate(id);
            },
        });
    };

    const handleReject = (submission: Submission) => {
        setSelectedSubmission(submission);
        setRejectModalVisible(true);
    };

    const confirmReject = () => {
        if (!selectedSubmission || rejectionReason.trim().length < 20) {
            return;
        }

        rejectMutation.mutate(
            { id: selectedSubmission.id, reason: rejectionReason },
            {
                onSuccess: () => {
                    setRejectModalVisible(false);
                    setSelectedSubmission(null);
                    setRejectionReason('');
                },
            }
        );
    };

    const formatFileSize = (bytes: number) => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
    };

    const submissionsColumns = [
        {
            title: 'Nhóm/SV',
            dataIndex: 'group_id',
            key: 'group',
            render: (id: string, record: any) => (
                <Space direction="vertical" size={0}>
                    <span className="font-medium">Nhóm {record.group?.name || id.substring(0, 8)}</span>
                    <span className="text-xs text-gray-400">ID: {id.substring(0, 8)}</span>
                </Space>
            ),
        },
        {
            title: 'Phiên bản hiện tại',
            dataIndex: 'current_version',
            key: 'version',
            render: (v: number) => <Tag color="blue">v{v}</Tag>,
        },
        {
            title: 'Trạng thái',
            dataIndex: 'status',
            key: 'status',
            render: (status: any) => <StatusBadge status={status} />,
        },
        {
            title: 'Khóa',
            dataIndex: 'locked',
            key: 'locked',
            render: (locked: boolean) => (
                locked ? <Tag color="orange">Đã khóa</Tag> : <Tag>Chưa khóa</Tag>
            ),
        },
        {
            title: 'Cập nhật',
            dataIndex: 'updated_at',
            key: 'updatedAt',
            render: (date: string) => new Date(date).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' }),
        },
        {
            title: 'Thao tác',
            key: 'actions',
            render: (_: any, record: Submission) => (
                <div className="space-x-2">
                    <Button
                        type="link"
                        size="small"
                        icon={<EyeOutlined />}
                        onClick={() => viewDetail(record)}
                    >
                        Chi tiết
                    </Button>
                    <Button
                        type="link"
                        size="small"
                        icon={<HistoryOutlined />}
                        onClick={() => viewVersions(record)}
                    >
                        Lịch sử
                    </Button>
                    {record.status === 'SUBMITTED' && (
                        <>
                            <Button
                                type="link"
                                size="small"
                                icon={<CheckOutlined />}
                                className="text-green-600 hover:text-green-700"
                                onClick={() => handleApprove(record.id)}
                                loading={approveMutation.isPending}
                            >
                                Duyệt
                            </Button>
                            <Button
                                type="link"
                                danger
                                size="small"
                                icon={<CloseOutlined />}
                                onClick={() => handleReject(record)}
                                loading={rejectMutation.isPending}
                            >
                                Yêu cầu sửa
                            </Button>
                        </>
                    )}
                </div>
            ),
        },
    ];

    const versionsColumns = [
        {
            title: 'Phiên bản',
            dataIndex: 'version',
            key: 'version',
            render: (v: number) => <Tag color="blue">v{v}</Tag>,
        },
        {
            title: 'Tên file',
            dataIndex: 'file_name',
            key: 'fileName',
            render: (name: string) => (
                <Space>
                    <DownloadOutlined className="text-blue-500" />
                    <span>{name}</span>
                </Space>
            )
        },
        {
            title: 'Kích thước',
            dataIndex: 'file_size',
            key: 'fileSize',
            render: (size: number) => formatFileSize(size),
        },
        {
            title: 'Ngày upload',
            dataIndex: 'uploaded_at',
            key: 'uploadedAt',
            render: (date: string) => new Date(date).toLocaleString('vi-VN'),
        },
        {
            title: 'Trạng thái',
            dataIndex: 'approved',
            key: 'approved',
            render: (approved: boolean) => (
                approved ? <Tag color="green">Đã duyệt</Tag> : <Tag>Chưa duyệt</Tag>
            ),
        },
        {
            title: 'Thao tác',
            key: 'actions',
            render: (_: any, record: any) => (
                <Button
                    type="link"
                    size="small"
                    icon={<DownloadOutlined />}
                    href={`${process.env.VITE_API_URL}/submissions/download/${record.id}`}
                    target="_blank"
                >
                    Tải xuống
                </Button>
            ),
        },
    ];

    if (isLoadingTopics) {
        return (
            <div className="flex justify-center items-center h-[calc(100vh-100px)]">
                <Spin size="large" tip="Đang tải danh sách đề tài..." />
            </div>
        );
    }

    if (topics.length === 0) {
        return (
            <div className="p-6">
                <Empty 
                    description="Bạn chưa có đề tài nào được phê duyệt để nhận file nộp." 
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                >
                    <Button type="primary" href="/supervisor/create-topic">Tạo đề tài mới</Button>
                </Empty>
            </div>
        );
    }

    return (
        <div className="p-6 space-y-6 animate-in fade-in duration-500">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-foreground">Duyệt file nộp</h1>
                    <p className="text-muted-foreground">
                        Xem xét và phê duyệt các file sinh viên nộp cho từng đề tài
                    </p>
                </div>
                
                <div className="w-full md:w-auto">
                    <span className="text-sm text-gray-500 mb-1 block">Chọn đề tài hướng dẫn:</span>
                    <Select 
                        className="w-full md:w-[400px]" 
                        placeholder="Chọn đề tài để xem file nộp"
                        value={selectedTopicId}
                        onChange={setSelectedTopicId}
                        showSearch
                        optionFilterProp="children"
                    >
                        {topics.map(t => (
                            <Option key={t.id} value={t.id}>
                                <Tag className="mr-1">{t.code}</Tag>
                                {t.title}
                            </Option>
                        ))}
                    </Select>
                </div>
            </div>

            {/* Info Card */}
            <Card className="bg-blue-50 border-blue-200">
                <div className="space-y-2">
                    <h3 className="font-semibold text-blue-900">Hướng dẫn duyệt file</h3>
                    <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
                        <li>Kiểm tra kỹ nội dung file trước khi phê duyệt</li>
                        <li>File được duyệt cho phép sinh viên tiếp tục nộp phiên bản mới</li>
                        <li>Cung cấp feedback cụ thể (ít nhất 20 ký tự) khi yêu cầu sửa đổi</li>
                    </ul>
                </div>
            </Card>

            {/* Submissions by Type */}
            <Card className="shadow-soft border-0">
                <Tabs activeKey={activeTab} onChange={(key) => setActiveTab(key as SubmissionType)}>
                    <TabPane 
                        tab={<span><HistoryOutlined />Đề cương</span>} 
                        key="PROPOSAL"
                    >
                        <Spin spinning={isLoadingSubmissions}>
                            <Table
                                columns={submissionsColumns}
                                dataSource={submissions || []}
                                rowKey="id"
                                pagination={{ pageSize: 5 }}
                                locale={{ emptyText: 'Chưa có file đề cương nào được nộp' }}
                            />
                        </Spin>
                    </TabPane>

                    <TabPane 
                        tab={<span><HistoryOutlined />Báo cáo</span>} 
                        key="REPORT"
                    >
                        <Spin spinning={isLoadingSubmissions}>
                            <Table
                                columns={submissionsColumns}
                                dataSource={submissions || []}
                                rowKey="id"
                                pagination={{ pageSize: 5 }}
                                locale={{ emptyText: 'Chưa có file báo cáo nào được nộp' }}
                            />
                        </Spin>
                    </TabPane>

                    <TabPane 
                        tab={<span><HistoryOutlined />Mã nguồn</span>} 
                        key="SOURCE_CODE"
                    >
                        <Spin spinning={isLoadingSubmissions}>
                            <Table
                                columns={submissionsColumns}
                                dataSource={submissions || []}
                                rowKey="id"
                                pagination={{ pageSize: 5 }}
                                locale={{ emptyText: 'Chưa có file mã nguồn nào được nộp' }}
                            />
                        </Spin>
                    </TabPane>

                    <TabPane 
                        tab={<span><HistoryOutlined />Slide</span>} 
                        key="SLIDES"
                    >
                        <Spin spinning={isLoadingSubmissions}>
                            <Table
                                columns={submissionsColumns}
                                dataSource={submissions || []}
                                rowKey="id"
                                pagination={{ pageSize: 5 }}
                                locale={{ emptyText: 'Chưa có file slide nào được nộp' }}
                            />
                        </Spin>
                    </TabPane>
                </Tabs>
            </Card>

            {/* Detail Modal */}
            <Modal
                title="Chi tiết file nộp"
                open={detailModalVisible}
                onCancel={() => setDetailModalVisible(false)}
                footer={[
                    <Button key="close" onClick={() => setDetailModalVisible(false)}>
                        Đóng
                    </Button>,
                    selectedSubmission?.status === 'SUBMITTED' && (
                        <Space key="actions">
                            <Button
                                type="primary"
                                icon={<CheckOutlined />}
                                onClick={() => {
                                    handleApprove(selectedSubmission.id);
                                    setDetailModalVisible(false);
                                }}
                                loading={approveMutation.isPending}
                            >
                                Phê duyệt
                            </Button>
                            <Button
                                danger
                                icon={<CloseOutlined />}
                                onClick={() => {
                                    setDetailModalVisible(false);
                                    handleReject(selectedSubmission);
                                }}
                            >
                                Yêu cầu sửa
                            </Button>
                        </Space>
                    ),
                ]}
                width={700}
            >
                {selectedSubmission && (
                    <Descriptions bordered column={1}>
                        <Descriptions.Item label="Nhóm/SV">
                            Nhóm {selectedSubmission.group_id.substring(0, 8)}
                        </Descriptions.Item>
                        <Descriptions.Item label="Loại file">
                            {activeTab === 'PROPOSAL' && 'Đề cương'}
                            {activeTab === 'REPORT' && 'Báo cáo'}
                            {activeTab === 'SOURCE_CODE' && 'Mã nguồn'}
                            {activeTab === 'SLIDES' && 'Slide thuyết trình'}
                        </Descriptions.Item>
                        <Descriptions.Item label="Phiên bản hiện tại">
                            <Tag color="blue">v{selectedSubmission.current_version}</Tag>
                        </Descriptions.Item>
                        <Descriptions.Item label="Trạng thái">
                            <StatusBadge status={selectedSubmission.status} />
                        </Descriptions.Item>
                        <Descriptions.Item label="Khóa">
                            {selectedSubmission.locked ? (
                                <Tag color="orange">Đã khóa bởi Trưởng BM</Tag>
                            ) : (
                                <Tag>Chưa khóa</Tag>
                            )}
                        </Descriptions.Item>
                        <Descriptions.Item label="Cập nhật lần cuối">
                            {new Date(selectedSubmission.updated_at).toLocaleString('vi-VN')}
                        </Descriptions.Item>
                    </Descriptions>
                )}
            </Modal>

            {/* Versions Modal */}
            <Modal
                title="Lịch sử phiên bản"
                open={versionsModalVisible}
                onCancel={() => setVersionsModalVisible(false)}
                footer={null}
                width={900}
            >
                <Table
                    columns={versionsColumns}
                    dataSource={versions || []}
                    rowKey="id"
                    pagination={false}
                />
            </Modal>

            {/* Reject Modal */}
            <Modal
                title="Yêu cầu chỉnh sửa file"
                open={rejectModalVisible}
                onOk={confirmReject}
                onCancel={() => {
                    setRejectModalVisible(false);
                    setSelectedSubmission(null);
                    setRejectionReason('');
                }}
                confirmLoading={rejectMutation.isPending}
                okText="Xác nhận"
                cancelText="Hủy"
                okButtonProps={{ 
                    danger: true, 
                    disabled: rejectionReason.trim().length < 20 
                }}
            >
                <div className="space-y-4 my-4">
                    <p>Nhập feedback cụ thể để sinh viên biết cần sửa những gì (Tối thiểu 20 ký tự):</p>
                    <TextArea
                        rows={5}
                        value={rejectionReason}
                        onChange={(e) => setRejectionReason(e.target.value)}
                        placeholder="Ví dụ: Phần tổng quan cần bổ sung thêm nghiên cứu liên quan. Mục tiêu chưa đủ cụ thể và đo lường được..."
                        required
                    />
                    {rejectionReason.trim().length > 0 && rejectionReason.trim().length < 20 && (
                        <p className="text-sm text-red-500">Cần thêm {20 - rejectionReason.trim().length} ký tự nữa</p>
                    )}
                </div>
            </Modal>
        </div>
    );
};

export default SupervisorReviewSubmissions;
