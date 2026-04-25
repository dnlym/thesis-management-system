import { useState } from 'react';
import { useTopics } from '@/hooks/useTopics';
import { useAuthStore } from '@/store/auth';
import { useTranslation } from 'react-i18next';
import { 
  Search, 
  Filter, 
  User, 
  Users, 
  Calendar, 
  CheckCircle2, 
  Info,
  Loader2,
  BookOpen,
  ArrowRight,
  Target
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { 
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useRegisterTopic } from '@/hooks/useRegistrations';
import { useNavigate } from 'react-router-dom';
import { notify } from '@/utils/notification';
import dayjs from 'dayjs';

const StudentTopics = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState<string>('APPROVED');
    const [selectedTopic, setSelectedTopic] = useState<any>(null);
    const [isRegisterDialogOpen, setIsRegisterDialogOpen] = useState(false);

    const { data, isLoading } = useTopics({ search, status: statusFilter as any });
    const registerMutation = useRegisterTopic();

    const handleRegister = (topic: any) => {
        setSelectedTopic(topic);
        setIsRegisterDialogOpen(true);
    };

    const confirmRegistration = () => {
        if (!selectedTopic) return;
        registerMutation.mutate({ topicId: selectedTopic.id, accepted: true }, {
            onSuccess: () => {
                notify.success('Đăng ký đề tài thành công!');
                setIsRegisterDialogOpen(false);
                setTimeout(() => navigate('/my-topic'), 500);
            },
            onError: (error: any) => {
                notify.error(error.response?.data?.error || 'Đăng ký thất bại');
            }
        });
    };

    return (
        <div className="page-container">
            <div className="page-inner">
                {/* Header */}
                <Card className="page-header-card mb-8">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                        <div className="flex items-center gap-3">
                            <div className="page-header-icon"><BookOpen className="h-5 w-5" /></div>
                            <div>
                                <div className="page-header-title">Khám phá Đề tài Khóa luận</div>
                                <div className="page-header-subtitle">Tìm kiếm và lựa chọn đề tài phù hợp với định hướng phát triển của bạn</div>
                            </div>
                        </div>
                        <div className="flex flex-col sm:flex-row gap-3 min-w-[400px]">
                            <div className="relative flex-1">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                                <Input 
                                    placeholder="Tìm kiếm đề tài, giảng viên..." 
                                    className="pl-9"
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                />
                            </div>
                            <Select value={statusFilter} onValueChange={setStatusFilter}>
                                <SelectTrigger className="w-[180px]">
                                    <SelectValue placeholder="Trạng thái" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="APPROVED">Đang mở đăng ký</SelectItem>
                                    <SelectItem value="REGISTERED">Đã có người đăng ký</SelectItem>
                                    <SelectItem value="COMPLETED">Đã hoàn thành</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </Card>

            {/* Results Grid */}
            {isLoading ? (
                <div className="flex flex-col items-center justify-center py-20 gap-4">
                    <Loader2 className="h-10 w-10 animate-spin text-primary" />
                    <p className="text-muted-foreground font-medium">Đang tải danh sách đề tài...</p>
                </div>
            ) : !data || data?.topics?.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
                    <div className="bg-muted p-6 rounded-full">
                        <Search className="h-12 w-12 text-muted-foreground" />
                    </div>
                    <h3 className="text-xl font-bold">Không tìm thấy đề tài nào</h3>
                    <p className="text-muted-foreground">Thử thay đổi từ khóa tìm kiếm hoặc bộ lọc của bạn.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {data.topics.map((topic: any) => (
                        <Card key={topic.id} className="group flex flex-col hover:shadow-academic transition-all duration-300 border-none bg-card/50 backdrop-blur-sm ring-1 ring-border hover:ring-primary/20">
                            <CardHeader className="pb-3">
                                <div className="flex justify-between items-start mb-2">
                                    <Badge variant="secondary" className="font-mono text-xs tracking-tighter bg-primary/5 text-primary border-primary/10">
                                        {topic.code}
                                    </Badge>
                                    <div className="flex items-center gap-1.5">
                                      <Users className="h-3 w-3 text-muted-foreground" />
                                      <span className="text-xs font-bold tabular-nums">
                                        {topic.current_students}/{topic.max_students}
                                      </span>
                                    </div>
                                </div>
                                <CardTitle className="text-lg line-clamp-2 leading-tight group-hover:text-primary transition-colors h-14">
                                    {topic.title}
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="flex-1 space-y-4">
                                <div className="flex items-center gap-3 p-2 rounded-lg bg-muted/30">
                                    <Avatar className="h-8 w-8 border border-white">
                                        <AvatarImage src={topic.supervisor?.avatar_url} />
                                        <AvatarFallback><User className="h-4 w-4" /></AvatarFallback>
                                    </Avatar>
                                    <div className="min-w-0">
                                        <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Hướng dẫn bởi</p>
                                        <p className="text-sm font-bold truncate">{topic.supervisor?.full_name}</p>
                                    </div>
                                </div>
                                
                                <div className="space-y-2">
                                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                    <Target className="h-3 w-3" />
                                    <span>Chuyên ngành: {topic.department?.name || 'Công nghệ Thông tin'}</span>
                                  </div>
                                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                    <Calendar className="h-3 w-3" />
                                    <span>Đăng ngày: {dayjs(topic.created_at).format('DD/MM/YYYY')}</span>
                                  </div>
                                </div>
                            </CardContent>
                            <CardFooter className="pt-2">
                                <div className="flex gap-2 w-full">
                                    <Button 
                                      variant="outline" 
                                      className="flex-1 rounded-xl"
                                      onClick={() => navigate(`/topics/${topic.id}`)}
                                    >
                                      Chi tiết
                                    </Button>
                                    <Button 
                                      className="flex-1 rounded-xl shadow-soft group/btn"
                                      disabled={topic.current_students >= topic.max_students || topic.status !== 'APPROVED'}
                                      onClick={() => handleRegister(topic)}
                                    >
                                      {topic.current_students >= topic.max_students ? 'Đã hết chỗ' : 'Đăng ký'}
                                      <ArrowRight className="ml-2 h-4 w-4 group-hover/btn:translate-x-1 transition-transform" />
                                    </Button>
                                </div>
                            </CardFooter>
                        </Card>
                    ))}
                </div>
            )}

            {/* Registration Confirmation Dialog */}
            <Dialog open={isRegisterDialogOpen} onOpenChange={setIsRegisterDialogOpen}>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle className="text-2xl">Xác nhận đăng ký đề tài</DialogTitle>
                  <DialogDescription>
                    Vui lòng đọc kỹ thông tin đề tài trước khi thực hiện đăng ký chính thức.
                  </DialogDescription>
                </DialogHeader>
                {selectedTopic && (
                  <div className="space-y-4 py-4">
                    <div className="p-4 rounded-xl bg-primary/5 border border-primary/10">
                      <h4 className="font-bold text-primary mb-1">{selectedTopic.title}</h4>
                      <p className="text-xs text-muted-foreground uppercase tracking-wider">Giảng viên: {selectedTopic.supervisor?.full_name}</p>
                    </div>
                    
                    <Alert className="bg-amber-50 border-amber-200">
                      <Info className="h-4 w-4 text-amber-600" />
                      <AlertTitle className="text-amber-800 font-bold">Lưu ý quan trọng</AlertTitle>
                      <AlertDescription className="text-amber-700 text-xs leading-relaxed">
                        Mỗi sinh viên chỉ được đăng ký tối đa 1 đề tài. Sau khi đăng ký thành công, bạn sẽ cần thực hiện các bước tiếp theo theo lộ trình.
                      </AlertDescription>
                    </Alert>
                  </div>
                )}
                <DialogFooter className="gap-2 sm:gap-0">
                  <Button variant="ghost" onClick={() => setIsRegisterDialogOpen(false)}>Hủy</Button>
                  <Button 
                    onClick={confirmRegistration} 
                    disabled={registerMutation.isPending}
                    className="shadow-soft"
                  >
                    {registerMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Tôi đã hiểu và đăng ký
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            </div>
        </div>
    );
};

export default StudentTopics;
