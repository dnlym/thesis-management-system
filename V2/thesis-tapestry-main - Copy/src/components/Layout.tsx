import { useState, Suspense, useEffect } from 'react';
import { Layout, Menu, Button, Avatar, Dropdown, Spin } from 'antd';
import {
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  UserOutlined,
  LogoutOutlined,
  GlobalOutlined
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import { useAuthStore } from '@/store/auth';
import { getMenuItems } from '@/routes';
import { AuthApi } from '@/api/auth';
import NotificationDropdown from './NotificationDropdown';

const { Header, Sider, Content } = Layout;

const AppLayout = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuthStore();
  const [collapsed, setCollapsed] = useState(false);
  const [siderWidth, setSiderWidth] = useState(250);
  const [isResizing, setIsResizing] = useState(false);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;

      let newWidth = e.clientX;
      if (newWidth < 200) newWidth = 200;
      if (newWidth > 400) newWidth = 400;

      setSiderWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      document.body.style.cursor = 'default';
    };

    if (isResizing) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
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
    const bootstrap = async () => {
      try {
        const { token, isAuthenticated, user: current } = useAuthStore.getState();

        // Check if we need to refresh profile: 
        // 1. Authenticated but no user data
        // 2. Authenticated but user data is incomplete (missing name)
        const needsRefresh = isAuthenticated && token && (!current || !((current as any).full_name || (current as any).fullName));

        if (needsRefresh) {
          const res = await AuthApi.me();
          if (res.success && res.data) {
            const mapped = {
              id: res.data.id,
              full_name: (res.data as any).full_name || (res.data as any).fullName,
              email: res.data.email,
              role: res.data.role as any,
              department: '',
              avatar_url: (res.data as any).avatar_url || (res.data as any).avatarUrl || undefined,
              joined_at: (res.data as any).joined_at || (res.data as any).joinedAt || new Date().toISOString(),
            };
            useAuthStore.getState().login(mapped as any, token, '');
          }
        }
      } catch {
        // ignore bootstrap errors
      }
    };
    bootstrap();
  }, []);

  const rawMenuItems = getMenuItems(user?.role || 'STUDENT');

  const processMenuItems = (items: any[]): any[] => {
    return items.map(item => ({
      ...item,
      label: t(item.label),
      children: item.children ? processMenuItems(item.children) : undefined,
    }));
  };

  const menuItems = processMenuItems(rawMenuItems);

  const userMenu = {
    items: [
      {
        key: 'profile',
        icon: <UserOutlined />,
        label: t('navigation.profile'),
        onClick: () => navigate('/profile'),
      },
      {
        key: 'logout',
        icon: <LogoutOutlined />,
        label: t('auth.logout'),
        onClick: () => {
          AuthApi.logout().finally(() => {
            logout();
            navigate('/auth/login');
          });
        }
      }
    ]
  };

  const changeLanguage = (lang: string) => {
    i18n.changeLanguage(lang);
  };

  const languageMenu = {
    items: [
      {
        key: 'vi',
        label: 'Tiếng Việt',
        onClick: () => changeLanguage('vi')
      },
      {
        key: 'en',
        label: 'English',
        onClick: () => changeLanguage('en')
      }
    ]
  };

  return (
    <Layout className="min-h-screen">
      <Sider
        trigger={null}
        collapsible
        collapsed={collapsed}
        width={siderWidth}
        className="bg-white shadow-soft border-r relative"
        style={{
          overflow: 'hidden',
          height: '100vh',
          position: 'fixed',
          left: 0,
          top: 0,
          bottom: 0,
          zIndex: 100
        }}
      >
        <div className="p-4 text-center border-b">
          <div className="text-lg font-bold text-academic-primary truncate">
            {collapsed ? 'KLTN' : t('common.systemTitle')}
          </div>
        </div>
        <Menu
          mode="inline"
          selectedKeys={[location.pathname]}
          defaultOpenKeys={['guidance', 'reviewer']} // Optional: open submenus by default
          items={menuItems}
          className="border-r-0 h-[calc(100vh-64px)] overflow-y-auto"
          onClick={({ key }) => {
            if (key.startsWith('/')) {
              navigate(key);
            }
          }}
        />

        {/* Resize Handle */}
        {!collapsed && (
          <div
            className="absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-blue-500 transition-colors z-50"
            onMouseDown={handleMouseDown}
            style={{
              backgroundColor: isResizing ? '#3b82f6' : 'transparent',
            }}
          />
        )}
      </Sider>

      <Layout style={{ marginLeft: collapsed ? 80 : siderWidth, transition: isResizing ? 'none' : 'margin-left 0.2s' }}>
        <Header className="bg-white px-4 shadow-soft flex justify-between items-center">
          <Button
            type="text"
            icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            onClick={() => setCollapsed(!collapsed)}
            className="text-lg"
          />

          <div className="flex items-center space-x-4">
            <Dropdown menu={languageMenu} placement="bottomRight">
              <Button type="text" icon={<GlobalOutlined />} />
            </Dropdown>

            <NotificationDropdown />

            <Dropdown menu={userMenu} placement="bottomRight">
              <div className="flex items-center space-x-2 cursor-pointer hover:bg-gray-100 rounded-full pr-3 pl-1 py-1 transition-colors">
                <Avatar src={user?.avatar_url} icon={<UserOutlined />} />
                <span className="font-medium text-gray-700 hidden sm:inline-block">
                  {(user as any)?.full_name || (user as any)?.fullName || t('common.user')}
                </span>
              </div>
            </Dropdown>
          </div>
        </Header>

        <Content className="bg-gray-50 min-h-[calc(100vh-64px)]">
          <Suspense fallback={
            <div className="flex justify-center items-center h-64">
              <Spin size="large" />
            </div>
          }>
            <Outlet />
          </Suspense>
        </Content>
      </Layout>
    </Layout>
  );
};

export default AppLayout;