import { Modal, Timeline, Tag, Spin, Empty, Card, Collapse, Typography, Space, Divider } from 'antd';
import { 
    HistoryOutlined, 
    CheckCircleFilled, 
    CloseCircleFilled, 
    EditFilled, 
    SendOutlined, 
    FileAddFilled, 
    EyeInvisibleFilled, 
    EyeFilled,
    TagOutlined,
    BookOutlined,
    UserOutlined,
    FlagOutlined,
    CalendarOutlined
} from '@ant-design/icons';
import { TopicStatusBadge } from '@/components/StatusBadge';
import { useQuery } from '@tanstack/react-query';
import { TopicsApi } from '@/api/topics';
import dayjs from 'dayjs';

const { Text } = Typography;

interface TopicHistoryModalProps {
    topicId: string;
    visible: boolean;
    onClose: () => void;
}

// Map action to Vietnamese, color and icon
const actionConfig: Record<string, { label: string; color: string; icon: React.ReactNode; bgColor: string; borderColor: string }> = {
    CREATE: { 
        label: 'Tạo đề tài', 
        color: '#1890ff', 
        icon: <FileAddFilled />,
        bgColor: '#e6f7ff',
        borderColor: '#91d5ff'
    },
    SUBMIT_FOR_APPROVAL: { 
        label: 'Gửi duyệt', 
        color: '#fa8c16', 
        icon: <SendOutlined rotate={-45} />,
        bgColor: '#fff7e6',
        borderColor: '#ffd591'
    },
    APPROVE: { 
        label: 'Duyệt', 
        color: '#52c41a', 
        icon: <CheckCircleFilled />,
        bgColor: '#f6ffed',
        borderColor: '#b7eb8f'
    },
    REJECT: { 
        label: 'Từ chối', 
        color: '#ff4d4f', 
        icon: <CloseCircleFilled />,
        bgColor: '#fff1f0',
        borderColor: '#ffa39e'
    },
    REQUIRE_EDIT: { 
        label: 'Yêu cầu sửa', 
        color: '#faad14', 
        icon: <EditFilled />,
        bgColor: '#fffbe6',
        borderColor: '#ffe58f'
    },
    UPDATE: { 
        label: 'Cập nhật', 
        color: '#722ed1', 
        icon: <EditFilled />,
        bgColor: '#f9f0ff',
        borderColor: '#d3adf7'
    },
    HIDE_TOPIC: { 
        label: 'Ẩn đề tài', 
        color: '#8c8c8c', 
        icon: <EyeInvisibleFilled />,
        bgColor: '#f5f5f5',
        borderColor: '#d9d9d9'
    },
    UNHIDE_TOPIC: { 
        label: 'Hiện đề tài', 
        color: '#13c2c2', 
        icon: <EyeFilled />,
        bgColor: '#e6fffb',
        borderColor: '#87e8de'
    },
    DELETE: { 
        label: 'Xóa', 
        color: '#ff4d4f', 
        icon: <CloseCircleFilled />,
        bgColor: '#fff1f0',
        borderColor: '#ffa39e'
    },
};

const roleMap: Record<string, string> = {
    SUPERVISOR: 'GVHD',
    LECTURER: 'Giảng viên',
    HEAD: 'Trưởng bộ môn',
    ADMIN: 'Quản trị viên',
    STUDENT: 'Sinh viên',
    SYSTEM: 'Hệ thống',
};

const fieldLabels: Record<string, string> = {
    title: 'Tên đề tài',
    description: 'Mô tả',
    objectives: 'Mục tiêu',
    requirements: 'Yêu cầu',
};

const stripHtml = (html: string) => {
    if (!html) return '';
    return html.replace(/<[^>]*>/g, '').trim();
};

const getChangedFields = (oldVal: any, newVal: any) => {
    if (!oldVal || !newVal) return [];
    const changes: { field: string; label: string; oldText: string; newText: string }[] = [];
    for (const [key, label] of Object.entries(fieldLabels)) {
        const oldText = stripHtml(oldVal[key] || '');
        const newText = stripHtml(newVal[key] || '');
        if (oldText !== newText) {
            changes.push({ field: key, label, oldText, newText });
        }
    }
    return changes;
};

