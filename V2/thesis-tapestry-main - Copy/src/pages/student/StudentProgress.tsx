import { useAuthStore } from '@/store/auth';
import { useRegistrations, useRegistrationLogs } from '@/hooks/useRegistrations';
import { 
  CheckCircle2, 
  Clock, 
  Circle, 
  User, 
  FileText, 
  MessageSquare, 
  Calendar,
  AlertCircle,
  Loader2,
  ChevronRight,
  History,
  Activity
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { 
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import dayjs from 'dayjs';
import { useTranslation } from 'react-i18next';

const PROGRESS_STEPS = [
  { id: 'HAS_TOPIC', label: 'Đăng ký đề tài', icon: CheckCircle2, description: 'Lựa chọn và đăng ký đề tài ' },
  { id: 'SUBMITTED_PROPOSAL', label: 'Đề cương chi tiết', icon: FileText, description: 'Nộp thuyết minh đề cương' },
  { id: 'SUBMITTED_THESIS', label: 'Thực hiện & Báo cáo', icon: Activity, description: 'Nộp báo cáo chính thức' },
  { id: 'ADVISOR_GRADED', label: 'Chấm điểm & Phản biện', icon: MessageSquare, description: 'GVHD & GV PB chấm điểm' },
  { id: 'COMPLETED', label: 'Hoàn thành', icon: CheckCircle2, description: 'Cấp chứng nhận hoàn tất' },
];

const StudentProgress = () => {
    const { t } = useTranslation();
    const { user } = useAuthStore();
    const { data: registrations, isLoading } = useRegistrations({ status: 'CONFIRMED' }) as any;
    const myRegistration = registrations?.[0];
    const { data: logs, isLoading: loadingLogs } = useRegistrationLogs(myRegistration?.id);

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center py-20 gap-4 h-[calc(100vh-100px)]">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
                <p className="text-muted-foreground font-medium italic">Đang cập nhật lộ trình của bạn...</p>
            </div>
        );
    }

    if (!myRegistration) {
        return (
            <div className="container max-w-4xl mx-auto p-10">
                <Alert className="bg-amber-50 border-amber-200 p-8 shadow-soft">
                    <AlertCircle className="h-8 w-8 text-amber-600" />
                    <div className="ml-4">
                        <AlertTitle className="text-xl font-bold text-amber-800 mb-2">Chưa có đề tài nào được đăng ký</AlertTitle>
                        <AlertDescription className="text-amber-700 text-lg">
                            Bạn cần đăng ký đề tài và được phê duyệt trước khi có thể theo dõi tiến độ.
                        </AlertDescription>
                        <div className="mt-6 flex gap-4">
                            <a href="/topics" className="inline-flex h-10 items-center justify-center rounded-md bg-amber-600 px-8 text-sm font-bold text-white shadow transition-colors hover:bg-amber-700">
                                Xem danh sách đề tài
                            </a>
                        </div>
                    </div>
                </Alert>
            </div>
        );
    }

    const currentStatus = myRegistration.studentProgressStatus;
    const currentStepIndex = PROGRESS_STEPS.findIndex(s => s.id === currentStatus);
    const progressPercentage = ((currentStepIndex + 1) / PROGRESS_STEPS.length) * 100;

    return (
        <div className="container mx-auto p-4 md:p-10 space-y-10 animate-in fade-in slide-in-from-bottom-5 duration-700">
            {/* Header & Overview */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div className="space-y-2">
                    <h1 className="text-4xl font-extrabold tracking-tight">Tiến độ Khóa luận</h1>
                    <p className="text-lg text-muted-foreground font-medium">Lộ trình học tập & Hồ sơ năng lực của bạn</p>
                </div>
                <div className="flex items-center gap-3 bg-muted/50 p-2 pr-4 rounded-full border ring-offset-background">
                    <Badge variant="outline" className="rounded-full px-3 py-1 bg-background text-primary font-bold border-primary/20">
                      Học kỳ I, 2024 - 2025
                    </Badge>
                    <span className="text-sm font-medium text-muted-foreground">Mã nhóm: {myRegistration.group?.name}</span>
                </div>
            </div>

            {/* Progress Visualization */}
            <Card className="border-none shadow-academic bg-gradient-to-br from-white to-blue-50/30">
                <CardContent className="p-8 md:p-12 space-y-12">
                    <div className="space-y-4">
                        <div className="flex justify-between items-end mb-2">
                            <h3 className="text-2xl font-bold flex items-center gap-3">
                              <CheckCircle2 className="h-6 w-6 text-primary" />
                              Tiến độ hiện tại
                            </h3>
                            <span className="text-4xl font-black tabular-nums text-primary">
                              {Math.round(progressPercentage)}%
                            </span>
                        </div>
                        <Progress value={progressPercentage} className="h-3 rounded-full bg-blue-100 [&>div]:bg-gradient-to-r [&>div]:from-blue-500 [&>div]:to-academic-primary shadow-inner" />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-5 gap-6 relative">
                        {/* Connecting Line (hidden on mobile) */}
                        <div className="absolute top-[26px] left-[10%] right-[10%] h-0.5 bg-muted hidden md:block" />
                        
                        {PROGRESS_STEPS.map((step, idx) => {
                            const isCompleted = idx <= currentStepIndex;
                            const isCurrent = idx === currentStepIndex;
                            const Icon = step.icon;

                            return (
                                <div key={step.id} className="relative z-10 flex flex-col items-center text-center space-y-4 group">
                                    <div className={`
                                        h-12 w-12 rounded-full flex items-center justify-center border-4 transition-all duration-500
                                        ${isCompleted ? 'bg-primary border-primary text-white shadow-lg' : 'bg-background border-muted text-muted-foreground'}
                                        ${isCurrent ? 'ring-4 ring-primary/20 scale-110 animate-pulse' : ''}
                                    `}>
                                        <Icon className="h-5 w-5" />
                                    </div>
                                    <div className="space-y-1 px-4">
                                        <p className={`text-sm font-bold ${isCompleted ? 'text-foreground' : 'text-muted-foreground'}`}>{step.label}</p>
                                        <p className="text-[10px] text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity leading-tight max-w-[120px] mx-auto">
                                            {step.description}
                                        </p>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </CardContent>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Main Info */}
                <div className="lg:col-span-2 space-y-8">
                    <Tabs defaultValue="overview" className="w-full">
                        <TabsList className="bg-muted/50 p-1 rounded-xl mb-6">
                            <TabsTrigger value="overview" className="rounded-lg px-6 font-bold">Tổng quan</TabsTrigger>
                            <TabsTrigger value="history" className="rounded-lg px-6 font-bold">Lịch sử hoạt động</TabsTrigger>
                        </TabsList>
                        
                        <TabsContent value="overview" className="space-y-6 animate-in fade-in duration-500">
                            <Card className="border-none shadow-soft overflow-hidden">
                                <CardHeader className="bg-primary/5 pb-6">
                                    <div className="flex items-center gap-2 mb-2">
                                      <FileText className="h-4 w-4 text-primary" />
                                      <span className="text-xs font-bold text-primary uppercase tracking-wider">Thông tin đề tài</span>
                                    </div>
                                    <CardTitle className="text-2xl leading-tight">{myRegistration.topic?.title}</CardTitle>
                                </CardHeader>
                                <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-8 p-8">
                                    <div className="space-y-6">
                                        <div className="space-y-3">
                                            <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                                              <User className="h-3 w-3" />
                                              Giảng viên hướng dẫn
                                            </p>
                                            <div className="flex items-center gap-4 p-4 rounded-xl border bg-muted/20">
                                                <Avatar className="h-10 w-10 ring-2 ring-primary/10 ring-offset-background">
                                                    <AvatarImage src={myRegistration.topic?.supervisor?.avatarUrl} />
                                                    <AvatarFallback>GV</AvatarFallback>
                                                </Avatar>
                                                <div>
                                                    <p className="font-bold text-lg">{myRegistration.topic?.supervisor?.fullName}</p>
                                                    <p className="text-xs text-muted-foreground">{myRegistration.topic?.supervisor?.email || 'Chưa cung cấp email'}</p>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="space-y-3">
                                            <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                                              <MessageSquare className="h-3 w-3" />
                                              Phản hồi gần nhất
                                            </p>
                                            <div className="p-4 rounded-xl border bg-yellow-50/50 italic text-sm text-amber-900 leading-relaxed border-amber-100">
                                              {myRegistration.feedback ? `"${myRegistration.feedback}"` : "Chưa có phản hồi mới từ giảng viên."}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-6">
                                        <div className="space-y-3">
                                            <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                                              <Calendar className="h-3 w-3" />
                                              Thông tin nhóm
                                            </p>
                                            <div className="space-y-4 border rounded-xl p-4 bg-muted/10">
                                                {myRegistration.group?.members?.map((member: any) => (
                                                  <div key={member.id} className="flex items-center justify-between">
                                                    <div className="flex items-center gap-3">
                                                      <Avatar className="h-7 w-7">
                                                        <AvatarFallback className="text-[10px]">{member.user?.fullName?.[0]}</AvatarFallback>
                                                      </Avatar>
                                                      <span className="text-sm font-medium">{member.user?.fullName}</span>
                                                    </div>
                                                    <Badge variant="outline" className="text-[10px] font-mono">{member.user?.studentCode}</Badge>
                                                  </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </TabsContent>

                        <TabsContent value="history" className="animate-in fade-in duration-500">
                            <Card className="border-none shadow-soft">
                                <CardContent className="p-0">
                                  {loadingLogs ? (
                                    <div className="p-10 flex justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>
                                  ) : logs?.length === 0 ? (
                                    <div className="p-10 text-center text-muted-foreground">Chưa có lịch sử hoạt động nào</div>
                                  ) : (
                                    <div className="divide-y">
                                      {logs?.map((log: any, idx: number) => (
                                        <div key={log.id} className="p-6 flex gap-4 hover:bg-muted/30 transition-colors">
                                          <div className="flex-shrink-0 mt-1">
                                            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                                              <History className="h-4 w-4 text-primary" />
                                            </div>
                                          </div>
                                          <div className="flex-grow space-y-1">
                                            <div className="flex justify-between items-start">
                                                <p className="text-sm font-bold">{log.action}</p>
                                                <span className="text-[10px] text-muted-foreground">{dayjs(log.created_at).format('DD/MM/YYYY HH:mm')}</span>
                                            </div>
                                            <p className="text-xs text-muted-foreground">Thực hiện bởi: <span className="font-medium text-foreground">{log.user?.full_name}</span></p>
                                            {log.new_value?.feedback && (
                                              <div className="mt-2 text-xs italic text-muted-foreground bg-muted p-2 rounded-md border-l-2 border-primary">
                                                "{log.new_value.feedback}"
                                              </div>
                                            )}
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </CardContent>
                            </Card>
                        </TabsContent>
                    </Tabs>
                </div>

                {/* Side Actions/Deadlines */}
                <div className="space-y-6">
                    <Card className="border-none shadow-soft bg-primary text-primary-foreground">
                        <CardHeader>
                            <CardTitle className="text-lg">Thời hạn quan trọng</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {[
                                { date: '15/01', label: 'Hết hạn đăng ký' },
                                { date: '30/01', label: 'Nộp đề cương chi tiết' },
                                { date: '15/05', label: 'Nộp báo cáo chính thức' }
                            ].map((d, i) => (
                                <div key={i} className="flex items-center justify-between border-b border-primary-foreground/20 pb-3 last:border-0 last:pb-0">
                                    <span className="text-sm border rounded px-1.5 font-mono bg-white/10">{d.date}</span>
                                    <span className="text-sm font-medium opacity-90">{d.label}</span>
                                </div>
                            ))}
                        </CardContent>
                    </Card>

                    <Card className="border-none shadow-soft ring-1 ring-border">
                        <CardHeader>
                            <CardTitle className="text-lg">Hỗ trợ & Tài liệu</CardTitle>
                        </CardHeader>
                        <CardContent className="p-0">
                            <div className="divide-y divide-border">
                                <a href="#" className="flex items-center justify-between p-4 hover:bg-muted transition-colors group">
                                    <div className="flex items-center gap-3">
                                        <FileText className="h-4 w-4 text-muted-foreground group-hover:text-primary" />
                                        <span className="text-sm font-medium">Quy chế làm khóa luận</span>
                                    </div>
                                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                                </a>
                                <a href="#" className="flex items-center justify-between p-4 hover:bg-muted transition-colors group">
                                    <div className="flex items-center gap-3">
                                        <FileText className="h-4 w-4 text-muted-foreground group-hover:text-primary" />
                                        <span className="text-sm font-medium">Mẫu bìa & Nội dung đề cương</span>
                                    </div>
                                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                                </a>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
};

export default StudentProgress;
