import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Card, Tag, Button, Typography, Space, Progress,
  Row, Col, Statistic, Input, Drawer,
  Empty, Spin, Avatar, Tabs, Popconfirm,
} from 'antd';
import {
  CheckCircleOutlined, ClockCircleOutlined, FireOutlined,
  LockOutlined, SearchOutlined, TrophyOutlined,
  UserOutlined, RightOutlined, EyeOutlined,
  BarChartOutlined, MoreOutlined, CheckOutlined
} from '@ant-design/icons';
import { GradingApi } from '@/api/grading';
import { notify } from '@/utils/notification';
import { useNavigate } from 'react-router-dom';

const { Title, Text } = Typography;

const GradeSummary = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [selectedTopicId, setSelectedTopicId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['grade-summary'],
    queryFn: () => GradingApi.getGradeSummary(),
  });

  const topics = data?.allTopics || [];

  const finalizeMutation = useMutation({
    mutationFn: (topicId: string) => GradingApi.finalizeGrades(topicId),
    onSuccess: () => {
      notify.success('Đã xác nhận và chốt điểm thành công!');
      queryClient.invalidateQueries({ queryKey: ['grade-summary'] });
      setSelectedTopicId(null);
    },
    onError: (err: any) => {
      notify.error(err.message || 'Không thể chốt điểm');
    },
  });

  const filteredTopics = useMemo(() => {
    let result = topics;
    
    // Filter by Tab
    if (filter === 'ready') result = result.filter((t: any) => t.gradingStatus?.isReadyForDecision && !t.gradingStatus?.isFinalized);
    if (filter === 'missing_supervisor') result = result.filter((t: any) => !t.gradingStatus?.supervisorGraded);
    if (filter === 'missing_reviewer') result = result.filter((t: any) => t.gradingStatus?.supervisorGraded && !t.gradingStatus?.isReviewerComplete);
    if (filter === 'missing_committee') result = result.filter((t: any) => t.gradingStatus?.isReviewerComplete && t.gradingStatus?.committeeCount === 0);
    if (filter === 'finalized') result = result.filter((t: any) => t.gradingStatus?.isFinalized);

    // Search
    if (search) {
      const q = search.toLowerCase();
      result = result.filter((t: any) =>
        t.title?.toLowerCase().includes(q) ||
        t.code?.toLowerCase().includes(q) ||
        t.students?.some((s: any) => s.full_name?.toLowerCase().includes(q) || s.student_code?.includes(q))
      );
    }
    return result;
  }, [topics, filter, search]);

  const stats = useMemo(() => ({
    total: topics.length,
    ready: topics.filter((t: any) => t.gradingStatus?.isReadyForDecision && !t.gradingStatus?.isFinalized).length,
    incomplete: topics.filter((t: any) => !t.gradingStatus?.isReadyForDecision && !t.gradingStatus?.isFinalized).length,
    finalized: topics.filter((t: any) => t.gradingStatus?.isFinalized).length,
  }), [topics]);

  if (isLoading) return <div className="p-12 text-center"><Spin size="large" tip="Đang tải dữ liệu..." /></div>;

  return (
    <div className="p-6 bg-[#f8fafc] min-h-screen">
      <div className="max-w-[1400px] mx-auto">
        {/* Header Section */}
        <div className="mb-8">
          <div className="flex justify-between items-start mb-6">
            <div>
              <Title level={2} className="!mb-1 flex items-center gap-3">
                <TrophyOutlined className="text-blue-600" />
                Tổng kết & Xác nhận điểm
              </Title>
              <Text type="secondary" className="text-lg">Xem, tổng hợp điểm và chốt điểm khóa luận tốt nghiệp</Text>
            </div>
            <div className="flex items-center gap-4">
              <Input
                placeholder="Tìm mã đề tài, tên đề tài, sinh viên..."
                prefix={<SearchOutlined className="text-gray-400" />}
                className="w-[350px] h-11 rounded-xl shadow-sm border-none"
                value={search}
                onChange={e => setSearch(e.target.value)}
                allowClear
              />
              <Avatar size={44} icon={<UserOutlined />} className="bg-blue-600 cursor-pointer shadow-md" />
            </div>
          </div>

          {/* Stats Row */}
          <Row gutter={24}>
            <Col span={6}>
              <Card className="rounded-2xl border-none shadow-sm hover:shadow-md transition-all">
                <Statistic
                  title={<Text className="text-gray-500 font-medium">Tất cả đề tài</Text>}
                  value={stats.total}
                  prefix={<div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center mr-3"><BarChartOutlined className="text-blue-600" /></div>}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card className="rounded-2xl border-none shadow-sm hover:shadow-md transition-all">
                <Statistic
                  title={<Text className="text-gray-500 font-medium">Sẵn sàng chốt</Text>}
                  value={stats.ready}
                  prefix={<div className="w-10 h-10 bg-green-50 rounded-lg flex items-center justify-center mr-3"><FireOutlined className="text-green-600" /></div>}
                  valueStyle={{ color: '#059669' }}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card className="rounded-2xl border-none shadow-sm hover:shadow-md transition-all">
                <Statistic
                  title={<Text className="text-gray-500 font-medium">Chưa đủ điểm</Text>}
                  value={stats.incomplete}
                  prefix={<div className="w-10 h-10 bg-orange-50 rounded-lg flex items-center justify-center mr-3"><ClockCircleOutlined className="text-orange-600" /></div>}
                  valueStyle={{ color: '#d97706' }}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card className="rounded-2xl border-none shadow-sm hover:shadow-md transition-all">
                <Statistic
                  title={<Text className="text-gray-500 font-medium">Đã chốt điểm</Text>}
                  value={stats.finalized}
                  prefix={<div className="w-10 h-10 bg-gray-50 rounded-lg flex items-center justify-center mr-3"><LockOutlined className="text-gray-600" /></div>}
                  valueStyle={{ color: '#4b5563' }}
                />
              </Card>
            </Col>
          </Row>
        </div>

        {/* Filter Tabs */}
        <div className="bg-white p-2 rounded-2xl shadow-sm mb-6 flex justify-between items-center">
          <Tabs
            activeKey={filter}
            onChange={setFilter}
            className="px-4 border-none grade-tabs"
            items={[
              { key: 'all', label: `Tất cả (${stats.total})` },
              { key: 'ready', label: `Sẵn sàng chốt (${stats.ready})` },
              { key: 'missing_supervisor', label: `Thiếu GVHD` },
              { key: 'missing_reviewer', label: `Thiếu phản biện` },
              { key: 'missing_committee', label: `Thiếu hội đồng` },
              { key: 'finalized', label: `Đã chốt (${stats.finalized})` },
            ]}
          />
          <Button icon={<MoreOutlined />} type="text" className="mr-4" />
        </div>

        {/* List of Cards */}
        <div className="space-y-4">
          {filteredTopics.length > 0 ? (
            filteredTopics.map((topic: any) => (
              <TopicCard
                key={topic.id}
                topic={topic}
                onViewDetails={() => setSelectedTopicId(topic.id)}
                onFinalize={() => finalizeMutation.mutate(topic.id)}
                isFinalizing={finalizeMutation.isPending && selectedTopicId === topic.id}
              />
            ))
          ) : (
            <Empty description="Không tìm thấy đề tài nào" className="bg-white p-12 rounded-2xl" />
          )}
        </div>
      </div>

      {/* Grade Detail Drawer */}
      <GradeDetailDrawer
        topicId={selectedTopicId}
        onClose={() => setSelectedTopicId(null)}
        onFinalize={(id: string) => finalizeMutation.mutate(id)}
        isFinalizing={finalizeMutation.isPending}
      />

      <style>{`
        .grade-tabs .ant-tabs-nav::before { border-bottom: none !important; }
        .grade-tabs .ant-tabs-tab { border-radius: 8px !important; margin-right: 8px !important; transition: all 0.3s; padding: 8px 16px !important; }
        .grade-tabs .ant-tabs-tab-active { background: #eff6ff !important; }
        .grade-tabs .ant-tabs-tab-active .ant-tabs-tab-btn { color: #2563eb !important; font-weight: 700 !important; }
        .grade-tabs .ant-tabs-ink-bar { display: none !important; }
      `}</style>
    </div>
  );
};

