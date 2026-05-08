import { Card, Table, Tag, Button, Modal, Space, Input, Tooltip, InputNumber, Tabs, Select, Empty, Row, Col, Flex, Radio, Descriptions, Image } from 'antd';
import { notify } from '@/utils/notification';
import { CheckCircleOutlined, CloseCircleOutlined, EyeOutlined, SearchOutlined, InfoCircleOutlined, SafetyCertificateOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ExtraPointsApi } from '@/api/extraPoints';
import { SemestersApi } from '@/api/semesters';
import { ExtraPoints } from '@/types';
import dayjs from 'dayjs';
import GlobalSearch from '@/components/GlobalSearch';
import HighlightText from '@/components/HighlightText';
import { matchKeyword } from '@/utils/search';
import { useDebounce } from '@/hooks/useDebounce';
import { getFileUrl } from '@/utils/file';

const { Option } = Select;

export default function ExtraPointRequests() {
    const { t } = useTranslation();
    const queryClient = useQueryClient();
    const [rejectModalVisible, setRejectModalVisible] = useState(false);
    const [approveModalVisible, setApproveModalVisible] = useState(false);
    const [detailsModalVisible, setDetailsModalVisible] = useState(false);
    const [selectedRequest, setSelectedRequest] = useState<ExtraPoints | null>(null);
    const [rejectionReason, setRejectionReason] = useState('');
    const [approvedPoints, setApprovedPoints] = useState<number>(0);
    const [pageSize, setPageSize] = useState(10);

    // Filter states
    const [searchText, setSearchText] = useState('');
    const debouncedSearch = useDebounce(searchText, 300);
    const [selectedSemester, setSelectedSemester] = useState<string | null>(null);

    // Fetch all requests
    const { data: requests, isLoading } = useQuery({
        queryKey: ['extraPointRequests'],
        queryFn: () => ExtraPointsApi.getAll(),
    });

    const approveMutation = useMutation({
        mutationFn: (data: { id: string; points: number }) => ExtraPointsApi.approve(data.id, data.points),
        onSuccess: () => {
            notify.success('Đã duyệt yêu cầu điểm cộng');
            setApproveModalVisible(false);
            setDetailsModalVisible(false);
            setSelectedRequest(null);
            queryClient.invalidateQueries({ queryKey: ['extraPointRequests'] });
        },
        onError: (error: any) => notify.error(error.message || 'Lỗi khi duyệt'),
    });

    const rejectMutation = useMutation({
        mutationFn: (data: { id: string; reason: string }) => ExtraPointsApi.reject(data.id, data.reason),
        onSuccess: () => {
            notify.success('Đã từ chối yêu cầu điểm cộng');
            setRejectModalVisible(false);
            setDetailsModalVisible(false);
            setSelectedRequest(null);
            queryClient.invalidateQueries({ queryKey: ['extraPointRequests'] });
        },
        onError: (error: any) => notify.error(error.message || 'Lỗi khi từ chối'),
    });

    const handleOpenApprove = (record: ExtraPoints) => {
        setSelectedRequest(record);
        setApprovedPoints(record.points_requested); // Default to requested points
        setDetailsModalVisible(true);
    };

    const handleOpenReject = (record: ExtraPoints) => {
        setSelectedRequest(record);
        setRejectionReason('');
        setRejectModalVisible(true);
    };

    const handleOpenDetails = (record: ExtraPoints) => {
        setSelectedRequest(record);
        setDetailsModalVisible(true);
    };

    // Filter logic
    // Fetch all semesters for the filter
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
                r.topic?.code
            );
            const matchSemester = selectedSemester ? r.topic?.semester?.id === selectedSemester : true;
            return matchSearch && matchSemester;
        });
    }, [requests, debouncedSearch, selectedSemester]);

    const pendingRequests = useMemo(() => filteredRequests.filter(r => r.status === 'PENDING'), [filteredRequests]);
    const processedRequests = useMemo(() => filteredRequests.filter(r => r.status !== 'PENDING'), [filteredRequests]);



    const indexColumn = {
        title: 'STT',
        key: 'stt',
        width: 60,
        align: 'center' as const,
        render: (_: any, __: any, index: number) => index + 1,
    };

    // Common columns
    const studentColumn = {
        title: 'Sinh viên',
        key: 'student',
        width: 180,
        render: (_: any, record: any) => (
            <div>
                <div className="font-medium text-blue-600">
                    <HighlightText text={record.student?.full_name} keyword={debouncedSearch} />
                </div>
                <div className="text-xs text-gray-500">
                    MSSV: <HighlightText text={record.student?.student_code} keyword={debouncedSearch} />
                </div>
            </div>
        ),
    };

    const topicColumn = {
        title: 'Đề tài',
        render: (_: any, record: any) => (
            <div className="font-medium text-gray-800">
                <HighlightText text={record.topic?.title} keyword={debouncedSearch} />
                <div className="text-[10px] text-gray-400 font-mono mt-0.5">
                    <HighlightText text={record.topic?.code} keyword={debouncedSearch} />
                </div>
            </div>
        )
    };

    const semesterColumn = {
        title: 'Học kỳ',
        key: 'semester',
        width: 140,
        render: (_: any, record: any) => (
            <Tag color="cyan">{record.topic?.semester?.name || '---'}</Tag>
        ),
    };

    const reasonColumn = {
        title: 'Loại thành tích',
        dataIndex: 'reason',
        key: 'reason',
        ellipsis: { showTitle: false },
        width: 250,
        render: (reason: string) => (
            <Tooltip title={reason}>
                <span className="text-gray-600">{reason}</span>
            </Tooltip>
        ),
    };

    const evidenceColumn = {
        title: 'Minh chứng',
        dataIndex: 'evidence_url',
        key: 'evidence',
        width: 100,
        align: 'center' as const,
        render: (url: string) => url ? (
            <div className="flex justify-center">
                <Image
                    src={getFileUrl(url)}
                    alt="evidence"
                    width={40}
                    height={40}
                    className="rounded-md object-cover cursor-pointer border border-gray-100"
                    fallback="https://via.placeholder.com/40?text=ERR"
                    preview={{
                        mask: <EyeOutlined className="text-white" />,
                        maskClassName: "rounded-md"
                    }}
                />
            </div>
        ) : <span className="text-gray-400 italic text-[10px]">Trống</span>,
    };

    const pendingColumns = [
        indexColumn,
        studentColumn,
        reasonColumn,
        evidenceColumn,
        {
            title: 'Ngày nộp',
            dataIndex: 'created_at',
            key: 'created_at',
            width: 120,
            render: (date: string) => <span className="text-gray-500">{dayjs(date).format('DD/MM/YYYY')}</span>,
        },
        {
            title: 'Hành động',
            key: 'action',
            width: 120,
            render: (_: any, record: ExtraPoints) => (
                <Space size={8}>
                    <Tooltip title="Duyệt">
                        <Button
                            type="primary"
                            size="small"
                            icon={<CheckCircleOutlined />}
                            onClick={() => handleOpenApprove(record)}
                        />
                    </Tooltip>
                    <Tooltip title="Từ chối">
                        <Button
                            danger
                            size="small"
                            icon={<CloseCircleOutlined />}
                            onClick={() => handleOpenReject(record)}
                        />
                    </Tooltip>
                    <Tooltip title="Xem chi tiết">
                        <Button
                            size="small"
                            icon={<InfoCircleOutlined />}
                            onClick={() => handleOpenDetails(record)}
                        />
                    </Tooltip>
                </Space>
            ),
        },
    ];

    const processedColumns = [
        indexColumn,
        studentColumn,
        reasonColumn,
        {
            title: 'Kết quả duyệt',
            key: 'result',
            width: 150,
            render: (_: any, record: any) => (
                <div>
                    {record.status === 'APPROVED' ? (
                        <div className="flex flex-col gap-1">
                            <Tag color="success" className="w-fit m-0">Đã duyệt</Tag>
                            <span className="text-xs text-green-600 font-medium">+{record.points_requested} điểm</span>
                        </div>
                    ) : (
                        <Tooltip title={record.rejection_reason}>
                            <Tag color="error" className="m-0">Từ chối</Tag>
                        </Tooltip>
                    )}
                </div>
            ),
        },
        {
            title: 'Người xử lý',
            key: 'reviewer',
            width: 160,
            render: (_: any, record: any) => (
                <div className="text-gray-600">{record.reviewer?.full_name || '---'}</div>
            ),
        },
        {
            title: 'Ngày xử lý',
            dataIndex: 'reviewed_at',
            key: 'reviewed_at',
            width: 120,
            render: (date: string) => date ? <span className="text-gray-500">{dayjs(date).format('DD/MM/YYYY')}</span> : '---',
        },
        evidenceColumn,
    ];

    const renderEmptyPending = () => (
        <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={
                <div className="flex flex-col">
                    <span className="text-gray-800 font-medium">Không có hồ sơ nào cần duyệt</span>
                    <span className="text-gray-400 text-sm mt-1">Hồ sơ của sinh viên sẽ hiển thị tại đây khi được gửi lên.</span>
                </div>
            }
        />
    );

    const renderEmptyProcessed = () => (
        <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={
                <div className="flex flex-col">
                    <span className="text-gray-800 font-medium">Chưa có hồ sơ nào được xử lý</span>
                    <span className="text-gray-400 text-sm mt-1">Kết quả duyệt sẽ hiển thị tại đây.</span>
                </div>
            }
        />
    );

    const tabItems = [
        {
            key: 'pending',
            label: (
                <Flex gap="small" align="center">
                    <span>{t('extraPointManagement.pendingTab')}</span>
                    <Tag className="m-0 rounded-full bg-orange-50 text-orange-600 border-none font-bold px-2">{pendingRequests.length}</Tag>
                </Flex>
            ),
            children: (
                <Table
                    dataSource={pendingRequests}
                    columns={pendingColumns}
                    rowKey="id"
                    loading={isLoading}
                    size="middle"
                    className="sys-table"
                    pagination={{ 
                        pageSize: pageSize,
                        showSizeChanger: true,
                        pageSizeOptions: ['10', '20', '50', '100'],
                        onShowSizeChange: (_, size) => setPageSize(size)
                    }}
                    scroll={{ x: 'max-content' }}
                    locale={{ emptyText: renderEmptyPending() }}
                />
            ),
        },
        {
            key: 'processed',
            label: (
                <Flex gap="small" align="center">
                    <span>{t('extraPointManagement.processedTab')}</span>
                    <Tag className="m-0 rounded-full bg-blue-50 text-blue-600 border-none font-bold px-2">{processedRequests.length}</Tag>
                </Flex>
            ),
            children: (
                <Table
                    dataSource={processedRequests}
                    columns={processedColumns}
                    rowKey="id"
                    loading={isLoading}
                    size="middle"
                    className="sys-table"
                    pagination={{ 
                        pageSize: pageSize,
                        showSizeChanger: true,
                        pageSizeOptions: ['10', '20', '50', '100'],
                        onShowSizeChange: (_, size) => setPageSize(size)
                    }}
                    scroll={{ x: 'max-content' }}
                    locale={{ emptyText: renderEmptyProcessed() }}
                />
            ),
        },
    ];

    return (
        <div className="page-container">
            <div className="page-inner">
            {/* Header */}
                <Card className="page-header-card">
                    <div className="flex items-center gap-3">
                        <div className="page-header-icon"><SafetyCertificateOutlined className="text-base" /></div>
                        <div>
                            <div className="page-header-title">{t('extraPointManagement.title')}</div>
                            <div className="page-header-subtitle">{t('extraPointManagement.subtitle')}</div>
                        </div>
                    </div>
                </Card>
            {/* Filter Toolbar */}
            <Card className="page-toolbar-card">
                <Flex gap="middle" wrap="nowrap" align="center" className="w-full">
                    <div style={{ flex: 2 }}>
                        <GlobalSearch
                            placeholder="Tìm theo tên sinh viên, MSSV, đề tài..."
                            value={searchText}
                            onChange={setSearchText}
                            className="w-full"
                        />
                    </div>
                    
                    <div style={{ flex: 1 }}>
                        <Select
                            placeholder="Chọn học kỳ"
                            style={{ width: '100%' }}
                            value={selectedSemester}
                            onChange={(val) => setSelectedSemester(val)}
                            allowClear
                            showSearch
                            filterOption={(input, option) =>
                                (option?.children as unknown as string).toLowerCase().includes(input.toLowerCase())
                            }
                        >
                            {semesters.map(s => (
                                <Option key={s.id} value={s.id}>{s.name}</Option>
                            ))}
                        </Select>
                    </div>
                    
                    {(searchText || selectedSemester) && (
                        <Button 
                            type="link" 
                            onClick={() => {
                                setSearchText('');
                                setSelectedSemester(null);
                            }}
                            className="px-0"
                        >
                            Xóa bộ lọc
                        </Button>
                    )}
                </Flex>
            </Card>

            {/* Table */}
            <Card className="page-card-flush">
                <Tabs items={tabItems} className="sys-tabs" tabBarStyle={{ paddingLeft: '24px', paddingTop: '8px' }} />
            </Card>

            {/* Reject Modal */}
            <Modal
                title={
                    <div className="flex items-center gap-2">
                        <CloseCircleOutlined className="text-red-500" />
                        <span>Từ chối điểm cộng</span>
                    </div>
                }
                open={rejectModalVisible}
                onCancel={() => setRejectModalVisible(false)}
                onOk={() => rejectMutation.mutate({ id: selectedRequest!.id, reason: rejectionReason })}
                confirmLoading={rejectMutation.isPending}
                okButtonProps={{ danger: true }}
                okText="Xác nhận từ chối"
                cancelText="Hủy"
            >
                <div className="py-4 space-y-4">
                    <div className="bg-gray-50 p-4 rounded-lg">
                        <div className="text-sm text-gray-500">Sinh viên: <span className="font-medium text-gray-800">{selectedRequest?.student?.full_name}</span></div>
                        <div className="text-sm text-gray-500 mt-1">Thành tích: <span className="font-medium text-gray-800">{selectedRequest?.reason}</span></div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Lý do từ chối (bắt buộc &gt; 50 ký tự cho tính minh bạch):</label>
                        <Input.TextArea
                            rows={4}
                            value={rejectionReason}
                            onChange={(e) => setRejectionReason(e.target.value)}
                            placeholder="Nhập lý do cụ thể..."
                        />
                    </div>
                </div>
            </Modal>

            {/* Details Modal */}
            <Modal
                title={
                    <div className="flex items-center gap-2">
                        <SafetyCertificateOutlined className="text-blue-500" />
                        <span className="font-bold text-gray-800">Chi tiết điểm cộng</span>
                    </div>
                }
                open={detailsModalVisible}
                onCancel={() => setDetailsModalVisible(false)}
                footer={
                    selectedRequest?.status === 'PENDING' ? (
                        <div className="px-6 pb-4 flex justify-end gap-2">
                            <Button onClick={() => { setDetailsModalVisible(false); handleOpenReject(selectedRequest!); }}>Từ chối</Button>
                            <Button 
                                type="primary" 
                                onClick={() => approveMutation.mutate({ id: selectedRequest!.id, points: approvedPoints })}
                                loading={approveMutation.isPending}
                                className="px-6"
                            >
                                Duyệt ngay
                            </Button>
                        </div>
                    ) : (
                        <div className="px-6 pb-4">
                            <Button block onClick={() => setDetailsModalVisible(false)}>Đóng</Button>
                        </div>
                    )
                }
                width={580}
                centered
                styles={{ body: { padding: '16px 24px' }, footer: { borderTop: 'none', padding: 0 } }}
            >
                {selectedRequest && (
                    <div className="space-y-4">
                        {/* Basic Info - Perfectly Aligned Grid */}
                        <div className="bg-gray-50/80 p-4 rounded-xl border border-gray-100 space-y-2">
                            <div className="grid grid-cols-2 gap-x-8 gap-y-2">
                                <div className="flex items-baseline gap-3">
                                    <span className="text-gray-400 text-[10px] uppercase font-bold w-16 shrink-0">Sinh viên</span>
                                    <span className="font-bold text-gray-800 truncate">{selectedRequest.student?.full_name}</span>
                                </div>
                                <div className="flex items-baseline gap-3">
                                    <span className="text-gray-400 text-[10px] uppercase font-bold w-12 shrink-0">MSSV</span>
                                    <span className="font-mono text-gray-600">{selectedRequest.student?.student_code}</span>
                                </div>
                                <div className="flex items-baseline gap-3 col-span-2">
                                    <span className="text-gray-400 text-[10px] uppercase font-bold w-16 shrink-0">Học kỳ</span>
                                    <span className="text-blue-600 font-medium text-xs">{selectedRequest.topic?.semester?.name || 'N/A'}</span>
                                </div>
                            </div>
                        </div>

                        {/* Request Content */}
                        <div className="px-1">
                            <div className="flex items-center justify-between mb-1.5">
                                <span className="text-[11px] font-bold text-gray-400 uppercase tracking-tight">Nội dung thành tích</span>
                                <Tag color="blue" className="m-0 border-0 font-bold px-2 py-0 rounded-full text-[10px]">
                                    Dự kiến: +{selectedRequest.points_requested}đ
                                </Tag>
                            </div>
                            <div className="text-gray-700 bg-white border border-gray-100 p-3 rounded-lg text-sm leading-snug">
                                {selectedRequest.reason}
                            </div>
                        </div>

                        {/* Evidence - Modern Image Preview */}
                        {selectedRequest.evidence_url && (
                            <div className="bg-gray-50/50 p-2 rounded-xl border border-gray-100 flex items-center justify-between gap-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-12 h-12 rounded-lg bg-white border border-gray-100 overflow-hidden flex-shrink-0">
                                        <Image
                                            src={getFileUrl(selectedRequest.evidence_url)}
                                            alt="evidence"
                                            width={48}
                                            height={48}
                                            className="object-cover"
                                            preview={{ mask: <EyeOutlined /> }}
                                        />
                                    </div>
                                    <div>
                                        <div className="text-[11px] font-bold text-gray-500 uppercase">Tệp đính kèm</div>
                                        <div className="text-xs text-gray-400 truncate max-w-[200px]">Click để xem phóng to</div>
                                    </div>
                                </div>
                                <Button 
                                    type="primary" 
                                    ghost 
                                    icon={<EyeOutlined />} 
                                    href={getFileUrl(selectedRequest.evidence_url)}
                                    target="_blank"
                                    size="small"
                                    className="rounded-md"
                                >
                                    Mở tab mới
                                </Button>
                            </div>
                        )}

                        {/* Approval - Very compact */}
                        {selectedRequest.status === 'PENDING' && (
                            <div className="pt-2">
                                <div className="bg-orange-50/50 p-4 rounded-xl border border-orange-100/60">
                                    <div className="text-[11px] text-orange-500 uppercase font-bold mb-3">Quyết định điểm duyệt</div>
                                    <Flex vertical gap="small">
                                        <Radio.Group 
                                            value={[0.5, 1.0, 1.5, 2.0].includes(approvedPoints) ? approvedPoints : null} 
                                            onChange={(e) => setApprovedPoints(e.target.value)}
                                            buttonStyle="solid"
                                            className="w-full flex"
                                            size="middle"
                                        >
                                            <Radio.Button value={0.5} className="flex-1 text-center font-bold">+0.5</Radio.Button>
                                            <Radio.Button value={1.0} className="flex-1 text-center font-bold">+1.0</Radio.Button>
                                            <Radio.Button value={1.5} className="flex-1 text-center font-bold">+1.5</Radio.Button>
                                            <Radio.Button value={2.0} className="flex-1 text-center font-bold">+2.0</Radio.Button>
                                        </Radio.Group>
                                        
                                        <div className="flex items-center gap-2 bg-white/80 p-2 px-3 rounded-lg border border-orange-100/50 mt-1">
                                            <span className="text-gray-400 text-[10px] uppercase font-bold whitespace-nowrap">Khác:</span>
                                            <InputNumber
                                                min={0} max={2.0} step={0.1}
                                                value={approvedPoints}
                                                onChange={(val) => setApprovedPoints(val || 0)}
                                                variant="borderless"
                                                className="font-bold text-orange-600 w-full"
                                                size="small"
                                                prefix="+"
                                                suffix={<span className="text-[10px] font-normal text-gray-300">điểm</span>}
                                            />
                                        </div>
                                    </Flex>
                                </div>
                            </div>
                        )}

                        {/* Processed Status */}
                        {selectedRequest.status !== 'PENDING' && (
                            <div className={`p-4 rounded-xl border ${
                                selectedRequest.status === 'APPROVED' ? 'bg-green-50/50 border-green-100' : 'bg-red-50/50 border-red-100'
                            }`}>
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2 font-bold text-sm">
                                        {selectedRequest.status === 'APPROVED' ? <CheckCircleOutlined className="text-green-500" /> : <CloseCircleOutlined className="text-red-500" />}
                                        {selectedRequest.status === 'APPROVED' ? 'Đã duyệt' : 'Đã từ chối'}
                                    </div>
                                    {selectedRequest.status === 'APPROVED' && (
                                        <div className="text-xl font-black text-green-600">+{selectedRequest.points_requested}đ</div>
                                    )}
                                </div>
                                {selectedRequest.status !== 'APPROVED' && (
                                    <div className="text-xs text-red-600 mt-2 bg-white/50 p-2 rounded-lg border border-red-100">
                                        {selectedRequest.rejection_reason}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </Modal>
            </div>
        </div>
    );
}
