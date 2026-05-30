import { useState, useMemo } from 'react';
import { Card, Table, Button, Tag, Modal, Form, Input, Select, Space, Divider, Popconfirm, Typography } from 'antd';
import { notify } from '@/utils/notification';
import { 
    PlusOutlined, DeleteOutlined, EditOutlined, 
    HomeOutlined, CrownOutlined, EditFilled, AppstoreOutlined,
    UsergroupAddOutlined, TagOutlined, UserOutlined, CloseOutlined
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { CommitteeApi, Committee } from '@/api/committee';
import { UsersApi } from '@/api/users';
import { useActiveSemester } from '@/hooks/useActiveSemester';
import { useSemesterStore } from '@/store/semester';
import { useAuthStore } from '@/store/auth';

const { Title, Text } = Typography;

const CommitteeManagement = () => {
    const { t } = useTranslation();
    const queryClient = useQueryClient();
    const { data: activeSemester } = useActiveSemester();
    const { selectedSemesterId } = useSemesterStore();
    const semesterId = selectedSemesterId || activeSemester?.id;

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingCommittee, setEditingCommittee] = useState<Committee | null>(null);
    const [form] = Form.useForm();

    // Fetch committees
    const { data: committees, isLoading } = useQuery({
        queryKey: ['committees', semesterId],
        queryFn: () => CommitteeApi.getCommittees(semesterId!),
        enabled: !!semesterId,
    });

    const { user } = useAuthStore();

    // Fetch lecturers theo phân quyền: HOD chỉ thấy GV bộ môn, ADMIN thấy toàn bộ khoa
    const { data: lecturers } = useQuery({
        queryKey: ['lecturers', user?.role, user?.department_id],
        queryFn: () => {
            const filters: any = { role: 'LECTURER' };
            if (user?.role === 'HEAD' || user?.role === 'COORDINATOR') {
                // Nếu là HOD hoặc COORDINATOR, bắt buộc phải lọc theo bộ môn của họ
                filters.departmentId = user?.department_id || (user as any)?.department?.id;
            }
            // Nếu là ADMIN, không truyền departmentId để lấy toàn bộ
            return UsersApi.getAll(filters);
        },
        enabled: !!user,
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
            notify.success(t('committeeManagement.createSuccess'));
            setIsModalOpen(false);
            queryClient.invalidateQueries({ queryKey: ['committees'] });
        },
        onError: (error: any) => {
            notify.error(error?.response?.data?.error || t('committeeManagement.createError'));
        }
    });

    const updateMutation = useMutation({
        mutationFn: ({ id, data }: { id: string, data: any }) => CommitteeApi.updateCommittee(id, data),
        onSuccess: () => {
            notify.success(t('committeeManagement.updateSuccess'));
            setIsModalOpen(false);
            queryClient.invalidateQueries({ queryKey: ['committees'] });
        },
        onError: (error: any) => {
            notify.error(error?.response?.data?.error || t('committeeManagement.updateError'));
        }
    });

    const deleteMutation = useMutation({
        mutationFn: CommitteeApi.deleteCommittee,
        onSuccess: () => {
            notify.success(t('committeeManagement.deleteSuccess'));
            queryClient.invalidateQueries({ queryKey: ['committees'] });
        },
        onError: (error: any) => {
            notify.error(error?.response?.data?.error || t('committeeManagement.deleteError'));
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
            notify.error(t('semester.selectRequired'));
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
            title: 'STT',
            key: 'stt',
            width: 60,
            align: 'center' as const,
            render: (_: any, __: any, index: number) => <span className="font-bold text-slate-400">{index + 1}</span>,
        },
        {
            title: t('committeeManagement.nameLabel'),
            dataIndex: 'name',
            key: 'name',
            width: 200,
            render: (text: string, record: Committee) => (
                <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                        <CrownOutlined className="text-blue-500 text-xs" />
                        <span className="font-bold text-slate-700 tracking-tight">{text}</span>
                    </div>
                    <Tag color={record.type === 'POSTER' ? 'cyan' : 'blue'} className="w-fit m-0 text-[9px] px-1.5 leading-4 font-black uppercase rounded-md border-none bg-slate-100 text-slate-500">
                        {record.type || 'ORAL'}
                    </Tag>
                </div>
            )
        },
        {
            title: t('committeeManagement.roomPreference'),
            dataIndex: 'room_preference',
            key: 'room_preference',
            width: 140,
            align: 'center' as const,
            render: (text: string) => text ? (
                <Tag color="orange" className="m-0 font-mono font-bold border-orange-100 bg-orange-50 text-orange-600 px-3 rounded-full">
                    {text}
                </Tag>
            ) : <span className="text-slate-300">—</span>
        },
        {
            title: t('committeeManagement.membersDivider'),
            key: 'members',
            render: (_: any, record: Committee) => (
                <div className="flex flex-wrap gap-1.5">
                    {record.members.sort((a, b) => {
                        const order = { CHAIR: 1, SECRETARY: 2, MEMBER: 3 };
                        return (order[a.role as keyof typeof order] || 99) - (order[b.role as keyof typeof order] || 99);
                    }).map((m: any) => (
                        <div 
                            key={m.id || m.lecturerId}
                            className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg border text-[12px] font-medium transition-all
                                ${m.role === 'CHAIR' 
                                    ? 'bg-amber-50 border-amber-100 text-amber-700' 
                                    : m.role === 'SECRETARY' 
                                        ? 'bg-blue-50 border-blue-100 text-blue-700' 
                                        : 'bg-slate-50 border-slate-100 text-slate-600'}`}
                        >
                            <span className="opacity-60 font-black text-[10px] uppercase">
                                {m.role === 'CHAIR' ? 'CT' : m.role === 'SECRETARY' ? 'TK' : 'UV'}
                            </span>
                            <span className="font-semibold">{m.lecturer?.full_name || m.fullName}</span>
                        </div>
                    ))}
                </div>
            )
        },
        {
            title: t('common.actions'),
            key: 'action',
            width: 120,
            align: 'right' as const,
            render: (_: any, record: Committee) => {
                const isAssigned = (record.assignedTopicCount || 0) > 0;
                
                return (
                    <Space size="middle">
                        <Button
                            type="text"
                            size="small"
                            icon={<EditOutlined className="text-blue-600" />}
                            onClick={() => handleEdit(record)}
                            className="hover:bg-blue-50"
                        />
                        
                        <Popconfirm
                            title={t('committeeManagement.deleteConfirm')}
                            description={t('committeeManagement.deleteDescription')}
                            onConfirm={() => deleteMutation.mutate(record.id)}
                            okText={t('common.delete')}
                            cancelText={t('common.cancel')}
                            okButtonProps={{ danger: true }}
                            disabled={isAssigned}
                        >
                            <Button 
                                type="text" 
                                size="small"
                                danger 
                                disabled={isAssigned}
                                icon={<DeleteOutlined className={isAssigned ? "text-slate-200" : ""} />} 
                                className={isAssigned ? "" : "hover:bg-red-50"}
                            />
                        </Popconfirm>
                    </Space>
                );
            }
        }
    ];

    return (
        <div className="page-container">
            <div className="page-inner">
            {/* Header */}
            <Card className="page-header-card">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="page-header-icon"><PlusOutlined className="text-base" /></div>
                        <div>
                            <div className="page-header-title">{t('committeeManagement.title')}</div>
                            <div className="page-header-subtitle">{t('committeeManagement.description', { semester: activeSemester?.name })}</div>
                        </div>
                    </div>
                    <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
                        {t('committeeManagement.addCommittee')}
                    </Button>
                </div>
            </Card>

            <Card className="page-card-flush">
                <Table
                    dataSource={committees}
                    columns={columns}
                    loading={isLoading}
                    rowKey="id"
                    size="middle"
                    className="sys-table"
                    pagination={false}
                />
            </Card>

            <Modal
                title={null}
                open={isModalOpen}
                onOk={handleSubmit}
                onCancel={() => setIsModalOpen(false)}
                width={720}
                confirmLoading={createMutation.isPending || updateMutation.isPending}
                okText={editingCommittee ? t('common.update') : t('committeeManagement.addCommittee')}
                cancelText={t('common.cancel')}
                centered
                className="premium-modal"
                styles={{ body: { padding: 0 } }}
                closeIcon={null}
                footer={(footer) => (
                    <div className="p-4 bg-slate-50 border-t flex justify-end gap-3 rounded-b-2xl">
                        {footer}
                    </div>
                )}
            >
                {/* Custom Header - Compact Size */}
                <div className="p-4 bg-gradient-to-r from-blue-600 to-indigo-700 rounded-t-2xl relative overflow-hidden">
                    <div className="absolute -right-8 -top-8 w-32 h-32 bg-white/10 rounded-full blur-2xl" />
                    
                    {/* Custom Close Button */}
                    <button 
                        onClick={() => setIsModalOpen(false)}
                        className="absolute right-4 top-4 z-50 text-white/50 hover:text-white transition-all duration-300 hover:rotate-90 focus:outline-none"
                    >
                        <CloseOutlined className="text-lg" />
                    </button>

                    <div className="relative z-10 flex items-center gap-3">
                        <div className="w-10 h-10 bg-white/20 backdrop-blur-md rounded-lg flex items-center justify-center border border-white/20 shadow-lg">
                            <UsergroupAddOutlined className="text-xl text-white" />
                        </div>
                        <div>
                            <Title level={5} className="!m-0 !text-white !font-black !text-[15px] tracking-tight">
                                {editingCommittee ? t('committeeManagement.editCommittee') : t('committeeManagement.newCommittee')}
                            </Title>
                            <Text className="text-blue-100 text-[11px] font-medium opacity-70">
                                {t('committeeManagement.description', { semester: activeSemester?.name })}
                            </Text>
                        </div>
                    </div>
                </div>

                <Form form={form} layout="vertical" className="p-6 pt-5">
                    {/* Section 1: Basic Info - Small Text */}
                    <div className="bg-slate-50/50 p-3 rounded-xl border border-slate-100 mb-5">
                        <div className="grid grid-cols-12 gap-3">
                            <Form.Item
                                name="name"
                                label={<span className="flex items-center gap-1 text-[10px] font-black text-slate-400 uppercase tracking-widest h-5"><TagOutlined /> {t('committeeManagement.nameLabel')}</span>}
                                rules={[{ required: true, message: t('committeeManagement.nameRequired') }]}
                                className="col-span-5 mb-0"
                            >
                                <Input placeholder={t('committeeManagement.namePlaceholder')} size="middle" className="rounded-lg text-[13px]" />
                            </Form.Item>
                            <Form.Item
                                name="type"
                                label={<span className="flex items-center gap-1 text-[10px] font-black text-slate-400 uppercase tracking-widest h-5"><AppstoreOutlined /> Phân loại</span>}
                                rules={[{ required: true }]}
                                className="col-span-4 mb-0"
                            >
                                <Select
                                    size="middle"
                                    className="rounded-lg text-[13px]"
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
                                    <Select.Option value="ORAL"><span className="text-[12px]">ORAL</span></Select.Option>
                                    <Select.Option value="POSTER"><span className="text-[12px]">POSTER</span></Select.Option>
                                </Select>
                            </Form.Item>
                            <Form.Item 
                                name="roomPreference" 
                                label={<span className="flex items-center gap-1 text-[10px] font-black text-slate-400 uppercase tracking-widest h-5"><HomeOutlined /> Phòng</span>}
                                className="col-span-3 mb-0"
                            >
                                <Input placeholder="Vd: A.1.5" size="middle" className="rounded-lg text-[13px]" />
                            </Form.Item>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 mb-4">
                         <div className="w-1.5 h-4 bg-indigo-600 rounded-full" />
                         <Title level={5} className="!m-0 !text-[13px] font-black text-slate-700 uppercase tracking-tight">{t('committeeManagement.membersDivider')}</Title>
                    </div>

                    <Form.List
                        name="members"
                        rules={[
                            {
                                validator: async (_, members) => {
                                    const type = form.getFieldValue('type');
                                    if (type === 'POSTER') {
                                        if (!members || members.length < 2) {
                                            return Promise.reject(new Error('Hội đồng Poster phải có ít nhất 2 giảng viên'));
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
                                    {fields.map(({ key, name, ...restField }) => {
                                        const roleValue = form.getFieldValue(['members', name, 'role']);
                                        let roleIcon = <UserOutlined className="text-slate-400" />;
                                        let roleColor = 'bg-slate-100';
                                        if (roleValue === 'CHAIR') {
                                            roleIcon = <CrownOutlined className="text-amber-500" />;
                                            roleColor = 'bg-amber-50 border-amber-200';
                                        } else if (roleValue === 'SECRETARY') {
                                            roleIcon = <EditFilled className="text-blue-500" />;
                                            roleColor = 'bg-blue-50 border-blue-200';
                                        }
                                        
                                        return (
                                            <div key={key} className={`flex gap-3 items-center p-3 rounded-xl border border-slate-200 bg-white shadow-sm transition-all hover:shadow-md animate-in fade-in slide-in-from-top-2`}>
                                                <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 border border-transparent ${roleColor}`}>
                                                    {roleIcon}
                                                </div>
                                                
                                                <Form.Item
                                                    {...restField}
                                                    name={[name, 'role']}
                                                    rules={[{ required: true, message: t('common.requiredField') }]}
                                                    className="mb-0 flex-none w-28"
                                                >
                                                    <Select size="middle" className="font-bold text-slate-700 text-[12px]">
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
                                                        size="middle"
                                                        showSearch
                                                        className="font-medium"
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
                                                                disabled: isSelectedInOtherRow,
                                                                isAssigned,
                                                                isSelectedInOtherRow,
                                                            };
                                                        })}
                                                        optionRender={(option) => (
                                                            <div className={`py-1 ${option.data.disabled ? 'opacity-50' : ''}`}>
                                                                <div className="font-bold text-slate-800 text-xs">
                                                                    {option.data.label}
                                                                    {option.data.isAssigned && (
                                                                        <Tag color="red" className="ml-2 text-[9px] uppercase font-black">{t('committeeManagement.alreadyAssigned', 'Đã có HĐ')}</Tag>
                                                                    )}
                                                                </div>
                                                                <div className="text-[10px] text-slate-400 font-mono tracking-tight">{option.data.email}</div>
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
                                                            className="flex-none hover:bg-red-50"
                                                        />
                                                    )}
                                            </div>
                                        );
                                    })}
                                </div>

                                <Form.ErrorList errors={errors} className="mt-2 text-red-500 text-sm" />

                                {(form.getFieldValue('type') === 'ORAL' || form.getFieldValue('type') === 'POSTER') && (
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
        </div>
    );
};

export default CommitteeManagement;
