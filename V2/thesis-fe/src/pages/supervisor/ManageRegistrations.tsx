import { useState } from 'react';
import { Card, Table, Button, Modal, Input, Tag, Spin, Avatar, Tabs, Tooltip } from 'antd';
import { CheckOutlined, CloseOutlined, EyeOutlined, UserOutlined, SearchOutlined, TeamOutlined, UpOutlined, DownOutlined } from '@ant-design/icons';
import { RegistrationStatusBadge } from '@/components/StatusBadge';
import {
    useRegistrations,
    useConfirmRegistration,
    useRejectRegistration
} from '@/hooks/useRegistrations';
import { useActiveSemester } from '@/hooks/useSemesters';
import { useAuthStore } from '@/store/auth';
import type { Registration } from '@/types';

const { TextArea } = Input;

const SupervisorManageRegistrations = () => {
    const { user } = useAuthStore();
    const [detailModalVisible, setDetailModalVisible] = useState(false);
    const [rejectModalVisible, setRejectModalVisible] = useState(false);
    const [selectedRegistration, setSelectedRegistration] = useState<Registration | null>(null);
    const [rejectionReason, setRejectionReason] = useState('');
    const [activeTab, setActiveTab] = useState('ALL');
    const [searchTerm, setSearchTerm] = useState('');
    const [topicExpanded, setTopicExpanded] = useState(false);

    // Get all registrations for supervisor's topics (no status filter)
    const { data: registrations, isLoading } = useRegistrations();
    const { data: activeSemesterData } = useActiveSemester();
    const confirmMutation = useConfirmRegistration();
    const rejectMutation = useRejectRegistration();

    // Determine active semester filter from localStorage or fallback to active semester
    const activeSemId = activeSemesterData?.id;
    const selectedSemesterId = localStorage.getItem('sys_selected_semester_id') || activeSemId;

    // 1. Filter registrations by selected semester first
    const registrationsInSemester = registrations?.filter((reg: any) => {
        const regSemesterId = reg.topic?.semester_id || reg.topic?.semester?.id;
        return selectedSemesterId ? regSemesterId === selectedSemesterId : true;
    });

    // 2. Group registrations by topic_id to get unique topics in this semester
    const groupedByTopicMap = registrationsInSemester?.reduce((acc: any, reg: any) => {
        const topicId = reg.topic_id || reg.topic?.id;
        if (!topicId) return acc;

        if (!acc[topicId]) {
            acc[topicId] = {
                ...reg,
                allStudents: [],
                allRegistrations: [],
            };
        }

        // Add student info
        if (reg.student) {
            acc[topicId].allStudents.push({
                id: reg.student.id,
                full_name: reg.student.full_name,
                student_code: reg.student.student_code,
                email: reg.student.email,
                avatar_url: reg.student.avatar_url,
                registration_id: reg.id,
                status: reg.status,
                midterm_status: reg.midterm_status,
                midterm_feedback: reg.midterm_feedback,
            });
        }

        acc[topicId].allRegistrations.push(reg);
        return acc;
    }, {} as Record<string, any>);

    const allTopicsInSemester = Object.values(groupedByTopicMap || {});

    // 3. Apply Tab and Search filter on unique topics for table display
    const groupedRegistrations = allTopicsInSemester.filter((topic: any) => {
        const matchesStatus = activeTab === 'ALL' || topic.status === activeTab;
        const searchLower = searchTerm.toLowerCase();
        const matchesSearch = !searchTerm ||
            topic.topic?.title?.toLowerCase().includes(searchLower) ||
            topic.allStudents?.some((s: any) => s.full_name?.toLowerCase().includes(searchLower) || s.student_code?.toLowerCase().includes(searchLower));

        return matchesStatus && matchesSearch;
    });

    const viewDetail = (registration: Registration) => {
        setSelectedRegistration(registration);
        setTopicExpanded(false); // Default to collapsed initially
        setDetailModalVisible(true);
    };

    const handleConfirm = (id: string) => {
        Modal.confirm({
            title: 'Xác nhận đăng ký',
            content: 'Bạn có chắc chắn muốn xác nhận đăng ký này? Sau khi xác nhận, sinh viên sẽ chính thức được gắn với đề tài.',
            okText: 'Xác nhận',
            cancelText: 'Hủy',
            onOk: () => {
                confirmMutation.mutate(id);
            },
        });
    };

    const handleReject = (registration: Registration) => {
        setSelectedRegistration(registration);
        setRejectModalVisible(true);
    };

    const confirmReject = () => {
        if (!selectedRegistration || !rejectionReason.trim()) {
            return;
        }

        rejectMutation.mutate(
            { id: selectedRegistration.id, reason: rejectionReason },
            {
                onSuccess: () => {
                    setRejectModalVisible(false);
                    setSelectedRegistration(null);
                    setRejectionReason('');
                },
            }
        );
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
            title: 'Đề tài',
            key: 'topic',
            render: (_: any, record: any) => (
                <div 
                    className="cursor-pointer group py-1" 
                    onClick={() => viewDetail(record)}
                >
                   <div className="font-bold text-blue-600 group-hover:text-blue-800 group-hover:underline transition-all leading-snug text-[14px]">
                       {record.topic?.title || 'N/A'}
                   </div>
                   <div className="mt-2 flex items-center gap-2">
                       <Tag className="m-0 bg-indigo-50 text-indigo-600 border-indigo-100 font-bold px-2.5 py-0.5 text-[11px] rounded-md">
                           GVHD: {record.topic?.supervisor?.full_name}
                       </Tag>
                   </div>
                </div>
            ),
        },
        {
            title: 'Sinh viên',
            key: 'students',
            width: 260,
            render: (_: any, record: any) => (
                <div className="space-y-2 py-1">
                    {record.allStudents?.length > 0 ? (
                        record.allStudents.map((student: any) => {
                            const isFailed = student.midterm_status === 'FAIL' || student.status === 'FAILED';
                            const cardEl = (
                                <div key={student.id} className={`flex items-center gap-2.5 p-2 rounded-xl border shadow-sm transition-all ${
                                    isFailed 
                                        ? 'bg-slate-100 opacity-60 line-through border-slate-200' 
                                        : 'bg-slate-50 border-slate-100'
                                }`}>
                                    <Avatar size={28} src={student.avatar_url} icon={<UserOutlined />} className={isFailed ? 'border border-slate-300 opacity-55' : 'border border-slate-200'} />
                                    <div className="flex flex-col">
                                        <span className="font-bold text-slate-700 text-[13px] leading-none">
                                            {student.full_name}
                                            {isFailed && <span className="ml-1 text-[9px] text-red-500 font-bold">(Rớt GK)</span>}
                                        </span>
                                        <span className="text-slate-400 text-[11px] mt-0.5">{student.student_code}</span>
                                    </div>
                                </div>
                            );

                            return isFailed ? (
                                <Tooltip key={student.id} title={`Sinh viên rớt giữa kỳ. Lý do: ${student.midterm_feedback || 'Không có ý kiến phản hồi.'}`}>
                                    {cardEl}
                                </Tooltip>
                            ) : cardEl;
                        })
                    ) : record.group?.members?.length > 0 ? (
                        record.group.members.map((member: any) => (
                            <div key={member.user_id} className="flex items-center gap-2.5 bg-slate-50 p-2 rounded-xl border border-slate-100 shadow-sm">
                                <Avatar size={28} src={member.user?.avatar_url} icon={<UserOutlined />} className="border border-slate-200" />
                                <div className="flex flex-col">
                                    <span className="font-bold text-slate-700 text-[13px] leading-none">{member.user?.full_name}</span>
                                    <span className="text-slate-400 text-[11px] mt-0.5">{member.user?.student_code}</span>
                                </div>
                            </div>
                        ))
                    ) : (
                        <span className="text-gray-400 italic">Không có thành viên</span>
                    )}
                </div>
            ),
        },
        {
            title: 'Nhóm',
            key: 'group',
            width: 110,
            render: (_: any, record: any) => (
                record.group ? (
                    <Tag className="m-0 bg-blue-50 text-blue-600 border-blue-100 font-bold px-2.5 py-0.5 text-xs rounded-lg">
                        {record.group.name}
                    </Tag>
                ) : (
                    <Tag className="m-0 bg-slate-50 text-slate-500 border-slate-200 font-medium px-2.5 py-0.5 text-xs rounded-lg">
                        Chưa có nhóm
                    </Tag>
                )
            ),
        },
        {
            title: 'Ngày đăng ký',
            dataIndex: 'registered_at',
            key: 'registered_at',
            width: 120,
            render: (date: string) => <span className="text-slate-500 font-medium">{date ? new Date(date).toLocaleDateString('vi-VN') : 'N/A'}</span>,
        },
        {
            title: 'Trạng thái',
            dataIndex: 'status',
            key: 'status',
            width: 130,
            render: (status: any) => <RegistrationStatusBadge status={status} />,
        },
        {
            title: 'Thao tác',
            key: 'actions',
            width: 130,
            align: 'center' as const,
            render: (_: any, record: any) => (
                <div className="flex items-center justify-center gap-2">
                    <Tooltip title="Xem chi tiết">
                        <Button
                            type="primary"
                            ghost
                            size="small"
                            icon={<EyeOutlined />}
                            className="rounded-lg font-bold h-8 w-8 p-0 flex items-center justify-center"
                            onClick={() => viewDetail(record)}
                        />
                    </Tooltip>
                    {record.status === 'PENDING' && (
                        <>
                            <Tooltip title="Xác nhận đăng ký">
                                <Button
                                    type="primary"
                                    size="small"
                                    icon={<CheckOutlined />}
                                    onClick={() => handleConfirm(record.id)}
                                    className="bg-emerald-600 hover:bg-emerald-700 border-none shadow-sm rounded-lg font-bold h-8 w-8 p-0 flex items-center justify-center"
                                    loading={confirmMutation.isPending}
                                />
                            </Tooltip>
                            <Tooltip title="Từ chối đăng ký">
                                <Button
                                    danger
                                    size="small"
                                    icon={<CloseOutlined />}
                                    onClick={() => handleReject(record)}
                                    className="shadow-sm rounded-lg font-bold h-8 w-8 p-0 flex items-center justify-center"
                                    loading={rejectMutation.isPending}
                                />
                            </Tooltip>
                        </>
                    )}
                </div>
            ),
        },
    ];

    const totalTopicsCount = allTopicsInSemester.length;
    const pendingCount = allTopicsInSemester.filter((t: any) => t.status === 'PENDING').length;
    const confirmedCount = allTopicsInSemester.filter((t: any) => t.status === 'CONFIRMED').length;
    const rejectedCount = allTopicsInSemester.filter((t: any) => t.status === 'REJECTED').length;

    return (
        <div className="page-container">
            <div className="page-inner">
                {/* Header */}
                <Card className="page-header-card">
                    <div className="flex items-center gap-3">
                        <div className="page-header-icon"><TeamOutlined className="text-base" /></div>
                        <div>
                            <div className="page-header-title">Sinh viên hướng dẫn</div>
                            <div className="page-header-subtitle">Xem và quản lý danh sách đăng ký đề tài từ sinh viên</div>
                        </div>
                    </div>
                </Card>

                {/* Filter & Search Toolbar */}
                <Card className="page-toolbar-card !mb-4">
                    <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                        <Tabs 
                            activeKey={activeTab} 
                            onChange={setActiveTab}
                            className="sys-tabs sys-tabs-capsule !mb-0"
                            items={[
                                { 
                                    key: 'ALL', 
                                    label: (
                                        <div className="flex items-center gap-2">
                                            <span>Tất cả</span>
                                            <Tag className="m-0 rounded-full bg-slate-100 text-slate-600 border-none font-bold px-2">{totalTopicsCount}</Tag>
                                        </div>
                                    )
                                },
                                { 
                                    key: 'PENDING', 
                                    label: (
                                        <div className="flex items-center gap-2">
                                            <span>Chờ xử lý</span>
                                            <Tag className="m-0 rounded-full bg-orange-50 text-orange-600 border-none font-bold px-2">{pendingCount}</Tag>
                                        </div>
                                    )
                                },
                                { 
                                    key: 'CONFIRMED', 
                                    label: (
                                        <div className="flex items-center gap-2">
                                            <span>Đã xác nhận</span>
                                            <Tag className="m-0 rounded-full bg-green-50 text-green-600 border-none font-bold px-2">{confirmedCount}</Tag>
                                        </div>
                                    )
                                },
                                { 
                                    key: 'REJECTED', 
                                    label: (
                                        <div className="flex items-center gap-2">
                                            <span>Đã từ chối</span>
                                            <Tag className="m-0 rounded-full bg-red-50 text-red-600 border-none font-bold px-2">{rejectedCount}</Tag>
                                        </div>
                                    )
                                },
                            ]}
                        />
                        <div className="w-full md:w-auto">
                            <Input
                                placeholder="Tìm sinh viên, mã số, đề tài..."
                                prefix={<SearchOutlined className="text-slate-400" />}
                                allowClear
                                className="sys-input-search"
                                style={{ width: '100%', minWidth: 320, height: 40, borderRadius: 12 }}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </div>
                </Card>

                {/* Registrations Table */}
                <Card className="page-card-flush">
                    <Spin spinning={isLoading}>
                        <Table
                            columns={columns}
                            dataSource={groupedRegistrations || []}
                            rowKey={(record: any) => record.topic_id || record.topic?.id || record.id}
                            className="sys-table border-table"
                            bordered
                            pagination={{
                                pageSize: 10,
                                className: 'px-6 py-4'
                            }}
                            locale={{
                                emptyText: 'Chưa có đăng ký nào',
                            }}
                        />
                    </Spin>
                </Card>

                {/* Detail Modal */}
                <Modal
                    title={
                        <div className="flex items-center gap-2">
                            <EyeOutlined className="text-blue-600" />
                            <span>Chi tiết đăng ký đề tài</span>
                        </div>
                    }
                    open={detailModalVisible}
                    onCancel={() => setDetailModalVisible(false)}
                    footer={[
                        <Button key="close" type="primary" onClick={() => setDetailModalVisible(false)} className="px-6 rounded-lg font-bold h-9">
                            Đóng
                        </Button>,
                        selectedRegistration?.status === 'PENDING' && (
                            <Button
                                key="confirm"
                                type="primary"
                                icon={<CheckOutlined />}
                                onClick={() => {
                                    handleConfirm(selectedRegistration.id);
                                    setDetailModalVisible(false);
                                }}
                                className="bg-emerald-600 hover:bg-emerald-700 border-none shadow-sm rounded-lg font-bold h-9 px-5"
                                loading={confirmMutation.isPending}
                            >
                                Xác nhận
                            </Button>
                        ),
                        selectedRegistration?.status === 'PENDING' && (
                            <Button
                                key="reject"
                                danger
                                icon={<CloseOutlined />}
                                onClick={() => {
                                    setDetailModalVisible(false);
                                    handleReject(selectedRegistration);
                                }}
                                className="shadow-sm rounded-lg font-bold h-9 px-5"
                            >
                                Từ chối
                            </Button>
                        )
                    ]}
                    width={620}
                    className="sys-modal"
                >
                    {selectedRegistration && (
                        <div className="space-y-4 py-1">
                            {/* Expandable Topic Info Pillbox */}
                            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 transition-all">
                                <div className="flex items-center justify-between mb-1.5">
                                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Tên đề tài</div>
                                    <button 
                                        onClick={() => setTopicExpanded(!topicExpanded)}
                                        className="text-xs text-blue-600 hover:text-blue-800 font-bold flex items-center gap-1 border-none bg-transparent cursor-pointer p-0 transition-all"
                                    >
                                        <span>{topicExpanded ? 'Thu gọn' : 'Xem mô tả chi tiết'}</span>
                                        {topicExpanded ? <UpOutlined /> : <DownOutlined />}
                                    </button>
                                </div>
                                <div 
                                    className="text-[14px] font-bold text-slate-800 leading-snug cursor-pointer hover:text-blue-600 transition-colors"
                                    onClick={() => setTopicExpanded(!topicExpanded)}
                                >
                                    {(selectedRegistration as any).topic?.title || 'N/A'}
                                </div>

                                {topicExpanded && (
                                    <div className="mt-3.5 pt-3.5 border-t border-slate-200 space-y-3.5 animate-in fade-in duration-300">
                                        <div>
                                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Mô tả đề tài</div>
                                            <div 
                                                className="text-xs text-slate-600 bg-white p-3 rounded-lg border border-slate-200 leading-relaxed whitespace-pre-wrap shadow-2xs"
                                                dangerouslySetInnerHTML={{ __html: (selectedRegistration as any).topic?.description || 'Không có mô tả' }}
                                            />
                                        </div>
                                        <div>
                                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Mục tiêu đề tài</div>
                                            <div 
                                                className="text-xs text-slate-600 bg-white p-3 rounded-lg border border-slate-200 leading-relaxed whitespace-pre-wrap shadow-2xs"
                                                dangerouslySetInnerHTML={{ __html: (selectedRegistration as any).topic?.objectives || 'Không có mục tiêu' }}
                                            />
                                        </div>
                                        <div>
                                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Yêu cầu đối với sinh viên</div>
                                            <div 
                                                className="text-xs text-slate-600 bg-white p-3 rounded-lg border border-slate-200 leading-relaxed whitespace-pre-wrap shadow-2xs"
                                                dangerouslySetInnerHTML={{ __html: (selectedRegistration as any).topic?.requirements || 'Không có yêu cầu' }}
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Mã nhóm</div>
                                    <div className="text-[13px] font-bold text-indigo-600">
                                        {(selectedRegistration as any).group?.name || 'Chưa có nhóm'}
                                    </div>
                                </div>
                                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Ngày đăng ký</div>
                                    <div className="text-[13px] font-bold text-slate-700">
                                        {(selectedRegistration as any).registered_at
                                            ? new Date((selectedRegistration as any).registered_at).toLocaleDateString('vi-VN')
                                            : 'N/A'}
                                    </div>
                                </div>
                            </div>

                            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Thành viên nhóm</div>
                                <div className="space-y-2">
                                    {(selectedRegistration as any).allStudents?.length > 0 ? (
                                        (selectedRegistration as any).allStudents.map((student: any) => {
                                            const isFailed = student.midterm_status === 'FAIL' || student.status === 'FAILED';
                                            const cardEl = (
                                                <div key={student.id} className={`flex items-center justify-between p-2.5 rounded-lg border shadow-sm transition-all ${
                                                    isFailed 
                                                        ? 'bg-slate-100 opacity-60 line-through border-slate-200' 
                                                        : 'bg-white border-slate-100'
                                                }`}>
                                                    <div className="flex items-center gap-2.5">
                                                        <Avatar size={28} src={student.avatar_url} icon={<UserOutlined />} className={isFailed ? 'border border-slate-300 opacity-55' : 'border border-slate-100'} />
                                                        <div className="flex flex-col">
                                                            <span className="font-bold text-slate-700 text-[12px] leading-none">
                                                                {student.full_name}
                                                                {isFailed && <span className="ml-1 text-[9px] text-red-500 font-bold">(Rớt GK)</span>}
                                                            </span>
                                                            <span className="text-slate-400 text-[10px] mt-0.5">{student.student_code}</span>
                                                        </div>
                                                    </div>
                                                    <Tag color={isFailed ? "error" : "blue"} className="m-0 text-[9px] rounded-md border-none font-bold px-1.5 py-0">
                                                        {isFailed ? "RỚT GIỮA KỲ" : "SINH VIÊN"}
                                                    </Tag>
                                                </div>
                                            );

                                            return isFailed ? (
                                                <Tooltip key={student.id} title={`Sinh viên rớt giữa kỳ. Lý do: ${student.midterm_feedback || 'Không có ý kiến phản hồi.'}`}>
                                                    {cardEl}
                                                </Tooltip>
                                            ) : cardEl;
                                        })
                                    ) : (selectedRegistration as any).group?.members?.length > 0 ? (
                                        (selectedRegistration as any).group.members.map((m: any) => (
                                            <div key={m.user_id} className="flex items-center justify-between bg-white p-2.5 rounded-lg border border-slate-100 shadow-sm">
                                                <div className="flex items-center gap-2.5">
                                                    <Avatar size={28} src={m.user?.avatar_url} icon={<UserOutlined />} className="border border-slate-100" />
                                                    <div className="flex flex-col">
                                                        <span className="font-bold text-slate-700 text-[12px] leading-none">{m.user?.full_name}</span>
                                                        <span className="text-slate-400 text-[10px] mt-0.5">{m.user?.student_code}</span>
                                                    </div>
                                                </div>
                                                <Tag color="blue" className="m-0 text-[9px] rounded-md border-none font-bold px-1.5 py-0">SINH VIÊN</Tag>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="text-slate-400 italic">Không có thành viên</div>
                                    )}
                                </div>
                            </div>

                            <div className="p-4 bg-white rounded-xl border-2 border-slate-100 shadow-sm relative overflow-hidden">
                                <div className="absolute top-0 left-0 w-1 h-full bg-blue-500" />
                                <div className="flex items-center justify-between mb-3">
                                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Trạng thái đăng ký</div>
                                    <RegistrationStatusBadge status={selectedRegistration.status} />
                                </div>
                                {(selectedRegistration as any).confirmed_at && (
                                    <div className="text-[11px] text-slate-500 bg-slate-50 p-2.5 rounded-lg border border-slate-200 mb-2">
                                        <span className="font-bold text-slate-600">Đã xác nhận lúc:</span> {new Date((selectedRegistration as any).confirmed_at).toLocaleString('vi-VN')}
                                    </div>
                                )}
                                {(selectedRegistration as any).rejection_reason && (
                                    <div>
                                        <div className="text-[10px] font-bold text-red-500 uppercase tracking-widest mb-1.5">Lý do từ chối</div>
                                        <div className="text-[13px] text-red-600 italic bg-red-50 p-3 rounded-lg border border-dashed border-red-200">
                                            {(selectedRegistration as any).rejection_reason}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </Modal>

                {/* Reject Modal */}
                <Modal
                    title={
                        <div className="flex items-center gap-2">
                            <CloseOutlined className="text-red-600" />
                            <span>Từ chối đăng ký đề tài</span>
                        </div>
                    }
                    open={rejectModalVisible}
                    onOk={confirmReject}
                    onCancel={() => {
                        setRejectModalVisible(false);
                        setSelectedRegistration(null);
                        setRejectionReason('');
                    }}
                    confirmLoading={rejectMutation.isPending}
                    okText="Xác nhận từ chối"
                    cancelText="Hủy"
                    okButtonProps={{ danger: true, className: 'bg-red-600 hover:bg-red-700 font-bold rounded-lg h-9 px-5' }}
                    cancelButtonProps={{ className: 'font-bold rounded-lg h-9 px-5' }}
                    className="sys-modal"
                    width={500}
                >
                    <div className="space-y-4 my-4">
                        <p className="text-sm text-slate-600">Vui lòng nhập lý do từ chối để sinh viên nắm thông tin và đăng ký đề tài khác phù hợp hơn:</p>
                        <TextArea
                            rows={4}
                            value={rejectionReason}
                            onChange={(e) => setRejectionReason(e.target.value)}
                            placeholder="Ví dụ: Đề tài này yêu cầu kiến thức nền tảng về AI/ML nâng cao..."
                            className="rounded-xl border-slate-200 p-3 text-sm focus:ring-2 focus:ring-red-500"
                            required
                        />
                        {!rejectionReason.trim() && (
                            <p className="text-xs text-red-500 font-medium">Vui lòng nhập lý do từ chối</p>
                        )}
                    </div>
                </Modal>
            </div>
        </div>
    );
};

export default SupervisorManageRegistrations;
