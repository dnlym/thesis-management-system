import { Card, Row, Col, Statistic, Calendar, Badge, List, Tag } from 'antd';
import {
    TeamOutlined,
    CalendarOutlined,
    ClockCircleOutlined,
    TrophyOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import type { Dayjs } from 'dayjs';

import { Spin } from 'antd';
import { useDashboardStats } from '@/hooks/useDashboard';

const CommitteeDashboard = () => {
    const navigate = useNavigate();
    const { data: stats, isLoading } = useDashboardStats();

    if (isLoading) {
        return <div className="flex justify-center items-center h-screen"><Spin size="large" /></div>;
    }

    // Map API stats to component stats
    const displayStats = {
        upcoming: 0, // Need to add to backend
        completed: stats?.completedTheses || 0,
        today: 0, // Need to add to backend
        total: stats?.totalTopics || 0,
    };

    const upcomingDefenses = [
        {
            id: '1',
            topicTitle: 'Nghiên cứu ứng dụng AI trong giáo dục',
            student: 'Nguyễn Văn A',
            date: '2024-12-05',
            time: '09:00',
            location: 'Phòng hội đồng 1',
            role: 'Chủ tịch',
        },
        {
            id: '2',
            topicTitle: 'Hệ thống quản lý học tập thông minh',
            student: 'Trần Thị B',
            date: '2024-12-05',
            time: '14:00',
            location: 'Phòng hội đồng 2',
            role: 'Ủy viên',
        },
        {
            id: '3',
            topicTitle: 'Ứng dụng blockchain trong quản lý dữ liệu',
            student: 'Lê Văn C',
            date: '2024-12-10',
            time: '10:00',
            location: 'Phòng hội đồng 1',
            role: 'Thư ký',
        },
    ];

    const getListData = (value: Dayjs) => {
        // Mock calendar events
        const dateStr = value.format('YYYY-MM-DD');
        const events = upcomingDefenses.filter(d => d.date === dateStr);
        return events.map(e => ({
            type: 'success',
            content: `${e.time} - ${e.student}`,
        }));
    };

    const dateCellRender = (value: Dayjs) => {
        const listData = getListData(value);
        return (
            <ul className="events">
                {listData.map((item, index) => (
                    <li key={index}>
                        <Badge status={item.type as any} text={item.content} />
                    </li>
                ))}
            </ul>
        );
    };

    const getRoleColor = (role: string) => {
        switch (role) {
            case 'Chủ tịch':
                return 'purple';
            case 'Thư ký':
                return 'blue';
            default:
                return 'green';
        }
    };

    return (
        <div className="p-6 space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-foreground">Dashboard - Hội đồng</h1>
                <p className="text-muted-foreground">
                    Lịch bảo vệ và công việc hội đồng đánh giá
                </p>
            </div>

            {/* Statistics Cards */}
            <Row gutter={16}>
                <Col xs={24} sm={12} lg={6}>
                    <Card className="shadow-soft">
                        <Statistic
                            title="Sắp diễn ra"
                            value={displayStats.upcoming}
                            prefix={<ClockCircleOutlined className="text-orange-500" />}
                            valueStyle={{ color: '#f59e0b' }}
                        />
                    </Card>
                </Col>
                <Col xs={24} sm={12} lg={6}>
                    <Card className="shadow-soft">
                        <Statistic
                            title="Hôm nay"
                            value={displayStats.today}
                            prefix={<CalendarOutlined className="text-red-500" />}
                            valueStyle={{ color: '#ef4444' }}
                        />
                    </Card>
                </Col>
                <Col xs={24} sm={12} lg={6}>
                    <Card className="shadow-soft">
                        <Statistic
                            title="Đã hoàn thành"
                            value={displayStats.completed}
                            prefix={<TrophyOutlined className="text-green-500" />}
                            valueStyle={{ color: '#10b981' }}
                        />
                    </Card>
                </Col>
                <Col xs={24} sm={12} lg={6}>
                    <Card className="shadow-soft">
                        <Statistic
                            title="Tổng cộng"
                            value={displayStats.total}
                            prefix={<TeamOutlined className="text-blue-500" />}
                            valueStyle={{ color: '#3b82f6' }}
                        />
                    </Card>
                </Col>
            </Row>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Calendar */}
                <Card title="Lịch bảo vệ" className="shadow-soft">
                    <Calendar
                        fullscreen={false}
                        dateCellRender={dateCellRender}
                    />
                </Card>

                {/* Upcoming Defenses */}
                <Card title="Buổi bảo vệ sắp tới" className="shadow-soft">
                    <List
                        dataSource={upcomingDefenses}
                        renderItem={(item) => (
                            <List.Item
                                extra={
                                    <Tag color={getRoleColor(item.role)}>{item.role}</Tag>
                                }
                            >
                                <List.Item.Meta
                                    title={
                                        <div>
                                            <div className="font-semibold">{item.topicTitle}</div>
                                            <div className="text-sm text-gray-600">
                                                SV: {item.student}
                                            </div>
                                        </div>
                                    }
                                    description={
                                        <div className="space-y-1 text-sm">
                                            <div>
                                                <CalendarOutlined className="mr-2" />
                                                {new Date(item.date).toLocaleDateString('vi-VN')} - {item.time}
                                            </div>
                                            <div>
                                                <TeamOutlined className="mr-2" />
                                                {item.location}
                                            </div>
                                        </div>
                                    }
                                />
                            </List.Item>
                        )}
                    />
                </Card>
            </div>

            {/* Info Card */}
            <Card className="bg-purple-50 border-purple-200">
                <div className="space-y-2">
                    <h3 className="font-semibold text-purple-900">Nhiệm vụ của Hội đồng</h3>
                    <ul className="text-sm text-purple-800 space-y-1 list-disc list-inside">
                        <li>Tham dự buổi bảo vệ đúng giờ và địa điểm được phân công</li>
                        <li>Lắng nghe sinh viên thuyết trình và đặt câu hỏi</li>
                        <li>Đánh giá kỹ năng thuyết trình, khả năng trả lời câu hỏi</li>
                        <li>Chấm điểm theo tiêu chí hội đồng (20% tổng điểm)</li>
                        <li>Tham gia thảo luận và đưa ra nhận xét cuối cùng</li>
                    </ul>
                </div>
            </Card>
        </div>
    );
};

export default CommitteeDashboard;
