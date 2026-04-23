import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Dropdown, Badge, Button, List, Empty, Spin, Typography, Space, Tag, Modal, message } from 'antd';
import { BellOutlined, CheckOutlined, DeleteOutlined, CheckCircleOutlined, TeamOutlined, CloseCircleOutlined } from '@ant-design/icons';
import { useNotifications, useUnreadCount, useMarkAsRead, useMarkAllAsRead, useDeleteNotification } from '@/hooks/useNotifications';
import { RegistrationsApi } from '@/api/registrations';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import type { Notification } from '@/types';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/vi';

dayjs.extend(relativeTime);
dayjs.locale('vi');

const { Text, Paragraph } = Typography;

const NotificationDropdown = () => {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const [open, setOpen] = useState(false);
    const [inviteModalVisible, setInviteModalVisible] = useState(false);
    const [selectedInviteId, setSelectedInviteId] = useState<string | null>(null);

    const { data: notifications, isLoading } = useNotifications();
    const { data: unreadData } = useUnreadCount();
    const markAsRead = useMarkAsRead();
    const markAllAsRead = useMarkAllAsRead();
    const deleteNotification = useDeleteNotification();

    // Fetch invite details when modal opens
    const { data: invitesData } = useQuery({
        queryKey: ['my-invites'],
        queryFn: () => RegistrationsApi.getMyInvites(),
        enabled: inviteModalVisible,
    });

    // Find the selected invite from received invites
    const selectedInvite = invitesData?.receivedInvites?.find(
        (inv: any) => inv.id === selectedInviteId
    );

    const unreadCount = unreadData?.count || 0;

    // Accept invite mutation
    const acceptInviteMutation = useMutation({
        mutationFn: (inviteId: string) => RegistrationsApi.acceptInvite(inviteId),
        onSuccess: () => {
            message.success('Đã chấp nhận lời mời! Nhóm đã được tạo.');
            setInviteModalVisible(false);
            setSelectedInviteId(null);
            queryClient.invalidateQueries({ queryKey: ['my-invites'] });
            queryClient.invalidateQueries({ queryKey: ['notifications'] });
            queryClient.invalidateQueries({ queryKey: ['my-topic'] });
            // Navigate to group management page
            navigate('/my-topic');
        },
        onError: (error: any) => {
            message.error(error?.response?.data?.message || 'Không thể chấp nhận lời mời');
        },
    });

    // Reject invite mutation
    const rejectInviteMutation = useMutation({
        mutationFn: (inviteId: string) => RegistrationsApi.rejectInvite(inviteId),
        onSuccess: () => {
            message.success('Đã từ chối lời mời');
            setInviteModalVisible(false);
            setSelectedInviteId(null);
            queryClient.invalidateQueries({ queryKey: ['my-invites'] });
            queryClient.invalidateQueries({ queryKey: ['notifications'] });
            // Stay on current page, don't navigate
        },
        onError: (error: any) => {
            message.error(error?.response?.data?.message || 'Không thể từ chối lời mời');
        },
    });

    const getTypeColor = (type: string) => {
        switch (type) {
            case 'SUCCESS':
            case 'GROUP_INVITE_ACCEPTED':
                return 'green';
            case 'WARNING':
            case 'GROUP_INVITE_REJECTED':
                return 'orange';
            case 'ERROR':
                return 'red';
            case 'GROUP_INVITE':
                return 'purple';
            default:
                return 'blue';
        }
    };

    const handleMarkAsRead = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        markAsRead.mutate(id);
    };

    const handleDelete = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        deleteNotification.mutate(id);
    };

    const handleMarkAllAsRead = () => {
        markAllAsRead.mutate();
    };

    const handleNotificationClick = (item: Notification) => {
        // Mark as read first
        if (!item.read) {
            markAsRead.mutate(item.id);
        }

        // Handle GROUP_INVITE type
        // Check both camelCase and snake_case for related_id
        const relatedId = (item as any).relatedId || (item as any).related_id;
        if (item.type === 'GROUP_INVITE' && relatedId) {
            setSelectedInviteId(relatedId);
            setInviteModalVisible(true);
            setOpen(false); // Close dropdown
        }
    };

    const dropdownContent = (
        <div className="w-96 max-h-[500px] bg-white rounded-lg shadow-lg border overflow-hidden">
            {/* Header */}
            <div className="flex justify-between items-center p-4 border-b bg-gray-50">
                <Text strong className="text-lg">Thông báo</Text>
                {unreadCount > 0 && (
                    <Button
                        type="link"
                        size="small"
                        icon={<CheckCircleOutlined />}
                        onClick={handleMarkAllAsRead}
                        loading={markAllAsRead.isPending}
                    >
                        Đánh dấu tất cả đã đọc
                    </Button>
                )}
            </div>

            {/* Content */}
            <div className="max-h-[400px] overflow-y-auto">
                {isLoading ? (
                    <div className="flex justify-center items-center h-32">
                        <Spin />
                    </div>
                ) : !notifications || notifications.length === 0 ? (
                    <Empty
                        description="Không có thông báo"
                        className="py-8"
                        image={Empty.PRESENTED_IMAGE_SIMPLE}
                    />
                ) : (
                    <List
                        dataSource={notifications}
                        renderItem={(item: Notification) => (
                            <List.Item
                                className={`px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors ${!item.read ? 'bg-blue-50' : ''
                                    }`}
                                onClick={() => handleNotificationClick(item)}
                                actions={[
                                    !item.read && (
                                        <Button
                                            type="text"
                                            size="small"
                                            icon={<CheckOutlined />}
                                            onClick={(e) => handleMarkAsRead(item.id, e)}
                                            title="Đánh dấu đã đọc"
                                        />
                                    ),
                                    <Button
                                        type="text"
                                        size="small"
                                        danger
                                        icon={<DeleteOutlined />}
                                        onClick={(e) => handleDelete(item.id, e)}
                                        title="Xóa thông báo"
                                    />,
                                ].filter(Boolean)}
                            >
                                <List.Item.Meta
                                    title={
                                        <Space>
                                            <Tag color={getTypeColor(item.type)} className="m-0">
                                                {item.type}
                                            </Tag>
                                            <Text strong={!item.read}>{item.title}</Text>
                                        </Space>
                                    }
                                    description={
                                        <div>
                                            <Paragraph
                                                ellipsis={{ rows: 2 }}
                                                className="mb-1 text-gray-600"
                                            >
                                                {item.message}
                                            </Paragraph>
                                            <Text type="secondary" className="text-xs">
                                                {dayjs(item.createdAt).fromNow()}
                                            </Text>
                                        </div>
                                    }
                                />
                            </List.Item>
                        )}
                    />
                )}
            </div>

            {/* Footer */}
            {notifications && notifications.length > 0 && (
                <div className="p-2 border-t bg-gray-50 text-center">
                    <Button type="link" size="small">
                        Xem tất cả thông báo
                    </Button>
                </div>
            )}
        </div>
    );

    return (
        <>
            <Dropdown
                popupRender={() => dropdownContent}
                trigger={['click']}
                open={open}
                onOpenChange={setOpen}
                placement="bottomRight"
            >
                <Badge count={unreadCount} overflowCount={99}>
                    <Button
                        type="text"
                        icon={<BellOutlined className="text-lg" />}
                        className="flex items-center justify-center"
                    />
                </Badge>
            </Dropdown>

            {/* Group Invite Modal */}
            <Modal
                title={
                    <Space>
                        <TeamOutlined className="text-purple-500" />
                        <span>Lời mời vào nhóm</span>
                    </Space>
                }
                open={inviteModalVisible}
                onCancel={() => {
                    setInviteModalVisible(false);
                    setSelectedInviteId(null);
                }}
                footer={null}
                width={480}
            >
                {selectedInvite ? (
                    <div className="space-y-4">
                        {/* Topic Info */}
                        <div className="p-4 bg-gray-50 rounded-lg">
                            <Text type="secondary" className="text-xs">Đề tài</Text>
                            <div className="font-semibold text-lg text-primary mt-1">
                                {selectedInvite.topic?.title || 'Không xác định'}
                            </div>
                            {selectedInvite.topic?.code && (
                                <Tag color="blue" className="mt-2">{selectedInvite.topic.code}</Tag>
                            )}
                        </div>

                        {/* Inviter Info */}
                        <div className="p-4 bg-blue-50 rounded-lg">
                            <Text type="secondary" className="text-xs">Người mời</Text>
                            <div className="flex items-center gap-3 mt-2">
                                <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center text-white font-bold">
                                    {selectedInvite.inviter?.full_name?.charAt(0) || '?'}
                                </div>
                                <div>
                                    <div className="font-medium">{selectedInvite.inviter?.full_name || 'Ẩn danh'}</div>
                                    <div className="text-sm text-gray-500">
                                        {selectedInvite.inviter?.student_code || ''}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Expiry Info */}
                        <div className="text-center text-sm text-gray-500">
                            <span>Lời mời hết hạn: </span>
                            <span className="font-medium">
                                {dayjs(selectedInvite.expires_at).format('DD/MM/YYYY HH:mm')}
                            </span>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex gap-3 pt-4">
                            <Button
                                type="primary"
                                size="large"
                                block
                                icon={<CheckCircleOutlined />}
                                onClick={() => acceptInviteMutation.mutate(selectedInvite.id)}
                                loading={acceptInviteMutation.isPending}
                                className="bg-green-500 hover:bg-green-600 border-green-500"
                            >
                                Chấp nhận
                            </Button>
                            <Button
                                danger
                                size="large"
                                block
                                icon={<CloseCircleOutlined />}
                                onClick={() => rejectInviteMutation.mutate(selectedInvite.id)}
                                loading={rejectInviteMutation.isPending}
                            >
                                Từ chối
                            </Button>
                        </div>
                    </div>
                ) : (
                    <div className="text-center py-8">
                        <Spin />
                        <div className="mt-2 text-gray-500">Đang tải thông tin lời mời...</div>
                    </div>
                )}
            </Modal>
        </>
    );
};

export default NotificationDropdown;
