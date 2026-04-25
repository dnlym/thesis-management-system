import { ConfigProvider, App as AntdApp } from 'antd';
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useAuthStore } from '@/store/auth';
import '@/i18n';
import Layout from '@/components/Layout';
import Login from '@/pages/auth/Login';
import { routes } from '@/routes';
import Profiles from '@/pages/Profiles';
import { Suspense, Component, ReactNode } from 'react';
import { LoadingSkeleton } from '@/components/LoadingSkeleton';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { RefreshCcw } from 'lucide-react';
import { StaticNotificationHandler } from '@/utils/notification';

const queryClient = new QueryClient();

class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center min-h-screen p-4 bg-background text-foreground">
          <Alert variant="destructive" className="max-w-md">
            <AlertTitle>Hệ thống có lỗi xảy ra</AlertTitle>
            <AlertDescription>
              Đã có lỗi khi tải trang này. Vui lòng làm mới trang.
            </AlertDescription>
            <Button 
              className="mt-4" 
              onClick={() => window.location.reload()}
              variant="outline"
            >
              <RefreshCcw className="mr-2 h-4 w-4" />
              Làm mới trang
            </Button>
          </Alert>
        </div>
      );
    }
    return this.props.children;
  }
}

const ProtectedRoute = ({ children, allowedRoles }: { children: React.ReactNode, allowedRoles: string[] }) => {
  const { isAuthenticated, user } = useAuthStore();

  if (!isAuthenticated) {
    return <Navigate to="/auth/login" replace />;
  }

  if (!allowedRoles.includes(user?.role || '')) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <ConfigProvider
        theme={{
          token: {
            colorPrimary: '#3b82f6',
            borderRadius: 12,
            fontFamily: 'Inter, system-ui, sans-serif',
            fontSize: 14,
            fontWeightStrong: 600,
          },
          components: {
            Typography: {
              fontSizeHeading1: 24,
              fontSizeHeading2: 20,
              fontSizeHeading3: 18,
              fontWeightStrong: 700,
            },
            Button: {
              fontWeight: 500,
              fontSize: 14,
            },
            Table: {
              fontSize: 14,
            },
            Card: {
              fontSize: 16,
              fontWeightStrong: 600,
            },
            Modal: {
              titleFontSize: 18,
              titleColor: '#0f172a',
            }
          }
        }}
      >
        <AntdApp>
          <StaticNotificationHandler />
          <BrowserRouter future={{ v7_startTransition: true }}>
            <Suspense fallback={<LoadingSkeleton />}>
              <Routes>
                <Route path="/auth/login" element={<Login />} />
                <Route path="/" element={<Navigate to="/dashboard" replace />} />
                <Route path="/" element={
                  <ProtectedRoute allowedRoles={['STUDENT', 'LECTURER', 'HEAD', 'ADMIN']}>
                    <Layout />
                  </ProtectedRoute>
                }>
                  <Route
                    path="profile"
                    element={
                      <ProtectedRoute allowedRoles={['STUDENT', 'LECTURER', 'HEAD', 'ADMIN']}>
                        <Profiles />
                      </ProtectedRoute>
                    }
                  />
                  {routes.filter(route => !route.path.startsWith('/auth')).map(route => (
                    <Route
                      key={route.path}
                      path={route.path.startsWith('/') ? route.path.substring(1) : route.path}
                      element={
                        <ProtectedRoute allowedRoles={route.meta.roles}>
                          <route.element />
                        </ProtectedRoute>
                      }
                    />
                  ))}
                </Route>
              </Routes>
            </Suspense>
          </BrowserRouter>
        </AntdApp>
      </ConfigProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
