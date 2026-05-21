import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Table, Button, Tag, Space, Modal, Input, Select, Row, Col, Spin, Avatar, Popconfirm, Tooltip, Badge, Empty, Flex, Tabs } from 'antd';
import { notify } from '@/utils/notification';
import { useTranslation } from 'react-i18next';
import { PlusOutlined, EditOutlined, EyeOutlined, EyeInvisibleOutlined, SearchOutlined, FilterOutlined, CheckOutlined, CheckCircleOutlined, UserOutlined, DeleteOutlined, StopOutlined, ReloadOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useAuthStore } from '@/store/auth';
import { useTopics, useTopicStats, useApproveTopic, useHideTopic, useUnhideTopic } from '@/hooks/useTopics';
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
    const savedSemesterId = localStorage.getItem('sys_selected_semester_id') || activeSemesterData.id;
    setFilters((prev: any) => ({ ...prev, semesterId: savedSemesterId }));
    setHasInit(true);
  }

  // Handle debounced search sync
  const [prevDebouncedSearch, setPrevDebouncedSearch] = useState('');
  if (debouncedSearch !== prevDebouncedSearch) {
    setFilters((prev: any) => ({ ...prev, search: debouncedSearch || undefined, page: 1 }));
    setPrevDebouncedSearch(debouncedSearch);
  }

  const { data: topics, isLoading, isFetching } = useTopics(filters);
  const { data: stats } = useTopicStats();
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
    localStorage.setItem('sys_selected_semester_id', value);
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
        return <span className="font-bold text-slate-400">{(page - 1) * size + index + 1}</span>;
      },
    },
    {
      title: 'Mã ĐT',
      dataIndex: 'code',
      key: 'code',
      width: 90,
      render: (code: string) => (
        <Tag className="m-0 font-sans bg-blue-50 text-blue-600 border-blue-100 font-bold px-2 py-0.5 text-xs" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
          <HighlightText text={code} keyword={debouncedSearch} />
        </Tag>
      ),
    },
    {
      title: t('topics.topicTitle'),
      dataIndex: 'title',
      key: 'title',
      render: (text: string, record: any) => {
        const students = record.students || record.registrations?.map((r: any) => r.student) || [];
        return (
          <div className="flex flex-col gap-1.5 py-1">
            <a
              onClick={() => navigate(`/topics/${record.topicId}`)}
              className="text-blue-600 hover:text-blue-800 font-bold cursor-pointer hover:underline transition-all leading-snug"
            >
              <HighlightText text={text} keyword={debouncedSearch} />
            </a>
            {students.length > 0 && (
              <div className="flex flex-wrap gap-x-2 gap-y-1 text-[11px] text-slate-400">
                {students.map((s: any) => {
                  const isFailed = s.midtermStatus === 'FAIL' || s.registrationStatus === 'FAILED' || s.midterm_status === 'FAIL' || s.status === 'FAILED';
                  const label = `${s.full_name || s.fullName} - ${s.student_code || s.studentCode}`;
                  const tagEl = (
                    <div key={s.id} className={`text-[11px] font-medium px-2 py-0.5 rounded border transition-all ${
                      isFailed
                        ? 'text-slate-400 bg-slate-100 border-slate-200 opacity-60 line-through cursor-help'
                        : 'text-slate-600 bg-slate-50 border-slate-200'
                    }`}>
                      {label}
                      {isFailed && <span className="ml-1 text-[9px] text-red-500 font-bold">(Rớt GK)</span>}
                    </div>
                  );

                  return isFailed ? (
                    <Tooltip key={s.id} title={`Sinh viên rớt giữa kỳ. Lý do: ${s.midtermFeedback || s.midterm_feedback || 'Không có ý kiến phản hồi.'}`}>
                      {tagEl}
                    </Tooltip>
                  ) : tagEl;
                })}
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
      width: 260,
      render: (supervisor: any, record: any) => (
        <div className="flex items-center gap-2.5">
          <Avatar src={supervisor?.avatar_url} icon={<UserOutlined />} size={24} className="border border-slate-200 flex-shrink-0" />
          <div className="flex flex-col">
            <span className="font-bold text-slate-700 text-[13px] leading-none">{record.supervisor?.full_name || 'N/A'}</span>
            <span className="text-slate-400 text-[11px] mt-0.5">{record.supervisor?.email}</span>
          </div>
        </div>
      ),
    },
    {
      title: 'Sinh viên',
      key: 'slots',
      width: 100,
      render: (_, record: any) => {
        const current = record.current_students || 0;
        const max = record.max_students || 2;
        const isFull = current >= max;
        return (
          <span className={`font-bold text-[13px] ${isFull ? 'text-green-600' : 'text-red-500'}`}>
            {current}/{max}
          </span>
        );
      },
    },
    {
      title: t('common.status'),
      key: 'status',
      width: 160,
      render: (_, record: any) => {
        const students = record.students || record.registrations?.map((r: any) => r.student) || [];
        const hasStudents = students.length > 0;
        const areAllFailed = hasStudents && students.every((s: any) => {
          return s.midtermStatus === 'FAIL' || s.registrationStatus === 'FAILED' || s.midterm_status === 'FAIL' || s.status === 'FAILED';
        });
        if (areAllFailed) return null;
        return (
          <TopicStatusBadge
            status={record.status}
            progressStage={record.progress_stage}
            isVisible={record.is_visible}
            isLocked={record.is_locked}
            singleTagOnly={true}
          />
        );
      },
    },

    {
      title: t('common.actions'),
      key: 'actions',
      width: 140,
      render: (_, record: any) => {
        const isFull = (record.current_students || 0) >= (record.max_students || 0);
        const myTopicId = myCurrentRegistration?.topicId || myCurrentRegistration?.topic_id;
        const isRegisteredForThisTopic = !!myTopicId && myTopicId === record.topicId;

        return (
          <Space size={6}>
            <Tooltip title="Xem chi tiết đề tài">
              <Button
                type="text"
                icon={<EyeOutlined className="text-slate-600 text-[15px]" />}
                onClick={() => navigate(`/topics/${record.topicId}`)}
                className="flex items-center justify-center h-8 w-8 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-100 transition-all"
              />
            </Tooltip>

            {/* Edit Action - Creator or Admin */}
            {(record.supervisor_id === user?.id || user?.role === 'ADMIN') && (
              <Tooltip title="Chỉnh sửa đề tài">
                <Button
                  type="text"
                  icon={<EditOutlined className="text-orange-600 text-[15px]" />}
                  onClick={() => navigate(`/topics/${record.topicId}/edit`)}
                  className="flex items-center justify-center h-8 w-8 rounded-lg bg-orange-50 hover:bg-orange-100 border border-orange-100 transition-all"
                />
              </Tooltip>
            )}

            {/* Delete Action - Creator or Admin */}
            {(record.supervisor_id === user?.id || user?.role === 'ADMIN') && (
              <Popconfirm
                title={t('topics.deleteConfirm')}
                onConfirm={() => handleDelete(record.topicId)}
                okText={t('common.yes')}
                cancelText={t('common.no')}
              >
                <Tooltip title="Xóa đề tài">
                  <Button
                    type="text"
                    icon={<DeleteOutlined className="text-red-600 text-[15px]" />}
                    className="flex items-center justify-center h-8 w-8 rounded-lg bg-red-50 hover:bg-red-100 border border-red-100 transition-all"
                  />
                </Tooltip>
              </Popconfirm>
            )}

            {/* Hide/Unhide Action - Supervisor can hide their own topics */}
            {(record.supervisor_id === user?.id || user?.role === 'HEAD' || user?.role === 'ADMIN') && (
              <>
                {!record.is_visible ? (
                  <Tooltip title={t('topics.unhideTooltip')}>
                    <Button
                      type="text"
                      icon={<EyeOutlined className="text-green-600 text-[15px]" />}
                      onClick={() => unhideMutation.mutate(record.id)}
                      loading={unhideMutation.isPending}
                      className="flex items-center justify-center h-8 w-8 rounded-lg bg-green-50 hover:bg-green-100 border border-green-100 transition-all"
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
                        icon={<EyeInvisibleOutlined className="text-amber-600 text-[15px]" />}
                        loading={hideMutation.isPending}
                        className="flex items-center justify-center h-8 w-8 rounded-lg bg-amber-50 hover:bg-amber-100 border border-amber-100 transition-all"
                        disabled={['REGISTERED', 'COMPLETED', 'FINALIZED'].includes(record.status)}
                      />
                    </Popconfirm>
                  </Tooltip>
                )}
              </>
            )}

            {/* Grade Action for Lecturers */}
            {user?.role === 'LECTURER' && (
              <Tooltip title="Đánh giá đề tài">
                <Button
                  type="text"
                  icon={<CheckOutlined className="text-green-600 text-[15px]" />}
                  onClick={() => navigate(`/evaluation?topicId=${record.topicId || record.id}`)}
                  className="flex items-center justify-center h-8 w-8 rounded-lg bg-green-50 hover:bg-green-100 border border-green-100 transition-all"
                />
              </Tooltip>
            )}

            {/* HEAD Approve Action */}
            {(user?.role === 'HEAD' || user?.role === 'ADMIN') && record.status === 'PENDING_APPROVAL' && (
              <Tooltip title="Phê duyệt đề tài">
                <Button
                  type="text"
                  icon={<CheckOutlined className="text-emerald-600 text-[15px]" />}
                  onClick={() => handleApprove(record.id)}
                  className="flex items-center justify-center h-8 w-8 rounded-lg bg-emerald-50 hover:bg-emerald-100 border border-emerald-100 transition-all"
                />
              </Tooltip>
            )}

            {/* STUDENT Register Action - Only in REGISTRATION phase */}
            {user?.role === 'STUDENT' &&
              ['APPROVED', 'REGISTERED'].includes(record.status) &&
              activeSemesterData?.calculated_phase === 'REGISTRATION' && (
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
  const isPastProposalPhase = activeSemesterData && ['REGISTRATION', 'WORK', 'REVIEWING', 'DEFENSE', 'FINAL'].includes(activeSemesterData.calculated_phase);

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
              isPastProposalPhase ? (
                <Tooltip title="Giai đoạn đề xuất đề tài đã kết thúc. Hệ thống hiện đang ở giai đoạn Đăng ký / Thực hiện đề tài.">
                  <Button type="primary" icon={<PlusOutlined />} disabled className="bg-slate-300 border-slate-300 text-slate-500 cursor-not-allowed">
                    {t('topics.createTopic')}
                  </Button>
                </Tooltip>
              ) : (
                <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/supervisor/create-topic')}>
                  {t('topics.createTopic')}
                </Button>
              )
            )}
          </div>
        </Card>

        {/* Filter Bar */}
        <Card className="page-toolbar-card !mb-4">
          <div className="flex flex-col xl:flex-row justify-between items-center gap-4 w-full">
            <Tabs
              activeKey={filters.status || 'ALL'}
              onChange={(key) => handleStatusChange(key === 'ALL' ? undefined : key)}
              className="sys-tabs sys-tabs-capsule !mb-0 w-full xl:w-auto overflow-x-auto"
              items={STATUS_OPTIONS.map(opt => ({
                key: opt.value,
                label: (
                  <div className="flex items-center gap-2 whitespace-nowrap">
                    <span>{opt.label === 'Tất cả trạng thái' ? 'Tất cả' : opt.label}</span>
                    <Tag className="m-0 rounded-full bg-slate-100 text-slate-600 border-none font-bold px-2">
                      {opt.value === 'ALL'
                        ? (topics?.pagination?.total || Object.values(stats || {}).reduce((a: any, b: any) => a + b, 0))
                        : (stats?.[opt.value] || 0)}
                    </Tag>
                  </div>
                )
              }))}
            />

            <div className="flex items-center gap-3 w-full xl:w-auto justify-end">
              <Select
                size="large"
                placeholder="Chọn học kỳ"
                className="w-full md:w-64 flex items-center"
                style={{ height: 40, borderRadius: 12 }}
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

              <Input
                size="large"
                placeholder="Tìm kiếm đề tài..."
                prefix={<SearchOutlined className="text-slate-400" />}
                value={searchValue}
                onChange={handleSearch}
                allowClear
                className="sys-input-search w-full md:w-64 flex items-center"
                style={{ height: 40, borderRadius: 12 }}
                disabled={!filters.semesterId}
              />


            </div>
          </div>
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
            rowClassName={(record) => {
              const students = record.students || record.registrations?.map((r: any) => r.student) || [];
              const hasStudents = students.length > 0;
              const areAllFailed = hasStudents && students.every((s: any) => 
                s.midtermStatus === 'FAIL' || s.registrationStatus === 'FAILED' || s.midterm_status === 'FAIL' || s.status === 'FAILED'
              );
              return areAllFailed ? 'opacity-40 bg-slate-50 text-slate-400 pointer-events-none' : '';
            }}

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
                <div className="text-[13px] text-slate-500 leading-relaxed" dangerouslySetInnerHTML={{ __html: selectedTopic.description || '' }} />
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