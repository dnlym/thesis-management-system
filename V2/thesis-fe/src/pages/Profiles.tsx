import { useEffect, useState } from 'react';
import { Card, Form, Input, Button, Avatar, Space } from 'antd';
import { notify } from '@/utils/notification';
import { useAuthStore } from '@/store/auth';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { UsersApi } from '@/api/users';
import { UserOutlined, UploadOutlined, LoadingOutlined, CameraOutlined } from '@ant-design/icons';
import { Upload, message } from 'antd';
import type { UploadProps } from 'antd';
import type { RcFile } from 'antd/es/upload/interface';
import ImgCrop from 'antd-img-crop';

const Profiles = () => {
  const { user, updateUser } = useAuthStore();
  const queryClient = useQueryClient();

  const [form] = Form.useForm<{ full_name: string; email: string; avatar_url?: string }>();
  const [imageUrl, setImageUrl] = useState<string>();
  const [uploading, setUploading] = useState(false);
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
      if (data.avatar_url) {
        setImageUrl(data.avatar_url);
      }
    }
  }, [data, form]);

  const beforeUpload = (file: RcFile) => {
    const isJpgOrPng = file.type === 'image/jpeg' || file.type === 'image/png';
    if (!isJpgOrPng) {
      message.error('Chỉ hỗ trợ file JPG/PNG!');
      return Upload.LIST_IGNORE;
    }
    const isLt2M = file.size / 1024 / 1024 < 2;
    if (!isLt2M) {
      message.error('Kích thước ảnh phải nhỏ hơn 2MB!');
      return Upload.LIST_IGNORE;
    }
    
    // Khi dùng ImgCrop, file ở đây là file gốc, nhưng chúng ta return false 
    // để ImgCrop xử lý, sau đó ImgCrop sẽ gọi lại onChange/customRequest với file đã crop.
    return true; 
  };


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
    mutation.mutate({ ...values, avatar_url: imageUrl || user?.avatar_url || '' });
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
            <div className="flex flex-col items-center gap-2">
              <ImgCrop rotationSlider aspect={1} cropShape="round" quality={0.8}>
                <Upload
                  name="avatar"
                  showUploadList={false}
                  beforeUpload={beforeUpload}
                  customRequest={async ({ file, onSuccess, onError }) => {
                    try {
                      setUploading(true);
                      const formData = new FormData();
                      formData.append('avatar', file as Blob);
                      const res = await UsersApi.uploadAvatar(user!.id, formData);
                      
                      if (res.success && res.data && res.data.avatar_url) {
                        const newUrl = res.data.avatar_url;
                        setImageUrl(newUrl);
                        form.setFieldsValue({ avatar_url: newUrl });
                        // Update global state immediately
                        updateUser({
                            ...user,
                            avatar_url: newUrl
                        });
                        message.success('Đổi ảnh đại diện thành công!');
                        onSuccess?.(res);
                      }
                    } catch (err: any) {
                        console.error(err);
                        message.error('Lỗi khi tải ảnh: ' + (err.message || 'Server Error'));
                        onError?.(err);
                    } finally {
                        setUploading(false);
                    }
                  }}
                  className="cursor-pointer group block"
                >
                  <div className="relative inline-block rounded-full overflow-hidden shadow-soft transition-all ring-4 ring-white">
                    <Avatar 
                      size={120} 
                      src={imageUrl ? `${imageUrl}?t=${Date.now()}` : (user?.avatar_url ? `${user.avatar_url}?t=${Date.now()}` : undefined)} 
                      icon={<UserOutlined />} 
                      className="transition-opacity group-hover:opacity-70"
                    />
                    <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      {uploading ? <LoadingOutlined className="text-white text-2xl mb-1" /> : <CameraOutlined className="text-white text-2xl mb-1" />}
                      <span className="text-white text-xs font-medium">Đổi ảnh</span>
                    </div>
                  </div>
                </Upload>
              </ImgCrop>
            </div>
            <div className="flex-1">

              <Form form={form} layout="vertical" onFinish={onFinish}>
                {/* Ẩn trường url, nhận dữ liệu ngầm từ Upload */}
                <Form.Item name="avatar_url" hidden>
                  <Input />
                </Form.Item>

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

                <Form.Item className="mb-0 mt-6">
                  <Button type="primary" htmlType="submit" loading={mutation.isPending} size="large" className="px-8">
                    Lưu thay đổi
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
