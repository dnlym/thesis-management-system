import { useState, useEffect } from 'react';
import {
    Card, DatePicker, Button, Alert, Space, Typography, Tag, Divider,
    Spin, Steps, Tooltip, Badge, Modal, Form, Input, Table, Empty, Checkbox, Select
} from 'antd';
import { notify } from '@/utils/notification';
import {
    CalendarOutlined,
    InfoCircleOutlined,
    SaveOutlined,
    RocketOutlined,
    CheckCircleOutlined,
    ClockCircleOutlined,
    EditOutlined,
    UsergroupAddOutlined,
    FileSearchOutlined,
    SafetyCertificateOutlined,
    LockOutlined,
    UnlockOutlined,
    UndoOutlined,
    HistoryOutlined,
    FileProtectOutlined,
    ThunderboltOutlined,
    SettingOutlined,
    EyeOutlined,
    ExclamationCircleOutlined
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Flame } from 'lucide-react';
import { useAuthStore } from '@/store/auth';
import { DepartmentsApi } from '@/api/departments';
import { SemestersApi } from '@/api/semesters';
import { useActiveSemester } from '@/hooks/useActiveSemester';
import dayjs from 'dayjs';
import { SemesterPhase, UserRole } from '@/types';


const { Title, Text } = Typography;

const PHASE_CONFIG: Record<string, { label: string; sublabel: string; icon: any; color: string; description: string; }> = {
    PREVIEW: {
        label: 'Đề xuất & Công bố đề tài',
        sublabel: 'GV đề xuất & HOD duyệt',
        icon: <EyeOutlined />,
        color: 'purple',
        description: 'Giảng viên đề xuất đề tài, HOD thực hiện duyệt và sinh viên xem trước danh sách.'
    },
    REGISTRATION: {
        label: 'Đăng ký Đề tài',
        sublabel: 'Thành lập nhóm',
        icon: <UsergroupAddOutlined />,
        color: 'cyan',
        description: 'Sinh viên thực hiện đăng ký đề tài và thành lập nhóm.'
    },
    WORK: {
        label: 'Thực hiện Khóa luận',
        sublabel: 'Làm + Giữa kỳ',
        icon: <ClockCircleOutlined />,
        color: 'processing',
        description: 'Sinh viên thực hiện khóa luận, nộp báo cáo tiến độ.'
    },
    REVIEWING: {
        label: 'Phản biện',
        sublabel: 'Nộp & chấm',
        icon: <FileSearchOutlined />,
        color: 'warning',
        description: 'GVPB thực hiện chấm điểm và nhận xét báo cáo cuối kỳ.'
    },
    DEFENSE: {
        label: 'Bảo vệ',
        sublabel: 'Oral / Poster',
        icon: <ThunderboltOutlined />,
        color: 'purple',
        description: 'Tổ chức các hội đồng bảo vệ khóa luận tốt nghiệp.'
    },
    FINAL: {
        label: 'Tổng kết',
        sublabel: 'Chốt điểm',
        icon: <CheckCircleOutlined />,
        color: 'success',
        description: 'Học kỳ đã kết thúc, dữ liệu đã được chốt và lưu trữ.'
    },
};

const PHASES_ORDER: string[] = [
    'PREVIEW',
    'REGISTRATION',
    'WORK',
    'REVIEWING',
    'DEFENSE',
    'FINAL'
];

