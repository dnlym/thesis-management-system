import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Table, Button, Tag, Space, Modal, Input, Select, Row, Col, Spin, Avatar, Popconfirm, Tooltip, Badge, Empty, Flex } from 'antd';
import { notify } from '@/utils/notification';
import { useTranslation } from 'react-i18next';
import { PlusOutlined, EditOutlined, EyeOutlined, EyeInvisibleOutlined, SearchOutlined, FilterOutlined, CheckOutlined, UserOutlined, DeleteOutlined, StopOutlined, ReloadOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useAuthStore } from '@/store/auth';
import { useTopics, useApproveTopic, useHideTopic, useUnhideTopic } from '@/hooks/useTopics';
import { useRegisterTopic } from '@/hooks/useRegistrations';
import { TopicStatusBadge } from '@/components/StatusBadge';
import { useSemesters, useActiveSemester } from '@/hooks/useSemesters';
import { useQuery } from '@tanstack/react-query';
import { useDebounce } from '@/hooks/useDebounce';
import GlobalSearch from '@/components/GlobalSearch';
import HighlightText from '@/components/HighlightText';

import { RegistrationsApi } from '@/api/registrations';
import type { TopicStatus } from '@/types';

const { Search } = Input;
const { Option } = Select;

const STATUS_OPTIONS = [
  { value: 'ALL', label: 'Tất cả trạng thái' },
  { value: 'DRAFT', label: 'Bản nháp' },
  { value: 'PENDING_APPROVAL', label: 'Chờ duyệt' },
  { value: 'REQUIRES_REVISION', label: 'Yêu cầu chỉnh sửa' },
  { value: 'APPROVED', label: 'Đã duyệt' },
  { value: 'REGISTERED', label: 'Đã cá nhân/nhóm ĐK' },
  { value: 'COMPLETED', label: 'Hoàn thành' },
  { value: 'FINALIZED', label: 'Đã chốt điểm' },
];

