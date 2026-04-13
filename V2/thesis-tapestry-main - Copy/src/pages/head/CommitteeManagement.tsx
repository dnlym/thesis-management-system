import { useState, useMemo } from 'react';
import { Card, Table, Button, Tag, Modal, Form, Input, Select, Space, message, Divider, Popconfirm } from 'antd';
import { PlusOutlined, DeleteOutlined, EditOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { CommitteeApi, Committee } from '@/api/committee';
import { UsersApi } from '@/api/users';
import { useActiveSemester } from '@/hooks/useActiveSemester';

const CommitteeManagement = () => {
    const { t } = useTranslation();
    const queryClient = useQueryClient();
    const { data: activeSemester } = useActiveSemester();
    const semesterId = activeSemester?.id;

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingCommittee, setEditingCommittee] = useState<Committee | null>(null);
    const [form] = Form.useForm();

    // Fetch committees
    const { data: committees, isLoading } = useQuery({
        queryKey: ['committees', semesterId],
        queryFn: () => CommitteeApi.getCommittees(semesterId!),
        enabled: !!semesterId,
    });

    // Fetch lecturers for selection
    const { data: lecturers } = useQuery({
        queryKey: ['lecturers'],
        queryFn: () => UsersApi.getAll({ role: 'LECTURER' }),
    });

    // Fetch lecturers who are already in a committee for this semester (global validation)
    const { data: busyLecturerIds = [] } = useQuery({
        queryKey: ['busy-lecturers', semesterId],
        queryFn: () => CommitteeApi.getBusyLecturers(semesterId!),
        enabled: !!semesterId,
    });

    const watchedMembers = Form.useWatch('members', form) || [];
    const currentCommitteeLecturerIds = useMemo(() => {
        return new Set(editingCommittee?.members.map(m => m.lecturerId) || []);
    }, [editingCommittee]);

    const selectedInFormIds = useMemo(() => {
        return new Set(watchedMembers.map((m: any) => m?.lecturerId).filter(Boolean));
    }, [watchedMembers]);

    const createMutation = useMutation({
        mutationFn: CommitteeApi.createCommittee,
        onSuccess: () => {
            message.success(t('committeeManagement.createSuccess'));
            setIsModalOpen(false);
            queryClient.invalidateQueries({ queryKey: ['committees'] });
        },
        onError: (error: any) => {
            message.error(error?.response?.data?.error || t('committeeManagement.createError'));
        }
    });

    const updateMutation = useMutation({
        mutationFn: ({ id, data }: { id: string, data: any }) => CommitteeApi.updateCommittee(id, data),
        onSuccess: () => {
            message.success(t('committeeManagement.updateSuccess'));
            setIsModalOpen(false);
            queryClient.invalidateQueries({ queryKey: ['committees'] });
        },
        onError: (error: any) => {
            message.error(error?.response?.data?.error || t('committeeManagement.updateError'));
        }
    });

    const deleteMutation = useMutation({
        mutationFn: CommitteeApi.deleteCommittee,
        onSuccess: () => {
            message.success(t('committeeManagement.deleteSuccess'));
            queryClient.invalidateQueries({ queryKey: ['committees'] });
        },
        onError: (error: any) => {
            message.error(error?.response?.data?.error || t('committeeManagement.deleteError'));
        }
    });

    const handleEdit = (record: Committee) => {
        setEditingCommittee(record);
        form.setFieldsValue({
            name: record.name,
            type: record.type || 'ORAL',
            roomPreference: record.room_preference,
            members: record.members.map(m => ({
                lecturerId: m.lecturerId,
                role: m.role
            }))
        });
        setIsModalOpen(true);
    };

    const handleAdd = () => {
        setEditingCommittee(null);
        form.resetFields();
        form.setFieldsValue({
            type: 'ORAL',
            members: [
                { role: 'CHAIR' },
                { role: 'SECRETARY' },
                { role: 'MEMBER' }
            ]
        });
        setIsModalOpen(true);
    };

    const handleSubmit = async () => {
        if (!semesterId) {
            message.error(t('semester.selectRequired'));
            return;
        }
        const values = await form.validateFields();
        const payload = {
            ...values,
            semesterId,
        };

        if (editingCommittee) {
            updateMutation.mutate({ id: editingCommittee.id, data: payload });
        } else {
            createMutation.mutate(payload);
        }
    };

    const columns = [
        {
            title: t('committeeManagement.nameLabel'),
            dataIndex: 'name',
            key: 'name',
            className: 'font-semibold',
            render: (text: string, record: Committee) => (
                <div className="flex flex-col">
                    <span>{text}</span>
                    <Tag color={record.type === 'POSTER' ? 'cyan' : 'blue'} className="w-fit mt-1 text-[10px] leading-3 uppercase">
                        {record.type || 'ORAL'}
                    </Tag>
                </div>
            )
        },
        {
            title: t('committeeManagement.roomPreference'),
            dataIndex: 'room_preference',
            key: 'room_preference',
            render: (text: string) => text ? <Tag color="orange">{text}</Tag> : '-'
        },
        {
            title: t('committeeManagement.membersDivider'),
            key: 'members',
            render: (_: any, record: Committee) => (
                <div className="flex flex-wrap gap-2">
                    {record.members.sort((a, b) => {
                        const order = { CHAIR: 1, SECRETARY: 2, MEMBER: 3 };
                        return order[a.role] - order[b.role];
                    }).map((m: any) => (
                        <Tag
                            key={m.id || m.lecturerId}
                            color={m.role === 'CHAIR' ? 'gold' : m.role === 'SECRETARY' ? 'blue' : 'default'}
                            className="flex items-center gap-1"
                        >
                            <span className="font-bold">
                                {m.role === 'CHAIR' ? t('committeeManagement.roleChairShort') : m.role === 'SECRETARY' ? t('committeeManagement.roleSecretaryShort') : t('committeeManagement.roleMemberShort')}
                            </span>
                            <span>{m.lecturer?.full_name || m.fullName}</span>
                        </Tag>
                    ))}
                </div>
            )
        },
        {
            title: t('common.actions'),
            key: 'action',
            align: 'right' as const,
            render: (_: any, record: Committee) => (
                <Space>
                    <Button
                        type="text"
                        icon={<EditOutlined className="text-blue-600" />}
                        onClick={() => handleEdit(record)}
                    />
                    <Popconfirm
                        title={t('committeeManagement.deleteConfirm')}
                        description={t('committeeManagement.deleteDescription')}
                        onConfirm={() => deleteMutation.mutate(record.id)}
                        okText={t('common.delete')}
                        cancelText={t('common.cancel')}
                        okButtonProps={{ danger: true }}
                    >
                        <Button type="text" danger icon={<DeleteOutlined />} />
                    </Popconfirm>
                </Space>
            )
        }
    ];

    return (
        <div className="p-6 max-w-7xl mx-auto">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800">{t('committeeManagement.title')}</h1>
                    <p className="text-gray-500">{t('committeeManagement.description', { semester: activeSemester?.name })}</p>
                </div>
                <Button
                    type="primary"
                    icon={<PlusOutlined />}
                    size="large"
                    onClick={handleAdd}
                    className="shadow-md"
                >
                    {t('committeeManagement.addCommittee')}
                </Button>
            </div>

            <Card className="shadow-sm border-0">
                <Table
                    dataSource={committees}
                    columns={columns}
                    loading={isLoading}
                    rowKey="id"
                    pagination={false}
                />
            </Card>

            <Modal
                title={
                    <div className="flex items-center gap-2">
                        <PlusOutlined />
                        <span>{editingCommittee ? t('committeeManagement.editCommittee') : t('committeeManagement.newCommittee')}</span>
                    </div>
                }
                open={isModalOpen}
                onOk={handleSubmit}
                onCancel={() => setIsModalOpen(false)}
                width={800}
                confirmLoading={createMutation.isPending || updateMutation.isPending}
                okText={editingCommittee ? t('common.update') : t('committeeManagement.addCommittee')}
                cancelText={t('common.cancel')}
                centered
            >
                <Form form={form} layout="vertical" className="mt-4">
                    <div className="grid grid-cols-3 gap-4">
                        <Form.Item
                            name="name"
                            label={t('committeeManagement.nameLabel')}
                            rules={[{ required: true, message: t('committeeManagement.nameRequired') }]}
                            className="col-span-1"
                        >
                            <Input placeholder={t('committeeManagement.namePlaceholder')} size="large" />
                        </Form.Item>
                        <Form.Item
                            name="type"
                            label={t('committeeManagement.typeLabel', 'Loại hội đồng')}
                            rules={[{ required: true }]}
                        >
                            <Select
                                size="large"
                                onChange={(val) => {
                                    const currentMembers = form.getFieldValue('members') || [];
                                    if (val === 'POSTER') {
                                        form.setFieldsValue({
                                            members: currentMembers.slice(0, 2).map((m: any) => ({ ...m, role: 'MEMBER' }))
                                        });
                                    } else if (val === 'ORAL' && currentMembers.length < 3) {
                                        form.setFieldsValue({
                                            members: [
                                                { role: 'CHAIR' },
                                                { role: 'SECRETARY' },
                                                { role: 'MEMBER' }
                                            ]
                                        });
                                    }
                                }}
                            >
                                <Select.Option value="ORAL">ORAL (Vấn đáp)</Select.Option>
                                <Select.Option value="POSTER">POSTER</Select.Option>
                            </Select>
                        </Form.Item>
                        <Form.Item name="roomPreference" label={t('committeeManagement.roomPreferenceLabel')}>
                            <Input placeholder={t('committeeManagement.roomPreferencePlaceholder')} size="large" />
                        </Form.Item>
                    </div>

                    <Divider orientation="left" className="text-gray-400">{t('committeeManagement.membersDivider')}</Divider>

                    <Form.List
                        name="members"
                        rules={[
                            {
                                validator: async (_, members) => {
                                    const type = form.getFieldValue('type');
                                    if (type === 'POSTER') {
                                        if (!members || members.length !== 2) {
                                            return Promise.reject(new Error('Hội đồng Poster phải có đúng 2 giảng viên'));
                                        }
                                    } else {
                                        if (!members || members.length < 3) {
                                            return Promise.reject(new Error(t('committeeManagement.minMembersError')));
                                        }
                                        const roles = members.map((m: any) => m.role);
                                        if (!roles.includes('CHAIR')) return Promise.reject(new Error(t('committeeManagement.chairRequired')));
                                        if (!roles.includes('SECRETARY')) return Promise.reject(new Error(t('committeeManagement.secretaryRequired')));
                                    }
                                },
                            },
                        ]}
                    >
                        {(fields, { add, remove }, { errors }) => (
                            <>
                                <div className="space-y-3">
                                    {fields.map(({ key, name, ...restField }) => (
                                        <div key={key} className="flex gap-3 items-start animate-in fade-in slide-in-from-top-1">
                                            <Form.Item
                                                {...restField}
                                                name={[name, 'role']}
                                                rules={[{ required: true, message: t('common.requiredField') }]}
                                                className="mb-0 flex-none w-32"
                                            >
                                                <Select size="large">
                                                    <Select.Option value="CHAIR">{t('committeeManagement.roleChair')}</Select.Option>
                                                    <Select.Option value="SECRETARY">{t('committeeManagement.roleSecretary')}</Select.Option>
                                                    <Select.Option value="MEMBER">{t('committeeManagement.roleMember')}</Select.Option>
                                                </Select>
                                            </Form.Item>
                                            <Form.Item
                                                {...restField}
                                                name={[name, 'lecturerId']}
                                                rules={[{ required: true, message: t('common.requiredField') }]}
                                                className="mb-0 flex-1"
                                            >
                                                <Select
                                                    size="large"
                                                    showSearch
                                                    placeholder={t('committeeManagement.selectLecturerPlaceholder')}
                                                    filterOption={(input, option) =>
                                                        (option?.label as string)?.toLowerCase().includes(input.toLowerCase())
                                                    }
                                                    options={lecturers?.map(l => {
                                                        const isSelectedInOtherRow = watchedMembers.some((m: any, idx: number) => idx !== name && m?.lecturerId === l.id);
                                                        const isAssigned = busyLecturerIds.includes(l.id) && !currentCommitteeLecturerIds.has(l.id);
                                                        return {
                                                            value: l.id,
                                                            label: l.full_name,
                                                            email: l.email,
                                                            disabled: isAssigned || isSelectedInOtherRow,
                                                            isAssigned,
                                                            isSelectedInOtherRow,
                                                        };
                                                    })}
                                                    optionRender={(option) => (
                                                        <div className={`py-1 ${option.data.disabled ? 'opacity-50' : ''}`}>
                                                            <div className="font-medium text-gray-800">
                                                                {option.data.label}
                                                                {option.data.isAssigned && (
                                                                    <Tag color="red" className="ml-2 text-xs">{t('committeeManagement.alreadyAssigned', 'Đã có HĐ')}</Tag>
                                                                )}
                                                                {option.data.isSelectedInOtherRow && (
                                                                    <Tag color="orange" className="ml-2 text-xs">{t('committeeManagement.alreadySelected', 'Đã chọn')}</Tag>
                                                                )}
                                                            </div>
                                                            <div className="text-xs text-gray-400">{option.data.email}</div>
                                                        </div>
                                                    )}
                                                />
                                            </Form.Item>
                                            {((form.getFieldValue('type') === 'ORAL' && fields.length > 3) ||
                                                (form.getFieldValue('type') === 'POSTER' && fields.length > 2)) && (
                                                    <Button
                                                        type="text"
                                                        danger
                                                        icon={<DeleteOutlined />}
                                                        onClick={() => remove(name)}
                                                        className="mt-1"
                                                    />
                                                )}
                                        </div>
                                    ))}
                                </div>

                                <Form.ErrorList errors={errors} className="mt-2 text-red-500 text-sm" />

                                {form.getFieldValue('type') === 'ORAL' && (
                                    <Button
                                        type="dashed"
                                        onClick={() => add({ role: 'MEMBER' })}
                                        block
                                        icon={<PlusOutlined />}
                                        className="mt-4 border-blue-200 text-blue-600 hover:text-blue-700 hover:border-blue-400"
                                        size="large"
                                    >
                                        {t('committeeManagement.addMember')}
                                    </Button>
                                )}
                            </>
                        )}
                    </Form.List>
                </Form>
            </Modal>
        </div>
    );
};

export default CommitteeManagement;
