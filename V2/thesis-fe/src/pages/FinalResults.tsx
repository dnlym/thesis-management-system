import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Table, Card, Tag, Input, Typography, Button, Radio, Avatar, Dropdown } from 'antd';
import { SearchOutlined, UserOutlined, FileTextOutlined, DownOutlined, FileExcelOutlined, FileOutlined } from '@ant-design/icons';
import { TopicsApi } from '@/api/topics';
import { Topic } from '@/types';
import GlobalSearch from '@/components/GlobalSearch';
import HighlightText from '@/components/HighlightText';
import { matchKeyword } from '@/utils/search';
import { useDebounce } from '@/hooks/useDebounce';

const { Title, Text } = Typography;

// ── Helpers xuất file ────────────────────────────────────────────────
// ── Helpers xuất file chuyên nghiệp ─────────────────────────────────────
const getExportData = (data: Topic[]) => {
    const rows: any[] = [];
    let stt = 1;

    data.forEach((topic) => {
        topic.students?.forEach((student: any, index: number) => {
            const final = student.finalScore;
            rows.push({
                'STT': index === 0 ? stt : '', // Chỉ hiện STT ở dòng đầu của nhóm
                'Mã nhóm': index === 0 ? (topic.groupName || topic.code) : '', 
                'Tên đề tài': index === 0 ? topic.title : '',
                'MSSV': student.student_code || '',
                'Họ tên sinh viên': student.full_name || '',
                'Điểm HD': final?.supervisor_score?.toFixed(1) || '0',
                'Điểm PB': final?.reviewer_avg_score?.toFixed(1) || '0',
                'Điểm HĐ': final?.committee_score?.toFixed(1) || '0',
                'Điểm cộng': final?.extra_points?.toFixed(1) || '0',
                'Tổng điểm': final?.final_score?.toFixed(1) || '0',
                'Trạng thái': (final?.final_score || 0) >= 6 ? 'ĐẠT' : 'KHÔNG ĐẠT',
                'Xếp loại': final?.grade_classification || '—',
            });
        });
        stt++;
    });
    return rows;
};

const exportCSV = (data: Topic[]) => {
    const rows = getExportData(data);
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
        const rows = getExportData(data);
        if (!rows.length) return;

        const semesterName = data[0]?.semester?.name || '...';
        const headers = Object.keys(rows[0]);
        const dataRows = rows.map(r => headers.map(h => r[h]));

        // Tạo cấu trúc file có Header
        const aoaData = [
            ['TRƯỜNG ĐẠI HỌC CÔNG NGHIỆP TP.HCM'],
            ['KHOA CÔNG NGHỆ THÔNG TIN'],
            [''],
            ['DANH SÁCH KẾT QUẢ KHÓA LUẬN TỐT NGHIỆP'],
            [`Học kỳ: ${semesterName}`],
            [''],
            headers,
            ...dataRows
        ];

        const ws = XLSX.utils.aoa_to_sheet(aoaData);
        
        // Merge cells cho các tiêu đề
        ws['!merges'] = [
            { s: { r: 0, c: 0 }, e: { r: 0, c: 3 } }, // Trường
            { s: { r: 1, c: 0 }, e: { r: 1, c: 3 } }, // Khoa
            { s: { r: 3, c: 0 }, e: { r: 3, c: 11 } }, // Tiêu đề chính
            { s: { r: 4, c: 0 }, e: { r: 4, c: 11 } }, // Học kỳ
        ];

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'KetQua');
        XLSX.writeFile(wb, `Ket-qua-khoa-luan-${semesterName.replace(/\s+/g, '-')}.xlsx`);
    } catch (err) {
        console.error('Export error:', err);
        exportCSV(data);
    }
};
// ─────────────────────────────────────────────────────────────────────

