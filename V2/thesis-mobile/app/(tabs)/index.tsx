import React from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, RefreshControl, ActivityIndicator
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuthStore } from '@/store/auth';
import { useDashboardStats, useActiveSemester } from '@/hooks/useDashboard';
import { useAssignments } from '@/hooks/useAssignments';
import { useSupervisedTopics } from '@/hooks/useTopics';

import { MapPin, Clock, Users, UserCheck, Award, Calendar } from 'lucide-react-native';

const BLUE = '#2563eb';

const formatScheduleTime = (schedule: any): string => {
  if (!schedule) return 'Chưa rõ giờ';
  
  const rawTime = schedule.defense_time || schedule.start_time;
  if (!rawTime) return 'Chưa rõ giờ';
  
  const timeStr = String(rawTime);
  if (timeStr.includes('T') || timeStr.includes('-')) {
    try {
      const date = new Date(timeStr);
      if (!isNaN(date.getTime())) {
        const hours = date.getHours().toString().padStart(2, '0');
        const minutes = date.getMinutes().toString().padStart(2, '0');
        return `${hours}:${minutes}`;
      }
    } catch (e) {
      // ignore
    }
  }
  return timeStr;
};

export default function DashboardScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [refreshing, setRefreshing] = React.useState(false);

  // Fetch actual data
  const { refetch: refetchStats, isLoading: isStatsLoading } = useDashboardStats();
  const { data: assignments, refetch: refetchAssignments, isLoading: isAssignmentsLoading } = useAssignments();
  const { data: supervisedTopics, refetch: refetchSupervised, isLoading: isSupervisedLoading } = useSupervisedTopics();
  const { data: activeSemester, refetch: refetchActiveSemester, isLoading: isActiveSemesterLoading } = useActiveSemester();

  const handleRefresh = React.useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refetchStats(), refetchAssignments(), refetchSupervised(), refetchActiveSemester()]);
    setRefreshing(false);
  }, [refetchStats, refetchAssignments, refetchSupervised, refetchActiveSemester]);

  const d = new Date();
  const TODAY = `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()}`;
  const isLoading = isStatsLoading || isAssignmentsLoading || isSupervisedLoading || isActiveSemesterLoading;

  // Derive stats & counts
  const reviewerCount = (assignments || []).filter(a => a.assignment_type === 'REVIEWER').length;
  const committeeCount = (assignments || []).filter(a => a.assignment_type === 'COMMITTEE').length;
  const supervisedCount = (supervisedTopics || []).length;

  // Get active semester name
  const currentSemesterName = React.useMemo(() => {
    const sem = (assignments || [])[0]?.topic?.semester?.name || (supervisedTopics || [])[0]?.semester?.name;
    return sem || 'Học kỳ 2 - Năm học 2025-2026';
  }, [assignments, supervisedTopics]);

  // Combine all topics the user needs to interact with
  const uniqueCombinedTopics = React.useMemo(() => {
    const list = [
      ...(assignments || []).map(a => {
        let roleLabel = 'GVPB';
        let roleKey = 'GVPB'; // key for navigation
        if (a.assignment_type === 'COMMITTEE') {
          const cRole = a.committee_role;
          if (cRole === 'CHAIR') roleLabel = 'Chủ tịch HĐ';
          else if (cRole === 'SECRETARY') roleLabel = 'Thư ký HĐ';
          else roleLabel = 'Thành viên HĐ';
          roleKey = 'HĐBV';
        }

        const schedule = a.topic?.defense_schedule || a.topic?.defense_schedules?.[0];
        const room = a.room || a.topic?.room || schedule?.room;

        return {
          id: a.id,
          topicId: a.topic_id,
          groupId: a.group_id,
          groupName: a.topic?.code || a.topic?.title || 'Unknown Topic',
          status: a.status === 'PENDING' ? 'NOT_STARTED' : a.status,
          statusLabel: a.status === 'PENDING' ? 'Chưa chấm' : (a.status === 'ACCEPTED' || a.status === 'AUTO_ACCEPTED' ? 'Đã nhận' : 'Đã chấm'),
          statusColor: a.status === 'PENDING' ? '#ea580c' : '#16a34a',
          role: roleLabel,
          roleKey,
          schedule,
          room
        };
      }),
      ...(supervisedTopics || []).map(t => {
        const schedule = t.defense_schedule || t.defense_schedules?.[0];
        const room = t.room || schedule?.room;

        return {
          id: t.id,
          topicId: t.topicId,
          groupId: t.id,
          groupName: t.code || t.title || 'Supervised Topic',
          status: 'ADVISOR',
          statusLabel: 'Chấm HD',
          statusColor: BLUE,
          role: 'GVHD',
          roleKey: 'GVHD',
          schedule,
          room
        };
      })
    ];

    return list;
  }, [assignments, supervisedTopics]);

  // Filter topics scheduled for TODAY
  const todayTopics = React.useMemo(() => {
    const today = new Date();
    const todayYear = today.getFullYear();
    const todayMonth = today.getMonth();
    const todayDate = today.getDate();

    return uniqueCombinedTopics.filter(t => {
      if (!t.schedule?.defense_date) return false;
      const defDate = new Date(t.schedule.defense_date);
      if (isNaN(defDate.getTime())) return false;
      
      return defDate.getFullYear() === todayYear &&
             defDate.getMonth() === todayMonth &&
             defDate.getDate() === todayDate;
    });
  }, [uniqueCombinedTopics]);

  // Group into a single session for today
  const sessions = todayTopics.length > 0
    ? [{ id: 's1', name: 'Lịch chấm hôm nay', topics: todayTopics }]
    : [];

  const semesterPhaseInfo = React.useMemo(() => {
    if (!activeSemester) return null;

    const phase = activeSemester.calculated_phase;
    let phaseName = 'Lập kế hoạch';
    let dateRange = '';
    let color = '#3b82f6';
    let bgColor = '#eff6ff';

    const formatDate = (dateString?: string) => {
      if (!dateString) return '-';
      const d = new Date(dateString);
      return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()}`;
    };

    const defenseDateStart = activeSemester.deptConfig?.defense_date || activeSemester.defense_start;

    switch (phase) {
      case 'PREVIEW':
        phaseName = 'Công báo & Đề xuất đề tài';
        dateRange = `${formatDate(activeSemester.topic_viewing_start)} - ${formatDate(activeSemester.topic_registration_start)}`;
        color = '#06b6d4';
        bgColor = '#ecfeff';
        break;
      case 'REGISTRATION':
        phaseName = 'Sinh viên đăng ký đề tài';
        dateRange = `${formatDate(activeSemester.topic_registration_start)} - ${formatDate(activeSemester.topic_registration_end)}`;
        color = '#10b981';
        bgColor = '#ecfdf5';
        break;
      case 'WORK':
        phaseName = 'Thực hiện khóa luận';
        dateRange = `${formatDate(activeSemester.topic_registration_end)} - ${formatDate(activeSemester.proposal_deadline)}`;
        color = '#f59e0b';
        bgColor = '#fffbeb';
        break;
      case 'REVIEWING':
        phaseName = 'Chấm phản biện';
        dateRange = `${formatDate(activeSemester.proposal_deadline)} - ${formatDate(defenseDateStart)}`;
        color = '#8b5cf6';
        bgColor = '#f5f3ff';
        break;
      case 'DEFENSE':
        phaseName = 'Bảo vệ Hội đồng';
        if (activeSemester.deptConfig?.defense_date) {
          dateRange = formatDate(activeSemester.deptConfig.defense_date);
        } else {
          dateRange = `${formatDate(activeSemester.defense_start)} - ${formatDate(activeSemester.defense_end)}`;
        }
        color = '#ef4444';
        bgColor = '#fef2f2';
        break;
      case 'FINAL':
        phaseName = 'Tổng kết học kỳ';
        dateRange = `${formatDate(activeSemester.defense_end)} - ${formatDate(activeSemester.end_date)}`;
        color = '#6366f1';
        bgColor = '#eef2ff';
        break;
      default:
        phaseName = 'Lập kế hoạch học kỳ';
        dateRange = `${formatDate(activeSemester.start_date)} - ${formatDate(activeSemester.end_date)}`;
        color = '#3b82f6';
        bgColor = '#eff6ff';
        break;
    }

    return {
      phaseName,
      dateRange,
      color,
      bgColor,
    };
  }, [activeSemester]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f8fafc' }}>
      <ScrollView
        style={{ flex: 1 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={BLUE} />}
      >
        {/* Modern White Header */}
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.greetSmall}>Xin chào,</Text>
            <Text style={styles.greetName}>{user?.full_name || 'Giảng viên'}</Text>
            <View style={styles.semesterBadge}>
              <Text style={styles.semesterText}>{currentSemesterName}</Text>
            </View>
          </View>
          <View style={styles.headerRight}>
            <View style={styles.dateBadge}>
              <Text style={styles.dateText}>{TODAY}</Text>
            </View>
          </View>
        </View>

        {/* Role-based Overview Pillboxes - Clickable */}
        <View style={styles.pillboxContainer}>
          <TouchableOpacity
            style={[styles.pillbox, { borderLeftColor: BLUE, borderLeftWidth: 4 }]}
            onPress={() => router.push('/assigned?filter=GVHD' as any)}
            activeOpacity={0.8}
          >
            <View style={styles.pillboxIconRow}>
              <Users size={16} color={BLUE} />
              <Text style={styles.pillboxLabel}>Hướng dẫn</Text>
            </View>
            <Text style={[styles.pillboxValue, { color: BLUE }]}>{supervisedCount}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.pillbox, { borderLeftColor: '#9333ea', borderLeftWidth: 4 }]}
            onPress={() => router.push('/assigned?filter=GVPB' as any)}
            activeOpacity={0.8}
          >
            <View style={styles.pillboxIconRow}>
              <UserCheck size={16} color="#9333ea" />
              <Text style={styles.pillboxLabel}>Phản biện</Text>
            </View>
            <Text style={[styles.pillboxValue, { color: '#9333ea' }]}>{reviewerCount}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.pillbox, { borderLeftColor: '#ea580c', borderLeftWidth: 4 }]}
            onPress={() => router.push('/assigned?filter=HĐBV' as any)}
            activeOpacity={0.8}
          >
            <View style={styles.pillboxIconRow}>
              <Award size={16} color="#ea580c" />
              <Text style={styles.pillboxLabel}>Hội đồng</Text>
            </View>
            <Text style={[styles.pillboxValue, { color: '#ea580c' }]}>{committeeCount}</Text>
          </TouchableOpacity>
        </View>

        {semesterPhaseInfo && (
          <View style={styles.phaseCard}>
            <View style={styles.phaseHeader}>
              <View style={[styles.phaseIndicator, { backgroundColor: semesterPhaseInfo.color }]} />
              <Text style={styles.phaseTitle}>GIAI ĐOẠN HỌC KỲ HIỆN TẠI</Text>
            </View>
            <View style={[styles.phaseDetailsBox, { backgroundColor: semesterPhaseInfo.bgColor, borderColor: semesterPhaseInfo.color + '20' }]}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.phaseLabel, { color: semesterPhaseInfo.color }]}>
                  {semesterPhaseInfo.phaseName}
                </Text>
                <View style={styles.phaseTimeContainer}>
                  <Calendar size={12} color="#64748b" />
                  <Text style={styles.phaseDates}>{semesterPhaseInfo.dateRange}</Text>
                </View>
              </View>
              <View style={[styles.phaseStatusBadge, { backgroundColor: semesterPhaseInfo.color }]}>
                <Text style={styles.phaseStatusText}>Đang diễn ra</Text>
              </View>
            </View>
          </View>
        )}

        {/* Sessions */}
        <View style={styles.body}>
          {isLoading ? (
            <ActivityIndicator size="large" color={BLUE} style={{ marginTop: 20 }} />
          ) : sessions.length === 0 ? (
            <View style={{ alignItems: 'center', marginTop: 40, paddingHorizontal: 20 }}>
              <Text style={{ color: '#64748b', fontSize: 15, fontWeight: '600' }}>Hôm nay không có lịch chấm điểm</Text>
              <Text style={{ color: '#94a3b8', fontSize: 13, marginTop: 6, textAlign: 'center' }}>Các đề tài có lịch bảo vệ trong ngày hôm nay sẽ xuất hiện tại đây.</Text>
            </View>
          ) : sessions.map(session => (
            <View key={session.id} style={{ marginBottom: 20 }}>
              {/* Session header */}
              <View style={styles.sessionRow}>
                <View style={styles.sessionDot} />
                <Text style={styles.sessionName}>{session.name}</Text>
                <View style={styles.sessionBadge}>
                  <Text style={styles.sessionBadgeText}>{session.topics.length} nhóm</Text>
                </View>
              </View>

              {/* Topic rows */}
              {session.topics.map(topic => (
                <TouchableOpacity
                  key={`${session.id}-${topic.id}`}
                  style={styles.topicCard}
                  onPress={() => router.push(`/topic/${topic.topicId}?groupId=${topic.groupId || ''}&viewMode=grading&role=${(topic as any).roleKey || topic.role}` as any)}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.topicGroup} numberOfLines={1}>{topic.groupName}</Text>
                    {topic.room || topic.schedule ? (
                      <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                          <Clock size={10} color="#9ca3af" />
                          <Text style={styles.topicSession}>{formatScheduleTime(topic.schedule)}</Text>
                        </View>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                          <MapPin size={10} color="#9ca3af" />
                          <Text style={styles.topicSession}>{topic.room || topic.schedule?.room || 'Chưa rõ phòng'}</Text>
                        </View>
                      </View>
                    ) : (
                      <Text style={styles.topicSession}>{session.name}</Text>
                    )}
                  </View>
                  <View style={{ alignItems: 'flex-end', marginLeft: 10 }}>
                    <View style={styles.roleBadge}>
                      <Text style={styles.roleBadgeText}>{topic.role}</Text>
                    </View>
                    <Text style={[styles.statusText, { color: topic.statusColor }]}>{topic.statusLabel}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    backgroundColor: '#fff',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9'
  },
  greetSmall: { color: '#64748b', fontSize: 13, fontWeight: '500' },
  greetName: { color: '#111827', fontSize: 20, fontWeight: '800', marginTop: 2 },
  semesterBadge: {
    backgroundColor: '#eff6ff', alignSelf: 'flex-start',
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6, marginTop: 6
  },
  semesterText: { fontSize: 11, fontWeight: '700', color: BLUE },
  headerRight: { alignItems: 'flex-end', justifyContent: 'center' },
  dateBadge: { backgroundColor: '#f1f5f9', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  dateText: { fontSize: 11, fontWeight: '700', color: '#64748b' },
  pillboxContainer: {
    flexDirection: 'row', gap: 10, marginHorizontal: 16, marginTop: 16,
  },
  pillbox: {
    flex: 1, backgroundColor: '#fff', borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: '#f1f5f9',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04, shadowRadius: 6, elevation: 2,
  },
  pillboxIconRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  pillboxLabel: { fontSize: 11, color: '#64748b', fontWeight: '700' },
  pillboxValue: { fontSize: 22, fontWeight: '900', marginTop: 8 },
  body: { paddingHorizontal: 16, paddingTop: 24, paddingBottom: 40 },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 16 },
  sessionRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  sessionDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: BLUE, marginRight: 8 },
  sessionName: { fontSize: 13, fontWeight: '700', color: '#1f2937', flex: 1 },
  sessionBadge: { backgroundColor: '#eff6ff', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  sessionBadgeText: { fontSize: 10, fontWeight: '700', color: BLUE },
  topicCard: {
    backgroundColor: '#fff', borderRadius: 12, padding: 14,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 10, borderWidth: 1, borderColor: '#f3f4f6',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  topicGroup: { fontSize: 14, fontWeight: '700', color: '#111827' },
  topicSession: { fontSize: 11, color: '#9ca3af', marginTop: 2 },
  roleBadge: { backgroundColor: '#eff6ff', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2, marginBottom: 4 },
  roleBadgeText: { fontSize: 10, fontWeight: '700', color: BLUE },
  statusText: { fontSize: 11, fontWeight: '600' },
  phaseCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    marginHorizontal: 16,
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  phaseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  phaseIndicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 8,
  },
  phaseTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748b',
    letterSpacing: 0.5,
  },
  phaseDetailsBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
  },
  phaseLabel: {
    fontSize: 15,
    fontWeight: '800',
  },
  phaseTimeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
  },
  phaseDates: {
    fontSize: 12,
    color: '#475569',
    fontWeight: '600',
  },
  phaseStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  phaseStatusText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '800',
  },

});
