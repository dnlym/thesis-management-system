import { useState, useEffect, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Card, Form, InputNumber, Button, Spin, Alert, Input, Tabs, Table, Tag, Space, Divider, Row, Col, Typography, Avatar, Checkbox, Badge, Select, Tooltip, Pagination } from 'antd';
import { notify } from '@/utils/notification';
import { SaveOutlined, ArrowLeftOutlined, UserOutlined, CheckCircleOutlined, SearchOutlined, DownloadOutlined, WarningOutlined, CloseCircleOutlined, FlagOutlined } from '@ant-design/icons';
import { TopicStatusBadge } from '@/components/StatusBadge';
import { useAuthStore } from '@/store/auth';
import { useGradingCriteria, useSubmitGrade } from '@/hooks/useGrading';
import { TopicsApi } from '@/api/topics';
import { AssignmentsApi } from '@/api/assignments';
import { GradingApi } from '@/api/grading';
import DefensePivotModal from '@/components/DefensePivotModal';
import { useMutation } from '@tanstack/react-query';
import type { GradeScore, RaterRole } from '@/types';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { 
  canSupervisorGrade, 
  canReviewerGrade, 
  canCommitteeGrade, 
  isSemesterCompleted 
} from '@/utils/semester-rules';

const { TextArea } = Input;
const { Title, Text } = Typography;

/**
 * Trang Đánh Giá (Evaluation) - Fix triệt để lỗi Validation
 */
