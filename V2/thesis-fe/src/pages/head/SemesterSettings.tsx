import { useState, useEffect } from 'react';
import {
    Card, DatePicker, Button, Alert, Space, Typography, Tag, Divider,
    Spin, Steps, Tooltip, Badge, Modal, Form, Input, Table, Empty, Checkbox
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
        description: 'Sinh viên thực hiện khóa luận, nộp báo cáo tiến độ và đề cương.'
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

const getPhaseTimeRange = (phase: any, semester: any) => {
    const format = 'DD/MM/YYYY';
    const start = (d: any) => d ? dayjs(d).format(format) : 'Chưa thiết lập';
    const sPlus = (d: any, days: number) => d ? dayjs(d).add(days, 'day').format(format) : '...';

    switch (phase) {
        case 'PREVIEW':
            return `${start(semester.topic_viewing_start)} - ${start(semester.topic_viewing_end)}`;
        case 'REGISTRATION':
            return `${start(semester.topic_registration_start)} - ${start(semester.topic_registration_end)}`;
        case 'WORK':
            return `${start(semester.topic_registration_end)} - ${start(semester.proposal_deadline)}`;
        case 'REVIEWING':
            return `${start(semester.proposal_deadline)} - ${start(semester.thesis_deadline)}`;
        case 'DEFENSE':
            return `${start(semester.defense_start)} - ${start(semester.defense_end)}`;
        case 'FINAL':
            return `${start(semester.defense_end)} - ${start(semester.end_date)}`;
        default:
            return '';
    }
};

const SemesterSettings = () => {
    const { t } = useTranslation();
    const queryClient = useQueryClient();
    const { data: activeSemester, isLoading } = useActiveSemester();
    const [defenseDate, setDefenseDate] = useState<dayjs.Dayjs | null>(null);

    useEffect(() => {
        if (activeSemester?.defense_start) {
            setDefenseDate(dayjs(activeSemester.defense_start));
        }
    }, [activeSemester]);

    const updateDateMutation = useMutation({
        mutationFn: (date: string) => SemestersApi.updateDefenseDate(activeSemester!.id, date),
        onSuccess: () => {
            notify.success(t('semesterSettings.updateSuccess', 'Cập nhật ngày bảo vệ thành công'));
            queryClient.invalidateQueries({ queryKey: ['active-semester'] });
        },
        onError: (error: any) => {
            notify.error(error?.response?.data?.error || t('semesterSettings.updateError', 'Lỗi khi cập nhật ngày bảo vệ'));
        },
    });



    const { data: overrideLogs = [], isLoading: loadingOverrideLogs } = useQuery({
        queryKey: ['registration-override-logs', activeSemester?.id],
        queryFn: () => SemestersApi.getOverrideLogs(activeSemester!.id),
        enabled: !!activeSemester?.id,
    });


    const [isOverrideModalOpen, setIsOverrideModalOpen] = useState(false);
    const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);

    const toggleOverrideMutation = useMutation({
        mutationFn: ({ override, reason }: { override: boolean, reason: string }) => 
            SemestersApi.toggleRegistrationOverride(activeSemester.id, override, reason),
        onSuccess: () => {
            notify.success('Cập nhật trạng thái hệ thống thành công');
            setIsOverrideModalOpen(false);
            queryClient.invalidateQueries({ queryKey: ['active-semester'] });
            queryClient.invalidateQueries({ queryKey: ['registration-override-logs', activeSemester?.id] });
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
        updateDateMutation.mutate(defenseDate.toISOString());
    };



    if (isLoading) return <div className="p-10 text-center"><Spin size="large" /></div>;

    if (!activeSemester) return <div className="p-10"><Alert message={t('common.noActiveSemester')} type="warning" /></div>;

    // Find the current active step based on the phase returned from backend
    const currentPhase = activeSemester.calculated_phase;
    const currentStepIndex = currentPhase ? PHASES_ORDER.indexOf(currentPhase) : -1;

    const isLocked = activeSemester.status === 'COMPLETED';

    // Override Mode Logic
    const isOverrideActive = activeSemester.is_registration_override === true;
    const canOverride = activeSemester.status === 'ACTIVE' && 
                      currentPhase !== 'FINAL';

    const originalDeadline = activeSemester.topic_registration_end;
    const now = dayjs();
    const isExpired = originalDeadline ? now.isAfter(dayjs(originalDeadline)) : false;

    let statusTag = <Tag color="default">CHƯA BẮT ĐẦU</Tag>;
    if (originalDeadline) {
        if (isOverrideActive) statusTag = <Tag color="error">OVERRIDE: MỞ</Tag>;
        else if (isExpired) statusTag = <Tag color="red">ĐÃ ĐÓNG</Tag>;
        else statusTag = <Tag color="green">ĐANG TRONG HẠN</Tag>;
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
                    </div>
                </Card>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    {/* Left: Phase Status (Non-interactive) */}
                    <div className="lg:col-span-7">
                        <Card
                            className="page-card h-full"
                            styles={{ header: { padding: '20px 24px', borderBottom: '1px solid #f1f5f9' } }}
                            title={
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="w-[5px] h-6 bg-[#2563eb] rounded-full" />
                                        <h2 className="text-[16px] font-bold text-slate-800 m-0">Lộ trình học kỳ (Timeline)</h2>
                                    </div>
                                    <Tag color="blue" className="rounded-full px-3 border-none">TỰ ĐỘNG</Tag>
                                </div>
                            }
                        >
                            {currentStepIndex === -1 ? (
                                <div className="py-20 text-center">
                                    <Empty description="Học kỳ chưa bắt đầu hoặc đang trong giai đoạn chuẩn bị." />
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
                                                        {PHASE_CONFIG[phase].label}
                                                    </span>
                                                    {PHASES_ORDER[currentStepIndex] === phase && (
                                                        <div className="flex items-center gap-2">
                                                            <Tag color={PHASE_CONFIG[phase].color} className="rounded-full text-[10px] border-none font-bold">
                                                                {PHASE_CONFIG[phase].sublabel}
                                                            </Tag>
                                                            <Badge status="processing" text={<span className="text-[10px] font-bold text-blue-500 uppercase">Hiện tại</span>} className="animate-pulse" />
                                                        </div>
                                                    )}
                                                </div>
                                            }
                                            subTitle={
                                                <div className="inline-flex items-center gap-1.5 text-[11px] text-slate-500 font-bold bg-slate-100/80 px-2.5 py-1 rounded-full mt-1">
                                                    <ClockCircleOutlined style={{ fontSize: '10px' }} />
                                                    {getPhaseTimeRange(phase, activeSemester)}
                                                </div>
                                            }
                                            description={PHASES_ORDER[currentStepIndex] === phase ? (
                                                <div className="mt-1 p-3 rounded-xl transition-all border bg-blue-50/40 border-blue-100 text-slate-600 shadow-sm">
                                                    <p className="text-[13px] leading-relaxed mb-0 font-medium">{PHASE_CONFIG[phase].description}</p>
                                                    {/* Khoảng thời gian chấm giữa kỳ bên trong WORK phase */}
                                                    {phase === 'WORK' && activeSemester.midterm_start && (
                                                        <div className="mt-3 flex items-center gap-2 text-[11px] font-bold text-amber-700 bg-amber-50 border border-amber-200/50 rounded-xl px-3 py-2">
                                                            <Flame className="h-3.5 w-3.5 text-amber-500" />
                                                            <span>
                                                                CHẤM GIỮA KỲ: {' '}
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
                    <div className="lg:col-span-5 space-y-6">
                        {/* Panel 2: Registration Override Management */}
                        <Card
                            title={
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="w-[5px] h-6 bg-[#2563eb] rounded-full" />
                                        <h2 className="text-[16px] font-bold text-slate-800 m-0">Cơ chế Mở đăng ký</h2>
                                    </div>
                                    {isOverrideActive ? (
                                        <Tag color="error" className="rounded-full px-3 border-none font-bold animate-pulse">OVERRIDE: MỞ</Tag>
                                    ) : statusTag}
                                </div>
                            }
                            className="page-card"
                            styles={{ header: { padding: '20px 24px', borderBottom: '1px solid #f1f5f9' } }}
                        >
                            <div className="space-y-6">
                                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-3">
                                    <div className="flex justify-between items-center">
                                        <span className="section-label">Hạn đăng ký gốc</span>
                                        <span className="text-[14px] font-bold text-slate-700">
                                            {activeSemester.topic_registration_end ? dayjs(activeSemester.topic_registration_end).format('DD/MM/YYYY HH:mm') : '---'}
                                        </span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="section-label">Trạng thái hiện tại</span>
                                        <span className={`text-[12px] font-bold ${isOverrideActive ? 'text-red-500' : 'text-slate-400'}`}>
                                            {isOverrideActive ? 'ĐANG MỞ THỦ CÔNG' : 'TUÂN THỦ TIMELINE'}
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
                                        {isOverrideActive ? 'Thiết lập Đóng đăng ký' : 'Thiết lập Mở đăng ký'}
                                    </Button>
                                    <Button
                                        icon={<HistoryOutlined />}
                                        block
                                        className="h-12 rounded-xl border-dashed font-medium text-slate-500"
                                        onClick={() => setIsHistoryModalOpen(true)}
                                    >
                                        Xem nhật ký Override
                                    </Button>
                                </Space>

                                {isOverrideActive && (
                                    <Alert
                                        type="warning"
                                        message={<span className="font-bold">Hệ thống đang mở Override</span>}
                                        description="Sinh viên có thể đăng ký đề tài kể cả khi đã quá hạn. Hãy đóng lại khi hoàn tất đợt đăng ký bổ sung."
                                        showIcon
                                        className="rounded-2xl border-amber-200 bg-amber-50"
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
                                        <h2 className="text-[16px] font-bold text-slate-800 m-0">Cấu hình Thời gian chung</h2>
                                    </div>
                                </div>
                            }
                            className="page-card"
                            styles={{ header: { padding: '20px 24px', borderBottom: '1px solid #f1f5f9' } }}
                        >
                            <div className="space-y-4">
                                <div className="bg-gray-50 p-4 rounded-xl space-y-3">
                                    <div className="space-y-2">
                                        <label className="section-label">
                                            Ngày bảo vệ học kỳ (dự kiến)
                                        </label>
                                        <DatePicker
                                            className="w-full h-12 rounded-xl border-gray-200"
                                            format="DD/MM/YYYY"
                                            value={defenseDate}
                                            onChange={setDefenseDate}
                                            disabled={isLocked}
                                            disabledDate={(current) => {
                                                if (!activeSemester.defense_start || !activeSemester.defense_end) return false;
                                                return current && (
                                                    current.isBefore(dayjs(activeSemester.defense_start).startOf('day')) ||
                                                    current.isAfter(dayjs(activeSemester.defense_end).endOf('day'))
                                                );
                                            }}
                                        />
                                    </div>
                                </div>
                                <Button
                                    type="primary"
                                    size="large"
                                    block
                                    icon={<SaveOutlined />}
                                    onClick={handleSaveDate}
                                    loading={updateDateMutation.isPending}
                                    disabled={isLocked || !defenseDate}
                                    className="h-12 rounded-xl"
                                >
                                    Lưu thay đổi
                                </Button>
                            </div>
                        </Card>

                        <Alert
                            className="rounded-xl border border-blue-100 bg-blue-50/50"
                            icon={<InfoCircleOutlined className="text-blue-400" />}
                            showIcon
                            message={<span className="text-blue-700 font-medium">Lưu ý về quy tắc gia hạn</span>}
                            description={
                                <ul className="text-xs text-blue-600/80 mt-1 list-disc pl-4 space-y-1">
                                    <li>Chỉ SV chưa đăng ký mới được phép đăng ký trong thời gian gia hạn.</li>
                                    <li>Không thể gia hạn lùi thời gian so với hạn hiện tại.</li>
                                    <li>Lịch sử gia hạn sẽ được lưu vĩnh viễn để phục vụ thanh tra.</li>
                                </ul>
                            }
                        />
                    </div>
                </div>

                {/* Override Modal */}
                <Modal
                    title={
                        <div className="flex items-center gap-2.5 py-1">
                            <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center text-blue-600">
                                {isOverrideActive ? <LockOutlined className="text-lg" /> : <UnlockOutlined className="text-lg" />}
                            </div>
                            <span className="text-[17px] font-bold text-slate-800">
                                {isOverrideActive ? 'Đóng đăng ký thủ công' : 'Mở đăng ký thủ công'}
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
                        toggleOverrideMutation.mutate({ override: !isOverrideActive, reason });
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
                            message={<span className="font-bold">{isOverrideActive ? 'Quy trình đóng đăng ký' : 'Cảnh báo rủi ro tiến độ'}</span>}
                            description={
                                isOverrideActive 
                                ? "Hệ thống sẽ quay về tuân thủ timeline gốc. Sinh viên quá hạn sẽ không thể đăng ký thêm."
                                : "Việc mở lại đăng ký có thể làm giảm thời gian thực hiện khóa luận của sinh viên và ảnh hưởng đến tiến độ chung của học kỳ."
                            }
                            showIcon
                            className="mb-6 rounded-xl"
                        />

                        <Form form={form} layout="vertical">
                            <Form.Item
                                name="override_reason"
                                label={<span className="font-bold text-slate-700">Lý do thực hiện</span>}
                                rules={[{ required: true, message: 'Vui lòng nhập lý do' }]}
                            >
                                <Input.TextArea 
                                    placeholder={isOverrideActive ? "Ví dụ: Đã hết đợt đăng ký bổ sung..." : "Ví dụ: Hỗ trợ các nhóm gặp sự cố kỹ thuật..."}
                                    rows={3} 
                                    className="rounded-xl"
                                />
                            </Form.Item>
                        </Form>
                    </div>
                </Modal>

                <Modal
                    title="Nhật ký Mở đăng ký thủ công"
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
                                title: 'Thời điểm',
                                dataIndex: 'created_at',
                                width: 160,
                                render: (val) => dayjs(val).format('DD/MM/YYYY HH:mm'),
                            },
                            {
                                title: 'Thao tác',
                                dataIndex: 'action',
                                width: 180,
                                render: (action) => (
                                    <Tag color={action === 'REGISTRATION_OVERRIDE_ENABLED' ? 'error' : 'default'} className="rounded-full border-none px-3 font-bold">
                                        {action === 'REGISTRATION_OVERRIDE_ENABLED' ? 'MỞ ĐĂNG KÝ' : 'ĐÓNG ĐĂNG KÝ'}
                                    </Tag>
                                )
                            },
                            {
                                title: 'Lý do thực hiện',
                                dataIndex: 'new_value',
                                render: (val) => val?.reason || '---',
                            },
                            {
                                title: 'Người thực hiện',
                                dataIndex: ['user', 'full_name'],
                                width: 150,
                            }
                        ]}
                        pagination={{ pageSize: 5 }}
                        className="mt-4"
                    />
                </Modal>
            </div>
            <style>{`
                .semester-steps-readonly .ant-steps-item {
                    padding-bottom: 8px !important;
                }
                .semester-steps-readonly .ant-steps-item-container {
                    padding-bottom: 8px !important;
                }
                .semester-steps-readonly .ant-steps-item-content {
                    min-height: unset !important;
                }
                .semester-steps-readonly .ant-steps-item-tail {
                    padding: 8px 0 !important;
                }
            `}</style>
        </div>
    );
};

export default SemesterSettings;
