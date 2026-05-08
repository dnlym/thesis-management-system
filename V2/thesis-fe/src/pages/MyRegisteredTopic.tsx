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
    const isSoloGroup = hasGroup && memberCount === 1;
    const isLeader = hasGroup && myRegistration?.group?.leader_id === currentUser?.id;

    // Fetch my invites
    const { data: invitesData, refetch: refetchInvites } = useQuery({
        queryKey: ['my-invites', topicId],
        queryFn: () => RegistrationsApi.getMyInvites(topicId),
        enabled: !!topicId && isSoloGroup,
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
            <Card className="shadow-soft overflow-hidden border-0">
                <div className="flex items-center gap-2 mb-2">
                  {myRegistration.midterm_status === 'PASS' && (
                    <Tag color="success">Đã đạt Giữa kỳ</Tag>
                  )}
                </div>
                
                <Title level={4} className="mb-6 mt-0 text-gray-800">
                    {topic?.title}
                </Title>
                
                <Descriptions 
                    bordered 
                    column={{ xxl: 2, xl: 2, lg: 2, md: 1, sm: 1, xs: 1 }}
                >
                    <Descriptions.Item label="Giảng viên hướng dẫn">
                        <Space>
                            <Avatar size="small" src={topic?.supervisor?.avatar_url} icon={<UserOutlined />} />
                            {topic?.supervisor?.full_name}
                        </Space>
                    </Descriptions.Item>
                    <Descriptions.Item label="Email Giảng viên">
                        <Space>
                            <MailOutlined className="text-blue-500" />
                            {topic?.supervisor?.email || 'N/A'}
                        </Space>
                    </Descriptions.Item>
                    <Descriptions.Item label="Ngày đăng ký">
                        <Space>
                            <ClockCircleOutlined className="text-gray-400" />
                            {dayjs(myRegistration.registered_at).format('DD/MM/YYYY')}
                        </Space>
                    </Descriptions.Item>
                    <Descriptions.Item label="Số SV tối đa">
                        <Space>
                            <UserOutlined className="text-blue-500" />
                            <Text strong>{topic?.max_students || 2} sinh viên</Text>
                        </Space>
                    </Descriptions.Item>
                    <Descriptions.Item label="Mã nhóm">
                        <Space>
                            <TeamOutlined className="text-blue-500" />
                            {group ? (
                                <Text strong className="text-blue-600">{group.name}</Text>
                            ) : (
                                <Text type="secondary" italic>Chưa lập nhóm</Text>
                            )}
                        </Space>
                    </Descriptions.Item>
                    <Descriptions.Item label="Mô tả đề tài" span={2}>
                        <div 
                            className="topic-html-content text-gray-600"
                            dangerouslySetInnerHTML={{ __html: topic?.description || 'Chưa có mô tả' }} 
                        />
                    </Descriptions.Item>
                    {topic?.objectives && (
                        <Descriptions.Item label="Mục tiêu" span={2}>
                            <div 
                                className="topic-html-content text-gray-600"
                                dangerouslySetInnerHTML={{ __html: topic.objectives }} 
                            />
                        </Descriptions.Item>
                    )}
                    {topic?.requirements && (
                        <Descriptions.Item label="Yêu cầu sinh viên" span={2}>
                            <div 
                                className="topic-html-content text-gray-600"
                                dangerouslySetInnerHTML={{ __html: topic.requirements }} 
                            />
                        </Descriptions.Item>
                    )}
                </Descriptions>
            </Card>

            <Row gutter={[24, 24]}>
              <Col xs={24} lg={16}>
                {/* Group Members List */}
                {hasGroup && (
                  <Card 
                    title={<Space><TeamOutlined />Thành viên nhóm</Space>} 
                    className="shadow-soft border-0"

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
                            avatar={<Avatar size={48} src={member.user?.avatar_url} icon={<UserOutlined />} />}
                            title={
                              <Space>
                                <Text strong>{member.user?.full_name}</Text>
                                {member.user_id === group.leader_id && (
                                  <Tag color="gold">Trưởng nhóm</Tag>
                                )}
                              </Space>
                            }
                            description={`MSSV: ${member.user?.student_code} • ${member.user?.email}`}
                          />
                          <Tag color="success">Đã tham gia</Tag>
                        </List.Item>
                      )}
                    />
                  </Card>
                )}

                {/* Received Invites */}
                {isSoloGroup && receivedInvites.length > 0 && (
                  <Card 
                    title={<Space><MailOutlined />Lời mời đồng hành</Space>} 
                    className="shadow-soft border-0 bg-blue-50"
                    extra={<Badge count={receivedInvites.length} />}
                  >
                    <List
                      dataSource={receivedInvites}
                      renderItem={(invite: any) => (
                        <List.Item
                          className="bg-white p-4 rounded mb-2 shadow-sm"
                          actions={[
                            <Button 
                                type="primary" 
                                size="small" 
                                icon={<CheckCircleOutlined />}
                                onClick={() => acceptInviteMutation.mutate(invite.id)}
                                loading={acceptInviteMutation.isPending}
                            >
                              Đồng ý
                            </Button>,
                            <Button 
                                danger 
                                size="small" 
                                icon={<CloseCircleOutlined />}
                                onClick={() => rejectInviteMutation.mutate(invite.id)}
                                loading={rejectInviteMutation.isPending}
                            >
                              Từ chối
                            </Button>
                          ]}
                        >
                          <List.Item.Meta
                            avatar={<Avatar src={invite.inviter?.avatar_url} icon={<UserOutlined />} />}
                            title={invite.inviter?.full_name}
                            description={
                                <Space>
                                    <ClockCircleOutlined />
                                    Hết hạn: {dayjs(invite.expires_at).format('DD/MM/YYYY HH:mm')}
                                </Space>
                            }
                          />
                        </List.Item>
                      )}
                    />
                  </Card>
                )}

                {isSoloGroup && (
                  <Card title={<Space><SearchOutlined />Tìm bạn cùng nhóm</Space>} className="shadow-soft border-0">
                    <Paragraph type="secondary">
                        Nhập mã sinh viên của người bạn muốn đồng hành hoặc chọn từ danh sách bên dưới.
                    </Paragraph>
                    
                    <div className="max-w-md mb-8">
                      <Search
                        placeholder="Mã sinh viên (VD: 2012345)"
                        enterButton="Tìm kiếm"
                        size="large"
                        loading={searchLoading}
                        onSearch={handleSearch}
                        disabled={sentInvites.length > 0}
                      />
                    </div>

                    {searchResult && (
                      <div className="mb-8 p-4 border rounded bg-blue-50 border-blue-100 flex justify-between items-center transition-all">
                        <Space direction="vertical" size={0}>
                          <Text strong>{searchResult.full_name}</Text>
                          <Text type="secondary">{searchResult.student_code} • {searchResult.email}</Text>
                        </Space>
                        <Button 
                            type="primary" 
                            icon={<SendOutlined />}
                            onClick={() => sendInviteMutation.mutate(searchResult.student_code)}
                            loading={sendInviteMutation.isPending}
                            disabled={sentInvites.length > 0}
                        >
                          Mời ngay
                        </Button>
                      </div>
                    )}


                    {sentInvites.length > 0 && (
                      <div className="mt-4 p-3 bg-orange-50 border border-orange-100 rounded text-orange-700 text-sm flex gap-2">
                        <InfoCircleOutlined className="mt-1" />
                        <Text type="warning">Bạn đang có một lời mời chờ phản hồi. Vui lòng hủy lời mời cũ nếu muốn mời thành viên khác.</Text>
                      </div>
                    )}
                  </Card>
                )}
              </Col>

              <Col xs={24} lg={8}>
                {/* Sent Invites Sidebar */}
                {isSoloGroup && sentInvites.length > 0 && (
                  <Card title={<Space><SendOutlined />Lời mời đã gửi</Space>} className="shadow-soft border-0 mb-6">
                    <List
                      dataSource={sentInvites}
                      renderItem={(invite: any) => (
                        <div className="space-y-4">
                          <div className="bg-gray-100 p-2 rounded text-xs">
                             <Text type="secondary" strong style={{ fontSize: '10px', textTransform: 'uppercase', display: 'block' }}>HẾT HẠN LÚC:</Text>
                             <div className="flex items-center gap-1">
                                <ClockCircleOutlined />
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
                            <Button block danger icon={<DeleteOutlined />}>
                                Hủy lời mời
                            </Button>
                          </Popconfirm>
                        </div>
                      )}
                    />
                  </Card>
                )}

                <Card title={<Space><InfoCircleOutlined />Lưu ý quan trọng</Space>} className="shadow-soft border-0 bg-gray-50">
                  <List
                    size="small"
                    dataSource={[
                        '• Nhóm tối đa cho đề tài này là 2 sinh viên.',
                        '• Sau khi lập nhóm, bạn sẽ không thể tự ý rời nhóm.',
                        '• Lời mời sẽ tự động hết hạn sau 48 giờ.'
                    ]}
                    renderItem={item => <List.Item style={{ border: 'none', padding: '4px 0', fontSize: '12px' }}>{item}</List.Item>}
                  />
                </Card>
              </Col>
            </Row>


            </div>
        </div>
      <style dangerouslySetInnerHTML={{
        __html: `
          .topic-html-content {
            font-size: 14px;
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