const Evaluation = () => {
  const { user } = useAuthStore();
  const [form] = Form.useForm();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  const topicId = searchParams.get('topicId');
  const [activeTab, setActiveTab] = useState<string>(searchParams.get('type') || (user?.role === 'HEAD' ? 'department' : 'advisor'));

  // HOD Pivot Modal state
  const [pivotModalVisible, setPivotModalVisible] = useState(false);
  const [selectedTopicForPivot, setSelectedTopicForPivot] = useState<any>(null);

  // HOD Department dashboard state
  const [deptSearch, setDeptSearch] = useState('');
  const [activeSubTab, setActiveSubTab] = useState('missing_s');

  useEffect(() => {
    const type = searchParams.get('type');
    if (type && ['advisor', 'reviewer', 'council'].includes(type)) {
      setActiveTab(type);
    }
  }, [searchParams]);

  const [averages, setAverages] = useState<Record<string, number>>({});

  // 1. Dashboard queries
  const { data: advisorTopics, isLoading: isLoadingAdvisor } = useQuery({
    queryKey: ['advisor-topics', user?.id],
    queryFn: () => TopicsApi.getAll({ supervisorId: user?.id, midtermStatus: 'PASS' }),
    enabled: !!user?.id && activeTab === 'advisor' && !topicId,
  });

  const { data: reviewerAssignments, isLoading: isLoadingReviewer } = useQuery({
    queryKey: ['reviewer-assignments', user?.id],
    queryFn: () => AssignmentsApi.getAll({ assignmentType: 'REVIEWER' }),
    enabled: !!user?.id && activeTab === 'reviewer' && !topicId,
  });

  const { data: councilAssignments, isLoading: isLoadingCouncil } = useQuery({
    queryKey: ['council-assignments', user?.id],
    queryFn: () => AssignmentsApi.getAll({ assignmentType: 'COMMITTEE' }),
    enabled: !!user?.id && activeTab === 'council' && !topicId,
  });

  const { data: summaryData, isLoading: isLoadingSummary, refetch: refetchSummary } = useQuery<any>({
    queryKey: ['grade-summary', user?.id],
    queryFn: () => GradingApi.getGradeSummary(),
    enabled: !!user?.id && activeTab === 'department' && !topicId,
  });

  const finalizePivotMutation = useMutation({
    mutationFn: (data: { topicId: string; isEligible: boolean; defenseType?: string }) => 
      TopicsApi.finalizeDefensePivot(data.topicId, { isEligible: data.isEligible, defenseType: data.defenseType }),
    onSuccess: (res) => {
      notify.success(res.message || 'Cập nhật thành công');
      setPivotModalVisible(false);
      refetchSummary();
    },
    onError: (err: any) => notify.error(err.message || 'Lỗi khi chốt quyết định'),
  });

  // 2. Grading mode queries
  const { data: selectedTopic, isLoading: isLoadingTopic } = useQuery({
    queryKey: ['topic', topicId],
    queryFn: () => TopicsApi.getById(topicId!),
    enabled: !!topicId,
  });

  const currentAssignment = useMemo(() => {
    if (activeTab === 'reviewer') return reviewerAssignments?.find((a: any) => a.topic_id === topicId);
    if (activeTab === 'council') return councilAssignments?.find((a: any) => a.topic_id === topicId);
    return null;
  }, [activeTab, reviewerAssignments, councilAssignments, topicId]);

  const getRaterRole = (): RaterRole => {
    if (activeTab === 'advisor') return 'SUPERVISOR';
    if (activeTab === 'reviewer') return 'REVIEWER';
    if (activeTab === 'council') return 'COMMITTEE';
    return 'SUPERVISOR';
  };

  const { data: myGradesData, isLoading: isLoadingMyGrades } = useQuery({
    queryKey: ['my-grades', topicId, getRaterRole(), currentAssignment?.reviewer_order, currentAssignment?.committee_role],
    queryFn: () => GradingApi.getMyGrades(
        topicId!, 
        getRaterRole(), 
        currentAssignment?.reviewer_order, 
        currentAssignment?.committee_role
    ),
    enabled: !!topicId,
  });

  const { data: criteriaData, isLoading: isLoadingCriteria } = useGradingCriteria({ 
    criteriaType: 'FINAL',
    topicId: topicId || undefined 
  });

  const criteria = useMemo(() => {
    if (!criteriaData) return [];
    if (Array.isArray(criteriaData)) return criteriaData;
    const data = criteriaData as any;
    return data.FINAL || data.SUPERVISOR || Object.values(data)[0] || [];
  }, [criteriaData]);

  const students = useMemo(() => {
    if (!selectedTopic?.registrations) return [];
    return selectedTopic.registrations.map((reg: any) => ({
      id: reg.student.id,
      name: reg.student.full_name,
      code: reg.student.student_code || 'N/A',
      class: reg.student.class_name || 'N/A',
      avatar: reg.student.avatar_url
    }));
  }, [selectedTopic]);

  const isConfirmed = useMemo(() => {
    return myGradesData?.students?.some((s: any) => s.status === 'SUBMITTED');
  }, [myGradesData]);

  // Use permissions from backend
  const permissions = myGradesData?.permissions;
  
  const getPermissionForActiveTab = () => {
    if (!permissions) return { allowed: true, code: 'LOADING' };
    if (activeTab === 'advisor') return { allowed: permissions.grade_supervisor, code: permissions.grade_supervisor_code, reason: permissions.grade_supervisor_reason };
    if (activeTab === 'reviewer') return { allowed: permissions.grade_reviewer, code: permissions.grade_reviewer_code, reason: permissions.grade_reviewer_reason };
    if (activeTab === 'council') return { allowed: permissions.grade_committee, code: permissions.grade_committee_code, reason: permissions.grade_committee_reason };
    return { allowed: false, code: 'UNKNOWN' };
  };

  const { allowed: isPhaseAllowed, reason: phaseError } = getPermissionForActiveTab();
  const isLocked = isConfirmed || !isPhaseAllowed;

  // Handle value changes to calculate averages
  const handleValuesChange = () => {
    const values = form.getFieldsValue();
    const newAverages: Record<string, number> = {};
    students.forEach(student => {
      let total = 0;
      let count = 0;
      criteria.forEach(criterion => {
        const score = values.grades?.[student.id]?.[criterion.id];
        if (typeof score === 'number') {
          total += score;
          count++;
        }
      });
      newAverages[student.id] = count > 0 ? total / count : 0;
    });
    setAverages(newAverages);
  };

  // Sync Form with existing grades
  useEffect(() => {
    if (isConfirmed && students.length > 0 && criteria.length > 0) {
      const gradesUpdate: Record<string, any> = {};
      const notesUpdate: Record<string, any> = {};
      myGradesData?.students?.forEach((sData: any) => {
        if (!gradesUpdate[sData.studentId]) gradesUpdate[sData.studentId] = {};
        sData.grades.forEach((g: any) => {
          gradesUpdate[sData.studentId][g.criterionId] = g.score;
          notesUpdate[g.criterionId] = g.comment; 
        });
      });
      form.setFieldsValue({ grades: gradesUpdate, notes: notesUpdate });
      handleValuesChange();
    } else if (topicId && !isLoadingMyGrades && !isConfirmed) {
      form.resetFields();
      setAverages({});
    }
  }, [isConfirmed, myGradesData, students, criteria, topicId, isLoadingMyGrades]);

  const submitGradeMutation = useSubmitGrade();

  const handleSubmit = async () => {
    try {
      // Use validateFields without popover messages to keep UI clean
      const values = await form.validateFields();
      
      const submissions = students.map(student => {
        const studentGrades = values.grades?.[student.id];
        if (!studentGrades) throw new Error(`Thiếu điểm cho sinh viên ${student.name}`);

        const gradeScores: GradeScore[] = criteria.map(criterion => {
          const score = studentGrades[criterion.id];
          if (score === undefined || score === null) {
            throw new Error(`Tiêu chí "${criterion.name}" của SV ${student.name} chưa có điểm`);
          }
          return {
            criterion_id: criterion.id,
            score: score,
            comment: values.notes?.[criterion.id] || undefined,
          };
        });

        return {
          topic_id: topicId!,
          student_id: student.id,
          rater_role: getRaterRole(),
          scores: gradeScores,
        };
      });

      await Promise.all(submissions.map(sub => submitGradeMutation.mutateAsync(sub)));
      notify.success('Đã gửi phiếu đánh giá thành công!');
      queryClient.invalidateQueries({ queryKey: ['my-grades', topicId] });
    } catch (error: any) {
      console.error('Submission failed:', error);
      notify.error(error.message || 'Vui lòng kiểm tra lại đầy đủ các cột điểm');
    }
  };

  const renderTopicStatus = (status: string) => {
    return <TopicStatusBadge status={status as any} />;
  };

  if (topicId) {
    if (isLoadingTopic || isLoadingCriteria || isLoadingMyGrades) {
      return <div className="p-12 text-center"><Spin size="large" tip="Đang tải dữ liệu..." /></div>;
    }

    const firstGradedStudent = myGradesData?.students?.[0];
    const gradedAt = firstGradedStudent?.gradedAt;

    return (
      <div className="page-container">
        <div className="flex items-center justify-between">
          <Button icon={<ArrowLeftOutlined />} onClick={() => setSearchParams({})}>Quay lại danh sách</Button>
          {isConfirmed && (
            <Tag color="green" icon={<CheckCircleOutlined />} className="px-3 py-1 text-sm font-bold uppercase">
              {activeTab === 'advisor' ? 'Đã xác nhận - Hướng dẫn' : 'Đã xác nhận - Phản biện/Hội đồng'}
            </Tag>
          )}
        </div>

        {isConfirmed && (
          <Alert
            message="Đánh giá đã hoàn tất"
            description={`Dữ liệu đã được lưu lúc ${dayjs(gradedAt).format('HH:mm DD/MM/YYYY')}. Bạn đang xem ở chế độ chỉ đọc.`}
            type="success"
            showIcon
          />
        )}

        {!isPhaseAllowed && phaseError && (
          <Alert
            message="Thông báo về quyền chấm điểm"
            description={phaseError}
            type="info"
            showIcon
            className="border-l-4 border-l-blue-500 shadow-sm"
          />
        )}

        <Card className="shadow-lg border-t-4 border-t-blue-600">
          <Title level={3} className="text-center mb-1 uppercase">PHIẾU ĐÁNH GIÁ KHÓA LUẬN TỐT NGHIỆP</Title>
          <Text type="secondary" className="block text-center mb-6 italic text-blue-500">BỘ TIÊU CHÍ 10 LEARNING OUTCOMES (LO)</Text>

          <div className="bg-blue-50 p-6 rounded-xl mb-6 border border-blue-100">
            <Row gutter={32}>
              <Col span={14}>
                <Text type="secondary" className="block text-xs uppercase mb-1 font-bold">Tên đề tài</Text>
                <Text strong className="text-lg text-blue-900">{selectedTopic?.title}</Text>
              </Col>
              <Col span={10} className="border-l border-blue-200">
                <Text type="secondary" className="block text-xs uppercase mb-2 font-bold">Nhóm thực hiện</Text>
                <div className="space-y-1">
                  {students.map((s, i) => (
                    <div key={s.id} className="flex gap-2">
                      <Tag color="blue">{i + 1}</Tag>
                      <Text strong>{s.name} ({s.code} - {s.class})</Text>
                    </div>
                  ))}
                </div>
              </Col>
            </Row>
          </div>

          <Form form={form} onValuesChange={handleValuesChange} validateMessages={{ required: '' }}>
            <Table dataSource={criteria} rowKey="id" pagination={false} bordered size="middle" className="grading-table"
              columns={[
                { title: 'STT', key: 'idx', width: 60, align: 'center', render: (_, __, i) => i + 1 },
                { title: 'Tiêu chí LO', dataIndex: 'name', key: 'name', width: 400, render: (t) => <Text strong>{t}</Text> },
                { title: 'Kết quả', children: students.map((s, i) => ({
                    title: `SV ${i + 1}`, key: `sv_${s.id}`, width: 120, align: 'center',
                    render: (_, r) => (
                      <Form.Item name={['grades', s.id, r.id]} rules={[{ required: true }]} className="mb-0">
                        <InputNumber min={0} max={10} step={0.5} className="w-full text-center" disabled={isLocked} />
                      </Form.Item>
                    )
                  }))
                },
                { title: 'Ghi Chú', key: 'note', render: (_, r) => (
                  <Form.Item name={['notes', r.id]} className="mb-0">
                    <TextArea autoSize={{ minRows: 1 }} className="border-none bg-transparent hover:bg-white" placeholder="Không bắt buộc..." disabled={isLocked} />
                  </Form.Item>
                )}
              ]}
              summary={() => (
                <>
                  <Table.Summary.Row className="bg-gray-50 font-bold">
                    <Table.Summary.Cell index={0} colSpan={2} className="text-right">TRUNG BÌNH CỘNG</Table.Summary.Cell>
                    {students.map(s => (
                      <Table.Summary.Cell key={`avg_${s.id}`} index={2} className="text-center">
                        <Text strong className="text-blue-600 text-lg">{(averages[s.id] || 0).toFixed(2)}</Text>
                      </Table.Summary.Cell>
                    ))}
                    <Table.Summary.Cell index={3} />
                  </Table.Summary.Row>
                  <Table.Summary.Row className="bg-white font-bold h-24">
                    <Table.Summary.Cell index={0} colSpan={2} className="text-right">XẾP LOẠI</Table.Summary.Cell>
                    {students.map(s => {
                      const pass = (averages[s.id] || 0) >= 5.0;
                      return (
                        <Table.Summary.Cell key={`res_${s.id}`} index={2} className="text-center">
                          <div className="flex flex-col items-center gap-1">
                            <Checkbox checked={pass} disabled className="pass-checkbox pointer-events-none">Đạt</Checkbox>
                            <Checkbox checked={!pass} disabled className="fail-checkbox pointer-events-none">Không đạt</Checkbox>
                          </div>
                        </Table.Summary.Cell>
                      );
                    })}
                    <Table.Summary.Cell index={3} />
                  </Table.Summary.Row>
                </>
              )}
            />

            {!isLocked && (
              <div className="flex justify-end gap-3 mt-10 no-print pb-4">
                <Button size="large" onClick={() => form.resetFields()}>Nhập lại</Button>
                <Button size="large" type="primary" icon={<CheckCircleOutlined />} onClick={handleSubmit} loading={submitGradeMutation.isPending}>Lưu và Gửi Phiếu Đánh Giá</Button>
              </div>
            )}
          </Form>
        </Card>
        <style dangerouslySetInnerHTML={{ __html: `
          .grading-table .ant-table-thead > tr > th { background: #f0f7ff !important; font-weight: bold; text-align: center; }
          .pass-checkbox .ant-checkbox-checked .ant-checkbox-inner { background-color: #52c41a; border-color: #52c41a; }
          .fail-checkbox .ant-checkbox-checked .ant-checkbox-inner { background-color: #ff4d4f; border-color: #ff4d4f; }
        ` }} />
      </div>
    );
  }

  // Shared columns for Advisor / Reviewer / Council tabs
  const dashboardColumns = [
    { title: 'STT', key: 'stt', width: 60, align: 'center' as const, render: (_: any, __: any, index: number) => index + 1 },
    { title: 'Mã ĐT', dataIndex: 'code', key: 'code', width: 100, render: (t: string) => <Tag>{t || 'N/A'}</Tag> },
    { title: 'Tên đề tài', dataIndex: 'title', key: 'title', render: (t: string, r: any) => (
        <div><div className="font-medium text-base">{t}</div><div className="text-xs text-gray-500">GVHD: {r.supervisor?.full_name}</div></div>
    )},
    { title: 'Sinh viên', key: 'students', render: (_: any, r: any) => {
        const m = r.registrations?.[0]?.group?.members || [];
        return <Avatar.Group>{m.map((mi: any) => <Avatar key={mi.user.id} src={mi.user.avatar_url}>{mi.user.full_name?.[0]}</Avatar>)}</Avatar.Group>;
    }},
    { title: 'Trạng thái', dataIndex: 'status', key: 'status', render: (s: string) => renderTopicStatus(s) },
    { title: 'Hành động', key: 'action', render: (_: any, r: any) => (
      <Button type="primary" onClick={() => setSearchParams({ topicId: r.id })}>Xem & Chấm điểm</Button>
    )},
  ];

  // Department dashboard
  const renderDepartmentTab = () => {
    if (isLoadingSummary) return <div className="flex justify-center py-20"><Spin size="large" /></div>;
    if (!summaryData) return null;

    const allTopics = summaryData.allTopics || [];
    const readyTopics = summaryData.ready || [];
    const missingSupervisorTopics = summaryData.missingSupervisor || [];
    const missingReviewerTopics = summaryData.missingReviewer || [];
    const finalizedTopics = summaryData.finalized || [];
    const getFilteredData = (data: any[]) => {
      if (!deptSearch) return data;
      const q = deptSearch.toLowerCase();
      return data.filter(r =>
        r.title?.toLowerCase().includes(q) ||
        r.code?.toLowerCase().includes(q) ||
        r.supervisor?.full_name?.toLowerCase().includes(q) ||
        r.registrations?.some((reg: any) => reg.student?.full_name?.toLowerCase().includes(q) || reg.student?.student_code?.includes(q))
      );
    };

    const tabData: Record<string, any[]> = {
      all: allTopics,
      missing_s: missingSupervisorTopics,
      missing_r: missingReviewerTopics,
      ready: readyTopics,
      finalized: finalizedTopics,
    };

    const currentData = getFilteredData(tabData[activeSubTab] || []);

    const columns = [
      { title: '#', key: 'idx', width: 48, align: 'center' as const, render: (_: any, __: any, i: number) => <Text type="secondary" className="text-xs">{i + 1}</Text> },
      { title: 'Mã đề tài', dataIndex: 'code', key: 'code', width: 130, render: (t: string) => <Tag className="font-mono text-xs">{t || 'N/A'}</Tag> },
      {
        title: 'Tên đề tài', dataIndex: 'title', key: 'title',
        render: (t: string) => <Text className="font-medium text-sm leading-snug" style={{ display: 'block', maxWidth: 280 }}>{t}</Text>
      },
      {
        title: 'Sinh viên', key: 'students', width: 160,
        render: (_: any, r: any) => {
          const regs = r.registrations || [];
          if (regs.length === 0) return <Text type="secondary" className="text-xs">Chưa có SV</Text>;
          return (
            <div className="space-y-1">
              {regs.slice(0, 2).map((reg: any) => (
                <div key={reg.student?.id} className="text-xs leading-tight">
                  <div className="font-medium">{reg.student?.full_name}</div>
                  <div className="text-gray-400">MSSV: {reg.student?.student_code || 'N/A'} • {reg.student?.class_name || 'N/A'}</div>
                </div>
              ))}
            </div>
          );
        }
      },
      {
        title: 'GVHD', key: 'supervisor', width: 160,
        render: (_: any, r: any) => r.supervisor
          ? <div className="text-xs"><div className="font-medium">{r.supervisor.full_name}</div></div>
          : <Tag color="red" className="text-xs">Chưa có GVHD</Tag>
      },
      {
        title: 'Tiến độ chấm điểm', key: 'progress', width: 180,
        render: (_: any, r: any) => (
          <Space direction="vertical" size={6} className="w-full">
            <div className="flex justify-between items-center">
              {r.gradingStatus?.supervisorGraded
                ? <Tag color="green" className="m-0 text-xs">✓ GVHD đã chấm</Tag>
                : <Tag color="red" className="m-0 text-xs">● Chưa có điểm GVHD</Tag>}
            </div>
            <div className="flex items-center gap-1">
              <Tag color={r.gradingStatus?.isReviewerComplete ? 'green' : 'orange'} className="m-0 text-xs">
                Phản biện: {r.gradingStatus?.reviewerGradedCount ?? 0}/{r.gradingStatus?.totalReviewersRequired ?? 2}
              </Tag>
            </div>
          </Space>
        )
      },
      {
        title: 'Trạng thái xét', key: 'review_status', width: 160,
        render: (_: any, r: any) => {
          if (r.is_eligible_for_defense !== null && r.is_eligible_for_defense !== undefined) {
            return <Tag color="blue" className="text-xs">Đã phân loại</Tag>;
          }
          if (r.gradingStatus?.isReadyForDecision) {
            return <Tag color="green" className="text-xs">Sẵn sàng xét</Tag>;
          }
          if (!r.gradingStatus?.supervisorGraded) {
            return <Tag color="red" className="text-xs">Chưa đủ điều kiện</Tag>;
          }
          return <Tag color="orange" className="text-xs">Chưa đủ điều kiện</Tag>;
        }
      },
      {
        title: 'Hành động', key: 'action', width: 140, align: 'center' as const,
        render: (_: any, r: any) => (
          <Button size="small" onClick={() => navigate(`/topics/${r.id}`)} className="text-xs">Xem chi tiết ›</Button>
        )
      },
    ];

    const subTabConfig = [
      { key: 'missing_s', icon: <CloseCircleOutlined />, color: '#ff4d4f', label: `Thiếu GVHD (${missingSupervisorTopics.length})`, data: missingSupervisorTopics },
      { key: 'missing_r', icon: <WarningOutlined />, color: '#fa8c16', label: `Thiếu phản biện (${missingReviewerTopics.length})`, data: missingReviewerTopics },
      { key: 'ready', icon: <CheckCircleOutlined />, color: '#52c41a', label: `Sẵn sàng xét (${readyTopics.length})`, data: readyTopics },
      { key: 'finalized', icon: <FlagOutlined />, color: '#1677ff', label: `Đã quyết định (${finalizedTopics.length})`, data: finalizedTopics },
    ];

    return (
      <div>
        {/* Summary stat cards */}
        <Row gutter={[16, 16]} className="mb-6">
          {[
            { key: 'missing_s', icon: <CloseCircleOutlined style={{ fontSize: 28, color: '#ff4d4f' }} />, label: 'Thiếu GVHD', count: missingSupervisorTopics.length, desc: 'Chưa có điểm của giảng viên hướng dẫn', color: '#fff1f0', border: '#ffccc7', textColor: '#cf1322' },
            { key: 'missing_r', icon: <WarningOutlined style={{ fontSize: 28, color: '#fa8c16' }} />, label: 'Thiếu phản biện', count: missingReviewerTopics.length, desc: 'Chưa đủ điểm của phản biện', color: '#fff7e6', border: '#ffd591', textColor: '#d46b08' },
            { key: 'ready', icon: <CheckCircleOutlined style={{ fontSize: 28, color: '#52c41a' }} />, label: 'Sẵn sàng xét', count: readyTopics.length, desc: 'Đã đủ điểm, chờ phân loại', color: '#f6ffed', border: '#b7eb8f', textColor: '#389e0d' },
            { key: 'finalized', icon: <FlagOutlined style={{ fontSize: 28, color: '#1677ff' }} />, label: 'Đã quyết định', count: finalizedTopics.length, desc: 'Đã phân loại (Oral/Poster/Không đạt)', color: '#e6f4ff', border: '#91caff', textColor: '#0958d9' },
          ].map(card => (
            <Col xs={24} sm={12} lg={6} key={card.key}>
              <div
                className="rounded-xl p-4 cursor-pointer transition-all hover:shadow-md"
                style={{ background: card.color, border: `1.5px solid ${card.border}` }}
                onClick={() => setActiveSubTab(card.key)}
              >
                <div className="flex items-start gap-4">
                  <div className="mt-1">{card.icon}</div>
                  <div className="flex-1">
                    <div className="text-sm font-medium" style={{ color: card.textColor }}>{card.label}</div>
                    <div className="text-4xl font-bold mt-0.5" style={{ color: card.textColor }}>{card.count}</div>
                    <div className="text-xs text-gray-500 mt-1">Đề tài</div>
                  </div>
                </div>
                <div className="text-xs mt-3" style={{ color: card.textColor, opacity: 0.8 }}>{card.desc} <span className="ml-1">›</span></div>
              </div>
            </Col>
          ))}
        </Row>

        {/* Filter tabs */}
        <div className="flex gap-2 mb-4 flex-wrap">
          {subTabConfig.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveSubTab(tab.key)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all border"
              style={activeSubTab === tab.key
                ? { background: tab.color, color: '#fff', borderColor: tab.color }
                : { background: '#fff', color: '#555', borderColor: '#d9d9d9' }}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Sub-tab description */}
        <div className="text-xs text-gray-500 mb-3">
          {activeSubTab === 'missing_s' && 'Danh sách đề tài chưa có điểm của Giảng viên hướng dẫn'}
          {activeSubTab === 'missing_r' && 'Danh sách đề tài chưa đủ điểm của Giảng viên phản biện được phân công'}
          {activeSubTab === 'ready' && 'Danh sách đề tài đã đủ điểm GVHD + Phản biện, chờ Trưởng bộ môn phân loại'}
          {activeSubTab === 'finalized' && 'Danh sách đề tài đã được phân loại hình thức bảo vệ'}
        </div>

        {/* Search + Filter bar */}
        <div className="flex gap-3 mb-4 flex-wrap items-center">
          <Input
            prefix={<SearchOutlined className="text-gray-400" />}
            placeholder="Tìm kiếm theo tên đề tài, mã đề tài, sinh viên..."
            value={deptSearch}
            onChange={e => setDeptSearch(e.target.value)}
            allowClear
            className="flex-1 min-w-52 max-w-md"
          />
          <Button icon={<DownloadOutlined />} className="ml-auto">Xuất Excel</Button>
        </div>

        {/* Table */}
        <Table
          dataSource={currentData}
          rowKey="id"
          columns={columns}
          pagination={{ pageSize: 10, showTotal: (total) => `Hiển thị 1 - ${Math.min(10, total)} của ${total} đề tài`, showSizeChanger: false }}
          className="rounded-lg overflow-hidden"
          rowClassName="hover:bg-blue-50 transition-colors"
          locale={{ emptyText: <div className="py-10 text-gray-400 text-center">Không có đề tài nào trong mục này</div> }}
        />

        {/* Legend */}
        <div className="mt-6 p-4 bg-gray-50 rounded-xl border border-gray-100">
          <div className="text-xs font-semibold text-gray-500 mb-3">Giải thích trạng thái xét</div>
          <Row gutter={16}>
            {[
              { icon: <CloseCircleOutlined style={{ color: '#ff4d4f' }} />, title: 'Thiếu GVHD', desc: 'Chưa có điểm của Giảng viên hướng dẫn' },
              { icon: <WarningOutlined style={{ color: '#fa8c16' }} />, title: 'Thiếu phản biện', desc: 'Chưa đủ điểm của tất cả phản biện được phân công' },
              { icon: <CheckCircleOutlined style={{ color: '#52c41a' }} />, title: 'Sẵn sàng xét', desc: 'Đã đủ điểm (GVHD + tất cả phản biện), chờ Trưởng bộ môn phân loại' },
              { icon: <FlagOutlined style={{ color: '#1677ff' }} />, title: 'Đã quyết định', desc: 'Đã được phân loại (Oral/Poster/Không đạt), chờ bước Hội đồng' },
            ].map((item, i) => (
              <Col xs={24} sm={12} lg={6} key={i}>
                <div className="flex items-start gap-2">
                  <span className="mt-0.5 text-base">{item.icon}</span>
                  <div>
                    <div className="text-xs font-semibold text-gray-700">{item.title}</div>
                    <div className="text-xs text-gray-500 leading-snug">{item.desc}</div>
                  </div>
                </div>
              </Col>
            ))}
          </Row>
        </div>
      </div>
    );
  };

  return (
    <div className="page-container">
      <div className="page-inner">
        {/* Header */}
        <Card className="page-header-card">
          <div className="flex items-center gap-3">
            <div className="page-header-icon"><CheckCircleOutlined className="text-base" /></div>
            <div>
              <div className="page-header-title">Đánh giá khóa luận</div>
              <div className="page-header-subtitle">Quản lý và theo dõi tiến độ chấm điểm các đề tài</div>
            </div>
          </div>
        </Card>

        <Card className="page-card-flush">
          <Tabs
            activeKey={activeTab}
            onChange={(key) => {
              setActiveTab(key);
              setSearchParams({ type: key });
            }}
            className="sys-tabs"
            tabBarStyle={{ paddingLeft: '24px', paddingTop: '8px' }}
            items={[
              ...(user?.role === 'HEAD' ? [{ key: 'department', label: 'Quản lý Bộ môn', children: <div className="p-6">{renderDepartmentTab()}</div> }] : []),
              { key: 'advisor', label: 'Hướng dẫn', children: <Table dataSource={advisorTopics?.topics || []} columns={dashboardColumns} rowKey="id" loading={isLoadingAdvisor} className="sys-table" pagination={{ pageSize: 10, className: 'px-6 py-4' }} /> },
              { key: 'reviewer', label: 'Phản biện', children: <Table dataSource={reviewerAssignments?.map((a: any) => ({ ...a.topic, reviewer_order: a.reviewer_order })) || []} columns={dashboardColumns} rowKey="id" loading={isLoadingReviewer} className="sys-table" pagination={{ pageSize: 10, className: 'px-6 py-4' }} /> },
              { key: 'council', label: 'Hội đồng', children: <Table dataSource={councilAssignments?.map((a: any) => ({ ...a.topic, committee_role: a.committee_role })) || []} columns={dashboardColumns} rowKey="id" loading={isLoadingCouncil} className="sys-table" pagination={{ pageSize: 10, className: 'px-6 py-4' }} /> },
            ]}
          />
        </Card>

        <DefensePivotModal
          visible={pivotModalVisible}
          onCancel={() => setPivotModalVisible(false)}
          topic={selectedTopicForPivot}
          loading={finalizePivotMutation.isPending}
          onConfirm={(data) => {
            finalizePivotMutation.mutate({
              topicId: selectedTopicForPivot.id,
              isEligible: data.isEligible,
              defenseType: data.defenseType,
            });
          }}
        />
      </div>
    </div>
  );
};

export default Evaluation;