const FinalResults = () => {
    const [searchText, setSearchText] = useState('');
    const debouncedSearch = useDebounce(searchText, 300);
    const [councilFilter, setCouncilFilter] = useState<'ALL' | 'ORAL' | 'POSTER'>('ALL');

    const { data: results, isLoading } = useQuery({
        queryKey: ['final-results'],
        queryFn: () => TopicsApi.getAll({ status: 'FINALIZED' }),
    });

    const processedData = useMemo(() => {
        if (!results?.topics) return [];
        let filtered = [...results.topics];
        if (councilFilter !== 'ALL') {
            filtered = filtered.filter(item => {
                // Ưu tiên lấy type từ Hội đồng thực tế, nếu không có mới dùng defense_type của đề tài
                const effectiveType = item.committee?.type || item.defense_type;
                return effectiveType === councilFilter;
            });
        }
        if (debouncedSearch) {
            filtered = filtered.filter(item =>
                matchKeyword(
                    debouncedSearch,
                    item.title,
                    item.code,
                    ...item.students?.map((s: any) => s.full_name),
                    ...item.students?.map((s: any) => s.student_code)
                )
            );
        }
        // Sắp xếp theo điểm tổng kết từ cao xuống thấp
        filtered.sort((a, b) => {
            const scoreA = (a.students as any)?.[0]?.finalScore?.final_score || 0;
            const scoreB = (b.students as any)?.[0]?.finalScore?.final_score || 0;
            return scoreB - scoreA;
        });

        return filtered;
    }, [results, councilFilter, debouncedSearch]);

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
            render: (_: any, __: any, index: number) => index + 1,
        },
        {
            title: 'Mã nhóm',
            key: 'groupCode',
            width: 100,
            render: (record: any) => (
                <Tag color="blue" className="m-0 font-mono text-[11px] font-bold">
                    <HighlightText text={record.groupName || record.code} keyword={debouncedSearch} />
                </Tag>
            ),
        },
        {
            title: 'Tên đề tài',
            key: 'title',
            render: (text: string, record: Topic) => (
                <div className="max-w-md">
                    <div className="text-sm font-semibold text-slate-800 mb-1">
                        <HighlightText text={record.title} keyword={debouncedSearch} />
                    </div>
                    <div className="text-[11px] text-slate-400">
                        GVHD: <span className="font-medium text-slate-500">{record.supervisor?.full_name}</span>
                    </div>
                </div>
            ),
        },
        {
            title: 'Sinh viên',
            dataIndex: 'students',
            key: 'students',
            width: 220,
            render: (students: any[]) => (
                <div className="flex flex-col gap-2">
                    {students?.map((s: any) => (
                        <div key={s.id} className="flex items-center gap-2 h-7">
                            <Avatar size={20} src={s.avatar_url} icon={<UserOutlined />} className="bg-slate-200 flex-shrink-0" />
                            <div className="flex flex-col leading-tight overflow-hidden">
                                <div className="text-[11px] font-semibold text-slate-700 truncate">
                                    <HighlightText text={s.full_name} keyword={debouncedSearch} />
                                </div>
                                <div className="text-[10px] text-slate-400 font-mono font-bold">
                                    <HighlightText text={s.student_code} keyword={debouncedSearch} />
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            ),
        },
        {
            title: 'Điểm HD',
            key: 'supervisor',
            align: 'center' as const,
            width: 75,
            render: (record: Topic) => (
                <div className="flex flex-col gap-2">
                    {record.students?.map((s: any) => (
                        <div key={s.id} className="h-7 flex items-center justify-center text-slate-600 text-xs font-medium">
                            {s.finalScore?.supervisor_score?.toFixed(1) || '—'}
                        </div>
                    ))}
                </div>
            ),
        },
        {
            title: 'Điểm PB',
            key: 'reviewer',
            align: 'center' as const,
            width: 75,
            render: (record: Topic) => (
                <div className="flex flex-col gap-2">
                    {record.students?.map((s: any) => (
                        <div key={s.id} className="h-7 flex items-center justify-center text-slate-600 text-xs font-medium">
                            {s.finalScore?.reviewer_avg_score?.toFixed(1) || '—'}
                        </div>
                    ))}
                </div>
            ),
        },
        {
            title: 'Điểm HĐ',
            key: 'committee',
            align: 'center' as const,
            width: 75,
            render: (record: Topic) => (
                <div className="flex flex-col gap-2">
                    {record.students?.map((s: any) => (
                        <div key={s.id} className="h-7 flex items-center justify-center text-slate-600 text-xs font-medium">
                            {s.finalScore?.committee_score?.toFixed(1) || '—'}
                        </div>
                    ))}
                </div>
            ),
        },
        {
            title: 'Cộng',
            key: 'extra',
            align: 'center' as const,
            width: 60,
            render: (record: Topic) => (
                <div className="flex flex-col gap-2">
                    {record.students?.map((s: any) => (
                        <div key={s.id} className="h-7 flex items-center justify-center text-amber-600 text-xs font-bold">
                            {s.finalScore?.extra_points ? `+${s.finalScore.extra_points.toFixed(1)}` : '—'}
                        </div>
                    ))}
                </div>
            ),
        },
        {
            title: 'Tổng',
            key: 'total',
            align: 'center' as const,
            width: 65,
            render: (record: Topic) => (
                <div className="flex flex-col gap-2">
                    {record.students?.map((s: any) => (
                        <div key={s.id} className="h-7 flex items-center justify-center text-blue-600 font-black text-sm">
                            {s.finalScore?.final_score?.toFixed(1) || '—'}
                        </div>
                    ))}
                </div>
            ),
        },
        /* Result Column - Đạt/Không đạt (>= 6.0) */
        {
            title: 'Trạng thái',
            key: 'status',
            align: 'center' as const,
            width: 95,
            render: (record: Topic) => (
                <div className="flex flex-col gap-2">
                    {record.students?.map((s: any) => {
                        const score = s.finalScore?.final_score || 0;
                        const isPass = score >= 6.0;
                        return (
                            <div key={s.id} className="h-7 flex items-center justify-center">
                                <Tag color={isPass ? 'success' : 'error'} className="m-0 font-bold px-2 text-[10px] py-0 leading-none h-5 flex items-center">
                                    {isPass ? 'ĐẠT' : 'KHÔNG ĐẠT'}
                                </Tag>
                            </div>
                        );
                    })}
                </div>
            ),
        },
        {
            title: 'Xếp loại',
            key: 'result',
            align: 'center' as const,
            width: 130,
            render: (record: Topic) => (
                <div className="flex flex-col gap-2">
                    {record.students?.map((s: any) => {
                        const cls = s.finalScore?.grade_classification || '';
                        let color = 'default';
                        if (cls.startsWith('Xuất sắc')) color = 'gold';
                        else if (cls.startsWith('Giỏi')) color = 'green';
                        else if (cls.startsWith('Khá')) color = 'blue';
                        else if (cls.startsWith('Trung bình')) color = 'orange';
                        else if (cls.startsWith('Yếu') || cls.startsWith('Kém')) color = 'red';
                        
                        return (
                            <div key={s.id} className="h-7 flex items-center justify-center">
                                <Tag color={color} className="min-w-[90px] text-center m-0 text-[10px] font-bold px-1 py-0 leading-none h-5 flex items-center justify-center uppercase">
                                    {cls || '—'}
                                </Tag>
                            </div>
                        );
                    })}
                </div>
            ),
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

                        <GlobalSearch
                            placeholder="Tìm theo mã, tên đề tài, sinh viên..."
                            className="flex-1"
                            value={searchText}
                            onChange={setSearchText}
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
