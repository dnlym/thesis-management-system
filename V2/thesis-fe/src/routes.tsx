import {
  DashboardOutlined,
  BookOutlined,
  UploadOutlined,
  CheckCircleOutlined,
  CalendarOutlined,
  BarChartOutlined,
  SettingOutlined,
  UserOutlined,
  TeamOutlined,
  SafetyCertificateOutlined,
  CrownOutlined,
  AuditOutlined,
  HistoryOutlined,
} from '@ant-design/icons';
import type { UserRole } from '@/types';

// Lazy load components
import { lazy } from 'react';

const Dashboard = lazy(() => import('@/pages/Dashboard'));
const Topics = lazy(() => import('@/pages/Topics'));
const TopicDetail = lazy(() => import('@/pages/TopicDetail'));
const EditTopic = lazy(() => import('@/pages/EditTopic'));

const Evaluation = lazy(() => import('@/pages/Evaluation'));
const MidtermEvaluation = lazy(() => import('@/pages/MidtermEvaluation'));
const FinalEvaluation = lazy(() => import('@/pages/FinalEvaluation'));
const Schedule = lazy(() => import('@/pages/Schedule'));
const FinalResults = lazy(() => import('@/pages/FinalResults'));
const AdminUsers = lazy(() => import('@/pages/admin/Users'));
const AdminRoles = lazy(() => import('@/pages/admin/Roles'));
const AdminCriteria = lazy(() => import('@/pages/admin/Criteria'));
const AdminSettings = lazy(() => import('@/pages/admin/Settings'));
const AdminAuditLog = lazy(() => import('@/pages/admin/AuditLog'));
const Login = lazy(() => import('@/pages/auth/Login'));
const Profiles = lazy(() => import('@/pages/Profiles'));


const MyRegisteredTopic = lazy(() => import('@/pages/MyRegisteredTopic'));
const SupervisorCreateTopic = lazy(() => import('@/pages/supervisor/CreateTopic'));
const ManageRegistrations = lazy(() => import('@/pages/supervisor/ManageRegistrations'));

const ApproveTopics = lazy(() => import('@/pages/head/ApproveTopics'));
const ReviewerAssignment = lazy(() => import('@/pages/ReviewerAssignment'));
const ExtraPointRequests = lazy(() => import('@/pages/head/ExtraPointRequests'));
const CommitteeAssignment = lazy(() => import('@/pages/CommitteeAssignment'));
const ExtraPointsSubmission = lazy(() => import('@/pages/ExtraPointsSubmission'));
const CommitteeManagement = lazy(() => import('@/pages/head/CommitteeManagement'));
const CommitteeSchedules = lazy(() => import('@/pages/head/CommitteeSchedules'));
const SemesterSettings = lazy(() => import('@/pages/head/SemesterSettings'));
const GradeSummary = lazy(() => import('@/pages/head/GradeSummary'));
const GradeChangeApprovals = lazy(() => import('@/pages/head/GradeChangeApprovals'));
// ------------------------------

export interface RouteConfig {
  path: string;
  element: React.ComponentType;
  meta: {
    title: string;
    icon?: React.ComponentType;
    roles: UserRole[];
    hideInMenu?: boolean;
    parentPath?: string;
  };
}

