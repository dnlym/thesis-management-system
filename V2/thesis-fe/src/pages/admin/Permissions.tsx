import React, { useState, useEffect } from 'react';
import { usePermissions } from '@/hooks/usePermissions';
import { UserRole } from '@/types';
import { 
    Shield, 
    Save, 
    RefreshCcw, 
    CheckCircle2, 
    XCircle, 
    Info,
    Lock,
    Unlock,
    Database,
    AlertTriangle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { 
    Table, 
    TableBody, 
    TableCell, 
    TableHead, 
    TableHeader, 
    TableRow 
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { 
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip';

const ROLE_LABELS: Record<UserRole, string> = {
    ADMIN: 'Quản trị viên',
    HEAD: 'Trưởng bộ môn',
    LECTURER: 'Giảng viên',
    STUDENT: 'Sinh viên'
};

const CATEGORY_LABELS: Record<string, string> = {
    TOPIC: 'Quản lý Đề tài',
    GROUP: 'Quản lý Nhóm',
    GRADING: 'Chấm điểm',
    SYSTEM: 'Hệ thống'
};

const ManagePermissions: React.FC = () => {
    const { matrix, isLoading, updatePermissions, isUpdating, seedPermissions, isSeeding } = usePermissions();
    const [activeRole, setActiveRole] = useState<UserRole>('LECTURER');
    const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
    const [hasChanges, setHasChanges] = useState(false);

    // Initialize selected permissions when matrix or active role changes
    useEffect(() => {
        if (matrix && matrix.matrix[activeRole]) {
            // Find IDs for codes
            const currentCodes = matrix.matrix[activeRole];
            const currentIds = matrix.permissions
                .filter(p => currentCodes.includes(p.code))
                .map(p => p.id);
            setSelectedPermissions(currentIds);
            setHasChanges(false);
        }
    }, [matrix, activeRole]);

    const handleTogglePermission = (permissionId: string) => {
        setSelectedPermissions(prev => {
            const next = prev.includes(permissionId)
                ? prev.filter(id => id !== permissionId)
                : [...prev, permissionId];
            setHasChanges(true);
            return next;
        });
    };

    const handleSave = () => {
        updatePermissions({ role: activeRole, permissionIds: selectedPermissions });
    };

    const handleSeed = () => {
        if (window.confirm('Thao tác này sẽ khởi tạo lại toàn bộ quyền mặc định. Bạn có chắc chắn?')) {
            seedPermissions();
        }
    };

    if (isLoading) {
        return (
            <div className="space-y-6 p-6">
                <Skeleton className="h-10 w-48" />
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    <Skeleton className="h-[600px] md:col-span-1" />
                    <Skeleton className="h-[600px] md:col-span-3" />
                </div>
            </div>
        );
    }

    if (!matrix || matrix.permissions.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-[600px] space-y-4">
                <AlertTriangle className="h-12 w-12 text-yellow-500" />
                <h2 className="text-xl font-semibold">Chưa có dữ liệu phân quyền</h2>
                <p className="text-muted-foreground">Vui lòng khởi tạo dữ liệu mẫu để bắt đầu.</p>
                <Button onClick={handleSeed} disabled={isSeeding}>
                    {isSeeding ? <RefreshCcw className="mr-2 h-4 w-4 animate-spin" /> : <Database className="mr-2 h-4 w-4" />}
                    Khởi tạo dữ liệu mẫu
                </Button>
            </div>
        );
    }

    // Group permissions by category
    const groupedPermissions = matrix.permissions.reduce((acc, p) => {
        const cat = p.category || 'SYSTEM';
        if (!acc[cat]) acc[cat] = [];
        acc[cat].push(p);
        return acc;
    }, {} as Record<string, typeof matrix.permissions>);

    return (
        <div className="container mx-auto py-6 space-y-6 animate-in fade-in duration-500">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg">
                        <Shield className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">Quản lý Phân quyền</h1>
                        <p className="text-muted-foreground">Thiết lập quyền hạn cho từng vai trò trong hệ thống.</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={handleSeed} disabled={isSeeding}>
                        {isSeeding ? <RefreshCcw className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCcw className="mr-2 h-4 w-4" />}
                        Reset về mặc định
                    </Button>
                    <Button onClick={handleSave} disabled={!hasChanges || isUpdating}>
                        {isUpdating ? <RefreshCcw className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                        Lưu thay đổi
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                {/* Role Selection Sidebar */}
                <Card className="md:col-span-3 h-fit sticky top-6">
                    <CardHeader>
                        <CardTitle className="text-lg">Vai trò</CardTitle>
                        <CardDescription>Chọn vai trò để chỉnh sửa quyền</CardDescription>
                    </CardHeader>
                    <CardContent className="p-2">
                        <div className="flex flex-col gap-1">
                            {(Object.keys(ROLE_LABELS) as UserRole[]).map((role) => (
                                <button
                                    key={role}
                                    onClick={() => setActiveRole(role)}
                                    className={`flex items-center justify-between px-4 py-3 rounded-md transition-all ${
                                        activeRole === role 
                                            ? 'bg-primary text-primary-foreground shadow-md font-medium translate-x-1' 
                                            : 'hover:bg-muted text-muted-foreground'
                                    }`}
                                >
                                    <div className="flex items-center gap-2">
                                        {activeRole === role ? <Unlock className="h-4 w-4" /> : <Lock className="h-4 w-4 opacity-50" />}
                                        {ROLE_LABELS[role]}
                                    </div>
                                    <Badge variant={activeRole === role ? 'secondary' : 'outline'} className="text-[10px]">
                                        {matrix.matrix[role]?.length || 0}
                                    </Badge>
                                </button>
                            ))}
                        </div>
                    </CardContent>
                </Card>

                {/* Permissions Matrix */}
                <Card className="md:col-span-9 overflow-hidden">
                    <CardHeader className="border-b bg-muted/30">
                        <div className="flex items-center justify-between">
                            <div>
                                <CardTitle className="text-xl">
                                    Quyền hạn: <span className="text-primary">{ROLE_LABELS[activeRole]}</span>
                                </CardTitle>
                                <CardDescription>
                                    Vai trò này hiện có {selectedPermissions.length} quyền được kích hoạt.
                                </CardDescription>
                            </div>
                            {hasChanges && (
                                <Badge variant="destructive" className="animate-pulse">
                                    Có thay đổi chưa lưu
                                </Badge>
                            )}
                        </div>
                    </CardHeader>
                    <CardContent className="p-0">
                        <Tabs defaultValue={Object.keys(groupedPermissions)[0]} className="w-full">
                            <TabsList className="w-full justify-start rounded-none border-b h-12 px-4 bg-transparent">
                                {Object.keys(groupedPermissions).map((cat) => (
                                    <TabsTrigger 
                                        key={cat} 
                                        value={cat}
                                        className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent h-full px-4"
                                    >
                                        {CATEGORY_LABELS[cat] || cat}
                                    </TabsTrigger>
                                ))}
                            </TabsList>
                            
                            {Object.entries(groupedPermissions).map(([cat, perms]) => (
                                <TabsContent key={cat} value={cat} className="m-0 focus-visible:ring-0">
                                    <Table>
                                        <TableHeader className="bg-muted/50">
                                            <TableRow>
                                                <TableHead className="w-[80px] text-center">Cho phép</TableHead>
                                                <TableHead>Tên quyền</TableHead>
                                                <TableHead>Mã định danh</TableHead>
                                                <TableHead className="hidden md:table-cell">Mô tả</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {perms.map((p) => (
                                                <TableRow 
                                                    key={p.id}
                                                    className="hover:bg-primary/5 transition-colors group cursor-pointer"
                                                    onClick={() => handleTogglePermission(p.id)}
                                                >
                                                    <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                                                        <Checkbox 
                                                            checked={selectedPermissions.includes(p.id)}
                                                            onCheckedChange={() => handleTogglePermission(p.id)}
                                                            className="h-5 w-5"
                                                        />
                                                    </TableCell>
                                                    <TableCell className="font-medium">
                                                        <div className="flex items-center gap-2">
                                                            {p.name}
                                                            <TooltipProvider>
                                                                <Tooltip>
                                                                    <TooltipTrigger asChild>
                                                                        <Info className="h-4 w-4 text-muted-foreground/50 hidden group-hover:block" />
                                                                    </TooltipTrigger>
                                                                    <TooltipContent>
                                                                        <p>{p.description || 'Không có mô tả chi tiết'}</p>
                                                                    </TooltipContent>
                                                                </Tooltip>
                                                            </TooltipProvider>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>
                                                        <code className="text-xs bg-muted px-1.5 py-0.5 rounded text-primary">
                                                            {p.code}
                                                        </code>
                                                    </TableCell>
                                                    <TableCell className="text-muted-foreground text-sm hidden md:table-cell">
                                                        {p.description}
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </TabsContent>
                            ))}
                        </Tabs>
                    </CardContent>
                </Card>
            </div>

            <Alert className="bg-primary/5 border-primary/20">
                <Info className="h-4 w-4 text-primary" />
                <AlertTitle>Thông tin quan trọng</AlertTitle>
                <AlertDescription className="text-muted-foreground">
                    Hệ thống sử dụng mô hình <strong>Triple-Check</strong>: Các quyền ở đây là quyền cơ sở. 
                    Hành động thực tế sẽ được kiểm tra thêm dựa trên <strong>Ngữ cảnh (Topic Context)</strong> và <strong>Giai đoạn (Semester Phase)</strong> tại Backend.
                </AlertDescription>
            </Alert>
        </div>
    );
};

export default ManagePermissions;
