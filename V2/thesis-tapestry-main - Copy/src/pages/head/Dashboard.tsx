import { Card, Row, Col, Statistic, Progress, Table, Tag } from 'antd';
import {
    FileTextOutlined,
    TeamOutlined,
    TrophyOutlined,
    ClockCircleOutlined,
    CheckCircleOutlined,
    RiseOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell,
} from 'recharts';

import { Spin } from 'antd';
import { useDashboardStats } from '@/hooks/useDashboard';

const HeadDashboard = () => {
    const navigate = useNavigate();
    const { data: stats, isLoading } = useDashboardStats();

    if (isLoading) {
        return <div className="flex justify-center items-center h-screen"><Spin size="large" /></div>;
    }

    // Map API stats to component stats
    const displayStats = {
        totalTopics: stats?.totalTopics || 0,
        pendingApproval: stats?.pendingApprovalTopics || 0,
        totalStudents: stats?.totalStudents || 0,
        completedTheses: stats?.completedTheses || 0,
        avgScore: 0, // Not yet implemented in backend
        progressRate: 0, // Not yet implemented in backend
    };

    // Chart data
    const topicsByStatus = [
        { name: 'Chờ duyệt', value: 8, color: '#f59e0b' },
        { name: 'Đang thực hiện', value: 25, color: '#3b82f6' },
        { name: 'Hoàn thành', value: 12, color: '#10b981' },
    ];

    const gradeDistribution = [
        { range: '9.0-10', count: 3 },
        { range: '8.0-8.9', count: 15 },
        { range: '7.0-7.9', count: 18 },
        { range: '6.0-6.9', count: 8 },
        { range: '< 6.0', count: 1 },
    ];

    const pendingActions = [
        {
            id: '1',
            type: 'Duyệt đề tài',
            count: 8,
            priority: 'high',
            link: '/head/approve-topics',
        },
        {
            id: '2',
            type: 'Phân công phản biện',
            count: 5,
            priority: 'high',
            link: '/head/assign-reviewers',
        },
        {
            id: '3',
            type: 'Duyệt điểm cộng',
            count: 3,
            priority: 'medium',
            link: '/head/extra-points',
        },
        {
            id: '4',
            type: 'Hoàn tất điểm',
            count: 2,
            priority: 'medium',
            link: '/head/finalize-grades',
        },
    ];

    const columns = [
        {
            title: 'Công việc',
            dataIndex: 'type',
            key: 'type',
        },
        {
            title: 'Số lượng',
            dataIndex: 'count',
            key: 'count',
            render: (count: number) => (
                <Tag color="blue" className="font-semibold">{count}</Tag>
            ),
        },
        {
            title: 'Mức độ',
            dataIndex: 'priority',
            key: 'priority',
            render: (priority: string) => (
                <Tag color={priority === 'high' ? 'red' : 'orange'}>
                    {priority === 'high' ? 'Cao' : 'Trung bình'}
                </Tag>
            ),
        },
        {
            title: 'Thao tác',
            key: 'action',
            render: (_: any, record: any) => (
                <a onClick={() => navigate(record.link)}>Xử lý ngay →</a>
            ),
        },
    ];

    return (
        <div className="p-6 space-y-6">
            <div>
                <h1 className="text-3xl font-bold text-foreground">Dashboard - Trưởng Bộ môn</h1>
                <p className="text-muted-foreground">
                    Tổng quan quản lý khóa luận tốt nghiệp
                </p>
            </div>

            {/* Key Statistics */}
            <Row gutter={16}>
                <Col xs={24} sm={12} lg={8}>
                    <Card className="shadow-soft">
                        <Statistic
                            title="Tổng đề tài"
                            value={displayStats.totalTopics}
                            prefix={<FileTextOutlined className="text-blue-500" />}
                            suffix={
                                <span className="text-sm text-gray-500">
                                    / {displayStats.totalStudents} SV
                                </span>
                            }
                        />
                        <Progress
                            percent={displayStats.progressRate}
                            size="small"
                            className="mt-2"
                            status="active"
                        />
                    </Card>
                </Col>
                <Col xs={24} sm={12} lg={8}>
                    <Card className="shadow-soft">
                        <Statistic
                            title="Chờ phê duyệt"
                            value={displayStats.pendingApproval}
                            prefix={<ClockCircleOutlined className="text-orange-500" />}
                            valueStyle={{ color: '#f59e0b' }}
                        />
                        <div className="mt-2">
                            <a onClick={() => navigate('/head/approve-topics')}>
                                Xử lý ngay →
                            </a>
                        </div>
                    </Card>
                </Col>
                <Col xs={24} sm={12} lg={8}>
                    <Card className="shadow-soft">
                        <Statistic
                            title="Điểm TB"
                            value={displayStats.avgScore}
                            precision={2}
                            prefix={<TrophyOutlined className="text-green-500" />}
                            suffix="/ 10"
                            valueStyle={{ color: '#10b981' }}
                        />
                        <div className="mt-2 flex items-center text-sm text-green-600">
                            <RiseOutlined className="mr-1" />
                            <span>+0.3 so với kỳ trước</span>
                        </div>
                    </Card>
                </Col>
            </Row>

            {/* Charts */}
            <Row gutter={16}>
                <Col xs={24} lg={12}>
                    <Card title="Phân bổ đề tài theo trạng thái" className="shadow-soft">
                        <ResponsiveContainer width="100%" height={300}>
                            <PieChart>
                                <Pie
                                    data={topicsByStatus}
                                    cx="50%"
                                    cy="50%"
                                    labelLine={false}
                                    label={({ name, value }) => `${name}: ${value}`}
                                    outerRadius={100}
                                    fill="#8884d8"
                                    dataKey="value"
                                >
                                    {topicsByStatus.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                    ))}
                                </Pie>
                                <Tooltip />
                            </PieChart>
                        </ResponsiveContainer>
                    </Card>
                </Col>

                <Col xs={24} lg={12}>
                    <Card title="Phân bố điểm số" className="shadow-soft">
                        <ResponsiveContainer width="100%" height={300}>
                            <BarChart data={gradeDistribution}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="range" />
                                <YAxis />
                                <Tooltip />
                                <Legend />
                                <Bar dataKey="count" fill="#3b82f6" name="Số sinh viên" />
                            </BarChart>
                        </ResponsiveContainer>
                    </Card>
                </Col>
            </Row>

            {/* Pending Actions */}
            <Card
                title={
                    <div className="flex items-center">
                        <CheckCircleOutlined className="mr-2 text-orange-500" />
                        <span>Công việc cần xử lý</span>
                    </div>
                }
                className="shadow-soft"
            >
                <Table
                    columns={columns}
                    dataSource={pendingActions}
                    rowKey="id"
                    pagination={false}
                />
            </Card>

            {/* Quick Actions */}
            <Card title="Truy cập nhanh" className="shadow-soft">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <button
                        onClick={() => navigate('/head/approve-topics')}
                        className="p-6 border rounded-lg hover:bg-gray-50 transition-colors text-center"
                    >
                        <FileTextOutlined className="text-3xl text-blue-500 mb-2" />
                        <div className="font-medium">Duyệt đề tài</div>
                    </button>
                    <button
                        onClick={() => navigate('/head/assign-reviewers')}
                        className="p-6 border rounded-lg hover:bg-gray-50 transition-colors text-center"
                    >
                        <TeamOutlined className="text-3xl text-green-500 mb-2" />
                        <div className="font-medium">Phân công</div>
                    </button>
                    <button
                        onClick={() => navigate('/head/extra-points')}
                        className="p-6 border rounded-lg hover:bg-gray-50 transition-colors text-center"
                    >
                        <RiseOutlined className="text-3xl text-purple-500 mb-2" />
                        <div className="font-medium">Điểm cộng</div>
                    </button>
                    <button
                        onClick={() => navigate('/head/finalize-grades')}
                        className="p-6 border rounded-lg hover:bg-gray-50 transition-colors text-center"
                    >
                        <TrophyOutlined className="text-3xl text-orange-500 mb-2" />
                        <div className="font-medium">Hoàn tất điểm</div>
                    </button>
                </div>
            </Card>
        </div>
    );
};

export default HeadDashboard;
