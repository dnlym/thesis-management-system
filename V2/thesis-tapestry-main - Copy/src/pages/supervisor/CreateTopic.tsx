import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Form, Input, InputNumber, Button, message, Divider, Alert, Modal } from 'antd';
import { SaveOutlined, SendOutlined, ArrowLeftOutlined } from '@ant-design/icons';
import { RichTextEditor } from '@/components/RichTextEditor';
import { useCreateTopic } from '@/hooks/useTopics';
import { useSemesters } from '@/hooks/useSemesters';
import type { TopicForm } from '@/types';

const SupervisorCreateTopic = () => {
    const navigate = useNavigate();
    const [form] = Form.useForm();
    const [description, setDescription] = useState('');
    const [objectives, setObjectives] = useState('');
    const [requirements, setRequirements] = useState('');

    const { data: semesters } = useSemesters();
    const createMutation = useCreateTopic();

    const handleSubmit = async (isDraft = false) => {
        try {
            const values = await form.validateFields();

            // Client-side validation for rich text fields
            if (description.length < 100) {
                message.error('Mô tả phải có ít nhất 100 ký tự');
                return;
            }
            if (objectives.length < 50) {
                message.error('Mục tiêu phải có ít nhất 50 ký tự');
                return;
            }
            if (requirements.length < 50) {
                message.error('Yêu cầu phải có ít nhất 50 ký tự');
                return;
            }

            // Find TOPIC_PROPOSAL or PLANNING semester
            const activeSemester = semesters?.find(s => s.current_phase === 'TOPIC_PROPOSAL' || s.current_phase === 'PLANNING');
            if (!activeSemester) {
                message.error('Không tìm thấy học kỳ đang trong giai đoạn đề xuất hoặc chuẩn bị');
                return;
            }

            const topicData: TopicForm = {
                title: values.title,
                description,
                objectives,
                requirements,
                semesterId: activeSemester.id,
                maxStudents: values.maxStudents || 2,
                isDraft,
            };

            createMutation.mutate(topicData, {
                onSuccess: () => {
                    message.success(isDraft ? 'Lưu bản nháp thành công' : 'Tạo đề tài thành công (Chờ duyệt)');
                    navigate('/topics');
                },
                onError: (error: any) => {
                    const errorMsg = error?.response?.data?.message || error?.response?.data?.error || error?.message || 'Không thể tạo đề tài';
                    Modal.error({
                        title: 'Lỗi tạo đề tài',
                        content: errorMsg,
                        okText: 'Đóng',
                    });
                }
            });
        } catch (error) {
            console.error('Validation failed:', error);
            message.error('Vui lòng kiểm tra lại thông tin');
        }
    };

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center space-x-3">
                <Button
                    icon={<ArrowLeftOutlined />}
                    onClick={() => navigate('/topics')}
                >
                    Quay lại
                </Button>
                <div>
                    <h1 className="text-3xl font-bold text-foreground">Tạo đề tài mới</h1>
                    <p className="text-muted-foreground">Đề xuất đề tài khóa luận cho sinh viên</p>
                </div>
            </div>

            {/* Form Content */}
            <Card className="shadow-soft">
                <Form
                    form={form}
                    layout="vertical"
                    size="large"
                >
                    {/* Thông tin cơ bản */}
                    <div className="mb-6">
                        <h2 className="text-lg font-semibold mb-4">Thông tin cơ bản</h2>

                        <Form.Item
                            label="Tên đề tài"
                            name="title"
                            rules={[
                                { required: true, message: 'Vui lòng nhập tên đề tài' },
                                { min: 20, message: 'Tên đề tài phải có ít nhất 20 ký tự' },
                                { max: 500, message: 'Tên đề tài không được quá 500 ký tự' },
                            ]}
                        >
                            <Input placeholder="Nhập tên đề tài (20-500 ký tự)..." size="large" />
                        </Form.Item>

                        <Form.Item
                            label="Số lượng sinh viên tối đa"
                            name="maxStudents"
                            initialValue={2}
                            rules={[
                                { required: true, message: 'Vui lòng nhập số SV' },
                                { type: 'number', min: 1, message: 'Tối thiểu 1 sinh viên' }
                            ]}
                            tooltip="Mặc định là 2. Nếu số lượng > 2, đề tài có thể có nhiều nhóm đăng ký (mỗi nhóm tối đa 2 SV)."
                        >
                            <InputNumber min={1} className="w-full" placeholder="Nhập số lượng SV..." />
                        </Form.Item>
                    </div>

                    <Divider />

                    {/* Mô tả chi tiết */}
                    <div className="space-y-6">
                        <h2 className="text-lg font-semibold">Mô tả chi tiết</h2>

                        <div>
                            <label className="block mb-2 font-medium text-base">
                                Mô tả đề tài <span className="text-red-500">*</span>
                                <span className="text-sm text-gray-500 ml-2">(tối thiểu 100 ký tự)</span>
                            </label>
                            <RichTextEditor
                                value={description}
                                onChange={setDescription}
                                placeholder="Mô tả tổng quan về đề tài, bối cảnh, vấn đề cần giải quyết..."
                                minHeight="200px"
                            />
                            {description.length < 100 && (
                                <p className="text-sm text-red-500 mt-1">
                                    Mô tả phải có ít nhất 100 ký tự ({description.length}/100)
                                </p>
                            )}
                        </div>

                        <div>
                            <label className="block mb-2 font-medium text-base">
                                Mục tiêu <span className="text-red-500">*</span>
                                <span className="text-sm text-gray-500 ml-2">(tối thiểu 50 ký tự)</span>
                            </label>
                            <RichTextEditor
                                value={objectives}
                                onChange={setObjectives}
                                placeholder="Các mục tiêu cụ thể cần đạt được..."
                                minHeight="150px"
                            />
                            {objectives.length < 50 && (
                                <p className="text-sm text-red-500 mt-1">
                                    Mục tiêu phải có ít nhất 50 ký tự ({objectives.length}/50)
                                </p>
                            )}
                        </div>

                        <div>
                            <label className="block mb-2 font-medium text-base">
                                Yêu cầu sinh viên <span className="text-red-500">*</span>
                                <span className="text-sm text-gray-500 ml-2">(tối thiểu 50 ký tự)</span>
                            </label>
                            <RichTextEditor
                                value={requirements}
                                onChange={setRequirements}
                                placeholder="Kiến thức, kỹ năng cần có, công nghệ sử dụng..."
                                minHeight="150px"
                            />
                            {requirements.length < 50 && (
                                <p className="text-sm text-red-500 mt-1">
                                    Yêu cầu phải có ít nhất 50 ký tự ({requirements.length}/50)
                                </p>
                            )}
                        </div>
                    </div>

                    <Divider />

                    {/* Lưu ý */}
                    <div className="bg-blue-50 border border-blue-200 rounded p-4 mb-6">
                        <h4 className="font-semibold text-blue-900 mb-2">Lưu ý trước khi gửi:</h4>
                        <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
                            <li>Kiểm tra kỹ thông tin đề tài và mô tả</li>
                            <li>Sau khi tạo, đề tài sẽ được gửi đến Trưởng bộ môn để phê duyệt</li>
                            <li>Bạn có thể lưu bản nháp để chỉnh sửa sau</li>
                            <li>Đề tài được duyệt mới hiển thị cho sinh viên</li>
                        </ul>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex justify-end space-x-3">
                        <Button
                            size="large"
                            icon={<SaveOutlined />}
                            onClick={() => handleSubmit(true)}
                            loading={createMutation.isPending}
                        >
                            Lưu bản nháp
                        </Button>
                        <Button
                            type="primary"
                            size="large"
                            icon={<SendOutlined />}
                            onClick={() => handleSubmit(false)}
                            loading={createMutation.isPending}
                            disabled={!description || description.length < 100 || objectives.length < 50 || requirements.length < 50}
                        >
                            Tạo đề tài
                        </Button>
                    </div>
                </Form>
            </Card>
        </div>
    );
};

export default SupervisorCreateTopic;
