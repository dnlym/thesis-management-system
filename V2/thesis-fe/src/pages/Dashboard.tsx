import { Card, Row, Col, Statistic, Timeline, Calendar, Badge, Spin } from 'antd';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/store/auth';
import { BookOutlined, ClockCircleOutlined, CheckCircleOutlined, TrophyOutlined } from '@ant-design/icons';
import { useDashboardStats } from '@/hooks/useDashboard';
const Dashboard = () => {
    const { t } = useTranslation();
    const { user } = useAuthStore();
    const { data: stats, isLoading } = useDashboardStats();

    if (isLoading) {
        return <div className="flex justify-center items-center h-screen"><Spin size="large" /></div>;
    }

    // Determine stats based on role
    const displayStats = {
        totalTopics: stats?.totalTopics || stats?.supervisedTopicsCount || 0,
        inProgress: stats?.pendingApprovalTopics || 0,
        completed: stats?.completedTheses || 0, // Need to add this to backend if needed
        defended: 0 // Need to add to backend
    };

    // Mock activities/schedule for now until we have real API for them
    const mockActivities = [
        { time: '2024-01-15', content: t('dashboard.systemUpdated'), color: 'green' },
    ];

    const mockSchedule = [
        { time: '09:00', title: t('dashboard.noSchedule') },
    ];

    return (
        <div className="p-6 space-y-6">
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-foreground mb-2">
                    {t('dashboard.welcome')}
                </h1>
                <p className="text-muted-foreground">
                    {t('dashboard.greeting', { name: user?.full_name })} ({t(`roles.${user?.role}`)})
                </p>
            </div>

            {/* Statistics Cards */}
            <Row gutter={[16, 16]}>
                <Col xs={24} sm={12} lg={6}>
                    <Card className="shadow-soft border-academic-primary-light">
                        <Statistic
                            title={t('dashboard.totalTopics')}
                            value={displayStats.totalTopics}
                            prefix={<BookOutlined className="text-academic-primary" />}
                            valueStyle={{ color: 'hsl(var(--academic-primary))' }}
                        />
                    </Card>
                </Col>
                <Col xs={24} sm={12} lg={6}>
                    <Card className="shadow-soft border-status-in-progress/20">
                        <Statistic
                            title={t('dashboard.inProgress')}
                            value={displayStats.inProgress}
                            prefix={<ClockCircleOutlined className="text-status-in-progress" />}
                            valueStyle={{ color: 'hsl(var(--status-in-progress))' }}
                        />
                    </Card>
                </Col>
                {/* ... Other cards can be conditional or generic */}
            </Row>

            <Row gutter={[16, 16]}>
                {/* Recent Activity */}
                <Col xs={24} lg={12}>
                    <Card
                        title={t('dashboard.recentActivity')}
                        className="h-96 shadow-soft"
                    >
                        <Timeline
                            items={mockActivities.map(activity => ({
                                color: activity.color,
                                children: (
                                    <div>
                                        <div className="text-sm text-muted-foreground">{activity.time}</div>
                                        <div className="text-foreground">{activity.content}</div>
                                    </div>
                                ),
                            }))}
                        />
                    </Card>
                </Col>

                {/* Today's Schedule */}
                <Col xs={24} lg={12}>
                    <Card
                        title={t('dashboard.todaySchedule')}
                        className="h-96 shadow-soft"
                    >
                        <div className="space-y-4">
                            {mockSchedule.map((item, index) => (
                                <div key={index} className="flex items-center space-x-3 p-3 rounded-lg bg-academic-primary-light">
                                    <Badge status="processing" />
                                    <div className="flex-1">
                                        <div className="font-medium text-foreground">{item.title}</div>
                                        <div className="text-sm text-muted-foreground">{item.time}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </Card>
                </Col>
            </Row>
        </div>
    );
};

export default Dashboard;
