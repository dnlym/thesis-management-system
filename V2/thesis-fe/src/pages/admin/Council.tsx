import { useState } from 'react';
import { Card, Table, Button, Modal, Form, DatePicker, TimePicker, Input, Select, Tag, Space, Spin } from 'antd';
import { useTranslation } from 'react-i18next';
import { CalendarOutlined, UsergroupAddOutlined } from '@ant-design/icons';
import { useTopics } from '@/hooks/useTopics';
import { useUsers } from '@/hooks/useUsers';
import { useCreateDefenseSchedule } from '@/hooks/useAssignments';
import { TopicStatusBadge } from '@/components/StatusBadge';
import dayjs from 'dayjs';
import type { TopicStatus } from '@/types';

const { Option } = Select;

const Council = () => {
    const { t } = useTranslation();
    const [form] = Form.useForm();
    const [scheduleModalVisible, setScheduleModalVisible] = useState(false);
    const [selectedTopic, setSelectedTopic] = useState<any>(null);

    // Fetch topics ready for defense (e.g., REVIEWER_GRADED)
    // Note: You might need to adjust the status filter based on your workflow
    const { data: topicsData, isLoading: isLoadingTopics } = useTopics({ status: 'WAITING_FOR_DEFENSE_ASSIGNMENT' });

    // Fetch potential council members (Lecturers)
    const { data: lecturers } = useUsers({ role: 'LECTURER' }); // Or whatever role is appropriate

    const createScheduleMutation = useCreateDefenseSchedule();

    const handleSchedule = (topic: any) => {
        setSelectedTopic(topic);
        setScheduleModalVisible(true);
    };

    const onFinish = (values: any) => {
        if (!selectedTopic) return;

        const scheduleData = {
            topic_id: selectedTopic.id,
            date: values.date.format('YYYY-MM-DD'),
            start_time: values.startTime.format('HH:mm'),
            end_time: values.endTime.format('HH:mm'),
            location: values.location,
            chair_id: values.chairId,
            secretary_id: values.secretaryId,
            member_ids: values.memberIds,
        };

        createScheduleMutation.mutate(scheduleData, {
            onSuccess: () => {
                setScheduleModalVisible(false);
                form.resetFields();
                setSelectedTopic(null);
            }
        });
    };

    const columns = [
        {
            title: t('topics.topicTitle'),
            dataIndex: 'title',
            key: 'title',
        },
        {
            title: t('topics.supervisor'),
            dataIndex: ['supervisor', 'fullName'],
            key: 'supervisor',
        },
        {
            title: t('common.status'),
            dataIndex: 'status',
            key: 'status',
            render: (status: any) => <TopicStatusBadge status={status} />,
        },
        {
            title: t('common.actions'),
            key: 'action',
            render: (_, record: any) => (
                <Button
                    type="primary"
                    icon={<CalendarOutlined />}
                    onClick={() => handleSchedule(record)}
                >
                    {t('council.scheduleDefense')}
                </Button>
            ),
        },
    ];

    return (
        <div className="page-container">
            <div className="page-inner">
                {/* Header */}
                <Card className="page-header-card">
                    <div className="flex items-center gap-3">
                        <div className="page-header-icon"><UsergroupAddOutlined className="text-base" /></div>
                        <div>
                            <div className="page-header-title">{t('navigation.council')}</div>
                            <div className="page-header-subtitle">{t('council.subtitle')}</div>
                        </div>
                    </div>
                </Card>

                <Card className="page-card-flush">
                    <Spin spinning={isLoadingTopics}>
                        <Table
                            dataSource={topicsData?.topics || []}
                            columns={columns}
                            rowKey="id"
                            className="sys-table"
                            locale={{ emptyText: t('council.noTopicsWaiting') }}
                            pagination={{ pageSize: 10, className: 'px-6 py-4' }}
                        />
                    </Spin>
                </Card>

            <Modal
                title={t('council.modalTitle', { title: selectedTopic?.title })}
                open={scheduleModalVisible}
                onCancel={() => setScheduleModalVisible(false)}
                onOk={() => form.submit()}
                confirmLoading={createScheduleMutation.isPending}
                width={800}
                okText={t('council.createSchedule')}
                cancelText={t('common.cancel')}
            >
                <Form
                    form={form}
                    layout="vertical"
                    onFinish={onFinish}
                >
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Form.Item
                            name="date"
                            label={t('council.defenseDate')}
                            rules={[{ required: true, message: t('council.selectDateRequired') }]}
                        >
                            <DatePicker className="w-full" />
                        </Form.Item>

                        <Form.Item
                            name="location"
                            label={t('council.location')}
                            rules={[{ required: true, message: t('council.selectLocationRequired') }]}
                        >
                            <Input placeholder={t('council.locationPlaceholder')} />
                        </Form.Item>

                        <Form.Item
                            name="startTime"
                            label={t('council.startTime')}
                            rules={[{ required: true, message: t('council.selectStartTimeRequired') }]}
                        >
                            <TimePicker format="HH:mm" className="w-full" />
                        </Form.Item>

                        <Form.Item
                            name="endTime"
                            label={t('council.endTime')}
                            rules={[{ required: true, message: t('council.selectEndTimeRequired') }]}
                        >
                            <TimePicker format="HH:mm" className="w-full" />
                        </Form.Item>
                    </div>

                    <div className="border-t pt-4 mt-2">
                        <h3 className="font-semibold mb-4">{t('council.membersTitle')}</h3>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <Form.Item
                                name="chairId"
                                label={t('council.chair')}
                                rules={[{ required: true, message: t('council.selectChairRequired') }]}
                            >
                                <Select placeholder={t('topics.selectReviewerPlaceholder')} showSearch optionFilterProp="children">
                                    {lecturers?.map((l: any) => (
                                        <Option key={l.id} value={l.id}>{l.fullName}</Option>
                                    ))}
                                </Select>
                            </Form.Item>

                            <Form.Item
                                name="secretaryId"
                                label={t('council.secretary')}
                                rules={[{ required: true, message: t('council.selectSecretaryRequired') }]}
                            >
                                <Select placeholder={t('topics.selectReviewerPlaceholder')} showSearch optionFilterProp="children">
                                    {lecturers?.map((l: any) => (
                                        <Option key={l.id} value={l.id}>{l.fullName}</Option>
                                    ))}
                                </Select>
                            </Form.Item>
                        </div>

                        <Form.Item
                            name="memberIds"
                            label={t('council.members')}
                            rules={[{ required: true, message: t('council.selectMembersRequired') }]}
                        >
                            <Select mode="multiple" placeholder={t('topics.selectReviewerPlaceholder')} showSearch optionFilterProp="children">
                                {lecturers?.map((l: any) => (
                                    <Option key={l.id} value={l.id}>{l.fullName}</Option>
                                ))}
                            </Select>
                        </Form.Item>
                    </div>
                </Form>
            </Modal>
            </div>
        </div>
    );
};

export default Council;