const TopicHistoryModal = ({ topicId, visible, onClose }: TopicHistoryModalProps) => {
    const { data, isLoading } = useQuery({
        queryKey: ['topic-history', topicId],
        queryFn: () => TopicsApi.getHistory(topicId),
        enabled: visible && !!topicId,
    });

    const renderTimelineItem = (item: any) => {
        const config = actionConfig[item.action] || {
            label: item.action,
            color: '#bfbfbf',
            icon: <HistoryOutlined />,
            bgColor: '#fafafa',
            borderColor: '#f0f0f0'
        };

        return (
            <Timeline.Item
                key={item.id}
                dot={
                    <div style={{ 
                        backgroundColor: config.color, 
                        color: '#white', 
                        borderRadius: '50%', 
                        width: 32, 
                        height: 32, 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center',
                        fontSize: 16,
                        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                        border: '2px solid #fff'
                    }}>
                        <span style={{ color: '#fff', display: 'flex' }}>{config.icon}</span>
                    </div>
                }
            >
                <div 
                    className="font-sans"
                    style={{ 
                        marginLeft: 12, 
                        marginBottom: 12,
                        padding: '12px 16px',
                        borderRadius: 12,
                        backgroundColor: config.bgColor,
                        border: `1px solid ${config.borderColor}`,
                        boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                        position: 'relative'
                    }}
                >
                    <div className="flex justify-between items-center mb-2">
                        <Space size="middle">
                            <Tag color={config.color} style={{ borderRadius: 6, fontWeight: 500, padding: '2px 10px' }}>
                                {config.label}
                            </Tag>
                            <Text strong style={{ fontSize: 14 }}>
                                {item.performedBy} 
                                <Text type="secondary" style={{ fontWeight: 'normal', marginLeft: 4, fontSize: 13 }}>
                                    ({roleMap[item.performedByRole] || item.performedByRole})
                                </Text>
                            </Text>
                        </Space>
                        <Text type="secondary" style={{ fontSize: 13 }}>
                            {dayjs(item.timestamp).format('DD/MM/YYYY HH:mm:ss')}
                        </Text>
                    </div>

                    <div className="flex items-center gap-2 mb-1">
                        <Text type="secondary" style={{ fontSize: 14 }}>Trạng thái:</Text>
                        <i className="fas fa-arrow-right text-xs text-gray-400 mx-1" />
                        <TopicStatusBadge status={item.statusChange.to} />
                    </div>

                    {item.reason && (
                        <div style={{ 
                            marginTop: 8, 
                            padding: '8px 12px', 
                            backgroundColor: 'rgba(0,0,0,0.03)', 
                            borderRadius: 8,
                            borderLeft: `3px solid ${config.color}`,
                            fontSize: 14
                        }}>
                            <Text strong style={{ marginRight: 8 }}>Lý do:</Text> 
                            <Text>{item.reason}</Text>
                        </div>
                    )}

                    {/* Content changes logic */}
                    {item.oldValue && item.newValue && (() => {
                        const changes = getChangedFields(item.oldValue, item.newValue);
                        if (changes.length === 0) return null;
                        return (
                            <Collapse
                                ghost
                                size="small"
                                className="mt-2 bg-white bg-opacity-50 rounded-lg"
                                items={[{
                                    key: '1',
                                    label: <Text strong style={{ fontSize: 12, color: config.color }}>
                                        📝 Xem chi tiết thay đổi ({changes.length} trường)
                                    </Text>,
                                    children: (
                                        <div className="space-y-3 py-1">
                                            {changes.map(({ field, label, oldText, newText }) => (
                                                <div key={field} className="border-b border-gray-100 last:border-0 pb-2 last:pb-0">
                                                    <div className="font-medium text-xs text-gray-700 mb-1">{label}:</div>
                                                    <div className="grid grid-cols-1 gap-1">
                                                        <div className="text-xs p-1.5 bg-red-50 bg-opacity-70 rounded border-l-2 border-red-300">
                                                            <Text type="danger" strong>Trước: </Text>
                                                            <span className="text-gray-600 italic">{oldText || '(trống)'}</span>
                                                        </div>
                                                        <div className="text-xs p-1.5 bg-green-50 bg-opacity-70 rounded border-l-2 border-green-300">
                                                            <Text type="success" strong>Sau: </Text>
                                                            <span className="text-gray-800">{newText || '(trống)'}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ),
                                }]}
                            />
                        );
                    })()}
                </div>
            </Timeline.Item>
        );
    };

    return (
        <Modal
            centered
            title={
                <Space>
                    <HistoryOutlined style={{ color: '#1890ff' }} />
                    <span style={{ fontSize: 18, fontWeight: 600 }}>Lịch sử duyệt đề tài</span>
                </Space>
            }
            open={visible}
            onCancel={onClose}
            footer={null}
            width={900}
            bodyStyle={{ padding: '24px' }}
            className="premium-history-modal font-sans"
        >
            <Divider style={{ margin: '0 0 24px 0' }} />

            {isLoading ? (
                <div className="flex flex-col items-center justify-center py-20">
                    <Spin size="large" />
                    <Text type="secondary" className="mt-4">Đang tải dữ liệu lịch sử...</Text>
                </div>
            ) : !data ? (
                <Empty description="Không có dữ liệu lịch sử" className="py-10" />
            ) : (
                <div className="space-y-6">
                    {/* Header Info Panel */}
                    <Card 
                        size="small" 
                        bordered={false} 
                        style={{ 
                            backgroundColor: '#fff', 
                            borderRadius: 16,
                            boxShadow: '0 4px 20px rgba(0,0,0,0.06)',
                            border: '1px solid #f0f2f5'
                        }}
                    >
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-y-3 gap-x-8 p-2">
                            <div className="space-y-2">
                                <div className="flex items-center gap-3">
                                    <TagOutlined style={{ color: '#8c8c8c' }} />
                                    <Text type="secondary" style={{ width: 80 }}>Mã đề tài:</Text>
                                    <Text strong>{data.topic?.code || 'N/A'}</Text>
                                </div>
                                <div className="flex items-start gap-3">
                                    <BookOutlined style={{ color: '#8c8c8c', marginTop: 4 }} />
                                    <Text type="secondary" style={{ width: 80 }}>Tên đề tài:</Text>
                                    <Text strong style={{ flex: 1 }}>{data.topic?.title}</Text>
                                </div>
                                <div className="flex items-center gap-3">
                                    <UserOutlined style={{ color: '#8c8c8c' }} />
                                    <Text type="secondary" style={{ width: 80 }}>GVHD:</Text>
                                    <Text strong>{data.topic?.supervisor?.full_name}</Text>
                                </div>
                            </div>
                            <div className="space-y-2 md:pl-8 md:border-l border-gray-100">
                                <div className="flex items-center gap-3">
                                    <FlagOutlined style={{ color: '#8c8c8c' }} />
                                    <Text type="secondary" style={{ width: 150 }}>Trạng thái hiện tại:</Text>
                                    <TopicStatusBadge status={data.topic?.currentStatus} />
                                </div>
                                <div className="flex items-center gap-3">
                                    <CalendarOutlined style={{ color: '#8c8c8c' }} />
                                    <Text type="secondary" style={{ width: 150 }}>Tổng sự kiện:</Text>
                                    <Tag color="purple" style={{ borderRadius: 10, padding: '0 12px' }}>
                                        {data.totalEvents} sự kiện
                                    </Tag>
                                </div>
                            </div>
                        </div>
                    </Card>

                    {/* Timeline Container */}
                    <div className="max-h-[400px] overflow-y-auto px-4 py-2 topic-history-timeline scrollbar-hide">
                        {data.history?.length > 0 ? (
                            <Timeline 
                                mode="left" 
                                style={{ marginTop: 10 }}
                            >
                                {data.history.map(renderTimelineItem)}
                            </Timeline>
                        ) : (
                            <Empty description="Chưa có dữ liệu thay đổi nào" />
                        )}
                    </div>
                </div>
            )}
        </Modal>
    );
};

export default TopicHistoryModal;
