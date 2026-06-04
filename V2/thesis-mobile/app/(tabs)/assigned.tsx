import React from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, ActivityIndicator, RefreshControl, TextInput, StatusBar
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useAssignments } from '@/hooks/useAssignments';
import { useSupervisedTopics, useTopics } from '@/hooks/useTopics';
import { useAuthStore } from '@/store/auth';
import { 
  Search, CheckCircle2, Clock, 
  ChevronRight, Calendar 
} from 'lucide-react-native';

const BLUE = '#2563eb';

// Xếp loại điểm chữ (đồng bộ web)
const getClassification = (score: number) => {
  if (score >= 9.0) return { letter: 'A+', isPass: true };
  if (score >= 8.5) return { letter: 'A',  isPass: true };
  if (score >= 8.0) return { letter: 'B+', isPass: true };
  if (score >= 7.0) return { letter: 'B',  isPass: true };
  if (score >= 6.0) return { letter: 'C+', isPass: true };
  if (score >= 5.5) return { letter: 'C',  isPass: false };
  if (score >= 5.0) return { letter: 'D+', isPass: false };
  if (score >= 4.0) return { letter: 'D',  isPass: false };
  return { letter: 'F', isPass: false };
};


const FILTERS = [
  { key: 'ALL', label: 'Tất cả' },
  { key: 'GVHD', label: 'Hướng dẫn' },
  { key: 'GVPB', label: 'Phản biện' },
  { key: 'HĐBV', label: 'Hội đồng' },
];

