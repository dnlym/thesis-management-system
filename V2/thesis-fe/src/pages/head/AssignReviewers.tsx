import { useState } from 'react';
import { Card, Table, Button, Modal, Form, Select, Tag, Spin } from 'antd';
import { notify } from '@/utils/notification';
import { UserAddOutlined, TeamOutlined } from '@ant-design/icons';
import { TopicStatusBadge } from '@/components/StatusBadge';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { UsersApi } from '@/api/users';
import { TopicsApi } from '@/api/topics';
import { AssignmentsApi } from '@/api/assignments';
import { useAuthStore } from '@/store/auth';
import { useActiveSemester } from '@/hooks/useActiveSemester';

const { Option } = Select;

const HeadAssignReviewers = () => {
    const [assignReviewerModalVisible, setAssignReviewerModalVisible] = useState(false);
    const [assignCommitteeModalVisible, setAssignCommitteeModalVisible] = useState(false);
    const [selectedTopic, setSelectedTopic] = useState<any>(null);
    const [form] = Form.useForm();

    const { user } = useAuthStore();
    const { data: activeSemester } = useActiveSemester();
    const semesterId = activeSemester?.id;
    const queryClient = useQueryClient();

    // Fetch topics waiting for assignment
    const { data: topicsData, isLoading: topicsLoading } = useQuery({
        queryKey: ['topics-assignment', semesterId],
        queryFn: () => TopicsApi.getAll({ 
            semesterId, 
            status: 'WAITING_FOR_DEFENSE_ASSIGNMENT' 
        }),
        enabled: !!semesterId,
    });
    const topics = topicsData?.topics || [];

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

    const openAssignReviewerModal = (topic: any) => {
        setSelectedTopic(topic);
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

    const handleAssignReviewers = async () => {
        try {
            const values = await form.validateFields();
            
            // Tìm groupId (trong hệ thống này topic thường gắn với 1 group/student khi WAITING_FOR_DEFENSE_ASSIGNMENT)
            const groupId = selectedTopic.registrations?.[0]?.group_id || null;

            // Phân công lần lượt cho 2 giảng viên
            await assignReviewerMutation.mutateAsync({
                topicId: selectedTopic.id,
                groupId,
                reviewerId: values.reviewer1Id,
                reviewerOrder: 1,
                deadlineAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // Mặc định 7 ngày
            });

            await assignReviewerMutation.mutateAsync({
                topicId: selectedTopic.id,
                groupId,
                reviewerId: values.reviewer2Id,
                reviewerOrder: 2,
                deadlineAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
            });

            notify.success('Phân công phản biện thành công');
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
            // Logic phân công hội đồng tương tự...
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
            render: (text: string) => (
                <span className="font-medium">{text}</span>
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
            title: 'Trạng thái',
            dataIndex: 'status',
            key: 'status',
            render: (status: any) => <TopicStatusBadge status={status} />,
        },
        {
            title: 'Thao tác',
            key: 'actions',
            render: (_: any, record: any) => (
                <div className="space-x-2">
                    <Button
                        type="link"
                        size="small"
                        icon={<UserAddOutlined />}
                        onClick={() => openAssignReviewerModal(record)}
                    >
                        Phân công GVPB
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
            ),
        },
    ];

    return (
        <div className="page-container">
            <div className="page-inner">
                <Card className="page-header-card">
                    <div className="flex items-center gap-3">
                        <div className="page-header-icon"><UserAddOutlined className="text-base" /></div>
                        <div>
                            <div className="page-header-title">Phân công đánh giá</div>
                            <div className="page-header-subtitle">Phân công giảng viên phản biện và hội đồng bảo vệ</div>
                        </div>
                    </div>
                </Card>

                <Card className="page-card-flush">
                    <Spin spinning={topicsLoading}>
                        <Table
                            columns={columns}
                            dataSource={topics}
                            rowKey="id"
                            size="middle"
                            className="sys-table"
                            pagination={{ pageSize: 10 }}
                        />
                    </Spin>
                </Card>

                <Modal
                    title={`Phân công GVPB - ${selectedTopic?.title}`}
                    open={assignReviewerModalVisible}
                    onOk={handleAssignReviewers}
                    onCancel={() => setAssignReviewerModalVisible(false)}
                    width={600}
                    okText="Xác nhận"
                >
                    <Form form={form} layout="vertical" className="mt-4">
                        <Form.Item
                            label="Giảng viên phản biện 1"
                            name="reviewer1Id"
                            rules={[{ required: true, message: 'Vui lòng chọn' }]}
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
                            rules={[{ required: true, message: 'Vui lòng chọn' }]}
                        >
                            <Select placeholder="Chọn GVPB 2" showSearch optionFilterProp="label">
                                {lecturers.filter(l => l.id !== selectedTopic?.supervisor_id).map(lec => (
                                    <Option key={lec.id} value={lec.id} label={lec.full_name}>
                                        {lec.full_name} ({lec.email})
                                    </Option>
                                ))}
                            </Select>
                        </Form.Item>
                    </Form>
                </Modal>
            </div>
        </div>
    );
};

export default HeadAssignReviewers;
