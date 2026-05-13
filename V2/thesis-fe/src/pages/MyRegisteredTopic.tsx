import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMyTopicRegistration, useStudentsSameTopic } from '@/hooks/useRegistrations';
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
  UserDeleteOutlined
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
                {group && (
                  <Popconfirm
                    title="Xác nhận giải tán nhóm?"
                    description="Hành động này sẽ đưa bạn và các thành viên khác về trạng thái làm việc cá nhân."
                    onConfirm={() => disbandGroupMutation.mutate()}
                    okText="Giải tán"
                    cancelText="Hủy"
                    okButtonProps={{ danger: true, loading: disbandGroupMutation.isPending }}
                    disabled={isPhaseLocked}
                  >
                    <Tooltip title={isPhaseLocked ? "Không thể giải tán nhóm trong giai đoạn thực hiện khóa luận" : ""}>
                      <Button danger icon={<DeleteOutlined />} disabled={isPhaseLocked}>
                        Giải tán nhóm
                      </Button>
                    </Tooltip>
                  </Popconfirm>
                )}
              </div>
            </div>
          </Card>

          {/* Topic Info Card */}
          <Card className="shadow-soft border-0 mb-6 overflow-hidden">
            <div className="absolute top-0 right-0 p-4 flex gap-2">
              {myRegistration.midterm_status === 'PASS' && (
                <Badge count="Đã đạt Giữa kỳ" style={{ backgroundColor: '#52c41a' }} />
              )}
              {myRegistration.midterm_status === 'FAIL' && (
                <Badge count="Không đạt Giữa kỳ" style={{ backgroundColor: '#ff4d4f' }} />
              )}
            </div>

            <div className="flex items-center gap-2 mb-4">
              <div className="w-1 h-5 bg-blue-500 rounded-full"></div>
              <span className="text-slate-800 font-bold">Thông tin đề tài đăng ký</span>
            </div>

            {myRegistration.midterm_status === 'FAIL' && (
              <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-xl flex items-start gap-3 animate-in slide-in-from-top duration-500">
                <CloseCircleOutlined className="text-red-500 mt-1 text-lg" />
                <div>
                  <Text strong className="text-red-700 block text-base">Bạn không đạt đánh giá giữa kỳ</Text>
                  <Text className="text-red-600 text-sm">
                    Rất tiếc, dựa trên đánh giá của Giảng viên hướng dẫn, bạn không đủ điều kiện để tiếp tục thực hiện khóa luận tốt nghiệp trong học kỳ này.
                  </Text>
                  {myRegistration.midterm_feedback && (
                    <div className="mt-2 p-2 bg-white/50 rounded border border-red-50 italic text-red-500 text-xs">
                      Phản hồi: {myRegistration.midterm_feedback}
                    </div>
                  )}
                </div>
              </div>
            )}

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
                  className="topic-html-content text-slate-600 py-1"
                  dangerouslySetInnerHTML={{ __html: topic?.description || 'Chưa có mô tả' }}
                />
              </Descriptions.Item>
              {topic?.objectives && (
                <Descriptions.Item label="Mục tiêu" span={2}>
                  <div
                    className="topic-html-content text-slate-600 py-1"
                    dangerouslySetInnerHTML={{ __html: topic.objectives }}
                  />
                </Descriptions.Item>
              )}
              {topic?.requirements && (
                <Descriptions.Item label="Yêu cầu sinh viên" span={2}>
                  <div
                    className="topic-html-content text-slate-600 py-1"
                    dangerouslySetInnerHTML={{ __html: topic.requirements }}
                  />
                </Descriptions.Item>
              )}
            </Descriptions>
          </Card>

          {myRegistration.midterm_status !== 'FAIL' && (
            <Row gutter={[24, 24]}>
              <Col xs={24} lg={16}>
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
                    renderItem={(member: any) => (
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
                            <Space>
                              <Text strong className="text-slate-700">{member.user?.full_name}</Text>
                              {member.user_id === group.leader_id && (
                                <Tag color="gold" className="m-0 text-[11px]">Trưởng nhóm</Tag>
                              )}
                            </Space>
                          }
                          description={<span className="text-slate-400">{member.user?.student_code} • {member.user?.email}</span>}
                        />
                      </List.Item>
                    )}
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
                      <Space.Compact style={{ width: '100%' }}>
                        <Input 
                          placeholder="Nhập mã sinh viên (VD: 2012345)" 
                          id="student-search-input"
                          style={{ height: 32 }}
                          disabled={sentInvites.length > 0 || searchLoading}
                          onPressEnter={(e: any) => handleSearch(e.target.value)}
                        />
                        <Button 
                          type="primary" 
                          style={{ height: 32, backgroundColor: '#2563eb', border: 'none' }}
                          className="px-6"
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
