import { useState, useEffect, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Card, Form, InputNumber, Button, Spin, Alert, Input, Tabs, Table, Tag, Space, Divider, Row, Col, Typography, Avatar, Checkbox } from 'antd';
import { notify } from '@/utils/notification';
import { SaveOutlined, ArrowLeftOutlined, UserOutlined, CheckCircleOutlined } from '@ant-design/icons';
import { useAuthStore } from '@/store/auth';
import { useGradingCriteria, useSubmitGrade } from '@/hooks/useGrading';
import { TopicsApi } from '@/api/topics';
import { AssignmentsApi } from '@/api/assignments';
import { GradingApi } from '@/api/grading';
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
  const [activeTab, setActiveTab] = useState<string>(searchParams.get('type') || 'advisor');

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
    if (activeTab === 'reviewer' && currentAssignment) {
        const order = currentAssignment.reviewer_order || 1;
        return (order === 1 ? 'REVIEWER_1' : order === 2 ? 'REVIEWER_2' : 'REVIEWER_3') as any;
    }
    if (activeTab === 'council' && currentAssignment) {
        const role = currentAssignment.committee_role;
        return (role === 'CHAIR' ? 'COMMITTEE_CHAIR' : role === 'SECRETARY' ? 'COMMITTEE_SECRETARY' : 'COMMITTEE_MEMBER') as any;
    }
    return 'SUPERVISOR';
  };

  const { data: myGradesData, isLoading: isLoadingMyGrades } = useQuery({
    queryKey: ['my-grades', topicId, getRaterRole()],
    queryFn: () => GradingApi.getMyGrades(topicId!, getRaterRole()),
    enabled: !!topicId,
  });

  const { data: criteriaData, isLoading: isLoadingCriteria } = useGradingCriteria({ 
    criteriaType: 'FINAL' as any,
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
    let color = 'default';
    switch (status) {
      case 'APPROVED': color = 'green'; break;
      case 'UNDER_REVIEW': color = 'orange'; break;
      case 'WAITING_FOR_DEFENSE': color = 'purple'; break;
      case 'COMPLETED': color = 'success'; break;
    }
    return <Tag color={color}>{status}</Tag>;
  };

  if (topicId) {
    if (isLoadingTopic || isLoadingCriteria || isLoadingMyGrades) {
      return <div className="p-12 text-center"><Spin size="large" tip="Đang tải dữ liệu..." /></div>;
    }

    const firstGradedStudent = myGradesData?.students?.[0];
    const gradedAt = firstGradedStudent?.gradedAt;

    return (
      <div className="p-6 space-y-6 bg-gray-50 min-h-screen">
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
                      <Text strong>{s.name} ({s.code})</Text>
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

  // Dashboard view
  const dashboardColumns = [
    { title: 'Mã ĐT', dataIndex: 'code', key: 'code', width: 100, render: (t: string) => <Tag>{t || 'N/A'}</Tag> },
    { title: 'Tên đề tài', dataIndex: 'title', key: 'title', render: (t: string, r: any) => (
        <div><div className="font-medium text-base">{t}</div><div className="text-xs text-gray-500">GVHD: {r.supervisor?.full_name}</div></div>
    )},
    { title: 'Sinh viên', key: 'students', render: (_, r: any) => {
        const m = r.registrations?.[0]?.group?.members || [];
        return <Avatar.Group>{m.map((mi: any) => <Avatar key={mi.user.id} src={mi.user.avatar_url}>{mi.user.full_name?.[0]}</Avatar>)}</Avatar.Group>;
    }},
    { title: 'Trạng thái', dataIndex: 'status', key: 'status', render: (s: string) => renderTopicStatus(s) },
    { title: 'Hành động', key: 'action', render: (_, r: any) => (
      <Button type="primary" onClick={() => setSearchParams({ topicId: r.id })}>Xem & Chấm điểm</Button>
    )},
  ];

  return (
    <div className="p-6">
      <div className="mb-6"><h1 className="text-2xl font-bold">Đánh giá khóa luận</h1><p className="text-gray-500">Quản lý và chấm điểm các đề tài được phân công</p></div>
      <Card className="shadow-soft"><Tabs activeKey={activeTab} onChange={setActiveTab} type="card"
        items={[
          { key: 'advisor', label: 'Hướng dẫn', children: <Table dataSource={advisorTopics?.topics || []} columns={dashboardColumns} rowKey="id" loading={isLoadingAdvisor} /> },
          { key: 'reviewer', label: 'Phản biên', children: <Table dataSource={reviewerAssignments?.map((a: any) => a.topic) || []} columns={dashboardColumns} rowKey="id" loading={isLoadingReviewer} /> },
          { key: 'council', label: 'Hội đồng', children: <Table dataSource={councilAssignments?.map((a: any) => a.topic) || []} columns={dashboardColumns} rowKey="id" loading={isLoadingCouncil} /> },
        ]}
      /></Card>
    </div>
  );
};

export default Evaluation;
