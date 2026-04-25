import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Table, Card, Tag, Input, Typography, Button, Radio, Avatar, Dropdown } from 'antd';
import { SearchOutlined, UserOutlined, FileTextOutlined, DownOutlined, FileExcelOutlined, FileOutlined } from '@ant-design/icons';
import { TopicsApi } from '@/api/topics';
import { Topic } from '@/types';

const { Title, Text } = Typography;

// ── Helpers xuất file ────────────────────────────────────────────────
const getExportRows = (data: Topic[]) =>
    data.map((r, i) => ({
        STT: i + 1,
        'Mã đề tài': r.code || '',
        'Tên đề tài': r.title || '',
        'Sinh viên': r.students?.map((s: any) => s.full_name).join(', ') || '',
        'Điểm HD': (r.students as any)?.[0]?.finalScore?.supervisor_score?.toFixed(1) ?? '',
        'Điểm PB': (r.students as any)?.[0]?.finalScore?.reviewer_avg_score?.toFixed(1) ?? '',
        'Điểm HĐ': (r.students as any)?.[0]?.finalScore?.committee_score?.toFixed(1) ?? '',
        'Tổng điểm': (r.students as any)?.[0]?.finalScore?.final_score?.toFixed(1) ?? '',
        'Kết quả': (r.students as any)?.[0]?.finalScore?.grade_classification ?? '',
    }));

const exportCSV = (data: Topic[]) => {
    const rows = getExportRows(data);
    if (!rows.length) return;
    const headers = Object.keys(rows[0]);
    const csv = [
        headers.join(','),
        ...rows.map(r => headers.map(h => `"${(r as any)[h]}"`).join(',')),
    ].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'ket-qua-khoa-luan.csv';
    a.click();
    URL.revokeObjectURL(url);
};

const exportExcel = async (data: Topic[]) => {
    try {
        const XLSX = await import('xlsx');
        const ws = XLSX.utils.json_to_sheet(getExportRows(data));
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Kết quả');
        XLSX.writeFile(wb, 'ket-qua-khoa-luan.xlsx');
    } catch {
        // Fallback về CSV nếu chưa cài xlsx
        exportCSV(data);
        console.info('Thư viện xlsx chưa được cài, đã xuất dưới dạng CSV.');
    }
};
// ─────────────────────────────────────────────────────────────────────

