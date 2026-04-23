import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, Descriptions, Tag, Button, Spin, Space, Result, Modal, Input, Select, Form } from 'antd';
import { ArrowLeftOutlined, CheckOutlined, CloseOutlined, UsergroupAddOutlined, FormOutlined, HistoryOutlined } from '@ant-design/icons';
import { useTopic, useApproveTopic, useRejectTopic, useRequireEdit } from '@/hooks/useTopics';
import { useAssignReviewer } from '@/hooks/useAssignments';
import { useUsers } from '@/hooks/useUsers';
import { TopicStatusBadge } from '@/components/StatusBadge';
import TopicHistoryModal from '@/components/TopicHistoryModal';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/store/auth';
import dayjs from 'dayjs';

const { TextArea } = Input;
const { Option } = Select;

/**
 * Topic Detail view for HEAD/Admin
 * Features: Approve, Reject, Require Edit, Assign Reviewer
 */
const TopicDetailGeneral = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { t } = useTranslation();
    const { user } = useAuthStore();
    const [form] = Form.useForm();

    // Hooks
    const { data: topic, isLoading, isError } = useTopic(id);
    const approveMutation = useApproveTopic();
    const rejectMutation = useRejectTopic();
    const requireEditMutation = useRequireEdit();
    const assignReviewerMutation = useAssignReviewer();

    // Fetch reviewers
    const { data: reviewers } = useUsers({ role: 'REVIEWER' });

    // Local state
    const [rejectModalVisible, setRejectModalVisible] = useState(false);
    const [rejectReason, setRejectReason] = useState('');
    const [assignReviewerModalVisible, setAssignReviewerModalVisible] = useState(false);
    const [requireEditModalVisible, setRequireEditModalVisible] = useState(false);
    const [editNotes, setEditNotes] = useState('');
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
    const handleApprove = () => {
        Modal.confirm({
            title: t('topics.approveConfirmTitle'),
            content: t('topics.approveConfirmContent'),
            onOk: () => approveMutation.mutate(topic.id),
        });
    };

    const handleReject = () => {
        if (!rejectReason.trim() || rejectReason.length < 20) return;
        rejectMutation.mutate(
            { id: topic.id, reason: rejectReason },
            {
                onSuccess: () => {
                    setRejectModalVisible(false);
                    setRejectReason('');
                },
            }
        );
    };

    const handleRequireEdit = () => {
        if (!editNotes.trim() || editNotes.length < 20) return;
        requireEditMutation.mutate(
            { id: topic.id, notes: editNotes },
            {
                onSuccess: () => {
                    setRequireEditModalVisible(false);
                    setEditNotes('');
                },
            }
        );
    };

    const handleAssignReviewer = () => {
        form.validateFields().then((values) => {
            assignReviewerMutation.mutate(
                { topicId: topic.id, reviewerId: values.reviewerId, reviewerOrder: 1, deadlineAt: dayjs().add(14, 'day').toDate() },
                {
                    onSuccess: () => {
                        setAssignReviewerModalVisible(false);
                        form.resetFields();
                    },
                }
            );
        });
    };

    // Permission Checks
    const isHead = user?.role === 'HEAD' || user?.role === 'ADMIN';
    const canApprove = isHead && topic.status === 'PENDING_APPROVAL';
    const canRequireEdit = isHead && topic.status === 'PENDING_APPROVAL';
    const canAssignReviewer = isHead && ['APPROVED', 'REGISTERED', 'UNDER_REVIEW'].includes(topic.status);
    const isFull = (topic.current_students || 0) >= (topic.max_students || 0);

    return (
        <div className="p-6">
            <div className="flex justify-between items-center mb-4">
                <Button
                    icon={<ArrowLeftOutlined />}
                    onClick={() => navigate('/topics')}
                >
                    {t("common.back")}
                </Button>

                <Space>
                    {/* View History Button */}
                    <Button
                        icon={<HistoryOutlined />}
                        onClick={() => setHistoryModalVisible(true)}
                        className="bg-amber-50 hover:bg-amber-100 border-amber-300"
                    >
                        {t('topics.viewHistory')}
                    </Button>

                    {/* Approve Button */}
                    {canApprove && (
                        <Button
                            type="primary"
                            icon={<CheckOutlined />}
                            onClick={handleApprove}
                            loading={approveMutation.isPending}
                            className="bg-green-600 hover:bg-green-700"
                        >
                            {t('approveTopics.approveButton')}
                        </Button>
                    )}

                    {/* Require Edit Button */}
                    {canRequireEdit && (
                        <Button
                            icon={<FormOutlined />}
                            onClick={() => setRequireEditModalVisible(true)}
                        >
                            {t('approveTopics.requireEditButton')}
                        </Button>
                    )}

                    {/* Reject Button */}
                    {canApprove && (
                        <Button
                            danger
                            icon={<CloseOutlined />}
                            onClick={() => setRejectModalVisible(true)}
                        >
                            {t('approveTopics.rejectButton')}
                        </Button>
                    )}

                    {/* Assign Reviewer */}
                    {canAssignReviewer && (
                        <Button
                            icon={<UsergroupAddOutlined />}
                            onClick={() => setAssignReviewerModalVisible(true)}
                        >
                            {t('topics.selectReviewer')}
                        </Button>
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

            {/* Reject Modal */}
            <Modal
                title={t('approveTopics.rejectModalTitle')}
                open={rejectModalVisible}
                onOk={handleReject}
                onCancel={() => {
                    setRejectModalVisible(false);
                    setRejectReason('');
                }}
                confirmLoading={rejectMutation.isPending}
                okText={t('approveTopics.rejectButton')}
                cancelText={t('common.cancel')}
                okButtonProps={{ disabled: rejectReason.length < 20, danger: true }}
            >
                <p className="mb-2">{t('topics.rejectReasonLabel')}</p>
                <TextArea
                    rows={4}
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    placeholder={t('approveTopics.rejectionReasonPlaceholder')}
                    showCount
                    maxLength={500}
                />
            </Modal>

            {/* Require Edit Modal */}
            <Modal
                title={t('approveTopics.requireEditModalTitle')}
                open={requireEditModalVisible}
                onOk={handleRequireEdit}
                onCancel={() => {
                    setRequireEditModalVisible(false);
                    setEditNotes('');
                }}
                confirmLoading={requireEditMutation.isPending}
                okText={t('approveTopics.sendRequestButton')}
                cancelText={t('common.cancel')}
                okButtonProps={{ disabled: editNotes.length < 20 }}
            >
                <p className="mb-2">{t('topics.editNotesLabel')}</p>
                <TextArea
                    rows={4}
                    value={editNotes}
                    onChange={(e) => setEditNotes(e.target.value)}
                    placeholder={t('approveTopics.editNotesPlaceholder')}
                    showCount
                    maxLength={500}
                />
            </Modal>

            {/* Assign Reviewer Modal */}
            <Modal
                title={t('topics.selectReviewer')}
                open={assignReviewerModalVisible}
                onOk={handleAssignReviewer}
                onCancel={() => {
                    setAssignReviewerModalVisible(false);
                    form.resetFields();
                }}
                confirmLoading={assignReviewerMutation.isPending}
                okText={t('common.save')}
                cancelText={t('common.cancel')}
            >
                <Form form={form} layout="vertical">
                    <Form.Item
                        name="reviewerId"
                        label={t('topics.selectReviewer')}
                        rules={[{ required: true, message: t('topics.selectReviewerRequired') }]}
                    >
                        <Select
                            placeholder={t('topics.selectReviewerPlaceholder')}
                            showSearch
                            optionFilterProp="children"
                        >
                            {reviewers?.map((reviewer: any) => (
                                <Option key={reviewer.id} value={reviewer.id}>
                                    {reviewer.full_name} ({reviewer.email})
                                </Option>
                            ))}
                        </Select>
                    </Form.Item>
                </Form>
            </Modal>

            {/* History Modal */}
            <TopicHistoryModal
                topicId={topic?.id || ''}
                visible={historyModalVisible}
                onClose={() => setHistoryModalVisible(false)}
            />
        </div>
    );
};

export default TopicDetailGeneral;
