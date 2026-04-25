import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Card, Form, Input, InputNumber, Button, Spin, Alert, Modal } from 'antd';
import { notify } from '@/utils/notification';
import { SaveOutlined, ArrowLeftOutlined } from '@ant-design/icons';
import { RichTextEditor } from '@/components/RichTextEditor';
import { useTopic, useUpdateTopic } from '@/hooks/useTopics';

const EditTopic = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [form] = Form.useForm();
    const [description, setDescription] = useState('');
    const [objectives, setObjectives] = useState('');
    const [requirements, setRequirements] = useState('');

    const { data: topic, isLoading, error } = useTopic(id || '');
    const updateMutation = useUpdateTopic();

    // Populate form when topic data loads
    useEffect(() => {
        if (topic) {
            form.setFieldsValue({
                title: topic.title,
                maxStudents: topic.max_students,
            });
            setDescription(topic.description || '');
            setObjectives(topic.objectives || '');
            setRequirements(topic.requirements || '');
        }
    }, [topic, form]);

    // Check if topic can be edited (only DRAFT or REQUIRES_REVISION status)
    const canEdit = topic && (topic.status === 'DRAFT' || topic.status === 'REQUIRES_REVISION');

    const handleSubmit = async () => {
        try {
            const values = await form.validateFields();

            if (!id) return;

            updateMutation.mutate(
                {
                    id,
                    data: {
                        title: values.title,
                        description,
                        objectives,
                        requirements,
                        maxStudents: values.maxStudents,
                    },
                },
                {
                    onSuccess: () => {
                        notify.success('Cập nhật đề tài thành công');
                        navigate(`/topics/${id}`);
                    },
                    onError: (error: any) => {
                        const errorMsg = error?.response?.data?.message || error?.response?.data?.error || error?.message || 'Lỗi khi cập nhật đề tài';
                        Modal.error({
                            title: 'Lỗi cập nhật',
                            content: errorMsg,
                            okText: 'Đóng',
                        });
                    }
                }
            );
        } catch (error) {
            console.error('Validation failed:', error);
        }
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-96">
                <Spin size="large" />
            </div>
        );
    }

    if (error || !topic) {
        return (
            <div className="p-6">
                <Alert
                    type="error"
                    message="Không tìm thấy đề tài"
                    description="Đề tài không tồn tại hoặc bạn không có quyền truy cập."
                    showIcon
                />
                <Button className="mt-4" onClick={() => navigate('/topics')}>
                    Quay lại danh sách
                </Button>
            </div>
        );
    }

    if (!canEdit) {
        return (
            <div className="p-6">
                <Alert
                    type="warning"
                    message="Không thể chỉnh sửa"
                    description={`Đề tài ở trạng thái "${topic.status}" không thể chỉnh sửa. Chỉ đề tài DRAFT hoặc YÊU CẦU SỬA mới có thể chỉnh sửa.`}
                    showIcon
                />
                <Button className="mt-4" onClick={() => navigate(`/topics/${id}`)}>
                    Quay lại chi tiết
                </Button>
            </div>
        );
    }

    return (
        <div className="page-container">
            <div className="page-inner">
                {/* Header */}
                <Card className="page-header-card">
                    <div className="flex items-center gap-3">
                        <div className="page-header-icon"><ArrowLeftOutlined className="text-base" onClick={() => navigate(`/topics/${id}`)} style={{ cursor: 'pointer' }} /></div>
                        <div>
                            <div className="page-header-title">Chỉnh sửa đề tài</div>
                            <div className="page-header-subtitle">Cập nhật thông tin chi tiết cho đề tài khóa luận</div>
                        </div>
                    </div>
                </Card>

            {topic.status === 'REQUIRES_REVISION' && (
                <Alert
                    type="info"
                    message="Yêu cầu chỉnh sửa từ Trưởng bộ môn"
                    description="Vui lòng chỉnh sửa đề tài theo yêu cầu và gửi lại để phê duyệt."
                    showIcon
                />
            )}

            <Card className="shadow-soft">
                <Form
                    form={form}
                    layout="vertical"
                    size="large"
                >
                    <Form.Item
                        label="Tên đề tài"
                        name="title"
                        rules={[
                            { required: true, message: 'Vui lòng nhập tên đề tài' },
                            { min: 10, message: 'Tên đề tài phải có ít nhất 10 ký tự' },
                        ]}
                    >
                        <Input placeholder="Nhập tên đề tài..." />
                    </Form.Item>

                    <Form.Item
                        label="Số lượng sinh viên tối đa"
                        name="maxStudents"
                        rules={[
                            { required: true, message: 'Vui lòng nhập số SV' },
                            { type: 'number', min: 1, message: 'Tối thiểu 1 sinh viên' }
                        ]}
                        tooltip="Mặc định là 2. Nếu số lượng > 2, đề tài có thể có nhiều nhóm đăng ký (mỗi nhóm tối đa 2 SV)."
                    >
                        <InputNumber
                            min={1}
                            className="w-full"
                            placeholder="Nhập số lượng SV..."
                        />
                    </Form.Item>

                    <div className="mb-6">
                        <label className="block mb-2 font-medium text-base">
                            Mô tả đề tài <span className="text-red-500">*</span>
                        </label>
                        <RichTextEditor
                            value={description}
                            onChange={setDescription}
                            placeholder="Mô tả tổng quan về đề tài..."
                            minHeight="200px"
                        />
                    </div>

                    <div className="mb-6">
                        <label className="block mb-2 font-medium text-base">
                            Mục tiêu
                        </label>
                        <RichTextEditor
                            value={objectives}
                            onChange={setObjectives}
                            placeholder="Các mục tiêu cụ thể cần đạt được..."
                            minHeight="150px"
                        />
                    </div>

                    <div className="mb-6">
                        <label className="block mb-2 font-medium text-base">
                            Yêu cầu sinh viên
                        </label>
                        <RichTextEditor
                            value={requirements}
                            onChange={setRequirements}
                            placeholder="Kiến thức, kỹ năng cần có..."
                            minHeight="150px"
                        />
                    </div>

                    <div className="flex justify-end space-x-3 pt-6 border-t">
                        <Button onClick={() => navigate(`/topics/${id}`)}>
                            Hủy
                        </Button>
                        <Button
                            type="primary"
                            icon={<SaveOutlined />}
                            onClick={handleSubmit}
                            loading={updateMutation.isPending}
                            disabled={!description}
                        >
                            Lưu thay đổi
                        </Button>
                    </div>
                </Form>
            </Card>
            </div>
        </div>
    );
};

export default EditTopic;
