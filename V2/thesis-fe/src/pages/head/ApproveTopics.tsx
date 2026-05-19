import { useState } from 'react';
import { Card, Table, Button, Modal, Descriptions, Tag, Input, Tabs, Spin, Alert, Typography, Tooltip } from 'antd';
import { useTranslation } from 'react-i18next';
import { CheckOutlined, CloseOutlined, EyeOutlined, EditOutlined, HistoryOutlined } from '@ant-design/icons';
import { TopicStatusBadge } from '@/components/StatusBadge';
import { useTopics, useApproveTopic, useRejectTopic, useRequireEdit, useTopicStats } from '@/hooks/useTopics';
import TopicHistoryModal from '@/components/TopicHistoryModal';

const { TextArea } = Input;
const { TabPane } = Tabs;
const { Text } = Typography;

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
    const [pageSize, setPageSize] = useState(10);

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
        if (!selectedTopic || !rejectionReason.trim() || rejectionReason.length < 20) {
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
            title: t('common.stt'),
            key: 'stt',
            width: 60,
            align: 'center' as const,
            render: (_: any, __: any, index: number) => index + 1,
        },
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
            align: 'center' as const,
            width: 160,
            render: (_: any, record: any) => (
                <div className="flex items-center justify-center gap-1">
                    <Tooltip title={t('common.view')}>
                        <Button
                            type="text"
                            size="small"
                            icon={<EyeOutlined className="text-blue-600" />}
                            onClick={() => viewDetail(record)}
                            className="hover:bg-blue-50"
                        />
                    </Tooltip>
                    {record.status === 'PENDING_APPROVAL' && (
                        <>
                            <Tooltip title={t('approveTopics.approveButton')}>
                                <Button
                                    type="text"
                                    size="small"
                                    icon={<CheckOutlined className="text-green-600" />}
                                    className="hover:bg-green-50"
                                    onClick={() => handleApprove(record.id)}
                                    loading={approveMutation.isPending}
                                />
                            </Tooltip>
                            <Tooltip title={t('approveTopics.requireEditButton')}>
                                <Button
                                    type="text"
                                    size="small"
                                    icon={<EditOutlined className="text-orange-500" />}
                                    className="hover:bg-orange-50"
                                    onClick={() => handleRequireEdit(record)}
                                    loading={requireEditMutation.isPending}
                                />
                            </Tooltip>
                            <Tooltip title={t('approveTopics.rejectButton')}>
                                <Button
                                    type="text"
                                    danger
                                    size="small"
                                    icon={<CloseOutlined />}
                                    className="hover:bg-red-50"
                                    onClick={() => handleReject(record)}
                                    loading={rejectMutation.isPending}
                                />
                            </Tooltip>
                        </>
                    )}
                </div>
            ),
        },
    ];

    return (
        <div className="page-container">
            <div className="page-inner">
                {/* Header */}
                <Card className="page-header-card">
                    <div className="flex items-center gap-3">
                        <div className="page-header-icon"><CheckOutlined className="text-base" /></div>
                        <div>
                            <div className="page-header-title">{t('approveTopics.title')}</div>
                            <div className="page-header-subtitle">{t('approveTopics.subtitle')}</div>
                        </div>
                    </div>
                </Card>


                {/* Topics Table with Tabs */}
                <Card className="page-card-flush">
                    <Tabs activeKey={activeTab} onChange={setActiveTab} className="sys-tabs sys-tabs-capsule" tabBarStyle={{ paddingLeft: '24px', paddingTop: '8px' }}>
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
                                size="middle"
                                className="sys-table"
                                pagination={{
                                    pageSize: pageSize,
                                    showSizeChanger: true,
                                    pageSizeOptions: ['10', '20', '50', '100'],
                                    onShowSizeChange: (_, size) => setPageSize(size),
                                    showTotal: (total, range) => t('approveTopics.showTotal', { range0: range[0], range1: range[1], total }),
                                    showQuickJumper: true,
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
                                size="middle"
                                className="sys-table"
                                pagination={{
                                    pageSize: pageSize,
                                    showSizeChanger: true,
                                    pageSizeOptions: ['10', '20', '50', '100'],
                                    onShowSizeChange: (_, size) => setPageSize(size),
                                    showTotal: (total, range) => t('approveTopics.showTotal', { range0: range[0], range1: range[1], total }),
                                    showQuickJumper: true,
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
                                size="middle"
                                className="sys-table"
                                pagination={{
                                    pageSize: pageSize,
                                    showSizeChanger: true,
                                    pageSizeOptions: ['10', '20', '50', '100'],
                                    onShowSizeChange: (_, size) => setPageSize(size),
                                    showTotal: (total, range) => t('approveTopics.showTotal', { range0: range[0], range1: range[1], total }),
                                    showQuickJumper: true,
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
                                size="middle"
                                className="sys-table"
                                pagination={{
                                    pageSize: pageSize,
                                    showSizeChanger: true,
                                    pageSizeOptions: ['10', '20', '50', '100'],
                                    onShowSizeChange: (_, size) => setPageSize(size),
                                    showTotal: (total, range) => t('approveTopics.showTotal', { range0: range[0], range1: range[1], total }),
                                    showQuickJumper: true,
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
                        {t('common.close')}
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
                centered
                bodyStyle={{ maxHeight: '70vh', overflowY: 'auto', padding: '24px' }}
            >
                {selectedTopic && (
                    <div className="space-y-6">
                        {/* Status Alerts */}
                        {selectedTopic.status === 'REJECTED' && selectedTopic.rejection_reason && (
                            <Alert
                                message={<Text strong className="text-red-700">Lý do từ chối từ Trưởng bộ môn</Text>}
                                description={selectedTopic.rejection_reason}
                                type="error"
                                showIcon
                                className="rounded-lg border-red-100"
                            />
                        )}
                        {selectedTopic.status === 'REQUIRE_EDIT' && selectedTopic.edit_notes && (
                            <Alert
                                message={<Text strong className="text-orange-700">Yêu cầu chỉnh sửa từ Trưởng bộ môn</Text>}
                                description={selectedTopic.edit_notes}
                                type="warning"
                                showIcon
                                className="rounded-lg border-orange-100"
                            />
                        )}

                        <Descriptions 
                            bordered 
                            column={2} 
                            size="small" 
                            className="sys-descriptions bg-slate-50/30"
                            labelStyle={{ fontWeight: 600, width: '160px', background: '#f8fafc' }}
                        >
                            <Descriptions.Item label={t('topics.topicTitle')} span={2}>
                                <Text strong className="text-[15px]">{selectedTopic.title}</Text>
                            </Descriptions.Item>
                            <Descriptions.Item label={t('topics.supervisor')}>
                                {selectedTopic.supervisor?.full_name || 'N/A'}
                            </Descriptions.Item>
                            <Descriptions.Item label={t('approveTopics.maxStudentsLabel')}>
                                <Tag color="blue" className="m-0">{t('approveTopics.numStudents', { count: selectedTopic.max_students })}</Tag>
                            </Descriptions.Item>
                            <Descriptions.Item label={t('common.status')}>
                                <TopicStatusBadge status={selectedTopic.status} />
                            </Descriptions.Item>
                            <Descriptions.Item label={t('topics.createdAt')}>
                                {selectedTopic.created_at ? new Date(selectedTopic.created_at).toLocaleString('vi-VN') : 'N/A'}
                            </Descriptions.Item>
                        </Descriptions>

                        <div className="space-y-4">
                            <div className="content-block">
                                <div className="flex items-center gap-2 mb-2">
                                    <div className="w-1 h-4 bg-blue-500 rounded-full"></div>
                                    <h4 className="font-bold text-slate-800 m-0">{t('topics.description')}</h4>
                                </div>
                                <div
                                    className="p-4 bg-gray-50 border border-gray-100 rounded-lg text-gray-700 leading-relaxed"
                                    dangerouslySetInnerHTML={{ __html: selectedTopic.description || '-' }}
                                />
                            </div>

                            {selectedTopic.objectives && (
                                <div className="content-block">
                                    <div className="flex items-center gap-2 mb-2">
                                        <div className="w-1 h-4 bg-green-500 rounded-full"></div>
                                        <h4 className="font-bold text-slate-800 m-0">{t('topics.objectives')}</h4>
                                    </div>
                                    <div
                                        className="p-4 bg-gray-50 border border-gray-100 rounded-lg text-gray-700 leading-relaxed"
                                        dangerouslySetInnerHTML={{ __html: selectedTopic.objectives }}
                                    />
                                </div>
                            )}

                            {selectedTopic.requirements && (
                                <div className="content-block">
                                    <div className="flex items-center gap-2 mb-2">
                                        <div className="w-1 h-4 bg-purple-500 rounded-full"></div>
                                        <h4 className="font-bold text-slate-800 m-0">{t('topics.requirements')}</h4>
                                    </div>
                                    <div
                                        className="p-4 bg-gray-50 border border-gray-100 rounded-lg text-gray-700 leading-relaxed"
                                        dangerouslySetInnerHTML={{ __html: selectedTopic.requirements }}
                                    />
                                </div>
                            )}
                        </div>
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
                okButtonProps={{ danger: true, disabled: rejectionReason.trim().length < 20 }}
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
                    {rejectionReason.trim().length > 0 && rejectionReason.trim().length < 20 && (
                        <p className="text-sm text-red-500">{t('approveTopics.minCharsError', { count: 20, current: rejectionReason.trim().length })}</p>
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
        </div>
    );
};

export default HeadApproveTopics;
