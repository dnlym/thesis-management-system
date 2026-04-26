import React from 'react';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/store/auth';
import { useDashboardStats } from '@/hooks/useDashboard';
import { 
  Clock, 
  CheckCircle2, 
  AlertTriangle, 
  Trophy, 
  Calendar as CalendarIcon, 
  Star,
  FileText,
  Users,
  ChevronRight,
  LayoutDashboard,
  Flame,
  Layout
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import { Link } from 'react-router-dom';
import { DashboardStats } from '@/api/dashboard';

const Dashboard = () => {
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const { data: statsData, isLoading } = useDashboardStats();

  const stats = (statsData || {}) as DashboardStats;
  const activeSemester = stats.activeSemester;
  const milestones = stats.milestones || [];

  if (isLoading) {
    return (
      <div className="p-6 space-y-6 animate-pulse bg-slate-50 min-h-screen">
        <div className="h-28 bg-slate-200 rounded-xl w-full" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <div key={i} className="h-28 bg-slate-200 rounded-xl" />)}
        </div>
        <div className="grid grid-cols-12 gap-6">
          <div className="col-span-12 lg:col-span-8 h-80 bg-slate-200 rounded-xl" />
          <div className="col-span-12 lg:col-span-4 h-80 bg-slate-200 rounded-xl" />
        </div>
      </div>
    );
  }

  const actionableStats = [
    { 
      label: 'CẦN CHẤM', 
      value: stats.reviewAssignmentsCount || 0, 
      icon: Clock, 
      color: 'text-rose-500', 
      bgColor: 'bg-rose-50',
    },
    { 
      label: 'CHỜ DUYỆT', 
      value: stats.pendingApprovalTopics || 0, 
      icon: CheckCircle2, 
      color: 'text-amber-500', 
      bgColor: 'bg-amber-50',
    },
    { 
      label: 'SẮP HẾT HẠN', 
      value: milestones.filter((m: any) => m.isUrgent).length, 
      icon: AlertTriangle, 
      color: 'text-orange-500', 
      bgColor: 'bg-orange-50',
    },
    { 
      label: 'HOÀN THÀNH', 
      value: `${Math.round(stats.completionRate || 0)}%`, 
      icon: Trophy, 
      color: 'text-emerald-500', 
      bgColor: 'bg-emerald-50',
      isProgress: true
    },
  ];

  const quickActions = [
    { title: 'Chấm điểm', icon: Star, color: 'text-amber-400', path: '/evaluation' },
    { title: 'Duyệt đề tài', icon: FileText, color: 'text-blue-500', path: '/head/approve-topics' },
    { title: 'Phân công HĐ', icon: Users, color: 'text-indigo-500', path: '/committee-assignment' },
  ];

  const urgentMilestone = milestones.find((m: any) => m.isUrgent);

  return (
    <div className="page-container bg-[#f8fafc]">
      <div className="page-inner space-y-6">
        {/* Welcome Section */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
          <Card className="md:col-span-9 p-6 rounded-xl border-slate-200 shadow-sm bg-white flex items-center justify-between">
            <div className="flex items-center gap-5">
              <div className="h-14 w-14 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-md">
                <LayoutDashboard className="h-7 w-7" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-900 leading-tight">Xin chào, {user?.full_name}</h1>
                <div className="flex items-center gap-2 mt-1.5">
                  <span className="px-2 py-0.5 rounded-md bg-blue-100 text-blue-700 text-[10px] font-bold uppercase">
                    {t(`roles.${user?.role}`)}
                  </span>
                  <span className="text-slate-300 text-xs">|</span>
                  <span className="text-slate-500 text-xs font-medium">
                    Giai đoạn hiện tại: <span className="font-bold text-blue-600 uppercase">
                      {activeSemester?.calculated_phase || 'ĐỀ XUẤT & CÔNG BỐ ĐỀ TÀI'}
                    </span>
                  </span>
                </div>
              </div>
            </div>
          </Card>

          <Card className="md:col-span-3 p-4 rounded-xl border-slate-200 shadow-sm bg-white flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-slate-50 flex items-center justify-center text-blue-600 border border-slate-100">
              <CalendarIcon className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase leading-none mb-1">Học kỳ hiện tại</p>
              <h3 className="text-sm font-bold text-slate-800">{activeSemester?.name || 'Chưa có học kỳ'}</h3>
            </div>
          </Card>
        </div>

        {/* Actionable Stats */}
        <div className="space-y-3">
          <h2 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
            <div className="h-1.5 w-1.5 rounded-full bg-rose-500" />
            Cần xử lý ngay
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {actionableStats.map((stat, i) => (
              <Card key={i} className="p-5 rounded-xl border-slate-100 shadow-sm bg-white hover:shadow-md transition-all cursor-pointer group">
                <div className="flex justify-between items-start mb-2">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">{stat.label}</span>
                  <stat.icon className={cn("h-4 w-4 opacity-40 group-hover:opacity-100 transition-opacity", stat.color)} />
                </div>
                <div className="flex items-end justify-between">
                  <div className="text-3xl font-bold text-slate-900 tracking-tight">{stat.value}</div>
                  {stat.isProgress && (
                    <div className="w-16 mb-2">
                      <Progress value={parseInt(stat.value.toString())} className="h-1 bg-slate-100" />
                    </div>
                  )}
                </div>
              </Card>
            ))}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="space-y-3">
          <h2 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
            <Flame className="h-3.5 w-3.5 text-amber-500" />
            Thao tác nhanh
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {quickActions.map((action, i) => (
              <Button
                key={i}
                asChild
                variant="outline"
                className="h-16 rounded-xl bg-white border-slate-200 shadow-sm hover:shadow-md hover:bg-slate-50 transition-all group flex justify-between px-5"
              >
                <Link to={action.path}>
                  <div className="flex items-center gap-4">
                    <div className={cn("h-9 w-9 rounded-lg flex items-center justify-center bg-slate-50 border border-slate-100")}>
                      <action.icon className={cn("h-4 w-4", action.color)} />
                    </div>
                    <span className="text-sm font-bold text-slate-700">{action.title}</span>
                  </div>
                  <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-blue-600 transition-colors" />
                </Link>
              </Button>
            ))}
          </div>
        </div>

        {/* Milestones & Calendar */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Milestones */}
          <div className="lg:col-span-7 space-y-3">
            <h2 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
              <div className="h-1.5 w-1.5 rounded-full bg-blue-600" />
              Mốc quan trọng
            </h2>
            <Card className="rounded-xl border-slate-200 shadow-sm bg-white overflow-hidden">
              <div className="divide-y divide-slate-100">
                {milestones.length > 0 ? milestones.map((m: any, i: number) => (
                  <div key={i} className="p-4 px-6 flex items-center justify-between group hover:bg-slate-50/50 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className={cn(
                        "h-2 w-2 rounded-full",
                        m.isUrgent ? "bg-rose-500" : "bg-amber-400"
                      )} />
                      <div>
                        <h4 className="text-[13px] font-bold text-slate-800">{m.title}</h4>
                        <p className={cn(
                          "text-[11px] font-medium mt-0.5",
                          m.isUrgent ? "text-rose-500" : "text-slate-400"
                        )}>
                          {m.isOverdue ? 'Đã quá hạn' : `Còn ${m.daysLeft} ngày ${m.isUrgent ? '(Gấp)' : ''}`}
                        </p>
                      </div>
                    </div>
                    <div className="text-[12px] font-bold text-slate-500">
                      {format(new Date(m.date), 'dd/MM/yyyy')}
                    </div>
                  </div>
                )) : (
                  <div className="p-10 text-center text-slate-400 italic text-sm">Chưa có mốc thời gian nào.</div>
                )}
              </div>

              {urgentMilestone && (
                <div className="p-4 bg-rose-50 border-t border-rose-100 flex items-center gap-3">
                  <Flame className="h-4 w-4 text-rose-500" />
                  <p className="text-[11px] text-rose-700 font-bold">
                    Khẩn cấp: {urgentMilestone.title} sắp đến hạn trong còn {urgentMilestone.daysLeft} ngày (gấp).
                  </p>
                </div>
              )}
            </Card>
          </div>

          {/* Calendar */}
          <div className="lg:col-span-5 space-y-3">
            <h2 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
              <div className="h-1.5 w-1.5 rounded-full bg-indigo-600" />
              Lịch cá nhân
            </h2>
            <Card className="p-6 rounded-xl border-slate-200 shadow-sm bg-white">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900 capitalize">
                  {format(new Date(), 'MMMM yyyy', { locale: vi })}
                </h3>
              </div>
              
              <div className="grid grid-cols-7 gap-y-4 text-center">
                {['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'].map(day => (
                  <span key={day} className="text-[10px] font-bold text-slate-400">{day}</span>
                ))}
                
                {Array.from({ length: 35 }).map((_, i) => {
                  const day = i - 2; 
                  const isToday = day === new Date().getDate();
                  const hasEvent = day === 25 || day === 28;
                  return (
                    <div key={i} className="relative py-1.5">
                      <span className={cn(
                        "text-xs font-medium transition-all w-7 h-7 flex items-center justify-center mx-auto rounded-md cursor-pointer",
                        day < 1 || day > 31 ? "text-slate-200" : "text-slate-600 hover:bg-slate-50",
                        isToday && "bg-blue-600 text-white font-bold",
                        hasEvent && !isToday && "border border-blue-200 text-blue-600"
                      )}>
                        {day < 1 ? day + 31 : day > 31 ? day - 31 : day}
                      </span>
                    </div>
                  );
                })}
              </div>

              <div className="mt-6 pt-4 border-t border-slate-50 flex items-center justify-between text-[10px] font-bold">
                <div className="flex gap-3">
                  <span className="flex items-center gap-1.5 text-blue-600">
                    <div className="h-1 w-1 rounded-full bg-blue-600" />
                    DEADLINE
                  </span>
                  <span className="flex items-center gap-1.5 text-amber-500">
                    <div className="h-1 w-1 rounded-full bg-amber-500" />
                    BẢO VỆ
                  </span>
                </div>
                <Link to="/schedule" className="text-slate-400 hover:text-blue-600">Xem tất cả</Link>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
