import { useState } from 'react';
import { Calendar, Card, Badge, Modal, Form, Input, DatePicker, TimePicker, Select, Button, List, Spin, Alert, Tag, Popover } from 'antd';
import { useTranslation } from 'react-i18next';
import { CalendarOutlined, PlusOutlined, ClockCircleOutlined } from '@ant-design/icons';
import type { Dayjs } from 'dayjs';
import dayjs from 'dayjs';
import { useDefenseSchedules } from '@/hooks/useDefense';
import { DefenseSchedule } from '@/api/defense';

const Schedule = () => {
    const { t } = useTranslation();
    const [isModalVisible, setIsModalVisible] = useState(false);
    const [selectedDate, setSelectedDate] = useState<Dayjs | null>(dayjs());
    const [form] = Form.useForm();

    const { data: schedules, isLoading, error } = useDefenseSchedules();

    if (isLoading) {
        return <div className="flex justify-center items-center h-screen"><Spin size="large" /></div>;
    }

    if (error) {
        return <div className="p-6"><Alert message="Error loading schedule data" type="error" showIcon /></div>;
    }

    const events = schedules || [];

    const getListData = (value: Dayjs) => {
        const dateStr = value.format('YYYY-MM-DD');
        return events.filter((event: DefenseSchedule) => dayjs(event.date).format('YYYY-MM-DD') === dateStr);
    };

    const dateCellRender = (value: Dayjs) => {
        const listData = getListData(value);
        return (
            <div className="space-y-1 overflow-hidden">
                {listData.map((item: DefenseSchedule) => {
                    let bgColor = 'rgba(59, 130, 246, 0.08)';
                    let textColor = '#2563eb';
                    let borderColor = 'rgba(59, 130, 246, 0.2)';
                    if (item.type === 'DEFENSE') {
                        bgColor = 'rgba(249, 115, 22, 0.08)';
                        textColor = '#ea580c';
                        borderColor = 'rgba(249, 115, 22, 0.2)';
                    } else if (item.type === 'COUNCIL_MEETING') {
                        bgColor = 'rgba(139, 92, 246, 0.08)';
                        textColor = '#7c3aed';
                        borderColor = 'rgba(139, 92, 246, 0.2)';
                    }
                    return (
                        <div
                            key={item.id}
                            style={{
                                backgroundColor: bgColor,
                                color: textColor,
                                border: `1px solid ${borderColor}`,
                                borderRadius: '4px',
                                padding: '2px 4px',
                                fontSize: '10px',
                                fontWeight: 600,
                                lineHeight: '1.2',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                cursor: 'pointer'
                            }}
                            title={item.topicTitle}
                        >
                            {item.type === 'DEFENSE' ? 'PB: ' : item.type === 'COUNCIL_MEETING' ? 'HĐ: ' : 'BC: '}
                            {item.topicTitle}
                        </div>
                    );
                })}
            </div>
        );
    };

    const onDateSelect = (date: Dayjs) => {
        setSelectedDate(date);
    };

    const getEventTypeColor = (type: string) => {
        switch (type) {
            case 'TRIAL_REPORT': return '#1890ff';
            case 'DEFENSE': return '#fa8c16';
            case 'COUNCIL_MEETING': return '#8b5cf6';
            default: return '#d9d9d9';
        }
    };

    const getEventTypeName = (type: string) => {
        switch (type) {
            case 'TRIAL_REPORT': return 'Báo cáo thử';
            case 'DEFENSE': return 'Phản biện';
            case 'COUNCIL_MEETING': return 'Họp hội đồng';
            default: return 'Sự kiện khác';
        }
    };

    const todayEvents = events.filter((event: DefenseSchedule) =>
        dayjs(event.date).format('YYYY-MM-DD') === dayjs().format('YYYY-MM-DD')
    );

    const upcomingEvents = events.filter((event: DefenseSchedule) =>
        dayjs(event.date).isAfter(dayjs(), 'day')
    ).slice(0, 5);

    return (
        <div className="page-container">
            <div className="page-inner">
                {/* Header */}
                <Card className="page-header-card">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="page-header-icon"><CalendarOutlined className="text-base" /></div>
                            <div>
                                <div className="page-header-title">{t('navigation.schedule')}</div>
                                <div className="page-header-subtitle">Quản lý lịch trình báo cáo và bảo vệ khóa luận</div>
                            </div>
                        </div>
                        <Button
                            type="primary"
                            icon={<PlusOutlined />}
                            onClick={() => setIsModalVisible(true)}
                        >
                            Tạo lịch mới
                        </Button>
                    </div>
                </Card>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Calendar */}
                <div className="lg:col-span-2">
                    <Card title="Lịch trình tháng" className="shadow-soft">
                        <Calendar
                            dateCellRender={dateCellRender}
                            onSelect={onDateSelect}
                            className="academic-calendar"
                        />
                    </Card>
                </div>

                {/* Events Sidebar */}
                <div className="space-y-6">
                    <Card
                        title={
                            <div className="flex items-center justify-between w-full">
                                <div className="flex items-center space-x-2">
                                    <CalendarOutlined className="text-blue-600" />
                                    <span>Lịch trình ngày {selectedDate ? selectedDate.format('DD/MM/YYYY') : ''}</span>
                                </div>
                                {(() => {
                                    const count = selectedDate ? getListData(selectedDate).length : 0;
                                    return count > 0 ? (
                                        <Badge count={count} overflowCount={9} style={{ backgroundColor: '#2563eb' }} />
                                    ) : null;
                                })()}
                            </div>
                        }
                        className="shadow-soft"
                    >
                        {(() => {
                            const selectedDateEvents = selectedDate ? getListData(selectedDate) : [];
                            if (selectedDateEvents.length > 0) {
                                return (
                                    <div className="space-y-4 max-h-[480px] overflow-y-auto pr-1">
                                        {selectedDateEvents.map((item: DefenseSchedule) => {
                                            let typeTagColor = 'blue';
                                            let typeLabel = 'Báo cáo thử';
                                            if (item.type === 'DEFENSE') {
                                                typeTagColor = 'orange';
                                                typeLabel = 'Phản biện';
                                            } else if (item.type === 'COUNCIL_MEETING') {
                                                typeTagColor = 'purple';
                                                typeLabel = 'Hội đồng';
                                            }

                                            const committeeMembers = item.committee || [];
                                            const sortedCommittee = [...committeeMembers].sort((a: any, b: any) => {
                                                const order = { CHAIR: 1, SECRETARY: 2, MEMBER: 3 };
                                                const roleA = order[a.role as keyof typeof order] || 4;
                                                const roleB = order[b.role as keyof typeof order] || 4;
                                                return roleA - roleB;
                                            });

                                            return (
                                                <Card 
                                                    key={item.id}
                                                    type="inner"
                                                    className="border border-slate-100 rounded-xl hover:shadow-md transition-all duration-300"
                                                    styles={{ body: { padding: '12px' } }}
                                                >
                                                    <div className="flex items-start justify-between gap-2 mb-2">
                                                        <Tag color={typeTagColor} className="m-0 text-[10px] font-bold uppercase tracking-wider">{typeLabel}</Tag>
                                                        <span className="text-xs text-slate-500 font-semibold flex items-center gap-1 shrink-0">
                                                            <ClockCircleOutlined className="text-slate-400" />
                                                            {item.time} {item.room && `• Phòng ${item.room}`}
                                                        </span>
                                                    </div>

                                                    <div className="font-bold text-slate-900 text-[13px] leading-snug mb-2">
                                                        {item.topicTitle}
                                                    </div>

                                                    <div className="space-y-2 border-t pt-2 mt-2 text-xs">
                                                        <div className="flex justify-between items-center text-slate-600">
                                                            <span className="text-slate-400 font-medium">Giảng viên HD:</span>
                                                            <span className="font-semibold text-slate-700">{item.supervisor}</span>
                                                        </div>

                                                        {item.students && item.students.length > 0 && (
                                                            <div className="space-y-1">
                                                                <span className="text-slate-400 font-medium block mb-0.5">Sinh viên thực hiện:</span>
                                                                <div className="bg-slate-50/70 border border-slate-100/50 rounded-lg p-2 space-y-1.5">
                                                                    {item.students.map((std: any) => (
                                                                        <div key={std.id} className="flex justify-between font-medium text-slate-700">
                                                                            <span>{std.fullName}</span>
                                                                            <span className="font-mono text-slate-400 scale-90">{std.studentCode}</span>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        )}

                                                        {sortedCommittee.length > 0 && (
                                                            <div className="space-y-1 pt-1">
                                                                <span className="text-slate-400 font-medium block mb-0.5">Thành viên Hội đồng:</span>
                                                                <div className="bg-slate-50/70 border border-slate-100/50 rounded-lg p-2 space-y-1.5">
                                                                    {sortedCommittee.map((member: any) => {
                                                                        let roleName = 'Ủy viên';
                                                                        let roleColor = 'blue';
                                                                        if (member.role === 'CHAIR') {
                                                                            roleName = 'Chủ tịch';
                                                                            roleColor = 'red';
                                                                        } else if (member.role === 'SECRETARY') {
                                                                            roleName = 'Thư ký';
                                                                            roleColor = 'orange';
                                                                        }
                                                                        return (
                                                                            <div key={member.id} className="flex justify-between items-center text-[11px]">
                                                                                <span className="font-semibold text-slate-700">{member.fullName}</span>
                                                                                <Tag color={roleColor} className="m-0 text-[8px] scale-90 origin-right font-bold px-1.5 py-0 h-4 leading-none flex items-center">{roleName}</Tag>
                                                                            </div>
                                                                        );
                                                                    })}
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                </Card>
                                            );
                                        })}
                                    </div>
                                );
                            } else {
                                return (
                                    <div className="text-center text-slate-400 py-12 flex flex-col items-center justify-center">
                                        <CalendarOutlined className="text-3xl mb-2 text-slate-200" />
                                        <span className="text-xs">Không có lịch trình nào vào ngày này</span>
                                    </div>
                                );
                            }
                        })()}
                    </Card>

                    {/* Upcoming Events */}
                    <Card
                        title={
                            <div className="flex items-center space-x-2">
                                <ClockCircleOutlined className="text-amber-500" />
                                <span>Lịch sắp tới</span>
                            </div>
                        }
                        className="shadow-soft"
                    >
                        <List
                            dataSource={upcomingEvents}
                            renderItem={(item: DefenseSchedule) => {
                                let typeTagColor = 'blue';
                                let typeLabel = 'BC';
                                if (item.type === 'DEFENSE') {
                                    typeTagColor = 'orange';
                                    typeLabel = 'PB';
                                } else if (item.type === 'COUNCIL_MEETING') {
                                    typeTagColor = 'purple';
                                    typeLabel = 'HĐ';
                                }
                                return (
                                    <List.Item className="border-none px-0 py-2.5 last:pb-0 first:pt-0">
                                        <div className="w-full flex items-start gap-2.5">
                                            <Tag color={typeTagColor} className="m-0 shrink-0 text-[9px] font-bold w-6 h-5 flex items-center justify-center px-0">{typeLabel}</Tag>
                                            <div className="flex-grow min-w-0">
                                                <div 
                                                    className="font-semibold text-slate-800 text-xs truncate cursor-pointer hover:text-blue-600 transition-colors"
                                                    onClick={() => setSelectedDate(dayjs(item.date))}
                                                    title="Click để xem chi tiết ngày này"
                                                >
                                                    {item.topicTitle}
                                                </div>
                                                <div className="text-[10px] text-slate-500 mt-0.5 flex items-center gap-1.5 font-medium">
                                                    <span>{dayjs(item.date).format('DD/MM/YYYY')}</span>
                                                    <span>•</span>
                                                    <span>{item.time}</span>
                                                    {item.room && (
                                                        <>
                                                            <span>•</span>
                                                            <span>Phòng {item.room}</span>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </List.Item>
                                );
                            }}
                        />
                    </Card>
                </div>
            </div>

            {/* Create Event Modal */}
            <Modal
                title="Tạo lịch trình mới"
                open={isModalVisible}
                onOk={() => {
                    form.validateFields().then(() => {
                        setIsModalVisible(false);
                        form.resetFields();
                    });
                }}
                onCancel={() => {
                    setIsModalVisible(false);
                    form.resetFields();
                }}
                width={600}
            >
                <Form form={form} layout="vertical" initialValues={{
                    date: selectedDate
                }}>
                    <Form.Item
                        label="Tiêu đề sự kiện"
                        name="title"
                        rules={[{ required: true, message: 'Vui lòng nhập tiêu đề' }]}
                    >
                        <Input placeholder="Nhập tiêu đề sự kiện..." />
                    </Form.Item>

                    <Form.Item
                        label="Loại sự kiện"
                        name="type"
                        rules={[{ required: true, message: 'Vui lòng chọn loại sự kiện' }]}
                    >
                        <Select placeholder="Chọn loại sự kiện">
                            <Select.Option value="TRIAL_REPORT">Báo cáo thử</Select.Option>
                            <Select.Option value="DEFENSE">Phản biện</Select.Option>
                            <Select.Option value="COUNCIL_MEETING">Họp hội đồng</Select.Option>
                        </Select>
                    </Form.Item>

                    <div className="grid grid-cols-2 gap-4">
                        <Form.Item
                            label="Ngày"
                            name="date"
                            rules={[{ required: true, message: 'Vui lòng chọn ngày' }]}
                        >
                            <DatePicker className="w-full" format="DD/MM/YYYY" />
                        </Form.Item>

                        <Form.Item
                            label="Thời gian"
                            name="time"
                            rules={[{ required: true, message: 'Vui lòng chọn thời gian' }]}
                        >
                            <TimePicker.RangePicker className="w-full" format="HH:mm" />
                        </Form.Item>
                    </div>

                    <Form.Item label="Phòng" name="room">
                        <Input placeholder="Nhập phòng tổ chức..." />
                    </Form.Item>

                    <Form.Item label="Người tham gia" name="participants">
                        <Select mode="tags" placeholder="Nhập tên người tham gia...">
                            <Select.Option value="nguyen_van_a">Nguyễn Văn A</Select.Option>
                            <Select.Option value="tran_thi_b">TS. Trần Thị B</Select.Option>
                        </Select>
                    </Form.Item>

                    <Form.Item label="Mô tả" name="description">
                        <Input.TextArea rows={3} placeholder="Mô tả chi tiết về sự kiện..." />
                    </Form.Item>
                </Form>
            </Modal>
            </div>
        </div>
    );
};

export default Schedule;