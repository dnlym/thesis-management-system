import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMyTopicRegistration, useStudentsSameTopic, useCancelRegistration } from '@/hooks/useRegistrations';
import { RegistrationsApi } from '@/api/registrations';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/store/auth';
import dayjs from 'dayjs';
import {
  Card,
  Button,
  Typography,
  Tag,
  Descriptions,
  Space,
  Avatar,
  List,
  Input,
  Spin,
  Popconfirm,
  Badge,
  Result,
  Row,
  Col,
  Modal,
  Tooltip
} from 'antd';
import { notify } from '@/utils/notification';
import {
  ArrowLeftOutlined,
  UserOutlined,
  TeamOutlined,
  CheckCircleOutlined,
  SearchOutlined,
  SendOutlined,
  CloseCircleOutlined,
  DeleteOutlined,
  ClockCircleOutlined,
  MailOutlined,
  InfoCircleOutlined,
  UserDeleteOutlined,
  CalendarOutlined
} from '@ant-design/icons';

const { Title, Text, Paragraph } = Typography;
const { Search, TextArea } = Input;

const MyRegisteredTopic = () => {
  const { user: currentUser } = useAuthStore();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchResult, setSearchResult] = useState<any>(null);
  const [searchLoading, setSearchLoading] = useState(false);



  // Fetch my registration
  const { data: myRegistration, isLoading, isError } = useMyTopicRegistration();

  const topicId = myRegistration?.topic?.id;
  const group = myRegistration?.group;
  const hasGroup = !!group;
  const memberCount = group?.members?.filter((m: any) => m.status === 'ACCEPTED')?.length || 0;
  const canInvite = (myRegistration?.topic?.max_students || 1) > 1 && (memberCount < (myRegistration?.topic?.max_students || 1));
  const isLeader = !hasGroup || (hasGroup && myRegistration?.group?.leader_id === currentUser?.id);

  // Fetch my invites
  const { data: invitesData, refetch: refetchInvites } = useQuery({
    queryKey: ['my-invites', topicId],
    queryFn: () => RegistrationsApi.getMyInvites(topicId),
    enabled: !!topicId && canInvite,
  });

  // Fetch students same topic
  const { data: studentsData, isLoading: studentsLoading } = useStudentsSameTopic(topicId);
  const allRegisteredStudents = studentsData?.allRegisteredStudents || [];

  // Search student mutation
  const handleSearch = async (value: string) => {
    if (!value.trim() || !topicId) return;

    setSearchLoading(true);
    setSearchResult(null);

    try {
      const result = await RegistrationsApi.searchStudentForInvite(topicId, value.trim());
      setSearchResult(result);
    } catch (error: any) {
      notify.error(error.response?.data?.error || 'Không tìm thấy sinh viên');
    } finally {
      setSearchLoading(false);
    }
  };

  // Send invite mutation
  const sendInviteMutation = useMutation({
    mutationFn: (studentCode: string) => RegistrationsApi.sendInvite(topicId!, studentCode),
    onSuccess: () => {
      notify.success('Đã gửi lời mời!');
      setSearchResult(null);
      refetchInvites();
      queryClient.invalidateQueries({ queryKey: ['students-same-topic', topicId] });
    },
    onError: (error: any) => {
      notify.error(error.response?.data?.error || 'Gửi lời mời thất bại');
    },
  });

  // Accept invite mutation
  const acceptInviteMutation = useMutation({
    mutationFn: (inviteId: string) => RegistrationsApi.acceptInvite(inviteId),
    onSuccess: () => {
      notify.success('Đã chấp nhận lời mời và tạo nhóm!');
      queryClient.invalidateQueries({ queryKey: ['my-topic-registration'] });
      queryClient.invalidateQueries({ queryKey: ['students-same-topic', topicId] });
      refetchInvites();
    },
    onError: (error: any) => {
      notify.error(error.response?.data?.error || 'Chấp nhận thất bại');
    },
  });

  // Reject invite mutation
  const rejectInviteMutation = useMutation({
    mutationFn: (inviteId: string) => RegistrationsApi.rejectInvite(inviteId),
    onSuccess: () => {
      notify.success('Đã từ chối lời mời');
      refetchInvites();
    },
    onError: (error: any) => {
      notify.error(error.response?.data?.error || 'Từ chối thất bại');
    },
  });

  // Cancel invite mutation
  const cancelInviteMutation = useMutation({
    mutationFn: (inviteId: string) => RegistrationsApi.cancelInvite(inviteId),
    onSuccess: () => {
      notify.success('Đã hủy lời mời');
      refetchInvites();
    },
    onError: (error: any) => {
      notify.error(error.response?.data?.error || 'Hủy thất bại');
    },
  });

  // Disband group mutation
  const disbandGroupMutation = useMutation({
    mutationFn: () => RegistrationsApi.disbandGroup(),
    onSuccess: () => {
      notify.success('Đã giải tán nhóm');
      queryClient.invalidateQueries({ queryKey: ['my-topic-registration'] });
      queryClient.invalidateQueries({ queryKey: ['students-same-topic', topicId] });
    },
    onError: (error: any) => {
      notify.error(error.response?.data?.error || 'Giải tán thất bại');
    },
  });

  // Remove member mutation
  const removeMemberMutation = useMutation({
    mutationFn: (userId: string) => RegistrationsApi.removeMember(myRegistration.group.id, userId),
    onSuccess: () => {
      notify.success('Đã xóa thành viên khỏi nhóm');
      queryClient.invalidateQueries({ queryKey: ['my-topic-registration'] });
      queryClient.invalidateQueries({ queryKey: ['students-same-topic', topicId] });
    },
    onError: (error: any) => {
      notify.error(error.response?.data?.error || 'Xóa thành viên thất bại');
    },
  });

  // Cancel individual registration mutation
  const cancelRegistrationMutation = useCancelRegistration();


  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-[calc(100vh-100px)]">
        <Spin size="large" />
      </div>
    );
  }

  if (isError || !myRegistration) {
    return (
      <Result
        status="404"
        title="Chưa đăng ký đề tài"
        subTitle="Bạn chưa đăng ký đề tài nào. Vui lòng đăng ký đề tài từ danh sách."
        extra={
          <Button type="primary" size="large" onClick={() => navigate('/topics')}>
            Xem danh sách đề tài
          </Button>
        }
      />
    );
  }

  const topic = myRegistration.topic;
  const sentInvites = invitesData?.sentInvites || [];
  const receivedInvites = invitesData?.receivedInvites || [];

  // Phase locking logic: Lock group management when in WORK phase or later
  const currentPhase = topic?.semester?.calculated_phase;
  const isPhaseLocked = currentPhase && !['PLANNING', 'PREVIEW', 'REGISTRATION'].includes(currentPhase);

  // Extract assignments and defense schedule
  const reviewerAssignments = topic?.assignments?.filter((a: any) => a.assignment_type === 'REVIEWER') || [];
  const committeeAssignments = topic?.assignments?.filter((a: any) => a.assignment_type === 'COMMITTEE') || [];
  const defenseSchedule = topic?.defense_schedules?.[0];

  return (
    <>
      <div className="page-container">
        <div className="page-inner">
          {/* Header */}
          <Card className="page-header-card">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="page-header-icon"><TeamOutlined className="text-base" /></div>
                <div>
                  <div className="page-header-title">Đề tài của tôi</div>
                  <div className="page-header-subtitle">Thông tin đề tài và quản lý nhóm của sinh viên</div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Button
                  type="text"
                  icon={<ArrowLeftOutlined />}
                  onClick={() => navigate('/topics')}
                >
                  Quay lại
                </Button>
                {group ? (
                  <Popconfirm
                    title="Xác nhận giải tán nhóm?"
                    description="Hành động này sẽ đưa bạn và các thành viên khác về trạng thái làm việc cá nhân."
                    onConfirm={() => disbandGroupMutation.mutate()}
                    okText="Giải tán"
                    cancelText="Hủy"
                    okButtonProps={{ danger: true, loading: disbandGroupMutation.isPending }}
                    disabled={isPhaseLocked}
                  >
                    <Tooltip title={isPhaseLocked ? "Không thể giải tán nhóm trong giai đoạn này" : ""}>
                      <Button danger icon={<DeleteOutlined />} disabled={isPhaseLocked}>
                        Giải tán nhóm
                      </Button>
                    </Tooltip>
                  </Popconfirm>
                ) : (
                  <Popconfirm
                    title="Hủy đăng ký đề tài?"
                    description="Bạn có chắc chắn muốn hủy đăng ký đề tài này không?"
                    onConfirm={() => cancelRegistrationMutation.mutate()}
                    okText="Xác nhận hủy"
                    cancelText="Đóng"
                    okButtonProps={{ danger: true, loading: cancelRegistrationMutation.isPending }}
                    disabled={isPhaseLocked}
                  >
                    <Tooltip title={isPhaseLocked ? "Không thể hủy đăng ký trong giai đoạn này" : ""}>
                      <Button danger icon={<CloseCircleOutlined />} disabled={isPhaseLocked}>
                        Hủy đăng ký
                      </Button>
                    </Tooltip>
                  </Popconfirm>
                )}
              </div>
            </div>
          </Card>

          {/* Midterm Status Card (Individual) */}
          {myRegistration.midterm_status && (
            <Card className="shadow-soft border-0 mb-6 overflow-hidden">
              <div className="flex items-center gap-2 mb-4">
                <div className={`w-1 h-5 ${myRegistration.midterm_status === 'PASS' ? 'bg-emerald-500' : 'bg-red-500'} rounded-full`}></div>
                <span className="text-slate-800 font-bold">Kết quả đánh giá giữa kỳ của sinh viên {currentUser?.full_name}</span>
                <Tag color={myRegistration.midterm_status === 'PASS' ? 'success' : 'error'} className="ml-auto font-semibold">
                  {myRegistration.midterm_status === 'PASS' ? 'Đạt giữa kỳ' : 'Không đạt giữa kỳ'}
                </Tag>
              </div>

              <div className={`p-4 rounded-xl border ${myRegistration.midterm_status === 'PASS' ? 'bg-emerald-50 border-emerald-100 text-emerald-800' : 'bg-red-50 border-red-100 text-red-800'} flex items-start gap-3`}>
                {myRegistration.midterm_status === 'PASS' ? (
                  <CheckCircleOutlined className="text-emerald-500 mt-1 text-lg flex-shrink-0" />
                ) : (
                  <CloseCircleOutlined className="text-red-500 mt-1 text-lg flex-shrink-0" />
                )}
                <div className="text-sm">
                  <Text strong className={`block text-base mb-1 ${myRegistration.midterm_status === 'PASS' ? 'text-emerald-800' : 'text-red-800'}`}>
                    {myRegistration.midterm_status === 'PASS' ? 'Chúc mừng! Bạn đã đạt đánh giá giữa kỳ' : 'Bạn không đạt đánh giá giữa kỳ'}
                  </Text>
                  <Text className={`text-xs ${myRegistration.midterm_status === 'PASS' ? 'text-emerald-700' : 'text-red-700'}`}>
                    {myRegistration.midterm_status === 'PASS'
                      ? 'Bạn đủ điều kiện tiếp tục thực hiện và hoàn thiện khóa luận tốt nghiệp trong học kỳ này.'
                      : 'Rất tiếc, dựa trên đánh giá của Giảng viên hướng dẫn, bạn không đủ điều kiện để tiếp tục thực hiện khóa luận tốt nghiệp trong học kỳ này.'}
                  </Text>
                  {myRegistration.midterm_feedback && (
                    <div className={`mt-3 p-3 bg-white/80 rounded-lg border ${myRegistration.midterm_status === 'PASS' ? 'border-emerald-100 text-emerald-900' : 'border-red-100 text-red-900'} italic text-xs shadow-sm`}>
                      <span className="font-semibold not-italic block mb-1">Ý kiến đánh giá của GVHD:</span>
                      "{myRegistration.midterm_feedback}"
                    </div>
                  )}
                </div>
              </div>
            </Card>
          )}

          {/* Topic Info Card */}
          <Card className="shadow-soft border-0 mb-6 overflow-hidden">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-1 h-5 bg-blue-500 rounded-full"></div>
              <span className="text-slate-800 font-bold">Thông tin đề tài đăng ký</span>
            </div>

            <div className="mb-6 mt-3 text-slate-800 font-bold leading-snug" style={{ fontSize: '15px' }}>
              {topic?.title}
            </div>

            <Descriptions
              bordered
              column={{ xxl: 2, xl: 2, lg: 2, md: 1, sm: 1, xs: 1 }}
              size="small"
              className="sys-descriptions"
              labelStyle={{
                fontWeight: 600,
                width: '240px',
                background: '#f8fafc',
                color: '#64748b',
                fontSize: '13px'
              }}
              contentStyle={{
                background: '#fff',
                color: '#334155',
                fontSize: '13px'
              }}
            >
              <Descriptions.Item label="Giảng viên hướng dẫn" contentStyle={{ width: '300px' }}>
                <Space>
                  <Avatar size={24} src={topic?.supervisor?.avatar_url} icon={<UserOutlined />} className="bg-blue-100 text-blue-600" />
                  <span className="font-semibold">{topic?.supervisor?.full_name}</span>
                </Space>
              </Descriptions.Item>
              <Descriptions.Item label="Email Giảng viên">
                <Space>
                  <MailOutlined className="text-blue-400" />
                  {topic?.supervisor?.email || 'N/A'}
                </Space>
              </Descriptions.Item>
              <Descriptions.Item label="Ngày đăng ký" contentStyle={{ width: '300px' }}>
                <Space>
                  <ClockCircleOutlined className="text-slate-400" />
                  {dayjs(myRegistration.registered_at).format('DD/MM/YYYY')}
                </Space>
              </Descriptions.Item>
              <Descriptions.Item label="Số sinh viên tối đa">
                <Space>
                  <UserOutlined className="text-blue-400" />
                  <span className="font-medium">{topic?.max_students || 2} sinh viên</span>
                </Space>
              </Descriptions.Item>
              <Descriptions.Item label="Mã nhóm" contentStyle={{ width: '300px' }}>
                <Space>
                  <TeamOutlined className="text-blue-400" />
                  {group ? (
                    <Text strong className="text-blue-600">{group.name}</Text>
                  ) : (
                    <Text type="secondary" italic>Chưa lập nhóm</Text>
                  )}
                </Space>
              </Descriptions.Item>
              <Descriptions.Item label="Mô tả đề tài">
                <div
                  className="topic-html-content text-slate-600 py-1 text-[13px]"
                  dangerouslySetInnerHTML={{ __html: topic?.description || 'Chưa có mô tả' }}
                />
              </Descriptions.Item>
              {topic?.objectives && (
                <Descriptions.Item label="Mục tiêu" span={2}>
                  <div
                    className="topic-html-content text-slate-600 py-1 text-[13px]"
                    dangerouslySetInnerHTML={{ __html: topic.objectives }}
                  />
                </Descriptions.Item>
              )}
              {topic?.requirements && (
                <Descriptions.Item label="Yêu cầu sinh viên" span={2}>
                  <div
                    className="topic-html-content text-slate-600 py-1 text-[13px]"
                    dangerouslySetInnerHTML={{ __html: topic.requirements }}
                  />
                </Descriptions.Item>
              )}
            </Descriptions>
          </Card>

          {myRegistration.midterm_status !== 'FAIL' && (
            <Row gutter={[24, 24]}>
              <Col xs={24} lg={16}>
                {/* Reviewer Information Card */}
                {reviewerAssignments.length > 0 && (() => {
                  const sharedSchedule = reviewerAssignments.find((a: any) => a.start_time);
                  return (
                    <Card
                      title={
                        <div className="flex items-center gap-2">
                          <div className="w-1 h-4 bg-purple-500 rounded-full"></div>
                          <span className="text-slate-800 font-bold text-lg">Thông tin phản biện</span>
                        </div>
                      }
                      className="shadow-soft border-0 mb-6"
                      size="small"
                    >
                      {/* Shared Schedule Block */}
                      {sharedSchedule && (
                        <div className="mb-4 p-3 bg-purple-50/50 border border-purple-100/50 rounded-xl flex flex-wrap items-center justify-between gap-4 text-xs text-slate-700">
                          <div className="flex items-center gap-2">
                            <CalendarOutlined className="text-purple-600 text-sm" />
                            <span className="font-bold text-slate-800 uppercase tracking-wider text-[11px]">Lịch phản biện chung:</span>
                          </div>
                          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
                            <div>📅 Ngày: <span className="font-semibold text-slate-900">{dayjs(sharedSchedule.start_time).format('DD/MM/YYYY')}</span></div>
                            <div>⏰ Thời gian: <span className="font-semibold text-slate-900">{dayjs(sharedSchedule.start_time).format('HH:mm')}{sharedSchedule.end_time ? ` - ${dayjs(sharedSchedule.end_time).format('HH:mm')}` : ''}</span></div>
                            <div>
                              📍 Hình thức:{' '}
                              {sharedSchedule.defense_format === 'ONLINE' ? (
                                <Tag color="orange" className="m-0 font-semibold text-[10px]">Trực tuyến</Tag>
                              ) : (
                                <Tag color="green" className="m-0 font-semibold text-[10px]">Trực tiếp</Tag>
                              )}
                            </div>
                            {sharedSchedule.defense_format === 'ONLINE' && sharedSchedule.room && (
                              <div>
                                🔗 Link họp: <a href={sharedSchedule.room} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline break-all font-medium">{sharedSchedule.room}</a>
                                {sharedSchedule.zoom_password && (
                                  <span className="ml-2 text-slate-500">🔑 Pass: <span className="font-semibold text-slate-700 bg-slate-100 px-1 rounded">{sharedSchedule.zoom_password}</span></span>
                                )}
                              </div>
                            )}
                            {sharedSchedule.defense_format !== 'ONLINE' && sharedSchedule.room && (
                              <div>🏢 Phòng: <span className="font-semibold text-slate-900">{sharedSchedule.room}</span></div>
                            )}
                          </div>
                        </div>
                      )}

                      <List
                        itemLayout="horizontal"
                        dataSource={reviewerAssignments}
                        renderItem={(assignment: any, index: number) => (
                          <List.Item className="bg-purple-50/10 p-4 rounded-xl mb-3 border border-purple-100/50 last:mb-0">
                            <List.Item.Meta
                              avatar={<Avatar size={48} src={assignment.reviewer?.avatar_url} icon={<UserOutlined />} className="bg-purple-100 text-purple-600 shadow-sm" />}
                              title={
                                <Space className="flex items-center flex-wrap gap-2 mb-1">
                                  <Text strong className="text-slate-800 text-base">{assignment.reviewer?.full_name}</Text>
                                  <Tag color="purple" className="m-0 text-[11px] font-semibold">Phản biện {assignment.reviewer_order || index + 1}</Tag>
                                </Space>
                              }
                              description={
                                <div className="text-xs text-slate-500 space-y-2 mt-2">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <MailOutlined className="text-purple-400" />
                                    <span>Email: {assignment.reviewer?.email || 'N/A'}</span>
                                    {assignment.reviewer?.phone && (
                                      <>
                                        <span className="text-slate-300">|</span>
                                        <span>SĐT: {assignment.reviewer.phone}</span>
                                      </>
                                    )}
                                  </div>

                                  {/* Reviewer Comments */}
                                  <div className="mt-3 p-3 bg-white rounded-lg border border-purple-100 shadow-2xs">
                                    <span className="font-semibold text-purple-900 block mb-1 text-xs">Nhận xét của GVPB:</span>
                                    {assignment.hasGraded ? (
                                      <span className="text-slate-700 italic">"{assignment.comments || 'Đã chấm điểm, không có nhận xét chi tiết'}"</span>
                                    ) : (
                                      <span className="text-slate-400 italic">Chưa có nhận xét</span>
                                    )}
                                  </div>
                                </div>
                              }
                            />
                          </List.Item>
                        )}
                      />
                    </Card>
                  );
                })()}

                {/* Committee & Defense Schedule Card */}
                {!!defenseSchedule && (
                  <Card
                    title={
                      <div className="flex items-center gap-2">
                        <div className="w-1 h-4 bg-indigo-500 rounded-full"></div>
                        <span className="text-slate-800 font-bold text-lg">Thông tin hội đồng bảo vệ</span>
                      </div>
                    }
                    className="shadow-soft border-0 mb-6 bg-indigo-50/10"
                    size="small"
                  >
                    {/* Schedule info block */}
                    <div className="mb-5 p-4 bg-white rounded-xl border border-indigo-100 shadow-sm">
                      <div className="flex items-center justify-between mb-3">
                        <div className="text-xs font-bold uppercase tracking-wider text-indigo-600 flex items-center gap-2">
                          <ClockCircleOutlined /> Thông tin lịch bảo vệ
                        </div>
                        {defenseSchedule.committee?.type && (
                          <Tag
                            color={defenseSchedule.committee.type === 'ORAL' ? 'blue' : 'purple'}
                            className="m-0 font-bold text-[12px] px-3 py-0.5"
                          >
                            {defenseSchedule.committee.type === 'ORAL' ? '🎤 Hội đồng Oral' : '📋 Hội đồng Poster'}
                          </Tag>
                        )}
                      </div>

                      <Row gutter={[16, 12]}>
                        <Col xs={24} sm={6}>
                          <div className="text-xs text-slate-400 mb-1">📅 Ngày bảo vệ</div>
                          <div className="text-sm font-bold text-slate-700">
                            {dayjs(defenseSchedule.defense_date).format('DD/MM/YYYY')}
                          </div>
                        </Col>
                        <Col xs={24} sm={6}>
                          <div className="text-xs text-slate-400 mb-1">⏰ Giờ bảo vệ</div>
                          <div className="text-sm font-bold text-slate-700">
                            {defenseSchedule.start_time && defenseSchedule.end_time
                              ? `${dayjs(defenseSchedule.start_time).format('HH:mm')} - ${dayjs(defenseSchedule.end_time).format('HH:mm')}`
                              : defenseSchedule.defense_time || 'Theo lịch hội đồng'}
                          </div>
                        </Col>
                        <Col xs={24} sm={6}>
                          <div className="text-xs text-slate-400 mb-1">🏢 Phòng</div>
                          <div className="text-sm font-bold text-indigo-600">
                            {defenseSchedule.room || 'Chưa công bố'}
                          </div>
                        </Col>
                        {defenseSchedule.committee?.name && (
                          <Col xs={24} sm={6}>
                            <div className="text-xs text-slate-400 mb-1">🏛️ Hội đồng</div>
                            <div className="text-sm font-bold text-slate-700">
                              {defenseSchedule.committee.name}
                            </div>
                          </Col>
                        )}
                      </Row>

                      {defenseSchedule.notes && (
                        <div className="mt-4 p-3 bg-amber-50/80 rounded-lg border border-amber-100 text-xs text-amber-800">
                          <span className="font-semibold block mb-0.5">Lưu ý từ Hội đồng:</span>
                          {defenseSchedule.notes}
                        </div>
                      )}
                    </div>

                    {/* Committee members from defenseSchedule.committee */}
                    {defenseSchedule.committee?.members && defenseSchedule.committee.members.length > 0 && (
                      <div>
                        <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3 px-1 flex items-center gap-2">
                          👥 Thành phần Hội đồng chấm bảo vệ
                        </div>
                        <List
                          itemLayout="horizontal"
                          dataSource={defenseSchedule.committee.members}
                          renderItem={(member: any) => {
                            const roleColorMap: any = {
                              CHAIR: 'volcano',
                              SECRETARY: 'geekblue',
                              MEMBER: 'default',
                              MEMBER_1: 'default',
                              MEMBER_2: 'default',
                            };
                            const roleLabelMap: any = {
                              CHAIR: 'Chủ tịch Hội đồng',
                              SECRETARY: 'Thư ký Hội đồng',
                              MEMBER: 'Ủy viên',
                              MEMBER_1: 'Ủy viên 1',
                              MEMBER_2: 'Ủy viên 2',
                            };
                            return (
                              <List.Item className="bg-white p-3.5 rounded-xl mb-2.5 border border-slate-100 shadow-2xs last:mb-0">
                                <List.Item.Meta
                                  avatar={<Avatar size={42} src={member.lecturer?.avatar_url} icon={<UserOutlined />} className="bg-indigo-50 text-indigo-600 shadow-sm" />}
                                  title={
                                    <Space className="flex items-center flex-wrap gap-2">
                                      <Text strong className="text-slate-800 text-sm">{member.lecturer?.full_name}</Text>
                                      <Tag color={roleColorMap[member.role] || 'default'} className="m-0 text-[11px] font-semibold">
                                        {roleLabelMap[member.role] || member.role}
                                      </Tag>
                                    </Space>
                                  }
                                  description={
                                    <div className="text-xs text-slate-400 flex items-center gap-2 mt-0.5">
                                      <MailOutlined className="text-slate-300" />
                                      <span>{member.lecturer?.email || 'N/A'}</span>
                                      {member.lecturer?.phone && (
                                        <>
                                          <span className="text-slate-300">|</span>
                                          <span>SĐT: {member.lecturer.phone}</span>
                                        </>
                                      )}
                                    </div>
                                  }
                                />
                              </List.Item>
                            );
                          }}
                        />
                      </div>
                    )}

                    {/* Fallback: show assignments-based committee if no schedule committee */}
                    {(!defenseSchedule.committee?.members || defenseSchedule.committee.members.length === 0) && committeeAssignments.length > 0 && (
                      <div>
                        <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3 px-1">
                          Thành phần Hội đồng chấm bảo vệ
                        </div>
                        <List
                          itemLayout="horizontal"
                          dataSource={committeeAssignments}
                          renderItem={(assignment: any) => {
                            const roleColorMap: any = { CHAIR: 'volcano', SECRETARY: 'geekblue', MEMBER: 'default' };
                            const roleLabelMap: any = { CHAIR: 'Chủ tịch Hội đồng', SECRETARY: 'Thư ký Hội đồng', MEMBER: 'Ủy viên' };
                            return (
                              <List.Item className="bg-white p-3.5 rounded-xl mb-2.5 border border-slate-100 shadow-2xs last:mb-0">
                                <List.Item.Meta
                                  avatar={<Avatar size={42} src={assignment.reviewer?.avatar_url} icon={<UserOutlined />} className="bg-indigo-50 text-indigo-600 shadow-sm" />}
                                  title={
                                    <Space className="flex items-center flex-wrap gap-2">
                                      <Text strong className="text-slate-800 text-sm">{assignment.reviewer?.full_name}</Text>
                                      <Tag color={roleColorMap[assignment.committee_role] || 'default'} className="m-0 text-[11px] font-semibold">
                                        {roleLabelMap[assignment.committee_role] || assignment.committee_role}
                                      </Tag>
                                    </Space>
                                  }
                                  description={
                                    <div className="text-xs text-slate-400 flex items-center gap-2 mt-0.5">
                                      <span>Email: {assignment.reviewer?.email || 'N/A'}</span>
                                      {assignment.reviewer?.phone && (
                                        <><span className="text-slate-300">|</span><span>SĐT: {assignment.reviewer.phone}</span></>
                                      )}
                                    </div>
                                  }
                                />
                              </List.Item>
                            );
                          }}
                        />
                      </div>
                    )}
                  </Card>
                )}

                {/* Group Members List */}
                {hasGroup && (
                  <Card
                    title={
                      <div className="flex items-center gap-2">
                        <div className="w-1 h-4 bg-emerald-500 rounded-full"></div>
                        <span className="text-slate-800 font-bold text-lg">Thành viên nhóm</span>
                      </div>
                    }
                    className="shadow-soft border-0 mb-6"
                    size="small"
                  >
                    <List
                      itemLayout="horizontal"
                      dataSource={group.members?.filter((m: any) => m.status === 'ACCEPTED')}
                      renderItem={(member: any) => {
                        const memberReg = member.user?.topic_registrations?.find((r: any) => r.topic_id === topic?.id) || member.user?.topic_registrations?.[0];
                        return (
                          <List.Item
                            actions={isLeader && member.user_id !== currentUser?.id ? [
                              <Popconfirm
                                title="Xóa thành viên khỏi nhóm?"
                                onConfirm={() => removeMemberMutation.mutate(member.user_id)}
                                okText="Xóa"
                                cancelText="Hủy"
                                okButtonProps={{ danger: true }}
                              >
                                <Button danger type="link" icon={<UserDeleteOutlined />}>Gỡ</Button>
                              </Popconfirm>
                            ] : []}
                          >
                            <List.Item.Meta
                              avatar={<Avatar size={48} src={member.user?.avatar_url} icon={<UserOutlined />} className="bg-slate-50 text-slate-400" />}
                              title={
                                <Space className="flex items-center">
                                  <Text strong className="text-slate-700">{member.user?.full_name}</Text>
                                  {member.user_id === group.leader_id && (
                                    <Tag color="gold" className="m-0 text-[11px]">Trưởng nhóm</Tag>
                                  )}
                                  {memberReg?.midterm_status === 'PASS' && (
                                    <Tag color="success" className="m-0 text-[11px]">Đạt giữa kỳ</Tag>
                                  )}
                                  {memberReg?.midterm_status === 'FAIL' && (
                                    <Tag color="error" className="m-0 text-[11px]">Không đạt giữa kỳ</Tag>
                                  )}
                                </Space>
                              }
                              description={<span className="text-slate-400">{member.user?.student_code} • {member.user?.email}</span>}
                            />
                          </List.Item>
                        )
                      }}
                    />
                  </Card>
                )}

                {/* Received Invites */}
                {canInvite && receivedInvites.length > 0 && (
                  <Card
                    title={
                      <div className="flex items-center gap-2">
                        <div className="w-1 h-4 bg-blue-500 rounded-full"></div>
                        <span className="text-slate-800 font-bold text-lg">Lời mời đồng hành</span>
                      </div>
                    }
                    className="shadow-soft border-0 bg-blue-50/20 mb-6"
                    extra={<Badge count={receivedInvites.length} />}
                    size="small"
                  >
                    <List
                      dataSource={receivedInvites}
                      renderItem={(invite: any) => (
                        <List.Item
                          className="bg-white p-4 rounded-xl mb-3 shadow-sm border border-blue-50/50"
                          actions={[
                            <Button
                              type="primary"
                              size="middle"
                              shape="round"
                              icon={<CheckCircleOutlined />}
                              onClick={() => acceptInviteMutation.mutate(invite.id)}
                              loading={acceptInviteMutation.isPending}
                              className="bg-blue-600 px-6"
                            >
                              Đồng ý
                            </Button>,
                            <Button
                              danger
                              size="middle"
                              shape="round"
                              icon={<CloseCircleOutlined />}
                              onClick={() => rejectInviteMutation.mutate(invite.id)}
                              loading={rejectInviteMutation.isPending}
                              className="px-6"
                            >
                              Từ chối
                            </Button>
                          ]}
                        >
                          <List.Item.Meta
                            avatar={<Avatar size={48} src={invite.inviter?.avatar_url} icon={<UserOutlined />} />}
                            title={<span className="text-base font-bold text-slate-700">{invite.inviter?.full_name}</span>}
                            description={
                              <div className="text-xs text-slate-400 flex items-center gap-2 mt-1">
                                <ClockCircleOutlined />
                                Hết hạn: {dayjs(invite.expires_at).format('HH:mm - DD/MM/YYYY')}
                              </div>
                            }
                          />
                        </List.Item>
                      )}
                    />
                  </Card>
                )}

                {canInvite && (
                  <Card
                    title={
                      <div className="flex items-center gap-2">
                        <div className="w-1 h-4 bg-blue-500 rounded-full"></div>
                        <span className="text-slate-800 font-bold">Lập nhóm đồng hành</span>
                      </div>
                    }
                    className="shadow-soft border-0 mb-6"
                    size="small"
                  >
                    <div className="p-3 bg-white">
                      <Paragraph type="secondary" className="mb-3 text-xs">
                        Nhập mã sinh viên của người bạn muốn đồng hành để thực hiện chung đề tài.
                      </Paragraph>

                      <div className="max-w-md mb-4">
                        <Space.Compact style={{ width: '100%' }} size="large">
                          <Input
                            placeholder="Nhập mã sinh viên (VD: 2012345)"
                            id="student-search-input"
                            disabled={sentInvites.length > 0 || searchLoading}
                            onPressEnter={(e: any) => handleSearch(e.target.value)}
                          />
                          <Button
                            type="primary"
                            className="px-6 bg-blue-600 hover:bg-blue-700 flex items-center justify-center"
                            onClick={() => {
                              const input = document.getElementById('student-search-input') as HTMLInputElement;
                              if (input) handleSearch(input.value);
                            }}
                            loading={searchLoading}
                            disabled={sentInvites.length > 0}
                          >
                            Tìm kiếm
                          </Button>
                        </Space.Compact>
                      </div>

                      {searchResult && (
                        <div className="mb-4 p-3 rounded-xl bg-blue-50 border border-blue-100 flex justify-between items-center transition-all animate-in fade-in zoom-in duration-300">
                          <div className="flex items-center gap-3">
                            <Avatar size={48} src={searchResult.avatar_url} icon={<UserOutlined />} className="bg-blue-100 text-blue-600 shadow-sm" />
                            <div>
                              <div className="text-base font-bold text-slate-800 leading-tight">{searchResult.full_name}</div>
                              <div className="text-slate-400 font-medium uppercase tracking-wider text-[10px] mt-0.5">{searchResult.student_code} • {searchResult.email}</div>
                            </div>
                          </div>
                          <Button
                            type="primary"
                            shape="round"
                            size="middle"
                            icon={<SendOutlined />}
                            onClick={() => sendInviteMutation.mutate(searchResult.student_code)}
                            loading={sendInviteMutation.isPending}
                            disabled={sentInvites.length > 0}
                            className="bg-blue-600 px-6 shadow-sm hover:shadow-md transition-all"
                          >
                            Mời ngay
                          </Button>
                        </div>
                      )}

                      {sentInvites.length > 0 && (
                        <div className="p-4 bg-amber-50 border border-amber-100 rounded-2xl text-amber-700 flex items-start gap-3">
                          <InfoCircleOutlined className="mt-1" />
                          <div className="text-sm">
                            <Text strong className="text-amber-800 block mb-0.5">Yêu cầu đang chờ phản hồi</Text>
                            Bạn đã gửi một lời mời. Vui lòng chờ phản hồi hoặc hủy lời mời cũ để mời người khác.
                          </div>
                        </div>
                      )}
                    </div>
                  </Card>
                )}
              </Col>

              <Col xs={24} lg={8}>
                {/* Sent Invites Sidebar */}
                {canInvite && sentInvites.length > 0 && (
                  <Card
                    title={
                      <div className="flex items-center gap-2">
                        <div className="w-1 h-4 bg-orange-400 rounded-full"></div>
                        <span className="text-slate-800 font-bold">Lời mời đã gửi</span>
                      </div>
                    }
                    className="shadow-soft border-0 mb-6"
                    size="small"
                  >
                    <List
                      dataSource={sentInvites}
                      renderItem={(invite: any) => (
                        <div className="p-2">
                          <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 mb-4">
                            <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1">HẾT HẠN LÚC</div>
                            <div className="flex items-center gap-2 text-slate-600 font-semibold">
                              <ClockCircleOutlined className="text-orange-400" />
                              {dayjs(invite.expires_at).format('HH:mm - DD/MM/YYYY')}
                            </div>
                          </div>
                          <Popconfirm
                            title="Xác nhận hủy lời mời?"
                            onConfirm={() => cancelInviteMutation.mutate(invite.id)}
                            okText="Hủy mời"
                            cancelText="Đóng"
                            okButtonProps={{ danger: true, loading: cancelInviteMutation.isPending }}
                          >
                            <Button block danger shape="round" icon={<DeleteOutlined />}>
                              Hủy lời mời
                            </Button>
                          </Popconfirm>
                        </div>
                      )}
                    />
                  </Card>
                )}

                <Card
                  title={
                    <div className="flex items-center gap-2">
                      <div className="w-1 h-4 bg-amber-400 rounded-full"></div>
                      <span className="text-slate-800 font-bold">Lưu ý quan trọng</span>
                    </div>
                  }
                  className="shadow-soft border-0 bg-white overflow-hidden"
                  size="small"
                >
                  <div className="p-3">
                    <List
                      size="small"
                      dataSource={[
                        'Lời mời kết bạn sẽ tự động hết hạn sau 48 giờ nếu không được phản hồi.',
                        'Sinh viên chỉ có thể gửi 01 lời mời tại một thời điểm.'
                      ]}
                      renderItem={item => (
                        <List.Item className="border-none p-0 mb-1.5 last:mb-0">
                          <div className="flex items-start gap-2">
                            <div className="mt-2 w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0"></div>
                            <span className="text-slate-600 text-xs leading-relaxed">{item}</span>
                          </div>
                        </List.Item>
                      )}
                    />
                  </div>
                </Card>
              </Col>
            </Row>
          )}
        </div>
      </div>
      <style dangerouslySetInnerHTML={{
        __html: `
          .topic-html-content {
            font-size: 13px;
            line-height: 1.6;
          }
          .topic-html-content p {
            margin-bottom: 8px;
          }
          .topic-html-content ul, .topic-html-content ol {
            padding-left: 20px;
            margin-bottom: 8px;
          }
          .topic-html-content ul {
            list-style-type: disc;
          }
          .topic-html-content ol {
            list-style-type: decimal;
          }
        `
      }} />
    </>
  );
};

export default MyRegisteredTopic;
