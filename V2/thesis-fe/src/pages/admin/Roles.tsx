import { Card, Table, Tag, Descriptions } from 'antd';
import { useTranslation } from 'react-i18next';

const Roles = () => {
  const { t } = useTranslation();

  const mockRoles = [
    {
      id: 'STUDENT',
      name: t('roles.names.STUDENT'),
      description: t('roles.descriptions.STUDENT'),
      permissions: t('roles.permissionsList.STUDENT', { returnObjects: true }) as string[],
      userCount: 150
    },
    {
      id: 'LECTURER',
      name: t('roles.names.LECTURER'),
      description: t('roles.descriptions.LECTURER'),
      permissions: t('roles.permissionsList.LECTURER', { returnObjects: true }) as string[],
      userCount: 25
    },
    {
      id: 'HEAD_OF_DEPT',
      name: t('roles.names.HEAD_OF_DEPT'),
      description: t('roles.descriptions.HEAD_OF_DEPT'),
      permissions: t('roles.permissionsList.HEAD_OF_DEPT', { returnObjects: true }) as string[],
      userCount: 3
    },
    {
      id: 'COUNCIL',
      name: t('roles.names.COUNCIL'),
      description: t('roles.descriptions.COUNCIL'),
      permissions: t('roles.permissionsList.COUNCIL', { returnObjects: true }) as string[],
      userCount: 15
    },
    {
      id: 'ADMIN',
      name: t('roles.names.ADMIN'),
      description: t('roles.descriptions.ADMIN'),
      permissions: t('roles.permissionsList.ADMIN', { returnObjects: true }) as string[],
      userCount: 2
    }
  ];

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
          {permissions.slice(0, 3).map((permission, index) => (
            <Tag key={index} color="green" className="mb-1">
              {permission}
            </Tag>
          ))}
          {permissions.length > 3 && (
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
          {record.permissions.map((permission: string, index: number) => (
            <Descriptions.Item key={index} label={t('roles.permissionLabel', { index: index + 1 })}>
              {permission}
            </Descriptions.Item>
          ))}
        </Descriptions>
      </div>
    );
  };

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
            {t('roles.totalUsers', { count: mockRoles.reduce((sum, role) => sum + role.userCount, 0) })}
          </div>
        }
      >
        <Table
          columns={columns}
          dataSource={mockRoles}
          rowKey="id"
          expandable={{
            expandedRowRender,
            expandRowByClick: true,
          }}
          pagination={false}
        />
      </Card>

      <div className="mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {mockRoles.map((role) => (
          <Card key={role.id} className="shadow-soft">
            <div className="text-center">
              <div className="text-2xl font-bold text-academic-primary mb-2">
                {role.userCount}
              </div>
              <div className="font-medium text-foreground mb-1">
                {role.name}
              </div>
              <div className="text-sm text-muted-foreground">
                {role.description}
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default Roles;