const getPhaseTimeRange = (phase: any, semester: any, deptConfig: any, t: any) => {
    const format = 'DD/MM/YYYY';
    const formatD = (d: any) => d ? dayjs(d).format(format) : (t('semesterSettings.notSet') || 'Chưa thiết lập');
    
    // Ưu tiên ngày bảo vệ của bộ môn từ deptConfig truyền vào
    const currentDefenseStart = deptConfig?.defense_date || semester.defense_start;
    const globalDefenseStart = semester.defense_start;

    const renderRange = (currentStart: any, currentEnd: any, globalStart: any, globalEnd: any) => {
        const isDifferent = dayjs(currentStart).isSame(globalStart, 'day') === false || 
                          dayjs(currentEnd).isSame(globalEnd, 'day') === false;
        
        return (
            <div className="flex flex-col">
                <span className="font-bold text-blue-600">{formatD(currentStart)} - {formatD(currentEnd)}</span>
                {isDifferent && (
                    <span className="text-[10px] text-slate-400 font-normal">
                        ({t('semesterSettings.globalTimeline') || 'Lịch chung'}: {formatD(globalStart)} - {formatD(globalEnd)})
                    </span>
                )}
            </div>
        );
    };

    switch (phase) {
        case 'PREVIEW':
            return renderRange(semester.topic_viewing_start, semester.topic_viewing_end, semester.topic_viewing_start, semester.topic_viewing_end);
        case 'REGISTRATION':
            return renderRange(semester.topic_registration_start, semester.topic_registration_end, semester.topic_registration_start, semester.topic_registration_end);
        case 'WORK':
            return renderRange(semester.topic_registration_end, semester.proposal_deadline, semester.topic_registration_end, semester.proposal_deadline);
        case 'REVIEWING':
            return renderRange(semester.proposal_deadline, semester.thesis_deadline, semester.proposal_deadline, semester.thesis_deadline);
        case 'DEFENSE':
            const deptDate = deptConfig?.defense_date;
            
            return (
                <div className="flex flex-col">
                    <span className="font-bold text-blue-600">
                        {deptDate ? formatD(deptDate) : `${formatD(semester.defense_start)} - ${formatD(semester.defense_end)}`}
                    </span>
                    {deptDate && (
                        <span className="text-[10px] text-slate-400 font-normal">
                            ({t('semesterSettings.globalTimeline') || 'Lịch chung'}: {formatD(semester.defense_start)} - {formatD(semester.defense_end)})
                        </span>
                    )}
                </div>
            );
        case 'FINAL':
            return (
                <div className="flex flex-col">
                    <span className="font-bold text-blue-600">
                        {formatD(semester.defense_end)} - {formatD(semester.end_date)}
                    </span>
                    <span className="text-[11px] text-slate-400 italic mt-1">
                        {t('semesterSettings.finalPhaseDesc') || 'Học kỳ đã đóng, đang trong giai đoạn tổng kết.'}
                    </span>
                </div>
            );
        default:
            return '';
    }
};

