import { useState, Suspense, useEffect } from 'react';
import { Button, Avatar, Dropdown, Spin, Layout, Menu, Tooltip, notification } from 'antd';
import type { MenuProps } from 'antd';
import {
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  UserOutlined,
  LogoutOutlined,
  GlobalOutlined,
  DashboardOutlined,
  BookOutlined,
  CheckCircleOutlined,
  CalendarOutlined,
  BarChartOutlined,
  SettingOutlined,
  TeamOutlined,
  SafetyCertificateOutlined,
  CrownOutlined,
  AuditOutlined,
  LeftOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import { useAuthStore } from '@/store/auth';
import { useQueryClient } from '@tanstack/react-query';
import { semesterBroadcast } from '@/utils/broadcast';
import { AuthApi } from '@/api/auth';
import { useActiveSemester } from '@/hooks/useSemesters';
import NotificationDropdown from './NotificationDropdown';

const { Header, Content } = Layout;

// ─── Menu Config ───────────────────────────────────────────────────────────────

interface MenuItem {
  key: string;
  label: string;
  icon: React.ReactNode;
  disabled?: boolean;
  disabledReason?: string;
}
interface MenuSection {
  title?: string;
  items: MenuItem[];
}

const getMenuSections = (role: string, currentPhase?: string): MenuSection[] => {
  if (role === 'STUDENT') {
    return [
      {
        items: [
          { key: '/dashboard', label: 'Tổng quan', icon: <DashboardOutlined /> },
        ]
      },
      {
        title: 'ĐỀ TÀI',
        items: [
          { key: '/topics', label: 'Danh sách đề tài', icon: <BookOutlined /> },
          { key: '/my-topic', label: 'Đề tài của tôi', icon: <BookOutlined /> },
          { key: '/extra-points', label: 'Điểm cộng NCKH', icon: <SafetyCertificateOutlined /> },
        ]
      },
      {
        title: 'HỆ THỐNG',
        items: [
          { key: '/schedule', label: 'Lịch trình', icon: <CalendarOutlined /> },
        ]
      },
    ];
  }

  if (role === 'LECTURER') {
    return [
      {
        items: [
          { key: '/dashboard', label: 'Tổng quan', icon: <DashboardOutlined /> },
        ]
      },
      {
        title: 'HƯỚNG DẪN',
        items: [
          { key: '/topics', label: 'Quản lý đề tài', icon: <BookOutlined /> },
          { key: '/supervisor/registrations', label: 'Sinh viên hướng dẫn', icon: <TeamOutlined /> },
          { key: '/midterm-evaluation', label: 'Đánh giá giữa kỳ', icon: <CheckCircleOutlined /> },
          { key: '/evaluation', label: 'Đánh giá cuối kỳ', icon: <CheckCircleOutlined /> },
        ]
      },
      {
        title: 'Hệ thống',
        items: [
          { key: '/schedule', label: 'Lịch trình', icon: <CalendarOutlined /> },
        ]
      },
    ];
  }

  if (role === 'HEAD') {
    const isReviewPhase = ['REVIEWING', 'DEFENSE', 'FINAL'].includes(currentPhase || '');
    const isDefensePhase = ['DEFENSE', 'FINAL'].includes(currentPhase || '');

    return [
      {
        items: [
          { key: '/dashboard', label: 'Tổng quan', icon: <DashboardOutlined /> },
        ]
      },
      {
        title: 'QUẢN LÝ',
        items: [
          { key: '/topics', label: 'Quản lý đề tài', icon: <BookOutlined /> },
          { key: '/head/approve-topics', label: 'Phê duyệt đề tài', icon: <CheckCircleOutlined /> },
          { 
            key: '/reviewer-assignment', 
            label: 'Phân công phản biện', 
            icon: <SafetyCertificateOutlined />,
            disabled: !isReviewPhase,
            disabledReason: 'Tính năng chỉ khả dụng từ giai đoạn Phản biện (sau khi có kết quả giữa kỳ).'
          },
          { 
            key: '/committee-assignment', 
            label: 'Phân công hội đồng', 
            icon: <CrownOutlined />,
            disabled: !isDefensePhase,
            disabledReason: 'Tính năng chỉ khả dụng trong giai đoạn Bảo vệ cuối kỳ.'
          },
          { key: '/head/committees', label: 'Quản lý hội đồng', icon: <TeamOutlined /> },
          { key: '/head/extra-points', label: 'Duyệt điểm cộng', icon: <SafetyCertificateOutlined /> },
          { key: '/evaluation', label: 'Đánh giá', icon: <CheckCircleOutlined /> },
        ]
      },
      {
        title: 'BÁO CÁO - THỐNG KÊ',
        items: [
          { key: '/head/grade-summary', label: 'Tổng kết điểm', icon: <BarChartOutlined /> },
          { key: '/admin/criteria', label: 'Tiêu chí', icon: <SafetyCertificateOutlined /> },
          { key: '/final-results', label: 'Kết quả khóa luận', icon: <BarChartOutlined /> },
          { key: '/schedule', label: 'Lịch trình', icon: <CalendarOutlined /> },
        ]
      },
      {
        title: 'HỆ THỐNG',
        items: [
          { key: '/head/semester-settings', label: 'Cài đặt học kỳ', icon: <SettingOutlined /> },
        ]
      },
    ];
  }

  // ADMIN
  return [
    {
      items: [
        { key: '/dashboard', label: 'Tổng quan', icon: <DashboardOutlined /> },
      ]
    },
    {
      title: 'QUẢN LÝ',
      items: [
        { key: '/topics', label: 'Quản lý đề tài', icon: <BookOutlined /> },
        { key: '/head/approve-topics', label: 'Phê duyệt đề tài', icon: <CheckCircleOutlined /> },
        { key: '/reviewer-assignment', label: 'Phân công phản biện', icon: <SafetyCertificateOutlined /> },
        { key: '/committee-assignment', label: 'Phân công hội đồng', icon: <CrownOutlined /> },
        { key: '/head/committees', label: 'Quản lý hội đồng', icon: <TeamOutlined /> },
        { key: '/head/extra-points', label: 'Duyệt điểm cộng', icon: <SafetyCertificateOutlined /> },
        { key: '/evaluation', label: 'Đánh giá', icon: <CheckCircleOutlined /> },
      ]
    },
    {
      title: 'BÁO CÁO - THỐNG KÊ',
      items: [
        { key: '/head/grade-summary', label: 'Tổng kết điểm', icon: <BarChartOutlined /> },
        { key: '/final-results', label: 'Kết quả khóa luận', icon: <BarChartOutlined /> },
      ]
    },
    {
      title: 'QUẢN TRỊ',
      items: [
        { key: '/admin/audit-logs', label: 'Nhật ký hoạt động', icon: <AuditOutlined /> },
        { key: '/admin/users', label: 'Người dùng', icon: <UserOutlined /> },
        { key: '/admin/roles', label: 'Vai trò', icon: <TeamOutlined /> },
        { key: '/admin/criteria', label: 'Tiêu chí đánh giá', icon: <SafetyCertificateOutlined /> },
      ]
    },
    {
      title: 'HỆ THỐNG',
      items: [
        { key: '/head/semester-settings', label: 'Vận hành học kỳ', icon: <SettingOutlined /> },
        { key: '/admin/settings', label: 'Cài đặt hệ thống', icon: <SettingOutlined /> },
        { key: '/schedule', label: 'Lịch trình', icon: <CalendarOutlined /> },
      ]
    },
  ];
};

// ─── Custom Sidebar ─────────────────────────────────────────────────────────────

interface SidebarNavProps {
  sections: MenuSection[];
  collapsed: boolean;
  activeKey: string;
  onNavigate: (key: string) => void;
}

const SidebarNav = ({ sections, collapsed, activeKey, onNavigate }: SidebarNavProps) => {
  return (
    <nav className="flex-1 overflow-y-auto py-2 px-2">
      {sections.map((section, si) => (
        <div key={si} className="mb-1">
          {section.title && !collapsed && (
            <div className="text-[10px] font-semibold text-gray-400 tracking-widest px-3 pt-4 pb-1 select-none">
              {section.title}
            </div>
          )}
          {section.title && collapsed && <div className="border-t border-gray-100 mx-2 my-2" />}
          {section.items.map(item => {
            const isActive = (() => {
              if (activeKey === item.key) return true;

              const hasExactMatchAnywhere = sections.some(s => s.items.some(i => i.key === activeKey));
              if (hasExactMatchAnywhere) return false;

              const baseItemKey = item.key.split('?')[0];
              if (activeKey.startsWith(item.key + '?')) return true;
              if (item.key !== '/dashboard' && activeKey.startsWith(baseItemKey + '/') && baseItemKey.length > 1) return true;

              return false;
            })();

            const handleClick = () => {
              if (item.disabled) {
                notification.info({
                  message: 'Tính năng đang khóa',
                  description: item.disabledReason || 'Tính năng này hiện chưa khả dụng trong giai đoạn này.',
                  placement: 'topRight',
                  duration: 4
                });
                return;
              }
              onNavigate(item.key);
            };

            const btn = (
              <button
                key={item.key + item.label}
                onClick={handleClick}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all duration-150 mb-0.5 group
                  ${isActive
                    ? 'bg-blue-50 text-blue-600 font-semibold'
                    : item.disabled 
                      ? 'text-gray-300 cursor-not-allowed' 
                      : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                  }`}
              >
                <span className={`text-base flex-shrink-0 ${isActive ? 'text-blue-600' : item.disabled ? 'text-gray-200' : 'text-gray-400 group-hover:text-gray-600'}`}>
                  {item.icon}
                </span>
                {!collapsed && <span className="truncate">{item.label}</span>}
              </button>
            );
            return collapsed
              ? <Tooltip key={item.key + item.label} title={item.label} placement="right">{btn}</Tooltip>
              : btn;
          })}
        </div>
      ))}
    </nav>
  );
};

// ─── Main Layout ────────────────────────────────────────────────────────────────

const AppLayout = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuthStore();
  const queryClient = useQueryClient();
  const [collapsed, setCollapsed] = useState(false);
  const [siderWidth, setSiderWidth] = useState(240);
  const [isResizing, setIsResizing] = useState(false);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      let newWidth = e.clientX;
      if (newWidth < 200) newWidth = 200;
      if (newWidth > 450) newWidth = 450;
      setSiderWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      document.body.style.cursor = 'default';
      document.body.style.userSelect = 'auto';
    };

    if (isResizing) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      document.body.style.userSelect = 'none'; // Prevent text selection while dragging
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);

  const handleMouseDown = () => {
    setIsResizing(true);
    document.body.style.cursor = 'col-resize';
  };

  useEffect(() => {
    const cleanup = semesterBroadcast.setupListener((payload) => {
      console.log('[Broadcast] Academic phase update detected:', payload);
      queryClient.invalidateQueries({
        predicate: (query) =>
          query.queryKey.some((key: any) =>
            ['semesters', 'active-semester', 'permissions', 'topics', 'topic', 'dashboard'].includes(key)
          )
      });
    });
    return () => cleanup();
  }, [queryClient]);

  useEffect(() => {
    const bootstrap = async () => {
      try {
        const { token, isAuthenticated, user: current } = useAuthStore.getState();
        const needsRefresh = isAuthenticated && token && (!current || !((current as any).full_name || (current as any).fullName));
        if (needsRefresh) {
          const res = await AuthApi.me();
          if (res.success && res.data) {
            const mapped = {
              id: res.data.id,
              full_name: (res.data as any).full_name || (res.data as any).fullName,
              email: res.data.email,
              role: res.data.role as any,
              department: (res.data as any).department,
              department_id: (res.data as any).department_id || (res.data as any).departmentId || (res.data as any).department?.id,
              avatar_url: (res.data as any).avatar_url || (res.data as any).avatarUrl || undefined,
              joined_at: (res.data as any).created_at || (res.data as any).joined_at || new Date().toISOString(),
            };
            useAuthStore.getState().login(mapped as any, token, '');
          }
        }
      } catch { /* ignore */ }
    };
    bootstrap();
  }, []);

  const { data: activeSemester } = useActiveSemester();
  const currentPhase = activeSemester?.calculated_phase;

  const sections = getMenuSections(user?.role || 'STUDENT', currentPhase);
  const activeKey = location.pathname + location.search;

  const handleNavigate = (key: string) => {
    navigate(key);
  };

  const userMenu = {
    items: [
      { key: 'profile', icon: <UserOutlined />, label: t('navigation.profile'), onClick: () => navigate('/profile') },
      {
        key: 'logout', icon: <LogoutOutlined />, label: t('auth.logout'),
        onClick: () => AuthApi.logout().finally(() => { logout(); navigate('/auth/login'); })
      },
    ]
  };

  const languageMenu = {
    items: [
      { key: 'vi', label: 'Tiếng Việt', onClick: () => i18n.changeLanguage('vi') },
      { key: 'en', label: 'English', onClick: () => i18n.changeLanguage('en') },
    ]
  };

  const SIDEBAR_W = collapsed ? 64 : siderWidth;

  return (
    <div className="flex min-h-screen bg-slate-100">
      {/* ── Sidebar ── */}
      <aside
        className={`flex flex-col bg-white border-r border-gray-100 fixed left-0 top-0 bottom-0 z-50 ${isResizing ? '' : 'transition-all duration-200'}`}
        style={{ width: SIDEBAR_W }}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-4 py-6 border-b border-gray-100 select-none flex-shrink-0">
          <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm border border-gray-100">
            <img src="/assets/branding/logo-short.png" alt="Logo" className="w-8 h-8 object-contain" />
          </div>
          {!collapsed && (
            <div className="flex flex-col py-1">
              <span className="font-black text-slate-900 text-[11px] leading-[1.4] uppercase tracking-tighter whitespace-nowrap">{t('auth.brandingTitle')}</span>
              <span className="font-bold text-blue-600 text-[10px] leading-[1.4] mt-0.5 whitespace-nowrap">{t('auth.brandingSubTitle')}</span>
            </div>
          )}
        </div>

        {/* Nav Items */}
        <SidebarNav
          sections={sections}
          collapsed={collapsed}
          activeKey={activeKey}
          onNavigate={handleNavigate}
        />

        {/* Collapse toggle */}
        <div className="border-t border-gray-100 p-2 flex-shrink-0 relative">
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-all"
          >
            <LeftOutlined
              className="text-xs transition-transform duration-200"
              style={{ transform: collapsed ? 'rotate(180deg)' : 'rotate(0deg)' }}
            />
            {!collapsed && <span>Thu gọn</span>}
          </button>
        </div>

        {/* Resize Handle */}
        {!collapsed && (
          <div
            className="absolute top-0 right-0 w-1.5 h-full cursor-col-resize hover:bg-blue-500 z-50"
            onMouseDown={handleMouseDown}
            style={{
              backgroundColor: isResizing ? '#3b82f6' : 'transparent',
              transition: isResizing ? 'none' : 'background-color 0.2s',
              transform: 'translateX(50%)'
            }}
          />
        )}
      </aside>

      {/* ── Main area ── */}
      <div className={`flex flex-col flex-1 min-h-screen ${isResizing ? '' : 'transition-all duration-200'}`} style={{ marginLeft: SIDEBAR_W }}>
        {/* Header */}
        <header className="bg-white border-b border-gray-100 px-6 h-14 flex items-center justify-between flex-shrink-0 sticky top-0 z-40">
          <div /> {/* spacer */}
          <div className="flex items-center gap-3">
            <Dropdown menu={languageMenu} placement="bottomRight">
              <Button type="text" size="small" icon={<GlobalOutlined />} className="text-gray-500" />
            </Dropdown>

            <NotificationDropdown />

            <Dropdown menu={userMenu} placement="bottomRight">
              <div className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 rounded-xl px-3 py-1.5 transition-colors">
                <Avatar size={32} src={user?.avatar_url} icon={<UserOutlined />} className="bg-blue-500" />
                <div className="hidden sm:block text-right">
                  <div className="text-sm font-semibold text-gray-800 leading-tight">
                    {(user as any)?.full_name || (user as any)?.fullName || t('common.user')}
                  </div>
                  <div className="text-xs text-gray-400 leading-tight">
                    {user?.role === 'HEAD' ? 'Trưởng bộ môn' : user?.role === 'LECTURER' ? 'Giảng viên' : user?.role === 'STUDENT' ? 'Sinh viên' : 'Quản trị viên'}
                  </div>
                </div>
              </div>
            </Dropdown>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 bg-slate-100">
          <Suspense fallback={
            <div className="flex justify-center items-center h-64">
              <Spin size="large" />
            </div>
          }>
            <Outlet />
          </Suspense>
        </main>
      </div>
    </div>
  );
};

export default AppLayout;