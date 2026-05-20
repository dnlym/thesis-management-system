import React, { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { ExtraPointsApi } from '@/api/extraPoints';
import { RegistrationsApi } from '@/api/registrations';
import { 
  Card, 
  Button, 
  Typography, 
  Tag, 
  Form, 
  Input, 
  Select, 
  Alert, 
  Upload, 
  Spin, 
  Result,
  Space,
  Divider,
  Row,
  Col,
  Checkbox,
  Modal,
  Table,
  Descriptions
} from 'antd';
import { notify } from '@/utils/notification';
import { getFileUrl } from '@/utils/file';
import { 
  UploadOutlined, 
  CheckCircleOutlined, 
  ClockCircleOutlined, 
  LinkOutlined, 
  InfoCircleOutlined,
  FileTextOutlined,
  TrophyOutlined,
  MinusCircleOutlined,
  EyeOutlined,
  DeleteOutlined
} from '@ant-design/icons';
import { 
  useExtraPoints, 
  useWithdrawExtraPoints 
} from '@/hooks/useExtraPoints';
import { ExtraPointsStatusBadge } from '@/components/StatusBadge';
import { ExtraPoints } from '@/types';

const { Text, Paragraph } = Typography;
const { Option } = Select;

const AWARD_CATEGORIES = [
    { label: 'Abstract Hội nghị khoa học', value: 'abstract', points: 0.5 },
    { label: 'Báo báo tạp chí TUH / GS, PGS', value: 'journal', points: 1.0 },
    { label: 'Giải thưởng NCKH / Eureka', value: 'award', points: 1.0 },
];

export default function ExtraPointsSubmission() {
    const [hasExtraPoints, setHasExtraPoints] = useState<string | null>(null);
    const [projectedPoints, setProjectedPoints] = useState<number>(0);
    const [evidenceType, setEvidenceType] = useState<'link' | 'file'>('link');
    const [uploading, setUploading] = useState(false);
    
    const [form] = Form.useForm();
    const [selectedRequest, setSelectedRequest] = useState<ExtraPoints | null>(null);
    const [detailModalVisible, setDetailModalVisible] = useState(false);

    const { data: myTopic, isLoading: loadingTopic } = useQuery({
        queryKey: ['myTopic'],
        queryFn: () => RegistrationsApi.getMyTopic(),
    });

    const { data: status, isLoading: loadingStatus, refetch: refetchStatus } = useQuery({
        queryKey: ['extraPointsStatus', myTopic?.topic?.id],
        queryFn: () => ExtraPointsApi.getMyStatus(myTopic!.topic!.id),
        enabled: !!myTopic?.topic?.id,
    });

    const { data: requests, isLoading: loadingRequests } = useExtraPoints({ 
        topicId: myTopic?.topic?.id 
    });

    const withdrawMutation = useWithdrawExtraPoints();

    const handleValuesChange = (changedValues: any) => {
        if (changedValues.achievementType) {
            const category = AWARD_CATEGORIES.find(c => c.value === changedValues.achievementType);
            setProjectedPoints(category?.points || 0);
        }
    };

    const handleFileUpload = async (options: any) => {
        const { file, onSuccess, onError } = options;
        try {
            setUploading(true);
            const result = await ExtraPointsApi.uploadEvidence(file);
            form.setFieldsValue({ evidenceUrl: result.url });
            notify.success('Upload minh chứng thành công!');
            onSuccess(result);
        } catch (err: any) {
            notify.error('Upload thất bại');
            onError(err);
        } finally {
            setUploading(false);
        }
    };

    const submitMutation = useMutation({
        mutationFn: (values: any) => {
            const category = AWARD_CATEGORIES.find(c => c.value === values.achievementType);
            const reason = `[${category?.label}] ${values.achievementTitle}${values.achievementOrganizer ? ` - ${values.achievementOrganizer}` : ''}`;
            
            // Extract URL string from potentially complex upload object
            let evidenceUrl = values.evidenceUrl;
            if (typeof evidenceUrl === 'object' && evidenceUrl !== null) {
                // Handle Ant Design upload object structure
                evidenceUrl = evidenceUrl.file?.response?.url || evidenceUrl.fileList?.[0]?.response?.url || '';
            }

            return ExtraPointsApi.create({
                topicId: myTopic!.topic!.id,
                reason: reason,
                pointsRequested: projectedPoints,
                evidenceUrl: evidenceUrl,
            });
        },
        onSuccess: () => {
            notify.success('Gửi yêu cầu thành công!');
            refetchStatus();
            form.resetFields();
            setHasExtraPoints(null);
        },
        onError: (error: any) => {
            notify.error(error.response?.data?.error || 'Có lỗi xảy ra');
        },
    });

    const handleWithdraw = (id: string) => {
        Modal.confirm({
            title: 'Xác nhận rút yêu cầu',
            content: 'Bạn có chắc chắn muốn rút yêu cầu cộng điểm này?',
            okText: 'Xác nhận',
            cancelText: 'Hủy',
            okButtonProps: { danger: true },
            onOk: () => {
                withdrawMutation.mutate(id, {
                    onSuccess: () => refetchStatus()
                });
            },
        });
    };

    const columns = [
        {
            title: 'Mô tả',
            dataIndex: 'reason',
            key: 'reason',
            ellipsis: true,
        },
        {
            title: 'Điểm',
            dataIndex: 'points_requested',
            key: 'points_requested',
            width: 100,
            render: (points: number) => `+${points.toFixed(2)}`,
        },
        {
            title: 'Trạng thái',
            dataIndex: 'status',
            key: 'status',
            width: 140,
            render: (status: any) => <ExtraPointsStatusBadge status={status} />,
        },
        {
            title: 'Thao tác',
            key: 'actions',
            width: 120,
            render: (_: any, record: ExtraPoints) => (
                <Space>
                    <Button 
                        type="link" 
                        size="small" 
                        icon={<EyeOutlined />}
                        onClick={() => {
                            setSelectedRequest(record);
                            setDetailModalVisible(true);
                        }}
                    >
                        Xem
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
                </Space>
            ),
        },
    ];


    const confirmNoPointsMutation = useMutation({
        mutationFn: () => ExtraPointsApi.confirmNoPoints(myTopic!.topic!.id),
        onSuccess: () => {
            notify.success('Đã xác nhận không có điểm cộng');
            refetchStatus();
        },
        onError: (error: any) => {
            notify.error(error.response?.data?.error || 'Có lỗi xảy ra');
        },
    });

    if (loadingTopic || loadingStatus) return <div className="flex justify-center p-20"><Spin size="large" /></div>;

    if (!myTopic?.topic) return <div className="max-w-2xl mx-auto p-8"><Result status="warning" title="Chưa đăng ký đề tài" /></div>;

    if (myTopic.midterm_status !== 'PASS') {
        return (
            <div className="page-container py-6">
                <div className="page-inner">
                    <Card className="page-header-card mb-6">
                        <div className="flex items-center gap-3">
                            <div className="page-header-icon"><FileTextOutlined className="text-base" /></div>
                            <div>
                                <div className="page-header-title">Xác nhận điểm cộng</div>
                                <div className="page-header-subtitle">Yêu cầu đạt điểm giữa kỳ để tiếp tục.</div>
                            </div>
                        </div>
                    </Card>
                    <Alert
                        message="Chưa đủ điều kiện"
                        description="Sinh viên cần đạt điểm giữa kỳ (PASS) trước khi có thể xác nhận điểm cộng."
                        type="info"
                        showIcon
                    />
                </div>
            </div>
        );
    }

    // Even if confirmed, allow submitting MORE if not finalized
    const isFinalized = myTopic?.topic?.status === 'FINALIZED';

    if (isFinalized) {
        return (
            <div className="page-container py-6">
                <div className="page-inner">
                    <Card className="page-header-card mb-6">
                        <div className="flex items-center gap-3">
                            <div className="page-header-icon text-amber-500"><ClockCircleOutlined className="text-base" /></div>
                            <div>
                                <div className="page-header-title">Giai đoạn đã kết thúc</div>
                                <div className="page-header-subtitle">Điểm số đã được chốt, không thể gửi thêm yêu cầu.</div>
                            </div>
                        </div>
                    </Card>
                    <Result
                        status="info"
                        title="Đã chốt điểm tổng kết"
                        subTitle="Hệ thống đã hoàn tất việc tính điểm cho đề tài này. Vui lòng liên hệ Văn phòng khoa nếu có thắc mắc."
                        extra={[
                            <Button type="primary" key="dash" onClick={() => window.location.href='/dashboard'}>Quay về Dashboard</Button>
                        ]}
                    />
                </div>
            </div>
        );
    }

    // If confirmed but NOT finalized, we can show a "Add more" option or just the form
    // Let's show the form but with a notice that they have already submitted before
    const hasExistingRequests = status?.hasRequest;

    return (
        <div className="page-container py-6">
            <div className="page-inner">
                {/* Header Section */}
                <Card className="page-header-card mb-6">
                    <div className="flex justify-between items-center">
                        <div className="flex items-center gap-3">
                            <div className="page-header-icon"><TrophyOutlined className="text-base" /></div>
                            <div>
                                <div className="page-header-title">Xác nhận điểm cộng</div>
                                <div className="page-header-subtitle">{(myTopic.topic as any).semester?.name} • Đề tài: {myTopic.topic.title}</div>
                            </div>
                        </div>
                    </div>
                </Card>

                <Row gutter={[16, 16]}>
                    <Col xs={24} lg={17}>
                        <div className="space-y-4">
                            {status?.confirmed && (
                                <Alert
                                    message="Bạn đã hoàn tất xác nhận điểm cộng"
                                    description={hasExistingRequests 
                                        ? "Bạn đã gửi yêu cầu cộng điểm trước đó. Tuy nhiên, bạn vẫn có thể gửi thêm các thành tích mới nếu có (Ví dụ: mới đạt giải thưởng hoặc bài báo mới được đăng)." 
                                        : "Bạn đã từng xác nhận không có điểm cộng. Nếu hiện tại bạn đã có thành tích mới, bạn vẫn có thể gửi yêu cầu tại đây."
                                    }
                                    type="success"
                                    showIcon
                                    className="rounded-xl border-green-100"
                                />
                            )}
                            {/* Choice Section */}
                            <Card className="shadow-soft border-0 rounded-xl" title={<Text strong>Trạng thái thành tích</Text>}>
                                <Paragraph className="text-gray-500 mb-6 text-sm">Bạn có sở hữu bất kỳ thành tích NCKH nào trong học kỳ này không?</Paragraph>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div 
                                        className={`choice-card ${hasExtraPoints === "true" ? "active" : ""}`}
                                        onClick={() => setHasExtraPoints("true")}
                                    >
                                        <div className="choice-icon blue"><TrophyOutlined /></div>
                                        <div className="choice-content">
                                            <div className="choice-title">Có thành tích</div>
                                            <div className="choice-desc">Tôi có bài báo, giải thưởng NCKH hợp lệ</div>
                                        </div>
                                        {hasExtraPoints === "true" && <CheckCircleOutlined className="check-icon" />}
                                    </div>

                                    <div 
                                        className={`choice-card red-theme ${hasExtraPoints === "false" ? "active" : ""}`}
                                        onClick={() => setHasExtraPoints("false")}
                                    >
                                        <div className="choice-icon red"><MinusCircleOutlined /></div>
                                        <div className="choice-content">
                                            <div className="choice-title">Không có</div>
                                            <div className="choice-desc">Tôi không có thành tích cần xác nhận</div>
                                        </div>
                                        {hasExtraPoints === "false" && <CheckCircleOutlined className="check-icon red" />}
                                    </div>
                                </div>
                            </Card>

                            {/* Form Section */}
                            {hasExtraPoints === "true" && (
                                <Card className="shadow-soft border-0 rounded-xl animate-fade-in" title={<Text strong>Chi tiết thành tích</Text>}>
                                    <Form form={form} layout="vertical" onFinish={(values) => submitMutation.mutate(values)} onValuesChange={handleValuesChange}>
                                        <Form.Item name="achievementType" label="Loại thành tích" rules={[{ required: true, message: 'Vui lòng chọn loại thành tích' }]}>
                                            <Select placeholder="Chọn loại thành tích của bạn">
                                                {AWARD_CATEGORIES.map(cat => <Option key={cat.value} value={cat.value}>{cat.label} (+{cat.points})</Option>)}
                                            </Select>
                                        </Form.Item>
                                        <Form.Item name="achievementTitle" label="Tên bài báo / Giải thưởng" rules={[{ required: true, message: 'Vui lòng nhập tên thành tích' }, { min: 50, message: 'Vui lòng nhập tối thiểu 50 ký tự' }]}>
                                            <Input.TextArea placeholder="Nhập tên chi tiết bài báo, hội nghị hoặc giải thưởng..." rows={3} />
                                        </Form.Item>

                                        <div className="flex items-center justify-between mt-4 mb-6 bg-gray-50 p-2 px-3 rounded-md border border-gray-100">
                                            <Space size="small">
                                                <TrophyOutlined className="text-blue-500" />
                                                <Text className="text-gray-600 text-[13px]">Điểm cộng dự kiến:</Text>
                                            </Space>
                                            <Tag color="blue" className="m-0 border-0 font-bold">+{projectedPoints} Điểm</Tag>
                                        </div>

                                        <Divider orientation="left" className="!my-4">
                                            <Text className="text-gray-400 text-[11px] uppercase tracking-wider">Minh chứng xác thực</Text>
                                        </Divider>
                                        
                                        <Form.Item required className="mb-4">
                                            <Space className="mb-3">
                                                <Button size="small" type={evidenceType === 'link' ? 'primary' : 'default'} onClick={() => setEvidenceType('link')} className="text-[12px] h-7 px-3">Đường dẫn URL</Button>
                                                <Button size="small" type={evidenceType === 'file' ? 'primary' : 'default'} onClick={() => setEvidenceType('file')} className="text-[12px] h-7 px-3">Tải tệp lên</Button>
                                            </Space>

                                            {evidenceType === 'link' ? (
                                                <Form.Item name="evidenceUrl" rules={[{ required: true, message: 'Vui lòng nhập link' }]}>
                                                    <Input prefix={<LinkOutlined className="text-gray-400" />} placeholder="Ví dụ: https://drive.google.com/..." />
                                                </Form.Item>
                                            ) : (
                                                <Form.Item name="evidenceUrl" rules={[{ required: true, message: 'Vui lòng tải tệp' }]}>
                                                    <Upload customRequest={handleFileUpload} maxCount={1} accept=".pdf,.png,.jpg,.jpeg">
                                                        <Button icon={<UploadOutlined />} loading={uploading} block className="rounded-md">Chọn tệp minh chứng</Button>
                                                    </Upload>
                                                </Form.Item>
                                            )}
                                        </Form.Item>

                                        <Form.Item name="commitment" valuePropName="checked" rules={[{ validator: (_, v) => v ? Promise.resolve() : Promise.reject('Vui lòng xác nhận') }]}>
                                            <Checkbox className="text-gray-500 text-[11px]">Tôi cam đoan thông tin trên là chính xác và chịu hoàn toàn trách nhiệm.</Checkbox>
                                        </Form.Item>

                                        <Button type="primary" htmlType="submit" block size="large" loading={submitMutation.isPending} className="h-11 rounded-lg font-bold mt-2 shadow-blue">
                                            Gửi yêu cầu xác nhận
                                        </Button>
                                    </Form>
                                </Card>
                            )}

                            {hasExtraPoints === "false" && (
                                <Card className="shadow-soft border-0 rounded-xl bg-red-50 animate-fade-in">
                                    <div className="flex items-start gap-4">
                                        <InfoCircleOutlined className="text-red-500 text-lg mt-1" />
                                        <div className="flex-1">
                                            <div className="font-bold text-red-700 text-base mb-1">Xác nhận quan trọng</div>
                                            <Paragraph className="text-red-600 mb-6 text-xs">Bạn khẳng định mình không có thành tích NCKH nào cần cộng điểm. Thao tác này không thể hoàn tác.</Paragraph>
                                            <Button danger type="primary" block size="large" className="h-11 rounded-lg font-bold shadow-red" onClick={() => confirmNoPointsMutation.mutate()} loading={confirmNoPointsMutation.isPending}>
                                                Tôi xác nhận không có điểm cộng
                                            </Button>
                                        </div>
                                    </div>
                                </Card>
                            )}
                        </div>
                    </Col>

                    <Col xs={24} lg={7}>
                        <div className="sticky top-6 space-y-4">
                            <Card className="shadow-soft border-0 rounded-xl" title={<Space><InfoCircleOutlined className="text-blue-500" /> Quy định</Space>}>
                                <div className="space-y-3">
                                    {AWARD_CATEGORIES.map(cat => (
                                        <div key={cat.value} className="flex justify-between items-center">
                                            <Text className="text-gray-600 text-[13px]">{cat.label}</Text>
                                            <Tag color="blue" className="m-0 font-bold">+{cat.points}</Tag>
                                        </div>
                                    ))}
                                    <Divider className="my-2" />
                                    <Text className="text-gray-400 text-[11px] italic">Tối đa cộng 2.0 điểm cho học kỳ hiện tại.</Text>
                                </div>
                            </Card>
                        </div>
                    </Col>
                </Row>

                {/* History Table Section */}
                <Card 
                    className="shadow-soft border-0 rounded-xl mt-6" 
                    title={<Space><FileTextOutlined className="text-blue-500" /> Lịch sử yêu cầu đã gửi</Space>}
                >
                    <Table
                        columns={columns}
                        dataSource={requests || []}
                        rowKey="id"
                        pagination={false}
                        loading={loadingRequests}
                        locale={{ emptyText: 'Bạn chưa có yêu cầu cộng điểm nào' }}
                        className="extra-points-history-table"
                    />
                </Card>

                {/* Detail Modal */}
                <Modal
                    title={<Space><InfoCircleOutlined className="text-blue-500" /> Chi tiết yêu cầu</Space>}
                    open={detailModalVisible}
                    onCancel={() => setDetailModalVisible(false)}
                    footer={[
                        <Button key="close" type="primary" onClick={() => setDetailModalVisible(false)}>
                            Đóng
                        </Button>,
                    ]}
                    width={650}
                    className="rounded-modal"
                >
                    {selectedRequest && (
                        <div className="space-y-6 py-2">
                            <div className="flex justify-between items-start">
                                <div>
                                    <Text type="secondary" className="text-[11px] uppercase font-bold tracking-wider block mb-1">Mô tả thành tích</Text>
                                    <div className="text-base font-semibold text-gray-800">{selectedRequest.reason}</div>
                                </div>
                                <ExtraPointsStatusBadge status={selectedRequest.status} />
                            </div>

                            <Row gutter={24}>
                                <Col span={12}>
                                    <Text type="secondary" className="text-[11px] uppercase font-bold tracking-wider block mb-1">Điểm đề xuất</Text>
                                    <div className="text-lg font-black text-blue-600">+{selectedRequest.points_requested?.toFixed(2)} đ</div>
                                </Col>
                                <Col span={12}>
                                    <Text type="secondary" className="text-[11px] uppercase font-bold tracking-wider block mb-1">Điểm phê duyệt</Text>
                                    {selectedRequest.status === 'APPROVED' ? (
                                        <div className="text-lg font-black text-green-600">+{selectedRequest.points_requested?.toFixed(2)} đ</div>
                                    ) : (
                                        <div className="text-lg font-bold text-gray-300">--</div>
                                    )}
                                </Col>
                            </Row>

                            <Divider className="my-0" />

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Text type="secondary" className="text-[11px] uppercase font-bold tracking-wider block mb-1">Ngày gửi</Text>
                                    <div className="text-sm">{new Date(selectedRequest.created_at).toLocaleString('vi-VN')}</div>
                                </div>
                                {selectedRequest.reviewed_at && (
                                    <div>
                                        <Text type="secondary" className="text-[11px] uppercase font-bold tracking-wider block mb-1">Ngày duyệt</Text>
                                        <div className="text-sm">{new Date(selectedRequest.reviewed_at).toLocaleString('vi-VN')}</div>
                                    </div>
                                )}
                            </div>

                            {selectedRequest.rejection_reason && (
                                <div className="bg-red-50 border border-red-100 p-3 rounded-lg">
                                    <Text className="text-red-700 font-bold text-xs block mb-1">Lý do từ chối:</Text>
                                    <div className="text-red-600 text-sm">{selectedRequest.rejection_reason}</div>
                                </div>
                            )}

                            {selectedRequest.evidence_url && (
                                <div className="bg-gray-50 border border-gray-100 p-4 rounded-xl">
                                    <Text type="secondary" className="text-[11px] uppercase font-bold tracking-wider block mb-2">Minh chứng đính kèm</Text>
                                    <a 
                                        href={getFileUrl(selectedRequest.evidence_url)} 
                                        target="_blank" 
                                        rel="noopener noreferrer"
                                        className="flex items-center gap-2 p-3 bg-white border border-gray-200 rounded-lg hover:border-blue-300 hover:text-blue-600 transition-all group"
                                    >
                                        <LinkOutlined className="text-blue-500" />
                                        <span className="flex-1 truncate text-sm font-medium">Xem tài liệu minh chứng</span>
                                        <EyeOutlined className="text-gray-300 group-hover:text-blue-500" />
                                    </a>
                                </div>
                            )}
                        </div>
                    )}
                </Modal>
            </div>

            <style dangerouslySetInnerHTML={{ __html: `
                .choice-card {
                    display: flex; align-items: center; gap: 12px; padding: 14px; border: 2px solid #f0f0f0;
                    border-radius: 10px; cursor: pointer; transition: all 0.2s; position: relative; background: white;
                }
                .choice-card:hover { border-color: #d1e9ff; background: #fafcfe; }
                .choice-card.active { border-color: #1890ff; background: #f0f7ff; }
                .choice-card.red-theme.active { border-color: #ff4d4f; background: #fff1f0; }
                .choice-icon { width: 38px; height: 38px; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 18px; flex-shrink: 0; }
                .choice-icon.blue { background: #e6f7ff; color: #1890ff; }
                .choice-icon.red { background: #fff1f0; color: #ff4d4f; }
                .choice-title { font-weight: 700; color: #262626; font-size: 14px; }
                .choice-desc { color: #8c8c8c; font-size: 11px; line-height: 1.2; }
                .check-icon { position: absolute; top: 10px; right: 10px; font-size: 16px; color: #1890ff; }
                .check-icon.red { color: #ff4d4f; }
                .animate-fade-in { animation: fadeIn 0.3s ease-out; }
                @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
                .shadow-blue { box-shadow: 0 4px 10px rgba(24, 144, 255, 0.2); }
                .shadow-red { box-shadow: 0 4px 10px rgba(255, 77, 79, 0.2); }
                .ant-card-head-title { font-size: 14px !important; font-weight: 700 !important; }
                .ant-input, .ant-select-selector, .ant-btn { border-radius: 6px !important; }
                .ant-card { border-radius: 10px !important; }
                .extra-points-history-table .ant-table-thead > tr > th { background: #f8fafc; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; }
            `}} />
        </div>
    );
}
