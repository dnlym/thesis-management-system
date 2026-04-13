import { Spin } from 'antd';
import { useDashboardStats } from '@/hooks/useDashboard';
import Topics from '@/pages/Topics';
import Progress from '@/pages/Progress';

const StudentDashboard = () => {
    const { data: stats, isLoading } = useDashboardStats();

    if (isLoading) {
        return (
            <div className="flex justify-center items-center h-screen">
                <Spin size="large" />
            </div>
        );
    }

    // Logic: 
    // If student has a topic (registered and confirmed/approved), show Progress (My Topic Detail).
    // Otherwise, show Topics list for them to register.
    const hasTopic = stats?.hasTopic;

    if (hasTopic) {
        return <Progress />;
    }

    return <Topics />;
};

export default StudentDashboard;
