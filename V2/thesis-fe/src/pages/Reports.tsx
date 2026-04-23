import { Card, Row, Col, Select, Spin, Alert, Typography, Table, Tag, Space, Button, Avatar, Tooltip as AntTooltip, Divider } from 'antd';
import { useTranslation } from 'react-i18next';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, PieChart, Pie, Cell,
  LineChart, Line, ResponsiveContainer, AreaChart, Area
} from 'recharts';
import {
  FileTextOutlined, TeamOutlined, CheckCircleOutlined, TrophyOutlined,
  DownloadOutlined, FilterOutlined, ArrowUpOutlined, CalendarOutlined
} from '@ant-design/icons';
import { useDashboardStats, useDashboardCharts } from '@/hooks/useDashboard';
import { useAuthStore } from '@/store/auth';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white p-3 border border-gray-200 shadow-lg rounded-lg">
        <p className="font-bold text-gray-800 mb-1">{label}</p>
        {payload.map((entry: any, index: number) => (
          <p key={index} className="text-sm" style={{ color: entry.color }}>
            {entry.name}: <span className="font-bold">{entry.value}</span>
          </p>
        ))}
      </div>
    );
  }
  return null;
};

const Reports = () => {
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const { data: stats, isLoading: statsLoading, error: statsError } = useDashboardStats();
  const { data: charts, isLoading: chartsLoading, error: chartsError } = useDashboardCharts();

  if (statsLoading || chartsLoading) {
    return <div className="flex justify-center items-center h-screen"><Spin size="large" tip="Đang tải dữ liệu báo cáo..." /></div>;
  }

  if (statsError || chartsError) {
    return (
      <div className="p-6">
        <Alert
          message="Lỗi tải dữ liệu"
          description="Đã có lỗi xảy ra khi thu thập dữ liệu báo cáo. Vui lòng thử lại sau."
          type="error"
          showIcon
        />
      </div>
    );
  }

  const topicStatusData = charts?.topicStatus || [];
  const defenseTypeData = charts?.defenseType || [];
  const monthlyProgressData = (charts?.monthlyProgress || []).map((d: any) => ({
    ...d,
    month: dayjs().month(d.month - 1).format('MMM')
  }));
  const scoreboardData = charts?.leaderboard || [];

  const leaderColumns = [
    {
      title: 'Hạng',
      key: 'rank',
      width: 80,
      render: (_: any, __: any, index: number) => (
        <div className="flex items-center justify-center">
          {index === 0 ? <TrophyOutlined className="text-yellow-500 text-xl" /> :
            index === 1 ? <TrophyOutlined className="text-gray-400 text-xl" /> :
              index === 2 ? <TrophyOutlined className="text-orange-400 text-xl" /> :
                <span className="font-bold text-gray-500">{index + 1}</span>}
        </div>
      ),
    },
    {
      title: 'Giảng viên',
      key: 'lecturer',
      render: (_: any, record: any) => (
        <Space>
          <Avatar src={record.avatar_url} icon={<TeamOutlined />} />
          <div>
            <div className="font-bold">{record.full_name}</div>
            <div className="text-xs text-gray-500">{record.email}</div>
          </div>
        </Space>
      ),
    },
    {
      title: 'Số đề tài',
      dataIndex: 'topicCount',
      key: 'topicCount',
      align: 'center' as const,
      render: (count: number) => <Tag color="blue" className="px-3 py-1 text-sm font-bold">{count}</Tag>,
    },
    {
      title: 'Xu hướng',
      key: 'trend',
      render: () => <ArrowUpOutlined className="text-green-500" />,
    }
  ];

  return (
    <div className="p-8 space-y-8 bg-[#f8fafc] min-h-screen">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <Title level={2} className="mb-1 bg-gradient-to-r from-blue-600 to-indigo-700 bg-clip-text text-transparent">
            {t('navigation.reports')}
          </Title>
          <Text type="secondary" className="flex items-center gap-2">
            <CalendarOutlined /> Dữ liệu thống kê học kỳ hiện tại • Cập nhật: {dayjs().format('DD/MM/YYYY HH:mm')}
          </Text>
        </div>
        <div className="flex flex-wrap gap-3">
          <Select
            defaultValue="current"
            style={{ width: 220 }}
            prefix={<FilterOutlined className="text-blue-500" />}
            className="shadow-sm rounded-lg"
          >
            <Select.Option value="current">Học kỳ 2 (2025-2026)</Select.Option>
            <Select.Option value="prev">Học kỳ 1 (2025-2026)</Select.Option>
          </Select>
          <Button
            type="primary"
            icon={<DownloadOutlined />}
            className="bg-indigo-600 hover:bg-indigo-700 shadow-md h-[40px] px-6"
          >
            {t('reports.exportExcel')}
          </Button>
        </div>
      </div>

      {/* Overview Stats Cards */}
      <Row gutter={[24, 24]}>
        <Col xs={24} sm={12} lg={6}>
          <Card className="hover:shadow-xl transition-all duration-300 border-none bg-gradient-to-br from-blue-500 to-blue-700 h-[140px] relative overflow-hidden">
            <div className="absolute top-[-20%] right-[-10%] opacity-10">
              <FileTextOutlined style={{ fontSize: 120, color: '#fff' }} />
            </div>
            <Text className="text-white/80 uppercase tracking-wider text-xs font-bold">{t('reports.totalTopics')}</Text>
            <div className="text-4xl font-black text-white mt-2">{stats?.totalTopics || 0}</div>
            <div className="mt-2 text-white/60 text-xs flex items-center gap-1">
              <ArrowUpOutlined /> +12% so với kỳ trước
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card className="hover:shadow-xl transition-all duration-300 border-none bg-gradient-to-br from-emerald-500 to-teal-700 h-[140px] relative overflow-hidden">
            <div className="absolute top-[-20%] right-[-10%] opacity-10">
              <CheckCircleOutlined style={{ fontSize: 120, color: '#fff' }} />
            </div>
            <Text className="text-white/80 uppercase tracking-wider text-xs font-bold">{t('reports.completionRate')}</Text>
            <div className="text-4xl font-black text-white mt-2">{stats?.completionRate?.toFixed(1) || 0}%</div>
            <div className="mt-2 text-white/60 text-xs">Phần trăm đề tài đã hoàn thành</div>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card className="hover:shadow-xl transition-all duration-300 border-none bg-gradient-to-br from-orange-500 to-amber-700 h-[140px] relative overflow-hidden">
            <div className="absolute top-[-20%] right-[-10%] opacity-10">
              <StarFilled style={{ fontSize: 120, color: '#fff' }} />
            </div>
            <Text className="text-white/80 uppercase tracking-wider text-xs font-bold">{t('reports.avgScore')}</Text>
            <div className="text-4xl font-black text-white mt-2">{stats?.avgScore?.toFixed(2) || 0}</div>
            <div className="mt-2 text-white/60 text-xs">Điểm trung bình toàn khóa</div>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card className="hover:shadow-xl transition-all duration-300 border-none bg-gradient-to-br from-indigo-500 to-purple-700 h-[140px] relative overflow-hidden">
            <div className="absolute top-[-20%] right-[-10%] opacity-10">
              <TeamOutlined style={{ fontSize: 120, color: '#fff' }} />
            </div>
            <Text className="text-white/80 uppercase tracking-wider text-xs font-bold">{t('reports.defendedCount')}</Text>
            <div className="text-4xl font-black text-white mt-2">{stats?.defendedCount || 0}</div>
            <div className="mt-2 text-white/60 text-xs">Tổng số đề tài đã bảo vệ xong</div>
          </Card>
        </Col>
      </Row>

      {/* Main Charts Section */}
      <Row gutter={[24, 24]}>
        <Col xs={24} lg={16}>
          <Card
            title={
              <Space>
                <div className="w-2 h-6 bg-blue-600 rounded-full" />
                <span className="font-bold text-lg">{t('reports.monthlyProgress')}</span>
              </Space>
            }
            className="shadow-soft border-none rounded-xl"
            extra={<Tag color="blue">Theo tháng</Tag>}
          >
            <div className="h-[400px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={monthlyProgressData}>
                  <defs>
                    <linearGradient id="colorReg" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorDef" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#22c55e" stopOpacity={0.1} />
                      <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: '#64748b' }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b' }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px' }} />
                  <Area
                    type="monotone"
                    dataKey="registered"
                    stroke="#3b82f6"
                    strokeWidth={3}
                    fillOpacity={1}
                    fill="url(#colorReg)"
                    name={t('reports.registeredCount')}
                  />
                  <Area
                    type="monotone"
                    dataKey="defended"
                    stroke="#22c55e"
                    strokeWidth={3}
                    fillOpacity={1}
                    fill="url(#colorDef)"
                    name={t('reports.defendedLabel')}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </Col>

        <Col xs={24} lg={8}>
          <Card
            title={
              <Space>
                <div className="w-2 h-6 bg-indigo-600 rounded-full" />
                <span className="font-bold text-lg">{t('reports.statusDistribution')}</span>
              </Space>
            }
            className="shadow-soft border-none rounded-xl h-full"
          >
            <div className="h-[340px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={topicStatusData}
                    cx="50%"
                    cy="50%"
                    innerRadius={80}
                    outerRadius={110}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {topicStatusData.map((entry: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              {topicStatusData.map((entry: any, index: number) => (
                <div key={index} className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                  <span className="text-xs text-gray-600 truncate">{entry.name} ({entry.value})</span>
                </div>
              ))}
            </div>
          </Card>
        </Col>
      </Row>

      {/* Row 2: Defense Ratio & Leaderboard */}
      <Row gutter={[24, 24]}>
        <Col xs={24} lg={10}>
          <Card
            title={
              <Space>
                <div className="w-2 h-6 bg-pink-600 rounded-full" />
                <span className="font-bold text-lg">{t('reports.defenseRatio')}</span>
              </Space>
            }
            className="shadow-soft border-none rounded-xl"
          >
            <div className="h-[350px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={defenseTypeData}
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    dataKey="count"
                    nameKey="type"
                    label={({ type, percent }) => `${type}: ${(percent * 100).toFixed(0)}%`}
                  >
                    <Cell fill="#6366f1" />
                    <Cell fill="#ec4899" />
                  </Pie>
                  <Tooltip />
                  <Legend verticalAlign="bottom" align="center" />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </Col>

        <Col xs={24} lg={14}>
          <Card
            title={
              <Space>
                <div className="w-2 h-6 bg-yellow-500 rounded-full" />
                <span className="font-bold text-lg">{t('reports.topLecturers')}</span>
              </Space>
            }
            className="shadow-soft border-none rounded-xl overflow-hidden"
          >
            <Table
              dataSource={scoreboardData}
              columns={leaderColumns}
              pagination={false}
              rowKey="id"
              className="lecturer-table"
              size="middle"
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
};

// Placeholder icons missing from import
const StarFilled = ({ style, className }: any) => (
  <svg width="1em" height="1em" fill="currentColor" viewBox="0 0 1024 1024" style={style} className={className}>
    <path d="M908.1 353.1l-253.9-36.9L540.7 86.1c-9.7-19.4-41.7-19.4-51.4 0l-113.5 230.1-253.9 36.9c-21.1 3.1-29.7 29.1-14.5 44.1l183.6 179-43.4 252.8c-3.6 21 19.3 36.6 37.8 26.1L512 735.1l226.6 119.1c18.5 10.5 41.4-5.1 37.8-26.1l-43.4-252.8 183.6-179c15.2-15 6.6-41-14.5-44.1z" />
  </svg>
);

export default Reports;