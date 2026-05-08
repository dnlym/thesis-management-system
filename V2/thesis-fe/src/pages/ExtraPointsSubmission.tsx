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
  Checkbox
} from 'antd';
import { notify } from '@/utils/notification';
import { 
  UploadOutlined, 
  CheckCircleOutlined, 
  ClockCircleOutlined, 
  LinkOutlined, 
  InfoCircleOutlined,
  FileTextOutlined,
  TrophyOutlined,
  MinusCircleOutlined
} from '@ant-design/icons';

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

    const { data: myTopic, isLoading: loadingTopic } = useQuery({
        queryKey: ['myTopic'],
        queryFn: () => RegistrationsApi.getMyTopic(),
    });

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
            return ExtraPointsApi.create({
                topicId: myTopic!.topic!.id,
                reason: reason,
                pointsRequested: projectedPoints,
                evidenceUrl: values.evidenceUrl,
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
                                <div className="page-header-title">Xác nhận Điểm cộng NCKH</div>
                                <div className="page-header-subtitle">Yêu cầu đạt điểm giữa kỳ để tiếp tục.</div>
                            </div>
                        </div>
                    </Card>
                    <Alert
                        message="Chưa đủ điều kiện"
                        description="Sinh viên cần đạt điểm giữa kỳ (PASS) trước khi có thể xác nhận điểm cộng NCKH."
                        type="info"
                        showIcon
                    />
                </div>
            </div>
        );
    }

    if (status?.confirmed) {
        return (
            <div className="page-container py-6">
                <div className="page-inner">
                    <Card className="page-header-card mb-6">
                        <div className="flex items-center gap-3">
                            <div className="page-header-icon text-green-500"><CheckCircleOutlined className="text-base" /></div>
                            <div>
                                <div className="page-header-title">Hoàn tất xác nhận</div>
                                <div className="page-header-subtitle">Trạng thái điểm cộng của bạn đã được lưu lại.</div>
                            </div>
                        </div>
                    </Card>
                    <Card className="shadow-soft border-0 rounded-xl">
                        <Result
                            status="success"
                            title="Đã xác nhận thành công"
                            subTitle={status.hasRequest ? `Yêu cầu: ${status.request?.reason}` : 'Bạn đã xác nhận không có điểm cộng cho học kỳ này.'}
                            extra={[
                                <Button type="primary" key="dash" onClick={() => window.location.href='/dashboard'}>Quay về Dashboard</Button>
                            ]}
                        />
                    </Card>
                </div>
            </div>
        );
    }

    return (
        <div className="page-container py-6">
            <div className="page-inner">
                {/* Header Section */}
                <Card className="page-header-card mb-6">
                    <div className="flex justify-between items-center">
                        <div className="flex items-center gap-3">
                            <div className="page-header-icon"><TrophyOutlined className="text-base" /></div>
                            <div>
                                <div className="page-header-title">Xác nhận Điểm cộng NCKH</div>
                                <div className="page-header-subtitle">Học kỳ 2023-2024 • Đề tài: {myTopic.topic.title}</div>
                            </div>
                        </div>
                    </div>
                </Card>

                <Row gutter={[16, 16]}>
                    <Col xs={24} lg={17}>
                        <div className="space-y-4">
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
            `}} />
        </div>
    );
}
