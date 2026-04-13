import { Form, Input, Button, Card, message } from 'antd';
import { useTranslation } from 'react-i18next';
import { UserOutlined, LockOutlined } from '@ant-design/icons';
import { useAuthStore } from '@/store/auth';
import { useNavigate } from 'react-router-dom';
import type { LoginForm, User } from '@/types';
import { AuthApi } from '@/api/auth';

const Login = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const login = useAuthStore(state => state.login);

  const onFinish = async (values: LoginForm) => {
    try {
      const res = await AuthApi.login(values.email, values.password);
      if (!res.success || !res.data) {
        message.error(t('auth.invalidCredentials'));
        return;
      }

      const { accessToken, refreshToken, user: beUser } = res.data;

      // Initial mapping from login response
      const initialUser: User = {
        id: beUser.id,
        full_name: beUser.fullName,
        email: beUser.email,
        role: beUser.role as User['role'],
        avatar_url: undefined,
        joined_at: new Date().toISOString(),
      };

      // Set token and initial user to store so subsequent requests are authenticated
      login(initialUser, accessToken, refreshToken);

      // Fetch full profile from server to ensure we have the latest data (name, avatar, etc.)
      try {
        const profileRes = await AuthApi.me();
        if (profileRes && profileRes.success && profileRes.data) {
          const profile = profileRes.data;
          const updatedUser: User = {
            ...initialUser,
            id: profile.id,
            full_name: profile.full_name,
            email: profile.email,
            role: profile.role as User['role'],
            avatar_url: profile.avatar_url || undefined,
            joined_at: profile.joined_at || initialUser.joined_at,
          };
          // Update store with fresh data
          login(updatedUser, accessToken, refreshToken);
        }
      } catch (profileError) {
        console.error('Failed to fetch user profile after login', profileError);
        // Continue with initial user data if profile fetch fails
      }

      message.success(t('auth.loginSuccess'));
      navigate('/dashboard');
    } catch (error) {
      message.error(t('auth.loginError'));
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-accent p-4">
      <div className="w-full max-w-md">
        <Card className="shadow-academic border-0">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-gradient-primary rounded-full flex items-center justify-center mx-auto mb-4">
              <UserOutlined className="text-2xl text-white" />
            </div>
            <h1 className="text-2xl font-bold text-foreground mb-2">
              {t('common.systemTitle')}
            </h1>
            <p className="text-muted-foreground">
              {t('auth.login')}
            </p>
          </div>

          <Form
            name="login"
            onFinish={onFinish}
            layout="vertical"
            size="large"
          >
            <Form.Item
              label={t('auth.email')}
              name="email"
              rules={[
                { required: true, message: t('auth.emailRequired') },
                { type: 'email', message: t('auth.emailInvalid') }
              ]}
            >
              <Input
                prefix={<UserOutlined />}
                placeholder={t('auth.emailPlaceholder')}
                className="rounded-lg"
              />
            </Form.Item>

            <Form.Item
              label={t('auth.password')}
              name="password"
              rules={[{ required: true, message: t('auth.passwordRequired') }]}
            >
              <Input.Password
                prefix={<LockOutlined />}
                placeholder={t('auth.passwordPlaceholder')}
                className="rounded-lg"
              />
            </Form.Item>

            <Form.Item>
              <Button
                type="primary"
                htmlType="submit"
                block
                className="h-12 text-lg bg-gradient-primary border-0 rounded-lg hover:opacity-90"
              >
                {t('auth.login')}
              </Button>
            </Form.Item>
          </Form>

          {/* Bạn có thể xóa khối demo này nếu không cần */}
        </Card>
      </div>
    </div>
  );
};

export default Login;