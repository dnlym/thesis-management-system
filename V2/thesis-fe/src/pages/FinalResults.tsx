import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Table, Card, Tag, Input, Typography, Button, Radio, Avatar, Dropdown, Tabs } from 'antd';
import { SearchOutlined, UserOutlined, FileTextOutlined, DownOutlined, FileExcelOutlined, FileOutlined } from '@ant-design/icons';
import { TopicsApi } from '@/api/topics';
import { Topic } from '@/types';
import GlobalSearch from '@/components/GlobalSearch';
import HighlightText from '@/components/HighlightText';
import { matchKeyword } from '@/utils/search';
import { useDebounce } from '@/hooks/useDebounce';

const { Title, Text } = Typography;

/** Hiển thị điểm: null/undefined → '—', 0 → '0.0', n → 'n.x' */
const formatScore = (val: number | null | undefined): string => {
    if (val === null || val === undefined) return '—';
    return val.toFixed(1);
};

// ── Helpers xuất file ────────────────────────────────────────────────
// ── Helpers xuất file chuyên nghiệp ─────────────────────────────────────
const getExportData = (data: Topic[]) => {
    const rows: any[] = [];
    let stt = 1;

    data.forEach((topic) => {
        topic.students?.forEach((student: any, index: number) => {
            const final = student.finalScore;
            const isFailedGK = student.midtermStatus === 'FAIL' || student.registrationStatus === 'FAILED' || student.midterm_status === 'FAIL' || student.status === 'FAILED';
            const hasScore = final?.final_score !== undefined && final?.final_score !== null;
            rows.push({
                'STT': index === 0 ? stt : '', // Chỉ hiện STT ở dòng đầu của nhóm
                'Mã nhóm': index === 0 ? (topic.groupName || topic.code) : '',
                'Tên đề tài': index === 0 ? topic.title : '',
                'MSSV': student.student_code || '',
                'Họ tên sinh viên': student.full_name || '',
                'Điểm HD': isFailedGK ? '0.0' : formatScore(final?.supervisor_score),
                'Điểm PB': isFailedGK ? '0.0' : formatScore(final?.reviewer_avg_score),
                'Điểm HĐ': isFailedGK ? '0.0' : formatScore(final?.committee_score),
                'Điểm cộng': isFailedGK ? '0.0' : formatScore(final?.extra_points),
                'Tổng điểm': isFailedGK ? '0.0' : formatScore(final?.final_score),
                'Trạng thái': isFailedGK ? 'KHÔNG ĐẠT' : hasScore ? (final.final_score! >= 6 ? 'ĐẠT' : 'KHÔNG ĐẠT') : '—',
                'Xếp loại': isFailedGK ? 'RỚT (GIỮA KỲ)' : hasScore ? final.grade_classification || '—' : '—',
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
        queryFn: () => TopicsApi.getAll({ status: ['REGISTERED', 'COMPLETED', 'FINALIZED'] }),
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
            render: (_: any, __: any, index: number) => <span className="font-bold text-slate-400">{index + 1}</span>,
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
                    {record.students?.map((s: any) => {
                        const isFailedGK = s.midtermStatus === 'FAIL' || s.registrationStatus === 'FAILED' || s.midterm_status === 'FAIL' || s.status === 'FAILED';
                        return (
                            <div key={s.id} className="h-7 flex items-center justify-center text-slate-600 text-xs font-medium">
                                {isFailedGK ? '0.0' : formatScore(s.finalScore?.supervisor_score)}
                            </div>
                        );
                    })}
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
                    {record.students?.map((s: any) => {
                        const isFailedGK = s.midtermStatus === 'FAIL' || s.registrationStatus === 'FAILED' || s.midterm_status === 'FAIL' || s.status === 'FAILED';
                        return (
                            <div key={s.id} className="h-7 flex items-center justify-center text-slate-600 text-xs font-medium">
                                {isFailedGK ? '0.0' : formatScore(s.finalScore?.reviewer_avg_score)}
                            </div>
                        );
                    })}
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
                    {record.students?.map((s: any) => {
                        const isFailedGK = s.midtermStatus === 'FAIL' || s.registrationStatus === 'FAILED' || s.midterm_status === 'FAIL' || s.status === 'FAILED';
                        return (
                            <div key={s.id} className="h-7 flex items-center justify-center text-slate-600 text-xs font-medium">
                                {isFailedGK ? '0.0' : formatScore(s.finalScore?.committee_score)}
                            </div>
                        );
                    })}
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
                    {record.students?.map((s: any) => {
                        const isFailedGK = s.midtermStatus === 'FAIL' || s.registrationStatus === 'FAILED' || s.midterm_status === 'FAIL' || s.status === 'FAILED';
                        return (
                            <div key={s.id} className="h-7 flex items-center justify-center text-amber-600 text-xs font-bold">
                                {isFailedGK ? '—' : (s.finalScore?.extra_points !== null && s.finalScore?.extra_points !== undefined && s.finalScore.extra_points > 0) ? `+${s.finalScore.extra_points.toFixed(1)}` : '—'}
                            </div>
                        );
                    })}
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
                    {record.students?.map((s: any) => {
                        const isFailedGK = s.midtermStatus === 'FAIL' || s.registrationStatus === 'FAILED' || s.midterm_status === 'FAIL' || s.status === 'FAILED';
                        return (
                            <div key={s.id} className={`h-7 flex items-center justify-center font-black text-sm ${isFailedGK ? 'text-red-500' : 'text-blue-600'}`}>
                                {isFailedGK ? '0.0' : formatScore(s.finalScore?.final_score)}
                            </div>
                        );
                    })}
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
                        const isFailedGK = s.midtermStatus === 'FAIL' || s.registrationStatus === 'FAILED' || s.midterm_status === 'FAIL' || s.status === 'FAILED';
                        const hasScore = s.finalScore?.final_score !== undefined && s.finalScore?.final_score !== null;
                        const score = s.finalScore?.final_score || 0;
                        const isPass = !isFailedGK && score >= 6.0;
                        return (
                            <div key={s.id} className="h-7 flex items-center justify-center">
                                {isFailedGK ? (
                                    <Tag color="error" className="m-0 font-bold px-2 text-[10px] py-0 leading-none h-5 flex items-center">
                                        KHÔNG ĐẠT
                                    </Tag>
                                ) : hasScore ? (
                                    <Tag color={isPass ? 'success' : 'error'} className="m-0 font-bold px-2 text-[10px] py-0 leading-none h-5 flex items-center">
                                        {isPass ? 'ĐẠT' : 'KHÔNG ĐẠT'}
                                    </Tag>
                                ) : (
                                    <span className="text-slate-400 font-bold">—</span>
                                )}
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
                        const isFailedGK = s.midtermStatus === 'FAIL' || s.registrationStatus === 'FAILED' || s.midterm_status === 'FAIL' || s.status === 'FAILED';
                        const hasScore = s.finalScore?.final_score !== undefined && s.finalScore?.final_score !== null;
                        const cls = isFailedGK ? 'RỚT (GIỮA KỲ)' : s.finalScore?.grade_classification || '';
                        let color = 'default';
                        if (isFailedGK) color = 'red';
                        else if (cls.startsWith('Xuất sắc')) color = 'gold';
                        else if (cls.startsWith('Giỏi')) color = 'green';
                        else if (cls.startsWith('Khá')) color = 'blue';
                        else if (cls.startsWith('Trung bình')) color = 'orange';
                        else if (cls.startsWith('Yếu') || cls.startsWith('Kém')) color = 'red';

                        return (
                            <div key={s.id} className="h-7 flex items-center justify-center">
                                {isFailedGK || hasScore ? (
                                    <Tag color={color} className="min-w-[90px] text-center m-0 text-[10px] font-bold px-1 py-0 leading-none h-5 flex items-center justify-center uppercase">
                                        {cls || '—'}
                                    </Tag>
                                ) : (
                                    <span className="text-slate-400 font-bold">—</span>
                                )}
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
                <Card className="page-toolbar-card !mb-4">
                    <div className="flex flex-col md:flex-row items-center justify-between gap-4 w-full">
                        <Tabs
                            activeKey={councilFilter}
                            onChange={(key) => setCouncilFilter(key as any)}
                            className="sys-tabs sys-tabs-capsule !mb-0 w-full md:w-auto"
                            items={[
                                { key: 'ALL', label: 'Tất cả hội đồng' },
                                { key: 'ORAL', label: 'Hội đồng Oral' },
                                { key: 'POSTER', label: 'Hội đồng Poster' },
                            ]}
                        />

                        <GlobalSearch
                            placeholder="Tìm kiếm mã, tên đề tài, sinh viên..."
                            className="w-full md:max-w-md flex-1"
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
