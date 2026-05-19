import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Dropdown, Badge, Button, List, Empty, Spin, Typography, Space, Tag, Modal, message } from 'antd';
import {
    BellOutlined, CheckOutlined, DeleteOutlined, CheckCircleOutlined,
    TeamOutlined, CloseCircleOutlined, InfoCircleOutlined,
    FileTextOutlined, CalendarOutlined, ExclamationCircleOutlined,
    SettingOutlined, BulbOutlined, UserAddOutlined, ClockCircleOutlined,
    TrophyOutlined, RiseOutlined
} from '@ant-design/icons';
import { useNotifications, useUnreadCount, useMarkAsRead, useMarkAllAsRead, useDeleteNotification } from '@/hooks/useNotifications';
import { RegistrationsApi } from '@/api/registrations';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import type { Notification } from '@/types';
import { useAuthStore } from '@/store/auth';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/vi';

dayjs.extend(relativeTime);
dayjs.locale('vi');

const { Text, Paragraph } = Typography;

const NotificationDropdown = () => {
    const navigate = useNavigate();
    const { user } = useAuthStore();
    const queryClient = useQueryClient();
    const [open, setOpen] = useState(false);
    const [isShowingAll, setIsShowingAll] = useState(false);
    const [inviteModalVisible, setInviteModalVisible] = useState(false);
    const [selectedInviteId, setSelectedInviteId] = useState<string | null>(null);

    // Reset showing all when closed
    useEffect(() => {
        if (!open) setIsShowingAll(false);
    }, [open]);

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

    const getNotificationIcon = (type: string) => {
        const baseClasses = "w-10 h-10 flex-shrink-0 rounded-full flex items-center justify-center text-[20px] transition-transform group-hover:scale-105 shadow-[0_2px_8px_rgba(0,0,0,0.06)]";

        // 1. Phê duyệt, Thành công
        if (type.includes('SUCCESS') || type.includes('APPROVED') || type.includes('ACCEPTED') || type.includes('CONFIRMED')) {
            return <div className={`${baseClasses} bg-gradient-to-br from-green-100 to-green-50 text-green-600 border border-green-100/50`}><CheckCircleOutlined /></div>;
        }
        // 2. Cảnh báo, Cần chỉnh sửa
        if (type.includes('WARNING') || type.includes('REQUIRE_EDIT')) {
            return <div className={`${baseClasses} bg-gradient-to-br from-orange-100 to-orange-50 text-orange-600 border border-orange-100/50`}><ExclamationCircleOutlined /></div>;
        }
        // 3. Từ chối, Lỗi
        if (type.includes('ERROR') || type.includes('REJECTED')) {
            return <div className={`${baseClasses} bg-gradient-to-br from-red-100 to-red-50 text-red-600 border border-red-100/50`}><CloseCircleOutlined /></div>;
        }
        // 4. Lời mời nhóm, Đăng ký nhóm
        if (type.includes('GROUP') || type.includes('REGISTRATION')) {
            return <div className={`${baseClasses} bg-gradient-to-br from-purple-100 to-purple-50 text-purple-600 border border-purple-100/50`}>
                {type.includes('REGISTRATION') ? <UserAddOutlined /> : <TeamOutlined />}
            </div>;
        }
        // 5. Chấm điểm, Điểm số, Đánh giá
        if (type.includes('SCORE') || type.includes('GRADE') || type.includes('EVALUATION')) {
            return <div className={`${baseClasses} bg-gradient-to-br from-yellow-100 to-yellow-50 text-yellow-600 border border-yellow-100/50`}><TrophyOutlined /></div>;
        }
        // 6. Điểm cộng (Nghiên cứu)
        if (type.includes('EXTRA_POINT')) {
            return <div className={`${baseClasses} bg-gradient-to-br from-emerald-100 to-emerald-50 text-emerald-600 border border-emerald-100/50`}><RiseOutlined /></div>;
        }
        // 7. Nhiệm vụ, Lịch trình, Nhắc nhở
        if (type.includes('SCHEDULE') || type.includes('CALENDAR') || type.includes('ASSIGNMENT') || type.includes('REMINDER')) {
            return <div className={`${baseClasses} bg-gradient-to-br from-indigo-100 to-indigo-50 text-indigo-600 border border-indigo-100/50`}>
                {type.includes('ASSIGNMENT') ? <ClockCircleOutlined /> : <CalendarOutlined />}
            </div>;
        }
        // 8. Đề tài (Khởi tạo, Submit)
        if (type.includes('TOPIC')) {
            return <div className={`${baseClasses} bg-gradient-to-br from-blue-100 to-blue-50 text-blue-600 border border-blue-100/50`}><BulbOutlined /></div>;
        }

        // Default
        return <div className={`${baseClasses} bg-gradient-to-br from-gray-100 to-gray-50 text-gray-500 border border-gray-100/50`}><BellOutlined /></div>;
    };

    const groupNotifications = (notifs: Notification[]) => {
        const today: Notification[] = [];
        const yesterday: Notification[] = [];
        const older: Notification[] = [];

        const now = dayjs();
        const startOfToday = now.startOf('day');
        const startOfYesterday = now.subtract(1, 'day').startOf('day');

        notifs.forEach(n => {
            const dateStr = n.createdAt || (n as any).created_at;
            const date = dayjs(dateStr);
            if (date.isAfter(startOfToday)) {
                today.push(n);
            } else if (date.isAfter(startOfYesterday)) {
                yesterday.push(n);
            } else {
                older.push(n);
            }
        });

        return { today, yesterday, older };
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
        const isRead = item.read !== undefined ? item.read : (item as any).is_read;
        // Mark as read first
        if (!isRead) {
            markAsRead.mutate(item.id);
        }

        const relatedId = (item as any).relatedId || (item as any).related_id;

        // Handle GROUP_INVITE type Modal
        if (item.type === 'GROUP_INVITE' && relatedId) {
            setSelectedInviteId(relatedId);
            setInviteModalVisible(true);
            setOpen(false); // Close dropdown
            return;
        }

        // Navigate based on type
        if (relatedId) {
            if (item.type.includes('TOPIC') || item.type.includes('REGISTRATION')) {
                navigate(`/topics/${relatedId}`);
            } else if (item.type.includes('GRADE_CHANGE')) {
                navigate(user?.role === 'HEAD' ? '/head/grade-changes' : `/topics/${relatedId}`);
            } else if (item.type.includes('EXTRA_POINT')) {
                navigate(user?.role === 'HEAD' ? '/head/extra-points' : '/extra-points');
            } else if (item.type.includes('ASSIGNMENT') || item.type.includes('SCORE') || item.type.includes('EVALUATION')) {
                navigate(user?.role === 'STUDENT' ? '/my-topic' : '/evaluation');
            } else if (item.type.includes('SCHEDULE') || item.type.includes('DEFENSE')) {
                navigate('/schedule');
            }
        } else {
            // Fallback for notifications without relatedId
            if (item.type.includes('TOPIC')) navigate('/topics');
            else if (item.type.includes('SCHEDULE')) navigate('/schedule');
        }

        setOpen(false); // Close dropdown
    };

    const displayedNotifications = isShowingAll ? notifications : notifications?.slice(0, 10);
    const { today, yesterday, older } = displayedNotifications ? groupNotifications(displayedNotifications) : { today: [], yesterday: [], older: [] };

    const renderNotificationGroup = (title: string, items: Notification[]) => {
        if (!items.length) return null;
        return (
            <div className="mb-2">
                <div className="sticky top-0 bg-white/95 backdrop-blur-sm z-10 px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    {title}
                </div>
                <List
                    dataSource={items}
                    className="px-2"
                    renderItem={(item: Notification) => {
                        const isRead = item.read !== undefined ? item.read : (item as any).is_read;
                        const messageContent = item.message !== undefined ? item.message : (item as any).content;
                        const createdAtDate = item.createdAt !== undefined ? item.createdAt : (item as any).created_at;
                        return (
                            <List.Item
                                className={`px-3 py-3 mb-1 cursor-pointer transition-all duration-200 relative group rounded-xl border-none
                                    ${!isRead ? 'bg-blue-50/60 hover:bg-blue-50/90' : 'bg-transparent hover:bg-gray-100/80'}
                                `}
                                onClick={() => handleNotificationClick(item)}
                            >
                                {!isRead && (
                                    <div className="absolute top-1/2 left-0.5 -translate-y-1/2 w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_0_4px_rgba(59,130,246,0.1)]" />
                                )}
                            <div className="flex gap-3.5 w-full items-start pl-1">
                                <div className="mt-0.5 shadow-sm rounded-full">
                                    {getNotificationIcon(item.type)}
                                </div>

                                <div className="flex-1 min-w-0">
                                    <div className="flex justify-between items-start gap-2">
                                        <div
                                            className={`text-[15px] leading-tight line-clamp-2 ${!isRead ? 'font-semibold text-gray-900' : 'font-medium text-gray-800'}`}
                                            title={item.title}
                                        >
                                            {item.title}
                                        </div>

                                        <div className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity flex items-center -mt-1 -mr-1 bg-white/80 backdrop-blur-sm rounded-full px-1 shadow-sm border border-gray-100">
                                            {!isRead && (
                                                <Button
                                                    type="text"
                                                    size="small"
                                                    className="text-blue-500 hover:text-blue-600 hover:bg-blue-50 w-7 h-7 flex items-center justify-center rounded-full"
                                                    icon={<CheckOutlined className="text-xs" />}
                                                    onClick={(e) => handleMarkAsRead(item.id, e)}
                                                    title="Đánh dấu đã đọc"
                                                />
                                            )}
                                            <Button
                                                type="text"
                                                size="small"
                                                className="text-gray-400 hover:text-red-500 hover:bg-red-50 w-7 h-7 flex items-center justify-center rounded-full"
                                                icon={<DeleteOutlined className="text-xs" />}
                                                onClick={(e) => handleDelete(item.id, e)}
                                                title="Xóa thông báo"
                                            />
                                        </div>
                                    </div>

                                    <div
                                        className={`text-[13px] mt-1 mb-1.5 leading-relaxed line-clamp-2 ${!isRead ? 'text-gray-600' : 'text-gray-500'}`}
                                        title={messageContent}
                                    >
                                        {messageContent}
                                    </div>

                                    <div className={`text-[12px] font-medium ${!isRead ? 'text-blue-600' : 'text-gray-400'}`}>
                                        {dayjs(createdAtDate).format('HH:mm DD/MM/YYYY')}
                                    </div>
                                </div>
                            </div>
                        </List.Item>
                        );
                    }}
                />
            </div>
        );
    };

    const dropdownContent = (
        <div
            className="dropdown-content w-[400px] max-w-[100vw] bg-white rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] border border-gray-100 overflow-hidden flex flex-col origin-top-right"
            style={{ right: 0 }}
        >
            {/* Header */}
            <div className="flex justify-between items-center px-4 py-3 border-b border-gray-100 bg-white z-20">
                <Text className="text-xl font-bold text-gray-800">Thông báo</Text>
                <Space size="small">
                    {unreadCount > 0 && (
                        <Button
                            type="text"
                            size="small"
                            className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 font-medium text-sm rounded-full px-3"
                            onClick={handleMarkAllAsRead}
                            loading={markAllAsRead.isPending}
                        >
                            Đánh dấu đã đọc
                        </Button>
                    )}
                    <Button
                        type="text"
                        size="small"
                        icon={<SettingOutlined className="text-gray-500 text-[18px]" />}
                        className="flex items-center justify-center hover:bg-gray-100 w-8 h-8 rounded-full"
                    />
                </Space>
            </div>

            {/* Content */}
            <div className="max-h-[480px] overflow-y-auto overflow-x-hidden bg-white [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-gray-200 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-gray-300 transition-colors">
                {isLoading ? (
                    <div className="flex justify-center items-center h-32">
                        <Spin />
                    </div>
                ) : !notifications || notifications.length === 0 ? (
                    <Empty
                        description="Chưa có thông báo nào"
                        className="py-12"
                        image={Empty.PRESENTED_IMAGE_SIMPLE}
                    />
                ) : (
                    <div className="py-1">
                        {renderNotificationGroup('Hôm nay', today)}
                        {renderNotificationGroup('Hôm qua', yesterday)}
                        {renderNotificationGroup('Trước đó', older)}
                    </div>
                )}
            </div>

            {/* Footer */}
            {notifications && notifications.length > 10 && !isShowingAll && (
                <div
                    className="p-3 border-t border-gray-100 bg-white text-center hover:bg-gray-50 transition-colors cursor-pointer rounded-b-2xl"
                    onClick={(e) => {
                        e.stopPropagation();
                        setIsShowingAll(true);
                    }}
                >
                    <Text className="text-blue-600 font-medium text-[15px]">
                        Xem tất cả thông báo
                    </Text>
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
                overlayClassName="notification-dropdown"
                overlayStyle={{ right: 0, paddingRight: '1rem' }}
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
