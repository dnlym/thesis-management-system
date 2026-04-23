import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Table, Card, Tag, Input, Space, Typography, Button, Tooltip, Row, Col, Statistic, Radio, Divider } from 'antd';
import { SearchOutlined, EyeOutlined, CheckCircleOutlined, CloseCircleOutlined, TrophyOutlined, BarChartOutlined, FireOutlined, InteractionOutlined, UserOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { TopicsApi } from '@/api/topics';
import { Topic, User } from '@/types';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

const FinalResults = () => {
    const navigate = useNavigate();
    const [searchText, setSearchText] = useState('');
    const [councilFilter, setCouncilFilter] = useState<'ALL' | 'ORAL' | 'POSTER'>('ALL');

    // Fetch all finalized topics
    const { data: results, isLoading } = useQuery({
        queryKey: ['final-results'],
        queryFn: () => TopicsApi.getAll({ status: 'FINALIZED' }),
    });

    const processedData = useMemo(() => {
        if (!results?.topics) return [];

        let filtered = [...results.topics];

        // 1. Filter by Council Type
        if (councilFilter !== 'ALL') {
            filtered = filtered.filter(item => item.defense_type === councilFilter);
        }

        // 2. Filter by search text
        if (searchText) {
            const lowerSearch = searchText.toLowerCase();
            filtered = filtered.filter(item =>
                item.title?.toLowerCase().includes(lowerSearch) ||
                item.code?.toLowerCase().includes(lowerSearch) ||
                item.students?.some(s => s.full_name?.toLowerCase().includes(lowerSearch) || s.student_code?.toLowerCase().includes(lowerSearch))
            );
        }

        // 3. Sort by Final Score DESC (Top-down)
        return filtered.sort((a, b) => {
            const scoreA = a.students?.[0]?.finalScore?.final_score || 0;
            const scoreB = b.students?.[0]?.finalScore?.final_score || 0;
            return scoreB - scoreA;
        });
    }, [results, councilFilter, searchText]);

    const columns = [
        {
            title: 'Hạng',
            key: 'rank',
            width: 70,
            align: 'center' as const,
            render: (_: any, __: Topic, index: number) => {
                if (index === 0) return <TrophyOutlined className="text-yellow-500 text-xl" />;
                if (index === 1) return <div className="text-gray-400 font-bold text-lg">2</div>;
                if (index === 2) return <div className="text-orange-400 font-bold text-lg">3</div>;
                return <span className="text-gray-400">{index + 1}</span>;
            }
        },
        {
            title: 'Thông tin Đề tài',
            key: 'topic_info',
            render: (record: Topic) => (
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <Tag color="blue">{record.code}</Tag>
                        <Tag color={record.defense_type === 'ORAL' ? 'cyan' : 'purple'}>
                            {record.defense_type === 'ORAL' ? 'HỘI ĐỒNG ORAL' : 'HỘI ĐỒNG POSTER'}
                        </Tag>
                    </div>
                    <div className="font-bold text-gray-800 text-base">{record.title}</div>
                    <div className="text-xs text-gray-500 mt-1">Học kỳ: {record.semester?.name} | Khoa: {record.department?.name}</div>
                </div>
            ),
        },
        {
            title: 'Sinh viên thực hiện',
            dataIndex: 'students',
            key: 'students',
            width: 250,
            render: (students: any[]) => (
                <div className="space-y-1">
                    {students?.map(s => (
                        <div key={s.id} className="flex items-center gap-2">
                            <Avatar size="small" src={s.avatar_url} icon={<UserOutlined />} />
                            <div>
                                <Text strong className="block leading-none">{s.full_name}</Text>
                                <Text type="secondary" style={{ fontSize: 11 }}>{s.student_code}</Text>
                            </div>
                        </div>
                    ))}
                </div>
            ),
        },
        {
            title: 'GVHD',
            key: 'supervisor_score',
            align: 'center' as const,
            width: 100,
            render: (record: Topic) => (
                <Tooltip title="Điểm Giảng viên Hướng dẫn">
                    <div className="text-gray-600 font-medium">{record.students?.[0]?.finalScore?.supervisor_score?.toFixed(2) || '0.00'}</div>
                </Tooltip>
            ),
        },
        {
            title: 'GVPB (TB)',
            key: 'reviewer_avg_score',
            align: 'center' as const,
            width: 100,
            render: (record: Topic) => (
                <Tooltip title="Trung bình điểm Phản biện">
                    <div className="text-gray-600 font-medium">{record.students?.[0]?.finalScore?.reviewer_avg_score?.toFixed(2) || '0.00'}</div>
                </Tooltip>
            ),
        },
        {
            title: councilFilter === 'ORAL' ? 'HĐ Oral' : councilFilter === 'POSTER' ? 'HĐ Poster' : 'HĐ (TB)',
            key: 'committee_score',
            align: 'center' as const,
            width: 100,
            render: (record: Topic) => (
                <Tooltip title="Trung bình điểm Hội đồng">
                    <div className="text-gray-600 font-medium">{record.students?.[0]?.finalScore?.committee_score?.toFixed(2) || '0.00'}</div>
                </Tooltip>
            ),
        },
        {
            title: 'Cộng',
            key: 'extra_points',
            align: 'center' as const,
            width: 80,
            render: (record: Topic) => (
                <Tooltip title="Điểm cộng NCKH/Thành tích">
                    <Text type={record.students?.[0]?.finalScore?.extra_points > 0 ? 'warning' : 'secondary'} strong>
                        +{record.students?.[0]?.finalScore?.extra_points?.toFixed(2) || '0.00'}
                    </Text>
                </Tooltip>
            ),
        },
        {
            title: 'Tổng điểm',
            key: 'final_score',
            align: 'center' as const,
            width: 120,
            render: (record: Topic) => (
                <div className="bg-blue-50 py-2 rounded-lg border border-blue-100">
                    <Text strong className="text-xl text-blue-700">
                        {record.students?.[0]?.finalScore?.final_score?.toFixed(2) || '0.00'}
                    </Text>
                    <div className="text-[10px] text-blue-400 uppercase font-black">Final Grade</div>
                </div>
            ),
        },
        {
            title: 'Kết quả',
            key: 'result',
            align: 'center' as const,
            width: 140,
            render: (record: Topic) => {
                const cls = record.students?.[0]?.finalScore?.grade_classification;
                const isPass = (record.students?.[0]?.finalScore?.final_score || 0) >= 6.0;
                let color = 'default';
                if (cls === 'Xuất sắc') color = 'gold';
                if (cls === 'Giỏi') color = 'green';
                if (cls === 'Khá') color = 'blue';
                if (cls === 'Trung bình') color = 'orange';

                return (
                    <Space direction="vertical" size={2}>
                        <Tag color={color} style={{ margin: 0, width: '100%', textAlign: 'center' }}>{cls || 'N/A'}</Tag>
                        {isPass ? (
                            <Badge status="success" text={<Text type="success" strong style={{ fontSize: 11 }}>ĐẠT (PASSED)</Text>} />
                        ) : (
                            <Badge status="error" text={<Text type="danger" strong style={{ fontSize: 11 }}>HỎNG (FAILED)</Text>} />
                        )}
                    </Space>
                );
            },
        },
        {
            title: '',
            key: 'actions',
            width: 60,
            render: (record: Topic) => (
                <Button
                    type="primary"
                    shape="circle"
                    icon={<EyeOutlined />}
                    onClick={() => navigate(`/evaluation?topicId=${record.id}`)}
                />
            ),
        },
    ];

    const passCount = processedData.filter(r => (r.students?.[0]?.finalScore?.final_score || 0) >= 6.0).length;
    const totalCount = processedData.length;
    const passRate = totalCount > 0 ? (passCount / totalCount * 100).toFixed(1) : '0';

    return (
        <div className="p-6 bg-gray-50 min-h-screen">
            <div className="max-w-[1400px] mx-auto">
                <Row gutter={[24, 24]} className="mb-8 items-end">
                    <Col span={14}>
                        <div className="flex items-center gap-4 mb-2">
                            <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-200">
                                <TrophyOutlined className="text-white text-2xl" />
                            </div>
                            <div>
                                <Title level={2} style={{ margin: 0 }}>Bảng vàng Kết quả Khóa luận</Title>
                                <Text type="secondary">Xếp hạng kết quả học tập và bảo vệ đồ án của sinh viên</Text>
                            </div>
                        </div>
                    </Col>
                    <Col span={10}>
                        <div className="flex gap-4 justify-end">
                            <Card size="small" className="bg-white shadow-sm border-none min-w-[160px]">
                                <Statistic
                                    title="Tỷ lệ Đạt"
                                    value={passRate}
                                    suffix="%"
                                    prefix={<FireOutlined className="text-orange-500" />}
                                    valueStyle={{ color: '#3f8600', fontWeight: '900' }}
                                />
                            </Card>
                            <Card size="small" className="bg-white shadow-sm border-none min-w-[160px]">
                                <Statistic
                                    title="Hoàn thành"
                                    value={totalCount}
                                    prefix={<CheckCircleOutlined className="text-blue-500" />}
                                    valueStyle={{ color: '#096dd9', fontWeight: '900' }}
                                />
                            </Card>
                        </div>
                    </Col>
                </Row>

                <Card className="shadow-md border-none rounded-xl">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
                        <Radio.Group
                            value={councilFilter}
                            onChange={e => setCouncilFilter(e.target.value)}
                            buttonStyle="solid"
                            size="large"
                        >
                            <Radio.Button value="ALL">Tất cả hội đồng</Radio.Button>
                            <Radio.Button value="ORAL">Hội đồng Oral</Radio.Button>
                            <Radio.Button value="POSTER">Hội đồng Poster</Radio.Button>
                        </Radio.Group>

                        <div className="flex gap-3 w-full md:w-auto">
                            <Input
                                placeholder="Mã đề tài, tên, sinh viên..."
                                prefix={<SearchOutlined className="text-gray-400" />}
                                value={searchText}
                                onChange={e => setSearchText(e.target.value)}
                                style={{ width: 300 }}
                                size="large"
                                allowClear
                                className="rounded-lg"
                            />
                            <Button type="primary" size="large" icon={<BarChartOutlined />} className="rounded-lg">Xuất Báo cáo</Button>
                        </div>
                    </div>

                    <Table
                        dataSource={processedData}
                        columns={columns}
                        rowKey="id"
                        loading={isLoading}
                        pagination={{ pageSize: 10 }}
                        rowClassName={(record, index) => index < 3 ? 'bg-yellow-50/30' : ''}
                    />
                </Card>
            </div>
        </div>
    );
};

// Internal Components replacement for brevity
const Badge = ({ status, text }: any) => <div className="flex items-center gap-1"><div className={`w-2 h-2 rounded-full ${status === 'success' ? 'bg-green-500' : 'bg-red-500'}`} />{text}</div>;
const Avatar = ({ size, src, icon }: any) => <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden">{src ? <img src={src} className="w-full h-full object-cover" /> : icon}</div>;

export default FinalResults;
