import React from 'react';
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity,
    ActivityIndicator, RefreshControl, Platform, StatusBar
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { 
    Trophy, ChevronLeft, 
    CheckCircle2, Clock, AlertCircle, Lock,
    ChevronRight, Users
} from 'lucide-react-native';
import { useQuery } from '@tanstack/react-query';
import { GradingApi } from '@/api/grading';

const BLUE = '#2563eb';
const LIGHT_BLUE = '#eff6ff';

// Xếp loại điểm cá nhân (đồng bộ web)
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

type FilterType = 'all' | 'ready' | 'missing_supervisor' | 'missing_reviewer' | 'finalized';


export default function GradingManagementScreen() {
    const router = useRouter();
    const [filter, setFilter] = React.useState<FilterType>('all');
    
    const { data, isLoading, refetch, isRefetching } = useQuery({
        queryKey: ['grade-summary'],
        queryFn: () => GradingApi.getGradeSummary()
    });

    const stats = React.useMemo(() => {
        if (!data) return null;
        return {
            total: data.allTopics?.length || 0,
            ready: data.ready?.length || 0,
            missingSupervisor: data.missingSupervisor?.length || 0,
            missingReviewer: data.missingReviewer?.length || 0,
            finalized: data.finalized?.length || 0,
        };
    }, [data]);

    const filteredTopics = React.useMemo(() => {
        if (!data) return [];
        let result = data.allTopics || [];
        if (filter === 'ready') result = data.ready || [];
        else if (filter === 'missing_supervisor') result = data.missingSupervisor || [];
        else if (filter === 'missing_reviewer') result = data.missingReviewer || [];
        else if (filter === 'finalized') result = data.finalized || [];
        return result;
    }, [data, filter]);

    const onRefresh = () => {
        refetch();
    };

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="dark-content" />
            
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <ChevronLeft size={24} color="#374151" />
                </TouchableOpacity>
                <View style={{ flex: 1 }}>
                    <Text style={styles.headerTitle}>Quản lý chấm điểm</Text>
                    <Text style={styles.headerSub}>Theo dõi & Chốt kết quả</Text>
                </View>
                <View style={styles.headerIcon}>
                    <Trophy size={20} color={BLUE} />
                </View>
            </View>

            <ScrollView 
                style={styles.content}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl refreshing={isRefetching} onRefresh={onRefresh} tintColor={BLUE} />
                }
            >
                {/* Stats Grid */}
                <View style={styles.statsGrid}>
                    <StatCard 
                        label="TỔNG ĐỀ TÀI" 
                        value={stats?.total || 0} 
                        color="#6366f1" 
                        onPress={() => setFilter('all')}
                        active={filter === 'all'}
                    />
                    <StatCard 
                        label="SẴN SÀNG" 
                        value={stats?.ready || 0} 
                        color="#16a34a" 
                        onPress={() => setFilter('ready')}
                        active={filter === 'ready'}
                    />
                    <StatCard 
                        label="THIẾU HD" 
                        value={stats?.missingSupervisor || 0} 
                        color="#f59e0b" 
                        onPress={() => setFilter('missing_supervisor')}
                        active={filter === 'missing_supervisor'}
                    />
                    <StatCard 
                        label="ĐÃ CHỐT" 
                        value={stats?.finalized || 0} 
                        color="#64748b" 
                        onPress={() => setFilter('finalized')}
                        active={filter === 'finalized'}
                    />
                </View>

                {/* Filter Tabs */}
                <ScrollView 
                    horizontal 
                    showsHorizontalScrollIndicator={false} 
                    contentContainerStyle={styles.filterContainer}
                >
                    <FilterChip 
                        label="Tất cả" 
                        count={stats?.total}
                        active={filter === 'all'} 
                        onPress={() => setFilter('all')} 
                    />
                    <FilterChip 
                        label="Sẵn sàng" 
                        count={stats?.ready}
                        active={filter === 'ready'} 
                        onPress={() => setFilter('ready')} 
                    />
                    <FilterChip 
                        label="Thiếu GVHD" 
                        count={stats?.missingSupervisor}
                        active={filter === 'missing_supervisor'} 
                        onPress={() => setFilter('missing_supervisor')} 
                    />
                    <FilterChip 
                        label="Thiếu PB" 
                        count={stats?.missingReviewer}
                        active={filter === 'missing_reviewer'} 
                        onPress={() => setFilter('missing_reviewer')} 
                    />
                    <FilterChip 
                        label="Đã chốt" 
                        count={stats?.finalized}
                        active={filter === 'finalized'} 
                        onPress={() => setFilter('finalized')} 
                    />
                </ScrollView>

                {/* Topic List */}
                <View style={styles.listSection}>
                    <Text style={styles.sectionTitle}>
                        DANH SÁCH ĐỀ TÀI ({filteredTopics.length})
                    </Text>

                    {isLoading ? (
                        <ActivityIndicator size="large" color={BLUE} style={{ marginTop: 40 }} />
                    ) : filteredTopics.length === 0 ? (
                        <View style={styles.emptyContainer}>
                            <AlertCircle size={48} color="#cbd5e1" />
                            <Text style={styles.emptyText}>Không tìm thấy đề tài nào</Text>
                        </View>
                    ) : (
                        filteredTopics.map((topic: any) => (
                            <TopicMonitoringCard 
                                key={`${topic.id}-${topic.groupId || 'single'}`} 
                                topic={topic} 
                                onPress={() => router.push(`/topic/${topic.id}/grade-review/${topic.students[0]?.student?.id || ''}` as any)}
                            />
                        ))
                    )}
                </View>
                <View style={{ height: 40 }} />
            </ScrollView>
        </SafeAreaView>
    );
}

