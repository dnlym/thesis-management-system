import { useState } from 'react';
import { Card, Table, Button, Modal, Form, Input, InputNumber, Select, Tabs, Space, Popconfirm, Tag } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { notify } from '@/utils/notification';
import { GradingApi } from '@/api/grading';
import { useAuthStore } from '@/store/auth';
import { GradingCriteria, CriteriaType } from '@/types';

const { TabPane } = Tabs;
const { Option } = Select;

const Criteria = () => {
    const { t } = useTranslation();
    const queryClient = useQueryClient();
    const { user } = useAuthStore();
    const [isModalVisible, setIsModalVisible] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [form] = Form.useForm();
    const [activeTab, setActiveTab] = useState<CriteriaType>('ADVISOR');

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
        form.setFieldsValue({ criteriaType: activeTab });
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
            // Map frontend types to backend types
            let backendType = values.criteriaType;
            if (values.criteriaType === 'ADVISOR') backendType = 'SUPERVISOR';
            if (values.criteriaType === 'COUNCIL') backendType = 'COMMITTEE';

            const payload = { ...values, criteriaType: backendType };

            if (editingId) {
                updateMutation.mutate({ id: editingId, data: payload });
            } else {
                createMutation.mutate(payload);
            }
        });
    };

    const columns = [
        {
            title: t('common.name'),
            dataIndex: 'name',
            key: 'name',
            width: '30%',
        },
        {
            title: t('common.description'),
            dataIndex: 'description',
            key: 'description',
            ellipsis: true,
        },
        {
            title: t('criteria.weight'),
            dataIndex: 'weight',
            key: 'weight',
            width: '10%',
            render: (weight: number) => <Tag color="blue">{weight}</Tag>,
        },
        {
            title: t('criteria.maxScore'),
            dataIndex: 'maxScore',
            key: 'maxScore',
            width: '10%',
        },
        {
            title: 'Đơn vị',
            key: 'department',
            width: '10%',
            render: (_: any, record: any) => (
                record.departmentId ? <Tag color="blue">Bộ môn</Tag> : <Tag color="purple">Chung</Tag>
            )
        },
        {
            title: t('common.actions'),
            key: 'actions',
            width: '150px',
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

    const getCriteriaList = (type: CriteriaType) => {
        if (!criteriaMap) return [];
        // The backend returns a map where keys are criteria types
        // We need to handle potential case sensitivity or mapping issues
        // Assuming backend returns keys like 'SUPERVISOR', 'REVIEWER', 'COMMITTEE'
        // But frontend types are 'ADVISOR', 'REVIEWER', 'COUNCIL'

        let backendKey = type as string;
        if (type === 'ADVISOR') backendKey = 'SUPERVISOR';
        if (type === 'COUNCIL') backendKey = 'COMMITTEE';

        return criteriaMap[backendKey] || [];
    };

    return (
        <div className="p-6">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold text-foreground">{t('navigation.criteria')}</h1>
                <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
                    {t('common.add')}
                </Button>
            </div>

            <Card className="shadow-soft">
                <Tabs
                    activeKey={activeTab}
                    onChange={(key) => setActiveTab(key as CriteriaType)}
                >
                    <TabPane tab={t('role.advisor')} key="ADVISOR">
                        <Table
                            columns={columns}
                            dataSource={getCriteriaList('ADVISOR')}
                            rowKey="id"
                            loading={isLoading}
                            pagination={false}
                        />
                    </TabPane>
                    <TabPane tab={t('role.reviewer')} key="REVIEWER">
                        <Table
                            columns={columns}
                            dataSource={getCriteriaList('REVIEWER')}
                            rowKey="id"
                            loading={isLoading}
                            pagination={false}
                        />
                    </TabPane>
                    <TabPane tab={t('role.council')} key="COUNCIL">
                        <Table
                            columns={columns}
                            dataSource={getCriteriaList('COUNCIL')}
                            rowKey="id"
                            loading={isLoading}
                            pagination={false}
                        />
                    </TabPane>
                </Tabs>
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
                        name="criteriaType"
                        label={t('criteria.type')}
                        rules={[{ required: true, message: t('validation.required') }]}
                    >
                        <Select disabled={!!editingId}>
                            <Option value="ADVISOR">{t('role.advisor')}</Option>
                            <Option value="REVIEWER">{t('role.reviewer')}</Option>
                            <Option value="COUNCIL">{t('role.council')}</Option>
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
    );
};

export default Criteria;
