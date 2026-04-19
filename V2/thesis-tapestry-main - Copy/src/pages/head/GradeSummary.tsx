import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Table, Card, Tag, Button, Typography, Space, Tooltip, Progress,
  Row, Col, Statistic, Alert, Modal, Spin, Badge, Input, Popconfirm,
} from 'antd';
import {
  CheckCircleOutlined, ClockCircleOutlined, FireOutlined,
  LockOutlined, SearchOutlined, TrophyOutlined, SyncOutlined,
} from '@ant-design/icons';
import { GradingApi } from '@/api/grading';
import { notify } from '@/utils/notification';
import { useNavigate } from 'react-router-dom';

const { Title, Text } = Typography;

const statusColor: Record<string, string> = {
  COMPLETED: 'orange',
  FINALIZED: 'green',
};

const GradeSummary = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [computing, setComputing] = useState<string | null>(null);

  const { data: topics = [], isLoading } = useQuery({
    queryKey: ['grade-summary'],
    queryFn: () => GradingApi.getGradeSummary(),
  });

  const computeMutation = useMutation({
    mutationFn: (topicId: string) => GradingApi.computeFinalScore(topicId),
    onSuccess: (_, topicId) => {
      notify.success('Đã tính điểm tổng kết thành công!');
      queryClient.invalidateQueries({ queryKey: ['grade-summary'] });
      setComputing(null);
    },
    onError: (err: any) => {
      notify.error(err.message || 'Không thể tính điểm tổng kết');
      setComputing(null);
    },
  });

  const finalizeMutation = useMutation({
    mutationFn: (topicId: string) => GradingApi.finalizeGrades(topicId),
    onSuccess: () => {
      notify.success('Đã xác nhận và chốt điểm! Kết quả đã chuyển sang mục Kết quả khóa luận.');
      queryClient.invalidateQueries({ queryKey: ['grade-summary'] });
      queryClient.invalidateQueries({ queryKey: ['final-results'] });
    },
    onError: (err: any) => {
      notify.error(err.message || 'Không thể chốt điểm');
    },
  });

  const filtered = useMemo(() => {
    if (!search) return topics;
    const q = search.toLowerCase();
    return topics.filter((t: any) =>
      t.title?.toLowerCase().includes(q) ||
      t.code?.toLowerCase().includes(q) ||
      t.students?.some((s: any) => s.full_name?.toLowerCase().includes(q) || s.student_code?.includes(q))
    );
  }, [topics, search]);

  const readyCount = topics.filter((t: any) => t.gradingStatus?.isComplete && !t.gradingStatus?.isFinalized).length;
  const finalizedCount = topics.filter((t: any) => t.gradingStatus?.isFinalized).length;

  const columns = [
    {
      title: 'Đề tài',
      key: 'topic',
      render: (record: any) => (
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Tag color="blue">{record.code}</Tag>
            {record.defense_type && (
              <Tag color={record.defense_type === 'ORAL' ? 'cyan' : 'purple'}>
                {record.defense_type === 'ORAL' ? 'Vấn đáp' : 'Poster'}
              </Tag>
            )}
            <Tag color={statusColor[record.status] || 'default'}>{record.status}</Tag>
          </div>
          <div className="font-semibold text-gray-800 line-clamp-2">{record.title}</div>
          <div className="text-xs text-gray-400 mt-0.5">
            GVHD: {record.supervisor?.full_name} | HK: {record.semester?.name}
          </div>
        </div>
      ),
    },
    {
      title: 'Sinh viên',
      key: 'students',
      width: 200,
      render: (record: any) => (
        <div className="space-y-1">
          {record.students?.map((s: any) => (
            <div key={s.id} className="flex flex-col">
              <Text strong className="text-sm">{s.full_name}</Text>
              <Text type="secondary" className="text-xs">{s.student_code}</Text>
            </div>
          ))}
        </div>
      ),
    },
    {
      title: 'Tiến độ chấm',
      key: 'grading_progress',
      width: 180,
      render: (record: any) => {
        const gs = record.gradingStatus;
        const steps = [
          { label: 'GVHD', done: gs?.supervisorGraded },
          { label: `PB (${gs?.reviewerCount}/2)`, done: gs?.reviewerCount >= 2 },
          { label: `HĐ (${gs?.committeeCount}/1)`, done: gs?.committeeCount >= 1 },
        ];
        const doneCount = steps.filter(s => s.done).length;
        return (
          <div>
            <Progress percent={Math.round(doneCount / 3 * 100)} size="small" status={doneCount === 3 ? 'success' : 'active'} />
            <div className="flex gap-2 mt-1 flex-wrap">
              {steps.map(s => (
                <Tag key={s.label} color={s.done ? 'green' : 'default'} className="text-xs">
                  {s.done ? '✓' : '○'} {s.label}
                </Tag>
              ))}
            </div>
          </div>
        );
      },
    },
    {
      title: 'GVHD',
      key: 'sv_score',
      width: 80,
      align: 'center' as const,
      render: (record: any) => (
        <div className="space-y-1">
          {record.students?.map((s: any) => (
            <div key={s.id}><Text strong>{s.finalScore?.supervisor_score?.toFixed(2) ?? '—'}</Text></div>
          ))}
        </div>
      ),
    },
    {
      title: 'PB (TB)',
      key: 'rv_score',
      width: 80,
      align: 'center' as const,
      render: (record: any) => (
        <div className="space-y-1">
          {record.students?.map((s: any) => (
            <div key={s.id}><Text strong>{s.finalScore?.reviewer_avg_score?.toFixed(2) ?? '—'}</Text></div>
          ))}
        </div>
      ),
    },
    {
      title: 'HĐ (TB)',
      key: 'cm_score',
      width: 80,
      align: 'center' as const,
      render: (record: any) => (
        <div className="space-y-1">
          {record.students?.map((s: any) => (
            <div key={s.id}>
              {s.finalScore?.committee_score !== null ? (
                <Text strong>{s.finalScore.committee_score.toFixed(2)}</Text>
              ) : (
                <Text type="secondary" style={{ fontSize: '10px' }}>Chờ HĐ</Text>
              )}
            </div>
          ))}
        </div>
      ),
    },
    {
      title: 'Cộng',
      key: 'bonus',
      width: 70,
      align: 'center' as const,
      render: (record: any) => (
        <div className="space-y-1">
          {record.students?.map((s: any) => (
            <div key={s.id}>
              <Text type="warning" strong>
                +{s.finalScore?.extra_points?.toFixed(2) ?? '0.00'}
              </Text>
            </div>
          ))}
        </div>
      ),
    },
    {
      title: 'Tổng',
      key: 'final',
      width: 90,
      align: 'center' as const,
      render: (record: any) => (
        <div className="space-y-1">
          {record.students?.map((s: any) => (
            <div key={s.id}>
              {!s.finalScore || s.finalScore.final_score === null ? (
                <Text type="secondary" style={{ fontSize: '10px' }}>Chưa chốt</Text>
              ) : (
                <div className="bg-blue-50 rounded py-0.5 px-1 text-center border border-blue-100">
                  <Text strong className="text-blue-700">{s.finalScore.final_score?.toFixed(2)}</Text>
                </div>
              )}
            </div>
          ))}
        </div>
      ),
    },
    {
      title: 'Xếp loại',
      key: 'grade',
      width: 110,
      align: 'center' as const,
      render: (record: any) => {
        const colorMap: Record<string, string> = { 'Xuất sắc': 'gold', 'Giỏi': 'green', 'Khá': 'blue', 'Trung bình': 'orange', 'Yếu': 'red', 'Không đạt': 'red' };
        return (
          <div className="space-y-1">
            {record.students?.map((s: any) => (
              <div key={s.id}>
                {s.finalScore?.grade_classification ? (
                  <Tag color={colorMap[s.finalScore.grade_classification] || 'default'} className="m-0 text-[10px] px-1">
                    {s.finalScore.grade_classification}
                  </Tag>
                ) : <Text type="secondary">—</Text>}
              </div>
            ))}
          </div>
        );
      },
    },
    {
      title: 'Hành động',
      key: 'actions',
      width: 200,
      render: (record: any) => {
        const gs = record.gradingStatus;
        if (gs?.isFinalized) {
          return (
            <Tag color="green" icon={<LockOutlined />}>Đã chốt điểm</Tag>
          );
        }
        return (
          <Space direction="vertical" size={4} className="w-full">
            <Button
              size="small"
              type="primary"
              ghost
              icon={<SearchOutlined />}
              onClick={() => {
                let type = 'advisor';
                if (record.status === 'UNDER_REVIEW') type = 'reviewer';
                if (['WAITING_FOR_DEFENSE', 'DEFENDING', 'COMPLETED'].includes(record.status)) type = 'council';
                navigate(`/evaluation?topicId=${record.id}&type=${type}`);
              }}
              className="w-full"
            >
              Tiến hành chấm điểm
            </Button>
            {gs?.isComplete && !gs?.hasFinalScore && (
              <Button
                type="default"
                size="small"
                icon={<SyncOutlined spin={computing === record.id} />}
                loading={computing === record.id}
                onClick={() => {
                  setComputing(record.id);
                  computeMutation.mutate(record.id);
                }}
                className="w-full bg-orange-50 text-orange-600 border-orange-200"
              >
                Tính điểm tổng kết
              </Button>
            )}
            {gs?.hasFinalScore && (
              <Popconfirm
                title="Xác nhận chốt điểm?"
                description="Sau khi chốt, điểm sẽ chuyển sang Kết quả khóa luận và không thể thay đổi."
                onConfirm={() => finalizeMutation.mutate(record.id)}
                okText="Chốt điểm"
                cancelText="Hủy"
                okButtonProps={{ danger: true }}
              >
                <Button
                  type="primary"
                  size="small"
                  icon={<CheckCircleOutlined />}
                  loading={finalizeMutation.isPending}
                  className="w-full"
                >
                  Xác nhận & Chốt điểm
                </Button>
              </Popconfirm>
            )}
            <Button
              size="small"
              onClick={() => navigate(`/topics/${record.id}`)}
              className="w-full"
            >
              Chi tiết đề tài
            </Button>
          </Space>
        );
      },
    },
  ];

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="max-w-[1500px] mx-auto">
        {/* Header */}
        <Row gutter={[24, 24]} className="mb-6 items-end">
          <Col span={14}>
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-200">
                <TrophyOutlined className="text-white text-2xl" />
              </div>
              <div>
                <Title level={2} style={{ margin: 0 }}>Tổng kết & Xác nhận điểm</Title>
                <Text type="secondary">Xem, tính điểm tổng kết và chốt điểm cho sinh viên</Text>
              </div>
            </div>
          </Col>
          <Col span={10}>
            <div className="flex gap-4 justify-end">
              <Card size="small" className="bg-white shadow-sm border-none min-w-[140px]">
                <Statistic
                  title="Sẵn sàng chốt"
                  value={readyCount}
                  prefix={<FireOutlined className="text-orange-500" />}
                  valueStyle={{ color: '#d46b08', fontWeight: '900' }}
                />
              </Card>
              <Card size="small" className="bg-white shadow-sm border-none min-w-[140px]">
                <Statistic
                  title="Đã chốt điểm"
                  value={finalizedCount}
                  prefix={<CheckCircleOutlined className="text-green-500" />}
                  valueStyle={{ color: '#389e0d', fontWeight: '900' }}
                />
              </Card>
            </div>
          </Col>
        </Row>

        {readyCount > 0 && (
          <Alert
            message={`${readyCount} đề tài đã chấm đủ điểm — cần tính tổng kết và xác nhận để chuyển sang Kết quả khóa luận`}
            type="warning"
            showIcon
            className="mb-4"
          />
        )}

        <Card className="shadow-md border-none rounded-xl">
          <div className="flex justify-between items-center mb-4">
            <Input
              placeholder="Tìm theo mã, tên đề tài hoặc sinh viên..."
              prefix={<SearchOutlined className="text-gray-400" />}
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ width: 320 }}
              allowClear
            />
            <Button
              type="primary"
              icon={<TrophyOutlined />}
              onClick={() => navigate('/final-results')}
            >
              Xem Kết quả khóa luận
            </Button>
          </div>

          <Table
            dataSource={filtered}
            columns={columns}
            rowKey="id"
            loading={isLoading}
            pagination={{ pageSize: 15 }}
            rowClassName={(r: any) => r.gradingStatus?.isFinalized ? 'bg-green-50/40' : r.gradingStatus?.isComplete ? 'bg-orange-50/40' : ''}
            scroll={{ x: 1400 }}
          />
        </Card>
      </div>
    </div>
  );
};

export default GradeSummary;
