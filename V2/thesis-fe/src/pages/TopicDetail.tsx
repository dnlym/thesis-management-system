import { useAuthStore } from '@/store/auth';
import TopicDetailStudent from './TopicDetailStudent';
import TopicDetailSupervisor from './TopicDetailSupervisor';
import TopicDetailGeneral from './TopicDetailGeneral';

/**
 * Topic Detail Router Component
 * Routes to the correct view based on user role
 */
const TopicDetail = () => {
    const { user } = useAuthStore();

    // Route based on role
    if (user?.role === 'STUDENT') {
        return <TopicDetailStudent />;
    }

    if (user?.role === 'LECTURER') {
        return <TopicDetailSupervisor />;
    }

    // HEAD, ADMIN, and other roles use the general view
    return <TopicDetailGeneral />;
};

export default TopicDetail;
