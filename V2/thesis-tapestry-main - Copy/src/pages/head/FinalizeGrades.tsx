import { useState } from 'react';
import { Card, Table, Button, Modal, Tag, Spin, Descriptions } from 'antd';
import { CheckCircleOutlined, EyeOutlined, LockOutlined } from '@ant-design/icons';
import { GradeBreakdown } from '@/components/GradeBreakdown';
import { StatusBadge } from '@/components/StatusBadge';
import { useTopicGrades, useFinalizeGrades, useComputeFinalScore } from '@/hooks/useGrading';

const HeadFinalizeGrades = () => {
    const [detailModalVisible, setDetailModalVisible] = useState(false);
    const [selectedTopic, setSelectedTopic] = useState<any>(null);

    // TODO: Get list of topics ready for finalization
    const isLoading = false;
    const topics = [
        {
            id: '1',
            title: 'Nghiên cứu ứng dụng AI trong giáo dục',
            studentName: 'Nguyễn Văn A',
            hasAllGrades: true,
            isFinalized: false,
            computedScore: 8.5,
        },
        {
            id: '2',
            title: 'Hệ thống quản lý học tập thông minh',
            studentName: 'Trần Thị B',
            hasAllGrades: true,
            isFinalized: true,
            computedScore: 8.2,
        },
        {
            id: '3',
            title: 'Ứng dụng blockchain trong quản lý dữ liệu',
            studentName: 'Lê Văn C',
            hasAllGrades: false,
            isFinalized: false,
            computedScore: null,
        },
    ];

    const finalizeMutation = useFinalizeGrades();
    const computeMutation = useComputeFinalScore();

    const viewDetail = (topic: any) => {
        setSelectedTopic(topic);
        setDetailModalVisible(true);
    };

    const handleCompute = (topicId: string) => {
        computeMutation.mutate(topicId);
    };

    const handleFinalize = (topicId: string) => {
        Modal.confirm({
            title: 'Hoàn tất chấm điểm',
            content: 'Sau khi hoàn tất, điểm sẽ được công bố và KHÔNG THỂ sửa đổi. Bạn có chắc chắn?',
            okText: 'Xác nhận hoàn tất',
            cancelText: 'Hủy',
            okButtonProps: { danger: true },
            onOk: () => {
                finalizeMutation.mutate(topicId);
            },
        });
    };

    const getClassification = (score: number) => {
        if (score >= 9.0) return { text: 'Xuất sắc', color: 'purple' };
        if (score >= 8.0) return { text: 'Giỏi', color: 'green' };
        if (score >= 7.0) return { text: 'Khá', color: 'blue' };
        if (score >= 5.5) return { text: 'Trung bình', color: 'orange' };
        return { text: 'Yếu', color: 'red' };
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
            title: 'Sinh viên',
            dataIndex: 'studentName',
            key: 'student',
        },
        {
            title: 'Điểm tổng',
            dataIndex: 'computedScore',
            key: 'score',
            render: (score: number | null) => (
                score !== null ? (
                    <div className="space-y-1">
                        <div className="text-lg font-bold">{score.toFixed(2)}</div>
                        <Tag color={getClassification(score).color}>
                            {getClassification(score).text}
                        </Tag>
                    </div>
                ) : (
                    <Tag color="default">Chưa tính</Tag>
                )
            ),
        },
        {
            title: 'Trạng thái điểm',
            dataIndex: 'hasAllGrades',
            key: 'gradeStatus',
            render: (hasAll: boolean) => (
                hasAll ? (
                    <Tag color="green" icon={<CheckCircleOutlined />}>Đủ điểm</Tag>
                ) : (
                    <Tag color="orange">Chưa đủ</Tag>
                )
            ),
        },
        {
            title: 'Hoàn tất',
            dataIndex: 'isFinalized',
            key: 'finalized',
            render: (finalized: boolean) => (
                finalized ? (
                    <Tag color="purple" icon={<LockOutlined />}>Đã hoàn tất</Tag>
                ) : (
                    <Tag>Chưa hoàn tất</Tag>
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
                        icon={<EyeOutlined />}
                        onClick={() => viewDetail(record)}
                    >
                        Chi tiết
                    </Button>
                    {record.hasAllGrades && !record.isFinalized && (
                        <>
                            {!record.computedScore && (
                                <Button
                                    type="link"
                                    size="small"
                                    onClick={() => handleCompute(record.id)}
                                    loading={computeMutation.isPending}
                                >
                                    Tính điểm
                                </Button>
                            )}
                            {record.computedScore && (
                                <Button
                                    type="primary"
                                    size="small"
                                    onClick={() => handleFinalize(record.id)}
                                    loading={finalizeMutation.isPending}
                                >
                                    Hoàn tất
                                </Button>
                            )}
                        </>
                    )}
                </div>
            ),
        },
    ];

    return (
        <div className="p-6 space-y-6">
            <div>
                <h1 className="text-3xl font-bold text-foreground">Hoàn tất chấm điểm</h1>
                <p className="text-muted-foreground">
                    Tính toán điểm tổng và hoàn tất quá trình chấm điểm
                </p>
            </div>

            {/* Info Card */}
            <Card className="bg-blue-50 border-blue-200">
                <div className="space-y-2">
                    <h3 className="font-semibold text-blue-900">Quy trình hoàn tất</h3>
                    <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
                        <li>Kiểm tra đề tài đã có đủ điểm: GVHD, GVPB (2), Hội đồng (≥3)</li>
                        <li>Nhấn "Tính điểm" để hệ thống tự động tính theo công thức</li>
                        <li>Xem chi tiết và xác minh điểm tính đúng</li>
                        <li>Nhấn "Hoàn tất" để công bố điểm chính thức</li>
                        <li><strong>Lưu ý:</strong> Sau khi hoàn tất, điểm KHÔNG THỂ thay đổi</li>
                    </ol>
                </div>
            </Card>

            {/* Statistics */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card className="shadow-soft">
                    <div className="text-center">
                        <div className="text-sm text-gray-600 mb-1">Đủ điểm</div>
                        <div className="text-3xl font-bold text-green-600">
                            {topics.filter(t => t.hasAllGrades).length}
                        </div>
                    </div>
                </Card>
                <Card className="shadow-soft">
                    <div className="text-center">
                        <div className="text-sm text-gray-600 mb-1">Chưa đủ điểm</div>
                        <div className="text-3xl font-bold text-orange-600">
                            {topics.filter(t => !t.hasAllGrades).length}
                        </div>
                    </div>
                </Card>
                <Card className="shadow-soft">
                    <div className="text-center">
                        <div className="text-sm text-gray-600 mb-1">Đã hoàn tất</div>
                        <div className="text-3xl font-bold text-purple-600">
                            {topics.filter(t => t.isFinalized).length}
                        </div>
                    </div>
                </Card>
                <Card className="shadow-soft">
                    <div className="text-center">
                        <div className="text-sm text-gray-600 mb-1">Tổng cộng</div>
                        <div className="text-3xl font-bold text-blue-600">
                            {topics.length}
                        </div>
                    </div>
                </Card>
            </div>

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

            {/* Detail Modal */}
            <Modal
                title={`Chi tiết điểm - ${selectedTopic?.title}`}
                open={detailModalVisible}
                onCancel={() => setDetailModalVisible(false)}
                footer={[
                    <Button key="close" onClick={() => setDetailModalVisible(false)}>
                        Đóng
                    </Button>,
                    selectedTopic?.hasAllGrades && !selectedTopic?.isFinalized && (
                        <>
                            {!selectedTopic?.computedScore && (
                                <Button
                                    key="compute"
                                    type="primary"
                                    onClick={() => {
                                        handleCompute(selectedTopic.id);
                                        setDetailModalVisible(false);
                                    }}
                                    loading={computeMutation.isPending}
                                >
                                    Tính điểm
                                </Button>
                            )}
                            {selectedTopic?.computedScore && (
                                <Button
                                    key="finalize"
                                    type="primary"
                                    danger
                                    onClick={() => {
                                        handleFinalize(selectedTopic.id);
                                        setDetailModalVisible(false);
                                    }}
                                    loading={finalizeMutation.isPending}
                                >
                                    Hoàn tất chấm điểm
                                </Button>
                            )}
                        </>
                    ),
                ]}
                width={900}
            >
                {selectedTopic && (
                    <div className="space-y-4">
                        <Descriptions bordered column={2}>
                            <Descriptions.Item label="Sinh viên" span={2}>
                                {selectedTopic.studentName}
                            </Descriptions.Item>
                            <Descriptions.Item label="Đề tài" span={2}>
                                {selectedTopic.title}
                            </Descriptions.Item>
                            <Descriptions.Item label="Trạng thái điểm">
                                {selectedTopic.hasAllGrades ? (
                                    <Tag color="green" icon={<CheckCircleOutlined />}>Đủ điểm</Tag>
                                ) : (
                                    <Tag color="orange">Chưa đủ điểm</Tag>
                                )}
                            </Descriptions.Item>
                            <Descriptions.Item label="Hoàn tất">
                                {selectedTopic.isFinalized ? (
                                    <Tag color="purple" icon={<LockOutlined />}>Đã hoàn tất</Tag>
                                ) : (
                                    <Tag>Chưa hoàn tất</Tag>
                                )}
                            </Descriptions.Item>
                        </Descriptions>

                        {/* Grade Breakdown - Mock data, replace with real API call */}
                        <div className="mt-4">
                            <h3 className="font-semibold mb-3">Chi tiết điểm:</h3>
                            <GradeBreakdown
                                advisorGrade={{
                                    id: '1',
                                    topicId: selectedTopic.id,
                                    raterRole: 'ADVISOR',
                                    totalScore: 8.5,
                                    scores: [],
                                    submittedAt: new Date().toISOString(),
                                }}
                                reviewerGrades={[
                                    {
                                        id: '2',
                                        topicId: selectedTopic.id,
                                        raterRole: 'REVIEWER',
                                        totalScore: 8.3,
                                        scores: [],
                                        submittedAt: new Date().toISOString(),
                                    },
                                    {
                                        id: '3',
                                        topicId: selectedTopic.id,
                                        raterRole: 'REVIEWER',
                                        totalScore: 8.7,
                                        scores: [],
                                        submittedAt: new Date().toISOString(),
                                    },
                                ]}
                                councilGrades={[
                                    {
                                        id: '4',
                                        topicId: selectedTopic.id,
                                        raterRole: 'COUNCIL_MEMBER',
                                        totalScore: 8.4,
                                        scores: [],
                                        submittedAt: new Date().toISOString(),
                                    },
                                    {
                                        id: '5',
                                        topicId: selectedTopic.id,
                                        raterRole: 'COUNCIL_MEMBER',
                                        totalScore: 8.6,
                                        scores: [],
                                        submittedAt: new Date().toISOString(),
                                    },
                                ]}
                                finalScore={
                                    selectedTopic.computedScore
                                        ? {
                                            topicId: selectedTopic.id,
                                            advisorScore: 8.5,
                                            avgReviewerScore: 8.5,
                                            avgCouncilScore: 8.5,
                                            extraPoints: 0.5,
                                            finalScore: selectedTopic.computedScore,
                                            classification: getClassification(selectedTopic.computedScore).text as any,
                                            finalized: selectedTopic.isFinalized,
                                            finalizedAt: selectedTopic.isFinalized ? new Date().toISOString() : null,
                                        }
                                        : undefined
                                }
                            />
                        </div>

                        {!selectedTopic.isFinalized && (
                            <div className="bg-yellow-50 border border-yellow-200 rounded p-4">
                                <p className="text-sm text-yellow-800">
                                    <strong>Lưu ý:</strong> Sau khi hoàn tất, điểm sẽ được công bố chính thức và
                                    KHÔNG THỂ thay đổi. Vui lòng kiểm tra kỹ trước khi hoàn tất.
                                </p>
                            </div>
                        )}
                    </div>
                )}
            </Modal>
        </div>
    );
};

export default HeadFinalizeGrades;
