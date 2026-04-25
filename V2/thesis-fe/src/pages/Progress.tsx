import { Card, Steps, Button, Table, Tag, Select, Spin, Alert, Modal, Space, Input, Form, DatePicker, Avatar, Divider } from 'antd';
import { notify } from '@/utils/notification';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CheckCircleOutlined, ClockCircleOutlined, SyncOutlined, EditOutlined, UserOutlined, SendOutlined, CloseCircleOutlined } from '@ant-design/icons';
import { useAuthStore } from '@/store/auth';
import { useRegistrations, useUpdateProgress, useRegistrationLogs } from '@/hooks/useRegistrations';
import { StudentProgressBadge } from '@/components/StatusBadge';
import type { StudentProgressStatus } from '@/types';
import dayjs from 'dayjs';


const { TextArea } = Input;

const getSteps = (t: any) => [
  {
    title: t('progress.steps.topicRegistration'),
    status: ['HAS_TOPIC'],
    description: t('progress.steps.topicRegistrationDesc'),
    deadline: '15/01/2025' // Mock deadline
  },
  {
    title: t('progress.steps.outline'),
    status: ['SUBMITTED_PROPOSAL', 'PROPOSAL_APPROVED'],
    description: t('progress.steps.outlineDesc'),
    deadline: '30/01/2025'
  },
  {
    title: t('progress.steps.execution'),
    status: ['SUBMITTED_THESIS'],
    description: t('progress.steps.executionDesc'),
    deadline: '15/05/2025'
  },
  {
    title: t('progress.steps.grading'),
    status: ['ADVISOR_GRADED', 'REVIEWER_GRADED', 'COUNCIL_GRADED'],
    description: t('progress.steps.gradingDesc'),
    deadline: '01/06/2025'
  },
  {
    title: t('progress.steps.completion'),
    status: ['COMPLETED'],
    description: t('progress.steps.completionDesc'),
    deadline: '15/06/2025'
  }
];

const getStepStatus = (currentStatus: StudentProgressStatus, stepStatus: string[]) => {
  if (stepStatus.includes(currentStatus)) return 'process';
  // Define order
  const order = [
    'NOT_REGISTERED',
    'HAS_TOPIC',
    'SUBMITTED_PROPOSAL',
    'PROPOSAL_APPROVED',
    'SUBMITTED_THESIS',
    'ADVISOR_GRADED',
    'REVIEWER_GRADED',
    'COUNCIL_GRADED',
    'COMPLETED'
  ];
  const currentIndex = order.indexOf(currentStatus);
  const stepIndex = order.indexOf(stepStatus[stepStatus.length - 1]);

  if (currentIndex > stepIndex) return 'finish';
  return 'wait';
};