export const routes: RouteConfig[] = [
  {
    path: '/dashboard',
    element: Dashboard,
    meta: {
      title: 'navigation.dashboard',
      icon: DashboardOutlined,
      roles: ['STUDENT', 'LECTURER', 'HEAD', 'ADMIN'],
    },
  },



  // Extra points submission for students
  {
    path: '/extra-points',
    element: ExtraPointsSubmission,
    meta: {
      title: 'navigation.extraPoints',
      icon: SafetyCertificateOutlined,
      roles: ['STUDENT'],
    },
  },

  {
    path: '/my-topic',
    element: MyRegisteredTopic,
    meta: {
      title: 'navigation.myTopic',
      icon: BookOutlined,
      roles: ['STUDENT'],
      hideInMenu: true,
    },
  },

  {
    path: '/topics',
    element: Topics,
    meta: {
      title: 'navigation.topics',
      icon: BookOutlined,
      roles: ['STUDENT', 'LECTURER', 'HEAD', 'ADMIN'],
    },
  },
  {
    path: '/supervisor/create-topic',
    element: SupervisorCreateTopic,
    meta: {
      title: 'navigation.createTopic',
      icon: BookOutlined,
      roles: ['LECTURER', 'HEAD', 'ADMIN'],
      hideInMenu: true,
    },
  },
  {
    path: '/supervisor/registrations',
    element: ManageRegistrations,
    meta: {
      title: 'navigation.registrations',
      icon: TeamOutlined,
      roles: ['LECTURER'],
      hideInMenu: true,
    },
  },

  {
    path: '/topics/:id',
    element: TopicDetail,
    meta: {
      title: 'topics.title',
      roles: ['STUDENT', 'LECTURER', 'HEAD', 'ADMIN'],
      hideInMenu: true,
      parentPath: '/topics',
    },
  },
  {
    path: '/topics/:id/edit',
    element: EditTopic,
    meta: {
      title: 'topics.editTopic',
      roles: ['LECTURER', 'HEAD', 'ADMIN'],
      hideInMenu: true,
      parentPath: '/topics',
    },
  },
  {
    path: '/head/approve-topics',
    element: ApproveTopics,
    meta: {
      title: 'navigation.approveTopics',
      icon: CheckCircleOutlined,
      roles: ['HEAD', 'ADMIN'],
    },
  },
  // ... (các routes khác giữ nguyên)

  {
    path: '/midterm-evaluation',
    element: MidtermEvaluation,
    meta: {
      title: 'navigation.midtermEvaluation',
      icon: CheckCircleOutlined,
      roles: ['LECTURER'],
    },
  },
  {
    path: '/evaluation',
    element: Evaluation,
    meta: {
      title: 'navigation.finalEvaluation',
      icon: CheckCircleOutlined,
      roles: ['LECTURER', 'HEAD', 'ADMIN'],
    },
  },
  {
    path: '/final-evaluation',
    element: FinalEvaluation,
    meta: {
      title: 'navigation.loEvaluation',
      icon: CheckCircleOutlined,
      roles: ['LECTURER', 'HEAD', 'ADMIN'],
      hideInMenu: true,
    },
  },
  {
    path: '/schedule',
    element: Schedule,
    meta: {
      title: 'navigation.schedule',
      icon: CalendarOutlined,
      roles: ['STUDENT', 'LECTURER', 'HEAD', 'ADMIN'],
    },
  },
  {
    path: '/final-results',
    element: FinalResults,
    meta: {
      title: 'Kết quả khóa luận',
      icon: BarChartOutlined,
      roles: ['HEAD', 'ADMIN', 'LECTURER'],
    },
  },

  // HEAD assignment routes
  {
    path: '/head/extra-points',
    element: ExtraPointRequests,
    meta: {
      title: 'Duyệt điểm cộng',
      icon: SafetyCertificateOutlined,
      roles: ['HEAD', 'ADMIN'],
    },
  },
  {
    path: '/reviewer-assignment',
    element: ReviewerAssignment,
    meta: {
      title: 'navigation.reviewerAssignment',
      icon: TeamOutlined,
      roles: ['HEAD', 'ADMIN'],
    },
  },
  {
    path: '/committee-assignment',
    element: CommitteeAssignment,
    meta: {
      title: 'navigation.committeeAssignment',
      icon: CrownOutlined,
      roles: ['HEAD', 'ADMIN'],
    },
  },
  {
    path: '/head/committees',
    element: CommitteeManagement,
    meta: {
      title: 'navigation.committeeManagement',
      icon: TeamOutlined,
      roles: ['HEAD', 'ADMIN'],
    },
  },
  {
    path: '/head/committee-schedules',
    element: CommitteeSchedules,
    meta: {
      title: 'navigation.committeeSchedules',
      icon: CalendarOutlined,
      roles: ['HEAD', 'ADMIN'],
    },
  },
  {
    path: '/head/semester-settings',
    element: SemesterSettings,
    meta: {
      title: 'navigation.semesterSettings',
      icon: SettingOutlined,
      roles: ['HEAD', 'ADMIN'],
    },
  },
  {
    path: '/head/grade-summary',
    element: GradeSummary,
    meta: {
      title: 'navigation.gradeSummary',
      icon: BarChartOutlined,
      roles: ['HEAD', 'ADMIN'],
    },
  },
  {
    path: '/head/grade-change-approvals',
    element: GradeChangeApprovals,
    meta: {
      title: 'Duyệt sửa điểm',
      icon: HistoryOutlined,
      roles: ['HEAD', 'ADMIN'],
    },
  },

  // Admin routes
  {
    path: '/admin/users',
    element: AdminUsers,
    meta: {
      title: 'navigation.users',
      icon: UserOutlined,
      roles: ['ADMIN'],
    },
  },
  {
    path: '/admin/roles',
    element: AdminRoles,
    meta: {
      title: 'navigation.roles',
      icon: TeamOutlined,
      roles: ['ADMIN'],
    },
  },
  {
    path: '/admin/criteria',
    element: AdminCriteria,
    meta: {
      title: 'navigation.criteria',
      icon: SafetyCertificateOutlined,
      roles: ['HEAD', 'ADMIN'],
    },
  },
  {
    path: '/admin/settings',
    element: AdminSettings,
    meta: {
      title: 'navigation.settings',
      icon: SettingOutlined,
      roles: ['ADMIN'],
    },
  },
  {
    path: '/admin/audit-logs',
    element: AdminAuditLog,
    meta: {
      title: 'Nhật ký hoạt động',
      icon: AuditOutlined,
      roles: ['ADMIN'],
    },
  },
  // Auth routes
  {
    path: '/auth/login',
    element: Login,
    meta: {
      title: 'auth.login',
      roles: ['STUDENT', 'LECTURER', 'HEAD', 'ADMIN'],
      hideInMenu: true,
    },
  },
  {
    path: '/profile',
    element: Profiles,
    meta: {
      title: 'navigation.users',
      roles: ['STUDENT', 'LECTURER', 'HEAD', 'ADMIN'],
      hideInMenu: true,
    },
  },
];

