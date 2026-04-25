import { useState } from 'react';
import { Card, Tabs, Table, Button, Modal, Form, Input, Tag, Spin, Steps, DatePicker, Alert } from 'antd';
import { notify } from '@/utils/notification';
import { PlusOutlined, EditOutlined, DeleteOutlined, CalendarOutlined, InfoCircleOutlined, RightOutlined, LeftOutlined, CheckCircleOutlined, SettingOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useTranslation } from 'react-i18next';
import { useSemesters, useCreateSemester, useUpdateSemester, useDeleteSemester, useActivateSemester, useFinalizeSemester } from '@/hooks/useSemesters';
import { useDepartments, useCreateDepartment, useUpdateDepartment, useDeleteDepartment } from '@/hooks/useDepartments';
import type { Semester, Department, SemesterStatus, SemesterPhase } from '@/types';
import { StatusBadge } from '@/components/StatusBadge';

const { TabPane } = Tabs;

// ─── Phase configuration (6 phases) ─────────────────────────────────────────
const SEMESTER_PHASES = [
  {
    key: 'preview',
    label: 'Đề xuất & Công bố đề tài',
    sublabel: 'GV đề xuất & HOD duyệt',
    description: 'Giảng viên đề xuất đề tài, HOD thực hiện duyệt và sinh viên xem trước danh sách.',
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

// ─── Helper to compute auto-fill phases ─────────────────────────
const computeAutoFillPhases = (startFrom: dayjs.Dayjs, endAt: dayjs.Dayjs) => {
  const totalDays = endAt.diff(startFrom, 'day');
  if (totalDays <= 0) return Array.from({ length: 6 }, () => ({ start: startFrom, end: endAt }));

  const previewDays = Math.floor(totalDays * 0.05);
  const registrationDays = Math.floor(totalDays * 0.15);
  const reviewDays = Math.floor(totalDays * 0.15);
  const defenseDays = Math.floor(totalDays * 0.10);
  const workDays = totalDays - previewDays - registrationDays - reviewDays - defenseDays;

  const phases = [];
  let currentStart = startFrom.startOf('day');

  // [0] PREVIEW
  let currentEnd = currentStart.add(Math.max(0, previewDays - 1), 'day');
  phases.push({ start: currentStart, end: currentEnd });
  currentStart = currentEnd.add(1, 'day');

  // [1] REGISTRATION
  currentEnd = currentStart.add(Math.max(0, registrationDays - 1), 'day');
  phases.push({ start: currentStart, end: currentEnd });
  currentStart = currentEnd.add(1, 'day');

  // [2] WORK
  currentEnd = currentStart.add(Math.max(0, workDays - 1), 'day');
  phases.push({ start: currentStart, end: currentEnd });
  currentStart = currentEnd.add(1, 'day');

  // [3] REVIEWING
  currentEnd = currentStart.add(Math.max(0, reviewDays - 1), 'day');
  phases.push({ start: currentStart, end: currentEnd });
  currentStart = currentEnd.add(1, 'day');

  // [4] DEFENSE
  currentEnd = endAt.startOf('day');
  phases.push({ start: currentStart, end: currentEnd });

  // [5] FINAL
  phases.push({ start: endAt.startOf('day'), end: endAt.startOf('day') });

  return phases;
};

// ─── Helper to extract phases from existing semester ──────────────
const extractPhasesFromSemester = (sem: Semester) => {
  const s = (d: string | Date | null | undefined) => (d ? dayjs(d) : dayjs());
  return [
    { start: s(sem.topic_viewing_start), end: s(sem.topic_viewing_end) },
    { start: s(sem.topic_registration_start), end: s(sem.topic_registration_end) },
    { start: s(sem.topic_registration_end), end: s(sem.proposal_deadline) },
    { start: s(sem.proposal_deadline), end: s(sem.thesis_deadline) },
    { start: s(sem.defense_start), end: s(sem.defense_end) },
    { start: s(sem.end_date), end: s(sem.end_date) },
  ];
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
  end_date: phases[4].end.toISOString(),
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
  const [timelineInitialized, setTimelineInitialized] = useState(false);
  const [isTimelineAuto, setIsTimelineAuto] = useState<boolean>(true);
  const [semesterDates, setSemesterDates] = useState<[dayjs.Dayjs | null, dayjs.Dayjs | null]>([null, null]);
  const [phaseDates, setPhaseDates] = useState<{ start: dayjs.Dayjs; end: dayjs.Dayjs }[]>([]);
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
  const activateSemesterMutation = useActivateSemester();
  const finalizeSemesterMutation = useFinalizeSemester();
  const createDeptMutation = useCreateDepartment();
  const updateDeptMutation = useUpdateDepartment();
  const deleteDeptMutation = useDeleteDepartment();

  /* ====== TIMELINE HANDLERS ====== */
  const handleAutoFill = (start = semesterDates[0], end = semesterDates[1], silent = false) => {
    if (!start || !end) return;
    const computed = computeAutoFillPhases(start, end);
    setPhaseDates(computed);
    setTimelineInitialized(true);
    setIsTimelineAuto(true);

    // Auto suggest midterm in the middle of WORK phase
    const workPhase = computed[2];
    const halfDays = Math.floor(workPhase.end.diff(workPhase.start, 'day') / 2);
    const middle = workPhase.start.add(halfDays, 'day');
    setMidtermStart(middle);
    setMidtermEnd(middle.add(3, 'day'));
    if (!silent) notify.success('Đã tự động tính toán và điền dòng thời gian!');
  };

  const handleGlobalDateChange = (newStart: dayjs.Dayjs | null, newEnd: dayjs.Dayjs | null) => {
    setSemesterDates([newStart, newEnd]);

    if (newStart && newEnd) {
      if (!timelineInitialized) {
        // Lần đầu chọn thì auto-fill luôn cực mượt, không notification khó chịu
        handleAutoFill(newStart, newEnd, true);
      } else if (!isTimelineAuto) {
        // Đã khởi tạo và BỊ chỉnh tay (isTimelineAuto = false) -> hỏi ý kiến
        Modal.confirm({
          title: 'Timeline đã bị chỉnh sửa',
          content: 'Bạn có muốn làm mới lại (Tái tạo tự động) các mốc thời gian bên dưới theo ngày Khai/Bế giảng mới không?',
          okText: 'Tái tạo tự động',
          cancelText: 'Giữ nguyên chỉnh sửa',
          onOk: () => handleAutoFill(newStart, newEnd, false)
        });
      } else {
        // Đã khởi tạo nhưng CHƯA rớ tay vào sửa phase (isTimelineAuto = true) -> mượt mà overwrite
        handleAutoFill(newStart, newEnd, true);
      }
    }
  };

  const updatePhase = (index: number, field: 'start' | 'end', date: dayjs.Dayjs | null) => {
    if (!date) return;
    setIsTimelineAuto(false); // Cập nhật cờ khi user sờ tay vào
    setPhaseDates((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: date };

      // Khóa điểm giáp ranh (Chaining) để đồng bộ Backend. Nếu sửa Đầu của 1 Phase, thì Đuôi của Phase trước đó cũng phải chạy theo, và ngược lại.
      if (field === 'end' && index < 4 && next[index + 1]) {
        // Đảm bảo không vượt quá Ngày Bế giảng học kỳ
        const maxDate = semesterDates[1] || date;
        let newNextStart = date; // Thay vì +1 ngày cứng nhắc, ta cho phép trùng ngày để linh hoạt cho học kỳ ngắn
        if (newNextStart.isAfter(maxDate)) newNextStart = maxDate;

        next[index + 1] = { ...next[index + 1], start: newNextStart };

        // Cấp cứu: Nếu start mới lỡ "vượt mặt" end cũ của chính phase đó
        if (next[index + 1].start.isAfter(next[index + 1].end)) {
          next[index + 1].end = next[index + 1].start;
        }
      }
      if (field === 'start' && index > 0 && next[index - 1]) {
        const minDate = semesterDates[0] || date;
        let newPrevEnd = date;
        if (newPrevEnd.isBefore(minDate)) newPrevEnd = minDate;

        next[index - 1] = { ...next[index - 1], end: newPrevEnd };

        // Cấp cứu: Nếu end mới lỡ "thụt lùi" sau start cũ của chính phase đó
        if (next[index - 1].end.isBefore(next[index - 1].start)) {
          next[index - 1].start = next[index - 1].end;
        }
      }

      // Tự động neo lại điểm Midterm nếu Admin thay đổi thời gian của phase WORK (index 2)
      if (index === 2) {
        const workStart = field === 'start' ? date : next[2].start;
        const workEnd = field === 'end' ? date : next[2].end;
        if (workStart && workEnd) {
          const halfDays = Math.floor(workEnd.diff(workStart, 'day') / 2);
          const middle = workStart.add(halfDays, 'day');
          setMidtermStart(middle);
          setMidtermEnd(middle.add(3, 'day'));
        }
      }
      return next;
    });
  };

  /* ====== SEMESTER MODAL HANDLERS ====== */
  const handleCreateSemester = () => {
    setEditingSemester(null);

    setTimelineInitialized(false);
    setIsTimelineAuto(true);
    setSemesterDates([null, null]);
    setPhaseDates([]);
    setMidtermStart(null);
    setMidtermEnd(null);
    semesterForm.resetFields();
    setSemesterModalVisible(true);
  };

  const handleEditSemester = (semester: Semester) => {
    setEditingSemester(semester);

    setTimelineInitialized(true);
    setIsTimelineAuto(false); // Mở Modal Edit lên thì coi như đã bị chỉnh tay
    setSemesterDates([dayjs(semester.start_date), dayjs(semester.end_date)]);
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

        setSemesterDates([null, null]);
        setIsTimelineAuto(true);
        setTimelineInitialized(false);
        setPhaseDates([]);
        setMidtermStart(null);
        setMidtermEnd(null);
      };

      const onError = (error: any) => {
        const errorMsg = error.response?.data?.error || error.response?.data?.message || 'Có lỗi xảy ra, vui lòng thử lại sau.';
        notify.error({
          message: editingSemester ? 'Cập nhật thất bại' : 'Tạo học kỳ thất bại',
          description: errorMsg,
        });
      };

      if (editingSemester) {
        updateSemesterMutation.mutate({ id: editingSemester.id, data: dto as unknown as Partial<Semester> }, { onSuccess, onError });
      } else {
        createSemesterMutation.mutate(dto as unknown as Omit<Semester, "id">, { onSuccess, onError });
      }
    } catch {
      notify.error('Vui lòng nhập đầy đủ các trường bắt buộc trên Form.');
    }
  };



  const handleActivateSemester = (id: string) => {
    activateSemesterMutation.mutate(id, {
      onSuccess: () => {
        notify.success('Đã kích hoạt học kỳ thành công!');
      },
      onError: (error: any) => {
        notify.error(error?.response?.data?.error || 'Kích hoạt thất bại');
      }
    });
  };

  const handleDeactivateSectorPlaceholder = () => { }; // keep structure if needed

  const handleFinalizeSemester = (id: string) => {
    Modal.confirm({
      title: 'Xác nhận Tổng kết Học kỳ',
      content: 'Hệ thống sẽ khóa toàn bộ dữ liệu của học kỳ này và chuyển sang trạng thái Lưu trữ (COMPLETED). Bạn có chắc chắn muốn kết thúc học kỳ không?',
      okText: 'Xác nhận tổng kết',
      cancelText: 'Hủy',
      okButtonProps: { type: 'primary', danger: true },
      onOk: () => finalizeSemesterMutation.mutate(id),
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
      render: (_: unknown, record: Semester) => (
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
      render: (phase: SemesterStatus | SemesterPhase | "DRAFT") => <StatusBadge type="semester" status={phase} />,
    },
    {
      title: 'Thao tác',
      key: 'actions',
      render: (_: unknown, record: Semester) => (
        <div className="space-x-2">
          {record.status === 'PLANNING' && (
            <Button type="link" size="small" onClick={() => handleActivateSemester(record.id)} loading={activateSemesterMutation.isPending}>
              Bắt đầu Học kỳ
            </Button>
          )}
          {record.status === 'ACTIVE' && (
            <Button type="link" size="small" danger onClick={() => handleFinalizeSemester(record.id)} loading={finalizeSemesterMutation.isPending}>
              Tổng kết Học kỳ
            </Button>
          )}
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEditSemester(record)}>
            {t('common.edit')}
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
      render: (_: unknown, record: Department) => (
        <div className="space-x-2">
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEditDept(record)}>{t('common.edit')}</Button>
          <Button type="link" danger size="small" icon={<DeleteOutlined />} onClick={() => handleDeleteDept(record.id)} loading={deleteDeptMutation.isPending}>{t('common.delete')}</Button>
        </div>
      ),
    },
  ];

  /* ====== Phase summary UI ================================================ */

  /* ====== RENDER ============================================================ */
    return (
        <div className="page-container">
            <div className="page-inner">
                {/* Header */}
                <Card className="page-header-card">
                    <div className="flex justify-between items-center">
                        <div className="flex items-center gap-3">
                            <div className="page-header-icon"><SettingOutlined className="text-base" /></div>
                            <div>
                                <div className="page-header-title">{t('settings.title')}</div>
                                <div className="page-header-subtitle">{t('settings.subtitle')}</div>
                            </div>
                        </div>
                    </div>
                </Card>

                <Card className="page-card-flush">
                    <Tabs
                        activeKey={activeTab}
                        onChange={setActiveTab}
                        className="sys-tabs"
                        tabBarExtraContent={
                            <div className="px-6 py-2">
                                {activeTab === 'semesters' ? (
                                    <Button type="primary" icon={<PlusOutlined />} onClick={handleCreateSemester}>
                                        {t('settings.addSemester')}
                                    </Button>
                                ) : (
                                    <Button type="primary" icon={<PlusOutlined />} onClick={handleCreateDept}>
                                        {t('settings.addDept')}
                                    </Button>
                                )}
                            </div>
                        }
                    >
                        <TabPane tab={t('settings.semesters')} key="semesters">
                            <Spin spinning={loadingSemesters}>
                                <Table
                                    columns={semesterColumns}
                                    dataSource={semesters || []}
                                    rowKey="id"
                                    className="sys-table"
                                    pagination={{ pageSize: 10, className: 'px-6 py-4' }}
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
                                    className="sys-table"
                                    pagination={{ pageSize: 10, className: 'px-6 py-4' }}
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
        onCancel={() => { setSemesterModalVisible(false); }}
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
          <div className="flex items-center justify-end gap-2 pt-2">
            <Button onClick={() => setSemesterModalVisible(false)}>
              Hủy
            </Button>
            <Button
              type="primary"
              icon={<CheckCircleOutlined />}
              onClick={handleSemesterModalOk}
              loading={createSemesterMutation.isPending || updateSemesterMutation.isPending}
              style={{ background: '#16a34a', borderColor: '#16a34a' }}
              disabled={!semesterDates[0] || !semesterDates[1]}
            >
              {editingSemester ? 'Lưu thay đổi' : 'Tạo học kỳ'}
            </Button>
          </div>
        }
      >
        <Form form={semesterForm} layout="vertical" className="space-y-6">

          {/* Block 1: Basic Info */}
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Form.Item
                label={<span className="font-semibold text-slate-700">Tên học kỳ</span>}
                name="name"
                rules={[{ required: true, message: 'Nhập tên học kỳ' }]}
                className="mb-0"
              >
                <Input placeholder="Học kỳ 2 – 2024-2025" size="large" className="rounded-lg shadow-sm" />
              </Form.Item>
              <Form.Item
                label={<span className="font-semibold text-slate-700">Mã học kỳ</span>}
                name="code"
                rules={[{ required: true, message: 'Nhập mã học kỳ' }]}
                className="mb-0"
              >
                <Input placeholder="HK2-2425" size="large" className="rounded-lg shadow-sm" />
              </Form.Item>
            </div>

            <div className="p-5 rounded-2xl bg-blue-50 border border-blue-100 flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-blue-900 m-0 flex items-center gap-2">
                  <CalendarOutlined /> Thời gian Học kỳ (Global Semester)
                </h3>
                {semesterDates[0] && semesterDates[1] && (
                  <Tag color="blue" className="rounded-full border-none px-3 font-semibold text-sm">
                    ⏱ Tổng thời gian: {semesterDates[1].diff(semesterDates[0], 'day') + 1} ngày
                  </Tag>
                )}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-blue-700 mb-1.5">Ngày Khai Giảng</label>
                  <DatePicker
                    value={semesterDates[0]}
                    onChange={(d) => handleGlobalDateChange(d, semesterDates[1])}
                    format="DD/MM/YYYY"
                    size="large"
                    className="w-full rounded-lg shadow-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-blue-700 mb-1.5">Ngày Bế Giảng (Dự kiến)</label>
                  <DatePicker
                    value={semesterDates[1]}
                    onChange={(d) => handleGlobalDateChange(semesterDates[0], d)}
                    format="DD/MM/YYYY"
                    size="large"
                    className="w-full rounded-lg shadow-sm"
                    disabledDate={(d) => semesterDates[0] ? d.isBefore(semesterDates[0]) : false}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Visual Timeline Bar */}
          {semesterDates[0] && semesterDates[1] && phaseDates.length >= 5 && (
            <div className="pt-2">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Phân bổ giai đoạn (Visual Overview)</span>
                <Tag color="cyan" className="m-0 border-none rounded-full px-2 text-[9px] font-bold uppercase">Gantt View</Tag>
              </div>
              <div className="h-6 w-full bg-slate-100 rounded-full flex overflow-hidden border border-slate-200 shadow-sm relative group">
                {SEMESTER_PHASES.slice(0, 5).map((phase, idx) => {
                  const total = semesterDates[1]!.diff(semesterDates[0]!, 'day') + 1;
                  const phaseDuration = phaseDates[idx].end.diff(phaseDates[idx].start, 'day') + 1;
                  const width = ((phaseDuration / total) * 100).toFixed(1);

                  return (
                    <div
                      key={phase.key}
                      className="h-full relative transition-all duration-500 hover:brightness-95 flex items-center justify-center overflow-hidden"
                      style={{
                        width: `${width}%`,
                        backgroundColor: phase.color,
                        borderRight: idx < 4 ? '1px solid rgba(255,255,255,0.3)' : 'none'
                      }}
                      title={`${phase.label}: ${phaseDuration} ngày (${width}%)`}
                    >
                      <span className="text-[9px] text-white font-bold opacity-0 group-hover:opacity-100 truncate px-1">
                        {width}%
                      </span>
                    </div>
                  );
                })}

                {/* Midterm Marker Overlay */}
                {midtermStart && midtermEnd && (
                  <div
                    className="absolute top-0 h-full border-x-2 border-dashed border-white/50 bg-amber-400/30 flex items-center justify-center"
                    style={{
                      left: `${((midtermStart.diff(semesterDates[0], 'day') / (semesterDates[1]!.diff(semesterDates[0], 'day') + 1)) * 100)}%`,
                      width: `${(((midtermEnd.diff(midtermStart, 'day') + 1) / (semesterDates[1]!.diff(semesterDates[0], 'day') + 1)) * 100)}%`
                    }}
                    title="Giai đoạn Midterm"
                  >
                    <div className="text-[10px]">📍</div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Block 2: Timeline phases */}
          {semesterDates[0] && semesterDates[1] && (
            <div className="space-y-4 pt-4 border-t border-dashed border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-slate-800 m-0 flex items-center gap-2">
                  <span className="text-xl">⚡</span> Timeline (tự động – có thể chỉnh)
                </h3>
                <Button size="small" onClick={() => handleAutoFill()} icon={<span className="text-sm">🔄</span>}>
                  Tái tạo timeline
                </Button>
              </div>

              <div className="bg-slate-50/50 rounded-2xl p-4 border border-slate-200 space-y-3 shadow-inner">
                {SEMESTER_PHASES.slice(0, 5).map((phase, idx) => (
                  <div key={phase.key} className="flex items-center gap-4 p-3 rounded-xl border border-gray-100 bg-white shadow-sm transition-all hover:border-blue-200">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-white shrink-0 font-bold shadow-sm" style={{ background: phase.color }}>
                      {idx + 1}
                    </div>
                    <div className="w-1/3">
                      <h4 className="font-bold text-gray-800 m-0 text-sm">{phase.label}</h4>
                      <span className="text-[10px] text-gray-400 font-medium">{phase.sublabel}</span>
                    </div>
                    <div className="flex-1 flex items-center gap-3">
                      <DatePicker
                        className="flex-1 border-slate-200 hover:border-blue-400 focus:border-blue-400"
                        value={phaseDates[idx]?.start}
                        onChange={(d) => updatePhase(idx, 'start', d)}
                        format="DD/MM/YYYY"
                        allowClear={false}
                      />
                      <span className="text-gray-400 font-bold">→</span>
                      <DatePicker
                        className="flex-1 border-slate-200 hover:border-blue-400 focus:border-blue-400"
                        value={phaseDates[idx]?.end}
                        onChange={(d) => updatePhase(idx, 'end', d)}
                        format="DD/MM/YYYY"
                        allowClear={false}
                      />
                    </div>
                  </div>
                ))}

                {/* Block 3: Midterm */}
                <div className="mt-5 rounded-xl p-4 bg-[#fffdf0] border border-amber-200 shadow-sm relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-1 h-full bg-amber-400"></div>
                  <div className="flex items-start gap-4">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-amber-500 shrink-0 font-bold bg-amber-100">
                      📍
                    </div>
                    <div className="flex-1">
                      <p className="font-bold text-amber-900 text-sm m-0">Chấm giữa kỳ (Midterm)</p>
                      <p className="text-amber-700/70 text-[11px] m-0 mb-3">Tự động gợi ý nằm trong vùng Thực hiện khóa luận</p>
                      <div className="flex items-center gap-3">
                        <DatePicker size="small" className="w-32 border-amber-200" value={midtermStart} onChange={(d) => { setIsTimelineAuto(false); setMidtermStart(d); }} format="DD/MM/YYYY" />
                        <span className="text-amber-400 font-bold">→</span>
                        <DatePicker size="small" className="w-32 border-amber-200" value={midtermEnd} onChange={(d) => { setIsTimelineAuto(false); setMidtermEnd(d); }} format="DD/MM/YYYY" />
                      </div>
                    </div>
                  </div>
                </div>

              </div>
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
        </div>
    );
};

export default AdminSettings;