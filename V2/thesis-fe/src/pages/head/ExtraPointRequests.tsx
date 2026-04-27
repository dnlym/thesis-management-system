import { Card, Table, Tag, Button, Modal, Space, Input, Tooltip, InputNumber, Tabs, Select, Empty, Row, Col } from 'antd';
import { notify } from '@/utils/notification';
import { CheckCircleOutlined, CloseCircleOutlined, EyeOutlined, SearchOutlined, InfoCircleOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useMemo } from 'react';
import { ExtraPointsApi } from '@/api/extraPoints';
import { ExtraPoints } from '@/types';
import dayjs from 'dayjs';
import GlobalSearch from '@/components/GlobalSearch';
import HighlightText from '@/components/HighlightText';
import { matchKeyword } from '@/utils/search';
import { useDebounce } from '@/hooks/useDebounce';

const { Option } = Select;

export default function ExtraPointRequests() {
    const queryClient = useQueryClient();
    const [rejectModalVisible, setRejectModalVisible] = useState(false);
    const [approveModalVisible, setApproveModalVisible] = useState(false);
    const [detailsModalVisible, setDetailsModalVisible] = useState(false);
    const [selectedRequest, setSelectedRequest] = useState<ExtraPoints | null>(null);
    const [rejectionReason, setRejectionReason] = useState('');
    const [approvedPoints, setApprovedPoints] = useState<number>(0);

    // Filter states
    const [searchText, setSearchText] = useState('');
    const debouncedSearch = useDebounce(searchText, 300);
    const [selectedSemester, setSelectedSemester] = useState<string | null>(null);
    const [selectedReason, setSelectedReason] = useState<string | null>(null);

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
        setApproveModalVisible(true);
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
    const filteredRequests = useMemo(() => {
        if (!requests) return [];
        return requests.filter(r => {
            const matchSearch = matchKeyword(
                debouncedSearch,
                r.student?.full_name,
                r.student?.student_code,
                r.topic?.title,
                r.topic?.code
            );
            const matchSemester = selectedSemester ? r.topic?.semester?.id === selectedSemester : true;
            const matchReason = selectedReason ? r.reason === selectedReason : true;
            return matchSearch && matchSemester && matchReason;
        });
    }, [requests, debouncedSearch, selectedSemester, selectedReason]);

    const pendingRequests = filteredRequests.filter(r => r.status === 'PENDING');
    const processedRequests = filteredRequests.filter(r => r.status !== 'PENDING');

    // Extract unique semesters and reasons for filters
    const semesters = useMemo(() => {
        if (!requests) return [];
        const unique = new Map();
        requests.forEach(r => {
            if (r.topic?.semester) {
                unique.set(r.topic.semester.id, r.topic.semester.name);
            }
        });
        return Array.from(unique.entries()).map(([id, name]) => ({ id, name }));
    }, [requests]);

    const reasons = useMemo(() => {
        if (!requests) return [];
        const unique = new Set<string>();
        requests.forEach(r => {
            if (r.reason) unique.add(r.reason);
        });
        return Array.from(unique);
    }, [requests]);

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
        render: (title: string, record: any) => (
            <div className="font-medium text-gray-800">
                <HighlightText text={title} keyword={debouncedSearch} />
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
        title: 'Tệp minh chứng',
        dataIndex: 'evidence_url',
        key: 'evidence',
        width: 130,
        render: (url: string) => url ? (
            <a href={url} target="_blank" rel="noopener noreferrer">
                <Button type="link" icon={<EyeOutlined />} size="small">Xem tệp</Button>
            </a>
        ) : <span className="text-gray-400 italic">Không có</span>,
    };

    const pendingColumns = [
        indexColumn,
        studentColumn,
        topicColumn,
        semesterColumn,
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
        topicColumn,
        semesterColumn,
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
                            <span className="text-xs text-green-600 font-medium">+{record.approved_points} điểm</span>
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
            label: `Chờ duyệt (Pending) - ${pendingRequests.length}`,
            children: (
                <Table
                    dataSource={pendingRequests}
                    columns={pendingColumns}
                    rowKey="id"
                    loading={isLoading}
                    size="middle"
                    className="sys-table"
                    pagination={{ pageSize: 10 }}
                    scroll={{ x: 'max-content' }}
                    locale={{ emptyText: renderEmptyPending() }}
                />
            ),
        },
        {
            key: 'processed',
            label: 'Kết quả duyệt (Processed)',
            children: (
                <Table
                    dataSource={processedRequests}
                    columns={processedColumns}
                    rowKey="id"
                    loading={isLoading}
                    size="middle"
                    className="sys-table"
                    pagination={{ pageSize: 10 }}
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
                    <div className="page-header-icon"><CheckCircleOutlined className="text-base" /></div>
                    <div>
                        <div className="page-header-title">Duyệt Điểm Cộng NCKH</div>
                        <div className="page-header-subtitle">Xem xét và phê duyệt yêu cầu điểm cộng của sinh viên</div>
                    </div>
                </div>
            </Card>
            {/* Filter Toolbar */}
            <Card className="page-toolbar-card">
                <Row gutter={[16, 0]} align="middle">
                    <Col xs={24} md={8}>
                        <GlobalSearch
                            placeholder="Tìm theo tên sinh viên, MSSV, đề tài..."
                            value={searchText}
                            onChange={setSearchText}
                        />
                    </Col>
                    <Col xs={24} md={8}>
                        <div className="text-sm text-gray-500 mb-1">Học kỳ</div>
                        <Select
                            placeholder="Chọn học kỳ"
                            style={{ width: '100%' }}
                            value={selectedSemester}
                            onChange={(val) => setSelectedSemester(val)}
                            allowClear
                        >
                            {semesters.map(s => (
                                <Option key={s.id} value={s.id}>{s.name}</Option>
                            ))}
                        </Select>
                    </Col>
                    <Col xs={24} md={8}>
                        <div className="text-sm text-gray-500 mb-1">Loại thành tích</div>
                        <Select
                            placeholder="Chọn loại thành tích"
                            style={{ width: '100%' }}
                            value={selectedReason}
                            onChange={(val) => setSelectedReason(val)}
                            allowClear
                        >
                            {reasons.map(r => (
                                <Option key={r} value={r}>{r}</Option>
                            ))}
                        </Select>
                    </Col>
                </Row>
            </Card>

            {/* Table */}
            <Card className="page-card-flush">
                <Tabs items={tabItems} className="sys-tabs" tabBarStyle={{ paddingLeft: '24px', paddingTop: '8px' }} />
            </Card>

            {/* Approve Modal */}
            <Modal
                title={
                    <div className="flex items-center gap-2">
                        <CheckCircleOutlined className="text-green-500" />
                        <span>Duyệt điểm cộng</span>
                    </div>
                }
                open={approveModalVisible}
                onCancel={() => setApproveModalVisible(false)}
                onOk={() => approveMutation.mutate({ id: selectedRequest!.id, points: approvedPoints })}
                confirmLoading={approveMutation.isPending}
                okText="Xác nhận duyệt"
                cancelText="Hủy"
            >
                <div className="py-4 space-y-4">
                    <div className="bg-gray-50 p-4 rounded-lg">
                        <div className="text-sm text-gray-500">Sinh viên: <span className="font-medium text-gray-800">{selectedRequest?.student?.full_name}</span></div>
                        <div className="text-sm text-gray-500 mt-1">Đề tài: <span className="font-medium text-gray-800">{selectedRequest?.topic?.title}</span></div>
                        <div className="text-sm text-gray-500 mt-1">Yêu cầu gốc: <span className="font-medium text-blue-600">+{selectedRequest?.points_requested} điểm</span></div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Điểm duyệt cấp (Tối đa +2.0):</label>
                        <InputNumber
                            min={0.1}
                            max={2.0}
                            step={0.1}
                            value={approvedPoints}
                            onChange={(val) => setApprovedPoints(val || 0)}
                            style={{ width: '100%' }}
                            size="large"
                        />
                    </div>
                </div>
            </Modal>

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
                        <InfoCircleOutlined className="text-blue-500" />
                        <span>Chi tiết hồ sơ NCKH</span>
                    </div>
                }
                open={detailsModalVisible}
                onCancel={() => setDetailsModalVisible(false)}
                footer={
                    selectedRequest?.status === 'PENDING' ? (
                        <div className="flex justify-end gap-2">
                            <Button danger onClick={() => { setDetailsModalVisible(false); handleOpenReject(selectedRequest!); }}>Từ chối</Button>
                            <Button type="primary" onClick={() => { setDetailsModalVisible(false); handleOpenApprove(selectedRequest!); }}>Duyệt ngay</Button>
                        </div>
                    ) : (
                        <Button onClick={() => setDetailsModalVisible(false)}>Đóng</Button>
                    )
                }
                width={600}
            >
                {selectedRequest && (
                    <div className="py-4 space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <div className="text-xs text-gray-500 uppercase tracking-wider">Sinh viên</div>
                                <div className="font-medium text-gray-800 mt-1">{selectedRequest.student?.full_name}</div>
                            </div>
                            <div>
                                <div className="text-xs text-gray-500 uppercase tracking-wider">MSSV</div>
                                <div className="font-medium text-gray-800 mt-1">{selectedRequest.student?.student_code}</div>
                            </div>
                        </div>

                        <div>
                            <div className="text-xs text-gray-500 uppercase tracking-wider">Đề tài</div>
                            <div className="font-medium text-gray-800 mt-1">{selectedRequest.topic?.title}</div>
                        </div>

                        <div className="bg-blue-50/50 p-4 rounded-lg border border-blue-100">
                            <div className="text-xs text-gray-500 uppercase tracking-wider mb-2">Thông tin yêu cầu</div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <div className="text-sm text-gray-600">Loại thành tích:</div>
                                    <div className="font-medium mt-1">{selectedRequest.reason}</div>
                                </div>
                                <div>
                                    <div className="text-sm text-gray-600">Điểm yêu cầu:</div>
                                    <div className="font-medium text-blue-600 mt-1">+{selectedRequest.points_requested} điểm</div>
                                </div>
                            </div>
                            <div className="mt-4 pt-4 border-t border-blue-100">
                                <div className="text-sm text-gray-600 mb-2">Minh chứng đính kèm:</div>
                                {selectedRequest.evidence_url ? (
                                    <a href={selectedRequest.evidence_url} target="_blank" rel="noopener noreferrer">
                                        <Button type="primary" ghost icon={<EyeOutlined />}>Mở tệp minh chứng</Button>
                                    </a>
                                ) : (
                                    <span className="text-gray-400 italic">Hồ sơ không có tệp đính kèm</span>
                                )}
                            </div>
                        </div>

                        {selectedRequest.status !== 'PENDING' && (
                            <div className={`p-4 rounded-lg border ${selectedRequest.status === 'APPROVED' ? 'bg-green-50/50 border-green-100' : 'bg-red-50/50 border-red-100'}`}>
                                <div className="text-xs text-gray-500 uppercase tracking-wider mb-2">Kết quả xử lý</div>
                                {selectedRequest.status === 'APPROVED' ? (
                                    <div>
                                        <div className="flex items-center gap-2 font-medium text-green-700">
                                            <CheckCircleOutlined />
                                            <span>Đã duyệt +{selectedRequest.approved_points} điểm</span>
                                        </div>
                                    </div>
                                ) : (
                                    <div>
                                        <div className="flex items-center gap-2 font-medium text-red-700">
                                            <CloseCircleOutlined />
                                            <span>Đã từ chối</span>
                                        </div>
                                        <div className="text-sm text-gray-600 mt-2">Lý do: {selectedRequest.rejection_reason}</div>
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
