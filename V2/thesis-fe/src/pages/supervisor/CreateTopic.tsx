import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Form, Input, InputNumber, Button, Divider, Alert, Modal, Typography, Spin, Tag } from 'antd';
import { notify } from '@/utils/notification';
import { SaveOutlined, SendOutlined, ArrowLeftOutlined } from '@ant-design/icons';
import { RichTextEditor } from '@/components/RichTextEditor';
import { useCreateTopic, useTopics, useCloneTopic } from '@/hooks/useTopics';
import { useSemesters, useActiveSemester } from '@/hooks/useSemesters';
import { useAuthStore } from '@/store/auth';
import type { TopicForm } from '@/types';
import { canCreateTopic } from '@/utils/semester-rules';
import { HistoryOutlined, CopyOutlined, PlusOutlined } from '@ant-design/icons';

const { Text } = Typography;

const SupervisorCreateTopic = () => {
    const navigate = useNavigate();
    const [form] = Form.useForm();
    const [description, setDescription] = useState('');
    const [objectives, setObjectives] = useState('');
    const [requirements, setRequirements] = useState('');

    const { user } = useAuthStore();
    const { data: semesters } = useSemesters();
    const { data: activeSemesterData } = useActiveSemester();
    const createMutation = useCreateTopic();
    const cloneMutation = useCloneTopic();

    // Reuse Topic Modal State
    const [reuseModalVisible, setReuseModalVisible] = useState(false);
    const [previewTopic, setPreviewTopic] = useState<any>(null);
    const { data: allMyTopics, isLoading: isLoadingOld } = useTopics({ 
        supervisorId: user?.id, 
        includeAll: true 
    });

    const reusableTopics = allMyTopics?.topics?.filter(t => t.semester_id !== activeSemesterData?.id);

    const handleSubmit = async (isDraft = false) => {
        try {
            const values = await form.validateFields();

            // Client-side validation for rich text fields
            if (description.length < 100) {
                notify.error('Mô tả phải có ít nhất 100 ký tự');
                return;
            }
            if (objectives.length < 50) {
                notify.error('Mục tiêu phải có ít nhất 50 ký tự');
                return;
            }
            if (requirements.length < 50) {
                notify.error('Yêu cầu phải có ít nhất 50 ký tự');
                return;
            }

            // Find PREVIEW or PLANNING semester
            const activeSemester = semesters?.find(s => canCreateTopic(s));
            if (!activeSemester) {
                const activeSem = semesters?.find(s => s.status === 'ACTIVE');
                const phaseMsg = activeSem?.calculated_phase === 'REGISTRATION' 
                    ? 'Hiện đang trong giai đoạn Sinh viên đăng ký, hệ thống đã khóa chức năng thêm đề tài mới.'
                    : 'Hệ thống hiện không trong giai đoạn cho phép đề xuất đề tài mới.';
                notify.error(phaseMsg);
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
                    notify.success(isDraft ? 'Lưu bản nháp thành công' : 'Tạo đề tài thành công (Chờ duyệt)');
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
            notify.error('Vui lòng kiểm tra lại thông tin');
        }
    };

    const handleClone = (topicId: string) => {
        const activeSemester = semesters?.find(s => canCreateTopic(s));
        if (!activeSemester) {
            const activeSem = semesters?.find(s => s.status === 'ACTIVE');
            const phaseMsg = activeSem?.calculated_phase === 'REGISTRATION' 
                ? 'Hiện đang trong giai đoạn Sinh viên đăng ký, hệ thống đã khóa chức năng tái sử dụng đề tài.'
                : 'Hệ thống hiện không trong giai đoạn cho phép đề xuất hoặc tái sử dụng đề tài cũ.';
            notify.error(phaseMsg);
            return;
        }

        cloneMutation.mutate({ topicId, semesterId: activeSemester.id }, {
            onSuccess: (clonedTopic) => {
                setReuseModalVisible(false);
                // Redirect to edit page so user can update or submit
                navigate(`/topics/${clonedTopic.id}/edit`);
            }
        });
    };

    return (
        <div className="page-container">
            <div className="page-inner">
                {/* Header */}
                <Card className="page-header-card">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <Button
                                icon={<ArrowLeftOutlined />}
                                onClick={() => navigate('/topics')}
                                type="text"
                                className="hover:bg-gray-100"
                            />
                            <div className="page-header-icon"><PlusOutlined className="text-base" /></div>
                            <div>
                                <div className="page-header-title">Tạo đề tài mới</div>
                                <div className="page-header-subtitle">Đề xuất đề tài khóa luận cho sinh viên</div>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <Button 
                                icon={<HistoryOutlined />} 
                                onClick={() => setReuseModalVisible(true)}
                                className="bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100"
                            >
                                Tái sử dụng đề tài cũ
                            </Button>
                        </div>
                    </div>
                </Card>

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

            {/* Reuse Topic Modal */}
            <Modal
                title={
                    <div className="flex items-center space-x-2">
                        <HistoryOutlined className="text-amber-500" />
                        <span>Chọn đề tài từ các học kỳ trước</span>
                    </div>
                }
                open={reuseModalVisible}
                onCancel={() => setReuseModalVisible(false)}
                footer={null}
                width={800}
                className="top-10"
            >
                <div className="space-y-4">
                    <Alert 
                        message="Lưu ý: Khi tái sử dụng, hệ thống sẽ tạo một bản nháp đề tài mới dựa trên nội dung cũ. Bạn có thể chỉnh sửa trước khi gửi phê duyệt."
                        type="info"
                        showIcon
                        className="mb-4"
                    />

                    {isLoadingOld ? (
                        <div className="py-20 text-center"><Spin /></div>
                    ) : !reusableTopics || reusableTopics.length === 0 ? (
                        <div className="py-20 text-center text-gray-500">
                            Bạn chưa có đề tài ở các học kỳ khác.
                        </div>
                    ) : (
                        <div className="max-h-[500px] overflow-y-auto pr-2">
                            {reusableTopics.map(topic => (
                                <div 
                                    key={topic.id} 
                                    className="p-4 mb-3 border rounded-lg hover:border-academic-primary group cursor-pointer transition-all flex justify-between items-center"
                                    onClick={() => setPreviewTopic(topic)}
                                >
                                    <div className="flex-1 mr-4">
                                        <div className="flex items-center space-x-2 mb-1">
                                            <Tag color="blue">{topic.semester?.name}</Tag>
                                            <span className="text-xs text-gray-400">Mã: {topic.code}</span>
                                        </div>
                                        <h4 className="font-semibold text-base mb-0 group-hover:text-academic-primary transition-colors">
                                            {topic.title}
                                        </h4>
                                    </div>
                                    <Button 
                                        type="primary" 
                                        ghost 
                                        icon={<CopyOutlined />}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleClone(topic.id);
                                        }}
                                        loading={cloneMutation.isPending && cloneMutation.variables?.topicId === topic.id}
                                    >
                                        Sử dụng
                                    </Button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </Modal>
            
            {/* Topic Detail Preview Modal */}
            <Modal
                title="Chi tiết đề tài cũ"
                open={!!previewTopic}
                onCancel={() => setPreviewTopic(null)}
                footer={[
                    <Button key="back" onClick={() => setPreviewTopic(null)}>
                        Quay lại
                    </Button>,
                    <Button 
                        key="submit" 
                        type="primary" 
                        icon={<CopyOutlined />}
                        onClick={() => {
                            handleClone(previewTopic.id);
                            setPreviewTopic(null);
                        }}
                        loading={cloneMutation.isPending}
                    >
                        Sử dụng đề tài này
                    </Button>
                ]}
                width={700}
            >
                {previewTopic && (
                    <div className="space-y-4">
                        <div>
                            <div className="flex items-center space-x-2 mb-2">
                                <Tag color="blue">{previewTopic.semester?.name}</Tag>
                                <span className="text-gray-500">Mã: {previewTopic.code}</span>
                            </div>
                            <h3 className="text-xl font-bold text-gray-800">{previewTopic.title}</h3>
                        </div>
                        
                        <Divider className="my-2" />
                        
                        <div>
                            <h4 className="font-semibold text-gray-700 mb-1">Mô tả:</h4>
                            <div className="text-gray-600 prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: previewTopic.description || '' }} />
                        </div>
                        
                        <div>
                            <h4 className="font-semibold text-gray-700 mb-1">Mục tiêu:</h4>
                            <div className="text-gray-600 prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: previewTopic.objectives || '' }} />
                        </div>
                        
                        <div>
                            <h4 className="font-semibold text-gray-700 mb-1">Yêu cầu:</h4>
                            <div className="text-gray-600 prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: previewTopic.requirements || '' }} />
                        </div>
                    </div>
                )}
            </Modal>
            </div>
        </div>
    );
};

export default SupervisorCreateTopic;
