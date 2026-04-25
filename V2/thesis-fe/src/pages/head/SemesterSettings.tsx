import { useState, useEffect } from 'react';
import { Card, DatePicker, Button, Alert, Space, Typography, Tag, Divider, Spin, Steps, Tooltip, Badge } from 'antd';
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
    UndoOutlined,
    FileProtectOutlined,
    ThunderboltOutlined,
    SettingOutlined,
    EyeOutlined
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { SemestersApi } from '@/api/semesters';
import { useActiveSemester } from '@/hooks/useActiveSemester';
import dayjs from 'dayjs';
import { SemesterPhase, UserRole } from '@/types';
import { Modal, Form, Input, Table, Empty } from 'antd';

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



    const { data: extensions = [], isLoading: loadingExtensions } = useQuery({
        queryKey: ['registration-extensions', activeSemester?.id],
        queryFn: () => SemestersApi.getRegistrationExtensions(activeSemester!.id),
        enabled: !!activeSemester?.id,
    });

    const createExtensionMutation = useMutation({
        mutationFn: (data: { semesterId: string; extendedUntil: string; reason: string }) =>
            SemestersApi.createRegistrationExtension(data),
        onSuccess: () => {
            notify.success('Gia hạn đăng ký thành công');
            setIsExtendModalOpen(false);
            form.resetFields();
            queryClient.invalidateQueries({ queryKey: ['registration-extensions', activeSemester?.id] });
        },
        onError: (error: any) => {
            notify.error(error?.response?.data?.error || 'Lỗi khi gia hạn đăng ký');
        },
    });

    const [isExtendModalOpen, setIsExtendModalOpen] = useState(false);
    const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
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

    // Calculate effective deadline for Registration
    const originalDeadline = activeSemester.topic_registration_end;
    const latestExtension = extensions.length > 0 ? extensions[0].extended_until : null;
    const effectiveDeadline = latestExtension ? dayjs(latestExtension) : (originalDeadline ? dayjs(originalDeadline) : null);

    const now = dayjs();
    const isExtended = !!latestExtension;
    const isExpired = effectiveDeadline ? now.isAfter(effectiveDeadline) : false;

    let statusTag = <Tag color="default">CHƯA BẮT ĐẦU</Tag>;
    if (effectiveDeadline) {
        if (isExpired) statusTag = <Tag color="red">ĐÃ ĐÓNG</Tag>;
        else if (isExtended) statusTag = <Tag color="orange">ĐANG GIA HẠN</Tag>;
        else statusTag = <Tag color="green">ĐANG TRONG HẠN</Tag>;
    }

    // canExtend: allowed if semester is active and we haven't entered Review/Defense phases
    const canExtend = activeSemester.status === 'ACTIVE' && 
                     currentPhase !== 'REVIEWING' && 
                     currentPhase !== 'DEFENSE' && 
                     currentPhase !== 'FINAL';

    return (
        <div className="page-container">
            <div className="page-inner">
            {/* Header */}
            <Card className="page-header-card">
                <div className="flex items-center gap-3">
                    <div className="page-header-icon"><SettingOutlined className="text-base" /></div>
                    <div>
                        <div className="page-header-title">{t('semesterSettings.title', 'Vận hành Học kỳ')}</div>
                        <div className="page-header-subtitle">{t('semesterSettings.description', 'Quản lý lộ trình và điều phối hoạt động học kỳ')}</div>
                    </div>
                </div>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Left: Phase Status (Non-interactive) */}
                <div className="lg:col-span-7">
                    <Card
                        className="shadow-xl border-none overflow-hidden rounded-2xl h-full"
                        title={
                            <div className="flex items-center justify-between py-2">
                                <Space>
                                    <Badge status="processing" color={currentPhase ? PHASE_CONFIG[currentPhase]?.color : 'default'} />
                                    <span className="text-lg font-semibold text-gray-700">Lộ trình học kỳ (Timeline)</span>
                                </Space>
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
                                                <span className={`text-base font-bold ${PHASES_ORDER[currentStepIndex] === phase ? 'text-blue-600' : 'text-gray-400'}`}>
                                                    {PHASE_CONFIG[phase].label}
                                                </span>
                                                {PHASES_ORDER[currentStepIndex] === phase && (
                                                    <div className="flex items-center gap-2">
                                                        <Tag color={PHASE_CONFIG[phase].color} className="rounded-full text-[10px] border-none">
                                                            {PHASE_CONFIG[phase].sublabel}
                                                        </Tag>
                                                        <Badge status="processing" text="Hiện tại" className="animate-pulse" />
                                                    </div>
                                                )}
                                            </div>
                                        }
                                        subTitle={
                                            <div className="flex items-center gap-1 text-xs text-gray-500 font-medium bg-gray-100/50 px-2 py-0.5 rounded-md">
                                                <ClockCircleOutlined style={{ fontSize: '10px' }} />
                                                {getPhaseTimeRange(phase, activeSemester)}
                                            </div>
                                        }
                                        description={
                                            <div className={`mt-1 p-3 rounded-xl transition-all ${PHASES_ORDER[currentStepIndex] === phase ? 'bg-blue-50/50 border border-blue-100 shadow-sm' : 'text-gray-400'}`}>
                                                {PHASE_CONFIG[phase].description}
                                                {/* Khoảng thời gian chấm giữa kỳ bên trong WORK phase */}
                                                {phase === 'WORK' && activeSemester.midterm_start && (
                                                    <div className="mt-2 flex items-center gap-2 text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5">
                                                        <span>📍</span>
                                                        <span>
                                                            Chấm giữa kỳ:{' '}
                                                            <b>{dayjs(activeSemester.midterm_start).format('DD/MM/YYYY')}</b>
                                                            {activeSemester.midterm_end && (
                                                                <>{' '}→ <b>{dayjs(activeSemester.midterm_end).format('DD/MM/YYYY')}</b></>
                                                            )}
                                                        </span>
                                                    </div>
                                                )}
                                            </div>
                                        }
                                        icon={
                                            <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all shadow-md ${PHASES_ORDER[currentStepIndex] === phase ? 'bg-blue-600 text-white shadow-blue-200 scale-110' : 'bg-gray-50 border border-gray-100 text-gray-300'}`}>
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
                    {/* Panel 2: Registration Management (MỚI) */}
                    <Card
                        title={<Space><UsergroupAddOutlined /> <span>Quản lý Đăng ký</span></Space>}
                        className="shadow-lg border-none rounded-2xl overflow-hidden"
                        extra={statusTag}
                    >
                        <div className="space-y-6">
                            <div className="bg-gray-50 p-4 rounded-xl space-y-3">
                                <div className="flex justify-between items-center">
                                    <span className="text-gray-500">Hạn đăng ký gốc:</span>
                                    <span className="font-semibold">{originalDeadline ? dayjs(originalDeadline).format('DD/MM/YYYY HH:mm') : '---'}</span>
                                </div>
                                <div className="flex justify-between items-center text-blue-600">
                                    <span className="font-medium">Hạn hiệu lực hiện tại:</span>
                                    <span className="font-bold underline">{effectiveDeadline ? effectiveDeadline.format('DD/MM/YYYY HH:mm') : '---'}</span>
                                </div>
                            </div>

                            <Space direction="vertical" style={{ width: '100%' }}>
                                <Button
                                    type="primary"
                                    icon={<CalendarOutlined />}
                                    block
                                    size="large"
                                    onClick={() => setIsExtendModalOpen(true)}
                                    disabled={!canExtend}
                                    className="h-12 rounded-xl shadow-md bg-blue-600 hover:bg-blue-700 border-none font-semibold transition-all hover:scale-[1.02]"
                                >
                                    Gia hạn Đăng ký
                                </Button>
                                <Button
                                    icon={<ClockCircleOutlined />}
                                    block
                                    className="h-12 rounded-xl border-dashed"
                                    onClick={() => setIsHistoryModalOpen(true)}
                                >
                                    Xem lịch sử thao tác
                                </Button>
                            </Space>

                            {!canExtend && activeSemester.midterm_start && (
                                <Alert
                                    type="error"
                                    message="Không thể gia hạn"
                                    description="Hệ thống đã khóa gia hạn do đã bước vào giai đoạn chuẩn bị chấm điểm giữa kỳ."
                                    showIcon
                                    className="rounded-xl"
                                />
                            )}
                        </div>
                    </Card>

                    {/* Panel 1: Global Config */}
                    <Card
                        title={<Space><CalendarOutlined /> <span>Cấu hình Thời gian chung</span></Space>}
                        className="shadow-lg border-none rounded-2xl overflow-hidden hover:shadow-xl transition-shadow"
                    >
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-gray-400 capitalize tracking-wider">
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
                        className="rounded-2xl border-none bg-blue-50/50"
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

            {/* Modals */}
            <Modal
                title="Gia hạn Đăng ký Đề tài"
                open={isExtendModalOpen}
                onCancel={() => setIsExtendModalOpen(false)}
                onOk={() => form.submit()}
                confirmLoading={createExtensionMutation.isPending}
                okText="Xác nhận Gia hạn"
                cancelText="Hủy"
                className="rounded-2xl"
            >
                <Form
                    form={form}
                    layout="vertical"
                    onFinish={(values) => {
                        createExtensionMutation.mutate({
                            semesterId: activeSemester.id,
                            extendedUntil: values.extendedUntil.toISOString(),
                            reason: values.reason
                        });
                    }}
                >
                    <Form.Item
                        name="extendedUntil"
                        label="Gia hạn đến ngày"
                        rules={[{ required: true, message: 'Vui lòng chọn ngày gia hạn' }]}
                    >
                        <DatePicker
                            showTime
                            className="w-full h-10 rounded-lg"
                            format="DD/MM/YYYY HH:mm"
                            disabledDate={(current) => current && current < dayjs().startOf('day')}
                        />
                    </Form.Item>
                    <Form.Item
                        name="reason"
                        label="Lý do gia hạn"
                        rules={[{ required: true, message: 'Vui lòng nhập lý do gia hạn' }]}
                    >
                        <Input.TextArea placeholder="Nhập lý do gia hạn (ví dụ: SV chưa kịp đăng ký đủ...)" rows={4} className="rounded-lg" />
                    </Form.Item>
                </Form>
            </Modal>

            <Modal
                title="Lịch sử Gia hạn Đăng ký"
                open={isHistoryModalOpen}
                onCancel={() => setIsHistoryModalOpen(false)}
                footer={null}
                width={700}
                className="rounded-2xl"
            >
                <Table
                    dataSource={extensions}
                    loading={loadingExtensions}
                    rowKey="id"
                    columns={[
                        {
                            title: 'Hạn mới',
                            dataIndex: 'extended_until',
                            render: (val) => dayjs(val).format('DD/MM/YYYY HH:mm'),
                            className: 'font-bold'
                        },
                        {
                            title: 'Lý do',
                            dataIndex: 'reason',
                        },
                        {
                            title: 'Người thực hiện',
                            dataIndex: ['creator', 'full_name'],
                        },
                        {
                            title: 'Thời điểm thực hiện',
                            dataIndex: 'created_at',
                            render: (val) => dayjs(val).format('DD/MM/YYYY HH:mm'),
                        }
                    ]}
                    pagination={{ pageSize: 5 }}
                    className="mt-4"
                />
            </Modal>
            </div>
        </div>
    );
};

export default SemesterSettings;
