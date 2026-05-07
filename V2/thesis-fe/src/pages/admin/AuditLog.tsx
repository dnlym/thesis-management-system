import React, { useState, useCallback } from 'react';
import {
  Table, Tag, Input, Select, DatePicker, Button, Space, Typography,
  Drawer, Descriptions, Avatar, Badge, Tooltip, Card, Row, Col, Statistic
} from 'antd';
import {
  SearchOutlined, ReloadOutlined, EyeOutlined, UserOutlined,
  ClockCircleOutlined, DatabaseOutlined, FileTextOutlined, FilterOutlined,
  CopyOutlined
} from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { AuditLogsApi, AuditLogEntry, AuditLogFilters } from '@/api/auditLogs';
import dayjs from 'dayjs';
import type { ColumnsType } from 'antd/es/table';
import { message } from 'antd';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;
const { Option } = Select;

// ----- HELPER -----
const TruncatedID: React.FC<{ id: string }> = ({ id }) => {
  if (!id) return null;
  const isUUID = id.length > 20;
  const displayId = isUUID ? `${id.substring(0, 8)}...${id.substring(id.length - 8)}` : id;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(id);
    message.success('Đã sao chép ID');
  };

  return (
    <Tooltip title={id}>
      <Text code style={{ fontSize: '11px', cursor: 'pointer' }} onClick={copyToClipboard}>
        {displayId} <CopyOutlined style={{ fontSize: '10px', marginLeft: '4px', opacity: 0.5 }} />
      </Text>
    </Tooltip>
  );
};

// ----- CONSTANTS -----
const ACTION_CONFIG: Record<string, { color: string; label: string }> = {
  CREATE_USER:                  { color: '#52c41a', label: 'Tạo tài khoản' }, // green-6
  UPDATE_USER:                  { color: '#1890ff', label: 'Sửa tài khoản' }, // blue-6
  DELETE_USER:                  { color: '#f5222d', label: 'Xóa tài khoản' }, // red-6
  UPDATE_TOPIC:                 { color: '#fa8c16', label: 'Sửa đề tài' },    // orange-6
  SUBMIT_GRADE:                 { color: '#722ed1', label: 'Nộp điểm' },      // purple-6
  FINALIZE_SCORE:               { color: '#eb2f96', label: 'Chốt điểm' },    // magenta-6
  CREATE_CRITERION:             { color: '#13c2c2', label: 'Tạo tiêu chí' },  // cyan-6
  UPDATE_CRITERION:             { color: '#2f54eb', label: 'Sửa tiêu chí' },  // geekblue-6
  CREATE_SEMESTER:              { color: '#389e0d', label: 'Tạo học kỳ' },    // green-7
  UPDATE_SEMESTER:              { color: '#d46b08', label: 'Sửa học kỳ' },    // orange-7
  ACTIVATE_SEMESTER:            { color: '#237804', label: 'Kích hoạt HK' },  // green-8
  FINALIZE_SEMESTER:            { color: '#cf1322', label: 'Kết thúc HK' },    // red-7
  UPDATE_DEFENSE_DATE:          { color: '#096dd9', label: 'Đổi ngày BV' },   // blue-7
  REGISTRATION_OVERRIDE_ENABLED:{ color: '#fa541c', label: 'Mở ghi đè ĐK' }, // volcano-6
  REGISTRATION_OVERRIDE_DISABLED:{color: '#8c8c8c', label: 'Đóng ghi đè ĐK'}, // gray-7
};

// Sensitive fields that should be highlighted in diff view
const SENSITIVE_FIELDS = ['score', 'status', 'supervisor_id', 'role', 'finalized', 'final_score', 'grade_classification'];
const NOISE_FIELDS = ['updated_at', 'created_at'];