export const getMenuItems = (userRole: UserRole) => {
  // Student menu
  if (userRole === 'STUDENT') {
    return [
      {
        key: '/dashboard',
        icon: <DashboardOutlined />,
        label: 'navigation.dashboard',
      },
      {
        key: '/topics',
        icon: <BookOutlined />,
        label: 'navigation.topics',
      },
      {
        key: '/my-topic',
        icon: <BookOutlined />,
        label: 'navigation.myTopic',
      },

      {
        key: '/extra-points',
        icon: <SafetyCertificateOutlined />,
        label: 'navigation.extraPoints',
      },

      {
        key: '/schedule',
        icon: <CalendarOutlined />,
        label: 'navigation.schedule',
      },
    ];
  }

  // Supervisor menu
  if (userRole === 'LECTURER') {
    return [
      {
        key: '/dashboard',
        icon: <DashboardOutlined />,
        label: 'navigation.dashboard',
      },
      {
        key: 'guidance',
        icon: <BookOutlined />,
        label: 'navigation.guidance',
        children: [
          { key: '/topics', label: 'navigation.topics', icon: <BookOutlined /> },
          { key: '/supervisor/registrations', label: 'navigation.registrations', icon: <TeamOutlined /> },

          { key: '/midterm-evaluation', label: 'navigation.midtermEvaluation', icon: <CheckCircleOutlined /> },
          { key: '/evaluation', label: 'navigation.finalEvaluation', icon: <CheckCircleOutlined /> },
        ],
      },
      {
        key: 'reviewer',
        icon: <SafetyCertificateOutlined />,
        label: 'navigation.reviewerCouncil',
        children: [
          { key: '/evaluation?type=reviewer', label: 'navigation.reviewerForm', icon: <CheckCircleOutlined /> },
        ],
      },
      {
        key: '/schedule',
        icon: <CalendarOutlined />,
        label: 'navigation.schedule',
      },
    ];
  }

  // Head menu
  if (userRole === 'HEAD') {
    return [
      {
        key: '/dashboard',
        icon: <DashboardOutlined />,
        label: 'navigation.dashboard',
      },
      {
        key: 'management',
        icon: <TeamOutlined />,
        label: 'navigation.management',
        children: [
          { key: '/topics', label: 'navigation.topics', icon: <BookOutlined /> },
          { key: '/head/approve-topics', label: 'navigation.approveTopics', icon: <CheckCircleOutlined /> },
          { key: '/reviewer-assignment', label: 'navigation.reviewerAssignment', icon: <TeamOutlined /> },
          { key: '/committee-assignment', label: 'navigation.committeeAssignment', icon: <CrownOutlined /> },
          { key: '/head/committees', label: 'navigation.committeeManagement', icon: <TeamOutlined /> },
          { key: '/head/extra-points', label: 'navigation.extraPoints', icon: <SafetyCertificateOutlined /> },
          { key: '/evaluation', label: 'navigation.evaluation', icon: <CheckCircleOutlined /> },
          { key: '/head/grade-summary', label: 'navigation.gradeSummary', icon: <BarChartOutlined /> },
          { key: '/head/grade-change-approvals', label: 'Duyệt sửa điểm', icon: <HistoryOutlined /> },
          { key: '/admin/criteria', label: 'navigation.criteria', icon: <SafetyCertificateOutlined /> },
        ],
      },
      {
        key: '/final-results',
        icon: <BarChartOutlined />,
        label: 'Kết quả khóa luận',
      },
      {
        key: '/schedule',
        icon: <CalendarOutlined />,
        label: 'navigation.schedule',
      },
      {
        key: '/head/semester-settings',
        icon: <SettingOutlined />,
        label: 'navigation.semesterSettings',
      },
    ];
  }

  // Admin menu
  if (userRole === 'ADMIN') {
    return [
      {
        key: '/dashboard',
        icon: <DashboardOutlined />,
        label: 'navigation.dashboard',
      },
      {
        key: 'admin-management',
        icon: <SettingOutlined />,
        label: 'Quản trị hệ thống',
        children: [
          { key: '/admin/audit-logs', label: 'Nhật ký hoạt động', icon: <AuditOutlined /> },
          { key: '/admin/users', label: 'navigation.users', icon: <UserOutlined /> },
          { key: '/admin/roles', label: 'navigation.roles', icon: <TeamOutlined /> },
          { key: '/admin/criteria', label: 'navigation.criteria', icon: <SafetyCertificateOutlined /> },
          { key: '/admin/settings', label: 'navigation.settings', icon: <SettingOutlined /> },
        ],
      },
      {
        key: '/topics',
        icon: <BookOutlined />,
        label: 'navigation.topics',
      },
      {
        key: '/schedule',
        icon: <CalendarOutlined />,
        label: 'navigation.schedule',
      },
    ];
  }

  return routes.filter(route =>
    !route.meta.hideInMenu &&
    route.meta.roles.includes(userRole) &&
    !route.path.startsWith('/auth')
  ).map(route => ({
    key: route.path,
    icon: route.meta.icon ? <route.meta.icon /> : null,
    label: route.meta.title,
  }));
};

export const getRouteByPath = (path: string) => {
  return routes.find(route => route.path === path);
};
// Force re-evaluation