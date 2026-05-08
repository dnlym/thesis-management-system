import { useState, useEffect, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Card, Form, InputNumber, Button, Spin, Alert, Input, Tabs, Table, Tag, Space, Divider, Row, Col, Typography, Avatar, Checkbox, Badge, Select, Tooltip, Pagination, Modal, Popover } from 'antd';
import { notify } from '@/utils/notification';
import { ArrowLeftOutlined, CheckCircleOutlined, SaveOutlined, UserOutlined, WarningOutlined, FlagOutlined, LockOutlined, HistoryOutlined, InfoCircleOutlined, SearchOutlined, FilterOutlined, CloseCircleOutlined, DownloadOutlined } from '@ant-design/icons';
import { TopicStatusBadge } from '@/components/StatusBadge';
import { useAuthStore } from '@/store/auth';
import { useGradingCriteria, useSubmitGrade } from '@/hooks/useGrading';
import { useActiveSemester } from '@/hooks/useSemesters';
import { TopicsApi } from '@/api/topics';
import { AssignmentsApi } from '@/api/assignments';
import { GradingApi } from '@/api/grading';

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
import { RaterRole, GradeScore, GradeHistory } from '@/types';

const { TextArea } = Input;
const { Title, Text, Paragraph } = Typography;

/**
 * Trang Đánh Giá (Evaluation) - Fix triệt để lỗi Validation
 */