// ----- DIFF VIEWER -----
const DiffViewer: React.FC<{ oldVal: any; newVal: any }> = ({ oldVal, newVal }) => {
  if (!oldVal && !newVal) return <Text type="secondary" italic>Không có dữ liệu chi tiết</Text>;

  const allKeys = Array.from(new Set([
    ...Object.keys(oldVal || {}),
    ...Object.keys(newVal || {})
  ])).filter(k => !NOISE_FIELDS.includes(k));

  const changedKeys = allKeys.filter(k =>
    JSON.stringify((oldVal || {})[k]) !== JSON.stringify((newVal || {})[k])
  );

  if (changedKeys.length === 0) {
    return (
      <div style={{ padding: '20px', textAlign: 'center', background: '#f9f9f9', borderRadius: '8px', border: '1px dashed #d9d9d9' }}>
        <Text type="secondary">Không có thay đổi nào về giá trị thuộc tính.</Text>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {changedKeys.map(key => {
        const isSensitive = SENSITIVE_FIELDS.some(s => key.toLowerCase().includes(s));
        const oldV = (oldVal || {})[key];
        const newV = (newVal || {})[key];

        return (
          <div key={key} style={{
            borderRadius: '8px',
            overflow: 'hidden',
            border: `1px solid ${isSensitive ? '#ffd591' : '#f0f0f0'}`,
            boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
          }}>
            {/* Header của thuộc tính */}
            <div style={{ 
              background: isSensitive ? '#fff7e6' : '#fafafa', 
              padding: '6px 12px', 
              borderBottom: `1px solid ${isSensitive ? '#ffd591' : '#f0f0f0'}`,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <Text strong style={{ color: isSensitive ? '#d46b08' : '#262626', fontSize: '13px' }}>
                {key}
              </Text>
              {isSensitive && <Tag color="orange" style={{ margin: 0, fontSize: '10px' }}>NHẠY CẢM</Tag>}
            </div>

            {/* Nội dung thay đổi */}
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {oldV !== undefined && (
                <div style={{ 
                  display: 'flex', 
                  background: '#fff1f0', 
                  padding: '8px 12px',
                  borderBottom: newV !== undefined ? '1px solid #ffa39e' : 'none'
                }}>
                  <Text style={{ color: '#f5222d', marginRight: '8px', fontWeight: 'bold' }}>-</Text>
                  <Text delete style={{ color: '#cf1322', wordBreak: 'break-all', fontSize: '13px' }}>
                    {typeof oldV === 'object' ? JSON.stringify(oldV) : String(oldV)}
                  </Text>
                </div>
              )}
              {newV !== undefined && (
                <div style={{ display: 'flex', background: '#f6ffed', padding: '8px 12px' }}>
                  <Text style={{ color: '#52c41a', marginRight: '8px', fontWeight: 'bold' }}>+</Text>
                  <Text style={{ color: '#389e0d', fontWeight: 500, wordBreak: 'break-all', fontSize: '13px' }}>
                    {typeof newV === 'object' ? JSON.stringify(newV) : String(newV)}
                  </Text>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

// ----- MAIN PAGE -----
const AuditLogPage: React.FC = () => {
  const [filters, setFilters] = useState<AuditLogFilters>({ page: 1, limit: 20 });
  const [pendingSearch, setPendingSearch] = useState('');
  const [selectedLog, setSelectedLog] = useState<AuditLogEntry | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['audit-logs', filters],
    queryFn: () => AuditLogsApi.getAll(filters),
  });

  const logs = data?.data ?? [];
  const pagination = data?.pagination;

  const handleSearch = useCallback(() => {
    setFilters(prev => ({ ...prev, page: 1, search: pendingSearch }));
  }, [pendingSearch]);

  const handleTableChange = useCallback((pag: any) => {
    setFilters(prev => ({ ...prev, page: pag.current, limit: pag.pageSize }));
  }, []);

  const openDrawer = useCallback((record: AuditLogEntry) => {
    setSelectedLog(record);
    setDrawerOpen(true);
  }, []);

  const columns: ColumnsType<AuditLogEntry> = [
    {
      title: 'Thời gian',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 150,
      render: (v: string) => (
        <Tooltip title={dayjs(v).format('DD/MM/YYYY HH:mm:ss')}>
          <Text style={{ fontSize: 12, color: '#8c8c8c' }}>
            <ClockCircleOutlined style={{ marginRight: 4 }} />
            {dayjs(v).format('DD/MM HH:mm')}
          </Text>
        </Tooltip>
      ),
    },
    {
      title: 'Người thực hiện',
      key: 'user',
      width: 180,
      render: (_, record) => record.user ? (
        <Space size={6}>
          <Avatar size={26} src={record.user.avatar_url} icon={<UserOutlined />} />
          <div>
            <div style={{ fontSize: 12, fontWeight: 500, lineHeight: 1.2 }}>{record.user.full_name}</div>
            <Tag color="blue" style={{ fontSize: 10, marginTop: 2 }}>{record.user.role}</Tag>
          </div>
        </Space>
      ) : <Text type="secondary" style={{ fontSize: 12 }}>Hệ thống</Text>,
    },
    {
      title: 'Hành động',
      dataIndex: 'action',
      key: 'action',
      width: 140,
      render: (action: string) => {
        const cfg = ACTION_CONFIG[action];
        return (
          <Tag color={cfg?.color || 'default'} style={{ 
            fontWeight: 600, 
            padding: '2px 10px',
            borderRadius: '4px',
            textTransform: 'uppercase',
            fontSize: '11px'
          }}>
            {cfg?.label || action}
          </Tag>
        );
      },
    },
    {
      title: 'Đối tượng',
      key: 'entity',
      width: 120,
      render: (_, record) => (
        <Tag icon={<DatabaseOutlined />} color="cyan" style={{ fontSize: 11, borderRadius: '4px' }}>
          {record.entity_type}
        </Tag>
      ),
    },
    {
      title: 'Mô tả',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
      render: (v: string | null) => v
        ? <Text style={{ fontSize: 13 }}>{v}</Text>
        : <Text type="secondary" italic style={{ fontSize: 12, opacity: 0.6 }}>Không có mô tả</Text>,
    },
    {
      title: 'Lý do',
      dataIndex: 'reason',
      key: 'reason',
      width: 200,
      ellipsis: true,
      render: (v: string | null) => v
        ? <Text style={{ fontSize: 13, color: '#fa8c16', fontWeight: 500 }}>{v}</Text>
        : <Text type="secondary" italic style={{ fontSize: 12, opacity: 0.6 }}>Không có lý do chỉnh sửa</Text>,
    },
    {
      title: 'IP',
      dataIndex: 'ip_address',
      key: 'ip_address',
      width: 130,
      render: (v: string | null) => v
        ? <Text code style={{ fontSize: 11, background: '#f0f5ff', color: '#2f54eb', border: 'none' }}>{v}</Text>
        : <Text type="secondary" italic style={{ fontSize: 12, opacity: 0.6 }}>—</Text>,
    },
    {
      title: 'Thao tác',
      key: 'actions',
      width: 80,
      fixed: 'right',
      align: 'center',
      render: (_, record) => (
        <Tooltip title="Xem chi tiết thay đổi">
          <Button
            type="primary"
            ghost
            icon={<EyeOutlined />}
            size="small"
            onClick={() => openDrawer(record)}
            style={{ borderRadius: '6px' }}
          />
        </Tooltip>
      ),
    },
  ];

  return (
    <div style={{ padding: '24px' }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <Title level={3} style={{ margin: 0 }}>
          <FileTextOutlined style={{ marginRight: 10, color: '#1677ff' }} />
          Nhật ký hoạt động hệ thống
        </Title>
        <Text type="secondary">
          Theo dõi toàn bộ thao tác thay đổi dữ liệu. Dữ liệu chỉ đọc, không thể xóa.
        </Text>
      </div>

      {/* Stats */}
      <Row gutter={16} style={{ marginBottom: 20 }}>
        <Col span={6}>
          <Card size="small" style={{ borderRadius: 8 }}>
            <Statistic
              title="Tổng số log"
              value={pagination?.total ?? 0}
              prefix={<DatabaseOutlined />}
              valueStyle={{ color: '#1677ff' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small" style={{ borderRadius: 8 }}>
            <Statistic
              title="Trang hiện tại"
              value={pagination?.page ?? 1}
              suffix={`/ ${pagination?.totalPages ?? 1}`}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
      </Row>

      {/* Filters */}
      <Card
        size="small"
        style={{ marginBottom: 16, borderRadius: 8 }}
        title={<><FilterOutlined style={{ marginRight: 6 }} />Bộ lọc</>}
      >
        <Space wrap size={12}>
          <Input
            placeholder="Tìm kiếm theo mô tả, ID..."
            prefix={<SearchOutlined />}
            value={pendingSearch}
            onChange={e => setPendingSearch(e.target.value)}
            onPressEnter={handleSearch}
            style={{ width: 280 }}
            allowClear
          />
          <Select
            placeholder="Loại hành động"
            style={{ width: 180 }}
            allowClear
            onChange={v => setFilters(p => ({ ...p, page: 1, action: v }))}
          >
            {Object.entries(ACTION_CONFIG).map(([k, { label }]) => (
              <Option key={k} value={k}>{label}</Option>
            ))}
          </Select>
          <Select
            placeholder="Đối tượng"
            style={{ width: 160 }}
            allowClear
            onChange={v => setFilters(p => ({ ...p, page: 1, entityType: v }))}
          >
            {['Topic', 'User', 'Semester', 'FinalScore', 'Grade', 'GradingCriterion'].map(t => (
              <Option key={t} value={t}>{t}</Option>
            ))}
          </Select>
          <RangePicker
            onChange={(_, vals) => setFilters(p => ({
              ...p, page: 1,
              startDate: vals[0] || undefined,
              endDate: vals[1] || undefined,
            }))}
          />
          <Button type="primary" icon={<SearchOutlined />} onClick={handleSearch}>
            Tìm kiếm
          </Button>
          <Button icon={<ReloadOutlined />} onClick={() => { setPendingSearch(''); setFilters({ page: 1, limit: 20 }); refetch(); }}>
            Đặt lại
          </Button>
        </Space>
      </Card>

      {/* Table */}
      <Card style={{ borderRadius: 8 }} bodyStyle={{ padding: 0 }}>
        <Table
          columns={columns}
          dataSource={logs}
          loading={isLoading}
          rowKey="id"
          scroll={{ x: 1100 }}
          size="small"
          pagination={{
            current: filters.page,
            pageSize: filters.limit,
            total: pagination?.total ?? 0,
            showSizeChanger: true,
            pageSizeOptions: ['10', '20', '50'],
            showTotal: (total, range) => `${range[0]}-${range[1]} / ${total} bản ghi`,
          }}
          onChange={handleTableChange}
          onRow={record => ({ onDoubleClick: () => openDrawer(record), style: { cursor: 'pointer' } })}
        />
      </Card>

      {/* Detail Drawer */}
      <Drawer
        title={
          <Space>
            <Badge color={ACTION_CONFIG[selectedLog?.action ?? '']?.color ?? 'blue'} />
            <span>Chi tiết thao tác</span>
            {selectedLog && (
              <Tag color={ACTION_CONFIG[selectedLog.action]?.color ?? 'default'}>
                {ACTION_CONFIG[selectedLog.action]?.label ?? selectedLog.action}
              </Tag>
            )}
          </Space>
        }
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        width={680}
        styles={{ body: { padding: 20 } }}
      >
        {selectedLog && (
          <Space direction="vertical" style={{ width: '100%' }} size={20}>
            {/* Meta info */}
            <Descriptions bordered size="small" column={1}>
              <Descriptions.Item label="Thời gian">
                {dayjs(selectedLog.created_at).format('DD/MM/YYYY HH:mm:ss')}
              </Descriptions.Item>
              <Descriptions.Item label="Người thực hiện">
                {selectedLog.user ? (
                  <Space>
                    <Avatar size={20} src={selectedLog.user.avatar_url} icon={<UserOutlined />} />
                    <span>{selectedLog.user.full_name}</span>
                    <Tag color="blue">{selectedLog.user.role}</Tag>
                  </Space>
                ) : 'Hệ thống'}
              </Descriptions.Item>
              <Descriptions.Item label="Đối tượng">
                <Space>
                  <Tag icon={<DatabaseOutlined />} color="cyan">{selectedLog.entity_type}</Tag>
                  <TruncatedID id={selectedLog.entity_id} />
                </Space>
              </Descriptions.Item>
              <Descriptions.Item label="IP">
                {selectedLog.ip_address
                  ? <Text code style={{ background: '#f0f5ff', color: '#2f54eb', border: 'none' }}>{selectedLog.ip_address}</Text>
                  : <Text type="secondary" italic style={{ opacity: 0.6 }}>—</Text>
                }
              </Descriptions.Item>
              {selectedLog.description && (
                <Descriptions.Item label="Mô tả">
                  {selectedLog.description}
                </Descriptions.Item>
              )}
              <Descriptions.Item label="Lý do chỉnh sửa">
                {selectedLog.reason ? (
                  <Text style={{ color: '#fa8c16', fontWeight: 600 }}>
                    {selectedLog.reason}
                  </Text>
                ) : (
                  <Text type="secondary" italic style={{ opacity: 0.6 }}>Không có mô tả chi tiết</Text>
                )}
              </Descriptions.Item>
            </Descriptions>

            {/* Diff viewer */}
            <div>
              <Title level={5} style={{ marginBottom: 12 }}>
                So sánh dữ liệu thay đổi
              </Title>
              <DiffViewer oldVal={selectedLog.old_value} newVal={selectedLog.new_value} />
            </div>

            {/* Raw JSON fallback */}
            {(selectedLog.old_value || selectedLog.new_value) && (
              <details style={{ marginTop: 8 }}>
                <summary style={{ cursor: 'pointer', color: '#8c8c8c', fontSize: 12 }}>
                  Xem dữ liệu JSON thô
                </summary>
                <pre style={{
                  background: '#f5f5f5',
                  padding: 12,
                  borderRadius: 6,
                  fontSize: 11,
                  overflowX: 'auto',
                  marginTop: 8,
                  maxHeight: 300,
                }}>
                  {JSON.stringify({ old: selectedLog.old_value, new: selectedLog.new_value }, null, 2)}
                </pre>
              </details>
            )}
          </Space>
        )}
      </Drawer>
    </div>
  );
};

export default AuditLogPage;
