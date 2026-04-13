import { useState } from 'react';
import { Card, Tabs, Table, Button, Modal, Form, Input, message, Tag, Spin, Steps, DatePicker, Alert } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, CalendarOutlined, InfoCircleOutlined, RightOutlined, LeftOutlined, CheckCircleOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useTranslation } from 'react-i18next';
import { useSemesters, useCreateSemester, useUpdateSemester, useDeleteSemester, useActivateSemester } from '@/hooks/useSemesters';
import { useDepartments, useCreateDepartment, useUpdateDepartment, useDeleteDepartment } from '@/hooks/useDepartments';
import type { Semester, Department } from '@/types';
import { StatusBadge } from '@/components/StatusBadge';

const { TabPane } = Tabs;

// ─── Phase configuration (6 phases) ─────────────────────────────────────────
const SEMESTER_PHASES = [
  {
    key: 'preview',
    label: 'Mở hệ thống',
    sublabel: 'Xem đề tài',
    description: 'Sinh viên xem và tìm hiểu các đề tài đã được duyệt trước khi đăng ký.',
    color: '#6366f1',
    bg: '#eef2ff',
  },
  {
    key: 'registration',
    label: 'Đăng ký đề tài',
    sublabel: 'Thành lập nhóm',
    description: 'Sinh viên đăng ký nhóm, chọn đề tài và xác nhận tham gia.',
    color: '#0ea5e9',
    bg: '#f0f9ff',
  },
  {
    key: 'work',
    label: 'Thực hiện khóa luận',
    sublabel: 'Làm + Giữa kỳ',
    description: 'Sinh viên thực hiện khóa luận. GVHD chấm giữa kỳ (Pass/Fail) trong giai đoạn này.',
    color: '#10b981',
    bg: '#f0fdf4',
  },
  {
    key: 'reviewing',
    label: 'Phản biện',
    sublabel: 'Nộp & chấm',
    description: 'Sinh viên nộp báo cáo cuối. GVPB được phân công và thực hiện chấm điểm phản biện.',
    color: '#ef4444',
    bg: '#fef2f2',
  },
  {
    key: 'defense',
    label: 'Bảo vệ',
    sublabel: 'Oral / Poster',
    description: 'Hội đồng bảo vệ khóa luận tốt nghiệp được tổ chức (Oral hoặc Poster).',
    color: '#8b5cf6',
    bg: '#f5f3ff',
  },
  {
    key: 'final',
    label: 'Tổng kết',
    sublabel: 'Chốt điểm',
    description: 'Admin và Khoa chốt điểm, lưu trữ dữ liệu và đóng học kỳ.',
    color: '#64748b',
    bg: '#f8fafc',
  },
];

// ─── Helper to build initial phase dates from today ─────────────────────────
const buildDefaultPhases = (startFrom: dayjs.Dayjs = dayjs()) => {
  const durations = [14, 21, 60, 21, 21, 7]; // 6 phases
  const phases: { start: dayjs.Dayjs; end: dayjs.Dayjs }[] = [];
  let cursor = startFrom.startOf('day');
  for (const dur of durations) {
    const end = cursor.add(dur - 1, 'day');
    phases.push({ start: cursor, end });
    cursor = end.add(1, 'day');
  }
  return phases;
};

// ─── Helper to extract phases from existing semester (6 phases) ──────────────
const extractPhasesFromSemester = (sem: Semester) => {
  const s = (d: any) => (d ? dayjs(d) : null);
  const fallback = dayjs();

  const raw = [
    // [0] PREVIEW
    { start: s(sem.topic_viewing_start) ?? fallback, end: s(sem.topic_viewing_end) },
    // [1] REGISTRATION
    { start: s(sem.topic_registration_start), end: s(sem.topic_registration_end) },
    // [2] WORK (ends at proposal_deadline)
    { start: null as dayjs.Dayjs | null, end: s(sem.proposal_deadline) },
    // [3] REVIEWING (ends at thesis_deadline)
    { start: null as dayjs.Dayjs | null, end: s(sem.thesis_deadline) },
    // [4] DEFENSE
    { start: s(sem.defense_start), end: s(sem.defense_end) },
    // [5] FINAL
    { start: null as dayjs.Dayjs | null, end: s(sem.end_date) },
  ];

  // Cascade start dates from previous end dates
  for (let i = 0; i < raw.length; i++) {
    if (!raw[i].start) {
      raw[i].start = i === 0 ? fallback : raw[i - 1].end!.add(1, 'day');
    }
    if (!raw[i].end) {
      raw[i].end = raw[i].start!.add(7, 'day');
    }
  }
  // Ensure sequential: next.start = prev.end + 1
  for (let i = 1; i < raw.length; i++) {
    raw[i].start = raw[i - 1].end!.add(1, 'day');
    if (raw[i].end!.isBefore(raw[i].start!)) {
      raw[i].end = raw[i].start!.add(7, 'day');
    }
  }

  return raw as { start: dayjs.Dayjs; end: dayjs.Dayjs }[];
};

