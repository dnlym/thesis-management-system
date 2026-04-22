import React from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, RefreshControl, SafeAreaView
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '@/store/auth';

const TODAY = '22/05/2025';
const BLUE = '#2563eb';

const MOCK_SESSIONS = [
  {
    id: 's1',
    name: 'Hội đồng 1 – 08:00',
    topics: [
      { id: '1', groupName: 'Nhóm AI-01', status: 'SUBMITTED', statusLabel: 'Đã nộp', statusColor: '#16a34a', role: 'GVPB' },
      { id: '2', groupName: 'Nhóm AI-02', status: 'NOT_STARTED', statusLabel: 'Chưa chấm', statusColor: '#ea580c', role: 'GVPB' },
      { id: '3', groupName: 'Nhóm AI-03', status: 'DRAFT', statusLabel: 'Nháp', statusColor: '#ca8a04', role: 'GVPB' },
      { id: '4', groupName: 'Nhóm AI-04', status: 'SUBMITTED', statusLabel: 'Đã nộp', statusColor: '#16a34a', role: 'GVPB' },
    ]
  },
  {
    id: 's2',
    name: 'Hội đồng 2 – 13:30',
    topics: [
      { id: '5', groupName: 'Nhóm SE-01', status: 'NOT_STARTED', statusLabel: 'Chưa chấm', statusColor: '#ea580c', role: 'GVPB' },
      { id: '6', groupName: 'Nhóm SE-02', status: 'SUBMITTED', statusLabel: 'Đã nộp', statusColor: '#16a34a', role: 'GVPB' },
    ]
  },
];

const totalGroups = MOCK_SESSIONS.reduce((s, x) => s + x.topics.length, 0);
const notStarted = MOCK_SESSIONS.reduce((s, x) => s + x.topics.filter(t => t.status === 'NOT_STARTED').length, 0);

export default function DashboardScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [refreshing, setRefreshing] = React.useState(false);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f1f5f9' }}>
      <ScrollView
        style={{ flex: 1 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); setTimeout(() => setRefreshing(false), 1500); }} tintColor={BLUE} />}
      >
        {/* Blue header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greetSmall}>Xin chào,</Text>
            <Text style={styles.greetName}>{user?.full_name || 'TS. Nguyễn Văn A'}</Text>
          </View>
        </View>

        {/* Stats card */}
        <View style={styles.statsCard}>
          <View style={styles.statsCol}>
            <Text style={styles.statsLabel}>Hôm nay</Text>
            <Text style={styles.statsValueSm}>{TODAY}</Text>
          </View>
          <View style={[styles.statsCol, styles.statsBorder]}>
            <Text style={styles.statsLabel}>Ca chấm</Text>
            <Text style={styles.statsValue}>{MOCK_SESSIONS.length}</Text>
          </View>
          <View style={[styles.statsCol, styles.statsBorder]}>
            <Text style={styles.statsLabel}>Nhóm</Text>
            <Text style={styles.statsValue}>{totalGroups}</Text>
          </View>
          <View style={[styles.statsCol, styles.statsBorder]}>
            <Text style={styles.statsLabel}>Chưa chấm</Text>
            <Text style={[styles.statsValue, { color: '#ea580c' }]}>{notStarted}</Text>
          </View>
        </View>

        {/* Sessions */}
        <View style={styles.body}>
          <Text style={styles.sectionTitle}>Ca chấm hôm nay</Text>

          {MOCK_SESSIONS.map(session => (
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
                  key={topic.id}
                  style={styles.topicCard}
                  onPress={() => router.push(`/topic/${topic.id}` as any)}
                >
                  <View>
                    <Text style={styles.topicGroup}>{topic.groupName}</Text>
                    <Text style={styles.topicSession}>{session.name}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
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
  header: { backgroundColor: BLUE, paddingHorizontal: 20, paddingTop: 20, paddingBottom: 60 },
  greetSmall: { color: 'rgba(255,255,255,0.8)', fontSize: 13 },
  greetName: { color: '#fff', fontSize: 20, fontWeight: '700', marginTop: 2 },
  statsCard: {
    backgroundColor: '#fff', flexDirection: 'row',
    marginHorizontal: 16, borderRadius: 16,
    paddingVertical: 14, marginTop: -36,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08, shadowRadius: 12, elevation: 4,
  },
  statsCol: { flex: 1, alignItems: 'center' },
  statsBorder: { borderLeftWidth: 1, borderLeftColor: '#f0f0f0' },
  statsLabel: { fontSize: 9, color: '#9ca3af', fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  statsValue: { fontSize: 20, fontWeight: '800', color: '#111827', marginTop: 2 },
  statsValueSm: { fontSize: 11, fontWeight: '700', color: '#374151', marginTop: 2 },
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
});