export default function AssignedScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ filter?: string }>();
  const { user } = useAuthStore();
  const [activeFilter, setActiveFilter] = React.useState('ALL');
  const [searchQuery, setSearchQuery] = React.useState('');

  React.useEffect(() => {
    if (params.filter && FILTERS.some(f => f.key === params.filter)) {
      setActiveFilter(params.filter);
    }
  }, [params.filter]);

  const isHOD = user?.role === 'HEAD' || user?.role === 'ADMIN' || user?.role === 'COORDINATOR';

  const { data: assignments, isLoading: isAssignmentsLoading, refetch: refetchAssignments, isRefetching: isAssignmentsRefetching } = useAssignments();
  const { data: supervisedTopics, isLoading: isSupervisedLoading, refetch: refetchSupervised, isRefetching: isSupervisedRefetching } = useSupervisedTopics();
  const { data: allDeptTopicsRes, isLoading: isAllLoading, refetch: refetchAll, isRefetching: isAllRefetching } = useTopics({ size: 100 });

  const handleRefresh = async () => {
    const promises: Promise<any>[] = [refetchAssignments(), refetchSupervised()];
    if (isHOD) promises.push(refetchAll());
    await Promise.all(promises);
  };

  const isLoading = isAssignmentsLoading || isSupervisedLoading || (isHOD && isAllLoading);
  const isRefetching = isAssignmentsRefetching || isSupervisedRefetching || (isHOD && isAllRefetching);

  // Combine and normalize data
  const combined = React.useMemo(() => {
    const assignedReviewer = (assignments || []).filter(a => a.assignment_type === 'REVIEWER');
    const assignedCommittee = (assignments || []).filter(a => a.assignment_type === 'COMMITTEE');
    const supervised = supervisedTopics || [];
    const allDept = allDeptTopicsRes?.topics || [];

    let rawList: { topic: any, role: string, assignment?: any, groupId?: string | null }[] = [];

    // Helper to get personal roles for a topic
    const getPersonalRole = (t: any) => {
        if (!t) return null;
        const realTopicId = t.topicId || t.id;
        const groupId = t.id && !t.id.endsWith('-individual') ? t.id : null;

        if (supervised.some(st => st.id === t.id || st.topicId === realTopicId)) return 'GVHD';

        const reviewer = assignedReviewer.find(a => 
            a.topic_id === realTopicId && 
            (!a.group_id || !groupId || a.group_id === groupId)
        );
        if (reviewer) return 'GVPB';

        const committee = assignedCommittee.find(a => 
            a.topic_id === realTopicId && 
            (!a.group_id || !groupId || a.group_id === groupId)
        );
        if (committee) return 'HĐBV';

        return isHOD ? 'XEM' : null;
    };

    // select personal assignments first
    const personalSupervised = supervised.flatMap(t => {
        const gid = t.id && t.id.endsWith('-individual') ? null : t.id;
        if (!t.registrations || t.registrations.length === 0) {
            return [{ topic: t, role: 'GVHD', groupId: gid }];
        }
        return t.registrations.map(reg => ({ 
            topic: t, 
            role: 'GVHD', 
            groupId: reg.group_id || gid 
        }));
    });

    const personalReviewer = assignedReviewer.map(a => ({ topic: a.topic, role: 'GVPB', assignment: a, groupId: a.group_id }));
    const personalCommittee = assignedCommittee.map(a => ({ topic: a.topic, role: 'HĐBV', assignment: a, groupId: a.group_id }));

    const personalList = [...personalSupervised, ...personalReviewer, ...personalCommittee];

    if (activeFilter === 'ALL') {
      if (isHOD) {
        // HOD sees everything in dept, but we prioritize marking their personal ones
        const deptList = allDept.map(t => {
            const role = getPersonalRole(t) || 'XEM';
            const gid = t.id && t.id.endsWith('-individual') ? null : t.id;
            return { topic: t, role, groupId: gid };
        });
        
        rawList = [...personalList];
        
        // Add dept topics that aren't already in personalList (by topic id)
        const personalTopicIds = new Set(personalList.map(item => item.topic?.id));
        deptList.forEach(item => {
            if (!personalTopicIds.has(item.topic?.id)) {
                rawList.push(item);
            }
        });
      } else {
        rawList = personalList;
      }
    } else if (activeFilter === 'GVHD') {
        rawList = personalSupervised;
    } else if (activeFilter === 'GVPB') {
        rawList = personalReviewer;
    } else if (activeFilter === 'HĐBV') {
        rawList = personalCommittee;
    }

    // Normalize for display
    let normalized = rawList.map(item => {
      const t = item.topic;
      if (!t) return null;
      
      const groupId = (item as any).groupId || null;
      // Filter grades for this specific group
      const groupGrades = t.grades?.filter((g: any) => g.group_id === groupId || (g.group_id === null && !groupId)) || [];
      
      // Find the specific registration for this group
      const reg = t.registrations?.find((r: any) => r.group_id === groupId || (!r.group_id && !groupId));
      const studentId = reg?.student_id || t.students?.[0]?.id;
      
      // Điểm cá nhân: chỉ dùng finalScore của sinh viên đó, không tính trung bình nhóm
      const finalScoreForStudent = (t.final_scores || []).find((fs: any) => 
        studentId && fs.student_id === studentId
      );

      const isFinalPhase = t.semester?.calculated_phase === 'FINAL';
      const isFinalized = isFinalPhase && (t.status === 'FINALIZED' || (finalScoreForStudent?.finalized === true));
      const isGraded = groupGrades.length > 0 || !!finalScoreForStudent;
      
      const groupName = t.groupName || reg?.group?.name || reg?.student?.full_name || t.students?.[0]?.full_name || 'Đề tài lẻ';

      // Chỉ hiển thị điểm cá nhân từ finalScore, không dùng average nhóm
      const displayScore = finalScoreForStudent?.final_score ?? null;
      const letterGrade = displayScore != null ? getClassification(displayScore).letter : null;
      const isPassGrade = displayScore != null ? getClassification(displayScore).isPass : null;

      const isMidtermFailed = reg?.midterm_status === 'FAIL' || reg?.midtermStatus === 'FAIL';
      const isFinalFailed = finalScoreForStudent?.finalized && (displayScore !== null && displayScore < 6.0);
      const isFailed = isMidtermFailed || isFinalFailed;
      const finalRole = item.role === 'XEM' ? (t.supervisor_id === user?.id ? 'GVHD' : 'TBM') : item.role;
      const isDirectRole = (finalRole === 'GVHD' || finalRole === 'GVPB' || finalRole === 'HĐBV') && user?.role !== 'STUDENT';
      const hasPersonalGrade = groupGrades.some((g: any) => g.grader_id === user?.id || g.graderId === user?.id);

      let statusLabel = 'Chờ chấm';
      let statusColor = '#ea580c';
      let statusBg = '#fff7ed';

      if (isFailed) {
        statusLabel = 'Đã rớt';
        statusColor = '#ef4444';
        statusBg = '#fef2f2';
      } else if (isDirectRole) {
        if (hasPersonalGrade) {
          statusLabel = 'Đã chấm';
          statusColor = '#16a34a';
          statusBg = '#f0fdf4';
        } else {
          statusLabel = 'Chờ chấm';
          statusColor = '#ea580c';
          statusBg = '#fff7ed';
        }
      } else {
        if (isFinalized) {
          statusLabel = 'Đã chốt';
          statusColor = BLUE;
          statusBg = '#f0f9ff';
        } else {
          statusLabel = 'Đang chấm';
          statusColor = '#ea580c';
          statusBg = '#fff7ed';
        }
      }

      return {
        id: item.assignment?.id || `topic-${t.id}-${groupId || 'no-group'}-${item.role}`,
        topicId: t.id,
        groupId: groupId,
        title: t.title || 'Đề tài không có tiêu đề',
        code: t.code || 'N/A',
        role: finalRole,
        status: t.status,
        date: t.created_at || new Date().toISOString(),
        schedule: t.defense_schedule || t.defense_schedules?.[0],
        groupName: groupName,
        department: t.department?.name || 'CNTT',
        isGraded,
        isFinalized,
        score: displayScore != null ? Number(displayScore.toFixed(2)).toString() : null,
        letterGrade,
        isPassGrade,
        statusLabel,
        statusColor,
        statusBg,
      };

    });

    const filteredList = normalized.filter((item): item is NonNullable<typeof item> => item !== null);

    let result = filteredList;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(item => 
        item.title.toLowerCase().includes(q) || 
        item.code.toLowerCase().includes(q) ||
        item.groupName.toLowerCase().includes(q)
      );
    }

    const seen = new Set();
    return result.filter(item => {
        const key = `${item.topicId}-${item.groupId || 'no-group'}-${item.role}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
  }, [assignments, supervisedTopics, allDeptTopicsRes, activeFilter, searchQuery, isHOD, user?.id]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f8fafc' }}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Text style={styles.headerTitle}>Đề tài của tôi</Text>
          <View style={styles.countBadge}>
            <Text style={styles.countText}>{combined.length}</Text>
          </View>
        </View>
        <Text style={styles.headerSub}>Danh sách đề tài bạn đang tham gia</Text>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 16 }}>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {FILTERS.map(f => (
              <TouchableOpacity
                key={f.key}
                onPress={() => setActiveFilter(f.key)}
                style={[styles.filterChip, activeFilter === f.key && styles.filterChipActive]}
              >
                <Text style={[styles.filterChipText, activeFilter === f.key && styles.filterChipTextActive]}>
                  {f.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>

        <View style={styles.searchContainer}>
          <View style={styles.searchBox}>
            <Search size={18} color="#94a3b8" />
            <TextInput
              style={styles.searchInput}
              placeholder="Tìm tên đề tài, nhóm, mã số..."
              placeholderTextColor="#94a3b8"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>
        </View>
      </View>

      <ScrollView
        style={{ flex: 1, backgroundColor: '#fafafa' }}
        contentContainerStyle={{ padding: 16 }}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={handleRefresh} tintColor={BLUE} />}
      >
        {isLoading ? (
          <ActivityIndicator size="large" color={BLUE} style={{ marginTop: 40 }} />
        ) : combined.length === 0 ? (
          <View style={{ alignItems: 'center', paddingTop: 60 }}>
            <Text style={{ color: '#9ca3af' }}>Không có đề tài nào</Text>
          </View>
        ) : combined.map((item) => (
          <TouchableOpacity
            key={item.id}
            style={styles.card}
            onPress={() => {
              const viewMode = activeFilter === 'ALL' ? 'review' : 'grading';
              router.push(`/topic/${item.topicId}?groupId=${item.groupId || ''}&viewMode=${viewMode}&role=${item.role}` as any);
            }}
          >
            <View style={styles.cardStatusCol}>
              <View style={[styles.statusIconContainer, { backgroundColor: item.isGraded ? '#f0fdf4' : '#eff6ff' }]}>
                {item.isGraded ? (
                  <CheckCircle2 size={20} color="#16a34a" />
                ) : (
                  <Clock size={20} color={BLUE} />
                )}
              </View>
            </View>

            <View style={styles.cardContentCol}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={[styles.roleLabel, { color: item.role === 'GVHD' ? BLUE : item.role === 'GVPB' ? '#3b82f6' : item.role === 'HĐBV' ? '#6366f1' : item.role === 'TBM' ? '#0f766e' : '#94a3b8' }]}>
                  {item.role}
                </Text>
                <Text style={styles.topicCode}>{item.code}</Text>
              </View>

              <Text style={styles.topicTitle} numberOfLines={2}>{item.title}</Text>
              
              <View style={styles.metadataRow}>
                <Text style={styles.metadataText}>{item.groupName}  •  {item.department}</Text>
              </View>

              <View style={styles.footerRow}>
                <View style={styles.footerItem}>
                  <Calendar size={14} color="#94a3b8" />
                  <Text style={styles.footerText}>Giao: {new Date(item.date).toLocaleDateString('vi-VN')}</Text>
                </View>
                {item.schedule && (
                  <View style={styles.footerItem}>
                    <Clock size={14} color="#94a3b8" />
                    <Text style={styles.footerText}>Chấm: {new Date(item.schedule.defense_date).toLocaleDateString('vi-VN')}</Text>
                  </View>
                )}
              </View>
            </View>

            <View style={styles.cardRightCol}>
              <View style={[styles.statusBadge, { backgroundColor: item.statusBg }]}>
                <Text style={[styles.statusBadgeText, { color: item.statusColor }]}>
                  {item.statusLabel}
                </Text>
              </View>
              {item.score && (
                <View style={{ alignItems: 'flex-end', gap: 2 }}>
                  <Text style={styles.scoreText}>{item.score}</Text>
                  {item.letterGrade && (
                    <View style={[styles.statusBadge, { 
                      backgroundColor: item.isPassGrade ? '#dcfce7' : '#fee2e2',
                      paddingHorizontal: 6, paddingVertical: 2, marginTop: 2
                    }]}>
                      <Text style={{ fontSize: 11, fontWeight: '800', color: item.isPassGrade ? '#166534' : '#991b1b' }}>
                        {item.letterGrade}
                      </Text>
                    </View>
                  )}
                </View>
              )}
              <View style={styles.chevronContainer}>
                <ChevronRight size={20} color="#cbd5e1" />
              </View>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: { 
    backgroundColor: '#fff', 
    paddingHorizontal: 16, 
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9'
  },
  headerTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerTitle: { fontSize: 22, fontWeight: '800', color: '#111827' },
  countBadge: { backgroundColor: '#f1f5f9', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  countText: { fontSize: 12, fontWeight: '700', color: '#64748b' },
  headerSub: { fontSize: 13, color: '#94a3b8', marginTop: 4, fontWeight: '500' },
  filterChip: { 
    borderRadius: 12, paddingHorizontal: 16, paddingVertical: 8, 
    backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#f1f5f9' 
  },
  filterChipActive: { backgroundColor: BLUE, borderColor: BLUE },
  filterChipText: { fontSize: 13, fontWeight: '700', color: '#64748b' },
  filterChipTextActive: { color: '#fff' },
  searchContainer: { flexDirection: 'row', marginTop: 16, alignItems: 'center' },
  searchBox: { 
    flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#f8fafc',
    borderWidth: 1, borderColor: '#f1f5f9', borderRadius: 12, paddingHorizontal: 12, height: 44
  },
  searchInput: { flex: 1, marginLeft: 8, fontSize: 14, color: '#111827' },
  card: {
    backgroundColor: '#fff', borderRadius: 20, padding: 16,
    flexDirection: 'row', marginBottom: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.03, shadowRadius: 10, elevation: 2,
    borderWidth: 1, borderColor: '#f1f5f9'
  },
  cardStatusCol: { marginRight: 12 },
  statusIconContainer: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  cardContentCol: { flex: 1 },
  roleLabel: { fontSize: 12, fontWeight: '800' },
  topicCode: { fontSize: 12, color: '#64748b', fontWeight: '500' },
  topicTitle: { fontSize: 16, fontWeight: '700', color: '#1e293b', marginTop: 6, lineHeight: 22 },
  metadataRow: { marginTop: 4 },
  metadataText: { fontSize: 13, color: '#64748b' },
  footerRow: { flexDirection: 'row', marginTop: 12, gap: 12 },
  footerItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  footerText: { fontSize: 11, color: '#94a3b8', fontWeight: '500' },
  cardRightCol: { width: 90, alignItems: 'flex-end', justifyContent: 'center' },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  statusBadgeText: { fontSize: 11, fontWeight: '700' },
  scoreText: { fontSize: 16, fontWeight: '800', color: BLUE, marginTop: 8 },
  chevronContainer: { marginTop: 10 },
});