const mapPhasesToDto = (
  name: string,
  code: string,
  phases: { start: dayjs.Dayjs; end: dayjs.Dayjs }[],
  midtermStart: dayjs.Dayjs | null,
  midtermEnd: dayjs.Dayjs | null,
) => ({
  name,
  code,
  start_date: phases[0].start.toISOString(),
  end_date: phases[5].end.toISOString(),
  topic_viewing_start: phases[0].start.toISOString(),
  topic_viewing_end: phases[0].end.toISOString(),
  topic_registration_start: phases[1].start.toISOString(),
  topic_registration_end: phases[1].end.toISOString(),
  proposal_deadline: phases[2].end.toISOString(),
  thesis_deadline: phases[3].end.toISOString(),
  defense_start: phases[4].start.toISOString(),
  defense_end: phases[4].end.toISOString(),
  midterm_start: midtermStart?.toISOString() ?? null,
  midterm_end: midtermEnd?.toISOString() ?? null,
});

// ─── Main Component ───────────────────────────────────────────────────────────
const AdminSettings = () => {
  const [activeTab, setActiveTab] = useState('semesters');
  const [semesterModalVisible, setSemesterModalVisible] = useState(false);
  const [deptModalVisible, setDeptModalVisible] = useState(false);
  const [editingSemester, setEditingSemester] = useState<Semester | null>(null);
  const [editingDept, setEditingDept] = useState<Department | null>(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [phaseDates, setPhaseDates] = useState<{ start: dayjs.Dayjs; end: dayjs.Dayjs }[]>(
    buildDefaultPhases()
  );
  const [midtermStart, setMidtermStart] = useState<dayjs.Dayjs | null>(null);
  const [midtermEnd, setMidtermEnd] = useState<dayjs.Dayjs | null>(null);
  const { t, i18n } = useTranslation();
  const [semesterForm] = Form.useForm();
  const [deptForm] = Form.useForm();

  // Fetch data
  const { data: semesters, isLoading: loadingSemesters } = useSemesters();
  const { data: departments, isLoading: loadingDepts } = useDepartments();

  // Mutations
  const createSemesterMutation = useCreateSemester();
  const updateSemesterMutation = useUpdateSemester();
  const deleteSemesterMutation = useDeleteSemester();
  const activateSemesterMutation = useActivateSemester();
  const createDeptMutation = useCreateDepartment();
  const updateDeptMutation = useUpdateDepartment();
  const deleteDeptMutation = useDeleteDepartment();

  /* ====== PHASE DATE HANDLERS ====== */
  const updatePhaseEnd = (index: number, date: dayjs.Dayjs | null) => {
    if (!date) return;
    setPhaseDates((prev) => {
      const next = prev.map((p) => ({ ...p }));
      next[index].end = date;
      // Cascade: all subsequent phase starts = prev.end + 1
      for (let i = index + 1; i < next.length; i++) {
        next[i].start = next[i - 1].end.add(1, 'day');
        if (next[i].end.isBefore(next[i].start)) {
          next[i].end = next[i].start.add(7, 'day');
        }
      }
      return next;
    });
  };

  const updatePhase0Start = (date: dayjs.Dayjs | null) => {
    if (!date) return;
    setPhaseDates((prev) => {
      const next = prev.map((p) => ({ ...p }));
      next[0].start = date;
      if (next[0].end.isBefore(date)) next[0].end = date.add(14, 'day');
      for (let i = 1; i < next.length; i++) {
        next[i].start = next[i - 1].end.add(1, 'day');
        if (next[i].end.isBefore(next[i].start)) {
          next[i].end = next[i].start.add(7, 'day');
        }
      }
      return next;
    });
  };

  const updatePhase5End = (date: dayjs.Dayjs | null) => {
    if (!date) return;
    setPhaseDates((prev) => {
      const next = prev.map((p) => ({ ...p }));
      // Ensure end date is not before phase 5 start
      if (date.isBefore(next[5].start)) {
        message.warning('Ngày kết thúc học kỳ không thể trước ngày bắt đầu giai đoạn Tổng kết');
        return prev;
      }
      next[5].end = date;
      return next;
    });
  };

  /* ====== SEMESTER MODAL HANDLERS ====== */
  const handleCreateSemester = () => {
    setEditingSemester(null);
    setCurrentStep(0);
    setPhaseDates(buildDefaultPhases());
    setMidtermStart(null);
    setMidtermEnd(null);
    semesterForm.resetFields();
    setSemesterModalVisible(true);
  };

  const handleEditSemester = (semester: Semester) => {
    setEditingSemester(semester);
    setCurrentStep(0);
    setPhaseDates(extractPhasesFromSemester(semester));
    setMidtermStart(semester.midterm_start ? dayjs(semester.midterm_start) : null);
    setMidtermEnd(semester.midterm_end ? dayjs(semester.midterm_end) : null);
    semesterForm.setFieldsValue({ name: semester.name, code: semester.code });
    setSemesterModalVisible(true);
  };

  const handleSemesterModalOk = async () => {
    try {
      const values = await semesterForm.validateFields();
      const dto = mapPhasesToDto(values.name, values.code, phaseDates, midtermStart, midtermEnd);

      const onSuccess = () => {
        setSemesterModalVisible(false);
        semesterForm.resetFields();
        setCurrentStep(0);
        setMidtermStart(null);
        setMidtermEnd(null);
      };

      if (editingSemester) {
        updateSemesterMutation.mutate({ id: editingSemester.id, data: dto as any }, { onSuccess });
      } else {
        createSemesterMutation.mutate(dto as any, { onSuccess });
      }
    } catch {
      message.error('Vui lòng kiểm tra lại thông tin.');
    }
  };

  const handleDeleteSemester = (id: string) => {
    Modal.confirm({
      title: t('settings.deleteSemesterConfirmTitle'),
      content: t('settings.deleteSemesterConfirmContent'),
      okText: t('common.delete'),
      cancelText: t('common.cancel'),
      okButtonProps: { danger: true },
      onOk: () => deleteSemesterMutation.mutate(id),
    });
  };

  const handleActivateSemester = (id: string) => {
    Modal.confirm({
      title: t('settings.activateConfirmTitle'),
      content: t('settings.activateConfirmContent'),
      okText: t('common.confirm'),
      cancelText: t('common.cancel'),
      onOk: () => activateSemesterMutation.mutate(id),
    });
  };

  /* ====== DEPARTMENT HANDLERS ====== */
  const handleCreateDept = () => { setEditingDept(null); deptForm.resetFields(); setDeptModalVisible(true); };
  const handleEditDept = (dept: Department) => { setEditingDept(dept); deptForm.setFieldsValue(dept); setDeptModalVisible(true); };
  const handleDeleteDept = (id: string) => {
    Modal.confirm({
      title: t('settings.deleteDeptConfirmTitle'),
      content: t('settings.deleteDeptConfirmContent'),
      okText: t('common.delete'),
      cancelText: t('common.cancel'),
      okButtonProps: { danger: true },
      onOk: () => deleteDeptMutation.mutate(id),
    });
  };
  const handleDeptModalOk = async () => {
    try {
      const values = await deptForm.validateFields();
      const onSuccess = () => { setDeptModalVisible(false); deptForm.resetFields(); };
      if (editingDept) {
        updateDeptMutation.mutate({ id: editingDept.id, data: values }, { onSuccess });
      } else {
        createDeptMutation.mutate(values, { onSuccess });
      }
    } catch { /* noop */ }
  };

  /* ====== TABLE COLUMNS ====== */
  const semesterColumns = [
    { title: t('settings.semesterName'), dataIndex: 'name', key: 'name' },
    { title: 'Mã', dataIndex: 'code', key: 'code' },
    {
      title: t('common.duration'),
      key: 'duration',
      render: (_: any, record: Semester) => (
        <span>
          {new Date(record.start_date).toLocaleDateString(i18n.language === 'vi' ? 'vi-VN' : 'en-US')} –{' '}
          {new Date(record.end_date).toLocaleDateString(i18n.language === 'vi' ? 'vi-VN' : 'en-US')}
        </span>
      ),
    },
    {
      title: t('common.status'),
      dataIndex: 'calculated_phase',
      key: 'calculated_phase',
      render: (phase: any) => <StatusBadge status={phase} />,
    },
    {
      title: 'Thao tác',
      key: 'actions',
      render: (_: any, record: any) => (
        <div className="space-x-2">
          {record.calculated_phase === 'PLANNING' && (
            <Button type="link" size="small" onClick={() => handleActivateSemester(record.id)} loading={activateSemesterMutation.isPending}>
              Bắt đầu Học kỳ
            </Button>
          )}
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEditSemester(record)}>
            {t('common.edit')}
          </Button>
          <Button type="link" danger size="small" icon={<DeleteOutlined />} onClick={() => handleDeleteSemester(record.id)} loading={deleteSemesterMutation.isPending}>
            {t('common.delete')}
          </Button>
        </div>
      ),
    },
  ];

  const deptColumns = [
    { title: t('settings.newDept'), dataIndex: 'name', key: 'name' },
    { title: 'Mã', dataIndex: 'code', key: 'code' },
    { title: t('common.description'), dataIndex: 'description', key: 'description', ellipsis: true },
    {
      title: 'Thao tác',
      key: 'actions',
      render: (_: any, record: Department) => (
        <div className="space-x-2">
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEditDept(record)}>{t('common.edit')}</Button>
          <Button type="link" danger size="small" icon={<DeleteOutlined />} onClick={() => handleDeleteDept(record.id)} loading={deleteDeptMutation.isPending}>{t('common.delete')}</Button>
        </div>
      ),
    },
  ];

  /* ====== Phase summary UI ================================================ */
  const totalDays = phaseDates[SEMESTER_PHASES.length - 1].end.diff(phaseDates[0].start, 'day') + 1;
  const currentPhase = SEMESTER_PHASES[currentStep];
  const phase = phaseDates[currentStep];

  /* ====== RENDER ============================================================ */
  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-foreground">{t('settings.title')}</h1>
        <p className="text-muted-foreground">{t('settings.subtitle')}</p>
      </div>

      <Card className="shadow-soft">
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          tabBarExtraContent={
            activeTab === 'semesters' ? (
              <Button type="primary" icon={<PlusOutlined />} onClick={handleCreateSemester}>
                {t('settings.addSemester')}
              </Button>
            ) : (
              <Button type="primary" icon={<PlusOutlined />} onClick={handleCreateDept}>
                {t('settings.addDept')}
              </Button>
            )
          }
        >
          <TabPane tab={t('settings.semesters')} key="semesters">
            <Spin spinning={loadingSemesters}>
              <Table
                columns={semesterColumns}
                dataSource={semesters || []}
                rowKey="id"
                pagination={{ pageSize: 10, showTotal: (total) => t('settings.totalSemesters', { total }) }}
                locale={{ emptyText: t('settings.noSemesters') }}
              />
            </Spin>
          </TabPane>
          <TabPane tab={t('settings.departments')} key="departments">
            <Spin spinning={loadingDepts}>
              <Table
                columns={deptColumns}
                dataSource={departments || []}
                rowKey="id"
                pagination={{ pageSize: 10, showTotal: (total) => t('settings.totalDepts', { total }) }}
                locale={{ emptyText: t('settings.noDepts') }}
              />
            </Spin>
          </TabPane>
        </Tabs>
      </Card>

      {/* ── Semester Modal (Phase-based Timeline) ─────────────────────────── */}
      <Modal
        title={
          <div className="flex items-center gap-3 py-1">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white">
              <CalendarOutlined />
            </div>
            <span className="text-lg font-bold">
              {editingSemester ? 'Chỉnh sửa Học kỳ' : 'Tạo Học kỳ mới'}
            </span>
          </div>
        }
        open={semesterModalVisible}
        onCancel={() => { setSemesterModalVisible(false); setCurrentStep(0); }}
        width={1000}
        centered
        styles={{
          body: {
            maxHeight: 'calc(100vh - 220px)',
            overflowY: 'auto',
            overflowX: 'hidden',
            paddingRight: 4,
          },
        }}
        footer={
          <div className="flex items-center justify-between pt-2">
            <div className="text-sm text-gray-400">
              Bước <b>{currentStep + 1}</b> / {SEMESTER_PHASES.length}
            </div>
            <div className="flex gap-2">
              <Button
                icon={<LeftOutlined />}
                onClick={() => setCurrentStep((s) => s - 1)}
                disabled={currentStep === 0}
              >
                Quay lại
              </Button>
              {currentStep < SEMESTER_PHASES.length - 1 ? (
                <Button type="primary" onClick={() => setCurrentStep((s) => s + 1)}>
                  Tiếp theo <RightOutlined />
                </Button>
              ) : (
                <Button
                  type="primary"
                  icon={<CheckCircleOutlined />}
                  onClick={handleSemesterModalOk}
                  loading={createSemesterMutation.isPending || updateSemesterMutation.isPending}
                  style={{ background: '#16a34a', borderColor: '#16a34a' }}
                >
                  {editingSemester ? 'Lưu thay đổi' : 'Tạo học kỳ'}
                </Button>
              )}
            </div>
          </div>
        }
      >
        <Form form={semesterForm} layout="vertical">
          {/* ── Info header ── */}
          <div
            className="grid grid-cols-2 gap-x-4 gap-y-3 p-4 rounded-2xl mb-5"
            style={{ background: '#f0f9ff', border: '1px solid #bae6fd' }}
          >
            <Form.Item
              label={<span className="font-semibold text-sky-700 text-xs">Tên học kỳ</span>}
              name="name"
              rules={[{ required: true, message: 'Nhập tên học kỳ' }]}
              className="mb-0"
            >
              <Input placeholder="Học kỳ 2 – 2024-2025" className="rounded-lg shadow-sm border-sky-100" />
            </Form.Item>
            <Form.Item
              label={<span className="font-semibold text-sky-700 text-xs">Mã học kỳ</span>}
              name="code"
              rules={[{ required: true, message: 'Nhập mã học kỳ' }]}
              className="mb-0"
            >
              <Input placeholder="HK2-2425" className="rounded-lg shadow-sm border-sky-100" />
            </Form.Item>

            <div className="space-y-1">
              <label className="block text-xs font-semibold text-sky-700">Ngày bắt đầu học kỳ</label>
              <DatePicker
                value={phaseDates[0].start}
                onChange={updatePhase0Start}
                format="DD/MM/YYYY"
                allowClear={false}
                className="w-full rounded-lg shadow-sm border-sky-100"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-semibold text-sky-700">Ngày kết thúc học kỳ</label>
              <DatePicker
                value={phaseDates[5].end}
                onChange={updatePhase5End}
                format="DD/MM/YYYY"
                allowClear={false}
                className="w-full rounded-lg shadow-sm border-sky-100"
              />
            </div>
          </div>

          {/* ── Steps progress bar ── */}
          <Steps
            current={currentStep}
            onChange={setCurrentStep}
            size="small"
            labelPlacement="vertical"
            className="mb-6"
            items={SEMESTER_PHASES.map((p, idx) => ({
              title: <span className="text-sm">{p.label}</span>,
              status: idx < currentStep ? 'finish' : idx === currentStep ? 'process' : 'wait',
            }))}
          />

          {/* ── Current phase card ── */}
          <div
            className="rounded-2xl p-5 transition-all duration-300"
            style={{ background: currentPhase.bg, border: `2px solid ${currentPhase.color}22` }}
          >
            <div className="flex items-start gap-4">
              {/* Phase number badge */}
              <div
                className="w-14 h-14 rounded-2xl flex flex-col items-center justify-center font-bold text-white flex-shrink-0 shadow-lg"
                style={{ background: currentPhase.color }}
              >
                <span className="text-xl leading-none">{currentStep + 1}</span>
                <span className="text-[9px] opacity-80 leading-none mt-0.5">/{SEMESTER_PHASES.length}</span>
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <h3 className="text-lg font-bold text-gray-800 m-0">{currentPhase.label}</h3>
                  <Tag
                    className="rounded-full border-none text-xs font-medium px-2"
                    style={{ background: currentPhase.color + '22', color: currentPhase.color }}
                  >
                    {currentPhase.sublabel}
                  </Tag>
                </div>
                <p className="text-gray-500 text-sm mb-5">{currentPhase.description}</p>

                {/* Date pickers */}
                <div className="grid grid-cols-2 gap-4">
                  {/* Start date */}
                  <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">
                      Ngày bắt đầu
                    </label>
                    <div
                      className="flex items-center gap-2 rounded-xl px-3 py-2.5"
                      style={{
                        background: currentStep === 0 ? '#fff' : '#f8fafc',
                        border: `1.5px solid ${currentStep === 0 ? currentPhase.color : '#e2e8f0'}`,
                      }}
                    >
                      <CalendarOutlined style={{ color: currentStep === 0 ? currentPhase.color : '#94a3b8' }} />
                      {currentStep === 0 ? (
                        <DatePicker
                          value={phase.start}
                          onChange={updatePhase0Start}
                          format="DD/MM/YYYY"
                          allowClear={false}
                          className="border-none p-0 w-full shadow-none bg-transparent"
                          style={{ background: 'transparent' }}
                        />
                      ) : (
                        <span className="font-semibold" style={{ color: currentPhase.color }}>
                          {phase.start.format('DD/MM/YYYY')}
                        </span>
                      )}
                    </div>
                    {currentStep > 0 && (
                      <p className="text-[11px] text-gray-400 mt-1.5 italic">
                        ↳ Tự động từ kết thúc giai đoạn trước
                      </p>
                    )}
                  </div>

                  {/* End date */}
                  <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">
                      Ngày kết thúc <span className="text-red-400">*</span>
                    </label>
                    <div
                      className="flex items-center gap-2 rounded-xl px-3 py-2.5"
                      style={{ background: '#fff', border: `2px solid ${currentPhase.color}` }}
                    >
                      <CalendarOutlined style={{ color: currentPhase.color }} />
                      <DatePicker
                        value={phase.end}
                        onChange={(d) => updatePhaseEnd(currentStep, d)}
                        format="DD/MM/YYYY"
                        allowClear={false}
                        disabledDate={(d) => d.isBefore(phase.start)}
                        className="border-none p-0 w-full shadow-none bg-transparent"
                        style={{ background: 'transparent' }}
                      />
                    </div>
                    <p className="text-[11px] text-gray-400 mt-1.5">
                      ⏱ {phase.end.diff(phase.start, 'day') + 1} ngày
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ── Timeline summary footer ── */}
          <div className="mt-4 flex items-center justify-between p-3.5 bg-slate-50 rounded-xl border-l-4 border-blue-400">
            <div className="flex items-center gap-2 text-slate-600 text-sm">
              <InfoCircleOutlined className="text-blue-400" />
              <span>
                Kết thúc giai đoạn này → Bắt đầu giai đoạn tiếp theo (tự động)
              </span>
            </div>
            <div className="text-right flex-shrink-0 ml-4">
              <p className="text-[10px] text-gray-400 uppercase font-bold tracking-widest mb-0.5">Tổng học kỳ</p>
              <Tag color="blue" className="text-base font-bold px-3 py-0.5 rounded-full border-none">
                {totalDays} ngày
              </Tag>
            </div>
          </div>

          {/* ── Khoảng thời gian Chấm giữa kỳ (chỉ hiện khi ở step WORK) ── */}
          {currentStep === 2 && (
            <div
              className="mt-4 rounded-2xl p-5"
              style={{ background: '#fffbeb', border: '2px solid #f59e0b44' }}
            >
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center text-amber-600" style={{ background: '#fef3c7' }}>
                  📍
                </div>
                <div>
                  <p className="font-bold text-amber-700 text-sm m-0">Khoảng thời gian Chấm giữa kỳ</p>
                  <p className="text-amber-600/70 text-xs m-0">Phải nằm trong giai đoạn Thực hiện khóa luận</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Ngày bắt đầu chấm giữa kỳ */}
                <div>
                  <label className="block text-xs font-bold text-amber-600 uppercase tracking-widest mb-2">
                    Từ ngày <span className="text-red-400">*</span>
                  </label>
                  <DatePicker
                    value={midtermStart}
                    onChange={(d) => {
                      setMidtermStart(d);
                      // Nếu end trước start thì xóa end
                      if (d && midtermEnd && midtermEnd.isBefore(d, 'day')) setMidtermEnd(null);
                    }}
                    format="DD/MM/YYYY"
                    allowClear
                    placeholder="Bắt đầu chấm giữa kỳ"
                    className="w-full h-10 rounded-xl"
                    style={{ borderColor: '#f59e0b' }}
                    disabledDate={(d) =>
                      d.isBefore(phaseDates[2].start, 'day') || d.isAfter(phaseDates[2].end, 'day')
                    }
                  />
                </div>

                {/* Ngày kết thúc chấm giữa kỳ */}
                <div>
                  <label className="block text-xs font-bold text-amber-600 uppercase tracking-widest mb-2">
                    Đến ngày <span className="text-red-400">*</span>
                  </label>
                  <DatePicker
                    value={midtermEnd}
                    onChange={setMidtermEnd}
                    format="DD/MM/YYYY"
                    allowClear
                    placeholder="Kết thúc chấm giữa kỳ"
                    className="w-full h-10 rounded-xl"
                    style={{ borderColor: '#f59e0b' }}
                    disabledDate={(d) => {
                      const rangeStart = midtermStart ?? phaseDates[2].start;
                      return d.isBefore(rangeStart, 'day') || d.isAfter(phaseDates[2].end, 'day');
                    }}
                    disabled={!midtermStart}
                  />
                </div>
              </div>

              {midtermStart && midtermEnd && (
                <p className="text-xs text-amber-700 mt-3 italic bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5">
                  ✓ Chấm giữa kỳ: <b>{midtermStart.format('DD/MM/YYYY')}</b> → <b>{midtermEnd.format('DD/MM/YYYY')}</b>
                  {' '}({midtermEnd.diff(midtermStart, 'day') + 1} ngày)
                </p>
              )}
            </div>
          )}

          {/* Proposal note for REVIEWING phase */}
          {currentStep === 3 && (
            <div
              className="mt-4 rounded-2xl p-4"
              style={{ background: '#fef2f2', border: '1px solid #fecaca' }}
            >
              <p className="text-sm text-red-600 m-0">
                <b>Hạn nộp báo cáo cuối</b> = Ngày kết thúc giai đoạn này (<b>{phaseDates[3].end.format('DD/MM/YYYY')}</b>).
              </p>
            </div>
          )}
        </Form>
      </Modal>

      {/* ── Department Modal ─────────────────────────────────────────────── */}
      <Modal
        title={editingDept ? t('settings.editDept') : t('settings.newDept')}
        open={deptModalVisible}
        onOk={handleDeptModalOk}
        onCancel={() => setDeptModalVisible(false)}
        confirmLoading={createDeptMutation.isPending || updateDeptMutation.isPending}
        width={600}
        okText={editingDept ? t('common.update') : t('common.create')}
        cancelText={t('common.cancel')}
      >
        <Form form={deptForm} layout="vertical" className="mt-4">
          <Form.Item label={t('settings.newDept')} name="name" rules={[{ required: true, message: t('settings.deptNameRequired') }]}>
            <Input placeholder={t('settings.enterDeptName')} />
          </Form.Item>
          <Form.Item label={t('common.code')} name="code" rules={[{ required: true, message: t('validation.required') }]}>
            <Input placeholder={t('settings.enterDeptCode')} />
          </Form.Item>
          <Form.Item label={t('common.description')} name="description">
            <Input.TextArea rows={3} placeholder={t('settings.enterDeptDescription')} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default AdminSettings;