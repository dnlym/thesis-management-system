import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { 
  Shield, 
  Search,
  RefreshCcw, 
  Users,
  Lock,
} from 'lucide-react';
import { Card } from 'antd';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { UsersApi } from '@/api/users';
import { cn } from '@/lib/utils';
import { CheckCircleOutlined } from '@ant-design/icons';

const Roles: React.FC = () => {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch role statistics
  const { data: roleStats, isLoading, refetch } = useQuery({
    queryKey: ['roles-summary'],
    queryFn: () => UsersApi.getRoleSummary(),
  });

  // Roles definition
  const roles = [
    { 
      id: 'STUDENT', 
      name: 'Sinh viên', 
      description: 'Người học trong hệ thống',
      features: ['Xem danh sách đề tài', 'Đăng ký nhóm & đề tài', 'Xem kết quả đánh giá']
    },
    { 
      id: 'LECTURER', 
      name: 'Giảng viên', 
      description: 'Giảng viên hướng dẫn & Phản biện',
      features: ['Đề xuất đề tài', 'Đánh giá sinh viên hướng dẫn (Giữa & Cuối kỳ)', 'Chấm điểm phản biện & Hội đồng']
    },
    { 
      id: 'HEAD', 
      name: 'Trưởng bộ môn', 
      description: 'Quản lý chuyên môn bộ môn',
      features: ['Phê duyệt đề tài', 'Phân công phản biện & Hội đồng', 'Duyệt điểm cộng & sửa điểm', 'Cấu hình tiêu chí đánh giá']
    },
    { 
      id: 'COORDINATOR', 
      name: 'Người phụ trách khóa luận', 
      description: 'Quản lý chung, lên lịch và xếp hội đồng',
      features: ['Quản lý danh sách đề tài', 'Phân công phản biện & Hội đồng', 'Theo dõi tiến độ chấm điểm', 'Xem kết quả khóa luận']
    },
    { 
      id: 'ADMIN', 
      name: 'Quản trị viên', 
      description: 'Quản trị hệ thống toàn diện',
      features: ['Quản lý tài khoản người dùng', 'Cấu hình thời gian học kỳ', 'Truy cập nhật ký hệ thống', 'Toàn quyền can thiệp dữ liệu']
    },
  ].filter(r => r.name.toLowerCase().includes(searchQuery.toLowerCase()) || r.id.toLowerCase().includes(searchQuery.toLowerCase()));

  const getUserCount = (roleId: string) => {
    return roleStats?.find(s => s.id === roleId)?.userCount || 0;
  };

  if (isLoading) {
    return (
      <div className="p-8 space-y-6">
        <Skeleton className="h-12 w-1/3" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1,2,3].map(i => <Skeleton key={i} className="h-48" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background/50 p-6 space-y-6">
      {/* Header Section */}
      <Card className="page-header-card">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="page-header-icon"><Lock className="h-4 w-4" /></div>
            <div>
              <div className="page-header-title">Danh sách Vai trò</div>
              <div className="page-header-subtitle">Xem các vai trò mặc định (RBAC) và số lượng người dùng</div>
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
            <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-1.5 h-9 rounded-lg text-[12px] font-bold border-slate-200">
              <RefreshCcw className="h-3.5 w-3.5" />
              Làm mới
            </Button>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {roles.map((role) => (
          <div key={role.id} className="bg-card rounded-2xl border shadow-sm p-6 hover:shadow-md transition-shadow flex flex-col h-full">
            <div className="flex items-start justify-between mb-4">
              <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                <Shield className="h-6 w-6" />
              </div>
              <Badge variant="secondary" className="px-3 py-1 text-xs font-bold uppercase rounded-full">
                {role.id}
              </Badge>
            </div>
            <h3 className="text-lg font-bold mb-2">{role.name}</h3>
            <p className="text-sm text-muted-foreground mb-4">
              {role.description}
            </p>
            
            <div className="mb-6 space-y-2 flex-1">
              <div className="text-xs font-bold text-slate-500 uppercase">Quyền hạn chính:</div>
              <ul className="space-y-1.5">
                {role.features.map((feature, idx) => (
                  <li key={idx} className="text-sm text-slate-700 flex items-start gap-2">
                    <CheckCircleOutlined className="text-emerald-500 mt-0.5 text-xs" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="flex items-center gap-2 pt-4 border-t text-sm font-semibold text-slate-700 mt-auto">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span>{getUserCount(role.id)} người dùng</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Roles;
