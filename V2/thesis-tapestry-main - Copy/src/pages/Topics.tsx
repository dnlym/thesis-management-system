import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Table, Button, Tag, Space, Modal, Input, Select, Drawer, Row, Col, Spin, Avatar, Popconfirm, Tooltip } from 'antd';
import { notify } from '@/utils/notification';
import { useTranslation } from 'react-i18next';
import { PlusOutlined, EditOutlined, EyeOutlined, EyeInvisibleOutlined, SearchOutlined, FilterOutlined, CheckOutlined, UserOutlined, DeleteOutlined, StopOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useAuthStore } from '@/store/auth';
import { useTopics, useApproveTopic, useHideTopic, useUnhideTopic } from '@/hooks/useTopics';
import { useRegisterTopic } from '@/hooks/useRegistrations';
import { StatusBadge } from '@/components/StatusBadge';
import { useSemesters } from '@/hooks/useSemesters';
import { useQuery } from '@tanstack/react-query';

import { RegistrationsApi } from '@/api/registrations';
import type { TopicStatus } from '@/types';

const { Search } = Input;
const { Option } = Select;

const Topics = () => {
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const navigate = useNavigate();

  // Filters state
  const [filters, setFilters] = useState<{
    status?: TopicStatus;
    search?: string;
  }>({});
  const [showFilters, setShowFilters] = useState(false);

  // Registration modal
  const [registerModalVisible, setRegisterModalVisible] = useState(false);
  const [selectedTopic, setSelectedTopic] = useState<any>(null);
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  // Hooks
  const { data: topics, isLoading } = useTopics(filters);
  const registerMutation = useRegisterTopic();
  const approveMutation = useApproveTopic();
  const hideMutation = useHideTopic();
  const unhideMutation = useUnhideTopic();

  // Get active semester
  const { data: semesters } = useSemesters();
  // Improved logic: Find semester that is not finalized
  const activeSemester = semesters?.find(s => 
    s.calculated_phase !== 'FINAL'
  );

  // Get my current registration (to check if student already has a topic)
  const { data: myCurrentRegistration } = useQuery({
    queryKey: ['my-topic-registration'],
    queryFn: () => RegistrationsApi.getMyTopic(),
    enabled: user?.role === 'STUDENT',
  });

  // Check if student already has ANY registration (regardless of group)
  const hasExistingRegistration = !!(myCurrentRegistration &&
    myCurrentRegistration.status !== 'REJECTED' &&
    myCurrentRegistration.status !== 'CANCELLED');

  const handleSearch = (value: string) => {
    setFilters(prev => ({ ...prev, search: value || undefined }));
  };

  const handleFilterChange = (key: string, value: any) => {
    setFilters(prev => ({ ...prev, [key]: value || undefined }));
  };

  const handleRegister = (topic: any) => {
    setSelectedTopic(topic);
    setAcceptedTerms(false);
    setRegisterModalVisible(true);
  };

  const confirmRegister = async () => {
    if (!selectedTopic) return;
    
    if (!acceptedTerms) {
      notify.error(t('topics.mustAcceptTerms')); 
      return;
    }

    registerMutation.mutate(
      { topicId: selectedTopic.id, accepted: acceptedTerms },
      {
        onSuccess: async () => {
          setRegisterModalVisible(false);
          setSelectedTopic(null);
          // Wait a bit for DB commit, then redirect
          setTimeout(() => {
            navigate('/my-topic');
          }, 500);
        },
      }
    );
  };

  const handleApprove = (id: string) => {
    Modal.confirm({
      title: t('topics.approveConfirmTitle'),
      content: t('topics.approveConfirmContent'),
      onOk: () => approveMutation.mutate(id),
    });
  };

  const handleDelete = (id: string) => {
    // Implement delete logic here
    console.log('Deleting topic with ID:', id);
    // For example: deleteMutation.mutate(id);
  };

  const columns = [
    {
      title: t('topics.topicTitle'),
      dataIndex: 'title',
      key: 'title',
      render: (text: string, record: any) => (
        <a
          onClick={() => navigate(`/topics/${record.id}`)}
          className="text-academic-primary hover:text-academic-primary-dark font-medium cursor-pointer"
        >
          {text}
        </a>
      ),
    },
    {
      title: t('topics.supervisor'),
      dataIndex: 'supervisor',
      key: 'supervisor',
      render: (supervisor: any) => (
        <div className="flex items-center gap-2">
          <Avatar src={supervisor?.avatar_url} icon={<UserOutlined />} size="small" />
          <span>{supervisor?.full_name || 'N/A'}</span>
        </div>
      ),
    },
    {
      title: t('topics.numStudents'),
      key: 'slots',
      render: (_, record: any) => {
        const current = record.current_students || 0;
        const max = record.max_students || 0;
        const isFull = current >= max;
        return (
          <span className={isFull ? 'text-red-500 font-bold' : 'text-green-600 font-bold'}>
            {current}/{max}
          </span>
        );
      },
    },
    {
      title: t('common.status'),
      dataIndex: 'status',
      key: 'status',
      render: (status: TopicStatus) => <StatusBadge status={status} />,
    },
    {
      title: t('topics.createdAt'),
      dataIndex: 'created_at',
      key: 'created_at',
      render: (date: string) => date ? dayjs(date).format('DD/MM/YYYY') : 'N/A',
    },
    {
      title: t('common.actions'),
      key: 'actions',
      render: (_, record: any) => {
        const isFull = (record.current_students || 0) >= (record.max_students || 0);
        const isRegisteredForThisTopic = myCurrentRegistration?.topic_id === record.id;

        return (
          <Space size="small">
            <Button
              type="text"
              icon={<EyeOutlined />}
              onClick={() => navigate(`/topics/${record.id}`)}
              className="text-blue-600 hover:text-blue-700"
            />

            {/* Edit Action - Creator or Admin */}
            {(record.supervisor_id === user?.id || user?.role === 'ADMIN') && (
              <Button
                type="text"
                icon={<EditOutlined />}
                onClick={() => navigate(`/topics/${record.id}/edit`)}
                className="text-orange-500 hover:text-orange-600"
              />
            )}

            {/* Delete Action - Creator or Admin */}
            {(record.supervisor_id === user?.id || user?.role === 'ADMIN') && (
              <Popconfirm
                title={t('topics.deleteConfirm')}
                onConfirm={() => handleDelete(record.id)}
                okText={t('common.yes')}
                cancelText={t('common.no')}
              >
                <Button
                  type="text"
                  icon={<DeleteOutlined />}
                  className="text-red-500 hover:text-red-600"
                />
              </Popconfirm>
            )}

            {/* Hide/Unhide Action - Supervisor can hide their own topics */}
            {user?.role === 'LECTURER' && record.supervisor?.id === user?.id && (
              <>
                {record.status === 'HIDDEN' ? (
                  <Tooltip title={t('topics.unhideTooltip')}>
                    <Button
                      type="text"
                      icon={<EyeOutlined />}
                      onClick={() => unhideMutation.mutate(record.id)}
                      loading={unhideMutation.isPending}
                      className="text-green-600 hover:text-green-700"
                    />
                  </Tooltip>
                ) : (
                  <Tooltip title={t('topics.hideTooltip')}>
                    <Popconfirm
                      title={t('topics.hideConfirm')}
                      description={t('topics.hideDescription')}
                      onConfirm={() => hideMutation.mutate(record.id)}
                      okText={t('topics.hideTooltip')}
                      cancelText={t('common.cancel')}
                    >
                      <Button
                        type="text"
                        icon={<EyeInvisibleOutlined />}
                        loading={hideMutation.isPending}
                        className="text-orange-500 hover:text-orange-600"
                        disabled={['REGISTERED', 'DEFENDING', 'COMPLETED', 'FINALIZED'].includes(record.status)}
                      />
                    </Popconfirm>
                  </Tooltip>
                )}
              </>
            )}

            {/* Grade Action for Lecturers */}
            {user?.role === 'LECTURER' && (
              <Button
                type="text"
                icon={<CheckOutlined />}
                onClick={() => navigate(`/evaluation?topicId=${record.id}`)}
                className="text-green-600 hover:text-green-700"
              />
            )}

            {/* HEAD Approve Action */}
            {(user?.role === 'HEAD' || user?.role === 'ADMIN') && record.status === 'PENDING_APPROVAL' && (
              <Button
                type="text"
                icon={<CheckOutlined />}
                onClick={() => handleApprove(record.id)}
                className="text-success hover:text-success/80"
              />
            )}

            {/* STUDENT Register Action - All students can register individually */}
            {user?.role === 'STUDENT' && ['APPROVED', 'REGISTERED'].includes(record.status) && (
              <>
                {isRegisteredForThisTopic ? (
                  <Button type="default" disabled className="bg-green-100 text-green-700 border-green-200" size="small">
                    {t('topics.alreadyRegistered')}
                  </Button>
                ) : hasExistingRegistration ? (
                  <Tooltip title={t('topics.alreadyHasTopicTooltip', { title: myCurrentRegistration?.topic?.title || '-' })}>
                    <Button
                      type="default"
                      size="small"
                      icon={<StopOutlined />}
                      disabled
                      className="opacity-60"
                    >
                      {t('topics.alreadyHasTopic')}
                    </Button>
                  </Tooltip>
                ) : isFull ? (
                  <Tooltip title={t('topics.isFullTooltip')}>
                    <Button
                      type="default"
                      size="small"
                      disabled
                      className="opacity-60"
                    >
                      {t('topics.isFull')}
                    </Button>
                  </Tooltip>
                ) : (
                  <Button
                    type="primary"
                    size="small"
                    onClick={() => handleRegister(record)}
                  >
                    {t('topics.registerTopic')}
                  </Button>
                )}
              </>
            )}
          </Space>
        );
      },
    },
  ];

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">{t('topics.title')}</h1>
          <p className="text-muted-foreground">{t('topics.subtitle')}</p>
        </div>
        {(user?.role === 'LECTURER' || user?.role === 'HEAD' || user?.role === 'ADMIN') && (
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => navigate('/supervisor/create-topic')}
            className="bg-academic-primary hover:bg-academic-primary-dark border-academic-primary"
          >
            {t('topics.createTopic')}
          </Button>
        )}
      </div>

      {/* Filters and Search */}
      <Card className="shadow-soft mb-4">
        <Row gutter={16}>
          <Col xs={24} md={12} lg={8}>
            <Search
              placeholder={t('topics.searchPlaceholder')}
              allowClear
              onSearch={handleSearch}
              className="mb-2"
            />
          </Col>
          <Col xs={24} md={12} lg={8}>
            <Select
              placeholder={t('topics.filterStatus')}
              allowClear
              onChange={(value) => handleFilterChange('status', value)}
              style={{ width: '100%' }}
              className="mb-2"
            >
              <Option value="APPROVED">{t('status.topic.APPROVED')}</Option>
              <Option value="PENDING_APPROVAL">{t('status.topic.PENDING_APPROVAL')}</Option>
              <Option value="DRAFT">{t('status.topic.DRAFT')}</Option>
              <Option value="REGISTERED">{t('status.topic.REGISTERED')}</Option>
              <Option value="UNDER_REVIEW">{t('status.topic.UNDER_REVIEW')}</Option>
              <Option value="COMPLETED">{t('status.topic.COMPLETED')}</Option>
            </Select>
          </Col>
          <Col xs={24} md={24} lg={8}>
            <Button
              icon={<FilterOutlined />}
              onClick={() => setShowFilters(!showFilters)}
            >
              {showFilters ? t('topics.hideFilters') : t('topics.showFilters')}
            </Button>
          </Col>
        </Row>
      </Card>

      {/* Topics Table */}
      <Card className="shadow-soft">
        <Spin spinning={isLoading}>
          <Table
            columns={columns}
            dataSource={topics?.topics || []}
            rowKey="id"
            pagination={{
              current: topics?.pagination?.page || 1,
              pageSize: topics?.pagination?.limit || 10,
              total: topics?.pagination?.total || 0,
              showSizeChanger: true,
              showQuickJumper: true,
              showTotal: (total, range) => t('approveTopics.showTotal', { range0: range[0], range1: range[1], total }),
              onChange: (page, pageSize) => {
                setFilters(prev => ({ ...prev, page, size: pageSize }));
              }
            }}
            locale={{
              emptyText: t('topics.emptyTopics'),
            }}
          />
        </Spin>
      </Card>

      {/* Registration Modal */}
      <Modal
        title={t('topics.registerModalTitle')}
        open={registerModalVisible}
        onOk={confirmRegister}
        onCancel={() => {
          setRegisterModalVisible(false);
          setSelectedTopic(null);
        }}
        confirmLoading={registerMutation.isPending}
        okText={t('topics.confirmRegisterButton')}
        cancelText={t('common.cancel')}
        okButtonProps={{ disabled: !acceptedTerms }}
      >
        {selectedTopic && (
          <div className="space-y-4">
            <div>
              <h3 className="font-semibold text-lg mb-2">{selectedTopic.title}</h3>
              <div className="text-sm text-gray-600" dangerouslySetInnerHTML={{ __html: selectedTopic.description || '' }} />
            </div>

            <div className="bg-yellow-50 border border-yellow-200 rounded p-3">
              <p className="text-sm text-yellow-800">
                {t('topics.registrationLimitNote')}
              </p>
            </div>

            <div className="flex items-start space-x-2">
              <input 
                type="checkbox" 
                id="confirm" 
                className="mt-1 h-4 w-4 rounded border-gray-300 text-academic-primary focus:ring-academic-primary cursor-pointer" 
                checked={acceptedTerms}
                onChange={(e) => setAcceptedTerms(e.target.checked)}
                required 
              />
              <label htmlFor="confirm" className="text-sm select-none cursor-pointer">
                {t('topics.understandRequirement')}
              </label>
            </div>
          </div>
        )}
      </Modal>


      {/* Advanced Filters Drawer */}
      <Drawer
        title={t('topics.advancedFilters')}
        placement="right"
        onClose={() => setShowFilters(false)}
        open={showFilters}
      >
        <Space direction="vertical" style={{ width: '100%' }} size="large">
          <div>
            <label className="block mb-2 font-medium">{t('topics.semester')}</label>
            <Select
              placeholder="Chọn học kỳ"
              style={{ width: '100%' }}
              allowClear
            >
              <Option value="1">HK1 2024-2025</Option>
              <Option value="2">HK2 2023-2024</Option>
            </Select>
          </div>

          <div>
            <label className="block mb-2 font-medium">{t('topics.department')}</label>
            <Select
              placeholder="Chọn bộ môn"
              style={{ width: '100%' }}
              allowClear
            >
              <Option value="1">Công nghệ thông tin</Option>
              <Option value="2">Khoa học máy tính</Option>
            </Select>
          </div>

          <div>
            <label className="block mb-2 font-medium">{t('topics.numStudents')}</label>
            <Select
              placeholder="Chọn số nhóm"
              style={{ width: '100%' }}
              allowClear
            >
              <Option value="1">1 nhóm</Option>
              <Option value="2">2 nhóm</Option>
            </Select>
          </div>

          <Button
            type="primary"
            block
            onClick={() => setShowFilters(false)}
          >
            {t('topics.applyFilters')}
          </Button>
        </Space>
      </Drawer>
    </div>
  );
};

export default Topics;