import { useState, useMemo, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Card, Form, InputNumber, Button, Alert, Table, Tag, Row, Col, Typography, Avatar, Result, Tabs, Divider, Skeleton, Input, Checkbox, Tooltip } from 'antd';
import { ArrowLeftOutlined, CheckCircleOutlined, SaveOutlined } from '@ant-design/icons';
import { useAuthStore } from '@/store/auth';
import { useGradingCriteria, useSubmitGrade } from '@/hooks/useGrading';
import { TopicsApi } from '@/api/topics';
import { GradingApi } from '@/api/grading';
import { RaterRole, GradeScore } from '@/types';
import { useQuery } from '@tanstack/react-query';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { TextArea } = Input;

/**
 * Final Evaluation Form - Multi-Student Side-by-Side Grading
 * Cấu trúc chuẩn: STT | LO | Kết quả (SV1 | SV2 | SV3) | Ghi Chú
 */
const FinalEvaluation = () => {
    const { user } = useAuthStore();
    const [form] = Form.useForm();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();

    const topicId = searchParams.get('topicId');
    const [activeRole, setActiveRole] = useState<'SUPERVISOR' | 'REVIEWER' | 'COMMITTEE'>('SUPERVISOR');

    // Fetch topic details and permissions from Grading API
    const { data: gradingContext, isLoading: isLoadingGrading } = useQuery({
        queryKey: ['grading-context', topicId],
        queryFn: () => GradingApi.getTopicGrades(topicId!),
        enabled: !!topicId,
    });

    const selectedTopic = (gradingContext as any)?.topic || gradingContext?.finalScores?.[0]?.topic || (gradingContext as any)?.permissions?.topic;
    
    // permissions object from backend
    const permissions = gradingContext?.permissions;

    const getPermissionForActiveRole = () => {
        if (!permissions) return { allowed: true, code: 'LOADING' };
        if (activeRole === 'SUPERVISOR') return { allowed: permissions.grade_supervisor, code: permissions.grade_supervisor_code, reason: permissions.grade_supervisor_reason };
        if (activeRole === 'REVIEWER') return { allowed: permissions.grade_reviewer, code: permissions.grade_reviewer_code, reason: permissions.grade_reviewer_reason };
        if (activeRole === 'COMMITTEE') return { allowed: permissions.grade_committee, code: permissions.grade_committee_code, reason: permissions.grade_committee_reason };
        return { allowed: false, code: 'UNKNOWN' };
    };

    const { allowed: isPhaseAllowed, reason: phaseError } = getPermissionForActiveRole();

    // Fetch FINAL criteria (10 LOs)
    const { data: criteriaData, isLoading: isLoadingCriteria } = useGradingCriteria({ 
        criteriaType: 'FINAL' as any,
        topicId: topicId || undefined
    });

    // Extract criteria for the current role or fallback
    const criteria = useMemo(() => {
        if (!criteriaData) return [];
        if (Array.isArray(criteriaData)) return criteriaData;
        
        const data = criteriaData as any;
        // In the fixed version, we only expect 'FINAL' criteria
        return data.FINAL || data.SUPERVISOR || Object.values(data)[0] || [];
    }, [criteriaData]);

    const submitGradeMutation = useSubmitGrade();

    // Get students from topic registrations
    const students = useMemo(() => {
        if (!selectedTopic?.registrations) return [];
        const allStudents: any[] = [];
        selectedTopic.registrations.forEach((reg: any) => {
            if (reg.group?.members) {
                reg.group.members.forEach((m: any) => {
                    if (m.status === 'ACCEPTED' && m.user) {
                        allStudents.push({
                            id: m.user.id,
                            name: m.user.full_name,
                            code: m.user.student_code || 'N/A',
                            avatar: m.user.avatar_url,
                        });
                    }
                });
            } else if (reg.student) {
                allStudents.push({
                    id: reg.student.id,
                    name: reg.student.full_name,
                    code: reg.student.student_code || 'N/A',
                    avatar: reg.student.avatar_url,
                });
            }
        });
        return allStudents;
    }, [selectedTopic]);

    const [averages, setAverages] = useState<Record<string, number>>({});

    const calculateAverages = () => {
        const values = form.getFieldsValue();
        const newAverages: Record<string, number> = {};

        students.forEach(student => {
            let total = 0;
            let count = 0;
            criteria.forEach(criterion => {
                const score = values.grades?.[student.id]?.[criterion.id];
                if (score !== undefined && score !== null) {
                    total += score;
                    count++;
                }
            });
            newAverages[student.id] = count > 0 ? total / count : 0;
        });

        setAverages(newAverages);
    };

    useEffect(() => {
        if (criteria.length > 0 && students.length > 0) {
            calculateAverages();
        }
    }, [criteria, students]);
    
    const getRaterRole = (): RaterRole => {
        return activeRole as RaterRole;
    };

    const handleSubmit = async () => {
        try {
            const values = await form.validateFields();
            
            const submissions = students.map(student => {
                const gradeScores: GradeScore[] = criteria.map(criterion => ({
                    criterion_id: criterion.id,
                    score: values.grades[student.id][criterion.id],
                    comment: values.notes?.[criterion.id] || undefined,
                }));

                return {
                    topic_id: topicId!,
                    student_id: student.id,
                    rater_role: getRaterRole(),
                    reviewer_order: activeRole === 'REVIEWER' ? (permissions?.reviewer_order || 1) : undefined,
                    committee_role: activeRole === 'COMMITTEE' ? (permissions?.committee_role || 'MEMBER') : undefined,
                    scores: gradeScores,
                };
            });

            await Promise.all(submissions.map(sub => submitGradeMutation.mutateAsync(sub)));
        } catch (error) {
            console.error('Submission failed:', error);
        }
    };

    const isLocked = !isPhaseAllowed;

    if (isLoadingGrading) {
        return (
            <div className="p-6 space-y-6 bg-gray-50 min-h-screen">
                <Skeleton active paragraph={{ rows: 10 }} />
            </div>
        );
    }

    if (!topicId) {
        return (
            <Result
                status="info"
                title="Chọn đề tài để đánh giá"
                subTitle="Vui lòng chọn một đề tài để bắt đầu đánh giá cuối kỳ."
                extra={<Button type="primary" onClick={() => navigate('/evaluation')}>Danh sách đề tài</Button>}
            />
        );
    }

    const gradingColumns = [
        {
            title: 'STT',
            key: 'index',
            width: 60,
            align: 'center' as const,
            render: (_: any, __: any, index: number) => (index + 1).toString().padStart(2, '0'),
        },
        {
            title: 'LO',
            dataIndex: 'name',
            key: 'name',
            width: 350,
            render: (text: string) => <Text className="whitespace-pre-wrap font-medium">{text}</Text>,
        },
        {
            title: 'Kết quả',
            children: students.map((student, sIdx) => ({
                title: `Sinh viên ${sIdx + 1}`,
                key: `student_${student.id}`,
                width: 130,
                align: 'center' as const,
                render: (_: any, record: any) => (
                    <Form.Item
                        name={['grades', student.id, record.id]}
                        rules={[{ required: true, message: 'Nhập điểm' }]}
                        className="mb-0"
                    >
                        <InputNumber min={0} max={10} step={0.5} className="w-full text-center" disabled={isLocked} />
                    </Form.Item>
                ),
            })),
        },
        {
            title: 'Ghi Chú',
            key: 'comment',
            width: 200,
            render: (_: any, record: any) => (
                <Form.Item name={['notes', record.id]} className="mb-0">
                    <TextArea autoSize={{ minRows: 1 }} className="border-none bg-transparent hover:bg-white" disabled={isLocked} />
                </Form.Item>
            ),
        },
    ];

    return (
        <div className="page-container">
            <div className="page-inner">
                <div className="flex items-center justify-between mb-2">
                    <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/evaluation')}>
                        Quay lại
                    </Button>
                    <Text type="secondary">Ngày: {dayjs().format('DD/MM/YYYY')}</Text>
                </div>

                {/* Header Card as the main title section */}
                <Card className="page-header-card mb-6">
                    <div className="text-center w-full">
                        <Title level={3} className="mb-1 uppercase tracking-wide">PHIẾU ĐÁNH GIÁ KHÓA LUẬN TỐT NGHIỆP</Title>
                        <Text type="secondary" className="italic">(Dành cho {activeRole === 'SUPERVISOR' ? 'GVHD' : activeRole === 'REVIEWER' ? 'GVPB' : 'Hội đồng'})</Text>
                    </div>
                </Card>

                <Card className="shadow-lg border-t-4 border-t-blue-600 rounded-2xl">
                    <div className="bg-blue-50 p-6 rounded-xl mb-6 border border-blue-100">
                    <Row gutter={32}>
                        <Col span={14}>
                            <Text type="secondary" className="block text-xs uppercase mb-1 font-bold opacity-70">Tên đề tài</Text>
                            <Text strong className="text-xl leading-relaxed text-blue-900">{selectedTopic?.title}</Text>
                        </Col>
                        <Col span={10} className="border-l border-blue-200">
                            <Text type="secondary" className="block text-xs uppercase mb-2 font-bold opacity-70">Danh sách sinh viên</Text>
                            <div className="space-y-2">
                                {students.map((s, i) => (
                                    <div key={s.id} className="flex items-center gap-2">
                                        <Tag color="blue">{i + 1}</Tag>
                                        <Text strong>{s.name}</Text>
                                        <Text type="secondary">({s.code})</Text>
                                    </div>
                                ))}
                            </div>
                        </Col>
                    </Row>
                </div>

                <Tabs
                    activeKey={activeRole}
                    onChange={(key) => setActiveRole(key as any)}
                    className="mb-8"
                    items={[
                        { key: 'SUPERVISOR', label: 'GV Hướng dẫn' },
                        { key: 'REVIEWER', label: 'GV Phản biện' },
                        { key: 'COMMITTEE', label: 'Hội đồng' },
                    ]}
                />

                {!isPhaseAllowed && phaseError && (
                    <Alert
                        message="Thông báo về quyền chấm điểm"
                        description={phaseError}
                        type="info"
                        showIcon
                        className="mb-8 border-l-4 border-l-blue-500 shadow-sm"
                    />
                )}

                {isLoadingCriteria ? (
                    <Skeleton active paragraph={{ rows: 12 }} />
                ) : criteria.length > 0 ? (
                    <Form form={form} onValuesChange={calculateAverages}>
                        <Table
                            dataSource={criteria}
                            columns={gradingColumns}
                            pagination={false}
                            rowKey="id"
                            bordered
                            size="middle"
                            className="sys-table bg-white"
                            summary={() => (
                                <>
                                    <Table.Summary.Row className="bg-gray-100 font-bold">
                                        <Table.Summary.Cell index={0} colSpan={2} className="text-right">
                                            TRUNG BÌNH
                                        </Table.Summary.Cell>
                                        {students.map(student => (
                                            <Table.Summary.Cell key={`avg_${student.id}`} index={2} className="text-center">
                                                <Text strong className="text-blue-600 text-lg">
                                                    {(averages[student.id] || 0).toFixed(2)}
                                                </Text>
                                            </Table.Summary.Cell>
                                        ))}
                                        <Table.Summary.Cell index={3} />
                                    </Table.Summary.Row>

                                    <Table.Summary.Row className="bg-white font-bold h-24">
                                        <Table.Summary.Cell index={0} colSpan={2} className="text-right">
                                            KẾT QUẢ
                                        </Table.Summary.Cell>
                                        {students.map(student => {
                                            const isPass = (averages[student.id] || 0) >= 5.0;
                                            return (
                                                <Table.Summary.Cell key={`res_${student.id}`} index={2} className="text-center">
                                                    <div className="flex flex-col items-center gap-3 px-4">
                                                        <Checkbox checked={isPass} disabled className="pass-checkbox pointer-events-none">
                                                            <Text strong={isPass} type={isPass ? 'success' : undefined}>Đạt</Text>
                                                        </Checkbox>
                                                        <Checkbox checked={!isPass} disabled className="fail-checkbox pointer-events-none">
                                                            <Text strong={!isPass} type={!isPass ? 'danger' : undefined}>Không đạt</Text>
                                                        </Checkbox>
                                                    </div>
                                                </Table.Summary.Cell>
                                            );
                                        })}
                                        <Table.Summary.Cell index={3} />
                                    </Table.Summary.Row>
                                </>
                            )}
                        />

                        <div className="flex justify-end gap-3 mt-10 no-print pb-4">
                            <Button size="large" icon={<SaveOutlined />} onClick={() => form.resetFields()} disabled={isLocked}>
                                Nhập lại từ đầu
                            </Button>
                            <Tooltip title={isLocked ? phaseError : ''}>
                                <Button
                                    size="large"
                                    type="primary"
                                    icon={<CheckCircleOutlined />}
                                    onClick={handleSubmit}
                                    loading={submitGradeMutation.isPending}
                                    disabled={isLocked}
                                >
                                    Lưu và Gửi Phiếu Đánh Giá Nhóm
                                </Button>
                            </Tooltip>
                        </div>
                    </Form>
                ) : (
                    <Alert message="Không tìm thấy tiêu chí đánh giá. Vui lòng liên hệ bộ môn để thiết lập 10 tiêu chí LO." type="warning" showIcon />
                )}
            </Card>

            <style dangerouslySetInnerHTML={{ __html: `
                .grading-table .ant-table-thead > tr > th {
                    background: #f0f7ff !important;
                    font-weight: bold;
                    text-align: center;
                }
                .pass-checkbox .ant-checkbox-checked .ant-checkbox-inner {
                    background-color: #52c41a;
                    border-color: #52c41a;
                }
                .fail-checkbox .ant-checkbox-checked .ant-checkbox-inner {
                    background-color: #ff4d4f;
                    border-color: #ff4d4f;
                }
                .grading-table .ant-table-summary {
                    box-shadow: 0 -2px 8px rgba(0,0,0,0.05);
                }
                @media print {
                    .no-print { display: none !important; }
                    .ant-card { border: none !important; box-shadow: none !important; }
                    body { background: white; }
                }
            ` }} />
            </div>
        </div>
    );
};

export default FinalEvaluation;
