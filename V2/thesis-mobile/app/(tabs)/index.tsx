import React from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, RefreshControl, ActivityIndicator
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuthStore } from '@/store/auth';
import { useDashboardStats } from '@/hooks/useDashboard';
import { useAssignments } from '@/hooks/useAssignments';
import { useSupervisedTopics } from '@/hooks/useTopics';

import { MapPin, Clock, Users, UserCheck, Award } from 'lucide-react-native';

const BLUE = '#2563eb';

export default function DashboardScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [refreshing, setRefreshing] = React.useState(false);

  // Fetch actual data
  const { data: stats, refetch: refetchStats, isLoading: isStatsLoading } = useDashboardStats();
  const { data: assignments, refetch: refetchAssignments, isLoading: isAssignmentsLoading } = useAssignments();
  const { data: supervisedTopics, refetch: refetchSupervised, isLoading: isSupervisedLoading } = useSupervisedTopics();

  const handleRefresh = React.useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refetchStats(), refetchAssignments(), refetchSupervised()]);
    setRefreshing(false);
  }, [refetchStats, refetchAssignments, refetchSupervised]);

  const d = new Date();
  const TODAY = `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()}`;
  const isLoading = isStatsLoading || isAssignmentsLoading || isSupervisedLoading;

  // Derive stats & counts
  const assignedList = assignments || [];
  const supervisedList = supervisedTopics || [];

  const reviewerCount = assignedList.filter(a => a.assignment_type === 'REVIEWER').length;
  const committeeCount = assignedList.filter(a => a.assignment_type === 'COMMITTEE').length;
  const supervisedCount = supervisedList.length;

  // Get active semester name
  const currentSemesterName = React.useMemo(() => {
    const sem = assignedList[0]?.topic?.semester?.name || supervisedList[0]?.semester?.name;
    return sem || 'Học kỳ 2 - Năm học 2025-2026';
  }, [assignedList, supervisedList]);

  // Combine all topics the user needs to interact with
  const uniqueCombinedTopics = React.useMemo(() => {
    const list = [
        ...assignedList.map(a => {
          let roleLabel = 'GVPB';
          if (a.assignment_type === 'COMMITTEE') {
            const cRole = a.committee_role;
            if (cRole === 'CHAIR') roleLabel = 'Chủ tịch HĐ';
            else if (cRole === 'SECRETARY') roleLabel = 'Thư ký HĐ';
            else roleLabel = 'Thành viên HĐ';
          }
    
          return {
            id: a.id,
            topicId: a.topic_id,
            groupId: a.group_id,
            groupName: a.topic?.code || a.topic?.title || 'Unknown Topic',
            status: a.status === 'PENDING' ? 'NOT_STARTED' : a.status,
            statusLabel: a.status === 'PENDING' ? 'Chưa chấm' : (a.status === 'ACCEPTED' || a.status === 'AUTO_ACCEPTED' ? 'Đã nhận' : 'Đã chấm'),
            statusColor: a.status === 'PENDING' ? '#ea580c' : '#16a34a',
            role: roleLabel,
            schedule: a.topic?.defense_schedule,
            room: a.room || a.topic?.room
          };
        }),
        ...supervisedList.map(t => ({
          id: t.id,
          topicId: t.topicId,
          groupId: t.id,
          groupName: t.code || t.title || 'Supervised Topic',
          status: 'ADVISOR',
          statusLabel: 'Chấm HD',
          statusColor: BLUE,
          role: 'GVHD',
          schedule: t.defense_schedule,
          room: t.room
        }))
    ];

    return list;
  }, [assignedList, supervisedList]);

  // Filter topics scheduled for TODAY
  const todayTopics = React.useMemo(() => {
    const todayStr = new Date().toLocaleDateString('vi-VN');
    return uniqueCombinedTopics.filter(t => {
      if (!t.schedule?.defense_date) return false;
      const defDateStr = new Date(t.schedule.defense_date).toLocaleDateString('vi-VN');
      return defDateStr === todayStr;
    });
  }, [uniqueCombinedTopics]);

  // Group into a single session for today
  const sessions = todayTopics.length > 0
    ? [{ id: 's1', name: 'Lịch chấm hôm nay', topics: todayTopics }]
    : [];

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
              <Text style={styles.pillboxLabel}>GV Hướng dẫn</Text>
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
              <Text style={styles.pillboxLabel}>GV Phản biện</Text>
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



        {/* Sessions */}
        <View style={styles.body}>
          <Text style={styles.sectionTitle}>Ca chấm hôm nay</Text>

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
                  onPress={() => router.push(`/topic/${topic.id}` as any)}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.topicGroup} numberOfLines={1}>{topic.groupName}</Text>
                    {topic.room || topic.schedule ? (
                      <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                          <Clock size={10} color="#9ca3af" />
                          <Text style={styles.topicSession}>{topic.schedule?.defense_time || 'Chưa rõ giờ'}</Text>
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

});
