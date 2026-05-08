import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, Descriptions, Tag, Button, Spin, Space, Result, Modal, Input, Select, Form, Avatar } from 'antd';
import { ArrowLeftOutlined, CheckOutlined, CloseOutlined, UsergroupAddOutlined, FormOutlined, HistoryOutlined, UserOutlined } from '@ant-design/icons';
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


    // Local state
    const [rejectModalVisible, setRejectModalVisible] = useState(false);
    const [rejectReason, setRejectReason] = useState('');
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


    // Permission Checks
    const isHead = user?.role === 'HEAD' || user?.role === 'ADMIN';
    const canApprove = isHead && topic.status === 'PENDING_APPROVAL';
    const canRequireEdit = isHead && topic.status === 'PENDING_APPROVAL';
    const isFull = (topic.current_students || 0) >= (topic.max_students || 0);

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
                                <div className="page-header-subtitle">Chi tiết đề tài khóa luận và các thao tác quản lý</div>
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

                            {/* Approve Button */}
                            {canApprove && (
                                <Button
                                    type="primary"
                                    icon={<CheckOutlined />}
                                    onClick={handleApprove}
                                    loading={approveMutation.isPending}
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

                        </Space>
                    </div>
                </Card>



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
                            <span className="font-medium">
                                {topic.supervisor?.full_name || 'N/A'}
                            </span>
                            {topic.supervisor?.email && <span className="text-gray-500 text-sm">{topic.supervisor.email}</span>}
                        </div>
                    </Descriptions.Item>
                    <Descriptions.Item label={t('topics.numStudents')}>
                        <span className={isFull ? 'text-green-600 font-bold' : 'text-red-500 font-bold'}>
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
            {((topic.registrations && topic.registrations.length > 0) || (topic.students && topic.students.length > 0)) && (
                <Card 
                    title={
                        <Space>
                            <UsergroupAddOutlined className="text-academic-primary" />
                            <span>Sinh viên đăng ký ({topic.current_students || 0} / {topic.max_students || 0})</span>
                        </Space>
                    }
                    className="shadow-soft mt-6"
                >
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {(topic.students || topic.registrations || []).map((item: any) => {
                            // Handle both registration objects and student objects
                            const student = item.student || item;
                            const groupCode = item.groupCode || item.group?.name;
                            
                            return (
                                <Card key={student.id} size="small" className="bg-slate-50/50 hover:border-academic-primary/30 transition-colors">
                                    <div className="flex items-center gap-4">
                                        <Avatar 
                                            size={48} 
                                            src={student.avatar_url} 
                                            icon={<UserOutlined />}
                                            className="bg-academic-primary/10 text-academic-primary"
                                        />
                                        <div className="flex-1 min-w-0">
                                            <div className="font-bold text-slate-800 truncate">
                                                {student.full_name || 'N/A'}
                                            </div>
                                            <div className="text-xs text-slate-500 font-medium flex justify-between items-center">
                                                <span>MSSV: {student.student_code || student.studentCode || 'N/A'}</span>
                                                {groupCode && <Tag color="blue" className="mr-0">{groupCode}</Tag>}
                                            </div>
                                        </div>
                                    </div>
                                </Card>
                            );
                        })}
                    </div>
                </Card>
            )}

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


            {/* History Modal */}
            <TopicHistoryModal
                topicId={topic?.id || ''}
                visible={historyModalVisible}
                onClose={() => setHistoryModalVisible(false)}
            />
            </div>
        </div>
    );
};

export default TopicDetailGeneral;