function StatCard({ label, value, color, onPress, active }: any) {
    return (
        <TouchableOpacity 
            style={[styles.statCard, active && { borderColor: color, borderWidth: 2 }]} 
            onPress={onPress}
            activeOpacity={0.7}
        >
            <Text style={[styles.statLabel, { color }]}>{label}</Text>
            <Text style={[styles.statValue, { color }]}>{value}</Text>
        </TouchableOpacity>
    );
}

function FilterChip({ label, count, active, onPress }: any) {
    return (
        <TouchableOpacity 
            style={[styles.filterChip, active && styles.filterChipActive]} 
            onPress={onPress}
        >
            <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>{label}</Text>
            {count !== undefined && (
                <View style={[styles.chipCount, active && styles.chipCountActive]}>
                    <Text style={[styles.chipCountText, active && styles.chipCountTextActive]}>{count}</Text>
                </View>
            )}
        </TouchableOpacity>
    );
}

function TopicMonitoringCard({ topic, onPress }: any) {
    const gs = topic.gradingStatus;
    const isReady = gs?.isReadyForDecision;
    const isFinalized = gs?.isFinalized;

    return (
        <TouchableOpacity style={styles.topicCard} onPress={onPress} activeOpacity={0.7}>
            <View style={styles.cardHeader}>
                <View style={styles.codeBadge}>
                    <Text style={styles.codeText}>{topic.code}</Text>
                </View>
                {isFinalized ? (
                    <View style={[styles.statusBadge, { backgroundColor: '#f1f5f9' }]}>
                        <Lock size={12} color="#64748b" />
                        <Text style={[styles.statusText, { color: '#64748b' }]}>ĐÃ CHỐT</Text>
                    </View>
                ) : isReady ? (
                    <View style={[styles.statusBadge, { backgroundColor: '#f0fdf4' }]}>
                        <CheckCircle2 size={12} color="#16a34a" />
                        <Text style={[styles.statusText, { color: '#16a34a' }]}>SẴN SÀNG</Text>
                    </View>
                ) : (
                    <View style={[styles.statusBadge, { backgroundColor: '#fff7ed' }]}>
                        <Clock size={12} color="#ea580c" />
                        <Text style={[styles.statusText, { color: '#ea580c' }]}>ĐANG CHẤM</Text>
                    </View>
                )}
            </View>

            <Text style={styles.topicTitle} numberOfLines={2}>{topic.title}</Text>
            
            <View style={styles.studentInfo}>
                <View style={{ flex: 1 }}>
                    {topic.students?.map((s: any, idx: number) => {
                        const score = s.finalScore?.final_score;
                        const isMidtermFailed = s.finalScore?.grade_classification === 'Rớt giữa kỳ';
                        const cls = score != null && !isMidtermFailed ? getClassification(score) : null;
                        return (
                            <View
                                key={s.student?.id || idx}
                                style={[
                                    styles.studentRow,
                                    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 4 },
                                    idx < topic.students.length - 1 && { borderBottomWidth: 1, borderBottomColor: '#f1f5f9', marginBottom: 4 }
                                ]}
                            >
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
                                    <Users size={13} color="#94a3b8" />
                                    <Text style={[styles.studentNames, { flex: 1 }]} numberOfLines={1}>
                                        {s.student?.full_name || 'N/A'}
                                    </Text>
                                </View>
                                {isMidtermFailed ? (
                                    <View style={[styles.scoreBadge, { backgroundColor: '#fee2e2' }]}>
                                        <Text style={[styles.scoreValue, { color: '#dc2626', fontSize: 10 }]}>Rớt GK</Text>
                                    </View>
                                ) : score != null ? (
                                    <View style={{ alignItems: 'flex-end', gap: 2 }}>
                                        <Text style={styles.scoreValue}>{score.toFixed(1)}</Text>
                                        <View style={[
                                            styles.scoreBadge,
                                            { backgroundColor: cls?.isPass ? '#dcfce7' : '#fee2e2', paddingHorizontal: 6, paddingVertical: 1 }
                                        ]}>
                                            <Text style={{ fontSize: 10, fontWeight: '800', color: cls?.isPass ? '#166534' : '#991b1b' }}>
                                                {cls?.letter}
                                            </Text>
                                        </View>
                                    </View>
                                ) : (
                                    <Text style={{ fontSize: 10, color: '#94a3b8', fontWeight: '600' }}>Chưa có</Text>
                                )}
                            </View>
                        );
                    })}
                </View>
            </View>

            <View style={styles.divider} />

            <View style={styles.progressSection}>
                <ProgressIndicator label="HD" active={gs?.supervisorGraded} />
                <ProgressIndicator 
                    label="PB" 
                    active={gs?.isReviewerComplete} 
                    sub={`${gs?.reviewerGradedCount}/${gs?.totalReviewersRequired}`} 
                />
                <ProgressIndicator 
                    label="HĐ" 
                    active={gs?.isCommitteeComplete} 
                    sub={`${gs?.committeeGradedCount}/${gs?.totalCommitteeRequired}`} 
                />
                
                <View style={styles.actionArrow}>
                    <ChevronRight size={20} color="#cbd5e1" />
                </View>
            </View>
        </TouchableOpacity>
    );
}

