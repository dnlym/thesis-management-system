import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Card, Tag, Button, Typography, Space, Progress,
  Row, Col, Input, Drawer,
  Empty, Spin, Avatar, Tabs, Popconfirm, Divider, Flex, Tooltip
} from 'antd';
import { useTranslation } from 'react-i18next';
import {
  CheckCircleOutlined, ClockCircleOutlined, CheckCircleFilled,
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
  const { t } = useTranslation();
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

  // Finalize mutation removed (manual finalization is deprecated)

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
          t.title || '',
          t.code || '',
          t.supervisor?.full_name || '',
          ...(t.students || []).map((s: any) => s.student?.full_name || ''),
          ...(t.students || []).map((s: any) => s.student?.student_code || '')
        )
      );
    }

    // [SORTING] Finalized topics go to the bottom
    return [...result].sort((a: any, b: any) => {
      const aFinalized = a.gradingStatus?.isFinalized ? 1 : 0;
      const bFinalized = b.gradingStatus?.isFinalized ? 1 : 0;
      
      if (aFinalized !== bFinalized) {
        return aFinalized - bFinalized;
      }
      
      // Secondary sort: Ready for decision first
      const aReady = a.gradingStatus?.isReadyForDecision ? 0 : 1;
      const bReady = b.gradingStatus?.isReadyForDecision ? 0 : 1;
      return aReady - bReady;
    });
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
              <div className="page-header-icon"><TrophyOutlined className="text-base" /></div>
              <div>
                <div className="page-header-title">{t('gradeSummary.title')}</div>
                <div className="page-header-subtitle">{t('gradeSummary.subtitle')}</div>
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
                className="sys-tabs sys-tabs-capsule !mb-0"
                size="small"
                tabBarGutter={4}
                items={[
                  { 
                    key: 'all', 
                    label: (
                      <Flex gap="small" align="center">
                        <span className="whitespace-nowrap">{t('gradeSummary.tabs.all')}</span>
                        <Tag className="m-0 rounded-full bg-slate-50 text-slate-500 border-none font-bold px-2">{stats.total}</Tag>
                      </Flex>
                    ) 
                  },
                  { 
                    key: 'ready', 
                    label: (
                      <Flex gap="small" align="center">
                        <span className="whitespace-nowrap">{t('gradeSummary.tabs.ready')}</span>
                        <Tag className="m-0 rounded-full bg-green-50 text-green-600 border-none font-bold px-2">{stats.ready}</Tag>
                      </Flex>
                    ) 
                  },
                  { key: 'missing_supervisor', label: <span className="whitespace-nowrap">{t('gradeSummary.tabs.missingSupervisor')}</span> },
                  { key: 'missing_reviewer', label: <span className="whitespace-nowrap">{t('gradeSummary.tabs.missingReviewer')}</span> },
                  { key: 'missing_committee', label: <span className="whitespace-nowrap">{t('gradeSummary.tabs.missingCommittee')}</span> },
                  { key: 'finalized', label: <span className="whitespace-nowrap">{t('gradeSummary.tabs.finalized')}</span> },
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
      />

      <style>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
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

  let doneCount = 0;
  if (gs?.supervisorGraded) doneCount++;
  if (gs?.isReviewerComplete) doneCount++;
  if (gs?.isCommitteeComplete) doneCount++;

  const getStatusBadge = () => {
    if (isComplete) return <Tag className="rounded-full px-3 py-1 border-none bg-green-50 text-green-600 font-bold text-[11px] tracking-tight">ĐÃ ĐỦ ĐIỂM</Tag>;
    
    return (
      <div className="flex items-center gap-1.5 bg-amber-50/50 px-2 py-0.5 rounded-full border border-amber-100/50">
        <div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
        <Text className="text-[10px] font-black text-amber-700 uppercase tracking-tight">
          Đang chấm: {doneCount}/{1 + (gs?.totalReviewersRequired ?? 2) + (gs?.totalCommitteeRequired ?? 3)}
        </Text>
      </div>
    );
  };

  const statusClass = isFinalized ? 'status-finalized' : (isComplete ? 'status-ready' : 'status-incomplete');

  // Multi-segment color mapping
  const steps = [
    { label: 'HD', active: gs?.supervisorGraded, color: '#3b82f6', bg: '#dbeafe' },
    { label: 'PB', active: gs?.isReviewerComplete, color: '#10b981', bg: '#d1fae5' },
    { label: 'HĐ', active: gs?.isCommitteeComplete, color: '#6366f1', bg: '#e0e7ff' }
  ];

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
              <HighlightText text={topic.groupName || topic.code} keyword={keyword} />
            </Text>
            {getStatusBadge()}
          </div>
          <Title level={5} className="!mb-1.5 !text-[15px] font-bold text-slate-800 tracking-tight leading-snug">
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
          <div className="space-y-3">
            {topic.students?.map((s: any, idx: number) => {
              if (!s || !s.student) return null;
              const isFailed = s.student.midtermStatus === 'FAIL' || s.student.registrationStatus === 'FAILED';
              const cardEl = (
                <div key={s.student.id || idx} className={`flex items-center justify-between group p-1.5 rounded-lg border border-transparent transition-all ${
                  isFailed
                    ? 'bg-slate-100/60 opacity-50 line-through'
                    : 'bg-white/40 hover:border-slate-100 hover:bg-white/80'
                }`}>
                  <div className="flex items-center gap-2 overflow-hidden">
                    <Avatar size={24} className={`${isFailed ? 'bg-slate-200 text-slate-400' : 'bg-blue-50 text-blue-600'} font-bold text-[10px] border border-blue-100 flex-shrink-0`}>
                       {s.student.full_name?.charAt(0) || ''}
                    </Avatar>
                    <div className="flex flex-col overflow-hidden">
                       <Text className="text-[13px] font-bold text-slate-700 truncate leading-tight">
                        <HighlightText text={s.student.full_name} keyword={keyword} />
                      </Text>
                      <Text className="text-[9px] text-slate-400 font-mono font-bold">
                        <HighlightText text={s.student.student_code} keyword={keyword} />
                      </Text>
                    </div>
                  </div>
                  
                  {/* Individual Score & Classification */}
                  <div className="flex flex-col items-end flex-shrink-0">
                    <Text className={`text-[12px] font-black tabular-nums ${isFailed ? 'text-red-500' : s.finalScore?.final_score ? 'text-blue-600' : 'text-slate-300'}`}>
                      {isFailed ? '0.00đ' : s.finalScore?.final_score ? `${s.finalScore.final_score.toFixed(2)}đ` : '—'}
                    </Text>
                    {isFailed ? (
                      <Tag className="m-0 text-[8px] px-1 py-0 border-none font-black rounded uppercase bg-red-100 text-red-600">Rớt</Tag>
                    ) : s.finalScore?.grade_classification && (
                      <Tag className={`m-0 text-[8px] px-1 py-0 border-none font-black rounded uppercase ${
                        s.finalScore.grade_classification.startsWith('Xuất sắc') ? 'bg-amber-100 text-amber-600' :
                        s.finalScore.grade_classification.startsWith('Giỏi') ? 'bg-green-100 text-green-600' :
                        s.finalScore.grade_classification.startsWith('Khá') ? 'bg-blue-100 text-blue-600' :
                        'bg-slate-100 text-slate-500'
                      }`}>
                        {s.finalScore.grade_classification}
                      </Tag>
                    )}
                  </div>
                </div>
              );

              return isFailed ? (
                <Tooltip key={s.student.id || idx} title={`Sinh viên rớt giữa kỳ. Lý do: ${s.student.midtermFeedback || 'Không có ý kiến phản hồi.'}`}>
                  {cardEl}
                </Tooltip>
              ) : cardEl;
            })}
          </div>
        </Col>

        {/* Progress Column */}
        <Col span={5}>
          <div className="space-y-4 px-1">
            <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-tight">
              {steps.map((step, i) => (
                <div key={i} className="flex items-center gap-1">
                  {step.active ? <CheckCircleOutlined style={{ color: step.color }} /> : <ClockCircleOutlined className="text-slate-200" />}
                  <span className={step.active ? 'text-slate-700' : 'text-slate-300'}>
                    {step.label} 
                    {step.label === 'PB' && ` (${gs?.reviewerGradedCount}/${gs?.totalReviewersRequired ?? 2})`}
                    {step.label === 'HĐ' && ` (${gs?.committeeGradedCount}/${gs?.totalCommitteeRequired ?? 3})`}
                  </span>
                </div>
              ))}
            </div>
            
            {/* Segmented Progress Bar */}
            <div className="flex gap-1.5 w-full h-2 mt-2">
              {steps.map((step, i) => (
                <div 
                  key={i} 
                  className={`flex-1 rounded-full transition-all duration-700 shadow-sm ${step.active ? '' : 'bg-slate-100'}`}
                  style={{ 
                    backgroundColor: step.active ? step.color : '#f1f5f9', 
                    opacity: step.active ? 1 : 0.4 
                  }}
                />
              ))}
            </div>

          </div>
        </Col>


        <Col span={6} className="flex flex-col gap-2">
          <Button 
            icon={<EyeOutlined />} 
            size="middle"
            type="primary"
            className="rounded-lg h-9 bg-blue-600 shadow-sm shadow-blue-200 text-white font-bold text-[12px] hover:bg-blue-700" 
            onClick={onViewDetails}
          >
            {isComplete ? 'XEM KẾT QUẢ' : 'CHI TIẾT ĐIỂM'}
          </Button>
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
  const councilAssignments = details?.councilAssignments || [];
  const reviewerAssignments = details?.reviewerAssignments || [];
  
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

  const renderCouncilMember = (assignment: any, grade: any, idx: number) => {
    const roleLabel = assignment.committee_role === 'CHAIR' ? 'Chủ tịch' : 
                      assignment.committee_role === 'SECRETARY' ? 'Thư ký' : 'Ủy viên';
    
    return (
      <Card key={assignment.id} className={`rounded-lg border shadow-none bg-white ${grade ? 'border-slate-200' : 'border-dashed border-slate-200 opacity-70'}`} styles={{ body: { padding: 0 } }}>
        <div className="flex justify-between items-center p-3 px-4">
          <div className="flex items-center gap-2">
            <Avatar size={22} className={`${grade ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-50 text-slate-300'} font-black text-[9px] border border-indigo-100`}>
              {assignment.reviewer?.full_name?.charAt(0)}
            </Avatar>
            <div>
              <div className={`font-bold text-[13px] leading-tight mb-0 ${grade ? 'text-slate-600' : 'text-slate-400 italic'}`}>
                {assignment.reviewer?.full_name}
              </div>
              <Text className="text-[8px] uppercase font-black text-indigo-400 tracking-tighter leading-none">{roleLabel}</Text>
            </div>
          </div>
          <Text className={`text-[15px] font-black tabular-nums tracking-tighter ${grade ? 'text-slate-700' : 'text-slate-200'}`}>
            {grade ? calculateAvg(grade.scores).toFixed(2) : '—'}
          </Text>
        </div>
      </Card>
    );
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
          {/* Drawer Header omitted for brevity in instruction, keeping original structure */}
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
                {reviewerAssignments.map((a: any, idx: number) => {
                  const g = reviewerGrades.find((rg: any) => rg.rater_id === a.reviewer_id);
                  return (
                    <Card key={a.id} className={`rounded-lg border shadow-none bg-white ${g ? 'border-slate-200' : 'border-dashed border-slate-200 opacity-70'}`} styles={{ body: { padding: 0 } }}>
                      <div className="flex justify-between items-center p-3 px-4">
                        <div className="flex items-center gap-2">
                          <div className={`w-7 h-7 rounded-full flex items-center justify-center font-black text-[10px] border ${g ? 'bg-slate-50 border-slate-100 text-slate-400' : 'bg-slate-100 border-transparent text-slate-300'}`}>PB{idx+1}</div>
                          <div className={`font-bold text-[13px] leading-tight ${g ? 'text-slate-500' : 'text-slate-400 italic'}`}>{a.reviewer?.full_name}</div>
                        </div>
                        <Text className={`text-[15px] font-black tabular-nums tracking-tighter ${g ? 'text-slate-700' : 'text-slate-200'}`}>
                          {g ? calculateAvg(g.scores).toFixed(2) : '—'}
                        </Text>
                      </div>
                    </Card>
                  );
                })}
              </div>
            </section>

            <section>
              <div className="flex items-center gap-2 mb-2 px-1">
                 <div className="w-1.5 h-3.5 bg-indigo-600 rounded-full" />
                 <Title level={5} className="!m-0 !text-[12px] font-black text-slate-800 uppercase tracking-tight">3. Điểm Hội đồng</Title>
              </div>
              <div className="space-y-2">
                {councilAssignments.map((a: any, idx: number) => {
                  const g = councilGrades.find((cg: any) => cg.rater_id === a.reviewer_id);
                  return renderCouncilMember(a, g, idx + 1);
                })}
              </div>
            </section>

            <section>
              <div className="flex items-center gap-2 mb-2 px-1">
                 <div className="w-1.5 h-3.5 bg-amber-500 rounded-full" />
                 <Title level={5} className="!m-0 !text-[12px] font-black text-slate-800 uppercase tracking-tight">4. Điểm cộng NCKH / Thành tích</Title>
              </div>
              <Card className={`rounded-lg border-none shadow-none transition-all ${finalScore?.extra_points > 0 ? 'bg-amber-50 border border-amber-100' : 'bg-slate-50 border border-slate-100'}`}>
                <div className="flex justify-between items-center p-2 px-3">
                  <div className="flex items-center gap-2">
                     <FireOutlined className={`text-lg ${finalScore?.extra_points > 0 ? 'text-amber-600' : 'text-slate-300'}`} />
                     <Text className={`${finalScore?.extra_points > 0 ? 'text-amber-800' : 'text-slate-400'} font-black text-[10px] uppercase`}>TỔNG ĐIỂM CỘNG</Text>
                  </div>
                  <Text className={`text-[13px] font-black tabular-nums tracking-tighter ${finalScore?.extra_points > 0 ? 'text-amber-600' : 'text-slate-300'}`}>
                    {finalScore?.extra_points > 0 ? `+${finalScore?.extra_points?.toFixed(2)}` : '0.00'}
                  </Text>
                </div>
              </Card>
            </section>
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
              <Button size="middle" type="primary" className="flex-1 h-10 rounded-lg font-black text-xs bg-blue-600 shadow-md shadow-blue-100" onClick={onClose}>
                QUAY LẠI
              </Button>
            </div>
          </div>
        </div>
      )}
    </Drawer>
  );
};

export default GradeSummary;