const SemesterSettings = () => {
    const { t } = useTranslation();
    const queryClient = useQueryClient();
    const { user } = useAuthStore();
    const isAdmin = user?.role === 'ADMIN';
    const isHead = user?.role === 'HEAD';
    const canManage = isAdmin || isHead;

    const { data: activeSemester, isLoading } = useActiveSemester();
    const [selectedDeptId, setSelectedDeptId] = useState<string | undefined>(user?.department_id || undefined);
    const [defenseDate, setDefenseDate] = useState<dayjs.Dayjs | null>(null);

    // Fetch departments for Admin dropdown
    const { data: departments = [] } = useQuery({
        queryKey: ['departments'],
        queryFn: () => DepartmentsApi.getAll(),
        enabled: isAdmin,
    });

    const updateDateMutation = useMutation({
        mutationFn: (values: { defense_date?: string }) => SemestersApi.updateDeptConfig(activeSemester!.id, { 
            ...values,
            departmentId: selectedDeptId
        }),
        onSuccess: () => {
            notify.success(t('semesterSettings.updateSuccess', 'Cập nhật ngày bảo vệ bộ môn thành công'));
            queryClient.invalidateQueries({ queryKey: ['active-semester'] });
            queryClient.invalidateQueries({ queryKey: ['dept-semester-config', activeSemester?.id, selectedDeptId] });
        },
        onError: (error: any) => {
            notify.error(error?.response?.data?.error || t('semesterSettings.updateError', 'Lỗi khi cập nhật ngày bảo vệ'));
        },
    });

    const { data: deptConfig, isLoading: loadingDeptConfig } = useQuery({
        queryKey: ['dept-semester-config', activeSemester?.id, selectedDeptId],
        queryFn: () => SemestersApi.getDeptConfig(activeSemester!.id, selectedDeptId),
        enabled: !!activeSemester?.id && (!!selectedDeptId || !isAdmin),
    });

    useEffect(() => {
        if (deptConfig?.defense_date) {
            setDefenseDate(dayjs(deptConfig.defense_date));
        } else if (activeSemester?.defense_start) {
            setDefenseDate(dayjs(activeSemester.defense_start));
        } else {
            setDefenseDate(null);
        }
    }, [deptConfig, activeSemester]);

    const { data: overrideLogs = [], isLoading: loadingOverrideLogs } = useQuery({
        queryKey: ['registration-override-logs', activeSemester?.id, selectedDeptId],
        queryFn: () => SemestersApi.getOverrideLogs(activeSemester!.id, selectedDeptId),
        enabled: !!activeSemester?.id,
    });

    const [isOverrideModalOpen, setIsOverrideModalOpen] = useState(false);
    const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);

    const toggleOverrideMutation = useMutation({
        mutationFn: ({ open, reason }: { open: boolean, reason: string }) =>
            SemestersApi.updateDeptConfig(activeSemester.id, { 
                is_registration_open: open,
                departmentId: selectedDeptId,
                reason
            }),
        onSuccess: () => {
            notify.success('Cập nhật trạng thái mở đăng ký thành công');
            setIsOverrideModalOpen(false);
            queryClient.invalidateQueries({ queryKey: ['active-semester'] });
            queryClient.invalidateQueries({ queryKey: ['dept-semester-config', activeSemester?.id, selectedDeptId] });
        },
        onError: (error: any) => {
            notify.error(error.response?.data?.message || 'Lỗi khi cập nhật trạng thái');
        }
    });
    const [form] = Form.useForm();

    const handleSaveDate = () => {
        if (!defenseDate) {
            notify.warning(t('semesterSettings.dateRequired', 'Vui lòng chọn ngày bảo vệ'));
            return;
        }
        updateDateMutation.mutate({ defense_date: defenseDate.toISOString() });
    };




    if (isLoading) return <div className="p-10 text-center"><Spin size="large" /></div>;

    if (!activeSemester) return <div className="p-10"><Alert message={t('common.noActiveSemester')} type="warning" /></div>;

    // Find the current active step based on the phase returned from backend
    const currentPhase = activeSemester.calculated_phase;
    const currentStepIndex = currentPhase ? PHASES_ORDER.indexOf(currentPhase) : -1;

    const isLocked = activeSemester.status === 'COMPLETED';

    // Override Mode Logic (Department Specific)
    const isOverrideActive = deptConfig?.is_registration_open === true;
    const now = dayjs();
    
    // Rule: Can only turn ON override before midterm grading starts
    // But if it is already ON, we always allow turning it OFF.
    const isBeforeMidterm = activeSemester.midterm_start 
        ? now.isBefore(dayjs(activeSemester.midterm_start))
        : ['PREVIEW', 'REGISTRATION', 'WORK'].includes(currentPhase || '');

    const canOverride = activeSemester.status === 'ACTIVE' && (isOverrideActive || isBeforeMidterm);

    const originalDeadline = activeSemester.topic_registration_end;
    const isExpired = originalDeadline ? now.isAfter(dayjs(originalDeadline)) : false;

    let statusTag = <Tag color="default">{t('status.NOT_STARTED') || 'CHƯA BẮT ĐẦU'}</Tag>;
    if (originalDeadline) {
        if (isOverrideActive) statusTag = <Tag color="error">{t('status.overrideActive') || 'ĐANG MỞ ĐĂNG KÝ (BỘ MÔN)'}</Tag>;
        else if (isExpired) statusTag = <Tag color="red">{t('status.CLOSED') || 'ĐÃ ĐÓNG'}</Tag>;
        else statusTag = <Tag color="green">{t('status.IN_TERM') || 'ĐANG TRONG HẠN'}</Tag>;
    }

    return (
        <div className="page-container">
            <div className="page-inner">
                {/* Header */}
                <Card className="page-header-card">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                        <div className="flex items-center gap-3">
                            <div className="page-header-icon"><SettingOutlined className="text-base" /></div>
                            <div>
                                <div className="page-header-title">{t('semesterSettings.title', 'Vận hành Học kỳ')}</div>
                                <div className="page-header-subtitle">{t('semesterSettings.description', 'Quản lý lộ trình và điều phối hoạt động học kỳ')}</div>
                            </div>
                        </div>

                        {canManage && isAdmin && (
                            <div className="flex items-center gap-3 bg-blue-50/50 p-2 pl-4 rounded-xl border border-blue-100/50">
                                <span className="text-[13px] font-bold text-blue-600 uppercase tracking-wider">{t('users.department') || 'Bộ môn'}:</span>
                                <Select
                                    placeholder={t('users.selectDepartment') || "Chọn bộ môn cấu hình"}
                                    className="w-64"
                                    variant="borderless"
                                    value={selectedDeptId}
                                    onChange={setSelectedDeptId}
                                    options={departments.map(d => ({ label: d.name, value: d.id }))}
                                    showSearch
                                    popupClassName="rounded-xl shadow-lg border-none"
                                    style={{ fontWeight: 600 }}
                                    filterOption={(input, option) =>
                                        (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                                    }
                                />
                            </div>
                        )}
                    </div>
                </Card>
                    <div className="max-w-[1200px] mx-auto space-y-6">

                <div className={`grid grid-cols-1 ${canManage ? 'lg:grid-cols-12' : 'lg:grid-cols-1'} gap-6`}>
                    {/* Left: Phase Status (Non-interactive) */}
                    <div className={canManage ? 'lg:col-span-7' : 'lg:col-span-12'}>
                        <Card
                            className="page-card h-full"
                            styles={{ header: { padding: '20px 24px', borderBottom: '1px solid #f1f5f9' } }}
                            title={
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="w-[5px] h-6 bg-[#2563eb] rounded-full" />
                                        <h2 className="text-[16px] font-bold text-slate-800 m-0">{t('semesterSettings.semesterTimeline') || 'Lộ trình học kỳ (Timeline)'}</h2>
                                    </div>
                                    <Tag color="blue" className="rounded-full px-3 border-none">{t('common.automatic') || 'TỰ ĐỘNG'}</Tag>
                                </div>
                            }
                        >
                            {currentStepIndex === -1 ? (
                                <div className="py-20 text-center">
                                    <Empty description={t('semesterSettings.notStartedOrPlanning') || "Học kỳ chưa bắt đầu hoặc đang trong giai đoạn chuẩn bị."} />
                                </div>
                            ) : (
                                <Steps
                                    direction="vertical"
                                    current={currentStepIndex}
                                    className="semester-steps-readonly px-4"
                                >
                                    {PHASES_ORDER.map((phase) => (
                                        <Steps.Step
                                            key={phase}
                                            title={
                                                <div className="flex items-center gap-3">
                                                    <span className={`text-[15px] font-bold tracking-tight transition-colors ${PHASES_ORDER[currentStepIndex] === phase ? 'text-blue-600' : 'text-slate-600'}`}>
                                                        {t('status.semester.' + phase) || PHASE_CONFIG[phase].label}
                                                    </span>
                                                    {PHASES_ORDER[currentStepIndex] === phase && (
                                                        <div className="flex items-center gap-2">
                                                            <Tag color={PHASE_CONFIG[phase].color} className="rounded-full text-[10px] border-none font-bold">
                                                                {t('status.semester_sublabel.' + phase) || PHASE_CONFIG[phase].sublabel}
                                                            </Tag>
                                                            <Badge status="processing" text={<span className="text-[10px] font-bold text-blue-500 uppercase">{t('common.current') || 'Hiện tại'}</span>} className="animate-pulse" />
                                                        </div>
                                                    )}
                                                </div>
                                            }
                                            subTitle={
                                                <div className="flex items-center gap-1.5 -mt-4">
                                                    <ClockCircleOutlined className="text-[11px] text-slate-400" />
                                                    <div className="text-[12px] leading-tight">
                                                        {getPhaseTimeRange(phase, activeSemester, deptConfig, t)}
                                                    </div>
                                                </div>
                                            }
                                            description={PHASES_ORDER[currentStepIndex] === phase ? (
                                                <div className="mt-1 p-3 rounded-xl transition-all border bg-blue-50/40 border-blue-100 text-slate-600 shadow-sm">
                                                    <p className="text-[13px] leading-relaxed mb-0 font-medium">{t('status.semester_description.' + phase) || PHASE_CONFIG[phase].description}</p>
                                                    {/* Khoảng thời gian chấm giữa kỳ bên trong WORK phase */}
                                                    {phase === 'WORK' && activeSemester.midterm_start && (
                                                        <div className="mt-3 flex items-center gap-2 text-[11px] font-bold text-amber-700 bg-amber-50 border border-amber-200/50 rounded-xl px-3 py-2">
                                                            <Flame className="h-3.5 w-3.5 text-amber-500" />
                                                            <span>
                                                                {(t('navigation.midtermEvaluation') || 'CHẤM GIỮA KỲ').toUpperCase()}: {' '}
                                                                <span className="text-amber-800">{dayjs(activeSemester.midterm_start).format('DD/MM/YYYY')}</span>
                                                                {activeSemester.midterm_end && (
                                                                    <>{' '} → <span className="text-amber-800">{dayjs(activeSemester.midterm_end).format('DD/MM/YYYY')}</span></>
                                                                )}
                                                            </span>
                                                        </div>
                                                    )}
                                                </div>
                                            ) : null}
                                            icon={
                                                <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all shadow-md ${PHASES_ORDER[currentStepIndex] === phase ? 'bg-blue-600 text-white shadow-blue-200 scale-110' : 'bg-gray-50 border border-gray-100 text-gray-300'}`}>
                                                    {PHASE_CONFIG[phase].icon}
                                                </div>
                                            }
                                        />
                                    ))}
                                </Steps>
                            )}
                        </Card>
                    </div>

                    {/* Right: Controls */}
                    {canManage && (
                        <div className="lg:col-span-5 space-y-6">
                            {isAdmin && !selectedDeptId ? (
                                <Card className="page-card h-full flex items-center justify-center py-20 bg-slate-50/50 border-dashed border-2">
                                    <Empty
                                        image={Empty.PRESENTED_IMAGE_SIMPLE}
                                        description={
                                            <div className="text-center">
                                                <p className="text-slate-500 font-bold">{t('semesterSettings.generalView') || 'Chế độ xem chung'}</p>
                                                <p className="text-xs text-slate-400">{t('semesterSettings.generalViewDesc') || 'Vui lòng chọn bộ môn ở phía trên để thiết lập cấu hình riêng hoặc mở đăng ký.'}</p>
                                            </div>
                                        }
                                    />
                                </Card>
                            ) : (
                                <>
                                    {/* Panel 2: Registration Override Management */}
                            <Card
                                title={
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="w-[5px] h-6 bg-[#2563eb] rounded-full" />
                                            <h2 className="text-[16px] font-bold text-slate-800 m-0">{t('semesterSettings.registrationOverrideTitle') || 'Cơ chế mở đăng ký bổ sung (Bộ môn)'}</h2>
                                        </div>
                                        {isOverrideActive ? (
                                            <Tag color="error" className="rounded-full px-3 border-none font-bold animate-pulse">{t('semesterSettings.openRegShort') || 'MỞ ĐĂNG KÝ'}</Tag>
                                        ) : statusTag}
                                    </div>
                                }
                                className="page-card"
                                styles={{ header: { padding: '20px 24px', borderBottom: '1px solid #f1f5f9' } }}
                            >
                                <div className="space-y-6">
                                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-3">
                                        <div className="flex justify-between items-center">
                                            <span className="section-label">{t('semesterSettings.originalDeadline') || 'Hạn đăng ký gốc'}</span>
                                            <span className="text-[14px] font-bold text-slate-700">
                                                {activeSemester.topic_registration_end ? dayjs(activeSemester.topic_registration_end).format('DD/MM/YYYY HH:mm') : '---'}
                                            </span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <span className="section-label">{t('common.status') || 'Trạng thái hiện tại'}</span>
                                            <span className={`text-[12px] font-bold ${isOverrideActive ? 'text-red-500' : 'text-slate-400'}`}>
                                                {isOverrideActive ? (t('semesterSettings.manualOpen') || 'ĐANG MỞ THỦ CÔNG') : (t('semesterSettings.complyTimeline') || 'TUÂN THỦ TIMELINE')}
                                            </span>
                                        </div>
                                    </div>

                                    <Space direction="vertical" style={{ width: '100%' }}>
                                        <Button
                                            type={isOverrideActive ? 'default' : 'primary'}
                                            danger={isOverrideActive}
                                            icon={isOverrideActive ? <LockOutlined /> : <UnlockOutlined />}
                                            block
                                            size="large"
                                            onClick={() => setIsOverrideModalOpen(true)}
                                            disabled={!canOverride}
                                            className={`h-12 rounded-xl shadow-md font-bold transition-all hover:scale-[1.02] ${!isOverrideActive ? 'bg-blue-600 border-none' : ''}`}
                                        >
                                            {isOverrideActive ? (t('semesterSettings.closeRegistrationSetup') || 'Thiết lập Đóng đăng ký') : (t('semesterSettings.openRegistrationSetup') || 'Thiết lập mở đăng ký')}
                                        </Button>
                                        <Button
                                            icon={<HistoryOutlined />}
                                            block
                                            className="h-12 rounded-xl border-dashed font-medium text-slate-500"
                                            onClick={() => setIsHistoryModalOpen(true)}
                                        >
                                            {t('semesterSettings.historyAction') || 'Lịch sử thao tác'}
                                        </Button>
                                    </Space>

                                    {isOverrideActive && (
                                        <Alert
                                            type="warning"
                                            message={<span className="font-bold">{t('semesterSettings.overrideActiveWarning') || 'Hệ thống đang mở Override'}</span>}
                                            description={t('semesterSettings.overrideActiveWarningDesc') || 'Sinh viên có thể đăng ký đề tài kể cả khi đã quá hạn. Hãy đóng lại khi hoàn tất đợt đăng ký bổ sung.'}
                                            showIcon
                                            className="rounded-2xl border-amber-200 bg-amber-50"
                                        />
                                    )}
                                    {!canOverride && !isOverrideActive && (
                                        <Alert
                                            type="error"
                                            message={<span className="font-bold">{t('semesterSettings.overrideExpiredWarning') || 'Đã hết hạn mở đăng ký bổ sung'}</span>}
                                            description={t('semesterSettings.overrideExpiredWarningDesc') || 'Chức năng này chỉ khả dụng trước thời điểm chấm giữa kỳ để đảm bảo tiến độ học thuật.'}
                                            showIcon
                                            className="rounded-2xl"
                                        />
                                    )}
                                </div>
                            </Card>

                            {/* Panel 1: Global Config */}
                            <Card
                                title={
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="w-[5px] h-6 bg-[#2563eb] rounded-full" />
                                            <h2 className="text-[16px] font-bold text-slate-800 m-0">{t('semesterSettings.defenseGradingConfigTitle') || 'Cấu hình Hội đồng & Điểm (Bộ môn)'}</h2>
                                        </div>
                                    </div>
                                }
                                className="page-card"
                                styles={{ header: { padding: '20px 24px', borderBottom: '1px solid #f1f5f9' } }}
                            >
                                <div className="space-y-4">
                                    <div className="bg-gray-50 p-4 rounded-xl space-y-4">
                                        <div className="space-y-2">
                                            <label className="section-label">
                                                {t('semesterSettings.expectedDefenseDate') || 'Ngày bảo vệ dự kiến (Bộ môn)'}
                                            </label>
                                            <div className="flex flex-col gap-3">
                                                <div className="flex gap-2">
                                                    <DatePicker
                                                        className="flex-1 h-12 rounded-xl border-gray-200"
                                                        format="DD/MM/YYYY"
                                                        value={defenseDate}
                                                        onChange={setDefenseDate}
                                                        disabled={isLocked}
                                                        disabledDate={(current) => {
                                                            if (!current) return false;
                                                            if (current.isBefore(dayjs().startOf('day'))) return true;
                                                            if (!activeSemester.defense_start || !activeSemester.defense_end) return false;
                                                            return (
                                                                current.isBefore(dayjs(activeSemester.defense_start).startOf('day')) ||
                                                                current.isAfter(dayjs(activeSemester.defense_end).endOf('day'))
                                                            );
                                                        }}
                                                    />
                                                    <Button 
                                                        type="primary" 
                                                        className="h-12 rounded-xl bg-blue-600 border-none shadow-md" 
                                                        icon={<SaveOutlined />} 
                                                        onClick={handleSaveDate}
                                                        loading={updateDateMutation.isPending && updateDateMutation.variables?.defense_date !== undefined}
                                                        disabled={isLocked || !defenseDate}
                                                    >
                                                        {t('common.save') || 'Lưu ngày'}
                                                    </Button>
                                                </div>
                                                <Alert
                                                    className="rounded-xl border-none bg-blue-50/50 py-2"
                                                    message={
                                                        <span className="text-[11px] text-blue-600 italic">
                                                            {t('semesterSettings.defenseDateNote', { start: dayjs(activeSemester.defense_start).format('DD/MM/YYYY'), end: dayjs(activeSemester.defense_end).format('DD/MM/YYYY') }) || `Lưu ý: Ngày bảo vệ của bộ môn phải nằm trong khung thời gian của Khoa (${dayjs(activeSemester.defense_start).format('DD/MM/YYYY')} - ${dayjs(activeSemester.defense_end).format('DD/MM/YYYY')}).`}
                                                        </span>
                                                    }
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </Card>

                            <Alert
                                className="rounded-xl border border-blue-100 bg-blue-50/50"
                                icon={<InfoCircleOutlined className="text-blue-400" />}
                                showIcon
                                message={<span className="text-blue-700 font-medium">{t('semesterSettings.registrationRulesTitle') || 'Lưu ý về quy tắc mở đăng ký'}</span>}
                                description={
                                    <ul className="text-xs text-blue-600/80 mt-1 list-disc pl-4 space-y-1">
                                        <li>{t('semesterSettings.registrationRule1') || 'Chỉ SV chưa đăng ký mới được phép đăng ký trong thời gian mở đăng ký.'}</li>
                                        <li>{t('semesterSettings.registrationRule2') || 'Không thể mở đăng ký lùi thời gian so với hạn hiện tại.'}</li>
                                        <li>{t('semesterSettings.registrationRule3') || 'Lịch sử mở đăng ký sẽ được lưu vĩnh viễn để phục vụ thanh tra.'}</li>
                                    </ul>
                                }
                            />
                                </>
                            )}
                        </div>
                    )}
                </div>

                {/* Override Modal */}
                <Modal
                    title={
                        <div className="flex items-center gap-2.5 py-1">
                            <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center text-blue-600">
                                {isOverrideActive ? <LockOutlined className="text-lg" /> : <UnlockOutlined className="text-lg" />}
                            </div>
                            <span className="text-[17px] font-bold text-slate-800">
                                {isOverrideActive ? (t('semesterSettings.manualCloseTitle') || 'Đóng đăng ký thủ công') : (t('semesterSettings.manualOpenTitle') || 'Mở đăng ký thủ công')}
                            </span>
                        </div>
                    }
                    open={isOverrideModalOpen}
                    onCancel={() => setIsOverrideModalOpen(false)}
                    onOk={() => {
                        const reason = form.getFieldValue('override_reason');
                        if (!reason) {
                            notify.warning('Vui lòng nhập lý do thực hiện');
                            return;
                        }
                        toggleOverrideMutation.mutate({ open: !isOverrideActive, reason });
                    }}
                    confirmLoading={toggleOverrideMutation.isPending}
                    okText={isOverrideActive ? 'Xác nhận Đóng' : 'Xác nhận Mở'}
                    okType={isOverrideActive ? 'primary' : 'danger'}
                    cancelText="Hủy"
                    width={480}
                    centered
                >
                    <div className="py-4">
                        <Alert
                            type={isOverrideActive ? 'info' : 'warning'}
                            message={<span className="font-bold">{isOverrideActive ? (t('semesterSettings.closeProcess') || 'Quy trình đóng đăng ký') : (t('semesterSettings.riskWarning') || 'Cảnh báo rủi ro tiến độ')}</span>}
                            description={
                                isOverrideActive
                                    ? (t('semesterSettings.closeProcessDesc') || "Hệ thống sẽ quay về tuân thủ timeline gốc. Sinh viên quá hạn sẽ không thể đăng ký thêm.")
                                    : (t('semesterSettings.riskWarningDesc') || "Việc mở lại đăng ký có thể làm giảm thời gian thực hiện khóa luận của sinh viên và ảnh hưởng đến tiến độ chung của học kỳ.")
                            }
                            showIcon
                            className="mb-6 rounded-xl"
                        />

                        <Form form={form} layout="vertical">
                            <Form.Item
                                name="override_reason"
                                label={<span className="font-bold text-slate-700">{t('semesterSettings.reason') || 'Lý do thực hiện'}</span>}
                                rules={[{ required: true, message: t('semesterSettings.reasonRequired') || 'Vui lòng nhập lý do' }]}
                            >
                                <Input.TextArea
                                    placeholder={isOverrideActive ? (t('semesterSettings.closeReasonPlaceholder') || "Ví dụ: Đã hết đợt đăng ký bổ sung...") : (t('semesterSettings.openReasonPlaceholder') || "Ví dụ: Hỗ trợ các nhóm gặp sự cố kỹ thuật...")}
                                    rows={3}
                                    className="rounded-xl"
                                />
                            </Form.Item>
                        </Form>
                    </div>
                </Modal>

                <Modal
                    title={t('semesterSettings.historyAction') || "Lịch sử thao tác"}
                    open={isHistoryModalOpen}
                    onCancel={() => setIsHistoryModalOpen(false)}
                    footer={null}
                    width={800}
                    className="rounded-2xl"
                >
                    <Table
                        dataSource={overrideLogs}
                        loading={loadingOverrideLogs}
                        rowKey="id"
                        columns={[
                            {
                                title: t('semesterSettings.timestamp') || 'Thời điểm',
                                dataIndex: 'created_at',
                                width: 170,
                                render: (val) => dayjs(val).format('DD/MM/YYYY HH:mm:ss'),
                            },
                            {
                                title: t('common.actions') || 'Thao tác',
                                dataIndex: 'action',
                                width: 180,
                                render: (action) => (
                                    <Tag color={action === 'DEPT_REGISTRATION_OPENED' ? 'error' : 'default'} className="rounded-full border-none px-3 font-bold">
                                        {action === 'DEPT_REGISTRATION_OPENED' ? (t('semesterSettings.openRegShort') || 'MỞ ĐĂNG KÝ') : (t('semesterSettings.closeRegShort') || 'ĐÓNG ĐĂNG KÝ')}
                                    </Tag>
                                )
                            },
                            {
                                title: t('semesterSettings.reason') || 'Lý do thực hiện',
                                dataIndex: 'new_value',
                                render: (val) => val?.reason || '---',
                            },
                            {
                                title: t('semesterSettings.operator') || 'Người thực hiện',
                                dataIndex: ['user', 'full_name'],
                                width: 150,
                            }
                        ]}
                        pagination={{ pageSize: 5 }}
                        className="mt-4"
                    />
                </Modal>
            </div>
            </div>
            <style>{`
                .semester-steps-readonly .ant-steps-item {
                    padding-bottom: 28px !important;
                }
                .semester-steps-readonly .ant-steps-item-container {
                    padding-bottom: 0 !important;
                }
                .semester-steps-readonly .ant-steps-item-content {
                    min-height: unset !important;
                }
                .semester-steps-readonly .ant-steps-item-tail {
                    padding: 16px 0 !important;
                }
            `}</style>
        </div>
    );
};

export default SemesterSettings;
