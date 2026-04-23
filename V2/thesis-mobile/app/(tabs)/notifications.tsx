import React from 'react';
import {
  View, Text, ScrollView, StyleSheet, SafeAreaView, ActivityIndicator, RefreshControl, StatusBar
} from 'react-native';
import { Bell, Info, AlertCircle, CheckCircle2 } from 'lucide-react-native';

const BLUE = '#2563eb';

export default function NotificationsScreen() {
  const [refreshing, setRefreshing] = React.useState(false);

  const handleRefresh = () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1000);
  };

  // Mock notifications for now - in a real app, this would come from a hook
  const notifications = [
    {
      id: '1',
      title: 'Nhắc nhở chấm điểm',
      body: 'Bạn có 3 nhóm đề tài chưa hoàn tất chấm điểm Hội đồng.',
      time: '10 phút trước',
      type: 'warning',
      read: false,
    },
    {
      id: '2',
      title: 'Phân công phản biện mới',
      body: 'Bạn vừa được phân công phản biện cho đề tài: "Xây dựng hệ thống quản lý luận văn".',
      time: '2 giờ trước',
      type: 'info',
      read: true,
    },
    {
      id: '3',
      title: 'Xác nhận nộp điểm',
      body: 'Điểm của nhóm 102 đã được hệ thống ghi nhận thành công.',
      time: '1 ngày trước',
      type: 'success',
      read: true,
    },
  ];

  const getIcon = (type: string) => {
    switch (type) {
      case 'warning': return <AlertCircle size={20} color="#ea580c" />;
      case 'success': return <CheckCircle2 size={20} color="#16a34a" />;
      default: return <Info size={20} color={BLUE} />;
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Thông báo</Text>
        <View style={styles.unreadCountBadge}>
          <Text style={styles.unreadCountText}>{notifications.filter(n => !n.read).length} mới</Text>
        </View>
      </View>

      <ScrollView
        style={{ flex: 1, backgroundColor: '#f8fafc' }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={BLUE} />}
      >
        {notifications.length === 0 ? (
          <View style={styles.emptyState}>
            <Bell size={48} color="#d1d5db" />
            <Text style={styles.emptyText}>Bạn chưa có thông báo nào</Text>
          </View>
        ) : (
          <View style={{ padding: 16 }}>
            {notifications.map((item) => (
              <View key={item.id} style={[styles.card, !item.read && styles.unreadCard]}>
                <View style={styles.iconContainer}>
                  {getIcon(item.type)}
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <Text style={[styles.cardTitle, !item.read && styles.unreadText]}>{item.title}</Text>
                    {!item.read && <View style={styles.unreadDot} />}
                  </View>
                  <Text style={styles.cardBody}>{item.body}</Text>
                  <Text style={styles.cardTime}>{item.time}</Text>
                </View>
              </View>
            ))}
          </View>
        )}
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
    paddingVertical: 18, 
    borderBottomWidth: 1, 
    borderBottomColor: '#f1f5f9' 
  },
  headerTitle: { fontSize: 22, fontWeight: '800', color: '#111827' },
  unreadCountBadge: { backgroundColor: '#eff6ff', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  unreadCountText: { fontSize: 11, fontWeight: '700', color: BLUE },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', marginTop: 100 },
  emptyText: { marginTop: 16, fontSize: 15, color: '#9ca3af' },
  card: {
    backgroundColor: '#fff', borderRadius: 12, padding: 16,
    flexDirection: 'row', marginBottom: 12, borderWidth: 1, borderColor: '#f1f5f9',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  unreadCard: { borderColor: '#dbeafe', backgroundColor: '#f0f9ff' },
  iconContainer: { marginRight: 12, marginTop: 2 },
  cardTitle: { fontSize: 15, fontWeight: '600', color: '#1f2937' },
  unreadText: { color: '#1e40af', fontWeight: '700' },
  cardBody: { fontSize: 13, color: '#4b5563', marginTop: 4, lineHeight: 18 },
  cardTime: { fontSize: 11, color: '#9ca3af', marginTop: 8 },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: BLUE, marginLeft: 8, marginTop: 4 },
});
