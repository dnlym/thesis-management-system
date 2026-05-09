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
import { useSupervisedTopics, useTopics } from '@/hooks/useTopics';

import { MapPin, Clock, Trophy, ChevronRight } from 'lucide-react-native';

const BLUE = '#2563eb';

export default function DashboardScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [refreshing, setRefreshing] = React.useState(false);

  // Fetch actual data
  const { data: stats, refetch: refetchStats, isLoading: isStatsLoading } = useDashboardStats();
  const { data: assignments, refetch: refetchAssignments, isLoading: isAssignmentsLoading } = useAssignments();
  const { data: supervisedTopics, refetch: refetchSupervised, isLoading: isSupervisedLoading } = useSupervisedTopics();
  const { data: allDeptTopicsRes, refetch: refetchAllTopics, isLoading: isAllTopicsLoading } = useTopics({ size: 100 });

  const isHOD = user?.role === 'HEAD';

  const handleRefresh = React.useCallback(async () => {
    setRefreshing(true);
    const promises: Promise<any>[] = [refetchStats(), refetchAssignments(), refetchSupervised()];
    if (isHOD) promises.push(refetchAllTopics());
    await Promise.all(promises);
    setRefreshing(false);
  }, [refetchStats, refetchAssignments, refetchSupervised, refetchAllTopics, isHOD]);

  const d = new Date();
  const TODAY = `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()}`;
  const isLoading = isStatsLoading || isAssignmentsLoading || isSupervisedLoading || (isHOD && isAllTopicsLoading);

  // Derive stats
  const assignedList = assignments || [];
  const supervisedList = supervisedTopics || [];
  const allDeptTopics = allDeptTopicsRes?.topics || [];

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
            id: a.id, // Assignment ID for unique key
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
          id: t.id, // This is groupId from getTopics
          topicId: t.topicId,
          groupId: t.id, // Explicitly treat t.id as groupId
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

  // Group assignments by session or date
  const sessions = [];

  if (uniqueCombinedTopics.length > 0) {
    sessions.push({
      id: 's1',
      name: 'Nhiệm vụ của tôi',
      topics: uniqueCombinedTopics
    });
  }

  if (isHOD && allDeptTopics.length > 0) {
    sessions.push({
      id: 'hod_all',
      name: 'Quản lý Bộ môn',
      topics: allDeptTopics.map(t => ({
        id: t.id, // GroupId
        topicId: t.topicId,
        groupId: t.id,
        groupName: t.code || t.title || 'Topic',
        status: t.status,
        statusLabel: t.status,
        statusColor: '#64748b',
        role: 'QUẢN LÝ',
        schedule: t.defense_schedule,
        room: t.room
      }))
    });
  }

  const totalGroups = isHOD ? allDeptTopics.length : uniqueCombinedTopics.length;
  const notStarted = assignedList.filter(a => a.status === 'PENDING').length;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f8fafc' }}>
      <ScrollView
        style={{ flex: 1 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={BLUE} />}
      >
        {/* Modern White Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greetSmall}>Xin chào,</Text>
            <Text style={styles.greetName}>{user?.full_name || 'Giảng viên'}</Text>
          </View>
          <View style={styles.headerRight}>
            <View style={styles.dateBadge}>
              <Text style={styles.dateText}>{TODAY}</Text>
            </View>
          </View>
        </View>

        {/* Stats card - Premium design */}
        <View style={styles.statsCard}>
          <View style={styles.statsCol}>
            <Text style={styles.statsLabel}>CA CHẤM</Text>
            <Text style={styles.statsValue}>{sessions.length}</Text>
          </View>
          <View style={[styles.statsCol, styles.statsBorder]}>
            <Text style={styles.statsLabel}>TỔNG NHÓM</Text>
            <Text style={styles.statsValue}>{totalGroups}</Text>
          </View>
          <View style={[styles.statsCol, styles.statsBorder]}>
            <Text style={styles.statsLabel}>CHƯA CHẤM</Text>
            <Text style={[styles.statsValue, { color: '#ef4444' }]}>{notStarted}</Text>
          </View>
        </View>

        {/* HOD Quick Access */}
        {isHOD && (
          <TouchableOpacity 
            style={styles.hodQuickCard} 
            onPress={() => router.push('/grading-management' as any)}
            activeOpacity={0.8}
          >
            <View style={styles.hodIconContainer}>
              <Trophy size={22} color="#fff" />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.hodCardTitle}>Quản lý chấm điểm</Text>
              <Text style={styles.hodCardSub}>Theo dõi tiến độ & chốt điểm bộ môn</Text>
            </View>
            <ChevronRight size={20} color={BLUE} />
          </TouchableOpacity>
        )}

        {/* Sessions */}
        <View style={styles.body}>
          <Text style={styles.sectionTitle}>Ca chấm hôm nay</Text>

          {isLoading ? (
            <ActivityIndicator size="large" color={BLUE} style={{ marginTop: 20 }} />
          ) : sessions.length === 0 ? (
            <View style={{ alignItems: 'center', marginTop: 30 }}>
              <Text style={{ color: '#9ca3af' }}>Không có ca chấm nào</Text>
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
  headerRight: { alignItems: 'flex-end' },
  dateBadge: { backgroundColor: '#f1f5f9', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  dateText: { fontSize: 11, fontWeight: '700', color: '#64748b' },
  statsCard: {
    backgroundColor: '#fff', flexDirection: 'row',
    marginHorizontal: 16, borderRadius: 16,
    paddingVertical: 18, marginTop: 16,
    borderWidth: 1, borderColor: '#f1f5f9',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },
  statsCol: { flex: 1, alignItems: 'center' },
  statsBorder: { borderLeftWidth: 1, borderLeftColor: '#f1f5f9' },
  statsLabel: { fontSize: 10, color: '#94a3b8', fontWeight: '800', letterSpacing: 0.5 },
  statsValue: { fontSize: 24, fontWeight: '900', color: BLUE, marginTop: 4 },
  body: { paddingHorizontal: 16, paddingTop: 20, paddingBottom: 40 },
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
  hodQuickCard: {
    backgroundColor: '#fff',
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    borderRadius: 16,
    padding: 16,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  hodIconContainer: {
    width: 44,
    height: 44,
    backgroundColor: BLUE,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hodCardTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1e293b',
  },
  hodCardSub: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
    fontWeight: '500',
  },
});
