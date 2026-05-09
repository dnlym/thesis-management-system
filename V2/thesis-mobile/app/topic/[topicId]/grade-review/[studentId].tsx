import React from 'react';
import {
    View, Text, ScrollView, TouchableOpacity,
    StyleSheet, ActivityIndicator, StatusBar, LayoutAnimation, Platform, UIManager
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { 
    ChevronLeft, ChevronRight, ChevronDown, CheckCircle2, 
    GraduationCap, Lock, Clock, Edit3, AlertCircle
} from 'lucide-react-native';
import { useTopic } from '@/hooks/useTopics';
import { useAuthStore } from '@/store/auth';
import { useGradingCriteria } from '@/hooks/useGrading';
import { GradingApi } from '@/api/grading';
import { Grade } from '@/types';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
}

const BLUE = '#2563eb';
const LIGHT_BLUE = '#eff6ff';
const GREEN = '#16a34a';

export default function GradeReviewScreen() {
    const { topicId, studentId: initialStudentId, groupId } = useLocalSearchParams();
    const router = useRouter();
    const { user: currentUser } = useAuthStore();
    
    const { data: topic, isLoading: isTopicLoading } = useTopic(topicId as string);
    const [selectedStudentId, setSelectedStudentId] = React.useState(initialStudentId as string);
    
    const [topicGradesData, setTopicGradesData] = React.useState<TopicGradesResponse | null>(null);
    const [isInitialLoading, setIsInitialLoading] = React.useState(true);
    const [isSubmitting, setIsSubmitting] = React.useState(false);
    const [expandedCriteria, setExpandedCriteria] = React.useState<string | null>(null);

    const toggleCriteria = (id: string) => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setExpandedCriteria(prev => prev === id ? null : id);
    };

    // Determine Role dynamically based on Backend assignments
    const raterRole = React.useMemo(() => {
        if (!topic || !currentUser) return 'REVIEWER_1';
        if (topic.supervisor_id === currentUser.id) return 'SUPERVISOR';
        const myAssignment = topic.assignments?.find(a => a.reviewer_id === currentUser.id);
        if (myAssignment) {
            if (myAssignment.assignment_type === 'REVIEWER') {
                const order = myAssignment.reviewer_order || 1;
                return `REVIEWER_${order}` as any;
            }
            if (myAssignment.assignment_type === 'COMMITTEE') {
                const cRole = myAssignment.committee_role;
                if (cRole === 'CHAIR') return 'COMMITTEE_CHAIR';
                if (cRole === 'SECRETARY') return 'COMMITTEE_SECRETARY';
                return 'COMMITTEE_MEMBER';
            }
        }
        return 'REVIEWER_1';
    }, [topic, currentUser]);

    const { data: criteriaRes, isLoading: isLoadingCriteria } = useGradingCriteria({
        criteriaType: raterRole as any,
        topicId: (topicId as string) || undefined
    });

    const criteriaList = React.useMemo(() => {
        if (!criteriaRes) return [];
        if (Array.isArray(criteriaRes)) return criteriaRes;
        const data = criteriaRes as any;
        let roleKey = 'REVIEWER';
        if (raterRole === 'SUPERVISOR') roleKey = 'SUPERVISOR';
        else if (raterRole.startsWith('COMMITTEE') || raterRole.includes('COUNCIL')) roleKey = 'COMMITTEE';
        return data[roleKey] || data.FINAL || Object.values(data)[0] || [];
    }, [criteriaRes, raterRole]);

    const students = React.useMemo(() => {
        const all = topic?.students || [];
        if (!groupId) return all;
        return all.filter((s: any) => s.groupId === groupId);
    }, [topic?.students, groupId]);

    React.useEffect(() => {
        const fetchAllData = async () => {
            if (!topic) return;
            try {
                const data = await GradingApi.getTopicGrades(topicId as string);
                setTopicGradesData(data);
            } catch (error) {
                console.error('Error fetching grades:', error);
            } finally {
                setIsInitialLoading(false);
            }
        };
        fetchAllData();
    }, [topicId, topic]);

    const reviewData = React.useMemo(() => {
        if (!topicGradesData || criteriaList.length === 0) return null;
        const allGrades: Grade[] = [
            ...(topicGradesData.advisorGrades || []),
            ...(topicGradesData.reviewerGrades || []),
            ...(topicGradesData.councilGrades || [])
        ];
        const myGrades = allGrades.filter(g => g.student_id === selectedStudentId && g.grader_id === currentUser?.id);
        if (myGrades.length === 0) return null;
        const firstGrade = myGrades[0];
        const gradedItems = criteriaList.map((c: any) => {
            const g = myGrades.find((grade: Grade) => grade.criterion_id === c.id);
            return { criterion: c, score: g?.score ?? 0, isGraded: !!g };
        });
        const totalScore = gradedItems.reduce((acc: number, item: any) => acc + (item.score * (item.criterion.weight || 0)), 0);
        const maxPossible = gradedItems.reduce((acc: number, item: any) => acc + ((item.criterion.max_score || 10) * (item.criterion.weight || 0)), 0);
        return {
            rater_role: firstGrade.rater_role,
            graded_at: firstGrade.graded_at,
            items: gradedItems,
            totalScore,
            maxPossible,
            generalComment: firstGrade.comments?.match(/\[META_DATA:(.*)\]/)?.[1] 
                ? JSON.parse(firstGrade.comments.match(/\[META_DATA:(.*)\]/)![1]).generalComment 
                : firstGrade.comments
        };
    }, [topicGradesData, criteriaList, selectedStudentId, currentUser]);

    if (isTopicLoading || isInitialLoading || isLoadingCriteria || !topic) {
        return (
            <SafeAreaView style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={BLUE} />
            </SafeAreaView>
        );
    }

    const roleDisplay = React.useMemo(() => {
        if (raterRole === 'SUPERVISOR') return 'GV hướng dẫn';
        if (raterRole === 'COMMITTEE_CHAIR') return 'Chủ tịch HĐ';
        if (raterRole === 'COMMITTEE_SECRETARY') return 'Thư ký HĐ';
        if (raterRole.startsWith('COMMITTEE')) return 'Thành viên HĐ';
        return 'GV phản biện';
    }, [raterRole]);

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
            <StatusBar barStyle="dark-content" />
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <ChevronLeft size={24} color="#374151" />
                </TouchableOpacity>
                <View style={{ flex: 1 }}>
                    <Text style={styles.headerTitle}>Xem lại điểm</Text>
                    <Text style={styles.headerSub}>{topic?.code || 'N/A'}</Text>
                </View>
                <View style={styles.roleBadge}><Text style={styles.roleBadgeText}>{roleDisplay}</Text></View>
            </View>

            <View style={styles.switcher}>
                <View style={styles.tabWrapper}>
                    {students.map((sv: any) => (
                        <TouchableOpacity
                            key={sv.id}
                            style={[styles.tab, sv.id === selectedStudentId && styles.tabActive]}
                            onPress={() => {
                                setSelectedStudentId(sv.id);
                                setExpandedCriteria(null);
                            }}
                        >
                            <User size={16} color={sv.id === selectedStudentId ? BLUE : '#94a3b8'} />
                            <Text style={[styles.tabText, sv.id === selectedStudentId && styles.tabTextActive]} numberOfLines={1}>
                                {sv.full_name.split(' ').pop()}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>
            </View>

            <ScrollView style={{ flex: 1, backgroundColor: '#f8fafc' }} showsVerticalScrollIndicator={false}>
                <View style={styles.topicCardContainer}>
                    <View style={styles.topicCard}>
                        <View style={styles.topicCardBody}>
                            <View style={styles.topicIconBox}>
                                <GraduationCap size={24} color={BLUE} />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.topicCardTitle} numberOfLines={2}>{topic.title}</Text>
                                <View style={styles.topicInfoGrid}>
                                    <View style={styles.topicInfoItem}>
                                        <Clock size={12} color="#94a3b8" />
                                        <Text style={styles.topicInfoText}>
                                            {reviewData?.graded_at ? new Date(reviewData.graded_at).toLocaleDateString('vi-VN') : 'Đang chấm'}
                                        </Text>
                                    </View>
                                    <View style={styles.topicInfoItem}>
                                        <Users size={12} color="#94a3b8" />
                                        <Text style={styles.topicInfoText}>{topic?.registrations?.[0]?.group?.name || 'N/A'}</Text>
                                    </View>
                                </View>
                            </View>
                        </View>
                    </View>
                </View>

                {!reviewData ? (
                    <View style={styles.emptyState}>
                        <AlertCircle size={48} color="#cbd5e1" />
                        <Text style={styles.emptyText}>Chưa có dữ liệu điểm nháp</Text>
                    </View>
                ) : (
                    <>
                        <View style={styles.statsCard}>
                            <View style={styles.statsCol}>
                                <View style={styles.statsLabelRow}>
                                    <Award size={14} color="#94a3b8" />
                                    <Text style={styles.statsLabel}>TỔNG ĐIỂM</Text>
                                </View>
                                <Text style={styles.statsValue}>
                                    {reviewData.totalScore.toFixed(1)} 
                                    <Text style={styles.statsMax}> / {Math.round(reviewData.maxPossible)}</Text>
                                </Text>
                            </View>
                            <View style={styles.statsDivider} />
                            <View style={styles.statsCol}>
                                <View style={styles.statsLabelRow}>
                                    <Info size={14} color="#94a3b8" />
                                    <Text style={styles.statsLabel}>XẾP LOẠI</Text>
                                </View>
                                <View style={styles.gradeBadge}>
                                    <Text style={styles.gradeBadgeText}>
                                        {reviewData.totalScore / reviewData.maxPossible >= 0.8 ? 'Giỏi' : 
                                         (reviewData.totalScore / reviewData.maxPossible >= 0.65 ? 'Khá' : 'Trung bình')}
                                    </Text>
                                </View>
                            </View>
                        </View>

                        <View style={styles.sectionHeader}>
                            <Text style={styles.sectionTitle}>CHI TIẾT ĐIỂM THÀNH PHẦN</Text>
                        </View>

                        <View style={styles.criteriaContainer}>
                            {reviewData.items.map((item: any, i: number) => {
                                const isExpanded = expandedCriteria === item.criterion.id;
                                return (
                                    <TouchableOpacity 
                                        key={item.criterion.id} 
                                        style={styles.criterionCard}
                                        onPress={() => toggleCriteria(item.criterion.id)}
                                        activeOpacity={0.7}
                                    >
                                        <View style={styles.criterionMain}>
                                            <View style={styles.criterionInfo}>
                                                <View style={styles.criterionTitleRow}>
                                                    {isExpanded ? <ChevronDown size={16} color={BLUE} style={{ marginRight: 8 }} /> : <ChevronRight size={16} color="#94a3b8" style={{ marginRight: 8 }} />}
                                                    <Text style={styles.criterionName} numberOfLines={isExpanded ? undefined : 1}>
                                                        {i + 1}. {item.criterion.name}
                                                    </Text>
                                                </View>
                                                {isExpanded && (
                                                    <Text style={styles.criterionDesc}>{item.criterion.description || 'Tiêu chí đánh giá chi tiết.'}</Text>
                                                )}
                                            </View>
                                            <View style={styles.scoreContainer}>
                                                <Text style={styles.itemScore}>{item.score.toFixed(1)}</Text>
                                                <Text style={styles.itemMax}>/{item.criterion.max_score}</Text>
                                            </View>
                                        </View>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>

                        {reviewData.generalComment ? (
                            <View style={styles.commentSection}>
                                <View style={styles.commentHeader}>
                                    <FileText size={16} color="#64748b" />
                                    <Text style={styles.commentLabel}>GHI CHÚ / NHẬN XÉT</Text>
                                </View>
                                <View style={styles.commentBox}>
                                    <Text style={styles.commentContent}>{reviewData.generalComment}</Text>
                                </View>
                            </View>
                        ) : null}
                    </>
                )}
                <View style={{ height: 120 }} />
            </ScrollView>

            <View style={styles.footer}>
                <TouchableOpacity 
                    style={styles.editBtn} 
                    onPress={() => router.push(`/topic/${topicId}/grading/${selectedStudentId}?groupId=${groupId || ''}` as any)}
                >
                    <Edit3 size={18} color={BLUE} />
                    <Text style={styles.editBtnText}>Chỉnh sửa</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                    style={[styles.lockBtn, isSubmitting && { opacity: 0.7 }]} 
                    onPress={async () => {
                        if (isSubmitting) return;
                        setIsSubmitting(true);
                        try {
                            let successCount = 0;
                            for (const student of students) {
                                const draft = await OfflineStorage.getDraft(currentUser!.id, topicId as string, groupId as string || null, raterRole, student.id);
                                if (draft && draft.scores) {
                                    const submissionData = {
                                        topic_id: topicId as string,
                                        group_id: groupId as string || undefined,
                                        student_id: student.id,
                                        rater_role: raterRole,
                                        scores: Object.entries(draft.scores).map(([cId, score]) => ({
                                            criterion_id: cId,
                                            score: parseFloat(score as string),
                                            comment: draft.comment || ''
                                        }))
                                    };
                                    await OfflineStorage.addToQueue(currentUser!.id, topicId as string, groupId as string || null, raterRole, student.id, submissionData);
                                    successCount++;
                                }
                            }
                            if (successCount > 0) {
                                Alert.alert('Thành công', `Đã chuẩn bị nộp điểm cho ${successCount} sinh viên.`, [{ text: 'Xác nhận', onPress: () => router.push('/(tabs)/assigned') }]);
                            } else {
                                Alert.alert('Thông báo', 'Vui lòng hoàn tất nhập điểm trước khi nộp.');
                            }
                        } catch (err: any) {
                            Alert.alert('Lỗi', err.message || 'Không thể gửi dữ liệu');
                        } finally {
                            setIsSubmitting(false);
                        }
                    }}
                >
                    {isSubmitting ? <ActivityIndicator color="#fff" /> : <Lock size={18} color="#fff" />}
                    <Text style={styles.lockBtnText}>Xác nhận & Khóa</Text>
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' },
    header: { flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
    backBtn: { marginRight: 12 },
    headerTitle: { fontSize: 18, fontWeight: '800', color: '#1e293b' },
    headerSub: { fontSize: 13, color: '#94a3b8', marginTop: 2, fontWeight: '500' },
    roleBadge: { backgroundColor: LIGHT_BLUE, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
    roleBadgeText: { fontSize: 11, fontWeight: '800', color: BLUE },

    switcher: { backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
    tabWrapper: { flexDirection: 'row', paddingHorizontal: 16 },
    tab: {
        flex: 1, paddingVertical: 14, alignItems: 'center', justifyContent: 'center',
        flexDirection: 'row', gap: 8, borderBottomWidth: 3, borderBottomColor: 'transparent'
    },
    tabActive: { borderBottomColor: BLUE, backgroundColor: '#f0f7ff' },
    tabText: { fontSize: 13, color: '#94a3b8', fontWeight: '700' },
    tabTextActive: { color: BLUE },

    topicCardContainer: { padding: 16 },
    topicCard: {
        backgroundColor: '#fff', borderRadius: 20,
        shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 12, elevation: 2,
        borderWidth: 1, borderColor: '#f1f5f9', overflow: 'hidden'
    },
    topicCardBody: { padding: 16, flexDirection: 'row', gap: 16 },
    topicIconBox: { width: 44, height: 44, borderRadius: 12, backgroundColor: LIGHT_BLUE, alignItems: 'center', justifyContent: 'center' },
    topicCardTitle: { fontSize: 15, fontWeight: '700', color: '#1e293b', lineHeight: 22 },
    topicInfoGrid: { flexDirection: 'row', gap: 16, marginTop: 8 },
    topicInfoItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    topicInfoText: { fontSize: 12, color: '#94a3b8', fontWeight: '500' },

    statsCard: {
        flexDirection: 'row', marginHorizontal: 16, marginBottom: 16, padding: 20, backgroundColor: '#fff',
        borderRadius: 20, borderWidth: 1, borderColor: '#f1f5f9', alignItems: 'center',
        shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.03, shadowRadius: 8, elevation: 2,
    },
    statsCol: { flex: 1, alignItems: 'center' },
    statsLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
    statsLabel: { fontSize: 10, fontWeight: '800', color: '#94a3b8', letterSpacing: 0.5 },
    statsValue: { fontSize: 32, fontWeight: '900', color: '#0f172a' },
    statsMax: { fontSize: 16, fontWeight: '600', color: '#cbd5e1' },
    statsDivider: { width: 1, height: 40, backgroundColor: '#f1f5f9' },
    gradeBadge: { backgroundColor: '#f1f5f9', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 10 },
    gradeBadgeText: { fontSize: 12, fontWeight: '800', color: '#475569' },

    sectionHeader: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12 },
    sectionTitle: { fontSize: 12, fontWeight: '800', color: '#64748b', letterSpacing: 1 },

    criteriaContainer: { paddingHorizontal: 16, gap: 12 },
    criterionCard: {
        backgroundColor: '#fff', padding: 16, borderRadius: 16,
        borderWidth: 1, borderColor: '#f1f5f9',
    },
    criterionMain: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
    criterionInfo: { flex: 1 },
    criterionTitleRow: { flexDirection: 'row', alignItems: 'center' },
    criterionName: { fontSize: 14, fontWeight: '700', color: '#334155', lineHeight: 20 },
    criterionDesc: { fontSize: 12, color: '#94a3b8', marginTop: 10, lineHeight: 18, borderLeftWidth: 2, borderLeftColor: '#e2e8f0', paddingLeft: 10 },
    scoreContainer: { alignItems: 'flex-end', minWidth: 50 },
    itemScore: { fontSize: 20, fontWeight: '900', color: BLUE },
    itemMax: { fontSize: 12, color: '#cbd5e1', fontWeight: '700' },

    commentSection: { padding: 16, marginTop: 8 },
    commentHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
    commentLabel: { fontSize: 11, fontWeight: '800', color: '#64748b' },
    commentBox: { padding: 16, backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: '#f1f5f9' },
    commentContent: { fontSize: 14, color: '#334155', lineHeight: 22 },

    emptyState: { padding: 40, alignItems: 'center', justifyContent: 'center' },
    emptyText: { marginTop: 12, color: '#94a3b8', fontSize: 14, textAlign: 'center' },

    footer: {
        position: 'absolute', bottom: 0, left: 0, right: 0, padding: 16, backgroundColor: '#fff',
        borderTopWidth: 1, borderTopColor: '#f1f5f9', flexDirection: 'row', gap: 12,
        paddingBottom: Platform.OS === 'ios' ? 34 : 16,
        shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 10
    },
    editBtn: {
        flex: 1, height: 52, borderRadius: 14, backgroundColor: '#f1f5f9',
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8
    },
    editBtnText: { color: BLUE, fontSize: 15, fontWeight: '700' },
    lockBtn: {
        flex: 1.5, height: 52, borderRadius: 14, backgroundColor: '#ef4444',
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8
    },
    lockBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' }
});
