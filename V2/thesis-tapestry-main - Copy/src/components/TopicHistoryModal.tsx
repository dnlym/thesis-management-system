import { useState } from 'react';
import { Modal, Timeline, Tag, Spin, Empty, Descriptions, Card, Collapse } from 'antd';
import { HistoryOutlined, CheckCircleOutlined, CloseCircleOutlined, EditOutlined, SendOutlined, FileAddOutlined, EyeInvisibleOutlined, EyeOutlined } from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { TopicsApi } from '@/api/topics';
import dayjs from 'dayjs';

interface TopicHistoryModalProps {
    topicId: string;
    visible: boolean;
    onClose: () => void;
}

// Map action to Vietnamese and icon
const actionConfig: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
    CREATE: { label: 'Tạo đề tài', color: 'blue', icon: <FileAddOutlined /> },
    SUBMIT_FOR_APPROVAL: { label: 'Gửi duyệt', color: 'orange', icon: <SendOutlined /> },
    APPROVE: { label: 'Duyệt', color: 'green', icon: <CheckCircleOutlined /> },
    REJECT: { label: 'Từ chối', color: 'red', icon: <CloseCircleOutlined /> },
    REQUIRE_EDIT: { label: 'Yêu cầu chỉnh sửa', color: 'gold', icon: <EditOutlined /> },
    UPDATE: { label: 'Cập nhật', color: 'purple', icon: <EditOutlined /> },
    HIDE_TOPIC: { label: 'Ẩn đề tài', color: 'default', icon: <EyeInvisibleOutlined /> },
    UNHIDE_TOPIC: { label: 'Hiện đề tài', color: 'cyan', icon: <EyeOutlined /> },
    DELETE: { label: 'Xóa', color: 'red', icon: <CloseCircleOutlined /> },
};

// Map role to Vietnamese
const roleMap: Record<string, string> = {
    SUPERVISOR: 'GVHD',
    LECTURER: 'Giảng viên',
    HEAD: 'Trưởng bộ môn',
    ADMIN: 'Quản trị viên',
    STUDENT: 'Sinh viên',
    SYSTEM: 'Hệ thống',
};

// Tracked fields for content changes
const fieldLabels: Record<string, string> = {
    title: 'Tên đề tài',
    description: 'Mô tả',
    objectives: 'Mục tiêu',
    requirements: 'Yêu cầu',
};

// Strip HTML tags for clean text display
const stripHtml = (html: string) => {
    if (!html) return '';
    return html.replace(/<[^>]*>/g, '').trim();
};

// Get changed fields between old and new values
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
            color: 'default',
            icon: <HistoryOutlined />
        };

        return (
            <Timeline.Item
                key={item.id}
                color={config.color}
                dot={config.icon}
            >
                <div className="mb-2">
                    <Tag color={config.color}>{config.label}</Tag>
                    <span className="text-sm text-gray-500 ml-2">
                        {dayjs(item.timestamp).format('DD/MM/YYYY HH:mm:ss')}
                    </span>
                </div>
                <div className="text-sm">
                    <span className="font-medium">{item.performedBy}</span>
                    <span className="text-gray-500 ml-1">
                        ({roleMap[item.performedByRole] || item.performedByRole})
                    </span>
                </div>
                {item.statusChange?.from && item.statusChange?.to && (
                    <div className="text-sm text-gray-600 mt-1">
                        Trạng thái: <Tag>{item.statusChange.from}</Tag> → <Tag color="blue">{item.statusChange.to}</Tag>
                    </div>
                )}
                {item.reason && (
                    <div className="mt-2 p-2 bg-gray-50 rounded text-sm">
                        <strong>Lý do:</strong> {item.reason}
                    </div>
                )}
                {/* Content changes for UPDATE actions */}
                {item.oldValue && item.newValue && (() => {
                    const changes = getChangedFields(item.oldValue, item.newValue);
                    if (changes.length === 0) return null;
                    return (
                        <Collapse
                            size="small"
                            className="mt-2"
                            items={[{
                                key: '1',
                                label: <span className="text-xs">📝 Xem nội dung thay đổi ({changes.length} trường)</span>,
                                children: (
                                    <div className="space-y-3">
                                        {changes.map(({ field, label, oldText, newText }) => (
                                            <div key={field}>
                                                <div className="font-medium text-xs text-gray-700 mb-1">{label}:</div>
                                                <div className="text-xs p-2 bg-red-50 rounded border-l-2 border-red-300 mb-1">
                                                    <span className="text-red-600 font-medium">Trước: </span>
                                                    <span className="text-gray-700">{oldText || <em className="text-gray-400">(trống)</em>}</span>
                                                </div>
                                                <div className="text-xs p-2 bg-green-50 rounded border-l-2 border-green-300">
                                                    <span className="text-green-600 font-medium">Sau: </span>
                                                    <span className="text-gray-700">{newText || <em className="text-gray-400">(trống)</em>}</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ),
                            }]}
                        />
                    );
                })()}
            </Timeline.Item>
        );
    };

    return (
        <Modal
            centered
            title={
                <span className="flex items-center gap-2">
                    <HistoryOutlined />
                    Lịch sử duyệt đề tài
                </span>
            }
            open={visible}
            onCancel={onClose}
            footer={null}
            width={700}
        >
            {isLoading ? (
                <div className="flex justify-center py-10">
                    <Spin size="large" />
                </div>
            ) : !data ? (
                <Empty description="Không có dữ liệu lịch sử" />
            ) : (
                <div className="space-y-4">
                    {/* Topic Info */}
                    <Card size="small" className="bg-gray-50">
                        <Descriptions size="small" column={1}>
                            <Descriptions.Item label="Mã đề tài">{data.topic?.code || 'N/A'}</Descriptions.Item>
                            <Descriptions.Item label="Tên đề tài">{data.topic?.title}</Descriptions.Item>
                            <Descriptions.Item label="GVHD">{data.topic?.supervisor?.full_name}</Descriptions.Item>
                            <Descriptions.Item label="Trạng thái hiện tại">
                                <Tag color="blue">{data.topic?.currentStatus}</Tag>
                            </Descriptions.Item>
                            <Descriptions.Item label="Tổng sự kiện">
                                <Tag color="purple">{data.totalEvents} sự kiện</Tag>
                            </Descriptions.Item>
                        </Descriptions>
                    </Card>

                    {/* Timeline */}
                    <div className="max-h-96 overflow-y-auto px-2 topic-history-timeline">
                        {data.history?.length > 0 ? (
                            <Timeline mode="left">
                                {data.history.map(renderTimelineItem)}
                            </Timeline>
                        ) : (
                            <Empty description="Chưa có lịch sử" />
                        )}
                    </div>
                </div>
            )}
        </Modal>
    );
};

export default TopicHistoryModal;
