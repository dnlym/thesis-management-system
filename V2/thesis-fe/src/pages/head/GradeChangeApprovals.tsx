import { Card, Table, Tag, Button, Modal, Space, Input, Tooltip, Select, Empty, Flex, Typography, Badge, Avatar, Divider } from 'antd';
import { notify } from '@/utils/notification';
import { 
  CheckCircleOutlined, 
  CloseCircleOutlined, 
  EyeOutlined, 
  HistoryOutlined, 
  UserOutlined, 
  SwapOutlined, 
  MessageOutlined,
  FilterOutlined 
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useMemo } from 'react';
import { GradingApi } from '@/api/grading';
import { SemestersApi } from '@/api/semesters';
import dayjs from 'dayjs';
import GlobalSearch from '@/components/GlobalSearch';
import HighlightText from '@/components/HighlightText';
import { matchKeyword } from '@/utils/search';
import { useDebounce } from '@/hooks/useDebounce';

const { Title, Text, Paragraph } = Typography;
const { Option } = Select;

export default function GradeChangeApprovals() {
    const queryClient = useQueryClient();
    const [rejectModalVisible, setRejectModalVisible] = useState(false);
    const [detailsModalVisible, setDetailsModalVisible] = useState(false);
    const [selectedRequest, setSelectedRequest] = useState<any | null>(null);
    const [rejectionReason, setRejectionReason] = useState('');
    const [pageSize, setPageSize] = useState(10);

    // Filter states
    const [searchText, setSearchText] = useState('');
    const debouncedSearch = useDebounce(searchText, 300);
    const [selectedSemester, setSelectedSemester] = useState<string | null>(null);

    // Fetch all requests
    const { data: requests, isLoading } = useQuery({
        queryKey: ['gradeChangeRequests'],
        queryFn: () => GradingApi.getPendingChangeRequests(),
    });

    const approveMutation = useMutation({
        mutationFn: (requestId: string) => GradingApi.approveChangeRequest(requestId),
        onSuccess: () => {
            notify.success('Đã phê duyệt thay đổi điểm');
            setDetailsModalVisible(false);
            setSelectedRequest(null);
            queryClient.invalidateQueries({ queryKey: ['gradeChangeRequests'] });
            queryClient.invalidateQueries({ queryKey: ['grade-history'] });
        },
        onError: (error: any) => notify.error(error.message || 'Lỗi khi phê duyệt'),
    });

    const rejectMutation = useMutation({
        mutationFn: (data: { id: string; reason: string }) => GradingApi.rejectChangeRequest(data.id, data.reason),
        onSuccess: () => {
            notify.success('Đã từ chối yêu cầu sửa điểm');
            setRejectModalVisible(false);
            setDetailsModalVisible(false);
            setSelectedRequest(null);
            queryClient.invalidateQueries({ queryKey: ['gradeChangeRequests'] });
            queryClient.invalidateQueries({ queryKey: ['grade-history'] });
        },
        onError: (error: any) => notify.error(error.message || 'Lỗi khi từ chối'),
    });

    const handleOpenReject = (record: any) => {
        setSelectedRequest(record);
        setRejectionReason('');
        setRejectModalVisible(true);
    };

    const handleOpenDetails = (record: any) => {
        setSelectedRequest(record);
        setDetailsModalVisible(true);
    };

    // Filter logic
    const { data: allSemestersData } = useQuery({
        queryKey: ['semesters'],
        queryFn: () => SemestersApi.getAll(),
    });

    const semesters = useMemo(() => {
        const data = Array.isArray(allSemestersData) ? allSemestersData : [];
        return data.map(s => ({ id: s.id, name: s.name }));
    }, [allSemestersData]);

    const filteredRequests = useMemo(() => {
        const data = Array.isArray(requests) ? requests : [];
        return data.filter(r => {
            const matchSearch = matchKeyword(
                debouncedSearch,
                r.student?.full_name,
                r.student?.student_code,
                r.topic?.title,
                r.grader?.full_name
            );
            const matchSemester = selectedSemester ? r.topic?.semester?.id === selectedSemester : true;
            return matchSearch && matchSemester;
        });
    }, [requests, debouncedSearch, selectedSemester]);

    const columns = [
        {
            title: 'STT',
            key: 'stt',
            width: 60,
            align: 'center' as const,
            render: (_: any, __: any, index: number) => index + 1,
        },
        {
            title: 'Sinh viên',
            key: 'student',
            width: 220,
            render: (_: any, record: any) => (
                <Flex gap="small" align="center">
                    <Avatar className="bg-blue-50 text-blue-600 font-bold text-[10px] border border-blue-100 flex-shrink-0" size={28}>
                        {record.student?.full_name?.charAt(0)}
                    </Avatar>
                    <div className="flex flex-col overflow-hidden">
                        <Text className="text-[13px] font-bold text-slate-700 leading-tight truncate">
                            <HighlightText text={record.student?.full_name} keyword={debouncedSearch} />
                        </Text>
                        <Text className="text-[10px] text-slate-400 font-mono font-bold">
                            <HighlightText text={record.student?.student_code} keyword={debouncedSearch} />
                        </Text>
                    </div>
                </Flex>
            ),
        },
        {
            title: 'Giảng viên yêu cầu',
            key: 'grader',
            width: 180,
            render: (_: any, record: any) => (
                <div>
                    <div className="font-bold text-slate-600 text-[13px] leading-tight">
                        <HighlightText text={record.grader?.full_name} keyword={debouncedSearch} />
                    </div>
                    <Tag className="m-0 mt-1 text-[9px] font-black border-none bg-slate-100 text-slate-500 rounded px-1.5">{record.rater_role}</Tag>
                </div>
            ),
        },
        {
            title: 'Tiêu chí',
            dataIndex: ['criterion', 'name'],
            key: 'criterion',
            render: (name: string) => <Text className="text-[11px] italic text-slate-400 font-medium">{name}</Text>
        },
        {
            title: 'Thay đổi điểm',
            key: 'change',
            width: 140,
            align: 'center' as const,
            render: (_: any, record: any) => (
                <div className="flex items-center justify-center gap-2">
                    <Text delete className="text-slate-300 text-[11px] tabular-nums">{record.old_score ?? '—'}</Text>
                    <SwapOutlined className="text-blue-400 text-[10px]" />
                    <Text className="text-blue-600 font-black text-[15px] tabular-nums tracking-tighter">{record.new_score}</Text>
                </div>
            ),
        },
        {
            title: 'Ngày gửi',
            dataIndex: 'created_at',
            key: 'created_at',
            width: 120,
            render: (date: string) => <Text className="text-[11px] text-slate-400 font-bold">{dayjs(date).format('DD/MM/YYYY')}</Text>,
        },
        {
            title: 'Hành động',
            key: 'action',
            width: 120,
            align: 'center' as const,
            render: (_: any, record: any) => (
                <Space size={4}>
                    <Tooltip title="Xem chi tiết">
                        <Button
                            type="primary"
                            size="small"
                            className="bg-blue-600 rounded-md"
                            icon={<EyeOutlined />}
                            onClick={() => handleOpenDetails(record)}
                        />
                    </Tooltip>
                    <Tooltip title="Từ chối">
                        <Button
                            danger
                            size="small"
                            className="rounded-md"
                            icon={<CloseCircleOutlined />}
                            onClick={() => handleOpenReject(record)}
                        />
                    </Tooltip>
                </Space>
            ),
        },
    ];

    return (
        <div className="page-container">
            <div className="page-inner">
                {/* Header Section */}
                <Card className="page-header-card">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                        <div className="flex items-center gap-3">
                            <div className="page-header-icon"><HistoryOutlined className="text-base" /></div>
                            <div>
                                <div className="page-header-title">Phê duyệt sửa điểm</div>
                                <div className="page-header-subtitle">Quản lý các yêu cầu thay đổi điểm số sau thời hạn từ Giảng viên</div>
                            </div>
                        </div>
                        <Badge count={filteredRequests.length} overflowCount={99}>
                            <Tag color="processing" className="m-0 rounded-full px-4 border-none py-0.5 font-bold uppercase text-[10px]">
                                Chờ xử lý
                            </Tag>
                        </Badge>
                    </div>
                </Card>

                {/* Toolbar Card */}
                <Card className="page-toolbar-card">
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                        <div className="flex-1 flex items-center gap-3">
                            <GlobalSearch
                                placeholder="Tìm theo tên sinh viên, MSSV, giảng viên..."
                                value={searchText}
                                onChange={setSearchText}
                                className="w-full lg:w-[400px]"
                            />
                            <Select
                                placeholder="Lọc theo học kỳ"
                                style={{ width: 200 }}
                                value={selectedSemester}
                                onChange={setSelectedSemester}
                                allowClear
                                className="h-10"
                            >
                                {semesters.map(s => <Option key={s.id} value={s.id}>{s.name}</Option>)}
                            </Select>
                        </div>
                        <div className="flex items-center gap-2">
                            <Button icon={<FilterOutlined />} className="h-10 rounded-lg" />
                        </div>
                    </div>
                </Card>

                {/* Table Section */}
                <Card className="page-card-flush">
                    <Table
                        dataSource={filteredRequests}
                        columns={columns as any}
                        rowKey="id"
                        loading={isLoading}
                        size="middle"
                        className="sys-table"
                        pagination={{ 
                            pageSize: pageSize,
                            showSizeChanger: true,
                            onShowSizeChange: (_, size) => setPageSize(size),
                            className: "px-6"
                        }}
                        locale={{ 
                            emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Không có yêu cầu nào cần xử lý" /> 
                        }}
                    />
                </Card>

                {/* Details Modal */}
                <Modal
                    title={
                        <Flex gap="small" align="center">
                            <div className="p-1.5 bg-blue-50 rounded-lg text-blue-600"><EyeOutlined /></div>
                            <span className="font-black text-slate-800 uppercase tracking-tight text-[15px]">Chi tiết yêu cầu sửa điểm</span>
                        </Flex>
                    }
                    open={detailsModalVisible}
                    onCancel={() => setDetailsModalVisible(false)}
                    footer={[
                        <Button key="close" onClick={() => setDetailsModalVisible(false)} className="rounded-lg font-bold px-6">Đóng</Button>,
                        <Button key="reject" danger onClick={() => handleOpenReject(selectedRequest)} className="rounded-lg font-bold px-6">Từ chối</Button>,
                        <Button 
                            key="approve" 
                            type="primary" 
                            className="bg-green-600 hover:bg-green-700 rounded-lg font-bold px-8 shadow-md shadow-green-100" 
                            onClick={() => approveMutation.mutate(selectedRequest.id)}
                            loading={approveMutation.isPending}
                        >
                            Phê duyệt ngay
                        </Button>
                    ]}
                    width={600}
                    centered
                    className="sys-modal"
                >
                    {selectedRequest && (
                        <div className="py-4 space-y-6">
                            {/* Info Section */}
                            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 grid grid-cols-2 gap-4">
                                <div>
                                    <Text className="text-[10px] uppercase font-black text-slate-400 block mb-1 tracking-widest">Sinh viên</Text>
                                    <Text className="block text-slate-700 font-bold text-[14px] leading-tight">{selectedRequest.student?.full_name}</Text>
                                    <Text className="text-[11px] font-mono text-slate-400 font-bold">{selectedRequest.student?.student_code}</Text>
                                </div>
                                <div>
                                    <Text className="text-[10px] uppercase font-black text-slate-400 block mb-1 tracking-widest">Giảng viên yêu cầu</Text>
                                    <Text className="block text-slate-700 font-bold text-[14px] leading-tight">{selectedRequest.grader?.full_name}</Text>
                                    <Tag className="m-0 mt-1 text-[9px] font-black border-none bg-blue-50 text-blue-600 rounded px-1.5 uppercase tracking-tighter">
                                        {selectedRequest.rater_role}
                                    </Tag>
                                </div>
                            </div>

                            {/* Comparison Section */}
                            <div className="text-center py-8 bg-white border border-slate-100 rounded-2xl relative overflow-hidden shadow-sm">
                                <Flex justify="center" align="center" gap={48}>
                                    <div className="text-center">
                                        <Text className="text-[10px] uppercase font-black text-slate-300 block mb-2 tracking-widest">Điểm cũ</Text>
                                        <Text delete className="text-3xl font-black text-slate-200 tabular-nums">{selectedRequest.old_score ?? '—'}</Text>
                                    </div>
                                    <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center border border-blue-100 shadow-inner">
                                        <SwapOutlined className="text-blue-600 text-xl" />
                                    </div>
                                    <div className="text-center">
                                        <Text className="text-[10px] uppercase font-black text-blue-400 block mb-2 tracking-widest">Điểm mới</Text>
                                        <Text className="text-5xl font-black text-blue-600 tabular-nums tracking-tighter leading-none">{selectedRequest.new_score}</Text>
                                    </div>
                                </Flex>
                                <Divider className="my-6 border-slate-50" />
                                <div className="px-6">
                                    <Text className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Tiêu chí chấm điểm</Text>
                                    <Text className="text-slate-600 font-bold italic">{selectedRequest.criterion?.name}</Text>
                                </div>
                            </div>

                            {/* Reason Section */}
                            <div className="px-1">
                                <Flex gap="small" align="center" className="mb-2">
                                    <MessageOutlined className="text-blue-500 text-xs" />
                                    <Text className="text-[11px] uppercase font-black text-slate-500 tracking-widest">Lý do giải trình</Text>
                                </Flex>
                                <div className="bg-slate-50 border border-slate-100 p-4 rounded-xl text-slate-600 italic leading-relaxed text-[13px] shadow-inner font-medium">
                                    "{selectedRequest.reason}"
                                </div>
                            </div>
                        </div>
                    )}
                </Modal>

                {/* Reject Modal */}
                <Modal
                    title={
                        <Flex gap="small" align="center">
                            <div className="p-1.5 bg-red-50 rounded-lg text-red-600"><CloseCircleOutlined /></div>
                            <span className="font-black text-slate-800 uppercase tracking-tight text-[15px]">Từ chối yêu cầu</span>
                        </Flex>
                    }
                    open={rejectModalVisible}
                    onCancel={() => setRejectModalVisible(false)}
                    onOk={() => rejectMutation.mutate({ id: selectedRequest!.id, reason: rejectionReason })}
                    confirmLoading={rejectMutation.isPending}
                    okButtonProps={{ danger: true, className: "rounded-lg px-6 font-bold" }}
                    cancelButtonProps={{ className: "rounded-lg px-6 font-bold" }}
                    okText="Xác nhận từ chối"
                    cancelText="Hủy"
                >
                    <div className="py-4">
                        <Paragraph className="text-slate-500">Bạn đang từ chối yêu cầu sửa điểm của giảng viên <b>{selectedRequest?.grader?.full_name}</b>.</Paragraph>
                        <Text className="text-[11px] uppercase font-black text-slate-400 tracking-widest block mb-2">Lý do từ chối:</Text>
                        <Input.TextArea
                            rows={4}
                            value={rejectionReason}
                            onChange={(e) => setRejectionReason(e.target.value)}
                            placeholder="Nhập lý do cụ thể gửi tới giảng viên (bắt buộc)..."
                            className="rounded-xl border-slate-200"
                        />
                    </div>
                </Modal>
            </div>
        </div>
    );
}