const RegistrationDetail = ({ registration, isSupervisor }: { registration: any, isSupervisor: boolean }) => {
  const { t } = useTranslation();
  const [feedback, setFeedback] = useState('');
  const [gradingForm] = Form.useForm();
  const updateProgressMutation = useUpdateProgress();
  const { data: logs, isLoading: isLoadingLogs } = useRegistrationLogs(registration.id);

  const currentStatus = registration.studentProgressStatus as StudentProgressStatus;

  const handleApprove = (currentStatus: string) => {
    let nextStatus = '';
    switch (currentStatus) {
      case 'HAS_TOPIC': nextStatus = 'SUBMITTED_PROPOSAL'; break;
      case 'SUBMITTED_PROPOSAL': nextStatus = 'PROPOSAL_APPROVED'; break;
      case 'PROPOSAL_APPROVED': nextStatus = 'SUBMITTED_THESIS'; break;
      case 'SUBMITTED_THESIS': nextStatus = 'ADVISOR_GRADED'; break;
      case 'ADVISOR_GRADED': nextStatus = 'REVIEWER_GRADED'; break;
      // ... more logic
      default: return;
    }

    updateProgressMutation.mutate({
      id: registration.id,
      status: nextStatus,
      feedback: feedback
    }, {
      onSuccess: () => {
        setFeedback('');
        notify.success(t('progress.approveSuccess'));
      }
    });
  };

  const handleRequestChanges = () => {
    if (!feedback.trim()) {
      notify.error(t('progress.revisionRequiredError'));
      return;
    }
    updateProgressMutation.mutate({
      id: registration.id,
      status: currentStatus, // Keep status, just send feedback
      feedback: feedback
    }, {
      onSuccess: () => {
        setFeedback('');
        notify.success(t('progress.revisionSuccess'));
      }
    });
  };

  return (
    <Card title={registration.topic.title} className="shadow-soft mb-6">
      {/* Progress Bar with Deadlines */}
      <div className="mb-8">
        <Steps
          current={getSteps(t).findIndex(s => s.status.includes(currentStatus)) !== -1
            ? getSteps(t).findIndex(s => s.status.includes(currentStatus))
            : getSteps(t).findIndex(s => {
              const order = [
                'NOT_REGISTERED', 'HAS_TOPIC', 'SUBMITTED_PROPOSAL', 'PROPOSAL_APPROVED',
                'SUBMITTED_THESIS', 'ADVISOR_GRADED', 'REVIEWER_GRADED', 'COUNCIL_GRADED', 'COMPLETED'
              ];
              const currentIdx = order.indexOf(currentStatus);
              const stepIdx = order.indexOf(s.status[s.status.length - 1]);
              return currentIdx <= stepIdx;
            })
          }
          items={getSteps(t).map(step => ({
            title: step.title,
            description: (
              <div>
                <div>{step.description}</div>
                <div className="text-xs text-gray-500 mt-1">{t('progress.deadline')}: {step.deadline}</div>
              </div>
            ),
            status: getStepStatus(currentStatus, step.status)
          }))}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Detailed Info */}
        <Card size="small" title={t('progress.detailInfo')}>
          <p className="mb-2"><strong>{t('topics.topicTitle')}:</strong> {registration.topic.title}</p>
          <p className="mb-2"><strong>{t('topics.supervisor')}:</strong> {registration.topic.supervisor?.fullName}</p>
          <p className="mb-2"><strong>{t('progress.group')}:</strong> {registration.group.name}</p>

          <Divider orientation="left" plain>{t('progress.members')}</Divider>
          <div className="space-y-2">
            {registration.group.members?.map((member: any) => (
              <div key={member.id} className="flex items-center gap-2">
                <Avatar size="small" icon={<UserOutlined />} src={member.user?.avatarUrl} />
                <span>{member.user?.fullName} ({member.user?.studentCode})</span>
              </div>
            ))}
          </div>

          <div className="mt-4">
            <p><strong>{t('progress.currentStatus')}:</strong> <StudentProgressBadge status={currentStatus} /></p>
          </div>
        </Card>

        {/* Supervisor Actions */}
        {isSupervisor && (
          <Card size="small" title={t('progress.evaluationFeedback')}>
            <div className="space-y-4">
              <div>
                <label className="block mb-2 font-medium">{t('progress.notes')}:</label>
                <TextArea
                  rows={4}
                  placeholder={t('progress.notesPlaceholder')}
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                />
              </div>

              <div className="flex gap-2">
                <Button
                  type="primary"
                  icon={<CheckCircleOutlined />}
                  onClick={() => handleApprove(currentStatus)}
                  loading={updateProgressMutation.isPending}
                >
                  {t('progress.approveNextStep')}
                </Button>
                <Button
                  danger
                  icon={<SyncOutlined />}
                  onClick={handleRequestChanges}
                  loading={updateProgressMutation.isPending}
                >
                  {t('progress.requestRevision')}
                </Button>
              </div>

              {/* Grading Section - Only visible in grading steps */}
              {['SUBMITTED_THESIS', 'ADVISOR_GRADED'].includes(currentStatus) && (
                <div className="mt-6 pt-4 border-t border-gray-200">
                  <h4 className="font-semibold mb-3">{t('progress.advisorGrading')}</h4>
                  <Form layout="vertical" form={gradingForm}>
                    <Form.Item label={t('progress.scoreRange')} name="advisorScore">
                      <Input type="number" min={0} max={10} step={0.1} />
                    </Form.Item>
                    <Form.Item label={t('progress.contribution')} name="contribution">
                      <Input placeholder={t('progress.contributionPlaceholder')} />
                    </Form.Item>
                  </Form>
                </div>
              )}
            </div>
          </Card>
        )}

        {/* Student View - Action Required */}
        {!isSupervisor && (
          <Card size="small" title={t('progress.nextAction')}>
            <p className="text-muted-foreground">
              {t('progress.followAdvisorFeedback')}
            </p>
            {/* Display latest feedback if any */}
            {registration.feedback && (
              <Alert
                message={t('progress.advisorFeedbackTitle')}
                description={registration.feedback}
                type="info"
                showIcon
                className="mt-4"
              />
            )}
          </Card>
        )}
      </div>

      {/* Activity Log */}
      <div className="mt-6">
        <h3 className="text-lg font-semibold mb-3">{t('progress.activityLog')}</h3>
        <Table
          dataSource={logs || []}
          loading={isLoadingLogs}
          rowKey="id"
          size="middle"
          className="sys-table"
          columns={[
            {
              title: t('progress.time'),
              dataIndex: 'created_at',
              key: 'time',
              render: (text) => <span className="text-xs text-gray-500">{dayjs(text).format('DD/MM/YYYY HH:mm')}</span>
            },
            {
              title: t('progress.actor'),
              dataIndex: 'user',
              key: 'user',
              render: (user) => (
                <Space>
                  <Avatar size="small" src={user?.avatar_url} icon={<UserOutlined />} />
                  <span className="text-sm font-medium">{user?.full_name}</span>
                </Space>
              )
            },
            {
              title: t('progress.action'),
              dataIndex: 'action',
              key: 'action',
              render: (action) => <Tag className="m-0">{action}</Tag>
            },
            {
              title: t('progress.details'),
              key: 'detail',
              render: (_, record: any) => {
                const newValue = record.new_value as any;
                  return (
                    <div className="text-xs">
                      {newValue?.status && <div className="mb-1">{t('common.status')}: <StudentProgressBadge status={newValue.status} /></div>}
                      {newValue?.feedback && <div className="text-gray-500 italic">"{newValue.feedback}"</div>}
                    </div>
                  );
              }
            },
          ]}
          pagination={false}
          locale={{ emptyText: t('progress.noHistory') }}
        />
      </div>
    </Card>
  );
};

