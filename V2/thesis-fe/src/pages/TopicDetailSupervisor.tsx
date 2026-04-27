import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, Descriptions, Button, Spin, Space, Result, Modal, Select, Tag } from 'antd';
import { ArrowLeftOutlined, EditOutlined, SendOutlined, UserAddOutlined, HistoryOutlined } from '@ant-design/icons';
import { useTopic, useSubmitForApproval } from '@/hooks/useTopics';
import { useRegisterForStudent } from '@/hooks/useRegistrations';
import { TopicStatusBadge } from '@/components/StatusBadge';
import TopicHistoryModal from '@/components/TopicHistoryModal';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/store/auth';
import { useQuery } from '@tanstack/react-query';
import { UsersApi } from '@/api/users';
import dayjs from 'dayjs';

const { Option } = Select;

/**
 * Topic Detail view for Supervisors
 * Features: View topic info, Edit, Submit for approval, Register on behalf of student
 * Note: GVHD cannot assign groups - groups are student-driven
 */
const TopicDetailSupervisor = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { t } = useTranslation();
    const { user } = useAuthStore();

    // Hooks
    const { data: topic, isLoading, isError } = useTopic(id);
    const submitForApprovalMutation = useSubmitForApproval();
    const registerForStudentMutation = useRegisterForStudent();

    // Fetch students list for registration
    const { data: students } = useQuery({
        queryKey: ['students-for-registration'],
        queryFn: async () => {
            const allStudents = await UsersApi.getAll({ role: 'STUDENT' });
            return allStudents;
        },
    });

    // Local state
    const [registerModalVisible, setRegisterModalVisible] = useState(false);
    const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
    const [historyModalVisible, setHistoryModalVisible] = useState(false);

    if (isLoading) {
        return (
            <div className="flex justify-center items-center h-screen">
                <Spin size="large" />
            </div>
        );
    }

    if (isError || !topic) {
        return (
            <Result
                status="404"
                title={t('topics.notFound')}
                subTitle={t('topics.notFoundDesc')}
                extra={
                    <Button type="primary" onClick={() => navigate('/topics')}>
                        {t('topics.backToList')}
                    </Button>
                }
            />
        );
    }

    // Action Handlers
    const handleSubmitForApproval = () => {
        Modal.confirm({
            title: t('topics.confirmSubmitTitle'),
            content: t('topics.confirmSubmitContent'),
            onOk: () => submitForApprovalMutation.mutate(topic.id),
        });
    };

    const handleRegisterForStudent = () => {
        if (selectedStudentId && id) {
            registerForStudentMutation.mutate(
                { studentId: selectedStudentId, topicId: id },
                {
                    onSuccess: () => {
                        setRegisterModalVisible(false);
                        setSelectedStudentId(null);
                    },
                }
            );
        }
    };

    // Permission Checks
    const isOwner = user?.id === topic.supervisor_id;
    const canEdit = isOwner && ['DRAFT', 'REQUIRES_REVISION'].includes(topic.status);
    const canSubmitForApproval = isOwner && ['DRAFT', 'REQUIRES_REVISION'].includes(topic.status);
    const isFull = (topic.current_students || 0) >= (topic.max_students || 0);
    const canRegisterForStudent = isOwner && topic.status === 'APPROVED' && !isFull;

    return (
        <div className="page-container">
            <div className="page-inner">
                {/* Header */}
                <Card className="page-header-card">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                        <div className="flex items-center gap-3">
                            <div className="page-header-icon"><ArrowLeftOutlined className="text-base" onClick={() => navigate('/topics')} style={{ cursor: 'pointer' }} /></div>
                            <div>
                                <div className="page-header-title">{topic.title}</div>
                                <div className="page-header-subtitle">Quản lý và theo dõi đề tài hướng dẫn</div>
                            </div>
                        </div>
                        <Space>
                            {/* View History Button */}
                            <Button
                                icon={<HistoryOutlined />}
                                onClick={() => setHistoryModalVisible(true)}
                                className="bg-amber-50 hover:bg-amber-100 border-amber-300 text-amber-700"
                            >
                                {t('topics.viewHistory')}
                            </Button>

                            {/* Submit for Approval */}
                            {canSubmitForApproval && (
                                <Button
                                    type="primary"
                                    icon={<SendOutlined />}
                                    onClick={handleSubmitForApproval}
                                    loading={submitForApprovalMutation.isPending}
                                >
                                    {t('topics.submitForApproval')}
                                </Button>
                            )}

                            {/* Register For Student Button (Optional feature) */}
                            {canRegisterForStudent && (
                                <Button
                                    icon={<UserAddOutlined />}
                                    onClick={() => setRegisterModalVisible(true)}
                                >
                                    {t('topics.registerForStudent')}
                                </Button>
                            )}

                            {/* Edit Button */}
                            {canEdit && (
                                <Button
                                    icon={<EditOutlined />}
                                    onClick={() => navigate(`/topics/${topic.id}/edit`)}
                                >
                                    {t('common.edit')}
                                </Button>
                            )}
                        </Space>
                    </div>
                </Card>



            {/* Show edit notes if REQUIRES_REVISION */}
            {topic.status === 'REQUIRES_REVISION' && topic.edit_notes && (
                <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <h4 className="font-semibold text-yellow-800">{t('topics.editNotesFromHead')}</h4>
                    <p className="text-yellow-700 mt-1 whitespace-pre-wrap">{topic.edit_notes}</p>
                </div>
            )}

            <Card className="shadow-soft">
                <Descriptions bordered column={{ xxl: 2, xl: 2, lg: 2, md: 1, sm: 1, xs: 1 }}>
                    <Descriptions.Item label={t('common.status')} span={2}>
                        <Space>
                            <TopicStatusBadge status={topic.status} />
                            {topic.source_topic && (
                                <Tag color="orange" icon={<HistoryOutlined />}>
                                    Tái sử dụng từ {topic.source_topic.semester?.name} ({topic.source_topic.code})
                                </Tag>
                            )}
                        </Space>
                    </Descriptions.Item>

                    <Descriptions.Item label={t('topics.supervisor')}>
                        <div className="flex flex-col">
                            <span className="font-medium">{topic.supervisor?.full_name || 'N/A'}</span>
                            {topic.supervisor?.email && <span className="text-gray-500 text-sm">{topic.supervisor.email}</span>}
                        </div>
                    </Descriptions.Item>
                    <Descriptions.Item label={t('topics.numStudents')}>
                        <span className={isFull ? 'text-red-500 font-bold' : 'text-green-600 font-bold'}>
                            {topic.current_students || 0} / {topic.max_students || 0}
                        </span>
                    </Descriptions.Item>

                    <Descriptions.Item label={t('topics.description')} span={2}>
                        <div className="whitespace-pre-wrap" dangerouslySetInnerHTML={{ __html: topic.description || '' }} />
                    </Descriptions.Item>

                    <Descriptions.Item label={t('topics.objectives')} span={2}>
                        <div className="whitespace-pre-wrap" dangerouslySetInnerHTML={{ __html: topic.objectives || '' }} />
                    </Descriptions.Item>

                    <Descriptions.Item label={t('topics.requirements')} span={2}>
                        <div className="whitespace-pre-wrap" dangerouslySetInnerHTML={{ __html: topic.requirements || '' }} />
                    </Descriptions.Item>

                    <Descriptions.Item label={t('topics.createdAt')}>
                        {dayjs(topic.created_at).format('DD/MM/YYYY')}
                    </Descriptions.Item>
                    <Descriptions.Item label={t('topics.lastUpdated')}>
                        {dayjs(topic.updated_at).format('DD/MM/YYYY')}
                    </Descriptions.Item>
                </Descriptions>
            </Card>

            {/* Registered Students Section */}
            {topic.registrations && topic.registrations.length > 0 && (
                <Card className="shadow-soft mt-6" title={t('topics.registeredStudentsList')}>
                    <div className="space-y-3">
                        {topic.registrations.map((registration: any) => (
                            <div
                                key={registration.id}
                                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center text-primary font-semibold">
                                        {registration.student?.full_name?.charAt(0) || '?'}
                                    </div>
                                    <div>
                                        <div className="font-medium">{registration.student?.full_name || 'N/A'}</div>
                                        <div className="text-sm text-gray-500">
                                            {registration.student?.student_code || ''} • {registration.student?.class_name || 'N/A'} • {registration.student?.email || ''}
                                        </div>
                                    </div>
                                </div>
                                <div className="text-right">
                                    {registration.group ? (
                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                            {t('topics.hasGroup')}
                                        </span>
                                    ) : (
                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                                            {t('topics.waitingForGroup')}
                                        </span>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </Card>
            )}

            {/* Empty state when no registrations */}
            {(!topic.registrations || topic.registrations.length === 0) && topic.status === 'APPROVED' && (
                <Card className="shadow-soft mt-6">
                    <div className="text-center py-8 text-gray-500">
                        <UserAddOutlined className="text-4xl mb-2" />
                        <p>{t('topics.noRegistrations')}</p>
                    </div>
                </Card>
            )}

            {/* Register For Student Modal */}
            <Modal
                title={t('topics.registerForStudentModalTitle')}
                open={registerModalVisible}
                onOk={handleRegisterForStudent}
                onCancel={() => {
                    setRegisterModalVisible(false);
                    setSelectedStudentId(null);
                }}
                confirmLoading={registerForStudentMutation.isPending}
                okText={t('topics.registerTopic')}
                cancelText={t('common.cancel')}
                okButtonProps={{ disabled: !selectedStudentId }}
            >
                <p className="mb-2 text-gray-600">
                    {t('topics.registerForStudentModalDesc')}
                </p>
                <Select
                    placeholder={t('topics.selectStudentPlaceholder')}
                    style={{ width: '100%' }}
                    value={selectedStudentId}
                    onChange={(value) => setSelectedStudentId(value)}
                    showSearch
                    optionFilterProp="children"
                    filterOption={(input, option) =>
                        (option?.children as unknown as string)?.toLowerCase().includes(input.toLowerCase())
                    }
                >
                    {students?.map((student: any) => (
                        <Option key={student.id} value={student.id}>
                            {student.full_name} ({student.student_code || student.email})
                        </Option>
                    ))}
                </Select>
                {(!students || students.length === 0) && (
                    <p className="text-sm text-orange-500 mt-2">
                        {t('topics.noStudentsFound')}
                    </p>
                )}
            </Modal>

            {/* History Modal */}
            <TopicHistoryModal
                topicId={topic.id}
                visible={historyModalVisible}
                onClose={() => setHistoryModalVisible(false)}
            />
            </div>
        </div>
    );
};

export default TopicDetailSupervisor;
