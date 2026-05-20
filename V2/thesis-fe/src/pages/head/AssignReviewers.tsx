import { useState } from 'react';
import { Card, Table, Button, Modal, Form, Select, Tag, Spin, Radio, Input, DatePicker, TimePicker } from 'antd';
import { notify } from '@/utils/notification';
import { UserAddOutlined, TeamOutlined, EditOutlined, CalendarOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { UsersApi } from '@/api/users';
import { AssignmentsApi } from '@/api/assignments';
import { useAuthStore } from '@/store/auth';
import { useActiveSemester } from '@/hooks/useActiveSemester';
import dayjs from 'dayjs';

const { Option } = Select;
const { RangePicker } = TimePicker;

const HeadAssignReviewers = () => {
    const [assignReviewerModalVisible, setAssignReviewerModalVisible] = useState(false);
    const [assignCommitteeModalVisible, setAssignCommitteeModalVisible] = useState(false);
    const [selectedTopic, setSelectedTopic] = useState<any>(null);
    const [form] = Form.useForm();

    const { user } = useAuthStore();
    const { data: activeSemester } = useActiveSemester();
    const semesterId = activeSemester?.id;
    const queryClient = useQueryClient();

    // Fetch topics waiting for/assigned to reviewer
    const { data: topicsData, isLoading: topicsLoading } = useQuery({
        queryKey: ['topics-assignment', semesterId],
        queryFn: () => AssignmentsApi.getTopicsForReviewerAssignment(),
        enabled: !!semesterId,
    });
    const topics = topicsData || [];

    // Fetch lecturers theo phân quyền (HOD vs ADMIN)
    const { data: lecturers = [] } = useQuery({
        queryKey: ['lecturers-assignment', user?.role, user?.department_id],
        queryFn: () => {
            const filters: any = { role: 'LECTURER' };
            if (user?.role === 'HEAD') {
                filters.departmentId = user?.department_id || (user as any)?.department?.id;
            }
            return UsersApi.getAll(filters);
        },
        enabled: !!user,
    });

    const openAssignReviewerModal = (record: any) => {
        setSelectedTopic(record);
        
        // Find existing values to pre-fill
        const rev1 = record.assignments?.find((a: any) => a.reviewer_order === 1);
        const rev2 = record.assignments?.find((a: any) => a.reviewer_order === 2);
        const schedule = record.assignments?.[0]; // both assignments share the same schedule fields

        if (schedule) {
            form.setFieldsValue({
                reviewer1Id: rev1?.reviewer_id,
                reviewer2Id: rev2?.reviewer_id,
                defenseFormat: schedule.defense_format || 'OFFLINE',
                room: schedule.defense_format === 'OFFLINE' ? schedule.room : undefined,
                zoomLink: schedule.defense_format === 'ONLINE' ? schedule.room : undefined,
                zoomPassword: schedule.zoom_password,
                date: schedule.start_time ? dayjs(schedule.start_time) : undefined,
                timeRange: schedule.start_time && schedule.end_time 
                    ? [dayjs(schedule.start_time), dayjs(schedule.end_time)] 
                    : undefined,
            });
        } else {
            form.resetFields();
            form.setFieldsValue({
                defenseFormat: 'OFFLINE',
            });
        }
        
        setAssignReviewerModalVisible(true);
    };

    const openAssignCommitteeModal = (topic: any) => {
        setSelectedTopic(topic);
        setAssignCommitteeModalVisible(true);
    };

    const assignReviewerMutation = useMutation({
        mutationFn: (data: any) => AssignmentsApi.assignReviewer(data),
        onError: (error: any) => {
            notify.error(error?.response?.data?.error || 'Có lỗi xảy ra khi phân công');
        }
    });

    const updateScheduleMutation = useMutation({
        mutationFn: (data: any) => AssignmentsApi.updateReviewerSchedule(data),
        onError: (error: any) => {
            notify.error(error?.response?.data?.error || 'Có lỗi xảy ra khi cập nhật lịch');
        }
    });

    const deleteAssignmentMutation = useMutation({
        mutationFn: (id: string) => AssignmentsApi.delete(id),
        onError: (error: any) => {
            notify.error(error?.response?.data?.error || 'Có lỗi xảy ra khi xóa phân công');
        }
    });

    const handleAssignReviewers = async () => {
        try {
            const values = await form.validateFields();
            const groupId = selectedTopic.groupId || selectedTopic.registrations?.[0]?.group_id || null;
            const topicId = selectedTopic.id;

            // Combine date and time
            let startTime: Date | undefined = undefined;
            let endTime: Date | undefined = undefined;
            if (values.date && values.timeRange) {
                const dateStr = values.date.format('YYYY-MM-DD');
                startTime = dayjs(`${dateStr} ${values.timeRange[0].format('HH:mm')}`).toDate();
                endTime = dayjs(`${dateStr} ${values.timeRange[1].format('HH:mm')}`).toDate();
            }

            const roomVal = values.defenseFormat === 'ONLINE' ? values.zoomLink : values.room;
            const zoomPassVal = values.defenseFormat === 'ONLINE' ? values.zoomPassword : null;

            const isEdit = selectedTopic.assignments && selectedTopic.assignments.length > 0;

            if (isEdit) {
                // If it's an update, update the schedule first
                await updateScheduleMutation.mutateAsync({
                    topicId,
                    groupId,
                    defenseFormat: values.defenseFormat,
                    room: roomVal,
                    zoomPassword: zoomPassVal,
                    startTime,
                    endTime,
                });

                // If reviewer IDs changed, we delete old and assign new
                const oldRev1 = selectedTopic.assignments.find((a: any) => a.reviewer_order === 1);
                const oldRev2 = selectedTopic.assignments.find((a: any) => a.reviewer_order === 2);

                if (oldRev1 && oldRev1.reviewer_id !== values.reviewer1Id) {
                    await deleteAssignmentMutation.mutateAsync(oldRev1.id);
                    await assignReviewerMutation.mutateAsync({
                        topicId,
                        groupId,
                        reviewerId: values.reviewer1Id,
                        reviewerOrder: 1,
                        deadlineAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
                        defenseFormat: values.defenseFormat,
                        room: roomVal,
                        zoomPassword: zoomPassVal,
                        startTime,
                        endTime,
                    });
                }
                if (oldRev2 && oldRev2.reviewer_id !== values.reviewer2Id) {
                    await deleteAssignmentMutation.mutateAsync(oldRev2.id);
                    await assignReviewerMutation.mutateAsync({
                        topicId,
                        groupId,
                        reviewerId: values.reviewer2Id,
                        reviewerOrder: 2,
                        deadlineAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
                        defenseFormat: values.defenseFormat,
                        room: roomVal,
                        zoomPassword: zoomPassVal,
                        startTime,
                        endTime,
                    });
                }

                notify.success('Cập nhật phân công và lịch phản biện thành công');
            } else {
                // Phân công lần lượt cho 2 giảng viên mới cùng với thông tin lịch
                await assignReviewerMutation.mutateAsync({
                    topicId,
                    groupId,
                    reviewerId: values.reviewer1Id,
                    reviewerOrder: 1,
                    deadlineAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
                    defenseFormat: values.defenseFormat,
                    room: roomVal,
                    zoomPassword: zoomPassVal,
                    startTime,
                    endTime,
                });

                await assignReviewerMutation.mutateAsync({
                    topicId,
                    groupId,
                    reviewerId: values.reviewer2Id,
                    reviewerOrder: 2,
                    deadlineAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
                    defenseFormat: values.defenseFormat,
                    room: roomVal,
                    zoomPassword: zoomPassVal,
                    startTime,
                    endTime,
                });

                notify.success('Phân công phản biện thành công');
            }

            setAssignReviewerModalVisible(false);
            form.resetFields();
            queryClient.invalidateQueries({ queryKey: ['topics-assignment'] });
        } catch (error) {
            console.error('Validation or Mutation failed:', error);
        }
    };

    const handleAssignCommittee = async () => {
        try {
            const values = await form.validateFields();
            notify.info('Chức năng đang được cập nhật đồng bộ');
            setAssignCommitteeModalVisible(false);
            form.resetFields();
        } catch (error) {
            console.error('Validation failed:', error);
        }
    };

    const columns = [
        {
            title: 'Đề tài',
            dataIndex: 'title',
            key: 'title',
            render: (text: string, record: any) => (
                <div className="flex flex-col gap-1">
                    <span className="font-semibold text-slate-800">{text || record.topicTitle}</span>
                    <div className="flex items-center gap-2">
                        <Tag color="purple">{record.groupName || 'Chưa lập nhóm'}</Tag>
                        <span className="text-xs text-slate-500">
                            SV: {record.registrations?.map((r: any) => `${r.student?.full_name} (${r.student?.student_code})`).join(', ')}
                        </span>
                    </div>
                </div>
            ),
        },
        {
            title: 'GVHD',
            key: 'supervisor',
            render: (record: any) => (
                <div className="flex flex-col">
                    <span className="font-medium">{record.supervisor?.full_name}</span>
                    <span className="text-[10px] text-slate-400">{record.supervisor?.email}</span>
                </div>
            ),
        },
        {
            title: 'GVPB Đã phân công',
            key: 'reviewers',
            render: (record: any) => {
                const rev1 = record.assignments?.find((a: any) => a.reviewer_order === 1)?.reviewer?.full_name;
                const rev2 = record.assignments?.find((a: any) => a.reviewer_order === 2)?.reviewer?.full_name;
                if (!rev1 && !rev2) return <Tag color="default">Chưa phân công</Tag>;
                return (
                    <div className="flex flex-col gap-1">
                        {rev1 && <Tag color="blue">PB1: {rev1}</Tag>}
                        {rev2 && <Tag color="cyan">PB2: {rev2}</Tag>}
                    </div>
                );
            }
        },
        {
            title: 'Lịch phản biện',
            key: 'schedule',
            render: (record: any) => {
                const assignment = record.assignments?.[0];
                if (!assignment || !assignment.start_time) return <span className="text-slate-400">-</span>;
                const start = dayjs(assignment.start_time);
                const end = assignment.end_time ? dayjs(assignment.end_time) : null;
                const dateStr = start.format('DD/MM/YYYY');
                const timeStr = `${start.format('HH:mm')} - ${end ? end.format('HH:mm') : ''}`;
                
                return (
                    <div className="text-xs">
                        <div>📅 {dateStr}</div>
                        <div>⏰ {timeStr}</div>
                            {assignment.defense_format === 'ONLINE' ? (
                                <Tag color="orange">Zoom</Tag>
                            ) : (
                                <Tag color="green">Phòng: {assignment.room || '-'}</Tag>
                            )}
                    </div>
                );
            }
        },
        {
            title: 'Thao tác',
            key: 'actions',
            render: (_: any, record: any) => {
                const isAssigned = record.assignments && record.assignments.length > 0;
                return (
                    <div className="space-x-2">
                        <Button
                            type="link"
                            size="small"
                            icon={isAssigned ? <CalendarOutlined /> : <UserAddOutlined />}
                            onClick={() => openAssignReviewerModal(record)}
                        >
                            {isAssigned ? 'Cập nhật lịch & GVPB' : 'Phân công GVPB'}
                        </Button>
                        <Button
                            type="link"
                            size="small"
                            icon={<TeamOutlined />}
                            onClick={() => openAssignCommitteeModal(record)}
                        >
                            Phân công HĐ
                        </Button>
                    </div>
                );
            },
        },
    ];

    return (
        <div className="page-container">
            <div className="page-inner">
                <Card className="page-header-card">
                    <div className="flex items-center gap-3">
                        <div className="page-header-icon"><UserAddOutlined className="text-base" /></div>
                        <div>
                            <div className="page-header-title">Phân công phản biện</div>
                            <div className="page-header-subtitle">Phân công giảng viên phản biện, thời gian, hình thức và phòng/link họp</div>
                        </div>
                    </div>
                </Card>

                <Card className="page-card-flush">
                    <Spin spinning={topicsLoading}>
                        <Table
                            columns={columns}
                            dataSource={topics}
                            rowKey="groupId"
                            size="middle"
                            className="sys-table"
                            pagination={{ pageSize: 10 }}
                        />
                    </Spin>
                </Card>

                <Modal
                    title={selectedTopic?.assignments && selectedTopic.assignments.length > 0 
                        ? `Cập nhật phân công & lịch phản biện - ${selectedTopic?.title || selectedTopic?.topicTitle}`
                        : `Phân công GVPB - ${selectedTopic?.title || selectedTopic?.topicTitle}`
                    }
                    open={assignReviewerModalVisible}
                    onOk={handleAssignReviewers}
                    onCancel={() => setAssignReviewerModalVisible(false)}
                    width={600}
                    okText="Xác nhận"
                >
                    <Form form={form} layout="vertical" className="mt-4">
                        <div className="grid grid-cols-2 gap-4">
                            <Form.Item
                                label="Giảng viên phản biện 1"
                                name="reviewer1Id"
                                rules={[{ required: true, message: 'Vui lòng chọn GVPB 1' }]}
                            >
                                <Select placeholder="Chọn GVPB 1" showSearch optionFilterProp="label">
                                    {lecturers.filter(l => l.id !== selectedTopic?.supervisor_id).map(lec => (
                                        <Option key={lec.id} value={lec.id} label={lec.full_name}>
                                            {lec.full_name} ({lec.email})
                                        </Option>
                                    ))}
                                </Select>
                            </Form.Item>
                            <Form.Item
                                label="Giảng viên phản biện 2"
                                name="reviewer2Id"
                                rules={[{ required: true, message: 'Vui lòng chọn GVPB 2' }]}
                            >
                                <Select placeholder="Chọn GVPB 2" showSearch optionFilterProp="label">
                                    {lecturers.filter(l => l.id !== selectedTopic?.supervisor_id).map(lec => (
                                        <Option key={lec.id} value={lec.id} label={lec.full_name}>
                                            {lec.full_name} ({lec.email})
                                        </Option>
                                    ))}
                                </Select>
                            </Form.Item>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <Form.Item
                                label="Ngày phản biện"
                                name="date"
                                rules={[{ required: true, message: 'Vui lòng chọn ngày phản biện' }]}
                            >
                                <DatePicker className="w-full" format="DD/MM/YYYY" placeholder="Chọn ngày" />
                            </Form.Item>

                            <Form.Item
                                label="Khung giờ (Bắt đầu - Kết thúc)"
                                name="timeRange"
                                rules={[{ required: true, message: 'Vui lòng chọn khung giờ' }]}
                            >
                                <RangePicker className="w-full" format="HH:mm" placeholder={['Bắt đầu', 'Kết thúc']} />
                            </Form.Item>
                        </div>

                        <Form.Item
                            label="Hình thức phản biện"
                            name="defenseFormat"
                            rules={[{ required: true, message: 'Vui lòng chọn hình thức' }]}
                        >
                            <Radio.Group buttonStyle="solid">
                                <Radio.Button value="OFFLINE">Offline (Trực tiếp)</Radio.Button>
                                <Radio.Button value="ONLINE">Online (Trực tuyến)</Radio.Button>
                            </Radio.Group>
                        </Form.Item>

                        <Form.Item noStyle shouldUpdate={(prevValues, currentValues) => prevValues.defenseFormat !== currentValues.defenseFormat}>
                            {({ getFieldValue }) => {
                                const format = getFieldValue('defenseFormat');
                                return format === 'ONLINE' ? (
                                    <div className="grid grid-cols-2 gap-4">
                                        <Form.Item
                                            label="Link cuộc họp Zoom"
                                            name="zoomLink"
                                            rules={[{ required: true, message: 'Vui lòng nhập Link Zoom' }]}
                                        >
                                            <Input placeholder="https://zoom.us/j/..." />
                                        </Form.Item>
                                        <Form.Item
                                            label="Mật khẩu Zoom (nếu có)"
                                            name="zoomPassword"
                                        >
                                            <Input placeholder="Mật khẩu cuộc họp" />
                                        </Form.Item>
                                    </div>
                                ) : (
                                    <Form.Item
                                        label="Phòng phản biện"
                                        name="room"
                                        rules={[{ required: true, message: 'Vui lòng nhập phòng' }]}
                                    >
                                        <Input placeholder="Vd: X.12, H.3.2" />
                                    </Form.Item>
                                );
                            }}
                        </Form.Item>
                    </Form>
                </Modal>
            </div>
        </div>
    );
};

export default HeadAssignReviewers;
