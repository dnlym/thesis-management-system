import { Card, Spin, Empty, Descriptions, Timeline, Tag } from 'antd';
import { CheckCircleOutlined, ClockCircleOutlined, TrophyOutlined } from '@ant-design/icons';
import { GradeBreakdown } from '@/components/GradeBreakdown';
import { StatusBadge } from '@/components/StatusBadge';
import { useTopicGrades } from '@/hooks/useGrading';
import { useAuthStore } from '@/store/auth';

const StudentViewGrades = () => {
    const { user } = useAuthStore();

    // TODO: Get topicId from student's registration
    const topicId = 'topic-1';

    const { data: grades, isLoading } = useTopicGrades(topicId);

    if (isLoading) {
        return (
            <div className="p-6 flex justify-center items-center min-h-screen">
                <Spin size="large" />
            </div>
        );
    }

    if (!grades) {
        return (
            <div className="p-6">
                <Card>
                    <Empty description="Chưa có thông tin điểm" />
                </Card>
            </div>
        );
    }

    const { advisorGrade, reviewerGrades, councilGrades, finalScore } = grades;

    // Calculate progress
    const hasAdvisorGrade = !!advisorGrade;
    const hasReviewerGrades = reviewerGrades.length > 0;
    const hasCouncilGrades = councilGrades.length > 0;
    const isFinalized = finalScore?.finalized || false;

    return (
        <div className="p-6 space-y-6">
            <div>
                <h1 className="text-3xl font-bold text-foreground">Kết quả đánh giá</h1>
                <p className="text-muted-foreground">
                    Xem điểm chi tiết từ GVHD, GVPB và Hội đồng
                </p>
            </div>

            {/* Status Timeline */}
            <Card className="shadow-soft">
                <h3 className="text-lg font-semibold mb-4">Tiến trình chấm điểm</h3>
                <Timeline>
                    <Timeline.Item
                        dot={hasAdvisorGrade ? <CheckCircleOutlined className="text-green-500" /> : <ClockCircleOutlined />}
                        color={hasAdvisorGrade ? 'green' : 'gray'}
                    >
                        <div>
                            <div className="font-medium">Giảng viên hướng dẫn</div>
                            {hasAdvisorGrade ? (
                                <div className="text-green-600">✓ Đã chấm điểm</div>
                            ) : (
                                <div className="text-gray-500">Chưa chấm</div>
                            )}
                        </div>
                    </Timeline.Item>

                    <Timeline.Item
                        dot={hasReviewerGrades ? <CheckCircleOutlined className="text-green-500" /> : <ClockCircleOutlined />}
                        color={hasReviewerGrades ? 'green' : 'gray'}
                    >
                        <div>
                            <div className="font-medium">Giảng viên phản biện</div>
                            {hasReviewerGrades ? (
                                <div className="text-green-600">
                                    ✓ Đã chấm {reviewerGrades.length}/{2} phản biện
                                </div>
                            ) : (
                                <div className="text-gray-500">Chưa chấm</div>
                            )}
                        </div>
                    </Timeline.Item>

                    <Timeline.Item
                        dot={hasCouncilGrades ? <CheckCircleOutlined className="text-green-500" /> : <ClockCircleOutlined />}
                        color={hasCouncilGrades ? 'green' : 'gray'}
                    >
                        <div>
                            <div className="font-medium">Hội đồng bảo vệ</div>
                            {hasCouncilGrades ? (
                                <div className="text-green-600">
                                    ✓ Đã chấm {councilGrades.length}/{3} thành viên
                                </div>
                            ) : (
                                <div className="text-gray-500">Chưa bảo vệ</div>
                            )}
                        </div>
                    </Timeline.Item>

                    <Timeline.Item
                        dot={isFinalized ? <TrophyOutlined className="text-gold-500" /> : <ClockCircleOutlined />}
                        color={isFinalized ? 'gold' : 'gray'}
                    >
                        <div>
                            <div className="font-medium">Hoàn tất chấm điểm</div>
                            {isFinalized ? (
                                <div className="text-gold-600">✓ Đã công bố điểm chính thức</div>
                            ) : (
                                <div className="text-gray-500">Chưa hoàn tất</div>
                            )}
                        </div>
                    </Timeline.Item>
                </Timeline>
            </Card>

            {/* Quick Stats */}
            {finalScore && (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <Card className="shadow-soft">
                        <div className="text-center">
                            <div className="text-sm text-gray-600 mb-1">Điểm GVHD</div>
                            <div className="text-2xl font-bold text-blue-600">
                                {finalScore.advisorScore?.toFixed(2) || 'N/A'}
                            </div>
                            <div className="text-xs text-gray-500">Trọng số 40%</div>
                        </div>
                    </Card>

                    <Card className="shadow-soft">
                        <div className="text-center">
                            <div className="text-sm text-gray-600 mb-1">Điểm GVPB</div>
                            <div className="text-2xl font-bold text-green-600">
                                {finalScore.avgReviewerScore?.toFixed(2) || 'N/A'}
                            </div>
                            <div className="text-xs text-gray-500">Trọng số 40%</div>
                        </div>
                    </Card>

                    <Card className="shadow-soft">
                        <div className="text-center">
                            <div className="text-sm text-gray-600 mb-1">Điểm HĐ</div>
                            <div className="text-2xl font-bold text-purple-600">
                                {finalScore.avgCouncilScore?.toFixed(2) || 'N/A'}
                            </div>
                            <div className="text-xs text-gray-500">Trọng số 20%</div>
                        </div>
                    </Card>

                    <Card className="shadow-soft">
                        <div className="text-center">
                            <div className="text-sm text-gray-600 mb-1">Điểm cộng</div>
                            <div className="text-2xl font-bold text-orange-600">
                                {finalScore.extraPoints ? `+${finalScore.extraPoints.toFixed(2)}` : '0'}
                            </div>
                            <div className="text-xs text-gray-500">Thành tích</div>
                        </div>
                    </Card>
                </div>
            )}

            {/* Detailed Grades */}
            <GradeBreakdown
                advisorGrade={advisorGrade}
                reviewerGrades={reviewerGrades}
                councilGrades={councilGrades}
                finalScore={finalScore}
            />

            {/* Info Cards */}
            {!isFinalized && (
                <Card className="bg-yellow-50 border-yellow-200">
                    <div className="flex items-start space-x-3">
                        <ClockCircleOutlined className="text-yellow-600 text-xl mt-1" />
                        <div>
                            <h4 className="font-semibold text-yellow-900 mb-1">Điểm chưa được hoàn tất</h4>
                            <p className="text-sm text-yellow-800">
                                Điểm hiển thị có thể thay đổi cho đến khi Trưởng bộ môn hoàn tất chấm điểm.
                                Điểm chính thức sẽ được công bố sau khi hoàn tất.
                            </p>
                        </div>
                    </div>
                </Card>
            )}

            {isFinalized && (
                <Card className="bg-green-50 border-green-200">
                    <div className="flex items-start space-x-3">
                        <TrophyOutlined className="text-green-600 text-xl mt-1" />
                        <div>
                            <h4 className="font-semibold text-green-900 mb-1">Chúc mừng!</h4>
                            <p className="text-sm text-green-800">
                                Điểm của bạn đã được hoàn tất và công bố chính thức.
                                Kết quả này sẽ được lưu vào hồ sơ học tập.
                            </p>
                        </div>
                    </div>
                </Card>
            )}

            {/* Grading Info */}
            <Card title="Thông tin chấm điểm" className="shadow-soft">
                <Descriptions column={1} bordered>
                    <Descriptions.Item label="Công thức tính">
                        Điểm tổng = (GVHD × 40%) + (TB GVPB × 40%) + (TB HĐ × 20%) + Điểm cộng
                    </Descriptions.Item>
                    <Descriptions.Item label="Điểm tối đa">10.0</Descriptions.Item>
                    <Descriptions.Item label="Điểm cộng tối đa">1.0</Descriptions.Item>
                    <Descriptions.Item label="Phân loại">
                        <div className="space-y-1 text-sm">
                            <div>≥ 9.0: Xuất sắc</div>
                            <div>≥ 8.0: Giỏi</div>
                            <div>≥ 7.0: Khá</div>
                            <div>≥ 5.5: Trung bình</div>
                            <div>\u003c 5.5: Yếu (không đạt)</div>
                        </div>
                    </Descriptions.Item>
                </Descriptions>
            </Card>
        </div>
    );
};

export default StudentViewGrades;
