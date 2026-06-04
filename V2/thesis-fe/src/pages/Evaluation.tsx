import { useState, useEffect, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Card, Form, InputNumber, Button, Spin, Alert, Input, Tabs, Table, Tag, Space, Divider, Row, Col, Typography, Avatar, Checkbox, Badge, Select, Tooltip, Pagination, Modal, Popover } from 'antd';
import { notify } from '@/utils/notification';
import { ArrowLeftOutlined, CheckCircleOutlined, SaveOutlined, UserOutlined, WarningOutlined, FlagOutlined, LockOutlined, HistoryOutlined, InfoCircleOutlined, SearchOutlined, FilterOutlined, CloseCircleOutlined, DownloadOutlined, SwapOutlined, CalendarOutlined } from '@ant-design/icons';
import { TopicStatusBadge } from '@/components/StatusBadge';
import { useAuthStore } from '@/store/auth';
import { useGradingCriteria, useSubmitGrade } from '@/hooks/useGrading';
import { useActiveSemester } from '@/hooks/useSemesters';
import { useSemesterStore } from '@/store/semester';
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
  const rawGroupId = searchParams.get('groupId');
  const groupId = (rawGroupId === 'undefined' || rawGroupId === 'null') ? null : rawGroupId;
  const [activeTab, setActiveTab] = useState<string>(searchParams.get('type') || (user?.role === 'HEAD' || user?.role === 'COORDINATOR' ? 'department' : 'advisor'));
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
  const [isRequestMode, setIsRequestMode] = useState(false);

  useEffect(() => {
    const type = searchParams.get('type');
    if (type && ['advisor', 'reviewer', 'council'].includes(type)) {
      setActiveTab(type);
    }
  }, [searchParams]);

  const { selectedSemesterId } = useSemesterStore();

  const [averages, setAverages] = useState<Record<string, number>>({});

  // 1. Dashboard queries
  const { data: advisorTopics, isLoading: isLoadingAdvisor } = useQuery({
    queryKey: ['advisor-topics', user?.id, selectedSemesterId],
    queryFn: () => TopicsApi.getAll({ supervisorId: user?.id, hasStudents: true, semesterId: selectedSemesterId || undefined }),
    enabled: !!user?.id && activeTab === 'advisor' && !topicId,
  });

  const { data: reviewerAssignments, isLoading: isLoadingReviewer } = useQuery({
    queryKey: ['reviewer-assignments', user?.id, selectedSemesterId],
    queryFn: () => AssignmentsApi.getAll({ assignmentType: 'REVIEWER', semesterId: selectedSemesterId || undefined }),
    enabled: !!user?.id && activeTab === 'reviewer' && !topicId,
  });

  const { data: councilAssignments, isLoading: isLoadingCouncil } = useQuery({
    queryKey: ['council-assignments', user?.id, selectedSemesterId],
    queryFn: () => AssignmentsApi.getAll({ assignmentType: 'COMMITTEE', semesterId: selectedSemesterId || undefined }),
    enabled: !!user?.id && activeTab === 'council' && !topicId,
  });

  const { data: summaryData, isLoading: isLoadingSummary, refetch: refetchSummary } = useQuery<any>({
    queryKey: ['grade-summary', user?.id, selectedSemesterId],
    queryFn: () => GradingApi.getGradeSummary(selectedSemesterId || undefined),
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
    refetchInterval: 3000,
  });

  const { data: criteriaData, isLoading: isLoadingCriteria } = useGradingCriteria({
    criteriaType: 'FINAL',
    topicId: topicId || undefined
  });

  const { data: auditLogs } = useQuery({
    queryKey: ['audit-logs', topicId],
    queryFn: () => TopicsApi.getAuditLogs('Topic', topicId!),
    enabled: !!topicId && (user?.role === 'HEAD' || user?.role === 'ADMIN' || user?.role === 'COORDINATOR'),
  });

  const { data: gradeHistory, isLoading: isLoadingHistory, refetch: refetchHistory } = useQuery({
    queryKey: ['grade-history', selectedTopicForHistory || topicId],
    queryFn: () => GradingApi.getGradeHistoryByTopic((selectedTopicForHistory || topicId)!),
    enabled: !!(selectedTopicForHistory || topicId),
    refetchInterval: 3000,
  });

  const criteria = useMemo(() => {
    if (!criteriaData) return [];
    if (Array.isArray(criteriaData)) return criteriaData;
    const data = criteriaData as any;
    if (activeTab === 'reviewer') return data.REVIEWER || data.REVIEWER_1 || [];
    if (activeTab === 'council') return data.COMMITTEE || data.COUNCIL_MEMBER || [];
    if (activeTab === 'advisor') return data.SUPERVISOR || [];

    return data.FINAL || data.SUPERVISOR || data.REVIEWER || data.COMMITTEE || Object.values(data)[0] || [];
  }, [criteriaData, activeTab]);

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
      avatar: reg.student?.avatarUrl || reg.student?.avatar_url || reg.avatarUrl || reg.avatar,
      midtermStatus: reg.midterm_status || reg.midtermStatus || reg.student?.midterm_status || reg.student?.midtermStatus,
      midtermFeedback: reg.midterm_feedback || reg.midtermFeedback || reg.student?.midterm_feedback || reg.student?.midtermFeedback,
      status: reg.status || reg.student?.status || reg.student?.registrationStatus
    }));
  }, [selectedTopic, myGradesData, groupId]);

  const allStudentsFailed = useMemo(() => {
    if (students.length === 0) return false;
    return students.every(s => s.midtermStatus === 'FAIL' || s.status === 'FAILED');
  }, [students]);

  const isSubmitted = useMemo(() => {
    return myGradesData?.students?.some((s: any) => s.status === 'SUBMITTED');
  }, [myGradesData]);

  const isPendingApproval = useMemo(() => {
    return myGradesData?.students?.some((s: any) => s.status === 'PENDING_APPROVAL');
  }, [myGradesData]);

  const isConfirmed = useMemo(() => {
    return isSubmitted || isPendingApproval;
  }, [isSubmitted, isPendingApproval]);

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
  const isPastDeadline = useMemo(() => {
    const phase = activeSemester?.calculated_phase;
    const deptConfig = activeSemester?.deptConfig;
    const now = dayjs();
    const globalDeadline = activeSemester?.thesis_deadline;
    if (activeTab === 'advisor') {
      // Giảng viên hướng dẫn được chấm đến khi hết giai đoạn phản biện (khóa khi sang Bảo vệ và Chốt điểm)
      return ['DEFENSE', 'FINAL'].includes(phase || '');
    }
    if (activeTab === 'reviewer') {
      // Phản biện bị khóa khi bắt đầu giai đoạn Bảo vệ
      return ['DEFENSE', 'FINAL'].includes(phase || '');
    }
    if (activeTab === 'council') {
      // Hội đồng được chấm trong suốt giai đoạn Bảo vệ, khóa khi sang FINAL
      return phase === 'FINAL';
    }

    return false;
  }, [activeSemester, activeTab]);

  const isFinalized = selectedTopic?.status === 'FINALIZED';
  const missingSupervisorGrades = useMemo(() => {
    if (activeTab !== 'reviewer' && activeTab !== 'council') return false;
    return students.some(s => {
      const sData = myGradesData?.students?.find((ms: any) => ms.studentId === s.id);
      return sData && !sData.raterStatuses?.hasSupervisorGraded;
    });
  }, [students, myGradesData, activeTab]);

  const missingReviewerGrades = useMemo(() => {
    if (activeTab !== 'council') return false;
    return students.some(s => {
      const sData = myGradesData?.students?.find((ms: any) => ms.studentId === s.id);
      return sData && !sData.raterStatuses?.hasReviewerGraded;
    });
  }, [students, myGradesData, activeTab]);
  const isAdminOrHead = user?.role === 'ADMIN' || user?.role === 'HEAD';

  const isLocked = isPendingApproval || (myGradesData?.grader?.id ? user?.id !== myGradesData.grader.id : false) || (((isFinalized || !isPhaseAllowed || isPastDeadline || missingSupervisorGrades || missingReviewerGrades)) && !isRequestMode);

  const canEditAfterSubmit = !isFinalized && isPhaseAllowed && user?.role !== 'STUDENT' && !isPastDeadline && !missingSupervisorGrades && !missingReviewerGrades && (myGradesData?.grader?.id ? user?.id === myGradesData.grader.id : true);

  // Handle value changes to calculate averages
  const handleValuesChange = () => {
    const values = form.getFieldsValue();
    const newAverages: Record<string, number> = {};
    students.forEach(student => {
      let total = 0;
      criteria.forEach(criterion => {
        const score = values.grades?.[student.id]?.[criterion.id];
        if (typeof score === 'number') {
          total += score * (criterion.weight || 1);
        }
      });
      newAverages[student.id] = total;
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
          if (g.comment) {
            notesUpdate[g.criterionId] = g.comment;
          }
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

      // CASE 1: Request Mode (Past Deadline)
      if (isPastDeadline || isRequestMode) {
        if (!reason) {
          setPendingSubmission(values);
          setReasonModalVisible(true);
          return;
        }
        // If we have a reason, the backend will handle the routing to GradeChangeRequest
      }


      const submissions = students
        .filter(student => student.midtermStatus !== 'FAIL' && student.status !== 'FAILED')
        .map(student => {
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

      let hasPendingRequest = false;
      for (const sub of submissions) {
        const res = await submitGradeMutation.mutateAsync(sub);
        if (res && (res as any).status === 'PENDING_APPROVAL') {
          hasPendingRequest = true;
        }
      }
      if (hasPendingRequest) {
        notify.info('Yêu cầu sửa điểm đã được gửi tới Trưởng bộ môn phê duyệt.');
      } else if (isRequestMode) {
        notify.success('Yêu cầu sửa điểm đã được gửi thành công!');
      } else {
        notify.success('Đã lưu điểm thành công!');
      }

      setReasonModalVisible(false);
      setSubmitReason('');
      setIsRequestMode(false);
      queryClient.invalidateQueries({ queryKey: ['my-grades', topicId] });
      queryClient.invalidateQueries({ queryKey: ['topic', topicId] });
      refetchHistory();
    } catch (error: any) {
      console.error('Submission failed:', error);
      const errMsg = error.response?.data?.message || error.message || 'Vui lòng kiểm tra lại đầy đủ các cột điểm';
      notify.error(errMsg);
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
              {isSubmitted && !isFinalized && (
                <Tag color="processing" icon={<CheckCircleOutlined />} className="px-4 py-1 rounded-full text-xs font-bold uppercase tracking-wider shadow-sm border-none">
                  Đã lưu điểm - Có thể sửa
                </Tag>
              )}
              {isPendingApproval && !isFinalized && (
                <Tag color="warning" icon={<HistoryOutlined />} className="px-4 py-1 rounded-full text-xs font-bold uppercase tracking-wider shadow-sm border-none">
                  Đang chờ duyệt sửa điểm
                </Tag>
              )}
              {isConfirmed && isFinalized && (
                <Tag color="success" icon={<CheckCircleOutlined />} className="px-4 py-1 rounded-full text-xs font-bold uppercase tracking-wider shadow-sm border-none">
                  {activeTab === 'advisor' ? 'HĐ đã chốt - Hướng dẫn' : 'HĐ đã chốt - Phản biện/Hội đồng'}
                </Tag>
              )}
              {isPastDeadline && !isFinalized && (
                <Tag color="volcano" icon={<LockOutlined />} className="px-4 py-1 rounded-full text-xs font-bold uppercase tracking-wider shadow-sm border-none">
                  Đã hết hạn nhập điểm
                </Tag>
              )}
            </Space>
          </div>

          {(() => {
            if (allStudentsFailed) {
              return (
                <Alert
                  message={<span className="font-bold text-red-800">Không thể chấm điểm - Đề tài/Nhóm đã rớt giữa kỳ</span>}
                  description={
                    <div>
                      <ul className="list-disc pl-4 mt-1">
                        {students.map(s => (
                          <li key={s.id}>
                            <strong>{s.name} ({s.code})</strong>: {(s.midtermFeedback || 'Rớt giữa kỳ (Không có phản hồi).').replace(/\(Hệ thống cập nhật theo yêu cầu\)\.?/gi, '').trim()}
                          </li>
                        ))}
                      </ul>
                    </div>
                  }
                  type="error"
                  showIcon
                  className="mb-6 rounded-xl border-l-4 border-l-red-500 shadow-sm bg-red-50/50"
                />
              );
            }

            if (missingSupervisorGrades) {
              return (
                <Alert
                  message={<span className="font-bold text-red-800">Chưa thể chấm điểm</span>}
                  description="Bạn chưa thể thực hiện chấm điểm do Giảng viên hướng dẫn chưa hoàn tất nhập điểm cho đề tài/sinh viên này."
                  type="error"
                  showIcon
                  className="mb-6 rounded-xl border-l-4 border-l-red-500 shadow-sm bg-red-50/50"
                />
              );
            }

            if (missingReviewerGrades) {
              return (
                <Alert
                  message={<span className="font-bold text-red-800">Chưa thể chấm điểm</span>}
                  description="Bạn chưa thể thực hiện chấm điểm do Giảng viên phản biện chưa hoàn tất nhập điểm cho đề tài/sinh viên này."
                  type="error"
                  showIcon
                  className="mb-6 rounded-xl border-l-4 border-l-red-500 shadow-sm bg-red-50/50"
                />
              );
            }

            if (isPendingApproval) {
              return (
                <Alert
                  message={<span className="font-bold">Yêu cầu sửa điểm đang chờ phê duyệt</span>}
                  description="Điểm số mới của bạn đã được lưu dưới dạng yêu cầu thay đổi và đang chờ Trưởng bộ môn phê duyệt. Bạn không thể chỉnh sửa trong thời gian này."
                  type="warning"
                  showIcon
                  className="mb-6 rounded-xl border-amber-100 shadow-sm"
                />
              );
            }

            if (isPastDeadline && !isRequestMode) {
              return (
                <Alert
                  message={<span className="font-bold">Hệ thống đã khóa nhập điểm</span>}
                  description={isConfirmed ? "Thời hạn nhập điểm đã kết thúc. Nếu bạn cần thay đổi điểm, vui lòng nhấn nút 'Yêu cầu sửa điểm' để gửi giải trình tới Trưởng bộ môn." : "Thời hạn nhập điểm đã kết thúc. Vui lòng liên hệ Trưởng bộ môn để được hỗ trợ."}
                  type="warning"
                  showIcon
                  className="mb-6 rounded-xl border-amber-100 shadow-sm"
                />
              );
            }

            if (isPastDeadline && isRequestMode) {
              return (
                <Alert
                  message={<span className="font-bold text-blue-800">Chế độ yêu cầu nhập/sửa điểm</span>}
                  description="Bạn đang ở chế độ chỉnh sửa điểm quá hạn. Vui lòng nhập điểm mới và nhấn nút bên dưới để gửi giải trình tới Trưởng bộ môn."
                  type="info"
                  showIcon
                  className="mb-6 rounded-xl border-blue-100 shadow-sm"
                />
              );
            }

            if (missingSupervisorGrades) {
              return (
                <Alert
                  message={<span className="font-bold text-amber-800">Chưa thể chấm điểm</span>}
                  description="Bạn chưa thể chấm điểm do Giảng viên hướng dẫn chưa hoàn thành nhập điểm cho sinh viên thuộc đề tài này."
                  type="warning"
                  showIcon
                  className="mb-6 rounded-xl border-amber-100 shadow-sm"
                />
              );
            }

            if (missingReviewerGrades) {
              return (
                <Alert
                  message={<span className="font-bold text-amber-800">Chưa thể chấm điểm</span>}
                  description="Bạn chưa thể chấm điểm do Giảng viên phản biện chưa hoàn thành nhập điểm cho sinh viên thuộc đề tài này."
                  type="warning"
                  showIcon
                  className="mb-6 rounded-xl border-amber-100 shadow-sm"
                />
              );
            }

            if (!isPhaseAllowed && phaseError) {
              return (
                <Alert
                  message={<span className="font-bold text-blue-800">Thông báo về quyền chấm điểm</span>}
                  description={phaseError}
                  type="info"
                  showIcon
                  className="mb-6 rounded-xl border-l-4 border-l-blue-500 shadow-sm bg-blue-50/50"
                />
              );
            }

            const hasFailedMembers = students.some(s => s.midtermStatus === 'FAIL' || s.status === 'FAILED');
            if (hasFailedMembers) {
              return (
                <Alert
                  message={<span className="font-bold text-amber-800">Cảnh báo - Có thành viên rớt giữa kỳ</span>}
                  description={
                    <div>
                      Một số thành viên trong nhóm đã rớt giữa kỳ và không thể chấm điểm. Bạn chỉ có thể chấm điểm cho các thành viên đạt điều kiện.
                      <br />
                      <strong>Chi tiết thành viên rớt giữa kỳ:</strong>
                      <ul className="list-disc pl-4 mt-1">
                        {students.filter(s => s.midtermStatus === 'FAIL' || s.status === 'FAILED').map(s => (
                          <li key={s.id}>
                            <strong>{s.name} ({s.code})</strong>: {s.midtermFeedback || 'Không đạt đánh giá giữa kỳ.'}
                          </li>
                        ))}
                      </ul>
                    </div>
                  }
                  type="warning"
                  showIcon
                  className="mb-6 rounded-xl border-l-4 border-l-amber-500 shadow-sm bg-amber-50/50"
                />
              );
            }

            if (isSubmitted) {
              return (
                <Alert
                  message={<span className="font-bold">Đánh giá đã hoàn tất</span>}
                  description={`Dữ liệu đã được lưu lúc ${dayjs(gradedAt).format('HH:mm DD/MM/YYYY')}. Bạn có thể chỉnh sửa nếu cần (vẫn trong thời hạn).`}
                  type="success"
                  showIcon
                  className="mb-6 rounded-xl border-green-100 shadow-sm"
                />
              );
            }

            return null;
          })()}

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
                    {students.map((s, i) => {
                      const isFailed = s.midtermStatus === 'FAIL' || s.status === 'FAILED';
                      const cardEl = (
                        <div key={s.id} className={`flex items-start gap-2.5 p-2 rounded-xl border border-blue-50 shadow-sm transition-all ${isFailed
                          ? 'bg-slate-100/60 opacity-50 line-through'
                          : 'bg-white/60 hover:shadow-md'
                          }`}>
                          <Avatar
                            size={28}
                            src={s.avatar}
                            className="flex-shrink-0 border border-blue-100"
                            icon={<UserOutlined />}
                          />
                          <div className="flex flex-col">
                            <Text strong className={`text-gray-800 text-[13px] leading-tight ${isFailed ? 'text-gray-400 line-through font-normal' : ''}`}>
                              {s.name}
                            </Text>
                            <Text className="text-[10px] text-gray-500 mt-0.5">
                              <span className="font-mono bg-blue-50 px-1 rounded text-blue-600">{s.code}</span>
                              <Divider type="vertical" className="border-gray-300 mx-1" />
                              <span>{s.studentClass}</span>
                            </Text>
                          </div>
                        </div>
                      );

                      return isFailed ? (
                        <Tooltip key={s.id} title={`Sinh viên rớt giữa kỳ. Lý do: ${(s.midtermFeedback || 'Không có ý kiến phản hồi.').replace(/\(Hệ thống cập nhật theo yêu cầu\)\.?/gi, '').trim() || 'Không có ý kiến phản hồi.'}`}>
                          {cardEl}
                        </Tooltip>
                      ) : cardEl;
                    })}
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
                    title: 'Kết quả', children: students.map((s, i) => {
                      const isFailed = s.midtermStatus === 'FAIL' || s.status === 'FAILED';
                      return {
                        title: (
                          <div className={`flex flex-col items-center py-1 ${isFailed ? 'opacity-50 line-through' : ''}`}>
                            <Text className="text-[10px] text-gray-400 font-normal mb-0.5 uppercase">Sinh viên {i + 1}</Text>
                            <Text strong className="text-blue-600 text-[13px] uppercase tracking-tight">
                              {getFirstName(s.name)}
                            </Text>
                            {isFailed && (
                              <Tooltip title={`Sinh viên rớt giữa kỳ. Lý do: ${(s.midtermFeedback || 'Không có ý kiến phản hồi.').replace(/\(Hệ thống cập nhật theo yêu cầu\)\.?/gi, '').trim() || 'Không có ý kiến phản hồi.'}`}>
                                <Tag color="error" className="m-0 text-[8px] scale-90">Rớt giữa kỳ</Tag>
                              </Tooltip>
                            )}
                          </div>
                        ),
                        key: `sv_${s.id}`, width: 140, align: 'center',
                        render: (_, r, rowIndex) => {
                          const hasHistory = gradeHistory?.some((h: any) => {
                            const hRole = h.rater_role || h.grade?.rater_role;
                            const currentRoleGroup = getRaterRole();
                            let isSameRoleGroup = false;
                            if (currentRoleGroup === 'SUPERVISOR') isSameRoleGroup = hRole === 'SUPERVISOR';
                            else if (currentRoleGroup === 'REVIEWER') {
                              if (currentAssignment?.reviewer_order) isSameRoleGroup = hRole === `REVIEWER_${currentAssignment.reviewer_order}`;
                              else isSameRoleGroup = hRole?.startsWith('REVIEWER');
                            } else if (currentRoleGroup === 'COMMITTEE') isSameRoleGroup = hRole?.startsWith('COMMITTEE') || hRole?.startsWith('COUNCIL');
                            return h.criterion_id === r.id && h.student_id === s.id && isSameRoleGroup;
                          });

                          const cellEl = (
                            <div className={`relative py-1 flex flex-col items-center ${isFailed ? 'opacity-50' : ''}`}>
                              <Form.Item name={['grades', s.id, r.id]} rules={isFailed ? [] : [{ required: true }]} className="mb-0 w-full">
                                <InputNumber
                                  id={`grade-input-${i}-${rowIndex}`}
                                  min={0}
                                  max={10}
                                  step={0.5}
                                  className="w-full text-center grade-input"
                                  disabled={isLocked || isFailed}
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
                              {hasHistory && (
                                <div className="absolute bottom-[-10px] left-0 right-0 flex justify-center pointer-events-none">
                                  <Tooltip title="Tiêu chí này đã từng được thay đổi điểm số. Click 'Lịch sử điểm' để xem chi tiết.">
                                    <div className="flex items-center gap-1 bg-white/80 px-1 rounded pointer-events-auto">
                                      <Badge status="warning" />
                                      <span className="text-[9px] text-amber-600 font-medium leading-none">Đã sửa</span>
                                    </div>
                                  </Tooltip>
                                </div>
                              )}
                            </div>
                          );

                          return isFailed ? (
                            <Tooltip title={`Sinh viên rớt giữa kỳ. Lý do: ${(s.midtermFeedback || 'Không có ý kiến phản hồi.').replace(/\(Hệ thống cập nhật theo yêu cầu\)\.?/gi, '').trim() || 'Không có ý kiến phản hồi.'}`}>
                              {cellEl}
                            </Tooltip>
                          ) : cellEl;
                        }
                      };
                    })
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
                      <Table.Summary.Cell index={0} colSpan={2} className="text-right">TỔNG ĐIỂM</Table.Summary.Cell>
                      {students.map(s => (
                        <Table.Summary.Cell key={`avg_${s.id}`} index={2} className="text-center">
                          <Text strong className="text-blue-600 text-lg">{(averages[s.id] || 0).toFixed(2)}</Text>
                        </Table.Summary.Cell>
                      ))}
                      <Table.Summary.Cell index={3} rowSpan={2} className="text-center align-middle bg-white border-l border-b border-r">
                        <div className="flex gap-2 justify-center items-center py-2 px-4 no-print">
                          {!isLocked && (
                            <>
                              <Button onClick={() => {
                                form.resetFields();
                                setIsRequestMode(false);
                              }} disabled={submitGradeMutation.isPending}>
                                Hủy
                              </Button>
                              <Button type="primary" icon={<SaveOutlined />} onClick={() => handleSubmit()} loading={submitGradeMutation.isPending}>
                                {isRequestMode ? 'Gửi yêu cầu' : (isConfirmed ? 'Lưu thay đổi' : 'Lưu điểm')}
                              </Button>
                            </>
                          )}

                          {isPastDeadline && isConfirmed && !isRequestMode && !isFinalized && (
                            <Button
                              type="primary"
                              ghost
                              icon={<LockOutlined />}
                              onClick={() => setIsRequestMode(true)}
                            >
                              Yêu cầu sửa điểm
                            </Button>
                          )}
                        </div>
                      </Table.Summary.Cell>
                    </Table.Summary.Row>
                    <Table.Summary.Row className="bg-white font-bold h-24">
                      <Table.Summary.Cell index={0} colSpan={2} className="text-right">XẾP LOẠI</Table.Summary.Cell>
                      {students.map(s => {
                        const pass = (averages[s.id] || 0) >= 6.0;
                        return (
                          <Table.Summary.Cell key={`res_${s.id}`} index={2} className="text-center">
                            <div className="flex flex-col items-center gap-1">
                              <Checkbox checked={pass} disabled className="pass-checkbox pointer-events-none">Đạt</Checkbox>
                              <Checkbox checked={!pass} disabled className="fail-checkbox pointer-events-none">Không đạt</Checkbox>
                            </div>
                          </Table.Summary.Cell>
                        );
                      })}
                    </Table.Summary.Row>
                  </>
                )}
              />
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
        const topicObj = r.topic || r;
        const groupName = topicObj.registrations?.[0]?.group?.name || topicObj.code || t;
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
      render: (t: string, r: any) => {
        const topicObj = r.topic || r;
        return (
          <div>
            <div className="font-medium text-sm leading-tight mb-1">
              <HighlightText text={topicObj.title || t} keyword={debouncedLecturerSearch} />
            </div>
            <Space size={4} className="text-[10px] text-gray-400">
              <Text type="secondary" className="text-[10px]">GVHD: <HighlightText text={topicObj.supervisor?.full_name} keyword={debouncedLecturerSearch} /></Text>
              <Divider type="vertical" className="m-0 border-gray-300" />
              <Text type="warning" className="text-[10px]">Hạn nộp báo cáo: {dayjs(topicObj.semester?.thesis_deadline).format('DD/MM/YYYY')}</Text>
            </Space>
          </div>
        )
      }
    },
    {
      title: 'Sinh viên', key: 'students', width: 220, render: (_: any, r: any) => {
        const topicObj = r.topic || r;

        // 1. Ưu tiên lấy từ property "students" (TopicService trả về cấu trúc này)
        if (r.students && Array.isArray(r.students)) {
          return (
            <div className="flex flex-col gap-1 py-1">
              {r.students.map((s: any) => {
                const isFailed = s.midtermStatus === 'FAIL' || s.registrationStatus === 'FAILED';
                const el = (
                  <div key={s.id} className={`flex flex-col mb-1 last:mb-0 group/sv ${isFailed ? 'opacity-50' : ''}`}>
                    <Text className={`text-[12px] font-medium leading-tight group-hover/sv:text-blue-600 transition-colors ${isFailed ? 'text-gray-400 line-through font-normal' : ''}`}>
                      <HighlightText text={s.full_name} keyword={debouncedLecturerSearch} />
                    </Text>
                    <Text className="text-[10px] text-gray-400 mt-0.5">
                      {s.student_code || s.username}
                    </Text>
                  </div>
                );
                return isFailed ? (
                  <Tooltip key={s.id} title={`Sinh viên rớt giữa kỳ. Lý do: ${(s.midtermFeedback || 'Không có ý kiến phản hồi.').replace(/\(Hệ thống cập nhật theo yêu cầu\)\.?/gi, '').trim() || 'Không có ý kiến phản hồi.'}`}>
                    {el}
                  </Tooltip>
                ) : el;
              })}
            </div>
          );
        }

        // 2. Dự phòng lấy từ registrations (AssignmentService/Prisma include)
        const registrations = topicObj.registrations || [];
        const firstReg = registrations[0];

        // Trường hợp nhóm
        const members = firstReg?.group?.members || [];
        if (members.length > 0) {
          return (
            <div className="flex flex-col gap-1 py-1">
              {members.map((mi: any) => {
                const reg = registrations.find((reg: any) => (reg.student_id || reg.studentId) === mi.user?.id);
                const isFailed = reg?.midterm_status === 'FAIL' || reg?.status === 'FAILED';
                const feedback = reg?.midterm_feedback || reg?.midtermFeedback || '';
                const el = (
                  <div key={mi.user?.id} className={`flex flex-col mb-1 last:mb-0 group/sv ${isFailed ? 'opacity-50' : ''}`}>
                    <Text className={`text-[12px] font-medium leading-tight group-hover/sv:text-blue-600 transition-colors ${isFailed ? 'text-gray-400 line-through font-normal' : ''}`}>
                      <HighlightText text={mi.user?.full_name} keyword={debouncedLecturerSearch} />
                    </Text>
                    <Text className="text-[10px] text-gray-400 mt-0.5">
                      {mi.user?.student_code || mi.user?.username}
                    </Text>
                  </div>
                );
                return isFailed ? (
                  <Tooltip key={mi.user?.id} title={`Sinh viên rớt giữa kỳ. Lý do: ${feedback || 'Không có ý kiến phản hồi.'}`}>
                    {el}
                  </Tooltip>
                ) : el;
              })}
            </div>
          );
        }

        // Trường hợp cá nhân
        const student = firstReg?.student;
        if (student) {
          const reg = registrations.find((reg: any) => (reg.student_id || reg.studentId) === student.id);
          const isFailed = reg?.midterm_status === 'FAIL' || reg?.status === 'FAILED';
          const feedback = reg?.midterm_feedback || reg?.midtermFeedback || '';
          const el = (
            <div className={`flex flex-col py-1 ${isFailed ? 'opacity-50' : ''}`}>
              <Text className={`text-[12px] font-medium leading-tight ${isFailed ? 'text-gray-400 line-through font-normal' : ''}`}>
                <HighlightText text={student.full_name} keyword={debouncedLecturerSearch} />
              </Text>
              <Text className="text-[10px] text-gray-400 mt-0.5">
                {student.student_code || student.username}
              </Text>
            </div>
          );
          return isFailed ? (
            <Tooltip title={`Sinh viên rớt giữa kỳ. Lý do: ${feedback || 'Không có ý kiến phản hồi.'}`}>
              {el}
            </Tooltip>
          ) : el;
        }

        return <span className="text-gray-300 italic text-[10px]">Chưa có sinh viên</span>;
      }
    },

    {
      title: 'Trạng thái',
      key: 'status_combined',
      width: 140,
      render: (_: any, r: any) => {
        const checkIsFailed = () => {
          if (r.students && Array.isArray(r.students) && r.students.length > 0) {
            return r.students.every((s: any) => s.midtermStatus === 'FAIL' || s.registrationStatus === 'FAILED');
          }
          const topicObj = r.topic || r;
          const regs = topicObj.registrations || [];
          if (regs.length > 0) {
            return regs.every((reg: any) => reg.midterm_status === 'FAIL' || reg.status === 'FAILED');
          }
          return false;
        };

        if (checkIsFailed()) {
          return <Tag color="error" className="m-0 rounded-full px-3">Đã rớt</Tag>;
        }

        if (r.status === 'FINALIZED') {
          return <Tag color="error" icon={<LockOutlined />} className="m-0 rounded-full px-3">Đã chốt (Locked)</Tag>;
        }

        // [UI IMPROVEMENT] Status should reflect CURRENT user's grading progress in lecturer tabs
        const hasMyGrades = r.grades?.filter((g: any) => {
          const graderMatches = (g.grader_id === user?.id || g.graderId === user?.id);
          if (!graderMatches) return false;
          const role = g.rater_role || g.raterRole || '';
          if (activeTab === 'reviewer') return role.startsWith('REVIEWER');
          if (activeTab === 'council') return role.startsWith('COMMITTEE');
          return role === 'SUPERVISOR';
        }).length > 0;

        if (hasMyGrades) {
          return <Tag color="processing" className="m-0 rounded-full px-3">Đã chấm</Tag>;
        }

        return <Tag color="default" className="m-0 rounded-full px-3">Chờ chấm</Tag>;
      }
    },
    {
      title: 'Hành động',
      key: 'action',
      width: 180,
      render: (_: any, r: any) => {
        const currentPhase = activeSemester?.calculated_phase;
        const isAtDefensePhaseOrLater = currentPhase === 'DEFENSE' || currentPhase === 'FINAL';
        const supervisorGraded = r.gradingStatus?.supervisorGraded;
        const supervisorScore = r.students?.[0]?.finalScore?.supervisor_score;
        const reviewerScore = r.students?.[0]?.finalScore?.reviewer_avg_score;
        const hasMyGrades = r.grades?.some((g: any) => {
          const graderMatches = (g.grader_id === user?.id || g.graderId === user?.id);
          if (!graderMatches) return false;
          const role = g.rater_role || g.raterRole || '';
          if (activeTab === 'reviewer') return role.startsWith('REVIEWER');
          if (activeTab === 'council') return role.startsWith('COMMITTEE');
          return role === 'SUPERVISOR';
        });

        const checkIsFailed = () => {
          if (r.students && Array.isArray(r.students) && r.students.length > 0) {
            return r.students.every((s: any) => s.midtermStatus === 'FAIL' || s.registrationStatus === 'FAILED');
          }
          const topicObj = r.topic || r;
          const regs = topicObj.registrations || [];
          if (regs.length > 0) {
            return regs.every((reg: any) => reg.midterm_status === 'FAIL' || reg.status === 'FAILED');
          }
          return false;
        };
        const isFailed = checkIsFailed();

        return (
          <Space>
            <Button
              type={r.status === 'FINALIZED' || hasMyGrades || isFailed ? "default" : "primary"}
              size="small"
              onClick={() => setSearchParams({
                topicId: r.topicId || r.topic_id || r.id,
                groupId: r.topicId ? r.id : (r.groupId || r.group_id || r.group?.id || r.registrations?.[0]?.group_id),
                type: activeTab
              })}
              className="text-xs rounded-lg"
            >
              {isFailed ? 'Xem' : (r.status === 'FINALIZED' ? 'Xem chi tiết' : 'Xem & Chấm điểm')}
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
              {regs.slice(0, 2).map((reg: any) => {
                const isFailed = reg.midterm_status === 'FAIL' || reg.status === 'FAILED';
                const el = (
                  <div key={reg.student?.id} className={`flex flex-col ${isFailed ? 'opacity-50' : ''}`}>
                    <Text className={`text-[12px] font-medium leading-none ${isFailed ? 'text-gray-400 line-through font-normal' : ''}`}>
                      <HighlightText text={reg.student?.full_name} keyword={debouncedDeptSearch} />
                    </Text>
                    <Text className="text-[10px] text-gray-400 mt-0.5">
                      <HighlightText text={reg.student?.student_code} keyword={debouncedDeptSearch} />
                    </Text>
                  </div>
                );
                return isFailed ? (
                  <Tooltip key={reg.student?.id} title={`Sinh viên rớt giữa kỳ. Lý do: ${reg.midterm_feedback || 'Không có ý kiến phản hồi.'}`}>
                    {el}
                  </Tooltip>
                ) : el;
              })}
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
        render: (_: any, r: any) => {
          const regs = r.registrations || [];
          const isTopicFailed = regs.length > 0 && regs.every((reg: any) => reg.midterm_status === 'FAIL' || reg.status === 'FAILED');

          if (isTopicFailed) {
            return (
              <Tag color="error" className="m-0 rounded-full px-3 font-semibold border-none bg-red-50 text-red-600">
                Đã rớt
              </Tag>
            );
          }

          return (
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
                  Hội đồng: {r.gradingStatus?.committeeGradedCount ?? 0}/{r.gradingStatus?.totalCommitteeRequired ?? 3}
                </Text>
              </div>
            </div>
          );
        }
      },
      {
        title: 'Trạng thái xét',
        key: 'review_status',
        width: 140,
        render: (_: any, r: any) => {
          const regs = r.registrations || [];
          const isTopicFailed = regs.length > 0 && regs.every((reg: any) => reg.midterm_status === 'FAIL' || reg.status === 'FAILED');

          if (isTopicFailed) {
            return (
              <Tag color="error" className="m-0 rounded-full px-2 border-none bg-red-50 text-red-600">
                Không xét
              </Tag>
            );
          }

          const currentPhase = activeSemester?.calculated_phase;

          // 1. Nếu đã có quyết định chính thức từ HOD (Chỉ hiển thị từ phase DEFENSE)
          const isAtDefensePhaseOrLater = currentPhase === 'DEFENSE' || currentPhase === 'FINAL';

          if (isAtDefensePhaseOrLater && r.is_eligible_for_defense !== null && r.is_eligible_for_defense !== undefined) {
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

          // Kiểm tra thiếu điểm GVHD ngay khi bước vào giai đoạn Bảo vệ
          if (isAtDefensePhaseOrLater && !r.gradingStatus?.supervisorGraded) {
            return renderFailedTag("Loại (Thiếu điểm GVHD)", "Giảng viên hướng dẫn chưa nhập điểm cho đề tài khi đã đến hạn Bảo vệ.");
          }

          // 3. Trạng thái sẵn sàng xét
          if (r.gradingStatus?.isReadyForDecision) {
            return <Tag color="success" className="text-[11px] rounded-full px-2 border-none bg-green-50 text-green-600">Đã chấm</Tag>;
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
                  ...(user?.role === 'HEAD' || user?.role === 'COORDINATOR' ? [{
                    key: 'department',
                    label: 'Quản lý Bộ môn',
                    children: <div className="pt-6 pb-6 pr-6 pl-0 bg-white">{renderDepartmentTab()}</div>
                  }] : []),
                  {
                    key: 'advisor',
                    label: 'Hướng dẫn',
                    children: (
                      <div className="pt-6 pb-6 pr-6 pl-0 space-y-4 bg-white">
                        <Table
                          dataSource={filterLecturerData(advisorTopics?.topics || [])}
                          columns={dashboardColumns}
                          rowKey="id"
                          loading={isLoadingAdvisor}
                          className="sys-table"
                          locale={{
                            emptyText: (
                              <div className="py-8 text-center text-gray-400">
                                <InfoCircleOutlined className="text-xl mb-2" />
                                <p>Bạn không có đề tài hướng dẫn nào trong học kỳ này.</p>
                              </div>
                            )
                          }}
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
                          locale={{
                            emptyText: (
                              <div className="py-8 text-center text-gray-400">
                                <InfoCircleOutlined className="text-xl mb-2" />
                                <p>Bạn không được phân công phản biện đề tài nào trong học kỳ này.</p>
                              </div>
                            )
                          }}
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
                          locale={{
                            emptyText: (
                              <div className="py-8 text-center text-gray-400">
                                <InfoCircleOutlined className="text-xl mb-2" />
                                <p>Bạn không được phân công hội đồng đề tài nào trong học kỳ này.</p>
                              </div>
                            )
                          }}
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
        title={
          <Space>
            {isRequestMode ? <FlagOutlined className="text-blue-500" /> : <WarningOutlined className="text-amber-500" />}
            {isRequestMode ? 'Xác nhận gửi yêu cầu sửa điểm' : 'Xác nhận thay đổi điểm số'}
          </Space>
        }
        open={reasonModalVisible}
        onOk={handleReasonSubmit}
        onCancel={() => {
          setReasonModalVisible(false);
          setSubmitReason('');
        }}
        okText={isRequestMode ? "Gửi yêu cầu" : "Xác nhận lưu"}
        cancelText="Hủy"
        confirmLoading={submitGradeMutation.isPending}
      >
        <div className="mb-4">
          <Text>
            {isRequestMode
              ? 'Bạn đang thực hiện gửi yêu cầu điều chỉnh điểm số sau khi hết hạn. Vui lòng nhập lý do giải trình để Trưởng bộ môn phê duyệt.'
              : 'Bạn đang thực hiện thay đổi điểm số đã lưu trước đó. Vui lòng nhập lý do điều chỉnh để hệ thống ghi lại nhật ký chuyên môn.'}
          </Text>
        </div>
        <TextArea
          rows={4}
          placeholder="Ví dụ: Nhập nhầm điểm, phúc khảo, giảng viên chấm lại..."
          value={submitReason}
          onChange={(e) => setSubmitReason(e.target.value)}
        />
      </Modal>

      <Modal
        title={
          <div className="flex items-center gap-2 pb-2 border-b border-gray-100">
            <div className="p-2 bg-blue-50 rounded-lg">
              <FlagOutlined className="text-blue-600 text-lg" />
            </div>
            <div>
              <Title level={4} className="mb-0">Lịch sử biến động điểm</Title>
              <Text type="secondary" className="text-[11px]">Chi tiết các lần điều chỉnh điểm số sau khi phê duyệt</Text>
            </div>
          </div>
        }
        open={historyModalVisible}
        onCancel={() => {
          setHistoryModalVisible(false);
          setSelectedTopicForHistory(null);
        }}
        footer={[
          <Button key="close" type="primary" className="rounded-lg px-6" onClick={() => {
            setHistoryModalVisible(false);
            setSelectedTopicForHistory(null);
          }}>Đóng</Button>
        ]}
        width={900}
        centered
        className="history-modal"
      >
        <Table
          dataSource={gradeHistory}
          rowKey="id"
          size="small"
          pagination={{ pageSize: 8, showSizeChanger: false, className: "mt-4" }}
          className="compact-history-table mt-4"
          expandable={{
            expandedRowRender: (record: GradeHistory) => (
              <div className="bg-gray-50/50 p-4 rounded-lg border border-dashed border-gray-200 ml-8 mr-4 mb-2">
                <Row gutter={[24, 16]}>
                  <Col span={12}>
                    <div className="flex flex-col gap-1">
                      <Text className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">Tiêu chí chấm điểm</Text>
                      <Text className="text-gray-700 font-medium">{record.criterion?.name}</Text>
                    </div>
                  </Col>
                  <Col span={6}>
                    <div className="flex flex-col gap-1">
                      <Text className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">Vai trò chấm</Text>
                      <div>
                        {(() => {
                          const role = record.rater_role;
                          if (role === 'SUPERVISOR') return <Tag color="blue" className="m-0 text-[11px]">Hướng dẫn</Tag>;
                          if (role?.startsWith('REVIEWER')) return <Tag color="cyan" className="m-0 text-[11px]">Phản biện {role.split('_')[1] || ''}</Tag>;
                          if (role?.startsWith('COMMITTEE')) return <Tag color="purple" className="m-0 text-[11px]">Hội đồng</Tag>;
                          return <Tag className="m-0 text-[11px]">{role}</Tag>;
                        })()}
                      </div>
                    </div>
                  </Col>
                  <Col span={6}>
                    <div className="flex flex-col gap-1">
                      <Text className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">Người thực hiện</Text>
                      <Tag className="m-0 w-fit text-[11px] border-blue-100 bg-blue-50 text-blue-600 font-medium" icon={<UserOutlined />}>
                        {record.grader?.full_name}
                      </Tag>
                    </div>
                  </Col>
                </Row>
              </div>
            ),
            expandRowByClick: true,
          }}
          columns={[
            {
              title: 'Thời gian',
              dataIndex: 'changed_at',
              key: 'time',
              width: 120,
              render: (t) => (
                <div className="flex flex-col">
                  <Text className="text-[13px] font-medium">{dayjs(t).format('HH:mm')}</Text>
                  <Text className="text-[11px] text-gray-400">{dayjs(t).format('DD/MM/YYYY')}</Text>
                </div>
              )
            },
            {
              title: 'Sinh viên',
              key: 'student',
              width: 180,
              render: (_, r: GradeHistory) => (
                <Text strong className="text-gray-700">{r.student?.full_name}</Text>
              )
            },
            {
              title: 'Biến động',
              key: 'change',
              align: 'center',
              width: 120,
              render: (_, r: GradeHistory) => (
                <div className="flex items-center justify-center gap-2">
                  <span className="text-gray-400 text-xs line-through">{r.old_score}</span>
                  <SwapOutlined className="text-blue-400 text-[10px]" />
                  <span className="text-blue-600 font-bold text-base">{r.new_score}</span>
                </div>
              )
            },
            {
              title: 'Lý do giải trình',
              dataIndex: 'reason',
              key: 'reason',
              render: (reason) => (
                <div className="max-w-[300px]">
                  <Paragraph className="mb-0 text-gray-600 italic text-[12px]" ellipsis={{ rows: 2, tooltip: reason }}>
                    {reason?.replace('[Phê duyệt bởi HOD] ', '') || 'Không có lý do chi tiết'}
                  </Paragraph>
                </div>
              )
            },
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
