import React from 'react';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/store/auth';
import { useDashboardStats } from '@/hooks/useDashboard';
import { 
  Clock, 
  Calendar as CalendarIcon, 
  Star,
  FileText,
  Users,
  ChevronRight,
  LayoutDashboard,
  Flame,
  CheckCircle2,
  AlertCircle,
  ClipboardCheck,
  Search
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { format, getDate, getMonth, getYear, isAfter } from 'date-fns';
import { vi } from 'date-fns/locale';
import { Link, useNavigate } from 'react-router-dom';
import { Tooltip } from 'antd';

const Dashboard = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { data: statsData, isLoading } = useDashboardStats();

  const stats = (statsData || {}) as any;
  const activeSemester = stats.activeSemester;
  const allMilestones = stats.milestones || [];

  // --- 📅 Chỉ hiển thị mốc trong tương lai (hôm nay trở đi) ---
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const relevantMilestones = [...allMilestones]
    .filter((m: any) => new Date(m.date) >= today)
    .sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .slice(0, 6);

  const urgentMilestones = allMilestones.filter((m: any) => m.isUrgent);

  if (isLoading) {
    return (
      <div className="page-container animate-pulse">
        <div className="page-inner">
          <div className="h-24 bg-slate-200 rounded-xl w-full" />
          <div className="h-32 bg-slate-200 rounded-xl w-full" />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="h-64 bg-slate-200 rounded-xl" />
            <div className="h-64 bg-slate-200 rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  // --- Dynamic Configuration Based on Role ---
  const isStudent = user?.role === 'STUDENT';
  const isLecturer = user?.role === 'LECTURER';

  const getActionableStats = () => {
    if (isStudent) {
      return [
        { label: 'Đề tài của tôi', value: stats.topicName ? 'Đã có' : 'Chưa có', color: 'text-blue-600', sub: stats.topicName || 'Chưa đăng ký', path: '/my-topic' },
        { label: 'Giảng viên HD', value: stats.supervisorName || 'N/A', color: 'text-amber-600', sub: 'Người hướng dẫn', path: '/my-topic' },
        { label: 'Cần xử lý', value: urgentMilestones.length, color: 'text-orange-600', sub: 'mốc thời gian', path: '#milestones' },
        { label: 'Tiến độ', value: stats.progressStage || 'N/A', color: 'text-emerald-600', sub: 'giai đoạn hiện tại' },
      ];
    }
    if (isLecturer) {
      return [
        { label: 'Đang hướng dẫn', value: stats.supervisedTopicsCount || 0, color: 'text-blue-600', sub: 'đề tài', path: '/supervisor/registrations' },
        { label: 'Chờ phản biện', value: stats.reviewAssignmentsCount || 0, color: 'text-rose-600', sub: 'đề tài', path: '/evaluation?type=reviewer' },
        { label: 'Hội đồng', value: stats.councilAssignmentsCount || 0, color: 'text-indigo-600', sub: 'lịch bảo vệ', path: '/evaluation?type=council' },
        { label: 'Sắp tới', value: urgentMilestones.length, color: 'text-orange-600', sub: 'mốc quan trọng', path: '#milestones' },
      ];
    }
    return [
      { label: 'Cần duyệt', value: stats.pendingApprovalTopics || 0, color: 'text-rose-600', sub: 'đề tài mới', path: '/head/approve-topics' },
      { label: 'Tổng đề tài', value: stats.totalTopics || 0, color: 'text-blue-600', sub: 'trong học kỳ', path: '/topics' },
      { label: 'Sắp tới', value: urgentMilestones.length, color: 'text-orange-600', sub: 'quan trọng', path: '#milestones' },
      { label: 'Đã hoàn thành', value: `${Math.round(stats.completionRate || 0)}%`, color: 'text-emerald-600', sub: 'tiến độ chung' },
    ];
  };

  const getQuickActions = () => {
    if (isStudent) {
      return [
        { title: 'Xem điểm', icon: Star, color: 'bg-amber-50 text-amber-600', path: '/my-topic' },
        { title: 'Tìm đề tài', icon: Search, color: 'bg-emerald-50 text-emerald-600', path: '/topics' },
      ];
    }
    if (isLecturer) {
      return [
        { title: 'Chấm điểm', icon: Star, color: 'bg-amber-50 text-amber-600', path: '/evaluation' },
      ];
    }
    return [
      { title: 'Duyệt đề tài', icon: FileText, color: 'bg-blue-50 text-blue-600', path: '/head/approve-topics' },
      { title: 'Phân công phản biện', icon: ClipboardCheck, color: 'bg-emerald-50 text-emerald-600', path: '/reviewer-assignment' },
      { title: 'Quản lý Hội đồng', icon: Users, color: 'bg-indigo-50 text-indigo-600', path: '/head/committees' },
    ];
  };

  const actionableStats = getActionableStats();
  const quickActions = getQuickActions();

  // Navigation logic for milestones
  const handleMilestoneClick = (m: any) => {
    if (m.type === 'PROPOSAL' || m.type === 'MIDTERM') {
      navigate('/topics');
    } else if (m.type === 'REVIEW') {
      navigate('/evaluation?type=reviewer');
    } else if (m.type === 'DEFENSE_START') {
      navigate('/evaluation?type=council');
    } else {
      navigate('/schedule');
    }
  };

  // Calendar event days
  const eventDaysMap = allMilestones.reduce((acc: any, m: any) => {
    const d = new Date(m.date);
    const key = `${getDate(d)}-${getMonth(d)}-${getYear(d)}`;
    if (!acc[key]) acc[key] = [];
    acc[key].push(m);
    return acc;
  }, {});

  return (
    <div className="page-container bg-[#fcfcfd]">
      <div className="page-inner max-w-7xl mx-auto">
        
        {/* 🧭 Header Section */}
        <Card className="p-6 border-slate-200 shadow-sm bg-white overflow-hidden relative">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-[#2563eb] rounded-xl flex items-center justify-center text-white shadow-lg shadow-blue-100">
                <LayoutDashboard className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-[17px] font-bold text-slate-900 leading-tight">
                  Xin chào, {user?.role !== 'STUDENT' ? 'ThS. ' : ''}{user?.full_name}
                </h1>
                <p className="text-[12px] text-slate-400 mt-1">
                  Giai đoạn hiện tại: <span className="font-bold text-[#2563eb] uppercase tracking-tight">
                    {activeSemester?.calculated_phase_text || 'CHƯA BẮT ĐẦU'}
                  </span>
                </p>
              </div>
            </div>
            <div className="px-4 py-1.5 bg-slate-50 rounded-lg border border-slate-100 flex items-center gap-2">
              <CalendarIcon className="h-4 w-4 text-slate-400" />
              <span className="text-xs font-bold text-slate-600">{activeSemester?.name || 'Học kỳ hiện tại'}</span>
            </div>
          </div>
        </Card>

        {/* 🔴 Actionable Stats Section */}
        <div className="space-y-3 mt-4">
          <h2 className="section-label flex items-center gap-2 text-rose-500 font-bold">
            <AlertCircle className="h-4 w-4" />
            {isStudent ? 'Thông tin đề tài' : 'Cần xử lý ngay'}
          </h2>
          <Card className="border-slate-100 shadow-sm bg-white overflow-hidden">
            <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-slate-50">
              {actionableStats.map((stat, i) => (
                <Link 
                  key={i} 
                  to={stat.path || '#'} 
                  className={cn(
                    "p-6 hover:bg-slate-50 transition-colors flex flex-col items-center text-center group",
                    !stat.path && "cursor-default hover:bg-white"
                  )}
                >
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2">{stat.label}</span>
                  <div className={cn("text-xl font-black tracking-tighter transition-transform group-hover:scale-105", stat.color, !isStudent && "text-3xl")}>
                    {stat.value}
                  </div>
                  <span className="text-[10px] text-slate-400 font-medium mt-1 truncate max-w-full px-2">{stat.sub}</span>
                </Link>
              ))}
            </div>
          </Card>
        </div>

        {/* ⚡ Quick Actions Section */}
        <div className="space-y-3 mt-6">
          <h2 className="section-label flex items-center gap-2 font-bold text-slate-500">
            <Flame className="h-4 w-4 text-amber-500" />
            Thao tác nhanh
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {quickActions.map((action, i) => (
              <Button
                key={i}
                asChild
                variant="outline"
                className="h-14 rounded-xl bg-white border-slate-100 shadow-sm hover:shadow-md transition-all group px-4 justify-start overflow-hidden"
              >
                <Link to={action.path}>
                  <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center mr-3 transition-transform group-hover:scale-110", action.color)}>
                    <action.icon className="h-4 w-4" />
                  </div>
                  <span className="text-sm font-bold text-slate-700">{action.title}</span>
                  <ChevronRight className="h-4 w-4 text-slate-200 ml-auto group-hover:text-blue-600 transition-colors" />
                </Link>
              </Button>
            ))}
          </div>
        </div>

        {/* 📅 Milestones & 🗓️ Calendar Row */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch mt-8">
          
          {/* 📅 Milestones (Mốc quan trọng) */}
          <div className="lg:col-span-7 space-y-0">
            <Card className="border-slate-200 shadow-sm bg-white h-full overflow-hidden flex flex-col">
              <div className="p-5 flex items-center justify-between border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="w-[5px] h-6 bg-[#2563eb] rounded-full" />
                  <h2 className="text-[16px] font-bold text-slate-800">Mốc quan trọng</h2>
                </div>
                {urgentMilestones.length > 0 && (
                  <div className="px-3 py-1 bg-rose-50 border border-rose-100 rounded-full flex items-center gap-2">
                    <span className="text-xs">⚠️</span>
                    <span className="text-[10px] font-bold text-rose-600 uppercase tracking-tighter">
                      {urgentMilestones.length} mốc sắp đến
                    </span>
                  </div>
                )}
              </div>
              
              <div className="p-6 space-y-4 flex-1">
                {relevantMilestones.length > 0 ? relevantMilestones.map((m: any, i: number) => (
                  <div 
                    key={i} 
                    onClick={() => handleMilestoneClick(m)}
                    className={cn(
                      "p-5 rounded-[16px] flex items-center justify-between border shadow-sm transition-all cursor-pointer hover:scale-[1.01]",
                      m.isUrgent ? "bg-[#fff1f2] border-[#fecaca]" : "bg-[#f8fafc] border-[#e2e8f0]"
                    )}
                  >
                    <div className="flex items-center gap-4">
                      <div className={cn(
                        "h-2.5 w-2.5 rounded-full flex-shrink-0",
                        m.isUrgent ? "bg-[#e11d48]" : "bg-[#facc15]"
                      )} />
                      <div>
                        <h4 className={cn(
                          "text-[15px] font-bold leading-tight",
                          m.isUrgent ? "text-[#991b1b]" : "text-[#1e293b]"
                        )}>{m.title}</h4>
                        <p className={cn(
                          "text-[12px] mt-1.5 font-semibold",
                          m.isUrgent ? "text-[#ef4444]" : "text-[#94a3b8]"
                        )}>
                          {`Còn ${m.daysLeft} ngày${m.isUrgent ? ' (Gấp)' : ''}`}
                        </p>
                      </div>
                    </div>
                    <div className={cn(
                      "text-[14px] font-bold text-right",
                      m.isUrgent ? "text-[#991b1b]" : "text-[#475569]"
                    )}>
                      {format(new Date(m.date), 'dd/MM/yyyy')}
                    </div>
                  </div>
                )) : (
                  <div className="py-10 text-center space-y-3">
                    <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center mx-auto">
                      <CheckCircle2 className="h-6 w-6 text-emerald-400" />
                    </div>
                    <p className="text-sm text-slate-400 font-medium">Bạn đã hoàn thành các mốc quan trọng hiện tại!</p>
                  </div>
                )}

                {urgentMilestones.length > 0 && relevantMilestones.find(m => m.isUrgent) && (
                  <div className="mt-6 p-5 rounded-[16px] bg-[#fff1f2] border border-[#fecaca] shadow-sm flex items-center gap-5">
                    <div className="h-12 w-12 bg-white rounded-full flex items-center justify-center shadow-sm border border-[#fecaca] flex-shrink-0">
                      <Flame className="h-6 w-6 text-[#f97316]" fill="#f97316" />
                    </div>
                    <div>
                      <p className="text-[15px] text-[#991b1b] font-bold">
                        Khẩn cấp: {urgentMilestones[0].title}
                      </p>
                      <p className="text-[12px] text-[#ef4444] font-semibold mt-1">
                        Sắp đến hạn trong còn {urgentMilestones[0].daysLeft} ngày (gấp).
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </Card>
          </div>

          {/* 🗓️ Mini Calendar (Lịch) */}
          <div className="lg:col-span-5 space-y-0">
            <Card className="border-slate-200 shadow-sm bg-white h-full overflow-hidden flex flex-col">
              <div className="p-5 flex items-center gap-3 border-b border-slate-100">
                <div className="w-[5px] h-6 bg-[#2563eb] rounded-full" />
                <h2 className="text-[16px] font-bold text-slate-800">Lịch cá nhân</h2>
              </div>

              <div className="p-6 flex-1 flex flex-col justify-between">
                <div>
                  <div className="grid grid-cols-7 gap-y-7 text-center mb-6 mt-2">
                    {['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'].map(day => (
                      <span key={day} className="text-[11px] font-bold text-[#94a3b8] tracking-widest uppercase">{day}</span>
                    ))}
                    
                    {Array.from({ length: 35 }).map((_, i) => {
                      const dayOfMonth = i - 2; 
                      const currentMonth = getMonth(today);
                      const currentYear = getYear(today);
                      const isToday = dayOfMonth === getDate(today);
                      const isOtherMonth = dayOfMonth < 1 || dayOfMonth > 31;
                      
                      const key = `${dayOfMonth}-${currentMonth}-${currentYear}`;
                      const events = eventDaysMap[key];

                      const calendarDay = (
                        <div key={i} className="relative h-8 flex items-center justify-center">
                          <span className={cn(
                            "text-[13px] font-bold w-9 h-9 flex items-center justify-center rounded-full transition-all cursor-default",
                            isOtherMonth ? "text-[#e2e8f0]" : "text-[#475569]",
                            isToday && "bg-[#2563eb] text-white shadow-lg shadow-blue-200"
                          )}>
                            {dayOfMonth < 1 ? dayOfMonth + 31 : dayOfMonth > 31 ? dayOfMonth - 31 : dayOfMonth}
                          </span>
                          {events && !isToday && !isOtherMonth && (
                            <div className={cn(
                              "absolute bottom-0 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full",
                              events.some((e: any) => e.isUrgent || e.isOverdue) ? "bg-[#e11d48]" : "bg-[#f59e0b]"
                            )} />
                          )}
                        </div>
                      );

                      if (events && !isOtherMonth) {
                        return (
                          <Tooltip key={i} title={
                            <div className="space-y-1 p-1">
                              {events.map((e: any, ei: number) => (
                                <div key={ei} className="text-[10px] flex items-center gap-2">
                                  <div className={cn("w-1.5 h-1.5 rounded-full", e.isUrgent ? "bg-rose-500" : "bg-amber-400")} />
                                  {e.title}
                                </div>
                              ))}
                            </div>
                          }>
                            {calendarDay}
                          </Tooltip>
                        );
                      }

                      return calendarDay;
                    })}
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between border-t border-slate-50 pt-6">
                  <div className="flex gap-6 text-[11px] font-bold uppercase tracking-tight">
                    <span className="flex items-center gap-2 text-[#e11d48]">
                      <div className="h-2 w-2 rounded-full bg-[#e11d48]" />
                      SẮP ĐẾN/GẤP
                    </span>
                    <span className="flex items-center gap-2 text-[#f59e0b]">
                      <div className="h-2 w-2 rounded-full bg-[#f59e0b]" />
                      THÔNG THƯỜNG
                    </span>
                  </div>
                  <Link to="/schedule" className="text-[12px] font-bold text-[#2563eb] hover:underline transition-all">
                    Xem tất cả
                  </Link>
                </div>
              </div>
            </Card>
          </div>

        </div>
      </div>
    </div>
  );
};

export default Dashboard;