/**
 * Layer 1: Topic Card Component
 */
const TopicCard = ({ topic, onViewDetails, onFinalize, isFinalizing }: any) => {
  const gs = topic.gradingStatus;
  const isComplete = gs?.isReadyForDecision;
  const isFinalized = gs?.isFinalized;

  const getStatusBadge = () => {
    if (isFinalized) return <Tag color="default" className="rounded-full px-3 py-0.5 border-none bg-gray-100 text-gray-500 font-medium">Đã chốt điểm</Tag>;
    if (isComplete) return <Tag color="success" className="rounded-full px-3 py-0.5 border-none bg-green-50 text-green-600 font-medium">Sẵn sàng chốt</Tag>;
    if (!gs?.supervisorGraded) return <Tag color="warning" className="rounded-full px-3 py-0.5 border-none bg-orange-50 text-orange-600 font-medium">Thiếu GVHD</Tag>;
    if (!gs?.isReviewerComplete) return <Tag color="warning" className="rounded-full px-3 py-0.5 border-none bg-orange-50 text-orange-600 font-medium">Thiếu phản biện</Tag>;
    return <Tag color="warning" className="rounded-full px-3 py-0.5 border-none bg-orange-50 text-orange-600 font-medium">Thiếu hội đồng</Tag>;
  };

  // Calculate overall percentage
  const totalSteps = 3;
  let doneCount = 0;
  if (gs?.supervisorGraded) doneCount++;
  if (gs?.isReviewerComplete) doneCount++;
  if (gs?.committeeCount > 0) doneCount++;
  const percent = Math.round((doneCount / totalSteps) * 100);

  return (
    <Card className="rounded-2xl border-none shadow-sm hover:shadow-md transition-all overflow-hidden p-0 topic-summary-card">
      <Row align="middle" gutter={24} className="p-5">
        {/* Info Column */}
        <Col span={8}>
          <div className="flex gap-3 mb-2 items-center">
            <Text className="bg-gray-100 px-2 py-0.5 rounded text-xs font-mono text-gray-600">{topic.code}</Text>
            {getStatusBadge()}
          </div>
          <Title level={5} className="!mb-1 line-clamp-1">{topic.title}</Title>
          <Text type="secondary" className="text-xs">GVHD: {topic.supervisor?.full_name}</Text>
        </Col>

        {/* Students Column */}
        <Col span={5}>
          <div className="flex items-center gap-2 mb-2">
            <UserOutlined className="text-gray-400" />
            <Text className="text-xs font-medium text-gray-500">{topic.students?.length} sinh viên</Text>
          </div>
          <div className="space-y-1">
            {topic.students?.map((s: any) => (
              <div key={s.id} className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                <Text className="text-xs truncate w-full">{s.full_name} <span className="text-gray-400">({s.student_code})</span></Text>
              </div>
            ))}
          </div>
        </Col>

        {/* Progress Column */}
        <Col span={5}>
          <div className="space-y-2">
            <div className="flex justify-between items-center text-xs font-medium px-1">
              <div className="flex items-center gap-1">
                {gs?.supervisorGraded ? <CheckCircleOutlined className="text-green-500" /> : <ClockCircleOutlined className="text-gray-300" />}
                <span className={gs?.supervisorGraded ? 'text-green-600' : 'text-gray-400'}>GVHD</span>
              </div>
              <div className="flex items-center gap-1">
                {gs?.isReviewerComplete ? <CheckCircleOutlined className="text-green-500" /> : <ClockCircleOutlined className="text-gray-300" />}
                <span className={gs?.isReviewerComplete ? 'text-green-600' : 'text-gray-400'}>PB ({gs?.reviewerGradedCount}/{gs?.totalReviewersRequired})</span>
              </div>
              <div className="flex items-center gap-1">
                {gs?.committeeCount > 0 ? <CheckCircleOutlined className="text-green-500" /> : <ClockCircleOutlined className="text-gray-300" />}
                <span className={gs?.committeeCount > 0 ? 'text-green-600' : 'text-gray-400'}>HĐ</span>
              </div>
            </div>
            <Progress percent={percent} showInfo={false} strokeColor={percent === 100 ? '#10b981' : '#3b82f6'} strokeWidth={6} className="m-0" />
            <div className="text-xs text-right text-gray-400 font-bold">{percent}% hoàn thành</div>
          </div>
        </Col>

        {/* Score Column */}
        <Col span={3} className="text-center border-l border-gray-100">
          {isFinalized || isComplete ? (
            <div>
              <div className="text-xs uppercase tracking-wider text-gray-400 font-bold mb-1">Tổng điểm dự kiến</div>
              <div className="text-2xl font-black text-green-600 leading-none mb-1">
                {topic.students?.[0]?.finalScore?.final_score?.toFixed(2) || '—'}
              </div>
              <Tag color="success" className="text-xs font-bold border-none bg-green-50 text-green-700 px-2 py-0">
                {topic.students?.[0]?.finalScore?.grade_classification || '—'}
              </Tag>
            </div>
          ) : (
            <div>
              <div className="text-xs uppercase tracking-wider text-gray-400 font-bold mb-1">Tổng điểm dự kiến</div>
              <div className="text-2xl font-bold text-gray-300">—</div>
              <Text className="text-xs text-gray-400 italic">Chưa tính</Text>
            </div>
          )}
        </Col>

        {/* Actions Column */}
        <Col span={3} className="flex flex-col gap-2">
          {isFinalized ? (
            <Button icon={<EyeOutlined />} className="rounded-lg h-9 border-gray-200" onClick={onViewDetails}>Xem kết quả</Button>
          ) : (
            <>
              <Button icon={<EyeOutlined />} className="rounded-lg h-9 border-gray-200" onClick={onViewDetails}>Xem điểm</Button>
              {isComplete && (
                <Popconfirm title="Chốt điểm đề tài này?" onConfirm={onFinalize} okText="Chốt điểm" cancelText="Hủy">
                  <Button type="primary" className="bg-blue-600 rounded-lg h-9 shadow-md shadow-blue-100" loading={isFinalizing}>Chốt điểm</Button>
                </Popconfirm>
              )}
            </>
          )}
        </Col>
      </Row>
    </Card>
  );
};

