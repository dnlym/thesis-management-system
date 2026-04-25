import { Form, Input, Button, Typography, Space, Divider, Checkbox } from 'antd';
import { notify } from '@/utils/notification';
import { useTranslation } from 'react-i18next';
import { UserOutlined, LockOutlined, ArrowRightOutlined, SafetyOutlined } from '@ant-design/icons';
import { useAuthStore } from '@/store/auth';
import { useNavigate } from 'react-router-dom';
import type { LoginForm, User } from '@/types';
import { AuthApi } from '@/api/auth';
import { motion } from 'framer-motion';

const { Title, Text } = Typography;

const Login = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const login = useAuthStore(state => state.login);
  const [form] = Form.useForm();


  const onFinish = async (values: LoginForm) => {
    try {
      const res = await AuthApi.login(values.email, values.password);
      if (!res.success || !res.data) {
        notify.error(t('auth.invalidCredentials'));
        return;
      }

      const { accessToken, refreshToken, user: beUser } = res.data;

      const initialUser: User = {
        id: beUser.id,
        full_name: beUser.fullName,
        email: beUser.email,
        role: beUser.role as User['role'],
        avatar_url: undefined,
        joined_at: new Date().toISOString(),
      };

      login(initialUser, accessToken, refreshToken);

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
          login(updatedUser, accessToken, refreshToken);
        }
      } catch (profileError) {
        console.error('Failed to fetch user profile after login', profileError);
      }

      notify.success(t('auth.loginSuccess'));
      navigate('/dashboard');
    } catch (error) {
      notify.error(t('auth.loginError'));
    }
  };

  return (
    <div className="min-h-screen flex bg-[#0f172a] overflow-hidden">
      {/* ── Left Side: Visual Experience ────────────────────────────────────────── */}
      <div className="hidden lg:flex lg:w-3/5 relative overflow-hidden bg-blue-900">
        <div className="absolute inset-0 z-0">
          <div className="absolute top-[-10%] left-[-10%] w-[60%] h-[60%] rounded-full bg-blue-600/20 blur-[120px] animate-pulse" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-indigo-500/10 blur-[100px]" />
          <img
            src="https://images.unsplash.com/photo-1541339907198-e08759dfc3ef?auto=format&fit=crop&q=80&w=2070"
            alt="University"
            className="absolute inset-0 w-full h-full object-cover mix-blend-overlay opacity-30 scale-110"
          />
        </div>

        <div className="relative z-10 w-full flex flex-col justify-between p-16 text-white">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="flex items-center gap-3"
          >
            <div className="bg-white/10 backdrop-blur-md p-2.5 rounded-2xl border border-white/20 shadow-xl">
              <img src="/assets/branding/logo-trang-vang.png" alt="Logo" className="h-10 w-auto" />
            </div>
            <div className="w-[1px] h-10 bg-white/20 self-center mx-1" />
            <div>
              <Text className="text-white/60 text-[10px] uppercase tracking-[0.2em] font-bold block leading-none">{t('auth.faculty')}</Text>
              <Text className="text-white text-lg font-black tracking-tight block -mt-1">{t('auth.departmentName')}</Text>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: -50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 1, delay: 0.2 }}
          >
            <Title className="!text-white !text-6xl !font-black !mb-6 leading-none tracking-tighter">
              {t('auth.brandingTitle')}
              <span className="text-blue-400 block mt-2">{t('auth.brandingSubTitle')}</span>
            </Title>
            <Text className="text-blue-100/60 text-xl max-w-lg block leading-relaxed font-medium">
              {t('auth.brandingDesc')}
            </Text>

          </motion.div>

          <div className="flex items-center gap-2 text-white/30 text-xs font-bold tracking-widest uppercase">
            <div className="w-12 h-[1px] bg-white/10" />
            {t('auth.empoweringExcellence')}
          </div>
        </div>
      </div>

      {/* ── Right Side: Login Form ─────────────────────────────────────────────── */}
      <div className="w-full lg:w-2/5 flex flex-col justify-center items-center p-8 lg:p-16 relative bg-white">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-[420px]"
        >
          <div className="lg:hidden flex justify-center mb-12">
            <img src="/assets/branding/logo-trang-vang.png" alt="Logo" className="h-16 w-auto" />
          </div>

          <div className="mb-10">
            <h1 className="!text-4xl tracking-tight">{t('auth.login')}.</h1>
            <p className="text-lg text-slate-400 font-medium">{t('auth.welcomeBack')}</p>
          </div>

          <Form
            form={form}
            name="login"
            onFinish={onFinish}
            layout="vertical"
            size="large"
            requiredMark={false}
          >
            <Form.Item
              name="email"
              rules={[
                { required: true, message: t('auth.emailRequired') },
                { type: 'email', message: t('auth.emailInvalid') }
              ]}
            >
              <div className="relative group">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-600 transition-colors">
                  <UserOutlined />
                </div>
                <Input
                  id="email"
                  name="email"
                  autoComplete="email"
                  placeholder={t('auth.email')}
                  className="pl-12 h-[56px] rounded-2xl border-slate-200 bg-slate-50/50 hover:bg-white focus:bg-white focus:ring-4 focus:ring-blue-100 transition-all text-base font-medium"
                />
              </div>
            </Form.Item>

            <Form.Item
              name="password"
              rules={[{ required: true, message: t('auth.passwordRequired') }]}
            >
              <div className="relative group">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-600 transition-colors">
                  <LockOutlined />
                </div>
                <Input.Password
                  id="password"
                  name="password"
                  autoComplete="current-password"
                  placeholder={t('auth.password')}
                  className="pl-12 h-[56px] rounded-2xl border-slate-200 bg-slate-50/50 hover:bg-white focus:bg-white focus:ring-4 focus:ring-blue-100 transition-all text-base font-medium"
                />
              </div>
            </Form.Item>

            <div className="flex justify-between items-center mb-8 px-1">
              <div className="flex bg-slate-100 p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => i18n.changeLanguage('vi')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${i18n.language === 'vi'
                      ? 'bg-white text-blue-600 shadow-sm'
                      : 'text-slate-400 hover:text-slate-600'
                    }`}
                >
                  Tiếng Việt
                </button>
                <button
                  type="button"
                  onClick={() => i18n.changeLanguage('en')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${i18n.language === 'en'
                      ? 'bg-white text-blue-600 shadow-sm'
                      : 'text-slate-400 hover:text-slate-600'
                    }`}
                >
                  English
                </button>
              </div>
              <a href="#" className="text-sm font-bold text-blue-600 hover:text-blue-700 transition-colors">{t('auth.forgotPassword')}</a>
            </div>

            <Form.Item>
              <Button
                type="primary"
                htmlType="submit"
                block
                className="h-[56px] text-lg font-black bg-blue-600 hover:bg-blue-700 border-0 rounded-2xl shadow-lg shadow-blue-200 flex items-center justify-center gap-2 group transition-all"
              >
                {t('auth.login')}
                <ArrowRightOutlined className="group-hover:translate-x-1 transition-transform" />
              </Button>
            </Form.Item>
          </Form>


        </motion.div>

        <div className="absolute bottom-8 text-slate-300 text-[10px] font-bold uppercase tracking-[0.2em] select-none">
          © 2026 Thesis Management System • Ver 2.0
        </div>
      </div>
    </div>
  );
};

export default Login;