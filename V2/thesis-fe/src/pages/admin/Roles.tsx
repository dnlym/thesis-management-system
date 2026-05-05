import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { 
  Shield, 
  Search, 
  Save, 
  RefreshCcw, 
  ChevronRight,
  Users,
  Lock,
  Info,
  Plus
} from 'lucide-react';
import { Card } from 'antd';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { PermissionsApi } from '@/api/permissions';
import { UsersApi } from '@/api/users';
import PermissionGroup from '@/components/admin/PermissionGroup';
import { cn } from '@/lib/utils';

const Roles: React.FC = () => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [selectedRoleId, setSelectedRoleId] = useState<string>('STUDENT');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPermissions, setCurrentPermissions] = useState<string[]>([]);

  // Roles definition
  const roles = [
    { id: 'STUDENT', name: 'Sinh viên', description: 'Người học trong hệ thống' },
    { id: 'LECTURER', name: 'Giảng viên', description: 'Giảng viên hướng dẫn & Phản biện' },
    { id: 'HEAD', name: 'Trưởng bộ môn', description: 'Quản lý chuyên môn bộ môn' },
    { id: 'ADMIN', name: 'Quản trị viên', description: 'Quản trị hệ thống toàn diện' },
  ].filter(r => r.name.toLowerCase().includes(searchQuery.toLowerCase()) || r.id.toLowerCase().includes(searchQuery.toLowerCase()));

  // Fetch permissions matrix
  const { data: matrixData, isLoading: isLoadingMatrix } = useQuery({
    queryKey: ['permissions-matrix'],
    queryFn: () => PermissionsApi.getMatrix(),
  });

  // Fetch role statistics
  const { data: roleStats } = useQuery({
    queryKey: ['roles-summary'],
    queryFn: () => UsersApi.getRoleSummary(),
  });

  // Update current permissions when role changes or data loaded
  useEffect(() => {
    if (matrixData?.matrix && selectedRoleId) {
      setCurrentPermissions(matrixData.matrix[selectedRoleId] || []);
    }
  }, [matrixData, selectedRoleId]);

  // Update permissions mutation
  const updateMutation = useMutation({
    mutationFn: ({ role, permissions }: { role: string; permissions: string[] }) =>
      PermissionsApi.updateRolePermissions(role, permissions),
    onSuccess: () => {
      toast.success('Cập nhật quyền hạn thành công');
      queryClient.invalidateQueries({ queryKey: ['permissions-matrix'] });
    },
    onError: (error: any) => {
      toast.error('Lỗi cập nhật: ' + (error.response?.data?.message || error.message));
    },
  });

  const handleSave = () => {
    updateMutation.mutate({
      role: selectedRoleId,
      permissions: currentPermissions,
    });
  };

  const handleTogglePermission = (code: string) => {
    setCurrentPermissions(prev => 
      prev.includes(code) ? prev.filter(c => c !== code) : [...prev, code]
    );
  };

  const handleToggleAllGroup = (codes: string[], checked: boolean) => {
    if (checked) {
      setCurrentPermissions(prev => Array.from(new Set([...prev, ...codes])));
    } else {
      setCurrentPermissions(prev => prev.filter(c => !codes.includes(c)));
    }
  };

  const getUserCount = (roleId: string) => {
    return roleStats?.find(s => s.id === roleId)?.userCount || 0;
  };

  // Group permissions by category
  const groupedPermissions = React.useMemo(() => {
    if (!matrixData?.permissions) return {};
    const groups: Record<string, any[]> = {};
    matrixData.permissions.forEach(p => {
      if (!groups[p.category]) groups[p.category] = [];
      groups[p.category].push(p);
    });
    return groups;
  }, [matrixData]);

  if (isLoadingMatrix) {
    return (
      <div className="p-8 space-y-6">
        <Skeleton className="h-12 w-1/3" />
        <div className="grid grid-cols-12 gap-6">
          <Skeleton className="col-span-3 h-[600px]" />
          <Skeleton className="col-span-9 h-[600px]" />
        </div>
      </div>
    );
  }

  const selectedRole = roles.find(r => r.id === selectedRoleId) || roles[0];

  return (
    <div className="min-h-screen bg-background/50 p-6 space-y-6">
      {/* Header Section */}
      <Card className="page-header-card">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="page-header-icon"><Lock className="h-4 w-4" /></div>
            <div>
              <div className="page-header-title">Quản lý Vai trò & Phân quyền</div>
              <div className="page-header-subtitle">Thiết lập và kiểm soát quyền truy cập cho từng nhóm người dùng</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative w-48 md:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input 
                placeholder="Tìm kiếm vai trò..." 
                className="pl-8 bg-muted/30 border-none focus-visible:ring-1 h-9 text-[13px]"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <Button variant="outline" size="sm" className="gap-1.5 h-9 rounded-lg text-[12px] font-bold border-slate-200">
              <RefreshCcw className="h-3.5 w-3.5" />
              Làm mới
            </Button>
            <Button size="sm" className="gap-1.5 h-9 rounded-lg bg-primary shadow-md shadow-primary/10 text-[12px] font-bold">
              <Plus className="h-3.5 w-3.5" />
              Tạo vai trò
            </Button>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-12 gap-6">
        {/* Sidebar - Role List */}
        <div className="col-span-12 lg:col-span-3 space-y-4">
          <div className="bg-card rounded-2xl border shadow-sm overflow-hidden">
            <div className="p-4 border-b bg-muted/30 flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Vai trò hệ thống</span>
              <Badge variant="secondary" className="rounded-full">{roles.length}</Badge>
            </div>
            <div className="p-2 space-y-1">
              {roles.map((role) => (
                <button
                  key={role.id}
                  onClick={() => setSelectedRoleId(role.id)}
                  className={cn(
                    "w-full flex items-center justify-between p-4 rounded-xl transition-all duration-200 group text-left",
                    selectedRoleId === role.id 
                      ? "bg-primary text-primary-foreground shadow-md shadow-primary/20 translate-x-1" 
                      : "hover:bg-muted text-muted-foreground hover:text-foreground"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "h-2 w-2 rounded-full",
                      selectedRoleId === role.id ? "bg-white animate-pulse" : "bg-muted-foreground/30"
                    )} />
                    <div>
                      <div className="text-[14px] font-bold">{role.name}</div>
                      <div className={cn(
                        "text-[11px] mt-0.5",
                        selectedRoleId === role.id ? "text-primary-foreground/70" : "text-muted-foreground"
                      )}>
                        {getUserCount(role.id)} người dùng
                      </div>
                    </div>
                  </div>
                  <ChevronRight className={cn(
                    "h-4 w-4 transition-transform",
                    selectedRoleId === role.id ? "rotate-90" : "opacity-0 group-hover:opacity-100"
                  )} />
                </button>
              ))}
            </div>
          </div>

          <div className="bg-blue-50/50 dark:bg-blue-950/20 p-5 rounded-2xl border border-blue-100 dark:border-blue-900/30">
            <div className="flex gap-3">
              <Info className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-sm font-bold text-blue-900 dark:text-blue-300">Mẹo phân quyền</h4>
                <p className="text-xs text-blue-700/80 dark:text-blue-400/70 mt-1 leading-relaxed">
                  Thay đổi quyền hạn sẽ có hiệu lực ngay lập tức cho tất cả người dùng thuộc vai trò này sau khi họ tải lại trang.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content - Permission Matrix */}
        <div className="col-span-12 lg:col-span-9 space-y-6">
          <div className="bg-card rounded-2xl border shadow-sm flex flex-col h-[650px] relative overflow-hidden">
            {/* Role Header */}
            <div className="px-6 py-4 border-b flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary shadow-sm">
                  <Shield className="h-4 w-4" />
                </div>
                <div>
                  <h2 className="text-[14px] font-bold uppercase tracking-tight">
                    PHÂN QUYỀN: <span className="text-primary">{selectedRole?.name}</span>
                  </h2>
                  <p className="text-[11px] text-muted-foreground">{selectedRole?.description}</p>
                </div>
              </div>
              <Badge variant="outline" className="px-3 py-1 bg-primary/5 text-primary border-primary/20 text-[10px] font-bold uppercase rounded-full">
                {currentPermissions.length} quyền đã chọn
              </Badge>
            </div>

            <ScrollArea className="flex-1">
              <div className="p-6 pb-24">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={selectedRoleId}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.2 }}
                  >
                    <div className="space-y-6">
                      {Object.entries(groupedPermissions).map(([category, perms]) => (
                        <PermissionGroup
                          key={category}
                          title={category}
                          permissions={perms}
                          selectedCodes={currentPermissions}
                          onToggle={handleTogglePermission}
                          onToggleAll={handleToggleAllGroup}
                        />
                      ))}

                      {Object.keys(groupedPermissions).length === 0 && (
                        <div className="text-center py-12 border-2 border-dashed rounded-xl border-muted">
                          <p className="text-muted-foreground">Không tìm thấy quyền hạn nào trong Database.</p>
                        </div>
                      )}
                    </div>
                  </motion.div>
                </AnimatePresence>
              </div>
            </ScrollArea>

            {/* Footer Actions */}
            <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-card via-card to-transparent border-t backdrop-blur-sm flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <div className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
                Lưu lại để áp dụng các thay đổi quyền hạn.
              </div>
              <div className="flex items-center gap-3">
                <Button 
                  variant="outline" 
                  className="gap-2 h-11 px-6 rounded-xl"
                  onClick={() => setCurrentPermissions(matrixData?.matrix[selectedRoleId] || [])}
                >
                  <RefreshCcw className="h-4 w-4" />
                  Đặt lại
                </Button>
                <Button 
                  className="gap-2 h-11 px-8 rounded-xl shadow-lg shadow-primary/20"
                  onClick={handleSave}
                  disabled={updateMutation.isPending}
                >
                  {updateMutation.isPending ? (
                    <RefreshCcw className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  Lưu thay đổi
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Roles;
