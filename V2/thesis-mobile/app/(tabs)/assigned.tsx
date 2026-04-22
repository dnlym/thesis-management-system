import React from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, SafeAreaView
} from 'react-native';
import { useRouter } from 'expo-router';

const BLUE = '#2563eb';

const FILTERS = [
  { key: 'ALL', label: 'Tất cả' },
  { key: 'NOT_STARTED', label: 'Chưa chấm' },
  { key: 'DRAFT', label: 'Nháp' },
  { key: 'SUBMITTED', label: 'Đã nộp' },
];

const ALL_TOPICS = [
  { id: '2', groupName: 'Nhóm AI-02', session: 'Hội đồng 1 – 08:00', role: 'GVPB', status: 'NOT_STARTED', statusLabel: 'Chưa chấm', statusColor: '#ea580c' },
  { id: '4', groupName: 'Nhóm AI-04', session: 'Hội đồng 1 – 08:00', role: 'GVPB', status: 'NOT_STARTED', statusLabel: 'Chưa chấm', statusColor: '#ea580c' },
  { id: '5', groupName: 'Nhóm SE-01', session: 'Hội đồng 2 – 13:30', role: 'GVPB', status: 'NOT_STARTED', statusLabel: 'Chưa chấm', statusColor: '#ea580c' },
  { id: '7', groupName: 'Nhóm AI-07', session: 'Hội đồng 3 – 08:00', role: 'GVPB', status: 'NOT_STARTED', statusLabel: 'Chưa chấm', statusColor: '#ea580c' },
  { id: '8', groupName: 'Nhóm SE-05', session: 'Hội đồng 3 – 08:00', role: 'GVPB', status: 'NOT_STARTED', statusLabel: 'Chưa chấm', statusColor: '#ea580c' },
  { id: '3', groupName: 'Nhóm AI-03', session: 'Hội đồng 1 – 08:00', role: 'GVPB', status: 'DRAFT', statusLabel: 'Nháp', statusColor: '#ca8a04' },
  { id: '1', groupName: 'Nhóm AI-01', session: 'Hội đồng 1 – 08:00', role: 'GVPB', status: 'SUBMITTED', statusLabel: 'Đã nộp', statusColor: '#16a34a' },
  { id: '6', groupName: 'Nhóm SE-02', session: 'Hội đồng 2 – 13:30', role: 'GVPB', status: 'SUBMITTED', statusLabel: 'Đã nộp', statusColor: '#16a34a' },
];

export default function AssignedScreen() {
  const router = useRouter();
  const [activeFilter, setActiveFilter] = React.useState('ALL');
  const filtered = activeFilter === 'ALL' ? ALL_TOPICS : ALL_TOPICS.filter(t => t.status === activeFilter);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Nhóm của tôi</Text>
        <Text style={styles.headerNote}>(Vai trò được hệ thống tự động xác định)</Text>

        {/* Filter tabs */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 12 }}>
          <View style={{ flexDirection: 'row', paddingBottom: 4 }}>
            {FILTERS.map(f => (
              <TouchableOpacity
                key={f.key}
                onPress={() => setActiveFilter(f.key)}
                style={[styles.filterTab, activeFilter === f.key && styles.filterTabActive]}
              >
                <Text style={[styles.filterTabText, activeFilter === f.key && styles.filterTabTextActive]}>
                  {f.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      </View>

      {/* List */}
      <ScrollView style={{ flex: 1, backgroundColor: '#f8fafc' }} contentContainerStyle={{ padding: 16 }}>
        {filtered.map((topic, i) => (
          <TouchableOpacity
            key={topic.id}
            style={styles.card}
            onPress={() => router.push(`/topic/${topic.id}` as any)}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.cardGroup}>{topic.groupName}</Text>
              <Text style={styles.cardSession}>{topic.session}</Text>
            </View>
            <View style={{ alignItems: 'flex-end', gap: 4 }}>
              <View style={styles.roleBadge}>
                <Text style={styles.roleBadgeText}>{topic.role}</Text>
              </View>
              <Text style={[styles.statusText, { color: topic.statusColor }]}>{topic.statusLabel}</Text>
            </View>
          </TouchableOpacity>
        ))}
        {filtered.length === 0 && (
          <View style={{ alignItems: 'center', paddingTop: 60 }}>
            <Text style={{ color: '#9ca3af' }}>Không có nhóm nào</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: { backgroundColor: '#fff', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#111827' },
  headerNote: { fontSize: 10, color: '#9ca3af', marginTop: 2 },
  filterTab: { borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7, marginRight: 8, backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: '#e5e7eb' },
  filterTabActive: { backgroundColor: BLUE, borderColor: BLUE },
  filterTabText: { fontSize: 12, fontWeight: '600', color: '#6b7280' },
  filterTabTextActive: { color: '#fff' },
  card: {
    backgroundColor: '#fff', borderRadius: 12, padding: 14,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 10, borderWidth: 1, borderColor: '#f3f4f6',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  cardGroup: { fontSize: 14, fontWeight: '700', color: '#111827' },
  cardSession: { fontSize: 11, color: '#9ca3af', marginTop: 2 },
  roleBadge: { backgroundColor: '#eff6ff', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },
  roleBadgeText: { fontSize: 10, fontWeight: '700', color: BLUE },
  statusText: { fontSize: 11, fontWeight: '600' },
});
