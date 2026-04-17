import { useState } from 'react';
import { Card, Table, Button, Modal, Form, Select, Tag, Spin, Descriptions } from 'antd';
import { notify } from '@/utils/notification';
import { UserAddOutlined, EyeOutlined, TeamOutlined } from '@ant-design/icons';
import { StatusBadge } from '@/components/StatusBadge';
// TODO: Import assignment hooks when created
// import { useTopics, useAssignReviewers, useAssignCommittee } from '@/hooks/useAssignments';

const { Option } = Select;

const HeadAssignReviewers = () => {
    const [assignReviewerModalVisible, setAssignReviewerModalVisible] = useState(false);
    const [assignCommitteeModalVisible, setAssignCommitteeModalVisible] = useState(false);
    const [selectedTopic, setSelectedTopic] = useState<any>(null);
    const [form] = Form.useForm();

    // TODO: Replace with real API
    const isLoading = false;
    const topics = [
        {
            id: '1',
            title: 'Nghiên cứu ứng dụng AI trong giáo dục',
            supervisorId: 'supervisor-1',
            status: 'REGISTERED',
            hasReviewers: false,
            hasCommittee: false,
        },
        {
            id: '2',
            title: 'Hệ thống quản lý học tập thông minh',
            supervisorId: 'supervisor-2',
            status: 'UNDER_REVIEW',
            hasReviewers: true,
            hasCommittee: false,
        },
    ];

    const lecturers = [
        { id: 'lec-1', name: 'TS. Nguyễn Văn A', department: 'CNTT' },
        { id: 'lec-2', name: 'ThS. Trần Thị B', department: 'CNTT' },
        { id: 'lec-3', name: 'TS. Lê Văn C', department: 'KHMT' },
        { id: 'lec-4', name: 'GS.TS. Phạm Thị D', department: 'CNTT' },
        { id: 'lec-5', name: 'TS. Hoàng Văn E', department: 'HTTT' },
    ];

    const openAssignReviewerModal = (topic: any) => {
        setSelectedTopic(topic);
        setAssignReviewerModalVisible(true);
    };

    const openAssignCommitteeModal = (topic: any) => {
        setSelectedTopic(topic);
        setAssignCommitteeModalVisible(true);
    };

    const handleAssignReviewers = async () => {
        try {
            const values = await form.validateFields();

            // TODO: Call API
            console.log('Assign reviewers:', values);
            notify.success('Phân công phản biện thành công');

            setAssignReviewerModalVisible(false);
            form.resetFields();
        } catch (error) {
            console.error('Validation failed:', error);
        }
    };

    const handleAssignCommittee = async () => {
        try {
            const values = await form.validateFields();

            // TODO: Call API
            console.log('Assign committee:', values);
            notify.success('Phân công hội đồng thành công');

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
            dataIndex: 'supervisorId',
            key: 'supervisor',
            render: (id: string) => 'GVHD ' + id.substring(0, 10),
        },
        {
            title: 'Trạng thái',
            dataIndex: 'status',
            key: 'status',
            render: (status: any) => <StatusBadge status={status} />,
        },
        {
            title: 'GVPB',
            dataIndex: 'hasReviewers',
            key: 'reviewers',
            render: (hasReviewers: boolean) => (
                hasReviewers ? (
                    <Tag color="green">Đã phân công</Tag>
                ) : (
                    <Tag color="orange">Chưa phân công</Tag>
                )
            ),
        },
        {
            title: 'Hội đồng',
            dataIndex: 'hasCommittee',
            key: 'committee',
            render: (hasCommittee: boolean) => (
                hasCommittee ? (
                    <Tag color="green">Đã phân công</Tag>
                ) : (
                    <Tag color="orange">Chưa phân công</Tag>
                )
            ),
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
                        disabled={record.hasReviewers}
                    >
                        Phân công GVPB
                    </Button>
                    <Button
                        type="link"
                        size="small"
                        icon={<TeamOutlined />}
                        onClick={() => openAssignCommitteeModal(record)}
                        disabled={record.hasCommittee}
                    >
                        Phân công HĐ
                    </Button>
                </div>
            ),
        },
    ];

    return (
        <div className="p-6 space-y-6">
            <div>
                <h1 className="text-3xl font-bold text-foreground">Phân công đánh giá</h1>
                <p className="text-muted-foreground">
                    Phân công giảng viên phản biện và hội đồng bảo vệ
                </p>
            </div>

            {/* Info Card */}
            <Card className="bg-blue-50 border-blue-200">
                <div className="space-y-2">
                    <h3 className="font-semibold text-blue-900">Nguyên tắc phân công</h3>
                    <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
                        <li>Mỗi đề tài cần 2 giảng viên phản biện (GVPB)</li>
                        <li>GVPB không được trùng với GVHD</li>
                        <li>Hội đồng gồm: 1 chủ tịch, 1 thư ký, 1-2 ủy viên</li>
                        <li>Chủ tịch hội đồng cần có học hàm/học vị cao</li>
                        <li>Thành viên hội đồng có thể trùng với GVPB</li>
                    </ul>
                </div>
            </Card>

            {/* Topics Table */}
            <Card className="shadow-soft">
                <Spin spinning={isLoading}>
                    <Table
                        columns={columns}
                        dataSource={topics}
                        rowKey="id"
                        pagination={{
                            pageSize: 10,
                            showTotal: (total) => `Tổng ${total} đề tài`,
                        }}
                        locale={{ emptyText: 'Chưa có đề tài nào' }}
                    />
                </Spin>
            </Card>

            {/* Assign Reviewers Modal */}
            <Modal
                title={`Phân công GVPB - ${selectedTopic?.title}`}
                open={assignReviewerModalVisible}
                onOk={handleAssignReviewers}
                onCancel={() => {
                    setAssignReviewerModalVisible(false);
                    form.resetFields();
                }}
                width={700}
                okText="Xác nhận phân công"
                cancelText="Hủy"
            >
                <Form form={form} layout="vertical" className="mt-4">
                    <Form.Item
                        label="Giảng viên phản biện 1"
                        name="reviewer1Id"
                        rules={[{ required: true, message: 'Vui lòng chọn GVPB 1' }]}
                    >
                        <Select
                            placeholder="Chọn giảng viên phản biện 1"
                            showSearch
                            optionFilterProp="label"
                        >
                            {lecturers.map(lec => (
                                <Option key={lec.id} value={lec.id} label={lec.name}>
                                    {lec.name} ({lec.department})
                                </Option>
                            ))}
                        </Select>
                    </Form.Item>

                    <Form.Item
                        label="Giảng viên phản biện 2"
                        name="reviewer2Id"
                        rules={[
                            { required: true, message: 'Vui lòng chọn GVPB 2' },
                            ({ getFieldValue }) => ({
                                validator(_, value) {
                                    if (!value || getFieldValue('reviewer1Id') !== value) {
                                        return Promise.resolve();
                                    }
                                    return Promise.reject(new Error('GVPB 2 phải khác GVPB 1'));
                                },
                            }),
                        ]}
                    >
                        <Select
                            placeholder="Chọn giảng viên phản biện 2"
                            showSearch
                            optionFilterProp="label"
                        >
                            {lecturers.map(lec => (
                                <Option key={lec.id} value={lec.id} label={lec.name}>
                                    {lec.name} ({lec.department})
                                </Option>
                            ))}
                        </Select>
                    </Form.Item>

                    <div className="bg-yellow-50 border border-yellow-200 rounded p-3">
                        <p className="text-sm text-yellow-800">
                            <strong>Lưu ý:</strong> GVPB sẽ nhận thông báo và cần phản hồi chấp nhận/từ chối trong vòng 3 ngày.
                        </p>
                    </div>
                </Form>
            </Modal>

            {/* Assign Committee Modal */}
            <Modal
                title={`Phân công Hội đồng - ${selectedTopic?.title}`}
                open={assignCommitteeModalVisible}
                onOk={handleAssignCommittee}
                onCancel={() => {
                    setAssignCommitteeModalVisible(false);
                    form.resetFields();
                }}
                width={700}
                okText="Xác nhận phân công"
                cancelText="Hủy"
            >
                <Form form={form} layout="vertical" className="mt-4">
                    <Form.Item
                        label="Chủ tịch hội đồng"
                        name="chairId"
                        rules={[{ required: true, message: 'Vui lòng chọn chủ tịch' }]}
                    >
                        <Select placeholder="Chọn chủ tịch hội đồng" showSearch>
                            {lecturers.map(lec => (
                                <Option key={lec.id} value={lec.id}>
                                    {lec.name} ({lec.department})
                                </Option>
                            ))}
                        </Select>
                    </Form.Item>

                    <Form.Item
                        label="Thư ký"
                        name="secretaryId"
                        rules={[{ required: true, message: 'Vui lòng chọn thư ký' }]}
                    >
                        <Select placeholder="Chọn thư ký" showSearch>
                            {lecturers.map(lec => (
                                <Option key={lec.id} value={lec.id}>
                                    {lec.name} ({lec.department})
                                </Option>
                            ))}
                        </Select>
                    </Form.Item>

                    <Form.Item
                        label="Ủy viên"
                        name="memberIds"
                        rules={[{ required: true, message: 'Vui lòng chọn ít nhất 1 ủy viên' }]}
                    >
                        <Select mode="multiple" placeholder="Chọn các ủy viên" showSearch>
                            {lecturers.map(lec => (
                                <Option key={lec.id} value={lec.id}>
                                    {lec.name} ({lec.department})
                                </Option>
                            ))}
                        </Select>
                    </Form.Item>

                    <div className="bg-blue-50 border border-blue-200 rounded p-3">
                        <p className="text-sm text-blue-800">
                            <strong>Gợi ý:</strong> Chủ tịch hội đồng nên là giảng viên có học hàm/học vị cao (GS, PGS).
                            Ủy viên có thể trùng với GVPB đã được phân công.
                        </p>
                    </div>
                </Form>
            </Modal>
        </div>
    );
};

export default HeadAssignReviewers;
