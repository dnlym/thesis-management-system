import { useEffect } from 'react';
import { Card, Form, Input, Button, Avatar, message, Space } from 'antd';
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
        message.success('Cập nhật thông tin cá nhân thành công');
      } else {
        message.error(res.message || 'Cập nhật thất bại');
      }
    },
    onError: () => message.error('Cập nhật thất bại'),
  });

  const onFinish = (values: { full_name: string; email: string; avatar_url?: string }) => {
    mutation.mutate(values);
  };

  return (
    <div className="p-6">
      <Card className="max-w-2xl mx-auto shadow-soft" loading={isLoading}>
        <Space align="start" size={24}>
          <Avatar size={80} src={user?.avatar_url} icon={<UserOutlined />} />
          <div className="flex-1 min-w-[260px]">
            <Form form={form} layout="vertical" onFinish={onFinish}>
              <Form.Item
                label="Họ và tên"
                name="full_name"
                rules={[{ required: true, message: 'Vui lòng nhập họ và tên' }]}
              >
                <Input placeholder="Nhập họ và tên" />
              </Form.Item>

              {/* Student Code - only shown for students, read-only */}
              {data?.student_code && (
                <Form.Item label="Mã số sinh viên">
                  <Input value={data.student_code} disabled className="bg-gray-50" />
                </Form.Item>
              )}

              <Form.Item
                label="Email"
                name="email"
                rules={[{ required: true, message: 'Vui lòng nhập email' }, { type: 'email', message: 'Email không hợp lệ' }]}
              >
                <Input placeholder="Nhập email" />
              </Form.Item>

              <Form.Item label="Ảnh đại diện (URL)" name="avatar_url">
                <Input placeholder="https://..." />
              </Form.Item>

              <Form.Item>
                <Button type="primary" htmlType="submit" loading={mutation.isPending}>
                  Cập nhật
                </Button>
              </Form.Item>
            </Form>
          </div>
        </Space>
      </Card>
    </div>
  );
};

export default Profiles;
