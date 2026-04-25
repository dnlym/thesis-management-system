import { useEffect } from 'react';
import { Card, Form, Input, Button, Avatar, Space } from 'antd';
import { notify } from '@/utils/notification';
import { useAuthStore } from '@/store/auth';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { UsersApi } from '@/api/users';
import { UserOutlined } from '@ant-design/icons';

const Profiles = () => {
  const { user, updateUser } = useAuthStore();
  const queryClient = useQueryClient();

  const [form] = Form.useForm<{ full_name: string; email: string; avatar_url?: string }>();

  const { data, isLoading } = useQuery({
    queryKey: ['profile', user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const res = await UsersApi.getById(user!.id);
      return res.data;
    },
  });

  useEffect(() => {
    if (data) {
      form.setFieldsValue({
        full_name: data.full_name,
        email: data.email,
        avatar_url: data.avatar_url || '',
      });
    }
  }, [data, form]);

  const mutation = useMutation({
    mutationFn: async (values: { full_name: string; email: string; avatar_url?: string }) => {
      return await UsersApi.update(user!.id, values);
    },
    onSuccess: (res) => {
      if (res.success && res.data) {
        updateUser({
          full_name: res.data.full_name,
          email: res.data.email,
          avatar_url: res.data.avatar_url || undefined,
        });
        queryClient.invalidateQueries({ queryKey: ['profile', user?.id] });
        notify.success('Cập nhật thông tin cá nhân thành công');
      } else {
        notify.error(res.message || 'Cập nhật thất bại');
      }
    },
    onError: () => notify.error('Cập nhật thất bại'),
  });

  const onFinish = (values: { full_name: string; email: string; avatar_url?: string }) => {
    mutation.mutate(values);
  };

  return (
    <div className="page-container">
      <div className="page-inner">
        {/* Header */}
        <Card className="page-header-card">
          <div className="flex items-center gap-3">
            <div className="page-header-icon"><UserOutlined className="text-base" /></div>
            <div>
              <div className="page-header-title">Thông tin cá nhân</div>
              <div className="page-header-subtitle">Quản lý thông tin tài khoản và hồ sơ của bạn</div>
            </div>
          </div>
        </Card>

        <Card className="max-w-2xl mx-auto page-card-flush p-8" loading={isLoading}>
          <Space align="start" size={32} className="w-full">
            <Avatar size={100} src={user?.avatar_url} icon={<UserOutlined />} className="shadow-soft" />
            <div className="flex-1">
              <Form form={form} layout="vertical" onFinish={onFinish}>
                <Form.Item
                  label="Họ và tên"
                  name="full_name"
                  rules={[{ required: true, message: 'Vui lòng nhập họ và tên' }]}
                >
                  <Input placeholder="Nhập họ và tên" className="h-10" />
                </Form.Item>

                {/* Student Code - only shown for students, read-only */}
                {data?.student_code && (
                  <Form.Item label="Mã số sinh viên">
                    <Input value={data.student_code} disabled className="h-10 bg-gray-50 font-mono" />
                  </Form.Item>
                )}

                <Form.Item
                  label="Email"
                  name="email"
                  rules={[{ required: true, message: 'Vui lòng nhập email' }, { type: 'email', message: 'Email không hợp lệ' }]}
                >
                  <Input placeholder="Nhập email" className="h-10" />
                </Form.Item>

                <Form.Item label="Ảnh đại diện (URL)" name="avatar_url">
                  <Input placeholder="https://..." className="h-10" />
                </Form.Item>

                <Form.Item className="mb-0 mt-6">
                  <Button type="primary" htmlType="submit" loading={mutation.isPending} size="large" className="px-8">
                    Cập nhật
                  </Button>
                </Form.Item>
              </Form>
            </div>
          </Space>
        </Card>
      </div>
    </div>
  );
};

export default Profiles;
