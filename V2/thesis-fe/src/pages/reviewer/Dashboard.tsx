import { Card, Row, Col, Statistic, Table, Button, Badge } from 'antd';
import {
    CheckCircleOutlined,
    ClockCircleOutlined,
    FileTextOutlined,
    TrophyOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { AssignmentStatusBadge } from '@/components/StatusBadge';
import { useAuthStore } from '@/store/auth';

import { Spin } from 'antd';
import { useDashboardStats } from '@/hooks/useDashboard';

const ReviewerDashboard = () => {
    const navigate = useNavigate();
    const { user } = useAuthStore();
    const { data: stats, isLoading } = useDashboardStats();

    if (isLoading) {
        return <div className="flex justify-center items-center h-screen"><Spin size="large" /></div>;
    }

    // Map API stats to component stats
    const displayStats = {
        pending: stats?.reviewAssignmentsCount || 0,
        accepted: 0, // Need to add to backend
        graded: 0, // Need to add to backend
        total: stats?.reviewAssignmentsCount || 0, // Approximate
    };

    const recentAssignments: any[] = []; // Placeholder

    const columns = [
        {
            title: 'Đề tài',
            dataIndex: 'topicTitle',
            key: 'topicTitle',
            render: (text: string) => (
                <span className="font-medium">{text}</span>
            ),
        },
        {
            title: 'Trạng thái',
            dataIndex: 'status',
            key: 'status',
            render: (status: any) => <AssignmentStatusBadge status={status} />,
        },
        {
            title: 'Ngày phân công',
            dataIndex: 'assignedAt',
            key: 'assignedAt',
            render: (date: string) => new Date(date).toLocaleDateString('vi-VN'),
        },
        {
            title: 'Deadline',
            dataIndex: 'deadline',
            key: 'deadline',
            render: (date: string) => new Date(date).toLocaleDateString('vi-VN'),
        },
        {
            title: 'Thao tác',
            key: 'actions',
            render: (_: any, record: any) => (
                <Button
                    type="link"
                    onClick={() => navigate('/reviewer/assignments')}
                >
                    Xem chi tiết
                </Button>
            ),
        },
    ];

    return (
        <div className="p-6 space-y-6">
            <div>
                <h1 className="text-3xl font-bold text-foreground">Dashboard - Phản biện</h1>
                <p className="text-muted-foreground">
                    Tổng quan công việc phản biện và chấm điểm
                </p>
            </div>

            {/* Statistics Cards */}
            <Row gutter={16}>
                <Col xs={24} sm={12} lg={6}>
                    <Card className="shadow-soft">
                        <Statistic
                            title="Chờ phản hồi"
                            value={displayStats.pending}
                            prefix={<ClockCircleOutlined className="text-orange-500" />}
                            valueStyle={{ color: '#f59e0b' }}
                        />
                    </Card>
                </Col>
                <Col xs={24} sm={12} lg={6}>
                    <Card className="shadow-soft">
                        <Statistic
                            title="Đã chấp nhận"
                            value={displayStats.accepted}
                            prefix={<CheckCircleOutlined className="text-green-500" />}
                            valueStyle={{ color: '#10b981' }}
                        />
                    </Card>
                </Col>
                <Col xs={24} sm={12} lg={6}>
                    <Card className="shadow-soft">
                        <Statistic
                            title="Đã chấm điểm"
                            value={displayStats.graded}
                            prefix={<TrophyOutlined className="text-purple-500" />}
                            valueStyle={{ color: '#8b5cf6' }}
                        />
                    </Card>
                </Col>
                <Col xs={24} sm={12} lg={6}>
                    <Card className="shadow-soft">
                        <Statistic
                            title="Tổng phân công"
                            value={displayStats.total}
                            prefix={<FileTextOutlined className="text-blue-500" />}
                            valueStyle={{ color: '#3b82f6' }}
                        />
                    </Card>
                </Col>
            </Row>

            {/* Quick Actions */}
            <Card title="Hành động nhanh" className="shadow-soft">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Button
                        type="primary"
                        size="large"
                        block
                        onClick={() => navigate('/reviewer/assignments')}
                    >
                        Xem tất cả phân công
                    </Button>
                    <Button
                        size="large"
                        block
                        onClick={() => navigate('/evaluation')}
                    >
                        Chấm điểm
                    </Button>
                    <Button
                        size="large"
                        block
                        onClick={() => navigate('/topics')}
                    >
                        Xem đề tài
                    </Button>
                </div>
            </Card>

            {/* Recent Assignments */}
            <Card
                title={
                    <div className="flex items-center justify-between">
                        <span>Phân công gần đây</span>
                        <Badge count={displayStats.pending} showZero={false}>
                            <Button
                                type="link"
                                onClick={() => navigate('/reviewer/assignments')}
                            >
                                Xem tất cả
                            </Button>
                        </Badge>
                    </div>
                }
                className="shadow-soft"
            >
                <Table
                    columns={columns}
                    dataSource={recentAssignments}
                    rowKey="id"
                    pagination={false}
                />
            </Card>

            {/* Info Card */}
            <Card className="bg-blue-50 border-blue-200">
                <div className="space-y-2">
                    <h3 className="font-semibold text-blue-900">Nhiệm vụ của Giảng viên phản biện</h3>
                    <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
                        <li>Xem xét và phản hồi các phân công phản biện (chấp nhận/từ chối)</li>
                        <li>Đọc tài liệu và đánh giá chất lượng đề tài</li>
                        <li>Chấm điểm theo các tiêu chí được phân công (40% tổng điểm)</li>
                        <li>Cung cấp nhận xét và góp ý xây dựng cho sinh viên</li>
                    </ul>
                </div>
            </Card>
        </div>
    );
};

export default ReviewerDashboard;