const Topics = () => {
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const navigate = useNavigate();

  // Hooks & State
  const { data: semesters } = useSemesters();
  const { data: activeSemesterData, isLoading: isLoadingActive } = useActiveSemester();

  const [searchValue, setSearchValue] = useState('');
  const debouncedSearch = useDebounce(searchValue, 300);

  const [filters, setFilters] = useState<any>({
    page: 1,
    size: 10,
    semesterId: undefined,
    status: undefined,
    search: undefined,
  });

  // Registration modal state
  const [registerModalVisible, setRegisterModalVisible] = useState(false);
  const [selectedTopic, setSelectedTopic] = useState<any>(null);
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  // Sync active semester once on load
  const [hasInit, setHasInit] = useState(false);
  if (!hasInit && activeSemesterData?.id) {
    setFilters((prev: any) => ({ ...prev, semesterId: activeSemesterData.id }));
    setHasInit(true);
  }

  // Handle debounced search sync
  const [prevDebouncedSearch, setPrevDebouncedSearch] = useState('');
  if (debouncedSearch !== prevDebouncedSearch) {
    setFilters((prev: any) => ({ ...prev, search: debouncedSearch || undefined, page: 1 }));
    setPrevDebouncedSearch(debouncedSearch);
  }

  const { data: topics, isLoading, isFetching } = useTopics(filters);
  const registerMutation = useRegisterTopic();
  const approveMutation = useApproveTopic();
  const hideMutation = useHideTopic();
  const unhideMutation = useUnhideTopic();

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

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchValue(e.target.value);
  };

  const handleSemesterChange = (value: string) => {
    setFilters((prev: any) => ({ ...prev, semesterId: value, page: 1 }));
  };

  const handleStatusChange = (value: string | undefined) => {
    setFilters((prev: any) => ({ 
      ...prev, 
      status: (value === 'ALL' || !value) ? undefined : value, 
      page: 1 
    }));
  };

  const handleClearFilters = () => {
    setSearchValue('');
    setFilters((prev: any) => ({
      ...prev,
      search: undefined,
      status: undefined,
      page: 1,
      // semesterId stays locked
    }));
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
      title: 'STT',
      key: 'stt',
      width: 60,
      render: (_: any, __: any, index: number) => {
        const page = filters.page || 1;
        const size = filters.size || 10;
        return (page - 1) * size + index + 1;
      },
    },
    {
      title: 'Mã ĐT',
      dataIndex: 'code',
      key: 'code',
      width: 100,
      render: (code: string) => (
        <Tag color="blue" className="font-mono">
          <HighlightText text={code} keyword={debouncedSearch} />
        </Tag>
      ),
    },
    {
      title: t('topics.topicTitle'),
      dataIndex: 'title',
      key: 'title',
      render: (text: string, record: any) => {
        const students = record.registrations?.map((r: any) => r.student) || [];
        return (
          <div className="flex flex-col gap-1 py-1">
            <a
              onClick={() => navigate(`/topics/${record.id}`)}
              className="text-academic-primary hover:text-academic-primary-dark font-semibold cursor-pointer hover:underline transition-all leading-snug"
            >
              <HighlightText text={text} keyword={debouncedSearch} />
            </a>
            {students.length > 0 && (
              <div className="flex flex-wrap gap-x-2 text-[11px] text-slate-400">
                {students.map((s: any) => (
                    <div key={s.id} className="text-[11px] font-medium text-slate-500 bg-slate-50 px-2 py-0.5 rounded border border-slate-100">
                        {s.full_name} ({s.student_code})
                    </div>
                ))}
              </div>
            )}
          </div>
        );
      },
    },
    {
      title: t('topics.supervisor'),
      dataIndex: 'supervisor',
      key: 'supervisor',
      render: (supervisor: any, record: any) => (
        <div className="flex items-center gap-2">
          <Avatar src={supervisor?.avatar_url} icon={<UserOutlined />} size="small" className="flex-shrink-0" />
          <div className="flex flex-col">
            <span className="font-semibold text-slate-800 leading-tight">{record.supervisor?.full_name || 'N/A'}</span>
            <span className="text-[11px] text-slate-400 font-medium tracking-wide mt-0.5">{record.supervisor?.email}</span>
          </div>
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
      key: 'status',
      render: (_, record: any) => (
        <TopicStatusBadge 
          status={record.status} 
          progressStage={record.progress_stage}
          isVisible={record.is_visible}
          isLocked={record.is_locked}
        />
      ),
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
            {(record.supervisor_id === user?.id || user?.role === 'HEAD' || user?.role === 'ADMIN') && (
              <>
                {!record.is_visible ? (
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
                        disabled={['REGISTERED', 'COMPLETED', 'FINALIZED'].includes(record.status)}
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

  const isFiltering = filters.status || filters.search;

  return (
    <div className="page-container">
      <div className="page-inner">
        {/* Header */}
        <Card className="page-header-card">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="page-header-icon"><FilterOutlined className="text-base" /></div>
              <div>
                <div className="page-header-title">{t('topics.title')}</div>
                <div className="page-header-subtitle">{t('topics.subtitle')}</div>
              </div>
            </div>
            {(user?.role === 'LECTURER' || user?.role === 'HEAD' || user?.role === 'ADMIN') && (
              <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/supervisor/create-topic')}>
                {t('topics.createTopic')}
              </Button>
            )}
          </div>
        </Card>

        {/* Filter Bar */}
        <Card className="page-toolbar-card">
          <Flex gap="middle" wrap="wrap" align="center">
          <Input.Search
            placeholder="Tìm kiếm đề tài..."
            value={searchValue}
            onChange={handleSearch}
            allowClear
            className="max-w-md flex-1"
            disabled={!filters.semesterId}
          />
          
          <Select
            placeholder="Chọn học kỳ"
            style={{ width: 450 }}
            value={filters.semesterId}
            onChange={handleSemesterChange}
            loading={isLoadingActive}
            allowClear={false}
          >
            {semesters?.map(s => (
              <Option key={s.id} value={s.id}>
                <Space>
                  {s.id === activeSemesterData?.id && <Badge color="green" />}
                  {s.name}
                  {s.id === activeSemesterData?.id && <span className="text-xs text-green-600 font-medium">(ACTIVE)</span>}
                </Space>
              </Option>
            ))}
          </Select>

          <Select
            placeholder="Lọc trạng thái"
            style={{ width: 200 }}
            value={filters.status}
            onChange={handleStatusChange}
            options={STATUS_OPTIONS.filter(opt => opt.value !== 'ALL')}
            allowClear
          />

          {(isFiltering) && (
            <Button 
              type="link" 
              icon={<ReloadOutlined />} 
              onClick={handleClearFilters}
              className="px-0"
            >
              Xóa bộ lọc
            </Button>
          )}
        </Flex>
        </Card>

        {/* Topics Table */}
        <Card className="page-card-flush">
          <Table
          columns={columns}
          dataSource={topics?.topics || []}
          rowKey="id"
          size="middle"
          className="sys-table"
          loading={isLoading || isFetching}
          pagination={{
            current: topics?.pagination?.page || 1,
            pageSize: topics?.pagination?.limit || 10,
            total: topics?.pagination?.total || 0,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) => t('approveTopics.showTotal', { range0: range[0], range1: range[1], total }),
            onChange: (page, pageSize) => {
              setFilters((prev: any) => ({ ...prev, page, size: pageSize }));
            }
          }}
          locale={{
            emptyText: isFiltering ? (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="Không tìm thấy kết quả phù hợp"
              >
                <Button type="primary" onClick={handleClearFilters}>Xóa bộ lọc</Button>
              </Empty>
            ) : (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="Chưa có đề tài trong học kỳ này"
              >
                {(user?.role === 'LECTURER' || user?.role === 'HEAD' || user?.role === 'ADMIN') && (
                  <Button type="primary" onClick={() => navigate('/supervisor/create-topic')}>+ Tạo đề tài</Button>
                )}
              </Empty>
            ),
          }}
          />
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
              <h3 className="mb-2">{selectedTopic.title}</h3>
              <div className="text-sm text-slate-500 leading-relaxed" dangerouslySetInnerHTML={{ __html: selectedTopic.description || '' }} />
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
      </div>
    </div>
  );
};

export default Topics;