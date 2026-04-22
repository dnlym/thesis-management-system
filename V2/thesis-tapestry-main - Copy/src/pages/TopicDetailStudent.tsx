import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, Descriptions, Tag, Button, Spin, Space, Result, Modal, Tooltip } from 'antd';
import { notify } from '@/utils/notification';
import { ArrowLeftOutlined, CheckOutlined, UserAddOutlined, CheckCircleOutlined, CloseCircleOutlined, ClockCircleOutlined, StopOutlined, HistoryOutlined } from '@ant-design/icons';
import { useTopic } from '@/hooks/useTopics';
import { useRegisterTopic } from '@/hooks/useRegistrations';
import { TopicStatusBadge } from '@/components/StatusBadge';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/store/auth';
import { useSemesters } from '@/hooks/useSemesters';
import { useQuery } from '@tanstack/react-query';

import { RegistrationsApi } from '@/api/registrations';
import dayjs from 'dayjs';

/**
 * Topic Detail view for Students
 * Features: View topic info, Register for topic
 */
const TopicDetailStudent = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { t } = useTranslation();
    const { user } = useAuthStore();

    // Hooks
    const { data: topic, isLoading, isError } = useTopic(id);
    const registerMutation = useRegisterTopic();

    // Get active semester
    const { data: semesters } = useSemesters();
    // Improved logic: Find the active semester
    const activeSemester = semesters?.find(s => s.status === 'ACTIVE');

    // Get my current registration (to check if student already has a topic)
    const { data: myCurrentRegistration } = useQuery({
        queryKey: ['my-topic-registration'],
        queryFn: () => RegistrationsApi.getMyTopic(),
        enabled: !!user,
    });

    // Local state
    const [registerModalVisible, setRegisterModalVisible] = useState(false);

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

    // Registration handlers
    const handleRegister = () => {
        if (!topic) return;
        registerMutation.mutate(
            { topicId: topic.id, accepted: true },
            {
                onSuccess: () => {
                    setRegisterModalVisible(false);
                    // Wait for DB commit, then redirect
                    setTimeout(() => {
                        navigate('/my-topic');
                    }, 500);
                },
            }
        );
    };

    // Permission Checks
    const canRegister = topic.status === 'APPROVED';
    const isFull = (topic.current_students || 0) >= (topic.max_students || 0);
    const isRegisteredForThisTopic = myCurrentRegistration?.topic_id === topic.id;

    // Check if student already has ANY registration (regardless of group)
    const hasExistingRegistration = !!(myCurrentRegistration &&
        myCurrentRegistration.status !== 'REJECTED' &&
        myCurrentRegistration.status !== 'CANCELLED');
    const hasAnyRegistration = hasExistingRegistration && !isRegisteredForThisTopic;

    // Midterm result data
    const midtermStatus = myCurrentRegistration?.midterm_status;
    const midtermFeedback = myCurrentRegistration?.midterm_feedback;
    const midtermGradedAt = myCurrentRegistration?.midterm_graded_at;

    // Helper for midterm status display
    const getMidtermStatusDisplay = () => {
        if (!isRegisteredForThisTopic) return null;
        if (!midtermStatus) {
            return (
                <Tag color="default" icon={<ClockCircleOutlined />}>
                    {t('topics.midtermNotGraded')}
                </Tag>
            );
        }
        if (midtermStatus === 'PASS') {
            return (
                <Tag color="success" icon={<CheckCircleOutlined />}>
                    PASS
                </Tag>
            );
        }
        return (
            <Tag color="error" icon={<CloseCircleOutlined />}>
                FAIL
            </Tag>
        );
    };

    return (
        <div className="p-6">
            <div className="flex justify-between items-center mb-4">
                <Button
                    icon={<ArrowLeftOutlined />}
                    onClick={() => navigate('/topics')}
                >
                    {t('common.back')}
                </Button>

                <Space>
                    {/* Registration Button - All students can register individually */}
                    {canRegister && (
                        isRegisteredForThisTopic ? (
                            <Button type="default" disabled className="bg-green-100 text-green-700 border-green-200" icon={<CheckOutlined />}>
                                {t('topics.alreadyRegistered')}
                            </Button>
                        ) : hasAnyRegistration ? (
                            <Tooltip title={t('topics.alreadyHasOtherTopicTooltip', { title: myCurrentRegistration?.topic?.title || 'khác' })}>
                                <Button
                                    type="default"
                                    icon={<StopOutlined />}
                                    disabled
                                    onClick={() => notify.warning(t('topics.alreadyHasOtherTopicTooltip', { title: myCurrentRegistration?.topic?.title || 'khác' }))}
                                    className="opacity-60"
                                >
                                    {t('topics.alreadyHasOtherTopic')}
                                </Button>
                            </Tooltip>
                        ) : isFull ? (
                            <Tooltip title={t('topics.isFullSlotTooltip')}>
                                <Button
                                    type="default"
                                    icon={<StopOutlined />}
                                    disabled
                                    className="opacity-60"
                                >
                                    {t('topics.isFullSlotCount')}
                                </Button>
                            </Tooltip>
                        ) : (
                            <Button
                                type="primary"
                                icon={<UserAddOutlined />}
                                onClick={() => setRegisterModalVisible(true)}
                                loading={registerMutation.isPending}
                            >
                                {t('topics.registerTopic')}
                            </Button>
                        )
                    )}
                </Space>
            </div>

            <h1 className="text-2xl font-bold text-primary mb-6">{topic.title}</h1>

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
                        {topic.current_students || 0} / {topic.max_students || 0}
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

            {/* Midterm Result Card - Only show if registered */}
            {isRegisteredForThisTopic && myCurrentRegistration?.status === 'CONFIRMED' && (
                <Card
                    className={`mt-6 shadow-soft border-l-4 ${midtermStatus === 'PASS' ? 'border-l-green-500' : midtermStatus === 'FAIL' ? 'border-l-red-500' : 'border-l-gray-300'}`}
                    title={
                        <div className="flex items-center justify-between">
                            <span className="font-bold">{t('topics.midtermResultTitle')}</span>
                            {getMidtermStatusDisplay()}
                        </div>
                    }
                >
                    {!midtermStatus ? (
                        <div className="text-gray-500 italic">
                            {t('topics.midtermAdvisorNotGraded')}
                        </div>
                    ) : (
                        <div className="space-y-3">
                            <div>
                                <span className="text-gray-500 text-sm">{t('topics.midtermGradedAt')}:</span>
                                <span className="ml-2 font-medium">
                                    {midtermGradedAt ? dayjs(midtermGradedAt).format('DD/MM/YYYY HH:mm') : 'N/A'}
                                </span>
                            </div>
                            {midtermFeedback && (
                                <div>
                                    <span className="text-gray-500 text-sm">{t('topics.advisorFeedback')}:</span>
                                    <div className="mt-1 p-3 bg-gray-50 rounded-lg">
                                        {midtermFeedback}
                                    </div>
                                </div>
                            )}
                            {midtermStatus === 'PASS' && (
                                <div className="p-3 bg-green-50 rounded-lg text-green-700">
                                    <CheckCircleOutlined className="mr-2" />
                                    {t('topics.midtermPassMsg')}
                                </div>
                            )}
                            {midtermStatus === 'FAIL' && (
                                <div className="p-3 bg-red-50 rounded-lg text-red-700">
                                    <CloseCircleOutlined className="mr-2" />
                                    {t('topics.midtermFailMsg')}
                                </div>
                            )}
                        </div>
                    )}
                </Card>
            )}

            {/* Register Modal */}
            <Modal
                title={t('topics.confirmRegisterTitle')}
                open={registerModalVisible}
                onOk={handleRegister}
                onCancel={() => setRegisterModalVisible(false)}
                confirmLoading={registerMutation.isPending}
                okText={t('topics.registerTopic')}
                cancelText={t('common.cancel')}
            >
                <p>{t('topics.confirmRegisterContent', { title: topic.title })}</p>
                <p className="mt-2 text-gray-600">
                    Sau khi đăng ký, bạn có thể tìm đồng đội cùng đề tài để lập nhóm.
                </p>
            </Modal>
        </div>
    );
};

export default TopicDetailStudent;