function ProgressIndicator({ label, active, sub }: any) {
    return (
        <View style={styles.progressItem}>
            <View style={[styles.progressDot, active ? styles.progressDotActive : styles.progressDotInactive]}>
                {active ? <CheckCircle2 size={10} color="#fff" /> : <Clock size={10} color="#cbd5e1" />}
            </View>
            <Text style={[styles.progressLabel, active && styles.progressLabelActive]}>{label}</Text>
            {sub && <Text style={styles.progressSub}>{sub}</Text>}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f8fafc' },
    header: {
        backgroundColor: '#fff',
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
    },
    backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', marginRight: 8 },
    headerTitle: { fontSize: 18, fontWeight: '800', color: '#1e293b' },
    headerSub: { fontSize: 12, color: '#64748b', fontWeight: '500' },
    headerIcon: { width: 40, height: 40, backgroundColor: '#eff6ff', borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
    content: { flex: 1 },
    statsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        padding: 12,
        gap: 8,
    },
    statCard: {
        flex: 1,
        minWidth: '48%',
        backgroundColor: '#fff',
        padding: 16,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#f1f5f9',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
    },
    statLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 1 },
    statValue: { fontSize: 28, fontWeight: '900', marginTop: 4 },
    filterContainer: {
        paddingHorizontal: 16,
        paddingVertical: 12,
        gap: 8,
    },
    filterChip: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        marginRight: 8,
    },
    filterChipActive: {
        backgroundColor: BLUE,
        borderColor: BLUE,
    },
    filterChipText: { fontSize: 13, fontWeight: '600', color: '#64748b' },
    filterChipTextActive: { color: '#fff' },
    chipCount: {
        backgroundColor: '#f1f5f9',
        paddingHorizontal: 6,
        paddingVertical: 1,
        borderRadius: 10,
        marginLeft: 6,
    },
    chipCountActive: { backgroundColor: 'rgba(255,255,255,0.2)' },
    chipCountText: { fontSize: 10, fontWeight: '700', color: '#64748b' },
    chipCountTextActive: { color: '#fff' },
    listSection: { padding: 16 },
    sectionTitle: { fontSize: 11, fontWeight: '800', color: '#94a3b8', letterSpacing: 1, marginBottom: 12 },
    topicCard: {
        backgroundColor: '#fff',
        borderRadius: 20,
        padding: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#f1f5f9',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 10,
        elevation: 3,
    },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
    codeBadge: { backgroundColor: '#f1f5f9', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
    codeText: { fontSize: 10, fontWeight: '800', color: '#475569', fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
    statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
    statusText: { fontSize: 10, fontWeight: '800' },
    topicTitle: { fontSize: 15, fontWeight: '700', color: '#1e293b', lineHeight: 22, marginBottom: 8 },
    studentInfo: { flexDirection: 'column', marginBottom: 12 },
    studentRow: {},
    studentNames: { fontSize: 13, color: '#64748b', flex: 1 },
    divider: { height: 1, backgroundColor: '#f1f5f9', marginBottom: 12 },
    progressSection: { flexDirection: 'row', alignItems: 'center', gap: 16 },
    progressItem: { alignItems: 'center', gap: 4 },
    progressDot: { width: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
    progressDotActive: { backgroundColor: '#16a34a' },
    progressDotInactive: { backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: '#e2e8f0' },
    progressLabel: { fontSize: 10, fontWeight: '700', color: '#94a3b8' },
    progressLabelActive: { color: '#16a34a' },
    progressSub: { fontSize: 8, color: '#94a3b8', fontWeight: '600' },
    actionArrow: { marginLeft: 'auto' },
    emptyContainer: { alignItems: 'center', paddingVertical: 60, gap: 12 },
    emptyText: { color: '#94a3b8', fontSize: 14, fontWeight: '600' },
    scoreBadge: {
        backgroundColor: LIGHT_BLUE,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#bfdbfe',
    },
    scoreValue: {
        fontSize: 14,
        fontWeight: '900',
        color: BLUE,
    }
});
