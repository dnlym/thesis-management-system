import { useState } from 'react';
import { Card, Table, Button, Tag, Modal, Form, Input, Select, Space } from 'antd';
import { notify } from '@/utils/notification';
import { useTranslation } from 'react-i18next';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import type { User } from '@/types';
import { useQuery } from '@tanstack/react-query';
import { UsersApi } from '@/api/users';

const Users = () => {
  const { t } = useTranslation();
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [form] = Form.useForm();

  interface UserDisplay {
    id: string;
    fullName: string;
    email: string;
    role: User['role'];
    departmentName: string;
    avatarUrl?: string;
    joinedAt: string;
  }

  const { data, isLoading } = useQuery({
    queryKey: ['admin-users'],
    queryFn: async () => {
      const users = await UsersApi.getAll();
      return users?.map((u: any) => ({
        id: u.id,
        fullName: u.full_name || u.fullName,
        email: u.email,
        role: u.role as User['role'],
        departmentName: u.department?.name || '',
        avatarUrl: u.avatar_url || u.avatarUrl || undefined,
        joinedAt: u.created_at || u.joinedAt || new Date().toISOString(),
      })) || [];
    },
  });

  const getRoleTag = (role: string) => {
    const roleConfig: Record<string, { color: string; text: string }> = {
      STUDENT: { color: 'blue', text: t('roles.STUDENT') },
      SUPERVISOR: { color: 'green', text: t('roles.SUPERVISOR') },
      HEAD: { color: 'purple', text: t('roles.HEAD') },
      REVIEWER: { color: 'cyan', text: t('roles.REVIEWER') },
      COMMITTEE_CHAIR: { color: 'orange', text: t('roles.COMMITTEE_CHAIR') },
      COMMITTEE_SECRETARY: { color: 'orange', text: t('roles.COMMITTEE_SECRETARY') },
      COMMITTEE_MEMBER: { color: 'orange', text: t('roles.COMMITTEE_MEMBER') },
      ADMIN: { color: 'red', text: t('roles.ADMIN') }
    };
    const config = roleConfig[role] || { color: 'default', text: role };
    return <Tag color={config.color}>{config.text}</Tag>;
  };

  const columns = [
    {
      title: t('users.fullName'),
      dataIndex: 'fullName',
      key: 'fullName',
      sorter: (a: UserDisplay, b: UserDisplay) => a.fullName.localeCompare(b.fullName),
    },
    {
      title: 'Email',
      dataIndex: 'email',
      key: 'email',
    },
    {
      title: t('common.role'),
      dataIndex: 'role',
      key: 'role',
      render: (role: string) => getRoleTag(role),
      filters: [
        { text: t('roles.STUDENT'), value: 'STUDENT' },
        { text: t('roles.SUPERVISOR'), value: 'SUPERVISOR' },
        { text: t('roles.HEAD'), value: 'HEAD' },
        { text: t('roles.ADMIN'), value: 'ADMIN' },
      ],
      onFilter: (value: any, record: UserDisplay) => record.role === value,
    },
    {
      title: t('users.department'),
      dataIndex: 'departmentName',
      key: 'departmentName',
    },
    {
      title: t('topics.createdAt'),
      dataIndex: 'joinedAt',
      key: 'joinedAt',
      sorter: (a: UserDisplay, b: UserDisplay) => a.joinedAt.localeCompare(b.joinedAt),
    },
    {
      title: t('common.actions'),
      key: 'actions',
      render: (_, record: UserDisplay) => (
        <Space size="middle">
          <Button
            type="text"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record as any)}
            className="text-warning hover:text-warning/80"
          >
            {t('common.edit')}
          </Button>
          <Button
            type="text"
            icon={<DeleteOutlined />}
            onClick={() => handleDelete(record.id)}
            className="text-destructive hover:text-destructive/80"
          >
            {t('common.delete')}
          </Button>
        </Space>
      ),
    },
  ];

  const handleCreate = () => {
    setEditingUser(null);
    form.resetFields();
    setIsModalVisible(true);
  };

  const handleEdit = (user: User) => {
    setEditingUser(user);
    form.setFieldsValue(user);
    setIsModalVisible(true);
  };

  const handleDelete = (userId: string) => {
    Modal.confirm({
      title: t('users.deleteConfirmTitle'),
      content: t('users.deleteConfirmContent'),
      onOk() {
        notify.success(t('users.deleteSuccess'));
      },
    });
  };

  const handleModalOk = () => {
    form.validateFields().then(values => {
      if (editingUser) {
        notify.success(t('users.updateSuccess'));
      } else {
        notify.success(t('users.createSuccess'));
      }
      setIsModalVisible(false);
      form.resetFields();
    });
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">{t('navigation.users')}</h1>
          <p className="text-muted-foreground">{t('users.subtitle')}</p>
        </div>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={handleCreate}
          className="bg-academic-primary hover:bg-academic-primary-dark"
        >
          {t('users.addUser')}
        </Button>
      </div>

      <Card className="shadow-soft">
        <Table
          columns={columns}
          dataSource={data}
          rowKey="id"
          loading={isLoading}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showTotal: (total, range) =>
              `${range[0]}-${range[1]} of ${total} items`,
          }}
        />
      </Card>

      <Modal
        title={editingUser ? t('users.editUser') : t('users.addNewUser')}
        open={isModalVisible}
        onOk={handleModalOk}
        onCancel={() => setIsModalVisible(false)}
        width={600}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            label={t('users.fullName')}
            name="name"
            rules={[{ required: true, message: t('users.fullNameRequired') }]}
          >
            <Input placeholder={t('users.enterFullName')} />
          </Form.Item>

          <Form.Item
            label="Email"
            name="email"
            rules={[
              { required: true, message: t('users.emailRequired') },
              { type: 'email', message: t('users.emailInvalid') }
            ]}
          >
            <Input placeholder={t('users.enterEmail')} />
          </Form.Item>

          <Form.Item
            label={t('common.role')}
            name="role"
            rules={[{ required: true, message: t('users.roleRequired') }]}
          >
            <Select placeholder={t('users.selectRole')}>
              <Select.Option value="STUDENT">{t('roles.STUDENT')}</Select.Option>
              <Select.Option value="SUPERVISOR">{t('roles.SUPERVISOR')}</Select.Option>
              <Select.Option value="HEAD">{t('roles.HEAD')}</Select.Option>
              <Select.Option value="REVIEWER">{t('roles.REVIEWER')}</Select.Option>
              <Select.Option value="ADMIN">{t('roles.ADMIN')}</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item
            label={t('users.department')}
            name="department"
            rules={[{ required: true, message: t('users.departmentRequired') }]}
          >
            <Select placeholder={t('users.selectDepartment')}>
              <Select.Option value="CNTT">{t('departments.CNTT')}</Select.Option>
              <Select.Option value="DTVT">{t('departments.DTVT')}</Select.Option>
              <Select.Option value="KTMT">{t('departments.KTMT')}</Select.Option>
              <Select.Option value="HTTT">{t('departments.HTTT')}</Select.Option>
            </Select>
          </Form.Item>

          {!editingUser && (
            <Form.Item
              label={t('users.password')}
              name="password"
              rules={[{ required: true, message: t('users.passwordRequired') }]}
            >
              <Input.Password placeholder={t('users.enterPassword')} />
            </Form.Item>
          )}
        </Form>
      </Modal>
    </div>
  );
};

export default Users;