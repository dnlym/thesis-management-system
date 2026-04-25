import { useState } from 'react';
import { Card, Table, Button, Modal, Tag, Spin, Descriptions } from 'antd';
import { CheckCircleOutlined, EyeOutlined, LockOutlined } from '@ant-design/icons';
import { GradeBreakdown } from '@/components/GradeBreakdown';
import { useTopicGrades, useFinalizeGrades, useComputeFinalScore, useGradeSummary } from '@/hooks/useGrading';
import { useQueryClient } from '@tanstack/react-query';

const HeadFinalizeGrades = () => {
    const [detailModalVisible, setDetailModalVisible] = useState(false);
    const [selectedTopic, setSelectedTopic] = useState<any>(null);
    const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);

    const queryClient = useQueryClient();
    const { data: summaryData, isLoading } = useGradeSummary();
    
    // Show topics that are ready for finalization or already finalized
    const topics = [
        ...(summaryData?.ready || []),
        ...(summaryData?.finalized || [])
    ].map(topic => ({
        id: topic.id,
        title: topic.title,
        studentName: topic.students?.map((s: any) => s.full_name).join(', ') || 'N/A',

        hasAllGrades: topic.gradingStatus?.isReadyForDecision || topic.status === 'DEFENDED',
        isFinalized: !!topic.final_score,
        computedScore: topic.final_score?.final_score || null,
        rawTopic: topic
    }));

    // Fetch grades for selected topic
    const { data: detailGrades, isLoading: isLoadingDetails } = useTopicGrades(selectedTopic?.id);

    const finalizeMutation = useFinalizeGrades();
    const computeMutation = useComputeFinalScore();

    const viewDetail = (topic: any) => {
        setSelectedTopic(topic);
        if (topic.rawTopic?.students?.length > 0) {
            setSelectedStudentId(topic.rawTopic.students[0].id);
        }
        setDetailModalVisible(true);
    };

    const handleCompute = (topicId: string) => {
        computeMutation.mutate(topicId, {
            onSuccess: () => {
                queryClient.invalidateQueries({ queryKey: ['grading'] });
            }
        });
    };

    const handleFinalize = (topicId: string) => {
        Modal.confirm({
            title: 'Hoàn tất chấm điểm',
            content: 'Sau khi hoàn tất, điểm sẽ được công bố và KHÔNG THỂ sửa đổi. Bạn có chắc chắn?',
            okText: 'Xác nhận hoàn tất',
            cancelText: 'Hủy',
            okButtonProps: { danger: true },
            onOk: () => {
                finalizeMutation.mutate(topicId, {
                    onSuccess: () => {
                        queryClient.invalidateQueries({ queryKey: ['grading'] });
                    }
                });
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
                <h1 className="text-2xl font-bold text-foreground">Hoàn tất chấm điểm</h1>
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
                            {summaryData?.ready?.length || 0}
                        </div>
                    </div>
                </Card>
                <Card className="shadow-soft">
                    <div className="text-center">
                        <div className="text-sm text-gray-600 mb-1">Chưa đủ điểm</div>
                        <div className="text-3xl font-bold text-orange-600">
                            {(summaryData?.missingSupervisor?.length || 0) + (summaryData?.missingReviewer?.length || 0)}
                        </div>
                    </div>
                </Card>
                <Card className="shadow-soft">
                    <div className="text-center">
                        <div className="text-sm text-gray-600 mb-1">Đã hoàn tất</div>
                        <div className="text-3xl font-bold text-purple-600">
                            {summaryData?.finalized?.length || 0}
                        </div>
                    </div>
                </Card>
                <Card className="shadow-soft">
                    <div className="text-center">
                        <div className="text-sm text-gray-600 mb-1">Tổng cộng</div>
                        <div className="text-3xl font-bold text-blue-600">
                            {summaryData?.allTopics?.length || 0}
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

                        {/* Student Selector for multi-student topics */}
                        {selectedTopic.rawTopic?.students?.length > 1 && (
                            <div className="mb-4 p-3 bg-blue-50 rounded-lg border border-blue-100">
                                <span className="text-xs font-bold text-blue-600 uppercase block mb-2">Xem điểm cho sinh viên:</span>
                                <div className="flex flex-wrap gap-2">
                                    {selectedTopic.rawTopic.students.map((s: any) => (
                                        <Button 
                                            key={s.id}
                                            size="small"
                                            type={selectedStudentId === s.id ? 'primary' : 'default'}
                                            onClick={() => setSelectedStudentId(s.id)}
                                            className="rounded-full text-xs"
                                        >
                                            {s.full_name} ({s.student_code})
                                        </Button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Grade Breakdown */}
                        <div className="mt-4">
                            <h3 className="font-semibold mb-3">Chi tiết điểm:</h3>
                            <Spin spinning={isLoadingDetails}>
                                {detailGrades ? (
                                    <GradeBreakdown
                                        advisorGrade={detailGrades.advisorGrades?.find((g: any) => !g.student_id || g.student_id === selectedStudentId)}
                                        reviewerGrades={detailGrades.reviewerGrades?.filter((g: any) => !g.student_id || g.student_id === selectedStudentId) || []}
                                        councilGrades={detailGrades.councilGrades?.filter((g: any) => !g.student_id || g.student_id === selectedStudentId) || []}
                                        finalScore={detailGrades.finalScores?.find((fs: any) => fs.student_id === selectedStudentId)}
                                    />
                                ) : (
                                    <div className="py-10 text-center text-gray-400">Không tìm thấy dữ liệu điểm chi tiết</div>
                                )}
                            </Spin>
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
