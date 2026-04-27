import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Card, Tag, Button, Typography, Space, Progress,
  Row, Col, Input, Drawer,
  Empty, Spin, Avatar, Tabs, Popconfirm, Divider
} from 'antd';
import {
  CheckCircleOutlined, ClockCircleOutlined,
  LockOutlined, SearchOutlined, TrophyOutlined,
  UserOutlined, RightOutlined, EyeOutlined,
  FilterOutlined, FireOutlined
} from '@ant-design/icons';
import { GradingApi } from '@/api/grading';
import { notify } from '@/utils/notification';
import { useNavigate } from 'react-router-dom';
import GlobalSearch from '@/components/GlobalSearch';
import HighlightText from '@/components/HighlightText';
import { matchKeyword } from '@/utils/search';
import { useDebounce } from '@/hooks/useDebounce';

const { Title, Text } = Typography;

const GradeSummary = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
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
    if (debouncedSearch) {
      result = result.filter((t: any) =>
        matchKeyword(
          debouncedSearch,
          t.title,
          t.code,
          t.supervisor?.full_name,
          ...t.students?.map((s: any) => s.full_name),
          ...t.students?.map((s: any) => s.student_code)
        )
      );
    }
    return result;
  }, [topics, filter, debouncedSearch]);

  const stats = useMemo(() => ({
    total: topics.length,
    ready: topics.filter((t: any) => t.gradingStatus?.isReadyForDecision && !t.gradingStatus?.isFinalized).length,
    incomplete: topics.filter((t: any) => !t.gradingStatus?.isReadyForDecision && !t.gradingStatus?.isFinalized).length,
    finalized: topics.filter((t: any) => t.gradingStatus?.isFinalized).length,
    overallProgress: topics.length > 0 ? Math.round((topics.filter((t: any) => t.gradingStatus?.isFinalized).length / topics.length) * 100) : 0
  }), [topics]);

  if (isLoading) return <div className="p-12 text-center h-screen flex items-center justify-center bg-slate-50 flex-col gap-4">
    <Spin size="large" />
    <Text className="text-slate-400 font-medium text-base">Đang tải dữ liệu tổng kết điểm...</Text>
  </div>;

  return (
    <div className="page-container">
      <div className="page-inner">
        {/* Header Section */}
        <Card className="page-header-card">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="page-header-icon w-11 h-11"><TrophyOutlined className="text-xl" /></div>
              <div>
                <div className="page-header-title text-lg font-black">Tổng kết &amp; Xác nhận điểm</div>
                <div className="page-header-subtitle text-sm">Học kỳ 2 (2025-2026) • Cập nhật: {new Date().toLocaleDateString('vi-VN')}</div>
              </div>
            </div>
          </div>
        </Card>

        {/* Integrated Filter & Search Bar */}
        <Card className="page-toolbar-card">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex-1 overflow-hidden">
              <Tabs
                activeKey={filter}
                onChange={setFilter}
                className="border-none grade-tabs !mb-0"
                size="small"
                items={[
                  { key: 'all', label: `Tất cả (${stats.total})` },
                  { key: 'ready', label: `Sẵn sàng (${stats.ready})` },
                  { key: 'missing_supervisor', label: `Thiếu GVHD` },
                  { key: 'missing_reviewer', label: `Thiếu PB` },
                  { key: 'missing_committee', label: `Thiếu HĐ` },
                  { key: 'more', label: `...` },
                ]}
              />
            </div>
            <div className="flex items-center gap-3 h-10">
               <Divider type="vertical" className="h-5 bg-slate-200 hidden lg:block m-0" />
               <GlobalSearch
                 placeholder="Tìm mã số, tên đề tài, sinh viên, GVHD..."
                 className="w-full lg:w-[320px]"
                 value={search}
                 onChange={setSearch}
               />
               <Button icon={<FilterOutlined />} className="h-10 rounded-lg flex items-center justify-center w-10 p-0 border-slate-200 shadow-none" />
            </div>
          </div>
        </Card>

        {/* List of Cards */}
        <div className="space-y-3 pb-12">
          {filteredTopics.length > 0 ? (
            filteredTopics.map((topic: any, idx: number) => (
              <TopicCard
                key={topic.id}
                index={idx + 1}
                topic={topic}
                keyword={debouncedSearch}
                onViewDetails={() => setSelectedTopicId(topic.id)}
                onFinalize={() => finalizeMutation.mutate(topic.id)}
                isFinalizing={finalizeMutation.isPending && selectedTopicId === topic.id}
              />
            ))
          ) : (
            <Card className="rounded-2xl border-dashed border-2 border-slate-200 bg-white/50 p-16 flex flex-col items-center justify-center">
              <Empty 
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={
                  <div className="text-center">
                    <p className="text-slate-500 font-medium text-lg mb-1">Không tìm thấy đề tài nào</p>
                    <p className="text-slate-400 text-sm">Hãy thử thay đổi bộ lọc hoặc từ khóa tìm kiếm</p>
                  </div>
                } 
              />
            </Card>
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
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        .grade-tabs .ant-tabs-nav { margin-bottom: 0 !important; }
        .grade-tabs .ant-tabs-nav::before { border-bottom: none !important; }
        .grade-tabs .ant-tabs-tab { border-radius: 8px !important; margin-right: 16px !important; transition: all 0.2s; padding: 8px 14px !important; border: 1px solid transparent !important; margin-top: 0 !important; margin-bottom: 0 !important; }
        .grade-tabs .ant-tabs-tab-btn { font-size: 14px !important; font-weight: 500; line-height: 1 !important; }
        .grade-tabs .ant-tabs-tab:hover .ant-tabs-tab-btn { color: #0284c7 !important; }
        .grade-tabs .ant-tabs-tab-active { background: #f0f9ff !important; border: 1px solid #e0f2fe !important; }
        .grade-tabs .ant-tabs-tab-active .ant-tabs-tab-btn { color: #0284c7 !important; font-weight: 700 !important; }
        .grade-tabs .ant-tabs-ink-bar { display: none !important; }
        .grade-tabs .ant-tabs-nav-list { display: flex; align-items: center; }
        
        .topic-summary-card { transition: all 0.25s ease; position: relative; }
        .topic-summary-card:hover { transform: translateY(-3px); border-color: #3b82f6 !important; box-shadow: 0 12px 24px -6px rgba(59, 130, 246, 0.15) !important; }
      `}</style>
    </div>
  );
};

/**
 * Layer 1: Topic Card Component
 */
const TopicCard = ({ index, topic, keyword, onViewDetails, onFinalize, isFinalizing }: any) => {
  const gs = topic.gradingStatus;
  const isComplete = gs?.isReadyForDecision;
  const isFinalized = gs?.isFinalized;

  const getStatusBadge = () => {
    if (isFinalized) return <Tag className="rounded-full px-3 py-1 border-none bg-slate-100 text-slate-500 font-bold text-[11px] tracking-tight">ĐÃ CHỐT ĐIỂM</Tag>;
    if (isComplete) return <Tag className="rounded-full px-3 py-1 border-none bg-green-50 text-green-600 font-bold text-[11px] tracking-tight">SẴN SÀNG CHỐT</Tag>;
    if (!gs?.supervisorGraded) return <Tag className="rounded-full px-3 py-1 border-none bg-amber-50 text-amber-600 font-bold text-[11px] tracking-tight">THIẾU GVHD</Tag>;
    if (!gs?.isReviewerComplete) return <Tag className="rounded-full px-3 py-1 border-none bg-amber-50 text-amber-600 font-bold text-[11px] tracking-tight">THIẾU PHẢN BIỆN</Tag>;
    return <Tag className="rounded-full px-3 py-1 border-none bg-amber-50 text-amber-600 font-bold text-[11px] tracking-tight">THIẾU HỘI ĐỒNG</Tag>;
  };

  const statusClass = isFinalized ? 'status-finalized' : (isComplete ? 'status-ready' : 'status-incomplete');

  // Calculate overall percentage
  const totalSteps = 3;
  let doneCount = 0;
  if (gs?.supervisorGraded) doneCount++;
  if (gs?.isReviewerComplete) doneCount++;
  if (gs?.committeeCount > 0) doneCount++;
  const percent = Math.round((doneCount / totalSteps) * 100);

  return (
    <Card className={`rounded-2xl border border-slate-200 shadow-sm overflow-hidden p-0 topic-summary-card ${statusClass}`}>
      <Row align="middle" gutter={20} className="p-4 px-5">
        {/* Index Number */}
        <div className="absolute top-0 left-0 bg-slate-100 text-slate-400 text-[10px] font-black w-6 h-6 flex items-center justify-center rounded-br-lg border-r border-b border-slate-200/50 z-10">
          {index}
        </div>

        {/* Info Column */}
        <Col span={8}>
          <div className="flex gap-2 mb-2 items-center">
            <Text className="bg-slate-100 px-2 py-0.5 rounded text-[11px] font-mono font-bold text-slate-500">
              <HighlightText text={topic.code} keyword={keyword} />
            </Text>
            {getStatusBadge()}
          </div>
          <Title level={5} className="!mb-1.5 line-clamp-1 !text-[16px] font-black text-slate-800 tracking-tight">
            <HighlightText text={topic.title} keyword={keyword} />
          </Title>
          <div className="flex items-center gap-2">
            <Avatar size={18} icon={<UserOutlined />} className="bg-slate-200" />
            <Text type="secondary" className="text-[11px] font-bold italic">
              GVHD: <HighlightText text={topic.supervisor?.full_name} keyword={keyword} />
            </Text>
          </div>
        </Col>

        {/* Students Column */}
        <Col span={5}>
          <div className="flex items-center gap-1.5 mb-3 px-1">
            <Text className="text-[11px] font-black text-slate-400 uppercase tracking-widest">{topic.students?.length || 0} sinh viên</Text>
          </div>
          <div className="space-y-2">
            {topic.students?.map((s: any) => (
              <div key={s.id} className="flex items-center gap-3 group">
                <Avatar size={24} className="bg-blue-50 text-blue-600 font-black text-[10px] border border-blue-100">
                   {s.full_name?.charAt(0)}
                </Avatar>
                <div className="flex flex-col overflow-hidden">
                  <Text className="text-[14px] font-bold text-slate-700 truncate line-clamp-1 leading-tight">
                    <HighlightText text={s.full_name} keyword={keyword} />
                  </Text>
                  <Text className="text-[10px] text-slate-400 font-mono font-bold">
                    <HighlightText text={s.student_code} keyword={keyword} />
                  </Text>
                </div>
              </div>
            ))}
          </div>
        </Col>

        {/* Progress Column */}
        <Col span={5}>
          <div className="space-y-4 px-1">
            <div className="flex justify-between items-center text-[11px] font-black uppercase tracking-tight">
              <div className="flex items-center gap-1.5">
                {gs?.supervisorGraded ? <CheckCircleOutlined className="text-green-500" /> : <ClockCircleOutlined className="text-slate-300" />}
                <span className={gs?.supervisorGraded ? 'text-green-600' : 'text-slate-400'}>HD</span>
              </div>
              <div className="flex items-center gap-1.5">
                {gs?.isReviewerComplete ? <CheckCircleOutlined className="text-green-500" /> : <ClockCircleOutlined className="text-slate-300" />}
                <span className={gs?.isReviewerComplete ? 'text-green-600' : 'text-slate-400'}>PB ({gs?.reviewerGradedCount}/{gs?.totalReviewersRequired})</span>
              </div>
              <div className="flex items-center gap-1.5">
                {gs?.committeeCount > 0 ? <CheckCircleOutlined className="text-green-500" /> : <ClockCircleOutlined className="text-slate-300" />}
                <span className={gs?.committeeCount > 0 ? 'text-green-600' : 'text-slate-400'}>HĐ</span>
              </div>
            </div>
            <div className="relative">
              <Progress percent={percent} showInfo={false} strokeColor={percent === 100 ? '#10b981' : '#3b82f6'} trailColor="#f1f5f9" strokeWidth={8} className="m-0" />
            </div>
            <div className="flex justify-between items-center">
               <Text className="text-[10px] text-slate-400 font-bold uppercase">Trạng thái: {doneCount}/3</Text>
               <Text className="text-xs text-slate-800 font-black tracking-tighter">{percent}%</Text>
            </div>
          </div>
        </Col>

        {/* Score Column */}
        <Col span={3} className="text-center border-l border-slate-100">
          {(isFinalized || isComplete) ? (
            <div className="flex flex-col items-center">
              <Text className="text-[10px] uppercase font-black text-slate-400 tracking-tighter mb-0.5">Điểm dự kiến</Text>
              <div className="text-2xl font-black text-blue-600 leading-none mb-1.5 tabular-nums tracking-tighter">
                {topic.final_score?.final_score?.toFixed(2) || '—'}
              </div>
              <Tag className="m-0 border-none bg-blue-50 text-blue-600 text-[10px] font-black px-2 py-0 rounded leading-none">
                {topic.final_score?.grade_classification || '—'}
              </Tag>
            </div>
          ) : (
            <div className="flex flex-col items-center opacity-40">
              <Text className="text-[10px] uppercase font-black text-slate-400 tracking-tighter mb-0.5">Điểm dự kiến</Text>
              <div className="text-2xl font-black text-slate-300 leading-none mb-1">—</div>
              <Text className="text-[10px] text-slate-400 italic font-bold">Chờ đủ điểm</Text>
            </div>
          )}
        </Col>

        {/* Actions Column */}
        <Col span={3} className="flex flex-col gap-2">
          {isFinalized ? (
            <Button 
              icon={<EyeOutlined />} 
              size="middle"
              className="rounded-lg h-9 border-slate-200 text-slate-600 font-bold text-[12px] hover:bg-slate-50 shadow-sm" 
              onClick={onViewDetails}
            >
              Xem kết quả
            </Button>
          ) : (
            <>
              <Button 
                icon={<EyeOutlined />} 
                size="middle"
                className="rounded-lg h-9 border-slate-200 text-slate-600 font-bold text-[12px] hover:bg-slate-50 shadow-sm" 
                onClick={onViewDetails}
              >
                Chi tiết điểm
              </Button>
              {isComplete && (
                <Popconfirm 
                  title={<span className="text-base font-bold">Xác nhận chốt điểm vĩnh viễn?</span>}
                  description={<span className="text-sm">Sinh viên sẽ thấy kết quả ngay lập tức trên hệ thống.</span>}
                  onConfirm={onFinalize} 
                  okText="Chốt ngay" 
                  cancelText="Hủy"
                  okButtonProps={{ className: 'bg-blue-600 h-9 rounded-lg px-4' }}
                  cancelButtonProps={{ className: 'h-9 rounded-lg' }}
                >
                  <Button 
                    type="primary" 
                    size="middle"
                    className="bg-blue-600 rounded-lg h-9 shadow-lg shadow-blue-100 font-black text-[12px] uppercase tracking-wide" 
                    loading={isFinalizing}
                  >
                    Chốt điểm
                  </Button>
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
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);

  const { data: details, isLoading } = useQuery({
    queryKey: ['topic-grades', topicId],
    queryFn: () => GradingApi.getTopicGrades(topicId!),
    enabled: !!topicId,
  });

  const topic = details?.topic;
  const students = topic?.students || [];
  
  // Set default student if not set
  useMemo(() => {
    if (students.length > 0 && !selectedStudentId) {
      setSelectedStudentId(students[0].id);
    }
  }, [students, selectedStudentId]);

  const finalScore = details?.finalScores?.find((fs: any) => fs.student_id === selectedStudentId);
  const isComplete = topic?.gradingStatus?.isReadyForDecision;
  const isFinalized = topic?.gradingStatus?.isFinalized;

  // Filter grades by selected student
  const advisorGrade = details?.advisorGrades?.find((g: any) => !g.student_id || g.student_id === selectedStudentId);
  const reviewerGrades = details?.reviewerGrades?.filter((g: any) => !g.student_id || g.student_id === selectedStudentId) || [];
  const councilGrades = details?.councilGrades?.filter((g: any) => !g.student_id || g.student_id === selectedStudentId) || [];

  const calculateAvg = (scores: any[]) => {
    if (!scores || scores.length === 0) return 0;
    return scores.reduce((sum, s) => sum + s.score, 0) / scores.length;
  };

  return (
    <Drawer
      title={null}
      placement="right"
      width={580}
      onClose={onClose}
      open={!!topicId}
      className="grade-drawer"
      styles={{ body: { padding: 0 } }}
      closeIcon={null}
    >
      {isLoading ? (
        <div className="h-full flex flex-col items-center justify-center bg-slate-50/50 gap-3">
          <Spin size="default" />
          <Text className="text-slate-400 font-bold text-xs animate-pulse">Đang nạp dữ liệu...</Text>
        </div>
      ) : (
        <div className="flex flex-col h-full bg-slate-50">
          {/* Drawer Header */}
          <div className="p-4 bg-white border-b sticky top-0 z-20 shadow-sm">
            <div className="flex justify-between items-start mb-3">
              <Space direction="vertical" size={0}>
                <div className="flex items-center gap-2 mb-1">
                  <span className="bg-blue-600 text-white px-2 py-0.5 rounded text-[10px] font-black font-mono">{topic?.code}</span>
                  {isFinalized ? (
                    <Tag className="rounded-full bg-slate-100 text-slate-500 border-none font-black text-[10px] px-2 py-0">ĐÃ CHỐT</Tag>
                  ) : isComplete ? (
                    <Tag className="rounded-full bg-green-50 text-green-600 border-none font-black text-[10px] px-2 py-0">SẴN SÀNG</Tag>
                  ) : (
                    <Tag className="rounded-full bg-amber-50 text-amber-600 border-none font-black text-[10px] px-2 py-0">THIẾU ĐIỂM</Tag>
                  )}
                </div>
                <Title level={3} className="!m-0 !text-[16px] font-black text-slate-800 tracking-tight leading-snug">{topic?.title}</Title>
                <Text className="text-[11px] text-slate-400 font-bold italic">GVHD: {topic?.supervisor?.full_name}</Text>
              </Space>
              <Button 
                icon={<RightOutlined />} 
                type="text" 
                onClick={onClose} 
                className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-400 text-lg" 
              />
            </div>

            <div className="bg-slate-50 p-1.5 rounded-lg border border-slate-100">
              <Row gutter={8}>
                {students.map((s: any) => {
                  const isSelected = selectedStudentId === s.id;
                  return (
                    <Col span={students.length === 1 ? 24 : 12} key={s.id}>
                      <div 
                        className={`flex items-center gap-2 p-1.5 rounded-lg cursor-pointer transition-all border ${isSelected ? 'bg-white border-blue-500 shadow-sm' : 'border-transparent hover:bg-white/60'}`}
                        onClick={() => setSelectedStudentId(s.id)}
                      >
                        <Avatar className={`${isSelected ? 'bg-blue-600' : 'bg-slate-300'} text-white font-black text-[9px] transition-colors`} size={24}>
                          {s.full_name?.split(' ').pop()?.charAt(0)}
                        </Avatar>
                        <div className="flex-1 overflow-hidden">
                          <div className={`text-[15px] font-black truncate leading-tight ${isSelected ? 'text-blue-600' : 'text-slate-600'}`}>{s.full_name}</div>
                          <div className="text-[11px] text-slate-400 font-mono font-bold tracking-tighter">{s.student_code}</div>
                        </div>
                      </div>
                    </Col>
                  );
                })}
              </Row>
            </div>
          </div>

          {/* Drawer Body - Detailed Scores */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar">
            <section>
              <div className="flex items-center gap-2 mb-2 px-1">
                <div className="w-1.5 h-3.5 bg-blue-600 rounded-full" />
                <Title level={5} className="!m-0 !text-[12px] font-black text-slate-800 uppercase tracking-tight">1. Điểm GV hướng dẫn</Title>
              </div>
              <Card className="rounded-lg border border-slate-200 shadow-none bg-white" styles={{ body: { padding: 0 } }}>
                <div className="flex justify-between items-center p-3 px-4">
                  <div className="flex items-center gap-2">
                     <Avatar size={22} className="bg-slate-100 text-slate-500 font-black text-[9px]">{topic?.supervisor?.full_name?.charAt(0)}</Avatar>
                     <Text className="font-bold text-slate-600 text-[13px] leading-none">{topic?.supervisor?.full_name}</Text>
                  </div>
                  <Text className="text-[15px] font-black text-blue-600 tabular-nums leading-none tracking-tighter">
                    {finalScore ? finalScore.supervisor_score?.toFixed(2) : (advisorGrade ? calculateAvg(advisorGrade.scores).toFixed(2) : '—')}
                  </Text>
                </div>
              </Card>
            </section>

            <section>
              <div className="flex items-center gap-2 mb-2 px-1">
                 <div className="w-1.5 h-3.5 bg-green-600 rounded-full" />
                 <Title level={5} className="!m-0 !text-[12px] font-black text-slate-800 uppercase tracking-tight">2. Điểm Phản biện</Title>
              </div>
              <div className="space-y-2">
                {[0, 1].map((idx) => {
                  const g = reviewerGrades[idx] as any;
                  return g ? (
                    <Card key={g.id} className="rounded-lg border border-slate-200 shadow-none bg-white" styles={{ body: { padding: 0 } }}>
                      <div className="flex justify-between items-center p-3 px-4">
                        <div className="flex items-center gap-2">
                           <div className="w-7 h-7 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center font-black text-slate-400 text-[10px]">PB{idx+1}</div>
                           <div className="font-bold text-slate-500 text-[13px] leading-tight">{g.rater_name}</div>
                        </div>
                        <Text className="text-[15px] font-black text-slate-700 tabular-nums tracking-tighter">{calculateAvg(g.scores).toFixed(2)}</Text>
                      </div>
                    </Card>
                  ) : (
                    <Card key={`empty-pb-${idx}`} className="rounded-lg border border-dashed border-slate-200 shadow-none bg-slate-50/30" styles={{ body: { padding: 0 } }}>
                      <div className="flex justify-between items-center p-3 px-4">
                        <div className="flex items-center gap-2 opacity-50">
                           <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center font-black text-slate-300 text-[10px]">PB{idx+1}</div>
                           <div className="font-bold text-slate-400 text-[12px] italic">Chưa phân công</div>
                        </div>
                        <Text className="text-[12px] font-black text-slate-200">—</Text>
                      </div>
                    </Card>
                  );
                })}
                
                {reviewerGrades.length > 0 && (
                  <div className="bg-green-50/50 p-2.5 rounded-lg border border-dashed border-green-200 flex justify-between items-center mt-2">
                    <Text className="text-green-700 font-black text-[10px] uppercase tracking-widest">TRUNG BÌNH PB (40%)</Text>
                    <Text className="text-[20px] font-black text-green-700 tabular-nums tracking-tighter">{finalScore?.reviewer_avg_score?.toFixed(2) || '—'}</Text>
                  </div>
                )}
              </div>
            </section>

            <section>
              <div className="flex items-center gap-2 mb-2 px-1">
                 <div className="w-1.5 h-3.5 bg-indigo-600 rounded-full" />
                 <Title level={5} className="!m-0 !text-[12px] font-black text-slate-800 uppercase tracking-tight">3. Điểm Hội đồng</Title>
              </div>
              <div className="space-y-2">
                {['CHAIR', 'SECRETARY', 'MEMBER'].map((role, idx) => {
                  const g = councilGrades.find((cg: any) => cg.committee_role === role) as any;
                  const roleLabel = role === 'CHAIR' ? 'Chủ tịch' : role === 'SECRETARY' ? 'Thư ký' : 'Ủy viên';
                  return g ? (
                    <Card key={g.id} className="rounded-lg border border-slate-200 shadow-none bg-white" styles={{ body: { padding: 0 } }}>
                      <div className="flex justify-between items-center p-3 px-4">
                        <div className="flex items-center gap-2">
                          <Avatar size={22} className="bg-indigo-50 text-indigo-600 font-black text-[9px] border border-indigo-100">{g.rater_name?.charAt(0)}</Avatar>
                          <div>
                            <div className="font-bold text-slate-600 text-[13px] leading-tight mb-0">{g.rater_name}</div>
                            <Text className="text-[8px] uppercase font-black text-indigo-400 tracking-tighter leading-none">{roleLabel}</Text>
                          </div>
                        </div>
                        <Text className="text-[15px] font-black text-slate-700 tabular-nums tracking-tighter">{calculateAvg(g.scores).toFixed(2)}</Text>
                      </div>
                    </Card>
                  ) : (
                    <Card key={`empty-council-${role}`} className="rounded-lg border border-dashed border-slate-200 shadow-none bg-slate-50/30" styles={{ body: { padding: 0 } }}>
                      <div className="flex justify-between items-center p-3 px-4">
                        <div className="flex items-center gap-2 opacity-50">
                          <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center font-black text-slate-300 text-[10px]">{idx+1}</div>
                          <div>
                            <div className="font-bold text-slate-400 text-[12px] italic">Chưa có {roleLabel}</div>
                          </div>
                        </div>
                        <Text className="text-[12px] font-black text-slate-200">—</Text>
                      </div>
                    </Card>
                  );
                })}

                {councilGrades.length > 0 && (
                  <div className="bg-indigo-50/50 p-2.5 rounded-lg border border-dashed border-indigo-200 flex justify-between items-center mt-2">
                    <Text className="text-indigo-700 font-black text-[10px] uppercase tracking-widest">TRUNG BÌNH HĐ (20%)</Text>
                    <Text className="text-[20px] font-black text-indigo-700 tabular-nums tracking-tighter">{finalScore?.committee_score?.toFixed(2) || '—'}</Text>
                  </div>
                )}
              </div>
            </section>

            {finalScore?.extra_points > 0 && (
              <section>
                <Card className="rounded-lg border-none bg-amber-50 border border-amber-100 shadow-none">
                  <div className="flex justify-between items-center p-2 px-3">
                    <div className="flex items-center gap-2">
                       <FireOutlined className="text-lg text-amber-600" />
                       <Text className="text-amber-800 font-black text-[10px] uppercase">ĐIỂM CỘNG</Text>
                    </div>
                    <Text className="text-[18px] font-black text-amber-600 tabular-nums tracking-tighter">+{finalScore?.extra_points?.toFixed(2)}</Text>
                  </div>
                </Card>
              </section>
            )}
          </div>

          {/* Drawer Footer */}
          <div className="p-4 bg-white border-t shadow-[0_-4px_16px_rgba(0,0,0,0.04)] z-30">
            <div className="flex justify-between items-center mb-4 px-1">
              <div>
                <Text className="text-[9px] uppercase font-black text-slate-400 tracking-widest block mb-1">TỔNG ĐIỂM CHỐT</Text>
                <div className="flex items-center gap-3">
                  <span className="text-4xl font-black text-blue-600 tabular-nums leading-none tracking-tighter">
                    {finalScore?.final_score?.toFixed(2) || '—'}
                  </span>
                  <Tag className="m-0 font-black border-none bg-green-50 text-green-600 px-2 py-0.5 rounded text-[10px] tracking-wide">
                    {finalScore?.grade_classification || '—'}
                  </Tag>
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <Button size="middle" className="flex-1 h-9 rounded-lg font-black text-xs border-slate-200 text-slate-500 shadow-sm" onClick={onClose}>QUAY LẠI</Button>
              {!isFinalized && isComplete && (
                <Popconfirm 
                  title={<span className="text-sm font-black">XÁC NHẬN CHỐT ĐIỂM?</span>}
                  onConfirm={() => onFinalize(topic.id)} 
                  okText="CHỐT" 
                  cancelText="HỦY"
                  okButtonProps={{ className: 'bg-blue-600 h-8 rounded font-black text-xs' }}
                >
                  <Button type="primary" size="middle" className="flex-[2] h-9 rounded-lg bg-blue-600 font-black text-xs shadow-md shadow-blue-200 tracking-wide" loading={isFinalizing}>
                    CHỐT ĐIỂM NGAY
                  </Button>
                </Popconfirm>
              )}
              {isFinalized && (
                <Button type="primary" size="middle" className="flex-[2] h-9 rounded-lg bg-slate-100 text-slate-400 border-none font-black text-xs flex items-center justify-center gap-1 cursor-not-allowed" disabled>
                  <LockOutlined className="text-sm" /> ĐÃ CHỐT
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