const Evaluation = () => {
  // Helper to get last name (First name in VN context)
  const getFirstName = (fullName: string) => {
    if (!fullName) return '';
    const parts = fullName.trim().split(' ');
    return parts[parts.length - 1];
  };
  const { user } = useAuthStore();
  const [form] = Form.useForm();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  const topicId = searchParams.get('topicId');
  const groupId = searchParams.get('groupId');
  const [activeTab, setActiveTab] = useState<string>(searchParams.get('type') || (user?.role === 'HEAD' ? 'department' : 'advisor'));
  const { data: activeSemester } = useActiveSemester();

  // HOD Pivot Modal state


  // HOD Department dashboard state
  const [deptSearch, setDeptSearch] = useState('');
  const debouncedDeptSearch = useDebounce(deptSearch, 300);

  const [lecturerSearch, setLecturerSearch] = useState('');
  const debouncedLecturerSearch = useDebounce(lecturerSearch, 300);
  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined);
  const [pageSize, setPageSize] = useState(10);
  const [selectedTopicForHistory, setSelectedTopicForHistory] = useState<string | null>(null);

  // Grade History Modal & State
  const [historyModalVisible, setHistoryModalVisible] = useState(false);
  const [reasonModalVisible, setReasonModalVisible] = useState(false);
  const [submitReason, setSubmitReason] = useState('');
  const [pendingSubmission, setPendingSubmission] = useState<any>(null);

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



  // 2. Grading mode queries
  const { data: selectedTopic, isLoading: isLoadingTopic } = useQuery({
    queryKey: ['topic', topicId],
    queryFn: () => TopicsApi.getById(topicId!),
    enabled: !!topicId,
  });

  const currentAssignment = useMemo(() => {
    if (activeTab === 'reviewer') return reviewerAssignments?.find((a: any) => (a.topic_id === topicId || a.topicId === topicId));
    if (activeTab === 'council') return councilAssignments?.find((a: any) => (a.topic_id === topicId || a.topicId === topicId));
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

  const { data: auditLogs } = useQuery({
    queryKey: ['audit-logs', topicId],
    queryFn: () => TopicsApi.getAuditLogs('Topic', topicId!),
    enabled: !!topicId && (user?.role === 'HEAD' || user?.role === 'ADMIN'),
  });

  const { data: gradeHistory, isLoading: isLoadingHistory, refetch: refetchHistory } = useQuery({
    queryKey: ['grade-history', selectedTopicForHistory || topicId],
    queryFn: () => GradingApi.getGradeHistoryByTopic((selectedTopicForHistory || topicId)!),
    enabled: !!(selectedTopicForHistory || topicId),
  });

  const criteria = useMemo(() => {
    if (!criteriaData) return [];
    if (Array.isArray(criteriaData)) return criteriaData;
    const data = criteriaData as any;
    if (activeTab === 'reviewer') return data.REVIEWER || data.REVIEWER_1 || [];
    if (activeTab === 'council') return data.COMMITTEE || data.COUNCIL_MEMBER || [];
    if (activeTab === 'advisor') return data.SUPERVISOR || [];

    return data.FINAL || data.SUPERVISOR || data.REVIEWER || data.COMMITTEE || Object.values(data)[0] || [];
  }, [criteriaData]);

  const students = useMemo(() => {
    if (!selectedTopic?.registrations) return [];
    // Filter registrations by groupId if present
    let filteredRegs = groupId
      ? selectedTopic.registrations.filter((reg: any) =>
        (reg.group_id || reg.groupId)?.toString().toLowerCase() === groupId.toString().toLowerCase()
      )
      : selectedTopic.registrations;

    // Fallback: If groupId filter results in empty list, show all (safety net)
    const regs = (groupId && filteredRegs.length === 0) ? selectedTopic.registrations : filteredRegs;

    return regs.map((reg: any) => ({
      id: reg.studentId || reg.student_id || reg.student?.id || reg.id,
      name: reg.student?.fullName || reg.student?.full_name || reg.fullName || reg.studentName || 'Chưa xác định',
      code: reg.student?.studentCode || reg.student?.student_code || reg.studentCode || reg.code || 'N/A',
      studentClass: reg.className || reg.class_name || reg.student?.className || reg.student?.class_name || reg.class || reg.student?.class || 'N/A',
      avatar: reg.student?.avatarUrl || reg.student?.avatar_url || reg.avatarUrl || reg.avatar
    }));
  }, [selectedTopic, myGradesData, groupId]);

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

  // NEW LOCKING LOGIC: Lock if finalized OR if phase not allowed.
  // We NO LONGER lock just because it's confirmed (SUBMITTED), unless it's also finalized.
  const isFinalized = selectedTopic?.status === 'FINALIZED';
  const isLocked = isFinalized || !isPhaseAllowed;
  const canEditAfterSubmit = !isFinalized && isPhaseAllowed && user?.role !== 'STUDENT';

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

  const handleSubmit = async (reason?: string) => {
    try {
      const values = await form.validateFields();

      // Check if we need a reason (is updating existing grades)
      const isUpdating = myGradesData?.students?.some((s: any) => s.status === 'SUBMITTED');
      if (isUpdating && !reason && user?.role !== 'ADMIN') {
        setPendingSubmission(values);
        setReasonModalVisible(true);
        return;
      }

      const submissions = students.map(student => {
        const gradeScores: GradeScore[] = criteria.map(criterion => {
          const studentGrades = values.grades?.[student.id];
          const score = studentGrades?.[criterion.id];
          if (score === undefined || score === null) {
            throw new Error(`Tiêu chí "${criterion.name}" của SV ${student.name} chưa có điểm`);
          }
          return {
            criterion_id: criterion.id,
            score: score,
            comment: values.notes?.[criterion.id] || undefined,
          };
        });

        console.log(`[Evaluation] Submitting ${gradeScores.length} scores for student ${student.id} using criteria IDs: ${gradeScores.map(gs => gs.criterion_id).join(', ')}`);

        return {
          topic_id: topicId!,
          group_id: groupId || undefined,
          student_id: student.id,
          rater_role: getRaterRole(),
          reviewer_order: currentAssignment?.reviewer_order,
          committee_role: currentAssignment?.committee_role as any,
          scores: gradeScores,
          reason: reason,
        };
      });

      await Promise.all(submissions.map(sub => submitGradeMutation.mutateAsync(sub)));
      notify.success('Đã lưu điểm thành công!');


      setReasonModalVisible(false);
      setSubmitReason('');
      queryClient.invalidateQueries({ queryKey: ['my-grades', topicId] });
      refetchHistory();
    } catch (error: any) {
      console.error('Submission failed:', error);
      notify.error(error.message || 'Vui lòng kiểm tra lại đầy đủ các cột điểm');
    }
  };

  const handleReasonSubmit = () => {
    if (!submitReason.trim()) {
      notify.warning('Vui lòng nhập lý do chỉnh sửa');
      return;
    }
    handleSubmit(submitReason);
  };

  const renderTopicStatus = (status: string) => {
    return <TopicStatusBadge status={status as any} />;
  };

  const renderGradingView = () => {
    if (isLoadingTopic || isLoadingCriteria || isLoadingMyGrades) {
      return <div className="p-12 text-center"><Spin size="large" tip="Đang tải dữ liệu..." /></div>;
    }

    const firstGradedStudent = myGradesData?.students?.[0];
    const gradedAt = firstGradedStudent?.gradedAt;

    return (
      <div className="page-container">
        <div className="page-inner">
          <div className="flex items-center justify-between mb-4 no-print">
            <Space>
              <Button
                icon={<ArrowLeftOutlined />}
                onClick={() => setSearchParams({})}
                className="hover:text-blue-600 border-gray-200 shadow-sm"
              >
                Quay lại danh sách
              </Button>
              <Button
                icon={<FlagOutlined />}
                onClick={() => setHistoryModalVisible(true)}
                className="bg-amber-50 text-amber-700 border-amber-200"
              >
                Lịch sử điểm
              </Button>
            </Space>
            <Space>
              {isFinalized && (
                <Tag color="error" icon={<CloseCircleOutlined />} className="px-4 py-1 rounded-full text-xs font-bold uppercase tracking-wider shadow-sm border-none">
                  Đã chốt kết quả
                </Tag>
              )}
              {isConfirmed && !isFinalized && (
                <Tag color="processing" icon={<CheckCircleOutlined />} className="px-4 py-1 rounded-full text-xs font-bold uppercase tracking-wider shadow-sm border-none">
                  Đã lưu điểm - Có thể sửa
                </Tag>
              )}
              {isConfirmed && isFinalized && (
                <Tag color="success" icon={<CheckCircleOutlined />} className="px-4 py-1 rounded-full text-xs font-bold uppercase tracking-wider shadow-sm border-none">
                  {activeTab === 'advisor' ? 'HĐ đã chốt - Hướng dẫn' : 'HĐ đã chốt - Phản biện/Hội đồng'}
                </Tag>
              )}
            </Space>
          </div>

          {isConfirmed && (
            <Alert
              message={<span className="font-bold">Đánh giá đã hoàn tất</span>}
              description={`Dữ liệu đã được lưu lúc ${dayjs(gradedAt).format('HH:mm DD/MM/YYYY')}. Bạn đang xem ở chế độ chỉ đọc.`}
              type="success"
              showIcon
              className="mb-6 rounded-xl border-green-100 shadow-sm"
            />
          )}

          {!isPhaseAllowed && phaseError && (
            <Alert
              message={<span className="font-bold text-blue-800">Thông báo về quyền chấm điểm</span>}
              description={phaseError}
              type="info"
              showIcon
              className="mb-6 rounded-xl border-l-4 border-l-blue-500 shadow-sm bg-blue-50/50"
            />
          )}

          <Card className="page-header-card mb-6 no-print">
            <div className="text-center w-full">
              <Title level={3} className="mb-1 uppercase tracking-wide">PHIẾU ĐÁNH GIÁ KHÓA LUẬN TỐT NGHIỆP</Title>
              <Text type="secondary" className="italic font-medium text-blue-500">BỘ TIÊU CHÍ 10 LEARNING OUTCOMES (LO)</Text>
            </div>
          </Card>

          <Card
            className="shadow-lg border-t-4 border-t-blue-600 rounded-2xl overflow-hidden no-print"
            styles={{ body: { padding: 0 } }}
          >
            <div className="bg-gradient-to-r from-blue-50/80 to-white p-6">
              <Row gutter={32} align="top">
                <Col span={15}>
                  <div className="mb-3">
                    <Text type="secondary" className="text-[10px] uppercase font-bold tracking-[0.2em] text-blue-400">
                      Đề tài nghiên cứu
                    </Text>
                  </div>
                  <Title level={5} className="m-0 text-blue-900 leading-relaxed font-semibold italic">
                    "{selectedTopic?.title}"
                  </Title>
                </Col>

                <Col span={9} className="border-l-2 border-blue-100/50 pl-6">
                  <div className="mb-3">
                    <Text type="secondary" className="text-[10px] uppercase font-bold tracking-[0.2em] text-blue-400">
                      Nhóm sinh viên thực hiện
                    </Text>
                  </div>
                  <div className="space-y-2">
                    {students.map((s, i) => (
                      <div key={s.id} className="flex items-start gap-2.5 bg-white/60 p-2 rounded-xl border border-blue-50 shadow-sm hover:shadow-md transition-all">
                        <Avatar
                          size={28}
                          src={s.avatar}
                          className="flex-shrink-0 border border-blue-100"
                          icon={<UserOutlined />}
                        />
                        <div className="flex flex-col">
                          <Text strong className="text-gray-800 text-[13px] leading-tight">{s.name}</Text>
                          <Text className="text-[10px] text-gray-500 mt-0.5">
                          <span className="font-mono bg-blue-50 px-1 rounded text-blue-600">{s.code}</span>
                          <Divider type="vertical" className="border-gray-300 mx-1" />
                          <span>{s.studentClass}</span>
                        </Text>
                        </div>
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
                  { title: 'Tiêu chí đánh giá', dataIndex: 'name', key: 'name', width: 400, render: (t) => <Text strong>{t}</Text> },
                  {
                    title: 'Kết quả', children: students.map((s, i) => ({
                      title: (
                        <div className="flex flex-col items-center py-1">
                          <Text className="text-[10px] text-gray-400 font-normal mb-0.5 uppercase">Sinh viên {i + 1}</Text>
                          <Text strong className="text-blue-600 text-[13px] uppercase tracking-tight">
                            {getFirstName(s.name)}
                          </Text>
                        </div>
                      ),
                      key: `sv_${s.id}`, width: 140, align: 'center',
                      render: (_, r, rowIndex) => (
                        <Space direction="vertical" size={2} className="w-full">
                          <Form.Item name={['grades', s.id, r.id]} rules={[{ required: true }]} className="mb-0">
                            <InputNumber
                              id={`grade-input-${i}-${rowIndex}`}
                              min={0}
                              max={10}
                              step={0.5}
                              className="w-full text-center grade-input"
                              disabled={isLocked}
                              onFocus={(e) => e.target.select()}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === 'ArrowDown') {
                                  e.preventDefault();
                                  const nextWrapper = document.getElementById(`grade-input-${i}-${rowIndex + 1}`);
                                  if (nextWrapper) {
                                    const input = nextWrapper.tagName === 'INPUT' ? nextWrapper : nextWrapper.querySelector('input');
                                    if (input) (input as HTMLElement).focus();
                                  }
                                } else if (e.key === 'ArrowUp') {
                                  e.preventDefault();
                                  const prevWrapper = document.getElementById(`grade-input-${i}-${rowIndex - 1}`);
                                  if (prevWrapper) {
                                    const input = prevWrapper.tagName === 'INPUT' ? prevWrapper : prevWrapper.querySelector('input');
                                    if (input) (input as HTMLElement).focus();
                                  }
                                }
                              }}
                            />
                          </Form.Item>
                          {gradeHistory?.some((h: any) => {
                            const hRole = h.grade?.rater_role;
                            const currentRoleGroup = getRaterRole(); // SUPERVISOR, REVIEWER, COMMITTEE

                            let isSameRoleGroup = false;
                            if (currentRoleGroup === 'SUPERVISOR') {
                              isSameRoleGroup = hRole === 'SUPERVISOR';
                            } else if (currentRoleGroup === 'REVIEWER') {
                              // Phải khớp đúng vị trí phản biện (1, 2, 3)
                              if (currentAssignment?.reviewer_order) {
                                isSameRoleGroup = hRole === `REVIEWER_${currentAssignment.reviewer_order}`;
                              } else {
                                isSameRoleGroup = hRole?.startsWith('REVIEWER');
                              }
                            } else if (currentRoleGroup === 'COMMITTEE') {
                              isSameRoleGroup = hRole?.startsWith('COMMITTEE') || hRole?.startsWith('COUNCIL');
                            }

                            return h.grade.criterion_id === r.id && h.grade.student_id === s.id && isSameRoleGroup;
                          }) && (
                              <Tooltip title="Tiêu chí này đã từng được thay đổi điểm số. Click 'Lịch sử điểm' để xem chi tiết.">
                                <Badge status="warning" text={<span className="text-[9px] text-amber-600 font-medium">Đã sửa</span>} className="cursor-help" />
                              </Tooltip>
                            )}
                        </Space>
                      )
                    }))
                  },
                  {
                    title: 'Ghi chú', key: 'note', render: (_, r) => (
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
                <div className="flex justify-end gap-3 mt-10 no-print pb-4 px-6">
                  <Button size="large" onClick={() => form.resetFields()} disabled={submitGradeMutation.isPending}>Hủy thay đổi</Button>
                  <Button size="large" type="primary" icon={<SaveOutlined />} onClick={() => handleSubmit()} loading={submitGradeMutation.isPending}>
                    {isConfirmed ? 'Lưu thay đổi' : 'Lưu điểm'}
                  </Button>
                </div>
              )}

              {/* HOD Finalize Button */}
              {(user?.role === 'HEAD' || user?.role === 'ADMIN') && !isFinalized && (
                <div className="flex justify-center mt-8 mb-4 no-print border-t border-dashed border-gray-200 pt-8">
                  <Card className="bg-blue-50 border-blue-200 shadow-md w-full max-w-2xl text-center">
                    <Title level={5} className="text-blue-800 mb-4">Xác nhận chốt điểm & Hoàn tất đề tài</Title>
                    <Text className="block mb-6 text-gray-600">
                      Hành động này sẽ khóa toàn bộ quyền chỉnh sửa điểm của Giảng viên.
                      Điểm số sẽ được công bố chính thức cho sinh viên.
                    </Text>
                    <Button
                      size="large"
                      type="primary"
                      danger
                      icon={<CheckCircleOutlined />}
                      className="px-10 h-12 font-bold shadow-lg"
                      onClick={() => {
                        Modal.confirm({
                          title: groupId ? 'Xác nhận chốt kết quả NHÓM?' : 'Xác nhận chốt kết quả đề tài?',
                          content: 'Sau khi chốt, Giảng viên không thể thay đổi điểm số cho các sinh viên trong nhóm này. Chỉ Admin mới có quyền điều chỉnh.',
                          okText: 'Chốt ngay',
                          cancelText: 'Hủy',
                          okType: 'danger',
                          onOk: async () => {
                            try {
                              if (groupId) {
                                await GradingApi.finalizeGroupGrades(groupId);
                              } else {
                                await GradingApi.finalizeGrades(topicId!);
                              }
                              notify.success('Đã chốt điểm thành công!');
                              queryClient.invalidateQueries({ queryKey: ['topic', topicId] });
                              queryClient.invalidateQueries({ queryKey: ['grade-summary'] });
                            } catch (err: any) {
                              notify.error(err.message || 'Lỗi khi chốt điểm');
                            }
                          }
                        });
                      }}
                    >
                      CHỐT ĐIỂM NGAY
                    </Button>
                  </Card>
                </div>
              )}
              {/* Audit Log / System Decision History */}
              {(user?.role === 'HEAD' || user?.role === 'ADMIN') && auditLogs && auditLogs.length > 0 && (
                <div className="mt-12 bg-gray-50 p-8 rounded-2xl border border-gray-200 shadow-sm mb-10">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="p-2 bg-blue-100 rounded-lg">
                      <HistoryOutlined className="text-blue-600 text-xl" />
                    </div>
                    <div>
                      <Title level={4} className="m-0 text-gray-800">Nhật ký hệ thống & Quyết định tự động</Title>
                      <Text type="secondary" className="text-xs">Lịch sử xét duyệt và các tác động từ hệ thống</Text>
                    </div>
                  </div>
                  <div className="space-y-4">
                    {auditLogs.map((log: any, index: number) => (
                      <div key={log.id || index} className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 hover:border-blue-200 transition-all">
                        <div className="flex justify-between items-start mb-2">
                          <Space>
                            <Text strong className="text-blue-700 uppercase text-xs tracking-wider">
                              {log.action === 'AUTO_EVALUATE_ELIGIBILITY' ? 'QUYẾT ĐỊNH TỰ ĐỘNG' : log.action}
                            </Text>
                            {log.user && (
                              <Text type="secondary" className="text-xs">| Thực hiện bởi: {log.user.full_name}</Text>
                            )}
                          </Space>
                          <Text type="secondary" className="text-xs italic">{dayjs(log.created_at || log.createdAt).format('HH:mm - DD/MM/YYYY')}</Text>
                        </div>
                        <Paragraph className="m-0 text-gray-700 font-medium">
                          {log.description || (log.new_value?.reason ? `Lý do: ${log.new_value.reason}` : 'Hệ thống đã thực hiện đánh giá tự động dựa trên quy chế.')}
                        </Paragraph>
                        {log.new_value?.isEligible !== undefined && (
                          <div className="mt-3">
                            <Tag color={log.new_value.isEligible ? "success" : "error"} className="rounded-full px-4 border-none py-0.5 font-bold uppercase text-[10px]">
                              {log.new_value.isEligible ? "ĐẠT ĐIỀU KIỆN BẢO VỆ" : "KHÔNG ĐẠT"}
                            </Tag>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </Form>
          </Card>
        </div>
      </div>
    );
  };

  // Shared columns for Advisor / Reviewer / Council tabs
  const dashboardColumns = [
    { title: 'STT', key: 'stt', width: 60, align: 'center' as const, render: (_: any, __: any, index: number) => index + 1 },
    {
      title: 'Mã nhóm',
      dataIndex: 'code',
      key: 'code',
      width: 100,
      render: (t: string, r: any) => {
        const groupName = r.registrations?.[0]?.group?.name || t;
        return (
          <Tag color="blue" className="font-bold">
            <HighlightText text={groupName} keyword={debouncedLecturerSearch} />
          </Tag>
        );
      }
    },
    {
      title: 'Tên đề tài',
      dataIndex: 'title',
      key: 'title',
      render: (t: string, r: any) => (
        <div>
          <div className="font-medium text-sm leading-tight mb-1">
            <HighlightText text={t} keyword={debouncedLecturerSearch} />
          </div>
          <Space size={4} className="text-[10px] text-gray-400">
            <Text type="secondary" className="text-[10px]">GVHD: <HighlightText text={r.supervisor?.full_name} keyword={debouncedLecturerSearch} /></Text>
            <Divider type="vertical" className="m-0 border-gray-300" />
            <Text type="warning" className="text-[10px]">Hạn chốt: {dayjs(r.semester?.thesis_deadline).format('DD/MM/YYYY')}</Text>
          </Space>
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
    {
      title: 'Trạng thái',
      key: 'status_combined',
      width: 140,
      render: (_: any, r: any) => {
        if (r.status === 'FINALIZED') {
          return <Tag color="error" icon={<LockOutlined />} className="m-0 rounded-full px-3">Đã chốt (Locked)</Tag>;
        }

        // Logic check if any grades exist for this topic
        const hasGrades = r.grades?.length > 0;
        if (hasGrades) {
          return <Tag color="processing" className="m-0 rounded-full px-3">Đang chấm</Tag>;
        }

        return <Tag color="default" className="m-0 rounded-full px-3">Chưa chấm</Tag>;
      }
    },
    {
      title: 'Hành động',
      key: 'action',
      width: 180,
      render: (_: any, r: any) => {
        const currentPhase = activeSemester?.calculated_phase;
        const isAtReviewPhaseOrLater = currentPhase === 'REVIEWING' || currentPhase === 'DEFENSE' || currentPhase === 'FINAL';
        const supervisorGraded = r.gradingStatus?.supervisorGraded;
        const supervisorScore = r.students?.[0]?.finalScore?.supervisor_score;
        const reviewerScore = r.students?.[0]?.finalScore?.reviewer_avg_score;

        const isAutoFailed = isAtReviewPhaseOrLater && (!supervisorGraded || (supervisorScore !== null && supervisorScore < 6));
        const isReviewerFailed = r.gradingStatus?.isReviewerComplete && (reviewerScore !== null && reviewerScore < 6);
        const isManuallyFailed = r.is_eligible_for_defense === false;
        const isFailed = isAutoFailed || isReviewerFailed || isManuallyFailed;

        return (
          <Space>
            <Button
              type={r.status === 'FINALIZED' ? "default" : "primary"}
              size="small"
              disabled={isFailed && r.status !== 'FINALIZED'}
              onClick={() => setSearchParams({
                topicId: r.topicId || r.topic_id || r.id,
                groupId: r.topicId ? r.id : (r.groupId || r.group_id || r.group?.id),
                type: activeTab
              })}
              className="text-xs rounded-lg"
            >
              {isFailed && r.status !== 'FINALIZED' ? 'Bị loại' : (r.status === 'FINALIZED' ? 'Xem chi tiết' : 'Xem & Chấm điểm')}
            </Button>
            <Tooltip title="Xem nhanh lịch sử sửa điểm">
              <Button
                size="small"
                icon={<HistoryOutlined />}
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedTopicForHistory(r.id);
                  setHistoryModalVisible(true);
                }}
                className="text-gray-400 hover:text-blue-500 border-none shadow-none"
              />
            </Tooltip>
          </Space>
        );
      }
    },
  ];

  const filterLecturerData = (data: any[]) => {
    let filtered = data;

    // Search filter
    if (debouncedLecturerSearch) {
      filtered = filtered.filter(r => {
        const studentNames = (r.registrations?.[0]?.group?.members || []).map((m: any) => m.user.full_name);
        return matchKeyword(debouncedLecturerSearch, r.title, r.code, r.supervisor?.full_name, ...studentNames);
      });
    }

    // Status filter
    if (statusFilter) {
      filtered = filtered.filter(r => {
        if (statusFilter === 'FINALIZED') return r.status === 'FINALIZED';
        if (statusFilter === 'GRADING') return r.status !== 'FINALIZED' && r.grades?.length > 0;
        if (statusFilter === 'NOT_GRADED') return r.status !== 'FINALIZED' && (!r.grades || r.grades.length === 0);
        return true;
      });
    }

    return filtered;
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
      { 
        title: 'STT', 
        key: 'idx', 
        width: 50, 
        align: 'center' as const, 
        render: (_: any, __: any, i: number) => <Text className="text-[11px] font-medium text-gray-600">{i + 1}</Text> 
      },
      {
        title: 'Mã nhóm',
        dataIndex: 'code',
        key: 'code',
        width: 100,
        render: (t: string, r: any) => {
          const groupName = r.registrations?.[0]?.group?.name || t;
          return (
            <Tag color="blue" className="font-bold text-[11px] m-0 border-none bg-blue-50 text-blue-600 px-2">
              <HighlightText text={groupName} keyword={debouncedDeptSearch} />
            </Tag>
          );
        }
      },
      {
        title: 'Tên đề tài', 
        dataIndex: 'title', 
        key: 'title',
        render: (t: string) => (
          <div className="max-w-[300px]">
            <Text className="font-semibold text-[13px] leading-tight block mb-1">
              <HighlightText text={t} keyword={debouncedDeptSearch} />
            </Text>
          </div>
        )
      },
      {
        title: 'Sinh viên', 
        key: 'students', 
        width: 180,
        render: (_: any, r: any) => {
          const regs = r.registrations || [];
          if (regs.length === 0) return <Text type="secondary" className="text-xs">Chưa có SV</Text>;
          return (
            <div className="space-y-1.5">
              {regs.slice(0, 2).map((reg: any) => (
                <div key={reg.student?.id} className="flex flex-col">
                  <Text className="text-[12px] font-medium leading-none">
                    <HighlightText text={reg.student?.full_name} keyword={debouncedDeptSearch} />
                  </Text>
                  <Text className="text-[10px] text-gray-400 mt-0.5">
                    <HighlightText text={reg.student?.student_code} keyword={debouncedDeptSearch} />
                  </Text>
                </div>
              ))}
              {regs.length > 2 && <Text type="secondary" className="text-[10px] italic">+{regs.length - 2} sinh viên khác</Text>}
            </div>
          );
        }
      },
      {
        title: 'GVHD', 
        key: 'supervisor', 
        width: 150,
        render: (_: any, r: any) => r.supervisor
          ? <div className="flex flex-col">
              <Text className="text-[12px] font-medium">
                <HighlightText text={r.supervisor.full_name} keyword={debouncedDeptSearch} />
              </Text>
              <Text className="text-[10px] text-gray-400 italic">GV Hướng dẫn</Text>
            </div>
          : <Tag color="error" className="text-[10px]">Trống</Tag>
      },
      {
        title: 'Tiến độ chấm điểm', 
        key: 'progress', 
        width: 200,
        render: (_: any, r: any) => (
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2">
              <Badge status={r.gradingStatus?.supervisorGraded ? "success" : "default"} />
              <Text className={`text-[11px] ${r.gradingStatus?.supervisorGraded ? 'text-green-600 font-medium' : 'text-gray-400'}`}>
                Hướng dẫn: {r.gradingStatus?.supervisorGraded ? 'Đã xong' : 'Chưa chấm'}
              </Text>
            </div>
            <div className="flex items-center gap-2">
              <Badge status={r.gradingStatus?.isReviewerComplete ? "success" : "warning"} />
              <Text className={`text-[11px] ${r.gradingStatus?.isReviewerComplete ? 'text-green-600 font-medium' : 'text-orange-500'}`}>
                Phản biện: {r.gradingStatus?.reviewerGradedCount ?? 0}/{r.gradingStatus?.totalReviewersRequired ?? 2}
              </Text>
            </div>
            <div className="flex items-center gap-2">
              <Badge status={r.gradingStatus?.isCommitteeComplete ? "success" : "processing"} />
              <Text className={`text-[11px] ${r.gradingStatus?.isCommitteeComplete ? 'text-green-600 font-medium' : 'text-blue-500'}`}>
                Hội đồng: {r.gradingStatus?.committeeGradedCount ?? 0}/3
              </Text>
            </div>
          </div>
        )
      },
      {
        title: 'Trạng thái xét', 
        key: 'review_status', 
        width: 140,
        render: (_: any, r: any) => {
          const currentPhase = activeSemester?.calculated_phase;
          
          // 1. Nếu đã có quyết định chính thức từ HOD
          if (r.is_eligible_for_defense !== null && r.is_eligible_for_defense !== undefined) {
            return (
              <Popover 
                content={(
                  <div className="max-w-xs">
                    <div className={`mb-2 font-bold ${r.is_eligible_for_defense ? 'text-green-600' : 'text-red-600'} flex items-center gap-1`}>
                      {r.is_eligible_for_defense ? <CheckCircleOutlined /> : <CloseCircleOutlined />} 
                      Kết quả rà soát
                    </div>
                    <div className="text-gray-600 text-sm">
                      {r.is_eligible_for_defense ? 'Đề tài đã đủ điều kiện bảo vệ dựa trên các đầu điểm đạt yêu cầu.' : 'Đề tài không đủ điều kiện bảo vệ do không đạt ngưỡng điểm quy định.'}
                    </div>
                  </div>
                )}
                trigger="click"
              >
                <Tag color={r.is_eligible_for_defense ? "success" : "error"} className="text-[11px] rounded-full px-2 border-none bg-opacity-10 cursor-pointer hover:shadow-sm">
                  {r.is_eligible_for_defense ? "Đạt điều kiện" : "Không đạt"}
                </Tag>
              </Popover>
            );
          }

          // 2. Logic kiểm tra điều kiện nghiêm ngặt dựa trên giai đoạn và điểm số
          const firstStudent = r.students?.[0]?.finalScore;
          const supervisorScore = firstStudent?.supervisor_score;
          const reviewerScore = firstStudent?.reviewer_avg_score;

          const renderFailedTag = (label: string, reason: string) => (
            <Popover 
              content={(
                <div className="max-w-xs">
                  <div className="mb-2 font-bold text-red-600 flex items-center gap-1">
                    <CloseCircleOutlined /> Lý do không đạt
                  </div>
                  <div className="text-gray-600 text-sm">{reason}</div>
                </div>
              )}
              trigger="click"
            >
              <Tag color="error" className="text-[11px] rounded-full px-2 border-none bg-red-50 text-red-600 cursor-pointer hover:shadow-sm">
                {label}
              </Tag>
            </Popover>
          );

          // Kiểm tra thiếu điểm GVHD ngay khi bước vào giai đoạn Phản biện trở đi
          const isAtReviewPhaseOrLater = currentPhase === 'REVIEWING' || currentPhase === 'DEFENSE' || currentPhase === 'FINAL';
          if (isAtReviewPhaseOrLater && !r.gradingStatus?.supervisorGraded) {
            return renderFailedTag("Loại (Thiếu điểm GVHD)", "Giảng viên hướng dẫn chưa nhập điểm cho đề tài khi đã đến hạn Phản biện.");
          }

          // Kiểm tra nếu GVHD chấm rớt (< 6.0)
          if (r.gradingStatus?.supervisorGraded && supervisorScore !== null && supervisorScore < 6) {
            return renderFailedTag("Loại (GVHD rớt)", `Điểm hướng dẫn (${supervisorScore.toFixed(2)}) thấp hơn ngưỡng quy định (6.0).`);
          }

          // Kiểm tra nếu GVPB chấm rớt (< 6.0)
          if (r.gradingStatus?.isReviewerComplete && reviewerScore !== null && reviewerScore < 6) {
            return renderFailedTag("Loại (GVPB rớt)", `Điểm trung bình phản biện (${reviewerScore.toFixed(2)}) thấp hơn ngưỡng quy định (6.0).`);
          }

          // 3. Trạng thái sẵn sàng xét
          if (r.gradingStatus?.isReadyForDecision) {
            return <Tag color="success" className="text-[11px] rounded-full px-2 border-none bg-green-50 text-green-600">Sẵn sàng xét</Tag>;
          }

          // 4. Mặc định: Chờ dữ liệu
          return <Tag color="default" className="text-[11px] rounded-full px-2 border-none bg-gray-50 text-gray-400">Đang chấm...</Tag>;
        }
      },
    ];


    const currentData = getFilteredData(allTopics);

    return (
      <div>
        {/* Table */}
        <Table
          dataSource={currentData}
          rowKey="id"
          columns={columns}
          bordered
          pagination={{
            pageSize: pageSize,
            showSizeChanger: true,
            pageSizeOptions: ['10', '20', '50', '100'],
            onShowSizeChange: (_, size) => setPageSize(size),
            showTotal: (total) => `Hiển thị các đề tài của bộ môn (${total} đề tài)`
          }}
          className="rounded-xl overflow-hidden border border-gray-200 shadow-sm custom-hod-table"
          rowClassName="hover:bg-blue-50/50 transition-colors"
          locale={{ emptyText: <div className="py-10 text-gray-400 text-center">Không có đề tài nào trong mục này</div> }}
        />
      </div>
    );
  };

  return (
    <>
      <style>{`
        .custom-hod-table .ant-table-thead > tr > th {
          background-color: #fafafa !important;
          color: #64748B !important;
          font-weight: 600 !important;
          font-size: 12px !important;
          border-right: 1px solid #f0f0f0 !important;
          text-transform: none !important;
          padding: 12px 8px !important;
        }
        .custom-hod-table .ant-table-thead > tr > th:last-child {
          border-right: none !important;
        }
        .custom-hod-table .ant-table-tbody > tr > td {
          font-size: 13px !important;
          border-right: 1px solid #f0f0f0 !important;
        }
        .custom-hod-table .ant-table-tbody > tr > td:last-child {
          border-right: none !important;
        }
      `}</style>
      {topicId ? renderGradingView() : (
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
                className="sys-tabs sys-tabs-capsule !ml-6 !mt-2"
                tabBarExtraContent={
                  <div className="mr-6 flex gap-3 items-center">
                    {activeTab === 'department' ? (
                      <GlobalSearch
                        value={deptSearch}
                        onChange={setDeptSearch}
                        placeholder="Tìm đề tài, sinh viên, GV..."
                        className="w-72"
                      />
                    ) : (
                      <>
                        <Input
                          placeholder="Tìm nhanh..."
                          prefix={<SearchOutlined className="text-gray-400" />}
                          className="w-64 rounded-lg"
                          value={lecturerSearch}
                          onChange={(e) => setLecturerSearch(e.target.value)}
                          allowClear
                        />
                        <Select
                          placeholder="Bộ lọc"
                          className="w-32 rounded-lg"
                          allowClear
                          value={statusFilter}
                          onChange={setStatusFilter}
                          options={[
                            { label: 'Chưa chấm', value: 'NOT_GRADED' },
                            { label: 'Đang chấm', value: 'GRADING' },
                            { label: 'Đã chốt', value: 'FINALIZED' },
                          ]}
                        />
                      </>
                    )}
                  </div>
                }
                items={[
                  ...(user?.role === 'HEAD' ? [{
                    key: 'department',
                    label: 'Quản lý Bộ môn',
                    children: <div className="pt-6 pb-6 pr-6 pl-0 bg-white">{renderDepartmentTab()}</div>
                  }] : []),
                  {
                    key: 'advisor',
                    label: 'Hướng dẫn',
                    children: (
                      <div className="pt-6 pb-6 pr-6 pl-0 space-y-4 bg-white">
                        <div className="mt-1">
                          <Text type="secondary" className="text-[11px] italic">
                            <InfoCircleOutlined className="mr-1" />
                            Lưu ý: Dữ liệu sau khi chốt (Locked) sẽ không thể thay đổi trừ khi có yêu cầu phúc khảo từ Quản trị viên.
                          </Text>
                        </div>
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
                      <div className="pt-6 pb-6 pr-6 pl-0 space-y-4 bg-white">

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
                      <div className="pt-6 pb-6 pr-6 pl-0 space-y-4 bg-white">

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

          </div>
        </div>
      )}

      {/* Shared Modals & Styles */}


      <Modal
        title={<Space><WarningOutlined className="text-amber-500" /> Xác nhận thay đổi điểm số</Space>}
        open={reasonModalVisible}
        onOk={handleReasonSubmit}
        onCancel={() => {
          setReasonModalVisible(false);
          setSubmitReason('');
        }}
        okText="Xác nhận lưu"
        cancelText="Hủy"
        confirmLoading={submitGradeMutation.isPending}
      >
        <div className="mb-4">
          <Text>Bạn đang thực hiện thay đổi điểm số đã lưu trước đó. Vui lòng nhập lý do điều chỉnh để hệ thống ghi lại nhật ký chuyên môn.</Text>
        </div>
        <TextArea
          rows={4}
          placeholder="Ví dụ: Nhập nhầm điểm, phúc khảo, giảng viên chấm lại..."
          value={submitReason}
          onChange={(e) => setSubmitReason(e.target.value)}
        />
      </Modal>

      <Modal
        title={<Title level={4}><Space><FlagOutlined className="text-blue-600" /> Lịch sử biến động điểm</Space></Title>}
        open={historyModalVisible}
        onCancel={() => {
          setHistoryModalVisible(false);
          setSelectedTopicForHistory(null);
        }}
        footer={[<Button key="close" onClick={() => {
          setHistoryModalVisible(false);
          setSelectedTopicForHistory(null);
        }}>Đóng</Button>]}
        width={1100}
      >
        <Table
          dataSource={gradeHistory}
          rowKey="id"
          pagination={{ pageSize: 5 }}
          columns={[
            { title: 'Thời gian', dataIndex: 'created_at', key: 'time', width: 140, render: (t) => dayjs(t).format('HH:mm DD/MM/YYYY') },
            {
              title: 'Vai trò', key: 'role', width: 120,
              render: (_, r: GradeHistory) => {
                const role = r.grade?.rater_role;
                if (role === 'SUPERVISOR') return <Tag color="blue">Hướng dẫn</Tag>;
                if (role?.startsWith('REVIEWER')) return <Tag color="cyan">Phản biện {role.split('_')[1] || ''}</Tag>;
                if (role?.startsWith('COMMITTEE')) return <Tag color="purple">Hội đồng</Tag>;
                return <Tag>{role}</Tag>;
              }
            },
            { title: 'Sinh viên', key: 'student', width: 160, render: (_, r: GradeHistory) => r.grade?.student?.full_name },
            { title: 'Tiêu chí', key: 'criterion', width: 250, render: (_, r: GradeHistory) => r.grade?.criterion?.name },
            {
              title: 'Biến động', key: 'change', align: 'center', width: 120,
              render: (_, r: GradeHistory) => (
                <Space>
                  <Text delete type="secondary">{r.old_score}</Text>
                  <Text strong className="text-blue-600">→</Text>
                  <Text strong className="text-green-600">{r.new_score}</Text>
                </Space>
              )
            },
            { title: 'Lý do', dataIndex: 'reason', key: 'reason' },
            { title: 'Người sửa', key: 'user', width: 180, render: (_, r: GradeHistory) => <Tag className="m-0" color={r.user_role === 'ADMIN' ? 'red' : 'blue'}>{r.changed_by?.full_name}</Tag> },
          ]}
        />
      </Modal>

      <style dangerouslySetInnerHTML={{
        __html: `
      .grading-table .ant-table-thead > tr > th { 
        background: #f8fafc !important; 
        font-weight: 800; 
        text-align: center;
        text-transform: uppercase;
        font-size: 11px;
        letter-spacing: 0.05em;
        color: #64748b;
      }
      .grading-table .ant-table-summary .ant-table-cell {
        background: #f8fafc !important;
      }
      .pass-checkbox .ant-checkbox-checked .ant-checkbox-inner { background-color: #22c55e; border-color: #22c55e; }
      .fail-checkbox .ant-checkbox-checked .ant-checkbox-inner { background-color: #ef4444; border-color: #ef4444; }
      
      .grade-input {
        border-radius: 8px;
        transition: all 0.3s;
      }
      .grade-input:focus {
        border-color: #3b82f6;
        box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.1);
      }
      
      @media print {
        .no-print { display: none !important; }
        .ant-card { border: none !important; box-shadow: none !important; }
      }
    ` }} />

    </>
  );
};

export default Evaluation;
