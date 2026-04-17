import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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
  Radio, 
  Checkbox, 
  Alert, 
  Upload, 
  message, 
  Spin, 
  Result,
  Space,
  Divider,
  Badge,
  Row,
  Col
} from 'antd';
import { 
  UploadOutlined, 
  CheckCircleOutlined, 
  ClockCircleOutlined, 
  LinkOutlined, 
  InfoCircleOutlined,
  CloseCircleOutlined,
  FileTextOutlined
} from '@ant-design/icons';

const { Title, Text, Paragraph } = Typography;
const { Option } = Select;

const AWARD_CATEGORIES = [
    { label: 'Abstract Hội nghị khoa học', value: 'abstract', points: 0.5 },
    { label: 'Báo báo tạp chí TUH / danh mục GS, PGS', value: 'journal', points: 1.0 },
    { label: 'Giải thưởng NCKH / Eureka / Đề tài cấp trường', value: 'award', points: 1.0 },
];

export default function ExtraPointsSubmission() {
    const [hasExtraPoints, setHasExtraPoints] = useState<string | null>(null);
    const [projectedPoints, setProjectedPoints] = useState<number>(0);
    const [evidenceType, setEvidenceType] = useState<'link' | 'file'>('link');
    const [uploading, setUploading] = useState(false);
    
    const [form] = Form.useForm();
    const queryClient = useQueryClient();

    // Get student's current topic registration
    const { data: myTopic, isLoading: loadingTopic } = useQuery({
        queryKey: ['myTopic'],
        queryFn: () => RegistrationsApi.getMyTopic(),
    });

    // Get extra points status
    const { data: status, isLoading: loadingStatus, refetch: refetchStatus } = useQuery({
        queryKey: ['extraPointsStatus', myTopic?.topic?.id],
        queryFn: () => ExtraPointsApi.getMyStatus(myTopic!.topic!.id),
        enabled: !!myTopic?.topic?.id,
    });

    const handleValuesChange = (changedValues: any) => {
        if (changedValues.achievementType) {
            const category = AWARD_CATEGORIES.find(c => c.value === changedValues.achievementType);
            setProjectedPoints(category?.points || 0);
        }
    };

    const handleFileUpload = async (options: any) => {
        const { file, onSuccess, onError } = options;
        
        // 1. Check file size (5MB limit)
        const isLt5M = file.size / 1024 / 1024 < 5;
        if (!isLt5M) {
            message.error('File phải nhỏ hơn 5MB!');
            onError(new Error('File too large'));
            return;
        }

        // 2. Check file type (sync with backend)
        const allowedTypes = [
            'application/pdf', 
            'image/jpeg', 
            'image/png',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        ];
        if (!allowedTypes.includes(file.type)) {
            message.error('Chỉ hỗ trợ file PDF, Ảnh (JPEG/PNG) hoặc Word (.doc, .docx)');
            onError(new Error('Invalid file type'));
            return;
        }

        try {
            setUploading(true);
            const result = await ExtraPointsApi.uploadEvidence(file);
            form.setFieldsValue({ evidenceUrl: result.url });
            message.success('Upload minh chứng thành công!');
            onSuccess(result);
        } catch (err: any) {
            message.error('Upload thất bại: ' + (err.response?.data?.error || err.message));
            onError(err);
        } finally {
            setUploading(false);
        }
    };

    // Submit extra points request
    const submitMutation = useMutation({
        mutationFn: (values: any) => {
            const category = AWARD_CATEGORIES.find(c => c.value === values.achievementType);
            const reason = `[${category?.label}] ${values.achievementTitle}${values.achievementOrganizer ? ` - ${values.achievementOrganizer}` : ''}`;

            return ExtraPointsApi.create({
                topicId: myTopic!.topic!.id,
                reason: reason,
                pointsRequested: projectedPoints,
                evidenceUrl: values.evidenceUrl,
            });
        },
        onSuccess: () => {
            message.success('Đã gửi yêu cầu điểm cộng NCKH!');
            refetchStatus();
            form.resetFields();
            setHasExtraPoints(null);
            setProjectedPoints(0);
        },
        onError: (error: any) => {
            message.error(error.response?.data?.error || 'Có lỗi xảy ra');
        },
    });

    // Confirm no extra points
    const confirmNoPointsMutation = useMutation({
        mutationFn: () => ExtraPointsApi.confirmNoPoints(myTopic!.topic!.id),
        onSuccess: () => {
            message.success('Đã xác nhận không có điểm cộng NCKH');
            refetchStatus();
        },
        onError: (error: any) => {
            message.error(error.response?.data?.error || 'Có lỗi xảy ra');
        },
    });

    if (loadingTopic || loadingStatus) {
        return (
            <div className="flex justify-center items-center h-[calc(100vh-100px)]">
                <Spin size="large" />
            </div>
        );
    }

    if (!myTopic?.topic) {
        return (
            <div className="max-w-2xl mx-auto p-8 mt-10">
                <Alert
                    message="Bạn chưa đăng ký đề tài"
                    description="Vui lòng đăng ký đề tài trước khi xác nhận điểm cộng NCKH"
                    type="warning"
                    showIcon
                    className="shadow-soft"
                />
            </div>
        );
    }

    // Check midterm status
    if (myTopic.midterm_status !== 'PASS') {
        return (
            <div className="max-w-4xl mx-auto p-6 space-y-6">
                <Alert
                    message="Chưa đủ điều kiện"
                    description="Sinh viên cần đạt điểm giữa kỳ (PASS) trước khi có thể xác nhận điểm cộng NCKH."
                    type="info"
                    showIcon
                />
            </div>
        );
    }

    // Already confirmed
    if (status?.confirmed) {
        return (
            <Result
                status="success"
                title="Đã xác nhận thành công"
                subTitle={status.hasRequest
                    ? `Yêu cầu điểm cộng của bạn đã được ghi nhận (${status.request?.status === 'APPROVED' ? 'Đã duyệt' : 'Đang chờ'})`
                    : 'Bạn đã xác nhận không có điểm cộng NCKH cho học kỳ này.'
                }
            />
        );
    }

    // Has pending request
    if (status?.hasRequest && status.request?.status === 'PENDING') {
        return (
            <div className="max-w-2xl mx-auto p-6 mt-10">
                <Card className="shadow-soft text-center" title={<Space><ClockCircleOutlined className="text-orange-500" />Đang chờ phê duyệt</Space>}>
                    <Text type="secondary" style={{ display: 'block' }} className="mb-4">Yêu cầu điểm cộng NCKH của bạn đang được xử lý.</Text>
                    <div className="p-4 bg-gray-50 rounded-lg border text-left mb-4">
                        <div className="flex justify-between items-center mb-2">
                            <Text strong>Điểm yêu cầu:</Text>
                            <Tag color="orange">{status.request.points_requested} điểm</Tag>
                        </div>
                        <Paragraph italic type="secondary">"{status.request.reason}"</Paragraph>
                    </div>
                    <Alert
                        message="Thông báo"
                        description="Trưởng bộ môn sẽ xem xét và phản hồi sớm nhất có thể."
                        type="info"
                        showIcon
                    />
                </Card>
            </div>
        );
    }

    return (
        <div className="max-w-3xl mx-auto p-6 space-y-8 animate-in fade-in duration-500">
            <div className="text-center md:text-left">
                <Title level={2}>Xác nhận Điểm cộng NCKH</Title>
                <Text type="secondary">Cung cấp bằng chứng về thành tích nghiên cứu để nhận ưu tiên điểm số.</Text>
            </div>

            <Card 
                className="bg-blue-600 text-white border-0 shadow-soft" 
                title={<span className="text-white">Quy định điểm cộng</span>}
            >
                <Row gutter={[16, 16]}>
                    <Col xs={24} md={12}>
                        <ul className="list-disc list-inside space-y-1 opacity-90 text-sm">
                            <li>Abstract Hội nghị: <Text strong className="text-white">0.5 điểm</Text></li>
                            <li>Báo cáo tạp chí TUH: <Text strong className="text-white">1.0 điểm</Text></li>
                        </ul>
                    </Col>
                    <Col xs={24} md={12}>
                        <ul className="list-disc list-inside space-y-1 opacity-90 text-sm">
                            <li>Giải thưởng NCKH/Eureka: <Text strong className="text-white">1.0 điểm</Text></li>
                            <li>Tối đa tích lũy: <Text strong className="text-white">2.0 điểm</Text></li>
                        </ul>
                    </Col>
                </Row>
                <Divider className="border-white/20 my-3" />
                <Text italic className="text-white/80 text-xs">Xác nhận đề tài: <Text underline className="text-white">{myTopic.topic.title}</Text></Text>
            </Card>

            <Card title="Xác nhận thành tích" className="shadow-soft border-0">
                <Paragraph>Bạn có sở hữu bất kỳ thành tích NCKH nào trong học kỳ này không?</Paragraph>
                
                <Radio.Group 
                    value={hasExtraPoints} 
                    onChange={(e) => setHasExtraPoints(e.target.value)}
                    className="w-full flex gap-4"
                >
                    <Radio.Button value="true" className="flex-1 h-20 flex flex-col items-center justify-center gap-1">
                        <CheckCircleOutlined className="text-xl" />
                        <span>Có thành tích</span>
                    </Radio.Button>
                    <Radio.Button value="false" className="flex-1 h-20 flex flex-col items-center justify-center gap-1">
                        <CloseCircleOutlined className="text-xl" />
                        <span>Không có</span>
                    </Radio.Button>
                </Radio.Group>

                {hasExtraPoints === "true" && (
                    <div className="mt-8">
                        <Form 
                            form={form} 
                            layout="vertical" 
                            onFinish={(values) => submitMutation.mutate(values)}
                            onValuesChange={handleValuesChange}
                        >
                            <Form.Item 
                                name="achievementType" 
                                label="Loại thành tích" 
                                rules={[{ required: true, message: 'Vui lòng chọn loại thành tích' }]}
                            >
                                <Select placeholder="Chọn loại thành tích của bạn">
                                    {AWARD_CATEGORIES.map(cat => (
                                        <Option key={cat.value} value={cat.value}>
                                            {cat.label} (+{cat.points})
                                        </Option>
                                    ))}
                                </Select>
                            </Form.Item>

                             <Form.Item 
                                name="achievementTitle" 
                                label="Tên thành tích / Bài báo / Giải thưởng" 
                                rules={[
                                    { required: true, message: 'Vui lòng nhập tên thành tích' },
                                    { min: 50, message: 'Tên thành tích/Lý do phải ít nhất 50 ký tự' }
                                ]}
                            >
                                <Input.TextArea 
                                    placeholder="Ví dụ: Giải Nhì NCKH Cấp Trường 2025 - Bài báo nghiên cứu về AI trong y tế (Vui lòng mô tả chi tiết để được duyệt)" 
                                    rows={3} 
                                />
                            </Form.Item>

                            <Form.Item 
                                name="achievementOrganizer" 
                                label="Đơn vị tổ chức / Tạp chí (Không bắt buộc)"
                            >
                                <Input placeholder="Ví dụ: Đại học Công nghiệp TP.HCM" />
                            </Form.Item>

                            <div className="p-4 bg-blue-50 border border-blue-100 rounded-lg flex items-center justify-between mb-6">
                                <Space>
                                    <InfoCircleOutlined className="text-blue-500" />
                                    <Text strong>Điểm cộng dự kiến:</Text>
                                </Space>
                                <Badge count={`${projectedPoints} điểm`} style={{ backgroundColor: '#1890ff', fontSize: '14px', padding: '0 10px' }} />
                            </div>

                            <Form.Item label="Minh chứng (Bắt buộc)" required>
                                <Radio.Group 
                                    value={evidenceType} 
                                    onChange={(e) => setEvidenceType(e.target.value)}
                                    className="mb-3"
                                >
                                    <Radio value="link">Link trực tuyến</Radio>
                                    <Radio value="file">Tải lên tệp</Radio>
                                </Radio.Group>

                                {evidenceType === 'link' ? (
                                    <Form.Item 
                                        name="evidenceUrl" 
                                        rules={[{ required: true, message: 'Vui lòng cung cấp minh chứng' }]}
                                    >
                                        <Input prefix={<LinkOutlined className="text-gray-400" />} placeholder="https://drive.google.com/..." />
                                    </Form.Item>
                                ) : (
                                    <Form.Item 
                                        name="evidenceUrl" 
                                        rules={[{ required: true, message: 'Vui lòng tải lên minh chứng' }]}
                                    >
                                        <Upload 
                                            customRequest={handleFileUpload}
                                            maxCount={1}
                                            accept=".pdf,.png,.jpg,.jpeg"
                                            showUploadList={true}
                                        >
                                            <Button icon={<UploadOutlined />} loading={uploading}>Chọn tệp minh chứng</Button>
                                        </Upload>
                                    </Form.Item>
                                )}
                            </Form.Item>

                            <Form.Item 
                                name="commitment" 
                                valuePropName="checked"
                                rules={[{ 
                                    validator: (_, value) => 
                                        value ? Promise.resolve() : Promise.reject(new Error('Bạn phải cam kết thông tin cung cấp là đúng sự thật')) 
                                }]}
                            >
                                <Checkbox>Tôi cam kết thông tin và minh chứng cung cấp là đúng sự thật.</Checkbox>
                            </Form.Item>

                            <Button 
                                type="primary" 
                                htmlType="submit" 
                                block 
                                size="large" 
                                loading={submitMutation.isPending}
                                className="h-12 text-lg"
                            >
                                Gửi yêu cầu xác nhận
                            </Button>
                        </Form>
                    </div>
                )}

                {hasExtraPoints === "false" && (
                    <div className="mt-8 space-y-6">
                        <Alert
                            message="Xác nhận không có thành tích"
                            description="Sau khi xác nhận, bạn sẽ không thể thay đổi thông tin này. Vui lòng kiểm tra kỹ trước khi nhấn nút xác nhận bên dưới."
                            type="error"
                            showIcon
                        />
                        <Button 
                            danger 
                            type="primary" 
                            block 
                            size="large" 
                            className="h-12 text-lg"
                            onClick={() => confirmNoPointsMutation.mutate()}
                            loading={confirmNoPointsMutation.isPending}
                        >
                            Tôi xác nhận không có điểm cộng
                        </Button>
                    </div>
                )}
            </Card>
        </div>
    );
}