const FinalResults = () => {
    const [searchText, setSearchText] = useState('');
    const [councilFilter, setCouncilFilter] = useState<'ALL' | 'ORAL' | 'POSTER'>('ALL');

    const { data: results, isLoading } = useQuery({
        queryKey: ['final-results'],
        queryFn: () => TopicsApi.getAll({ status: 'FINALIZED' }),
    });

    const processedData = useMemo(() => {
        if (!results?.topics) return [];
        let filtered = [...results.topics];
        if (councilFilter !== 'ALL') {
            filtered = filtered.filter(item => item.defense_type === councilFilter);
        }
        if (searchText) {
            const q = searchText.toLowerCase();
            filtered = filtered.filter(item =>
                item.title?.toLowerCase().includes(q) ||
                item.code?.toLowerCase().includes(q) ||
                item.students?.some((s: any) =>
                    s.full_name?.toLowerCase().includes(q) ||
                    s.student_code?.toLowerCase().includes(q)
                )
            );
        }
        return filtered;
    }, [results, councilFilter, searchText]);

    const exportMenuItems = [
        {
            key: 'excel',
            icon: <FileExcelOutlined className="text-green-600" />,
            label: <span className="font-medium">Excel (.xlsx)</span>,
            onClick: () => exportExcel(processedData),
        },
        {
            key: 'csv',
            icon: <FileOutlined className="text-slate-500" />,
            label: <span className="text-slate-600">CSV (.csv)</span>,
            onClick: () => exportCSV(processedData),
        },
    ];

    const columns = [
        {
            title: 'STT',
            key: 'index',
            width: 55,
            align: 'center' as const,
            render: (_: any, __: any, index: number) => (
                <span className="text-slate-400 text-xs">{index + 1}</span>
            ),
        },
        {
            title: 'Mã',
            dataIndex: 'code',
            key: 'code',
            width: 75,
            render: (code: string) => (
                <Tag color="blue" className="font-mono text-xs">{code}</Tag>
            ),
        },
        {
            title: 'Tên đề tài',
            dataIndex: 'title',
            key: 'title',
            ellipsis: true,
            render: (title: string) => (
                <span className="font-semibold text-slate-800">{title}</span>
            ),
        },
        {
            title: 'Sinh viên',
            dataIndex: 'students',
            key: 'students',
            width: 190,
            render: (students: any[]) => (
                <div className="flex flex-col gap-1">
                    {students?.map((s: any) => (
                        <div key={s.id} className="flex items-center gap-1.5">
                            <Avatar
                                size={18}
                                src={s.avatar_url}
                                icon={<UserOutlined />}
                                className="bg-slate-200 flex-shrink-0"
                            />
                            <Text className="text-[12px] text-slate-700 leading-tight">{s.full_name}</Text>
                        </div>
                    ))}
                </div>
            ),
        },
        {
            title: 'Điểm HD',
            key: 'supervisor',
            align: 'center' as const,
            width: 78,
            render: (record: Topic) => (
                <span className="text-slate-600 text-sm">
                    {(record.students as any)?.[0]?.finalScore?.supervisor_score?.toFixed(1) || '—'}
                </span>
            ),
        },
        {
            title: 'Điểm PB',
            key: 'reviewer',
            align: 'center' as const,
            width: 78,
            render: (record: Topic) => (
                <span className="text-slate-600 text-sm">
                    {(record.students as any)?.[0]?.finalScore?.reviewer_avg_score?.toFixed(1) || '—'}
                </span>
            ),
        },
        {
            title: 'Điểm HĐ',
            key: 'committee',
            align: 'center' as const,
            width: 78,
            render: (record: Topic) => (
                <span className="text-slate-600 text-sm">
                    {(record.students as any)?.[0]?.finalScore?.committee_score?.toFixed(1) || '—'}
                </span>
            ),
        },
        {
            title: 'Tổng',
            key: 'total',
            align: 'center' as const,
            width: 70,
            render: (record: Topic) => (
                <Text strong className="text-blue-600 text-sm">
                    {(record.students as any)?.[0]?.finalScore?.final_score?.toFixed(1) || '—'}
                </Text>
            ),
        },
        {
            title: 'Kết quả',
            key: 'result',
            align: 'center' as const,
            width: 95,
            render: (record: Topic) => {
                const cls = (record.students as any)?.[0]?.finalScore?.grade_classification;
                let color = 'default';
                if (cls === 'Xuất sắc') color = 'gold';
                if (cls === 'Giỏi') color = 'green';
                if (cls === 'Khá') color = 'blue';
                if (cls === 'Trung bình') color = 'orange';
                return (
                    <Tag color={color} className="min-w-[68px] text-center m-0 text-xs">
                        {cls || '—'}
                    </Tag>
                );
            },
        },
    ];

    return (
        <div className="page-container">
            <div className="page-inner">

                {/* Header — title + export cùng 1 hàng */}
                <Card className="page-header-card">
                    <div className="flex items-center justify-between gap-4">
                        {/* Icon + title */}
                        <div className="flex items-center gap-3 min-w-0">
                            <div className="page-header-icon">
                                <FileTextOutlined className="text-base" />
                            </div>
                            <div className="min-w-0">
                                <div className="page-header-title">
                                    Bảng kết quả khóa luận
                                </div>
                                <div className="page-header-subtitle">
                                    Xem và xuất danh sách kết quả theo hội đồng
                                </div>
                            </div>
                        </div>

                        {/* Export dropdown */}
                        <Dropdown
                            menu={{ items: exportMenuItems }}
                            trigger={['click']}
                            placement="bottomRight"
                        >
                            <Button
                                icon={<FileExcelOutlined className="text-green-600" />}
                                className="flex-shrink-0 rounded-lg border-slate-300 font-medium"
                            >
                                Xuất dữ liệu <DownOutlined className="text-[10px] ml-0.5 opacity-60" />
                            </Button>
                        </Dropdown>
                    </div>
                </Card>

                {/* Filter & Search */}
                <Card className="page-toolbar-card">
                    <div className="flex items-center gap-4">
                        <Radio.Group
                            value={councilFilter}
                            onChange={e => setCouncilFilter(e.target.value)}
                            buttonStyle="solid"
                            size="middle"
                        >
                            <Radio.Button value="ALL">Tất cả hội đồng</Radio.Button>
                            <Radio.Button value="ORAL">Oral</Radio.Button>
                            <Radio.Button value="POSTER">Poster</Radio.Button>
                        </Radio.Group>

                        <Input
                            placeholder="Tìm theo mã, tên đề tài, sinh viên..."
                            prefix={<SearchOutlined className="text-slate-400" />}
                            className="rounded-lg h-9 border-slate-200 flex-1"
                            value={searchText}
                            onChange={e => setSearchText(e.target.value)}
                            allowClear
                        />
                    </div>
                </Card>

                {/* Table */}
                <Card className="page-card-flush">
                    <Table
                        dataSource={processedData}
                        columns={columns}
                        rowKey="id"
                        loading={isLoading}
                        size="middle"
                        pagination={{
                            pageSize: 10,
                            className: 'px-6 py-4 !m-0 border-t border-slate-100',
                            showSizeChanger: false,
                            showTotal: (total) => (
                                <span className="text-slate-400 text-sm">Tổng {total} đề tài</span>
                            ),
                        }}
                        className="sys-table"
                    />
                </Card>

            </div>
        </div>
    );
};

export default FinalResults;
