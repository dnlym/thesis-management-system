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
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import {
  canSupervisorGrade,
  canReviewerGrade,
  canCommitteeGrade,
  isSemesterCompleted
} from '@/utils/semester-rules';
import GlobalSearch from '@/components/GlobalSearch';
import HighlightText from '@/components/HighlightText';
import { matchKeyword } from '@/utils/search';
import { useDebounce } from '@/hooks/useDebounce';
import { RaterRole, GradeScore } from '@/types';

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
  const debouncedDeptSearch = useDebounce(deptSearch, 300);

  const [lecturerSearch, setLecturerSearch] = useState('');
  const debouncedLecturerSearch = useDebounce(lecturerSearch, 300);
  const [pageSize, setPageSize] = useState(10);

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
                {
                  title: 'Kết quả', children: students.map((s, i) => ({
                    title: `SV ${i + 1}`, key: `sv_${s.id}`, width: 120, align: 'center',
                    render: (_, r) => (
                      <Form.Item name={['grades', s.id, r.id]} rules={[{ required: true }]} className="mb-0">
                        <InputNumber min={0} max={10} step={0.5} className="w-full text-center" disabled={isLocked} />
                      </Form.Item>
                    )
                  }))
                },
                {
                  title: 'Ghi Chú', key: 'note', render: (_, r) => (
                    <Form.Item name={['notes', r.id]} className="mb-0">
                      <TextArea autoSize={{ minRows: 1 }} className="border-none bg-transparent hover:bg-white" placeholder="Không bắt buộc..." disabled={isLocked} />
                    </Form.Item>
                  )
                }
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
        <style dangerouslySetInnerHTML={{
          __html: `
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
    {
      title: 'Mã ĐT',
      dataIndex: 'code',
      key: 'code',
      width: 100,
      render: (t: string) => (
        <Tag className="font-mono">
          <HighlightText text={t} keyword={debouncedLecturerSearch} />
        </Tag>
      )
    },
    {
      title: 'Tên đề tài', dataIndex: 'title', key: 'title', render: (t: string, r: any) => (
        <div>
          <div className="font-medium text-base">
            <HighlightText text={t} keyword={debouncedLecturerSearch} />
          </div>
          <div className="text-xs text-gray-500">
            GVHD: <HighlightText text={r.supervisor?.full_name} keyword={debouncedLecturerSearch} />
          </div>
        </div>
      )
    },
    {
      title: 'Sinh viên', key: 'students', render: (_: any, r: any) => {
        const m = r.registrations?.[0]?.group?.members || [];
        return (
          <Space direction="vertical" size={0}>
            <Avatar.Group size="small">
              {m.map((mi: any) => <Avatar key={mi.user.id} src={mi.user.avatar_url}>{mi.user.full_name?.[0]}</Avatar>)}
            </Avatar.Group>
            <div className="text-[10px] text-gray-400 mt-1">
              {m.map((mi: any) => (
                <div key={mi.user.id}>
                  <HighlightText text={mi.user.full_name} keyword={debouncedLecturerSearch} />
                </div>
              ))}
            </div>
          </Space>
        );
      }
    },
    { title: 'Trạng thái', dataIndex: 'status', key: 'status', render: (s: string) => renderTopicStatus(s) },
    {
      title: 'Hành động', key: 'action', render: (_: any, r: any) => (
        <Button type="primary" onClick={() => setSearchParams({ topicId: r.id })}>Xem & Chấm điểm</Button>
      )
    },
  ];

  const filterLecturerData = (data: any[]) => {
    if (!debouncedLecturerSearch) return data;
    return data.filter(r => {
      const studentNames = (r.registrations?.[0]?.group?.members || []).map((m: any) => m.user.full_name);
      return matchKeyword(debouncedLecturerSearch, r.title, r.code, r.supervisor?.full_name, ...studentNames);
    });
  };

  // Department dashboard
  const renderDepartmentTab = () => {
    if (isLoadingSummary) return <div className="flex justify-center py-20"><Spin size="large" /></div>;
    if (!summaryData) return null;

    const allTopics = summaryData.allTopics || [];
    const getFilteredData = (data: any[]) => {
      if (!debouncedDeptSearch) return data;
      return data.filter(r =>
        matchKeyword(
          debouncedDeptSearch,
          r.title,
          r.code,
          r.supervisor?.full_name,
          ...r.registrations?.map((reg: any) => reg.student?.full_name),
          ...r.registrations?.map((reg: any) => reg.student?.student_code)
        )
      );
    };



    const columns = [
      { title: '#', key: 'idx', width: 48, align: 'center' as const, render: (_: any, __: any, i: number) => <Text type="secondary" className="text-xs">{i + 1}</Text> },
      {
        title: 'Mã đề tài',
        dataIndex: 'code',
        key: 'code',
        width: 130,
        render: (t: string) => (
          <Tag className="font-mono text-xs">
            <HighlightText text={t} keyword={debouncedDeptSearch} />
          </Tag>
        )
      },
      {
        title: 'Tên đề tài', dataIndex: 'title', key: 'title',
        render: (t: string) => (
          <Text className="font-medium text-sm leading-snug" style={{ display: 'block', maxWidth: 280 }}>
            <HighlightText text={t} keyword={debouncedDeptSearch} />
          </Text>
        )
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
                  <div className="font-medium">
                    <HighlightText text={reg.student?.full_name} keyword={debouncedDeptSearch} />
                  </div>
                  <div className="text-gray-400">
                    MSSV: <HighlightText text={reg.student?.student_code} keyword={debouncedDeptSearch} /> • {reg.student?.class_name || 'N/A'}
                  </div>
                </div>
              ))}
            </div>
          );
        }
      },
      {
        title: 'GVHD', key: 'supervisor', width: 160,
        render: (_: any, r: any) => r.supervisor
          ? <div className="text-xs">
            <div className="font-medium">
              <HighlightText text={r.supervisor.full_name} keyword={debouncedDeptSearch} />
            </div>
          </div>
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


    const currentData = getFilteredData(allTopics);

    return (
      <div>
        {/* Search bar */}
        <div className="flex gap-3 mb-4 items-center">
          <GlobalSearch
            value={deptSearch}
            onChange={setDeptSearch}
            className="flex-1 min-w-52 max-w-md"
            placeholder="Tìm theo tên đề tài, mã số, sinh viên, giảng viên..."
          />
          <Button icon={<DownloadOutlined />} className="ml-auto">Xuất Excel</Button>
        </div>

        {/* Table */}
        <Table
          dataSource={currentData}
          rowKey="id"
          columns={columns}
          pagination={{ 
            pageSize: pageSize, 
            showSizeChanger: true, 
            pageSizeOptions: ['10', '20', '50', '100'],
            onShowSizeChange: (_, size) => setPageSize(size),
            showTotal: (total) => `Hiển thị các đề tài của bộ môn (${total} đề tài)` 
          }}
          className="rounded-lg overflow-hidden border border-gray-100 shadow-sm"
          rowClassName="hover:bg-blue-50 transition-colors"
          locale={{ emptyText: <div className="py-10 text-gray-400 text-center">Không có đề tài nào trong mục này</div> }}
        />
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

        <Card className="page-card-flush pt-2">
          <Tabs
            activeKey={activeTab}
            onChange={(key) => {
              setActiveTab(key);
              setSearchParams({ type: key });
            }}
            type="card"
            size="small"
            className="sys-tabs-filter"
            tabBarStyle={{ paddingLeft: '24px', marginBottom: '0' }}
            items={[
              { 
                key: 'department', 
                label: 'Quản lý Bộ môn', 
                children: <div className="p-6 bg-white">{renderDepartmentTab()}</div> 
              },
              { 
                key: 'advisor', 
                label: 'Hướng dẫn', 
                children: (
                  <div className="p-6 space-y-4 bg-white">
                    <GlobalSearch value={lecturerSearch} onChange={setLecturerSearch} className="max-w-md" />
                    <Table 
                      dataSource={filterLecturerData(advisorTopics?.topics || [])} 
                      columns={dashboardColumns} 
                      rowKey="id" 
                      loading={isLoadingAdvisor} 
                      className="sys-table" 
                      pagination={{ 
                        pageSize: pageSize,
                        showSizeChanger: true,
                        pageSizeOptions: ['10', '20', '50', '100'],
                        onShowSizeChange: (_, size) => setPageSize(size)
                      }} 
                    />
                  </div>
                ) 
              },
              { 
                key: 'reviewer', 
                label: 'Phản biện', 
                children: (
                  <div className="p-6 space-y-4 bg-white">
                    <GlobalSearch value={lecturerSearch} onChange={setLecturerSearch} className="max-w-md" />
                    <Table 
                      dataSource={filterLecturerData(reviewerAssignments?.map((a: any) => ({ ...a.topic, reviewer_order: a.reviewer_order })) || [])} 
                      columns={dashboardColumns} 
                      rowKey="id" 
                      loading={isLoadingReviewer} 
                      className="sys-table" 
                      pagination={{ 
                        pageSize: pageSize,
                        showSizeChanger: true,
                        pageSizeOptions: ['10', '20', '50', '100'],
                        onShowSizeChange: (_, size) => setPageSize(size)
                      }} 
                    />
                  </div>
                )
              },
              { 
                key: 'council', 
                label: 'Hội đồng', 
                children: (
                  <div className="p-6 space-y-4 bg-white">
                    <GlobalSearch value={lecturerSearch} onChange={setLecturerSearch} className="max-w-md" />
                    <Table 
                      dataSource={filterLecturerData(councilAssignments?.map((a: any) => ({ ...a.topic, committee_role: a.committee_role })) || [])} 
                      columns={dashboardColumns} 
                      rowKey="id" 
                      loading={isLoadingCouncil} 
                      className="sys-table" 
                      pagination={{ 
                        pageSize: pageSize,
                        showSizeChanger: true,
                        pageSizeOptions: ['10', '20', '50', '100'],
                        onShowSizeChange: (_, size) => setPageSize(size)
                      }} 
                    />
                  </div>
                )
              },
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
