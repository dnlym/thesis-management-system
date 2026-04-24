import { Card, Table, Tag, Descriptions, Spin, Alert } from 'antd';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { UsersApi } from '@/api/users';

const Roles = () => {
  const { t } = useTranslation();

  const { data: roleStats, isLoading, isError } = useQuery({
    queryKey: ['roles-summary'],
    queryFn: () => UsersApi.getRoleSummary(),
  });

  const rolesData = [
    {
      id: 'STUDENT',
      name: t('roles.names.STUDENT'),
      description: t('roles.descriptions.STUDENT'),
      permissions: t('roles.permissionsList.STUDENT', { returnObjects: true }) as string[],
    },
    {
      id: 'LECTURER',
      name: t('roles.names.LECTURER'),
      description: t('roles.descriptions.LECTURER'),
      permissions: t('roles.permissionsList.LECTURER', { returnObjects: true }) as string[],
    },
    {
      id: 'HEAD',
      name: t('roles.names.HEAD_OF_DEPT') || 'Trưởng bộ môn',
      description: t('roles.descriptions.HEAD_OF_DEPT') || 'Quản lý học thuật tại bộ môn',
      permissions: t('roles.permissionsList.HEAD_OF_DEPT', { returnObjects: true }) as string[],
    },
    {
      id: 'ADMIN',
      name: t('roles.names.ADMIN'),
      description: t('roles.descriptions.ADMIN'),
      permissions: t('roles.permissionsList.ADMIN', { returnObjects: true }) as string[],
    }
  ].map(role => {
    const stats = roleStats?.find(s => s.id === role.id);
    return {
      ...role,
      userCount: stats?.userCount || 0
    };
  });

  const columns = [
    {
      title: t('common.role'),
      dataIndex: 'name',
      key: 'name',
      render: (name: string, record: any) => (
        <div>
          <div className="font-medium text-foreground">{name}</div>
          <div className="text-sm text-muted-foreground">{record.description}</div>
        </div>
      ),
    },
    {
      title: t('common.userCount'),
      dataIndex: 'userCount',
      key: 'userCount',
      render: (count: number) => (
        <Tag color="blue">{t('roles.userCountLabel', { count })}</Tag>
      ),
    },
    {
      title: t('common.permissions'),
      dataIndex: 'permissions',
      key: 'permissions',
      render: (permissions: string[]) => (
        <div className="space-y-1">
          {permissions?.slice(0, 3).map((permission, index) => (
            <Tag key={index} color="green" className="mb-1">
              {permission}
            </Tag>
          ))}
          {permissions?.length > 3 && (
            <Tag color="default">{t('roles.otherPermissions', { count: permissions.length - 3 })}</Tag>
          )}
        </div>
      ),
    },
  ];

  const expandedRowRender = (record: any) => {
    return (
      <div className="p-4 bg-academic-primary-light rounded-lg">
        <Descriptions title={t('roles.permissionsDetail')} size="small" column={1}>
          {record.permissions?.map((permission: string, index: number) => (
            <Descriptions.Item key={index} label={t('roles.permissionLabel', { index: index + 1 })}>
              {permission}
            </Descriptions.Item>
          ))}
        </Descriptions>
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="p-12 flex justify-center items-center">
        <Spin size="large" tip={t('common.loading')} />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="p-6">
        <Alert message={t('common.errorLoadingData')} type="error" showIcon />
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-foreground">{t('navigation.roles')}</h1>
        <p className="text-muted-foreground">{t('roles.subtitle')}</p>
      </div>

      <Card
        title={t('roles.listTitle')}
        className="shadow-soft"
        extra={
          <div className="text-sm text-muted-foreground">
            {t('roles.totalUsers', { count: rolesData.reduce((sum, role) => sum + role.userCount, 0) })}
          </div>
        }
      >
        <Table
          columns={columns}
          dataSource={rolesData}
          rowKey="id"
          expandable={{
            expandedRowRender,
            expandRowByClick: true,
          }}
          pagination={false}
        />
      </Card>
    </div>
  );
};

export default Roles;