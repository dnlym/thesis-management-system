import { useState } from 'react';
import { Card, Table, Button, Modal, Descriptions, Tag, Input, Tabs, Spin } from 'antd';
import { useTranslation } from 'react-i18next';
import { CheckOutlined, CloseOutlined, EyeOutlined, EditOutlined, HistoryOutlined } from '@ant-design/icons';
import { TopicStatusBadge } from '@/components/StatusBadge';
import { useTopics, useApproveTopic, useRejectTopic, useRequireEdit, useTopicStats } from '@/hooks/useTopics';
import TopicHistoryModal from '@/components/TopicHistoryModal';

const { TextArea } = Input;
const { TabPane } = Tabs;

const HeadApproveTopics = () => {
    const { t } = useTranslation();
    const [detailModalVisible, setDetailModalVisible] = useState(false);
    const [historyModalVisible, setHistoryModalVisible] = useState(false);
    const [rejectModalVisible, setRejectModalVisible] = useState(false);
    const [requireEditModalVisible, setRequireEditModalVisible] = useState(false);
    const [selectedTopic, setSelectedTopic] = useState<any>(null);
    const [rejectionReason, setRejectionReason] = useState('');
    const [editNotes, setEditNotes] = useState('');
    const [activeTab, setActiveTab] = useState('PENDING_APPROVAL');

    const { data: topicsData, isLoading } = useTopics({ status: activeTab as any });
    const { data: stats } = useTopicStats();
    const topics = topicsData?.topics || [];
    const approveMutation = useApproveTopic();
    const rejectMutation = useRejectTopic();
    const requireEditMutation = useRequireEdit();

    const viewDetail = (topic: any) => {
        setSelectedTopic(topic);
        setDetailModalVisible(true);
    };

    const handleApprove = (id: string) => {
        Modal.confirm({
            title: t('approveTopics.confirmApproveTitle'),
            content: t('approveTopics.confirmApproveContent'),
            okText: t('approveTopics.approveButton'),
            cancelText: t('common.cancel'),
            onOk: () => {
                approveMutation.mutate(id);
            },
        });
    };

    const handleReject = (topic: any) => {
        setSelectedTopic(topic);
        setRejectModalVisible(true);
    };

    const handleRequireEdit = (topic: any) => {
        setSelectedTopic(topic);
        setRequireEditModalVisible(true);
    };

    const confirmRequireEdit = () => {
        if (!selectedTopic || !editNotes.trim() || editNotes.length < 20) {
            return;
        }

        requireEditMutation.mutate(
            { id: selectedTopic.id, notes: editNotes },
            {
                onSuccess: () => {
                    setRequireEditModalVisible(false);
                    setSelectedTopic(null);
                    setEditNotes('');
                },
            }
        );
    };

    const confirmReject = () => {
        if (!selectedTopic || !rejectionReason.trim()) {
            return;
        }

        rejectMutation.mutate(
            { id: selectedTopic.id, reason: rejectionReason },
            {
                onSuccess: () => {
                    setRejectModalVisible(false);
                    setSelectedTopic(null);
                    setRejectionReason('');
                },
            }
        );
    };

    const columns = [
        {
            title: t('topics.topicTitle'),
            dataIndex: 'title',
            key: 'title',
            render: (text: string) => (
                <span className="font-medium">{text}</span>
            ),
        },
        {
            title: t('topics.supervisor'),
            dataIndex: 'supervisor',
            key: 'supervisor',
            render: (supervisor: any) => supervisor?.full_name || 'N/A',
        },
        {
            title: t('approveTopics.maxStudentsLabel'),
            dataIndex: 'max_students',
            key: 'max_students',
        },
        {
            title: t('topics.createdAt'),
            dataIndex: 'created_at',
            key: 'created_at',
            render: (date: string) => date ? new Date(date).toLocaleDateString('vi-VN') : 'N/A',
        },
        {
            title: t('common.status'),
            dataIndex: 'status',
            key: 'status',
            render: (status: any) => <TopicStatusBadge status={status} />,
        },
        {
            title: t('common.actions'),
            key: 'actions',
            render: (_: any, record: any) => (
                <div className="space-x-2">
                    <Button
                        type="link"
                        size="small"
                        icon={<EyeOutlined />}
                        onClick={() => viewDetail(record)}
                    >
                        {t('common.view')}
                    </Button>
                    {record.status === 'PENDING_APPROVAL' && (
                        <>
                            <Button
                                type="link"
                                size="small"
                                icon={<CheckOutlined />}
                                className="text-green-600 hover:text-green-700"
                                onClick={() => handleApprove(record.id)}
                                loading={approveMutation.isPending}
                            >
                                {t('approveTopics.approveButton')}
                            </Button>
                            <Button
                                type="link"
                                size="small"
                                icon={<EditOutlined />}
                                className="text-orange-500 hover:text-orange-600"
                                onClick={() => handleRequireEdit(record)}
                                loading={requireEditMutation.isPending}
                            >
                                {t('approveTopics.requireEditButton')}
                            </Button>
                            <Button
                                type="link"
                                danger
                                size="small"
                                icon={<CloseOutlined />}
                                onClick={() => handleReject(record)}
                                loading={rejectMutation.isPending}
                            >
                                {t('approveTopics.rejectButton')}
                            </Button>
                        </>
                    )}
                </div>
            ),
        },
    ];

    return (
        <div className="p-6 space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-foreground">{t('approveTopics.title')}</h1>
                <p className="text-muted-foreground">
                    {t('approveTopics.subtitle')}
                </p>
            </div>

            {/* Info Card */}
            <Card className="bg-blue-50 border-blue-200">
                <div className="space-y-2">
                    <h3 className="font-semibold text-blue-900">{t('approveTopics.guideTitle')}</h3>
                    <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
                        <li>{t('approveTopics.guide1')}</li>
                        <li>{t('approveTopics.guide2')}</li>
                        <li>{t('approveTopics.guide3')}</li>
                        <li>{t('approveTopics.guide4')}</li>
                    </ul>
                </div>
            </Card>

            {/* Topics Table with Tabs */}
            <Card className="shadow-soft">
                <Tabs activeKey={activeTab} onChange={setActiveTab}>
                    <TabPane
                        tab={
                            <div className="flex items-center space-x-2">
                                <span>{t('approveTopics.pendingTab')}</span>
                                <Tag color="orange" className="mr-0 rounded-full px-2 min-w-[24px] text-center border-none bg-orange-100 text-orange-600 font-bold">
                                    {stats?.PENDING_APPROVAL || 0}
                                </Tag>
                            </div>
                        }
                        key="PENDING_APPROVAL"
                    >
                        <Spin spinning={isLoading}>
                            <Table
                                columns={columns}
                                dataSource={topics}
                                rowKey="id"
                                pagination={{
                                    pageSize: 10,
                                    showTotal: (total, range) => t('approveTopics.showTotal', { range0: range[0], range1: range[1], total }),
                                    showSizeChanger: true,
                                    showQuickJumper: true,
                                    pageSizeOptions: ['10', '20', '50'],
                                }}
                                locale={{ emptyText: t('approveTopics.emptyPending') }}
                            />
                        </Spin>
                    </TabPane>

                    <TabPane 
                        tab={
                            <div className="flex items-center space-x-2">
                                <span>{t('approveTopics.requireEditTab')}</span>
                                <Tag color="warning" className="mr-0 rounded-full px-2 min-w-[24px] text-center border-none bg-yellow-100 text-yellow-600 font-bold">
                                    {stats?.REQUIRE_EDIT || 0}
                                </Tag>
                            </div>
                        } 
                        key="REQUIRE_EDIT"
                    >
                        <Spin spinning={isLoading}>
                            <Table
                                columns={columns}
                                dataSource={topics}
                                rowKey="id"
                                pagination={{
                                    pageSize: 10,
                                    showTotal: (total, range) => t('approveTopics.showTotal', { range0: range[0], range1: range[1], total }),
                                    showSizeChanger: true,
                                    showQuickJumper: true,
                                    pageSizeOptions: ['10', '20', '50'],
                                }}
                                locale={{ emptyText: t('approveTopics.emptyRequireEdit') }}
                            />
                        </Spin>
                    </TabPane>

                    <TabPane 
                        tab={
                            <div className="flex items-center space-x-2">
                                <span>{t('approveTopics.approvedTab')}</span>
                                <Tag color="success" className="mr-0 rounded-full px-2 min-w-[24px] text-center border-none bg-green-100 text-green-600 font-bold">
                                    {stats?.APPROVED || 0}
                                </Tag>
                            </div>
                        } 
                        key="APPROVED"
                    >
                        <Spin spinning={isLoading}>
                            <Table
                                columns={columns}
                                dataSource={topics}
                                rowKey="id"
                                pagination={{
                                    pageSize: 10,
                                    showTotal: (total, range) => t('approveTopics.showTotal', { range0: range[0], range1: range[1], total }),
                                    showSizeChanger: true,
                                    showQuickJumper: true,
                                    pageSizeOptions: ['10', '20', '50'],
                                }}
                                locale={{ emptyText: t('approveTopics.emptyApproved') }}
                            />
                        </Spin>
                    </TabPane>

                    <TabPane 
                        tab={
                            <div className="flex items-center space-x-2">
                                <span>{t('approveTopics.rejectedTab')}</span>
                                <Tag color="error" className="mr-0 rounded-full px-2 min-w-[24px] text-center border-none bg-red-100 text-red-600 font-bold">
                                    {stats?.REJECTED || 0}
                                </Tag>
                            </div>
                        } 
                        key="REJECTED"
                    >
                        <Spin spinning={isLoading}>
                            <Table
                                columns={columns}
                                dataSource={topics}
                                rowKey="id"
                                pagination={{
                                    pageSize: 10,
                                    showTotal: (total, range) => t('approveTopics.showTotal', { range0: range[0], range1: range[1], total }),
                                    showSizeChanger: true,
                                    showQuickJumper: true,
                                    pageSizeOptions: ['10', '20', '50'],
                                }}
                                locale={{ emptyText: t('approveTopics.emptyRejected') }}
                            />
                        </Spin>
                    </TabPane>
                </Tabs>
            </Card>

            {/* Detail Modal */}
            <Modal
                title={t('approveTopics.detailModalTitle')}
                open={detailModalVisible}
                onCancel={() => setDetailModalVisible(false)}
                footer={[
                    <Button key="close" onClick={() => setDetailModalVisible(false)}>
                        {t('common.cancel')}
                    </Button>,
                    <Button 
                        key="history" 
                        icon={<HistoryOutlined />}
                        onClick={() => setHistoryModalVisible(true)}
                    >
                        {t('topics.viewHistory')}
                    </Button>,
                    selectedTopic?.status === 'PENDING_APPROVAL' && (
                        <>
                            <Button
                                key="approve"
                                type="primary"
                                icon={<CheckOutlined />}
                                onClick={() => {
                                    handleApprove(selectedTopic.id);
                                    setDetailModalVisible(false);
                                }}
                                loading={approveMutation.isPending}
                            >
                                {t('approveTopics.approveButton')}
                            </Button>
                            <Button
                                key="requireEdit"
                                icon={<EditOutlined />}
                                className="border-orange-500 text-orange-500 hover:border-orange-600 hover:text-orange-600"
                                onClick={() => {
                                    setDetailModalVisible(false);
                                    handleRequireEdit(selectedTopic);
                                }}
                            >
                                {t('approveTopics.requireEditButton')}
                            </Button>
                            <Button
                                key="reject"
                                danger
                                icon={<CloseOutlined />}
                                onClick={() => {
                                    setDetailModalVisible(false);
                                    handleReject(selectedTopic);
                                }}
                            >
                                {t('approveTopics.rejectButton')}
                            </Button>
                        </>
                    ),
                ]}
                width={800}
            >
                {selectedTopic && (
                    <div className="space-y-4">
                        <Descriptions bordered column={1}>
                            <Descriptions.Item label={t('topics.topicTitle')}>
                                {selectedTopic.title}
                            </Descriptions.Item>
                            <Descriptions.Item label={t('topics.supervisor')}>
                                {selectedTopic.supervisor?.full_name || 'N/A'}
                            </Descriptions.Item>
                            <Descriptions.Item label={t('approveTopics.maxStudentsLabel')}>
                                {t('approveTopics.numStudents', { count: selectedTopic.max_students })}
                            </Descriptions.Item>
                            <Descriptions.Item label={t('common.status')}>
                                <TopicStatusBadge status={selectedTopic.status} />
                            </Descriptions.Item>
                            <Descriptions.Item label={t('topics.createdAt')}>
                                {selectedTopic.created_at ? new Date(selectedTopic.created_at).toLocaleString('vi-VN') : 'N/A'}
                            </Descriptions.Item>
                        </Descriptions>

                        <div>
                            <h4 className="font-semibold mb-2">{t('topics.description')}:</h4>
                            <div
                                className="prose max-w-none p-4 bg-gray-50 rounded"
                                dangerouslySetInnerHTML={{ __html: selectedTopic.description || '-' }}
                            />
                        </div>

                        {selectedTopic.objectives && (
                            <div>
                                <h4 className="font-semibold mb-2">Mục tiêu:</h4>
                                <div
                                    className="prose max-w-none p-4 bg-gray-50 rounded"
                                    dangerouslySetInnerHTML={{ __html: selectedTopic.objectives }}
                                />
                            </div>
                        )}

                        {selectedTopic.requirements && (
                            <div>
                                <h4 className="font-semibold mb-2">Yêu cầu:</h4>
                                <div
                                    className="prose max-w-none p-4 bg-gray-50 rounded"
                                    dangerouslySetInnerHTML={{ __html: selectedTopic.requirements }}
                                />
                            </div>
                        )}
                    </div>
                )}
            </Modal>

            {/* Reject Modal */}
            <Modal
                title={t('approveTopics.rejectModalTitle')}
                open={rejectModalVisible}
                onOk={confirmReject}
                onCancel={() => {
                    setRejectModalVisible(false);
                    setSelectedTopic(null);
                    setRejectionReason('');
                }}
                confirmLoading={rejectMutation.isPending}
                okText={t('approveTopics.confirmRejectButton')}
                cancelText={t('common.cancel')}
                okButtonProps={{ danger: true }}
            >
                <div className="space-y-4 my-4">
                    <p>{t('approveTopics.rejectionReasonLabel')}</p>
                    <TextArea
                        rows={5}
                        value={rejectionReason}
                        onChange={(e) => setRejectionReason(e.target.value)}
                        placeholder={t('approveTopics.rejectionReasonPlaceholder')}
                        required
                    />
                    {!rejectionReason.trim() && (
                        <p className="text-sm text-red-500">{t('approveTopics.rejectionReasonRequired')}</p>
                    )}
                </div>
            </Modal>

            {/* Require Edit Modal */}
            <Modal
                title={t('approveTopics.requireEditModalTitle')}
                open={requireEditModalVisible}
                onOk={confirmRequireEdit}
                onCancel={() => {
                    setRequireEditModalVisible(false);
                    setSelectedTopic(null);
                    setEditNotes('');
                }}
                confirmLoading={requireEditMutation.isPending}
                okText={t('approveTopics.sendRequestButton')}
                cancelText={t('common.cancel')}
                okButtonProps={{ disabled: editNotes.trim().length < 20 }}
            >
                <div className="space-y-4 my-4">
                    <p>{t('approveTopics.editNotesLabel')}</p>
                    <TextArea
                        rows={5}
                        value={editNotes}
                        onChange={(e) => setEditNotes(e.target.value)}
                        placeholder={t('approveTopics.editNotesPlaceholder')}
                        required
                        minLength={20}
                    />
                    {editNotes.trim().length > 0 && editNotes.trim().length < 20 && (
                        <p className="text-sm text-orange-500">{t('approveTopics.minCharsError', { count: 20, current: editNotes.trim().length })}</p>
                    )}
                </div>
            </Modal>

            {selectedTopic && (
                <TopicHistoryModal
                    topicId={selectedTopic.id}
                    visible={historyModalVisible}
                    onClose={() => setHistoryModalVisible(false)}
                />
            )}
        </div>
    );
};

export default HeadApproveTopics;