/**
 * Layer 2: Grade Detail Drawer
 */
const GradeDetailDrawer = ({ topicId, onClose, onFinalize, isFinalizing }: any) => {
  const { data: details, isLoading } = useQuery({
    queryKey: ['topic-grades', topicId],
    queryFn: () => GradingApi.getTopicGrades(topicId!),
    enabled: !!topicId,
  });

  const topic = details?.topic;
  const finalScore = details?.finalScore;
  const isComplete = topic?.gradingStatus?.isReadyForDecision;
  const isFinalized = topic?.gradingStatus?.isFinalized;

  return (
    <Drawer
      title={null}
      placement="right"
      width={600}
      onClose={onClose}
      open={!!topicId}
      className="grade-drawer"
      styles={{ body: { padding: 0 } }}
    >
      {isLoading ? (
        <div className="h-full flex flex-col items-center justify-center bg-gray-50">
          <Spin size="large" tip="Đang tải chi tiết điểm..." />
        </div>
      ) : (
        <div className="flex flex-col h-full bg-[#f8fafc]">
          {/* Drawer Header */}
          <div className="p-6 bg-white border-b sticky top-0 z-10 shadow-sm">
            <div className="flex justify-between items-start mb-4">
              <Space direction="vertical" size={2}>
                <div className="flex items-center gap-2">
                  <Tag color="blue" className="font-mono">{topic?.code}</Tag>
                  {isFinalized ? (
                    <Tag color="default" className="rounded-full bg-gray-100 text-gray-500 border-none font-bold">Đã chốt điểm</Tag>
                  ) : isComplete ? (
                    <Tag color="success" className="rounded-full bg-green-50 text-green-600 border-none font-bold">Sẵn sàng chốt</Tag>
                  ) : (
                    <Tag color="warning" className="rounded-full bg-orange-50 text-orange-600 border-none font-bold">Chưa đủ điểm</Tag>
                  )}
                </div>
                <Title level={4} className="!m-0 line-clamp-2 pr-8">{topic?.title}</Title>
                <Text type="secondary">GVHD: {topic?.supervisor?.full_name}</Text>
              </Space>
              <Button icon={<RightOutlined />} type="text" onClick={onClose} className="hover:bg-gray-100" />
            </div>

            <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100">
              <Text className="text-xs uppercase font-black text-blue-400 block mb-3">Sinh viên thực hiện ({topic?.students?.length})</Text>
              <Row gutter={16}>
                {topic?.students?.map((s: any) => (
                  <Col span={12} key={s.id}>
                    <div className="flex items-center gap-3">
                      <Avatar className="bg-blue-600 text-white font-bold" size={32}>
                        {s.full_name?.charAt(0)}
                      </Avatar>
                      <div>
                        <div className="text-sm font-bold text-gray-800">{s.full_name}</div>
                        <div className="text-xs text-gray-500 font-medium">{s.student_code}</div>
                      </div>
                    </div>
                  </Col>
                ))}
              </Row>
            </div>
          </div>

          {/* Drawer Body - Detailed Scores */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            <Text className="text-xs uppercase font-black text-gray-400 tracking-widest block">Điểm thành phần</Text>

            <section>
              <div className="flex items-center justify-between mb-3 px-1">
                <Title level={5} className="!m-0 text-sm font-bold text-gray-700">1. Điểm hướng dẫn (GVHD)</Title>
                {details?.advisorGrade ? <Tag color="success" icon={<CheckOutlined />} className="border-none bg-green-50 text-green-600 rounded-full text-xs font-bold">Đã chấm</Tag> : <Tag color="default" className="border-none bg-gray-100 text-gray-400 rounded-full text-xs">Chưa chấm</Tag>}
              </div>
              <Card size="small" className="rounded-xl border-none shadow-sm overflow-hidden">
                <div className="flex justify-between items-center py-2 px-3">
                  <Text className="font-medium text-gray-600">{topic?.supervisor?.full_name}</Text>
                  <Text className="text-xl font-black text-blue-600">{details?.advisorGrade?.scores?.[0]?.score?.toFixed(2) || '—'}</Text>
                </div>
              </Card>
            </section>

            <section>
              <div className="flex items-center justify-between mb-3 px-1">
                <Title level={5} className="!m-0 text-sm font-bold text-gray-700">2. Điểm phản biện</Title>
                <Tag className="border-none bg-blue-50 text-blue-600 rounded-full text-xs font-bold">
                  {details?.reviewerGrades?.length || 0} / 2 giảng viên
                </Tag>
              </div>
              <div className="space-y-2">
                {details?.reviewerGrades?.map((g: any, idx: number) => (
                  <Card key={g.id} size="small" className="rounded-xl border-none shadow-sm">
                    <div className="flex justify-between items-center py-2 px-3">
                      <Text className="font-medium text-gray-500">GVPB {idx + 1}: <span className="text-gray-800">{g.rater_name || `Giảng viên ${idx + 1}`}</span></Text>
                      <Text className="text-lg font-black text-blue-600">{g.scores?.[0]?.score?.toFixed(2) || '—'}</Text>
                    </div>
                  </Card>
                ))}
                <div className="bg-white p-3 rounded-xl shadow-sm flex justify-between items-center border border-dashed border-blue-200 mt-4">
                  <Text className="text-blue-700 font-bold text-xs uppercase tracking-wider">Điểm trung bình phản biện</Text>
                  <Text className="text-xl font-black text-blue-800">{finalScore?.reviewer_avg_score?.toFixed(2) || '—'}</Text>
                </div>
              </div>
            </section>

            <section>
              <div className="flex items-center justify-between mb-3 px-1">
                <Title level={5} className="!m-0 text-sm font-bold text-gray-700">3. Điểm hội đồng chấm</Title>
                {details?.councilGrades?.length > 0 ? <Tag color="success" className="border-none bg-green-50 text-green-600 rounded-full text-xs font-bold">Đã chấm</Tag> : <Tag color="default" className="border-none bg-gray-100 text-gray-400 rounded-full text-xs">Chưa chấm</Tag>}
              </div>
              <div className="space-y-2">
                {details?.councilGrades?.map((g: any) => (
                  <Card key={g.id} size="small" className="rounded-xl border-none shadow-sm">
                    <div className="flex justify-between items-center py-2 px-3">
                      <div>
                        <div className="font-bold text-gray-800 text-sm">{g.rater_name}</div>
                        <Text className="text-xs uppercase font-black text-gray-400">{g.committee_role === 'CHAIR' ? 'Chủ tịch' : g.committee_role === 'SECRETARY' ? 'Thư ký' : 'Ủy viên'}</Text>
                      </div>
                      <Text className="text-lg font-black text-blue-600">{g.scores?.[0]?.score?.toFixed(2) || '—'}</Text>
                    </div>
                  </Card>
                ))}
                <div className="bg-white p-3 rounded-xl shadow-sm flex justify-between items-center border border-dashed border-blue-200 mt-4">
                  <Text className="text-blue-700 font-bold text-xs uppercase tracking-wider">Điểm trung bình hội đồng</Text>
                  <Text className="text-xl font-black text-blue-800">{finalScore?.committee_score?.toFixed(2) || '—'}</Text>
                </div>
              </div>
            </section>

              {finalScore?.extra_points > 0 && (
                <section>
                  <div className="flex items-center justify-between mb-3 px-1">
                    <Title level={5} className="!m-0 text-sm font-bold text-orange-600">4. Điểm cộng (NCKH / Bài báo)</Title>
                  </div>
                  <Card size="small" className="rounded-xl border-none bg-orange-50/50 shadow-sm">
                    <div className="flex justify-between items-center py-2 px-3">
                      <Text className="text-orange-700 font-bold text-xs italic">Thành tích NCKH được phê duyệt</Text>
                      <Text className="text-lg font-black text-orange-600">+{finalScore?.extra_points?.toFixed(2)}</Text>
                    </div>
                  </Card>
                </section>
              )}
          </div>

          {/* Drawer Footer */}
          <div className="p-6 bg-white border-t shadow-[0_-4px_12px_rgba(0,0,0,0.05)]">
            <div className="flex justify-between items-center mb-6">
              <div>
                <div className="text-[10px] uppercase font-black text-gray-400 tracking-tighter mb-1">Tổng điểm cuối cùng</div>
                <div className="flex items-baseline gap-3">
                  <span className="text-4xl font-black text-blue-600">{finalScore?.final_score?.toFixed(2) || '—'}</span>
                  <Tag color="success" className="font-black border-none bg-green-50 text-green-700 px-3 py-1 rounded-lg text-sm">{finalScore?.grade_classification || '—'}</Tag>
                </div>
              </div>
              {!isFinalized && isComplete && (
                <div className="flex flex-col gap-1 items-end bg-green-50/50 p-2 rounded-lg border border-green-100">
                  <Text type="success" className="text-xs font-black flex items-center gap-1">
                    <CheckCircleOutlined /> SẴN SÀNG CHỐT
                  </Text>
                </div>
              )}
            </div>

            <div className="flex gap-3">
              <Button size="large" className="flex-1 h-12 rounded-xl font-bold border-gray-200" onClick={onClose}>Đóng</Button>
              {!isFinalized && isComplete && (
                <Popconfirm title="Xác nhận chốt điểm vĩnh viễn cho đề tài này?" onConfirm={() => onFinalize(topic.id)} okText="Chốt điểm" cancelText="Hủy">
                  <Button type="primary" size="large" className="flex-[2] h-12 rounded-xl bg-blue-600 font-black shadow-lg shadow-blue-100 hover:scale-[1.02] transition-transform" loading={isFinalizing}>
                    CHỐT ĐIỂM
                  </Button>
                </Popconfirm>
              )}
              {isFinalized && (
                <Button type="primary" size="large" ghost className="flex-[2] h-12 rounded-xl font-bold flex items-center justify-center gap-2" disabled>
                  <LockOutlined /> ĐÃ CHỐT {new Date(finalScore?.finalized_at).toLocaleDateString('vi-VN')}
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </Drawer>
  );
};

export default GradeSummary;
