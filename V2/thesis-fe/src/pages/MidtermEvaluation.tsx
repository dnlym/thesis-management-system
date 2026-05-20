import { useState, useMemo } from 'react';
import { Card, Table, Button, Tag, Modal, Input, Space, Avatar, Spin, Alert, Tooltip, message, Empty, Tabs } from 'antd';
import { CheckCircleOutlined, CloseCircleOutlined, UserOutlined, ExclamationCircleOutlined, AuditOutlined, UpOutlined, DownOutlined } from '@ant-design/icons';
import { useMidtermRegistrations, useUpdateMidtermStatus } from '@/hooks/useGrading';
import { useActiveSemester } from '@/hooks/useSemesters';
import { useAuthStore } from '@/store/auth';
import { useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { MidtermRegistration } from '@/types';

const { TextArea } = Input;


/**
 * Midterm Evaluation Page
 * Only GVHD (Supervisor) can access this page to grade PASS/FAIL for their students
 */
const MidtermEvaluation = () => {
    const { user } = useAuthStore();
    const queryClient = useQueryClient();
    
    const { 
        data: registrations, 
        isLoading, 
        isError 
    } = useMidtermRegistrations();
    const { data: activeSemesterData } = useActiveSemester();

    // Determine active semester filter from localStorage or fallback to active semester
    const activeSemId = activeSemesterData?.id;
    const selectedSemesterId = localStorage.getItem('sys_selected_semester_id') || activeSemId;

    // Filter registrations by selected semester first
    const registrationsInSemester = useMemo(() => {
        if (!registrations) return [];
        return registrations.filter((reg: MidtermRegistration) => {
            const regSemesterId = reg.topic?.semester_id || reg.topic?.semester?.id;
            return selectedSemesterId ? regSemesterId === selectedSemesterId : true;
        });
    }, [registrations, selectedSemesterId]);

    // Group registrations by topic.id to get unique topics in this semester for accurate counts
    const uniqueTopicsInSemester = useMemo(() => {
        if (!registrationsInSemester) return [];
        const map = new Map();
        registrationsInSemester.forEach((reg: MidtermRegistration) => {
            const topicId = reg.topic?.id;
            if (topicId && !map.has(topicId)) {
                map.set(topicId, reg);
            }
        });
        return Array.from(map.values());
    }, [registrationsInSemester]);

    const updateMidtermMutation = useUpdateMidtermStatus();

    // Grade Modal states
    const [selectedRegistration, setSelectedRegistration] = useState<MidtermRegistration | null>(null);
    const [gradeModalVisible, setGradeModalVisible] = useState(false);
    const [feedback, setFeedback] = useState('');
    const [selectedStatus, setSelectedStatus] = useState<'PASS' | 'FAIL' | null>(null);
    const [filterStatus, setFilterStatus] = useState<string>('ALL');

    // Detail Modal states
    const [detailModalVisible, setDetailModalVisible] = useState(false);
    const [selectedDetail, setSelectedDetail] = useState<MidtermRegistration | null>(null);
    const [topicExpanded, setTopicExpanded] = useState(false);

    const handleOpenDetailModal = (registration: MidtermRegistration) => {
        setSelectedDetail(registration);
        setTopicExpanded(false);
        setDetailModalVisible(true);
    };

    const handleOpenGradeModal = (registration: MidtermRegistration, status: 'PASS' | 'FAIL') => {
        setSelectedRegistration(registration);
        setSelectedStatus(status);
        setFeedback('');
        setGradeModalVisible(true);
    };

    const handleSubmitGrade = () => {
        if (!selectedRegistration || !selectedStatus) return;

        updateMidtermMutation.mutate(
            {
                registrationId: selectedRegistration.id,
                status: selectedStatus,
                feedback: feedback.trim() || undefined,
            },
            {
                onSuccess: () => {
                    setGradeModalVisible(false);
                    setSelectedRegistration(null);
                    setSelectedStatus(null);
                    setFeedback('');
                },
            }
        );
    };

    const getMidtermStatusTag = (status: string | null) => {
        if (!status) return <Tag color="default">Chưa đánh giá giữa kỳ</Tag>;
        if (status === 'PASS') return <Tag color="success" icon={<CheckCircleOutlined />}>Đạt giữa kỳ</Tag>;
        return <Tag color="error" icon={<CloseCircleOutlined />}>Không đạt giữa kỳ</Tag>;
    };

    const hasAnyRestrictedPhase = useMemo(() => {
        if (!registrationsInSemester) return false;
        return registrationsInSemester.some(r => r.permissions && !r.permissions.grade_midterm);
    }, [registrationsInSemester]);

    // Sort and calculate row spans for grouping
    const processedData = useMemo(() => {
        if (!registrationsInSemester) return [];
        
        // 1. Filter
        let filtered = registrationsInSemester;
        if (filterStatus !== 'ALL') {
            if (filterStatus === 'PENDING') {
                filtered = registrationsInSemester.filter(r => !r.midterm_status);
            } else {
                filtered = registrationsInSemester.filter(r => r.midterm_status === filterStatus);
            }
        }

        // 2. Sort by Topic and Group
        const sorted = [...filtered].sort((a, b) => {
            const topicCompare = a.topic.title.localeCompare(b.topic.title);
            if (topicCompare !== 0) return topicCompare;
            return (a.group?.name || '').localeCompare(b.group?.name || '');
        });

        // 3. Calculate rowSpan
        const dataWithSpans = sorted.map((item, index) => {
            // Check if this is the start of a group
            // Grouping key is topic.id + group.id
            const currentKey = `${item.topic.id}-${item.group?.id || 'none'}`;
            const prevKey = index > 0 ? `${sorted[index-1].topic.id}-${sorted[index-1].group?.id || 'none'}` : null;

            if (currentKey !== prevKey) {
                // Count how many subsequent items have the same key
                let span = 1;
                for (let i = index + 1; i < sorted.length; i++) {
                    const nextKey = `${sorted[i].topic.id}-${sorted[i].group?.id || 'none'}`;
                    if (nextKey === currentKey) {
                        span++;
                    } else {
                        break;
                    }
                }
                return { ...item, rowSpan: span };
            } else {
                return { ...item, rowSpan: 0 };
            }
        });

        return dataWithSpans;
    }, [registrations, filterStatus]);

    const columns: any[] = [
        {
            title: 'STT',
            key: 'index',
            width: 60,
            onCell: (record: any) => ({
                rowSpan: record.rowSpan,
            }),
            render: (_: any, record: any, index: number) => {
                // Find the topic index by counting rows with rowSpan > 0 up to this index
                let topicIndex = 0;
                for (let i = 0; i <= index; i++) {
                    if (processedData[i].rowSpan > 0) {
                        topicIndex++;
                    }
                }
                return <span className="font-bold text-slate-400">{topicIndex}</span>;
            },
        },
        {
            title: 'Đề tài',
            dataIndex: ['topic', 'title'],
            key: 'topic',
            onCell: (record: any) => ({
                rowSpan: record.rowSpan,
            }),
            render: (title: string, record: MidtermRegistration) => (
                <div 
                    className="cursor-pointer group max-w-[400px]" 
                    onClick={() => handleOpenDetailModal(record)}
                >
                   <div className="font-bold text-blue-600 group-hover:text-blue-800 group-hover:underline transition-all leading-snug">
                       {title}
                   </div>
                   <div className="mt-1.5 flex items-center gap-2">
                       {record.group?.name && (
                           <Tag className="m-0 bg-indigo-50 text-indigo-600 border-indigo-100 font-bold px-1.5 py-0 text-[10px]">
                               NHÓM: {record.group.name}
                           </Tag>
                       )}
                   </div>
                </div>
            ),
        },
        {
            title: 'Sinh viên',
            key: 'student',
            width: 250,
            render: (_: any, record: MidtermRegistration) => {
                const isFailed = record.midterm_status === 'FAIL';
                const studentEl = (
                    <div 
                        className="flex items-center gap-2.5"
                        style={isFailed ? { opacity: 0.5, textDecoration: 'line-through' } : undefined}
                    >
                        <Avatar size={24} src={record.student.avatar_url} icon={<UserOutlined />} className="border border-slate-200" />
                        <div className="flex flex-col">
                            <span className="font-bold text-slate-700 text-[13px] leading-none">{record.student.full_name}</span>
                            <span className="text-slate-400 text-[11px] mt-0.5">{record.student.student_code}</span>
                        </div>
                    </div>
                );

                if (isFailed) {
                    return (
                        <Tooltip title={`Sinh viên này đã rớt đánh giá giữa kỳ. Lý do: ${record.midterm_feedback || 'Không có ý kiến.'}`}>
                            {studentEl}
                        </Tooltip>
                    );
                }
                return studentEl;
            },
        },
        {
            title: 'Ngày đăng ký',
            dataIndex: 'registered_at',
            key: 'registered_at',
            width: 120,
            onCell: (record: any) => ({
                rowSpan: record.rowSpan,
            }),
            render: (date: string) => <span className="text-slate-500 font-medium">{dayjs(date).format('DD/MM/YYYY')}</span>,
        },
        {
            title: 'Kết quả giữa kỳ',
            dataIndex: 'midterm_status',
            key: 'midterm_status',
            width: 130,
            render: (status: string | null) => (
                <div className="flex justify-center">
                    {getMidtermStatusTag(status)}
                </div>
            ),
        },
        {
            title: 'Hành động',
            key: 'action',
            width: 220,
            render: (_: any, record: MidtermRegistration) => {
                // Already graded
                if (record.midterm_status) {
                    const gradedAt = dayjs(record.midterm_graded_at);
                    return (
                        <div className="flex flex-col">
                            <span className="text-slate-400 text-[11px] font-medium uppercase tracking-tight">Đã đánh giá lúc</span>
                            <span className="text-slate-600 font-bold text-[13px]">
                                {gradedAt.isValid() ? gradedAt.format('DD/MM/YYYY HH:mm') : '---'}
                            </span>
                        </div>
                    );
                }

                // Per-record permission from backend
                const canGrade = record.permissions?.grade_midterm ?? false;
                const reason = record.permissions?.grade_midterm_reason || 'Không có quyền chấm điểm.';

                // Can grade
                return (
                    <Space size="middle">
                        <Tooltip title={!canGrade ? reason : ''}>
                            <Button
                                type="primary"
                                icon={<CheckCircleOutlined />}
                                className={canGrade ? "bg-emerald-600 hover:bg-emerald-700 border-none shadow-sm h-9 px-4 font-bold" : "h-9"}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleOpenGradeModal(record, 'PASS');
                                }}
                                disabled={!canGrade}
                            >
                                Đạt
                            </Button>
                        </Tooltip>
                        <Tooltip title={!canGrade ? reason : ''}>
                            <Button
                                danger
                                icon={<CloseCircleOutlined />}
                                className="h-9 px-4 font-bold shadow-sm"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleOpenGradeModal(record, 'FAIL');
                                }}
                                disabled={!canGrade}
                            >
                                Không đạt
                            </Button>
                        </Tooltip>
                    </Space>
                );
            },
        },
    ];

    const totalTopicsCount = registrationsInSemester.length;
    const pendingCount = registrationsInSemester.filter((r: MidtermRegistration) => !r.midterm_status).length;
    const passedCount = registrationsInSemester.filter((r: MidtermRegistration) => r.midterm_status === 'PASS').length;
    const failedCount = registrationsInSemester.filter((r: MidtermRegistration) => r.midterm_status === 'FAIL').length;

    if (isLoading) {
        return (
            <div className="p-12 flex justify-center items-center">
                <Spin size="large" />
            </div>
        );
    }

    if (isError) {
        return (
            <div className="p-6">
                <Alert message="Không thể tải dữ liệu đánh giá giữa kỳ" type="error" showIcon />
            </div>
        );
    }

    return (
        <div className="page-container">
            <div className="page-inner">
                {/* Header */}
                <Card className="page-header-card">
                    <div className="flex items-center gap-3">
                        <div className="page-header-icon"><CheckCircleOutlined className="text-base" /></div>
                        <div>
                            <div className="page-header-title">Đánh giá giữa kỳ</div>
                            <div className="page-header-subtitle">Đánh giá PASS/FAIL cho các nhóm sinh viên được phân công hướng dẫn</div>
                        </div>
                    </div>
                </Card>

            {hasAnyRestrictedPhase && (
                <Alert
                    message={
                        <span className="text-[13px] text-blue-800">
                            <strong>Lưu ý:</strong> Một số nút đánh giá bị khóa do ngoài thời gian quy định hoặc thiếu dữ liệu. Rê chuột vào nút để xem lý do.
                        </span>
                    }
                    type="info"
                    showIcon
                    className="mb-4 py-2 px-4 rounded-xl border-blue-100 bg-blue-50/50"
                />
            )}

            {/* Filter & Stats Tabs */}
            <Card className="page-toolbar-card !mb-4">
                <Tabs 
                    activeKey={filterStatus} 
                    onChange={setFilterStatus}
                    className="sys-tabs sys-tabs-capsule"
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
                                    <span>Chưa đánh giá</span>
                                    <Tag className="m-0 rounded-full bg-orange-50 text-orange-600 border-none font-bold px-2">{pendingCount}</Tag>
                                </div>
                            )
                        },
                        { 
                            key: 'PASS', 
                            label: (
                                <div className="flex items-center gap-2">
                                    <span>Đạt giữa kỳ</span>
                                    <Tag className="m-0 rounded-full bg-green-50 text-green-600 border-none font-bold px-2">{passedCount}</Tag>
                                </div>
                            )
                        },
                        { 
                            key: 'FAIL', 
                            label: (
                                <div className="flex items-center gap-2">
                                    <span>Không đạt giữa kỳ</span>
                                    <Tag className="m-0 rounded-full bg-red-50 text-red-600 border-none font-bold px-2">{failedCount}</Tag>
                                </div>
                            )
                        },
                    ]}
                />
            </Card>

            {/* Table */}
            <Card className="page-card-flush">
                {registrations?.length === 0 ? (
                    <Empty description="Không có nhóm nào cần đánh giá giữa kỳ" className="py-12" />
                ) : (
                    <Table
                        dataSource={processedData}
                        columns={columns}
                        rowKey="id"
                        pagination={{ pageSize: 10, className: 'px-6 py-4' }}
                        className="sys-table border-table"
                        bordered
                    />
                )}
            </Card>

            {/* Detail Modal */}
            <Modal
                title={
                    <div className="flex items-center gap-2">
                        <AuditOutlined className="text-blue-600" />
                        <span>Chi tiết đề tài & Đánh giá</span>
                    </div>
                }
                open={detailModalVisible}
                onCancel={() => {
                    setDetailModalVisible(false);
                    setSelectedDetail(null);
                    setTopicExpanded(false);
                }}
                footer={[
                    <Button key="close" type="primary" onClick={() => {
                        setDetailModalVisible(false);
                        setTopicExpanded(false);
                    }} className="px-6 rounded-lg font-bold h-9">
                        Đóng
                    </Button>
                ]}
                width={580}
                className="sys-modal"
            >
                {selectedDetail && (
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
                                {selectedDetail.topic.title}
                            </div>

                            {topicExpanded && (
                                <div className="mt-3.5 pt-3.5 border-t border-slate-200 space-y-3.5 animate-in fade-in duration-300">
                                    <div>
                                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Mô tả đề tài</div>
                                        <div 
                                            className="text-xs text-slate-600 bg-white p-3 rounded-lg border border-slate-200 leading-relaxed whitespace-pre-wrap shadow-2xs"
                                            dangerouslySetInnerHTML={{ __html: selectedDetail.topic.description || 'Không có mô tả' }}
                                        />
                                    </div>
                                    <div>
                                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Mục tiêu đề tài</div>
                                        <div 
                                            className="text-xs text-slate-600 bg-white p-3 rounded-lg border border-slate-200 leading-relaxed whitespace-pre-wrap shadow-2xs"
                                            dangerouslySetInnerHTML={{ __html: selectedDetail.topic.objectives || 'Không có mục tiêu' }}
                                        />
                                    </div>
                                    <div>
                                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Yêu cầu đối với sinh viên</div>
                                        <div 
                                            className="text-xs text-slate-600 bg-white p-3 rounded-lg border border-slate-200 leading-relaxed whitespace-pre-wrap shadow-2xs"
                                            dangerouslySetInnerHTML={{ __html: selectedDetail.topic.requirements || 'Không có yêu cầu' }}
                                        />
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Mã nhóm</div>
                                <div className="text-[13px] font-bold text-indigo-600">
                                    {selectedDetail.group?.name || '---'}
                                </div>
                            </div>
                            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Ngày đăng ký</div>
                                <div className="text-[13px] font-bold text-slate-700">
                                    {dayjs(selectedDetail.registered_at).format('DD/MM/YYYY')}
                                </div>
                            </div>
                        </div>

                        <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Thành viên nhóm</div>
                            <div className="space-y-2">
                                {selectedDetail.group?.members ? (
                                    selectedDetail.group.members.map((m) => (
                                        <div key={m.user.id} className="flex items-center justify-between bg-white p-2 rounded-lg border border-slate-100 shadow-sm">
                                            <div className="flex items-center gap-2.5">
                                                <Avatar size={28} src={m.user.avatar_url} icon={<UserOutlined />} className="border border-slate-100" />
                                                <div className="flex flex-col">
                                                    <span className="font-bold text-slate-700 text-[12px] leading-none">{m.user.full_name}</span>
                                                    <span className="text-slate-400 text-[10px] mt-0.5">{m.user.student_code}</span>
                                                </div>
                                            </div>
                                            <Tag color="blue" className="m-0 text-[9px] rounded-md border-none font-bold px-1.5 py-0">SINH VIÊN</Tag>
                                        </div>
                                    ))
                                ) : (
                                    <div className="flex items-center gap-2.5 bg-white p-2 rounded-lg border border-slate-100 shadow-sm">
                                        <Avatar size={28} src={selectedDetail.student?.avatar_url} icon={<UserOutlined />} className="border border-slate-100" />
                                        <div className="flex flex-col">
                                            <span className="font-bold text-slate-700 text-[12px] leading-none">{selectedDetail.student?.full_name}</span>
                                            <span className="text-slate-400 text-[10px] mt-0.5">{selectedDetail.student?.student_code}</span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="p-4 bg-white rounded-xl border-2 border-slate-100 shadow-sm relative overflow-hidden">
                            <div className="absolute top-0 left-0 w-1 h-full bg-blue-500" />
                            <div className="flex items-center justify-between mb-3">
                                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Kết quả đánh giá</div>
                                {getMidtermStatusTag(selectedDetail.midterm_status)}
                            </div>
                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Nhận xét của Giảng viên</div>
                            <div className="text-[13px] text-slate-600 italic bg-slate-50 p-3 rounded-lg border border-dashed border-slate-200">
                                {selectedDetail.midterm_feedback || 'Chưa có nhận xét nào.'}
                            </div>
                            {selectedDetail.midterm_graded_at && (
                                <div className="mt-3 text-[10px] text-slate-400 text-right font-medium">
                                    Cập nhật lúc: {dayjs(selectedDetail.midterm_graded_at).format('DD/MM/YYYY HH:mm')}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </Modal>

            {/* Grade Modal */}
            <Modal
                title={
                    <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
                        <div className={`p-2 rounded-xl flex items-center justify-center shadow-sm ${selectedStatus === 'PASS' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                            {selectedStatus === 'PASS' ? <CheckCircleOutlined className="text-lg" /> : <CloseCircleOutlined className="text-lg" />}
                        </div>
                        <div>
                            <span className="text-lg font-bold text-slate-800">Xác nhận đánh giá: {selectedStatus === 'PASS' ? 'Đạt giữa kỳ' : 'Không đạt giữa kỳ'}</span>
                            <div className="text-xs text-slate-400 font-normal mt-0.5">Vui lòng kiểm tra kỹ thông tin trước khi xác nhận</div>
                        </div>
                    </div>
                }
                open={gradeModalVisible}
                onCancel={() => {
                    setGradeModalVisible(false);
                    setSelectedRegistration(null);
                    setSelectedStatus(null);
                    setFeedback('');
                }}
                onOk={handleSubmitGrade}
                confirmLoading={updateMidtermMutation.isPending}
                okText="Xác nhận"
                cancelText="Hủy"
                width={520}
                centered
                okButtonProps={{
                    className: `rounded-xl h-10 px-5 font-semibold text-sm shadow-sm transition-all duration-200 border-none
                        ${selectedStatus === 'PASS' 
                            ? 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-emerald-100' 
                            : 'bg-rose-500 hover:bg-rose-600 text-white shadow-rose-100'
                        }
                    `,
                }}
                cancelButtonProps={{
                    className: "rounded-xl h-10 px-5 font-medium text-sm border-slate-200 text-slate-600 hover:text-slate-800 hover:border-slate-300 transition-all duration-150"
                }}
            >
                {selectedRegistration && (
                    <div className="space-y-4 pt-4">
                        {/* Topic Information Card */}
                        <div className="bg-gradient-to-br from-slate-50 to-white border border-slate-100 rounded-xl p-4 shadow-sm relative overflow-hidden">
                            <div className={`absolute top-0 left-0 w-1 h-full ${selectedStatus === 'PASS' ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Đề tài</div>
                            <div className="text-[15px] font-semibold text-slate-800 leading-snug">{selectedRegistration.topic.title}</div>
                        </div>

                        {/* Students Card */}
                        <div className="bg-slate-50/50 border border-slate-100/80 rounded-xl p-4">
                            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Sinh viên thực hiện</div>
                            <div className="space-y-2.5">
                                {selectedRegistration.group && selectedRegistration.group.members ? (
                                    selectedRegistration.group.members.map((m) => (
                                        <div key={m.user.id} className="flex items-center justify-between bg-white px-3.5 py-2.5 rounded-xl border border-slate-100 shadow-sm">
                                            <div className="flex items-center gap-3">
                                                <Avatar 
                                                    size="default" 
                                                    src={m.user.avatar_url} 
                                                    icon={<UserOutlined />} 
                                                    className="bg-blue-50 text-blue-600 shadow-inner border border-blue-100/50"
                                                />
                                                <div>
                                                    <div className="text-[14px] font-semibold text-slate-700">{m.user.full_name}</div>
                                                    <div className="text-xs text-slate-400 font-medium">Mã SV: {m.user.student_code}</div>
                                                </div>
                                            </div>
                                            <Tag className="rounded-full px-2.5 py-0.5 border-none font-semibold text-[11px] bg-blue-50 text-blue-600 m-0">Thành viên</Tag>
                                        </div>
                                    ))
                                ) : selectedRegistration.student ? (
                                    <div className="flex items-center justify-between bg-white px-3.5 py-2.5 rounded-xl border border-slate-100 shadow-sm">
                                        <div className="flex items-center gap-3">
                                            <Avatar 
                                                size="default" 
                                                src={selectedRegistration.student.avatar_url} 
                                                icon={<UserOutlined />} 
                                                className="bg-blue-50 text-blue-600 shadow-inner border border-blue-100/50"
                                            />
                                            <div>
                                                <div className="text-[14px] font-semibold text-slate-700">{selectedRegistration.student.full_name}</div>
                                                <div className="text-xs text-slate-400 font-medium">Mã SV: {selectedRegistration.student.student_code}</div>
                                            </div>
                                        </div>
                                        <Tag className="rounded-full px-2.5 py-0.5 border-none font-semibold text-[11px] bg-blue-50 text-blue-600 m-0">Thành viên</Tag>
                                    </div>
                                ) : (
                                    <div className="text-slate-400 text-sm italic py-2 text-center">Không tìm thấy thông tin sinh viên</div>
                                )}
                            </div>
                        </div>

                        {/* Feedback / Comments Field */}
                        <div>
                            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 flex items-center justify-between">
                                <span>Nhận xét đánh giá</span>
                                {selectedStatus === 'FAIL' && (
                                    <span className="text-[11px] font-semibold text-rose-500 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-100/50">Bắt buộc</span>
                                )}
                            </div>
                            <TextArea
                                rows={4}
                                value={feedback}
                                onChange={(e) => setFeedback(e.target.value)}
                                placeholder={
                                    selectedStatus === 'FAIL'
                                        ? 'Vui lòng nhập rõ lý do đánh giá không đạt (FAIL)...'
                                        : 'Nhập nhận xét hoặc lưu ý cho sinh viên (không bắt buộc)...'
                                }
                                className="rounded-xl border-slate-200 hover:border-blue-400 focus:border-blue-500 focus:shadow-[0_0_0_3px_rgba(59,130,246,0.08)] transition-all duration-200 p-3 text-slate-700 placeholder-slate-400"
                            />
                            {selectedStatus === 'FAIL' && !feedback.trim() && (
                                <div className="text-rose-500 text-xs mt-1.5 flex items-center gap-1.5 font-medium pl-1">
                                    <ExclamationCircleOutlined />
                                    <span>Vui lòng nhập nhận xét/lý do đánh giá không đạt.</span>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </Modal>
            </div>
        </div>
    );
};

export default MidtermEvaluation;
