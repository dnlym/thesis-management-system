import { useState } from 'react';
import { Calendar, Card, Badge, Modal, Form, Input, DatePicker, TimePicker, Select, Button, List, Spin, Alert } from 'antd';
import { useTranslation } from 'react-i18next';
import { CalendarOutlined, PlusOutlined, ClockCircleOutlined } from '@ant-design/icons';
import type { Dayjs } from 'dayjs';
import dayjs from 'dayjs';
import { useDefenseSchedules } from '@/hooks/useDefense';
import { DefenseSchedule } from '@/api/defense';

const Schedule = () => {
    const { t } = useTranslation();
    const [isModalVisible, setIsModalVisible] = useState(false);
    const [selectedDate, setSelectedDate] = useState<Dayjs | null>(null);
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
            <div className="space-y-1">
                {listData.map((item: DefenseSchedule) => (
                    <Badge
                        key={item.id}
                        status={
                            item.type === 'TRIAL_REPORT' ? 'processing' :
                                item.type === 'DEFENSE' ? 'warning' : 'success'
                        }
                        text={
                            <span className="text-xs text-foreground truncate">
                                {item.topicTitle}
                            </span>
                        }
                    />
                ))}
            </div>
        );
    };

    const onDateSelect = (date: Dayjs) => {
        setSelectedDate(date);
        const dailyEvents = getListData(date);
        if (dailyEvents.length === 0) {
            setIsModalVisible(true);
        }
    };

    const getEventTypeColor = (type: string) => {
        switch (type) {
            case 'TRIAL_REPORT': return '#1890ff';
            case 'DEFENSE': return '#fa8c16';
            case 'COUNCIL_MEETING': return '#52c41a';
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
                    {/* Today's Events */}
                    <Card
                        title={
                            <div className="flex items-center space-x-2">
                                <CalendarOutlined className="text-academic-primary" />
                                <span>Lịch hôm nay</span>
                            </div>
                        }
                        className="shadow-soft"
                    >
                        {todayEvents.length > 0 ? (
                            <List
                                dataSource={todayEvents}
                                renderItem={(item: DefenseSchedule) => (
                                    <List.Item className="border-none px-0">
                                        <div className="w-full">
                                            <div className="flex items-center justify-between mb-1">
                                                <span className="font-medium text-foreground">{item.topicTitle}</span>
                                                <Badge
                                                    color={getEventTypeColor(item.type)}
                                                    text={getEventTypeName(item.type)}
                                                />
                                            </div>
                                            <div className="text-sm text-muted-foreground flex items-center space-x-2">
                                                <ClockCircleOutlined />
                                                <span>{item.time}</span>
                                                {item.room && <span>• {item.room}</span>}
                                            </div>
                                            <div className="text-xs text-muted-foreground mt-1">
                                                GVHD: {item.supervisor}
                                            </div>
                                        </div>
                                    </List.Item>
                                )}
                            />
                        ) : (
                            <div className="text-center text-muted-foreground py-4">
                                Không có lịch trình nào hôm nay
                            </div>
                        )}
                    </Card>

                    {/* Upcoming Events */}
                    <Card
                        title="Lịch sắp tới"
                        className="shadow-soft"
                    >
                        <List
                            dataSource={upcomingEvents}
                            renderItem={(item: DefenseSchedule) => (
                                <List.Item className="border-none px-0">
                                    <div className="w-full">
                                        <div className="font-medium text-foreground mb-1">{item.topicTitle}</div>
                                        <div className="text-sm text-muted-foreground space-y-1">
                                            <div>{dayjs(item.date).format('DD/MM/YYYY')} • {item.time}</div>
                                            {item.room && <div>{item.room}</div>}
                                        </div>
                                    </div>
                                </List.Item>
                            )}
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