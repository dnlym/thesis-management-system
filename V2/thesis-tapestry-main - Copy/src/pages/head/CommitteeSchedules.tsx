import { useState } from 'react';
import { Card, Table, Tag, Space, Select, DatePicker, TimePicker, Button, Modal, Form, Input, message, Divider } from 'antd';
import { CalendarOutlined, PlusOutlined, ClockCircleOutlined, EnvironmentOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { CommitteeApi, MasterSchedule } from '@/api/committee';
import { useActiveSemester } from '@/hooks/useActiveSemester';
import dayjs from 'dayjs';

const CommitteeSchedules = () => {
    const { t } = useTranslation();
    const queryClient = useQueryClient();
    const { data: activeSemester } = useActiveSemester();
    const semesterId = activeSemester?.id;

    // Fetch master schedules
    const { data: masterSchedules, isLoading } = useQuery({
        queryKey: ['master-schedules', semesterId],
        queryFn: () => CommitteeApi.getMasterSchedules(semesterId!),
        enabled: !!semesterId,
    });

    const columns = [
        {
            title: t('committeeManagement.nameLabel', 'Hội đồng'),
            dataIndex: ['committee', 'name'],
            key: 'committeeName',
            render: (text: string) => <span className="font-bold">{text}</span>
        },
        {
            title: t('topics.title', 'Đề tài & Lịch bảo vệ'),
            key: 'topics',
            render: (_: any, record: MasterSchedule) => (
                <div className="space-y-4">
                    {record.schedules.map((s, idx) => (
                        <Card size="small" key={idx} className="bg-gray-50 border-gray-100">
                            <div className="flex justify-between items-start mb-2">
                                <div>
                                    <div className="font-medium text-blue-700">{s.topicName}</div>
                                    <div className="text-xs text-gray-500">
                                        {s.groupCode ? `Mã nhóm: ${s.groupCode} | ` : ''}
                                        Sinh viên: {s.students.map(st => st.fullName).join(', ')}
                                    </div>
                                </div>
                                <Tag color={s.status === 'SCHEDULED' ? 'green' : 'orange'}>
                                    {s.status}
                                </Tag>
                            </div>
                            <Space split={<Divider type="vertical" />} className="text-sm">
                                <span className="flex items-center gap-1"><CalendarOutlined className="text-gray-400" /> {dayjs(s.date).format('DD/MM/YYYY')}</span>
                                <span className="flex items-center gap-1"><ClockCircleOutlined className="text-gray-400" /> {s.startTime} - {s.endTime}</span>
                                <span className="flex items-center gap-1"><EnvironmentOutlined className="text-gray-400" /> {s.room || 'N/A'}</span>
                            </Space>
                        </Card>
                    ))}
                    {record.schedules.length === 0 && <span className="text-gray-400 italic">Chưa có lịch bảo vệ được phân bổ</span>}
                </div>
            )
        }
    ];

    return (
        <div className="p-6 max-w-7xl mx-auto">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800">{t('navigation.committeeSchedules', 'Lịch bảo vệ hội đồng')}</h1>
                    <p className="text-gray-500">Xem và quản lý phân bổ thời gian bảo vệ của các hội đồng trong học kỳ này</p>
                </div>
            </div>

            <Card className="shadow-sm border-0">
                <Table
                    dataSource={masterSchedules}
                    columns={columns}
                    loading={isLoading}
                    rowKey={(record) => record.committee.id}
                    pagination={false}
                />
            </Card>
        </div>
    );
};

export default CommitteeSchedules;
