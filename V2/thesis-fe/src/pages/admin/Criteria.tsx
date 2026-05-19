import { useState } from 'react';
import { Card, Table, Button, Modal, Form, Input, InputNumber, Select, Tabs, Space, Popconfirm, Tag } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { notify } from '@/utils/notification';
import { GradingApi } from '@/api/grading';
import { useAuthStore } from '@/store/auth';
import { GradingCriteria, RaterRole } from '@/types';

const { TabPane } = Tabs;
const { Option } = Select;

const Criteria = () => {
    const { t } = useTranslation();
    const queryClient = useQueryClient();
    const { user } = useAuthStore();
    const [isModalVisible, setIsModalVisible] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [form] = Form.useForm();
    const [activeTab, setActiveTab] = useState<string>('SUPERVISOR');

    // Fetch criteria
    const { data: criteriaMap, isLoading } = useQuery({
        queryKey: ['gradingCriteria', user?.department_id, user?.role],
        queryFn: async () => {
            const response = await GradingApi.getCriteria({
                departmentId: user?.role === 'HEAD' ? user?.department_id : undefined
            });
            return response as unknown as Record<string, GradingCriteria[]>;
        },
    });

    // Create mutation
    const createMutation = useMutation({
        mutationFn: GradingApi.createCriterion,
        onSuccess: () => {
            notify.success(t('common.createSuccess'));
            setIsModalVisible(false);
            form.resetFields();
            queryClient.invalidateQueries({ queryKey: ['gradingCriteria'] });
        },
        onError: (error: any) => {
            const errorMsg = error.response?.data?.error || error.response?.data?.message || error.message || t('common.createError');
            notify.error(errorMsg);
        },
    });

    // Update mutation
    const updateMutation = useMutation({
        mutationFn: ({ id, data }: { id: string; data: Partial<GradingCriteria> }) =>
            GradingApi.updateCriterion(id, data),
        onSuccess: () => {
            notify.success(t('common.updateSuccess'));
            setIsModalVisible(false);
            setEditingId(null);
            form.resetFields();
            queryClient.invalidateQueries({ queryKey: ['gradingCriteria'] });
        },
        onError: (error: any) => {
            const errorMsg = error.response?.data?.error || error.response?.data?.message || error.message || t('common.updateError');
            notify.error(errorMsg);
        },
    });

    // Delete mutation
    const deleteMutation = useMutation({
        mutationFn: GradingApi.deleteCriterion,
        onSuccess: () => {
            notify.success(t('common.deleteSuccess'));
            queryClient.invalidateQueries({ queryKey: ['gradingCriteria'] });
        },
        onError: (error: any) => {
            const errorMsg = error.response?.data?.error || error.response?.data?.message || error.message || t('common.deleteError');
            notify.error(errorMsg);
        },
    });

    const handleAdd = () => {
        setEditingId(null);
        form.resetFields();
        form.setFieldsValue({ roleGroup: activeTab });
        setIsModalVisible(true);
    };

    const handleEdit = (record: GradingCriteria) => {
        setEditingId(record.id);
        form.setFieldsValue(record);
        setIsModalVisible(true);
    };

    const handleDelete = (id: string) => {
        deleteMutation.mutate(id);
    };

    const handleOk = () => {
        form.validateFields().then((values) => {
            // Map generic groups to actual default roles
            let backendRole = values.roleGroup;
            if (values.roleGroup === 'SUPERVISOR') backendRole = 'SUPERVISOR';
            if (values.roleGroup === 'REVIEWER') backendRole = 'REVIEWER_1';
            if (values.roleGroup === 'COMMITTEE') backendRole = 'COMMITTEE_MEMBER';

            const payload = { ...values, role: backendRole };
            delete payload.roleGroup;

            if (editingId) {
                updateMutation.mutate({ id: editingId, data: payload });
            } else {
                createMutation.mutate(payload);
            }
        });
    };

    const columns = [
        {
            title: 'STT',
            key: 'stt',
            width: 80,
            align: 'center' as const,
            render: (_: any, __: any, index: number) => <span className="font-bold text-slate-400">{index + 1}</span>,
        },
        {
            title: 'LO',
            dataIndex: 'name',
            key: 'name',
            width: '60%',
        },
        {
            title: 'TRỌNG SỐ',
            dataIndex: 'weight',
            key: 'weight',
            width: '120px',
            render: (weight: number) => <Tag color="blue">{weight}</Tag>,
        },
        {
            title: 'THAO TÁC',
            key: 'actions',
            width: '120px',
            render: (_: any, record: any) => {
                const isGlobal = !record.departmentId;
                const canEdit = user?.role === 'ADMIN' || (user?.role === 'HEAD' && !isGlobal);

                return (
                    <Space>
                        <Button
                            type="text"
                            icon={<EditOutlined />}
                            onClick={() => handleEdit(record)}
                            disabled={!canEdit}
                        />
                        <Popconfirm
                            title={t('common.confirmDelete')}
                            onConfirm={() => handleDelete(record.id)}
                            okText={t('common.yes')}
                            cancelText={t('common.no')}
                            disabled={!canEdit}
                        >
                            <Button type="text" danger icon={<DeleteOutlined />} disabled={!canEdit} />
                        </Popconfirm>
                    </Space>
                );
            },
        },
    ];

    const getCriteriaList = (group: string) => {
        if (!criteriaMap) return [];
        return criteriaMap[group] || [];
    };

    return (
        <div className="page-container">
            <div className="page-inner">
                {/* Header */}
                <Card className="page-header-card">
                    <div className="flex justify-between items-center">
                        <div className="flex items-center gap-3">
                            <div className="page-header-icon"><PlusOutlined className="text-base" /></div>
                            <div>
                                <div className="page-header-title">{t('navigation.criteria')}</div>
                                <div className="page-header-subtitle">Quản lý các tiêu chí đánh giá cho từng vai trò (Hướng dẫn, Phản biện, Hội đồng)</div>
                            </div>
                        </div>
                        <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
                            {t('common.add')}
                        </Button>
                    </div>
                </Card>

                <Card className="page-toolbar-card !mb-4">
                    <Tabs
                        activeKey={activeTab}
                        onChange={(key) => setActiveTab(key)}
                        className="sys-tabs sys-tabs-capsule !mb-0"
                        items={[
                            { key: 'SUPERVISOR', label: t('role.advisor') },
                            { key: 'REVIEWER', label: t('role.reviewer') },
                            { key: 'COMMITTEE', label: t('role.council') }
                        ]}
                    />
                </Card>

                <Card className="page-card-flush">
                    <Table
                        columns={columns}
                        dataSource={getCriteriaList(activeTab)}
                        rowKey="id"
                        loading={isLoading}
                        pagination={false}
                        className="sys-table"
                    />
                </Card>

                <Modal
                    title={editingId ? t('criteria.edit') : t('criteria.add')}
                    open={isModalVisible}
                    onOk={handleOk}
                    onCancel={() => setIsModalVisible(false)}
                    confirmLoading={createMutation.isPending || updateMutation.isPending}
                >
                    <Form form={form} layout="vertical">
                        <Form.Item
                            name="name"
                            label={t('common.name')}
                            rules={[{ required: true, message: t('validation.required') }]}
                        >
                            <Input />
                        </Form.Item>
                        <Form.Item
                            name="description"
                            label={t('common.description')}
                        >
                            <Input.TextArea rows={3} />
                        </Form.Item>
                        <Form.Item
                            name="roleGroup"
                            label={t('criteria.type')}
                            rules={[{ required: true, message: t('validation.required') }]}
                        >
                            <Select disabled={!!editingId}>
                                <Option value="SUPERVISOR">{t('role.advisor')}</Option>
                                <Option value="REVIEWER">{t('role.reviewer')}</Option>
                                <Option value="COMMITTEE">{t('role.council')}</Option>
                            </Select>
                        </Form.Item>
                        <div className="grid grid-cols-2 gap-4">
                            <Form.Item
                                name="weight"
                                label={t('criteria.weight')}
                                rules={[
                                    { required: true, message: t('validation.required') },
                                    { type: 'number', min: 0, max: 1, message: t('validation.range', { min: 0, max: 1 }) }
                                ]}
                            >
                                <InputNumber step={0.1} style={{ width: '100%' }} />
                            </Form.Item>
                            <Form.Item
                                name="maxScore"
                                label={t('criteria.maxScore')}
                                rules={[{ required: true, message: t('validation.required') }]}
                                initialValue={10}
                            >
                                <InputNumber min={0} style={{ width: '100%' }} />
                            </Form.Item>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <Form.Item
                                name="minScore"
                                label={t('criteria.minScore')}
                                rules={[{ required: true, message: t('validation.required') }]}
                                initialValue={0}
                            >
                                <InputNumber min={0} style={{ width: '100%' }} />
                            </Form.Item>
                            <Form.Item
                                name="orderIndex"
                                label={t('criteria.order')}
                                rules={[{ required: true, message: t('validation.required') }]}
                                initialValue={0}
                            >
                                <InputNumber min={0} style={{ width: '100%' }} />
                            </Form.Item>
                        </div>
                    </Form>
                </Modal>
            </div>
        </div>
    );
};

export default Criteria;
