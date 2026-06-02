import { useState } from 'react';
import { Card, Table, Button, Modal, Form, Input, InputNumber, Select, Tabs, Space, Popconfirm, Tag, Tooltip } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, CopyOutlined } from '@ant-design/icons';
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

    // Clone mutation
    const cloneMutation = useMutation({
        mutationFn: GradingApi.cloneGlobalCriteria,
        onSuccess: (data) => {
            notify.success(`Đã sao chép ${data?.cloned ?? 0} tiêu chí vào bộ môn${data?.skipped ? ` (bỏ qua ${data.skipped} đã tồn tại)` : ''}`);
            queryClient.invalidateQueries({ queryKey: ['gradingCriteria'] });
        },
        onError: (error: any) => {
            notify.error(error.response?.data?.error || error.message || 'Sao chép thất bại');
        },
    });

    const handleClone = () => {
        Modal.confirm({
            title: 'Khởi tạo tiêu chí bộ môn',
            content: 'Hệ thống sẽ sao chép toàn bộ tiêu chí mặc định (global) vào bộ môn của bạn. Các tiêu chí đã tồn tại sẽ được bỏ qua. Tiếp tục?',
            okText: 'Sao chép',
            cancelText: 'Hủy',
            onOk: () => cloneMutation.mutate(),
        });
    };

    const handleAdd = () => {
        setEditingId(null);
        form.resetFields();
        form.setFieldsValue({ roleGroup: activeTab });
        setIsModalVisible(true);
    };

    const handleEdit = (record: GradingCriteria) => {
        setEditingId(record.id);
        // Map role → roleGroup (canonical group)
        const roleGroupMap: Record<string, string> = {
            SUPERVISOR: 'SUPERVISOR',
            REVIEWER: 'REVIEWER',
            COMMITTEE: 'COMMITTEE',
        };
        const roleGroup = roleGroupMap[(record as any).role] ?? activeTab;
        form.setFieldsValue({
            name: record.name,
            description: record.description,
            roleGroup,
            weight: record.weight,
            maxScore: (record as any).max_score ?? (record as any).maxScore,
            minScore: (record as any).min_score ?? (record as any).minScore,
            orderIndex: (record as any).order_index ?? (record as any).orderIndex,
        });
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
                const hasGrades = (record._count?.grades ?? 0) > 0;
                const canEdit = (user?.role === 'ADMIN' || (user?.role === 'HEAD' && !isGlobal)) && !hasGrades;

                const editBtn = (
                    <Button
                        type="text"
                        icon={<EditOutlined />}
                        onClick={() => handleEdit(record)}
                        disabled={!canEdit}
                    />
                );
                const deleteBtn = (
                    <Popconfirm
                        title={t('common.confirmDelete')}
                        onConfirm={() => handleDelete(record.id)}
                        okText={t('common.yes')}
                        cancelText={t('common.no')}
                        disabled={!canEdit}
                    >
                        <Button type="text" danger icon={<DeleteOutlined />} disabled={!canEdit} />
                    </Popconfirm>
                );

                return (
                    <Space>
                        {hasGrades ? (
                            <Tooltip title="Tiêu chí đã được dùng để chấm điểm, không thể sửa/xoá">
                                {editBtn}
                            </Tooltip>
                        ) : editBtn}
                        {hasGrades ? (
                            <Tooltip title="Tiêu chí đã được dùng để chấm điểm, không thể sửa/xoá">
                                {deleteBtn}
                            </Tooltip>
                        ) : deleteBtn}
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
                        <Space>
                            {user?.role === 'HEAD' && (
                                <Tooltip title="Sao chép bộ tiêu chí mặc định vào bộ môn để có thể chỉnh sửa">
                                    <Button
                                        icon={<CopyOutlined />}
                                        onClick={handleClone}
                                        loading={cloneMutation.isPending}
                                    >
                                        Khởi tạo tiêu chí bộ môn
                                    </Button>
                                </Tooltip>
                            )}
                            <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
                                {t('common.add')}
                            </Button>
                        </Space>
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
                            <Select>
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