const Progress = () => {
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const [selectedStudentId, setSelectedStudentId] = useState<string | undefined>(undefined);

  // Hooks
  const { data: registrations, isLoading } = useRegistrations({
    status: 'CONFIRMED' // Only show confirmed registrations (active topics)
  });

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <Spin size="large" />
      </div>
    );
  }

  // Supervisor View
  const columns = [
    {
      title: t('progress.group'),
      dataIndex: ['group', 'name'],
      key: 'group',
    },
    {
      title: t('topics.topicTitle'),
      dataIndex: ['topic', 'title'],
      key: 'topic',
    },
    {
      title: t('common.status'),
      dataIndex: 'studentProgressStatus',
      key: 'status',
      render: (status: string) => <StudentProgressBadge status={status as any} />,
    },
    {
      title: t('common.actions'),
      key: 'action',
      render: (_, record: any) => (
        <Button onClick={() => setSelectedStudentId(record.id)}>{t('progress.viewDetail')}</Button>
      ),
    },
  ];

  return (
    <div className="page-container">
      <div className="page-inner">
        {/* Header */}
        <Card className="page-header-card">
          <div className="flex items-center gap-3">
            <div className="page-header-icon"><ClockCircleOutlined className="text-base" /></div>
            <div>
              <div className="page-header-title">{t('progress.title')}</div>
              <div className="page-header-subtitle">Theo dõi tiến độ thực hiện đề tài của các nhóm sinh viên</div>
            </div>
          </div>
        </Card>

        <Card className="page-card-flush">
          <Table
            dataSource={registrations || []}
            columns={columns}
            rowKey="id"
            size="middle"
            className="sys-table"
            pagination={{
              pageSize: 10,
              className: 'px-6 py-4'
            }}
          />
        </Card>

      <Modal
        title={t('progress.progressDetail')}
        open={!!selectedStudentId}
        onCancel={() => setSelectedStudentId(undefined)}
        footer={null}
        width={1000}
      >
        {selectedStudentId && (
          <RegistrationDetail
            registration={registrations?.find((r: any) => r.id === selectedStudentId)}
            isSupervisor={true}
          />
        )}
      </Modal>
            </div>
        </div>
    );
};

export default Progress;