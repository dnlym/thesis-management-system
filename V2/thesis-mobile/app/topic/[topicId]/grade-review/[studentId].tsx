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
const GREEN = '#16a34a';

interface TopicGradesResponse {
    advisorGrades: Grade[];
    reviewerGrades: Grade[];
    councilGrades: Grade[];
    finalScore?: any;
    permissions?: any;
    topic?: any;
}

export default function GradeReviewScreen() {
    const { topicId, studentId: initialStudentId } = useLocalSearchParams();
    const router = useRouter();
    const { user: currentUser } = useAuthStore();
    
    const { data: topic, isLoading: isTopicLoading } = useTopic(topicId as string);
    const [selectedStudentId, setSelectedStudentId] = React.useState(initialStudentId as string);
    
    const [topicGradesData, setTopicGradesData] = React.useState<TopicGradesResponse | null>(null);
    const [isInitialLoading, setIsInitialLoading] = React.useState(true);
    const [expandedCriteria, setExpandedCriteria] = React.useState<string | null>(null);

    const toggleCriteria = (id: string) => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setExpandedCriteria(prev => prev === id ? null : id);
    };

    // Determine Role dynamically based on Backend assignments
    const raterRole = React.useMemo(() => {
        if (!topic || !currentUser) return 'REVIEWER_1';
        
        // 1. Check if Supervisor
        if (topic.supervisor_id === currentUser.id) return 'SUPERVISOR';
        
        // 2. Check Assignments
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
        
        // Map specific raterRole to generic criteria group
        let roleKey = 'REVIEWER';
        if (raterRole === 'SUPERVISOR') roleKey = 'SUPERVISOR';
        else if (raterRole.startsWith('COMMITTEE') || raterRole.includes('COUNCIL')) roleKey = 'COMMITTEE';
        
        return data[roleKey] || data.FINAL || Object.values(data)[0] || [];
    }, [criteriaRes, raterRole]);

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

        const myGrades = allGrades.filter(g => 
            g.student_id === selectedStudentId && g.grader_id === currentUser?.id
        );

        if (myGrades.length === 0) return null;

        const firstGrade = myGrades[0];
        
        const gradedItems = criteriaList.map((c: any) => {
            const g = myGrades.find((grade: Grade) => grade.criterion_id === c.id);
            return {
                criterion: c,
                score: g?.score ?? 0,
                isGraded: !!g
            };
        });

        const totalScore = gradedItems.reduce((acc: number, item: any) => 
            acc + (item.score * (item.criterion.weight || 0)), 0
        );
        
        const maxPossible = gradedItems.reduce((acc: number, item: any) => 
            acc + ((item.criterion.max_score || 10) * (item.criterion.weight || 0)), 0
        );

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
        if (raterRole === 'SUPERVISOR') return 'Giảng viên hướng dẫn';
        if (raterRole === 'COMMITTEE_CHAIR') return 'Chủ tịch Hội đồng';
        if (raterRole === 'COMMITTEE_SECRETARY') return 'Thư ký Hội đồng';
        if (raterRole.startsWith('COMMITTEE')) return 'Thành viên Hội đồng';
        return 'Giảng viên phản biện';
    }, [raterRole]);

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
            <StatusBar barStyle="dark-content" />
            
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <ChevronLeft size={28} color="#374151" />
                </TouchableOpacity>
                <View style={{ flex: 1 }}>
                    <Text style={styles.headerTitle}>{topic?.code || 'Chi tiết điểm'}</Text>
                    <Text style={styles.headerSub} numberOfLines={1}>
                        {topic?.room ? `Phòng: ${topic.room} • ` : ''}{roleDisplay}
                    </Text>
                </View>
                <View style={styles.statusBadge}>
                    <Text style={styles.statusBadgeText}>REVIEW MODE</Text>
                </View>
            </View>

            <View style={styles.tabsContainer}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16 }}>
                    {topic.students?.map((sv: any) => (
                        <TouchableOpacity 
                            key={sv.id}
                            style={[styles.tab, sv.id === selectedStudentId && styles.tabActive]}
                            onPress={() => {
                                setSelectedStudentId(sv.id);
                                setExpandedCriteria(null);
                            }}
                        >
                            <Text style={[styles.tabText, sv.id === selectedStudentId && styles.tabTextActive]}>{sv.full_name}</Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            </View>

            <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
                <View style={styles.infoCard}>
                    <View style={styles.topicRow}>
                        <View style={styles.iconBox}><GraduationCap size={24} color={BLUE} /></View>
                        <View style={{ flex: 1, marginLeft: 12 }}>
                            <Text style={styles.topicTitle} numberOfLines={2}>{topic.title}</Text>
                            <Text style={styles.department}>{topic.department?.name}</Text>
                        </View>
                    </View>
                    {reviewData?.graded_at && (
                        <View style={styles.timeRow}>
                            <Clock size={14} color="#94a3b8" />
                            <Text style={styles.timeText}>Nộp lúc: {new Date(reviewData.graded_at).toLocaleString('vi-VN')}</Text>
                        </View>
                    )}
                </View>

                {!reviewData ? (
                    <View style={styles.emptyState}>
                        <AlertCircle size={48} color="#cbd5e1" />
                        <Text style={styles.emptyText}>Chưa có dữ liệu điểm</Text>
                    </View>
                ) : (
                    <>
                        <View style={styles.scoreBoard}>
                            <View style={styles.scoreCol}>
                                <Text style={styles.scoreLabel}>TỔNG ĐIỂM (HỆ {Math.round(reviewData.maxPossible)})</Text>
                                <Text style={styles.scoreValue}>{reviewData.totalScore.toFixed(2)}<Text style={styles.scoreMax}>/{Math.round(reviewData.maxPossible)}</Text></Text>
                            </View>
                            <View style={styles.divider} />
                            <View style={styles.scoreCol}>
                                <Text style={styles.scoreLabel}>XẾP LOẠI</Text>
                                <View style={styles.statusBox}>
                                    <Text style={styles.statusText}>
                                        {reviewData.totalScore / reviewData.maxPossible >= 0.8 ? 'Giỏi' : (reviewData.totalScore / reviewData.maxPossible >= 0.65 ? 'Khá' : 'Trung bình')}
                                    </Text>
                                </View>
                            </View>
                        </View>

                        <View style={styles.section}>
                            <Text style={styles.sectionTitle}>CHI TIẾT ĐÁNH GIÁ</Text>
                            <View style={styles.criteriaCard}>
                                {reviewData.items.map((item: any, i: number) => {
                                    const isExpanded = expandedCriteria === item.criterion.id;
                                    return (
                                        <TouchableOpacity 
                                            key={item.criterion.id} 
                                            style={[styles.criteriaRow, i < reviewData.items.length - 1 && styles.rowBorder]}
                                            onPress={() => toggleCriteria(item.criterion.id)}
                                            activeOpacity={0.7}
                                        >
                                            <View style={styles.criteriaTitleCol}>
                                                <View style={styles.nameRow}>
                                                    <View style={styles.chevronBox}>
                                                        {isExpanded ? <ChevronDown size={16} color={BLUE} /> : <ChevronRight size={16} color="#94a3b8" />}
                                                    </View>
                                                    <Text style={styles.criterionName} numberOfLines={isExpanded ? undefined : 1}>
                                                        {i + 1}. {item.criterion.name}
                                                    </Text>
                                                </View>
                                            </View>
                                            <View style={styles.scoreContainer}>
                                                <Text style={styles.itemScore}>{item.score.toFixed(1)}</Text>
                                                <Text style={styles.itemMax}>/{item.criterion.max_score}</Text>
                                            </View>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>
                        </View>

                        {reviewData.generalComment ? (
                            <View style={styles.section}>
                                <Text style={styles.sectionTitle}>NHẬN XÉT CỦA GIẢNG VIÊN</Text>
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
                <TouchableOpacity style={styles.editBtn} onPress={() => router.push(`/topic/${topicId}/grading/${selectedStudentId}`)}>
                    <Edit3 size={20} color={BLUE} />
                    <Text style={styles.editBtnText}>Sửa điểm</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.lockBtn}>
                    <Lock size={20} color="#fff" />
                    <Text style={styles.lockBtnText}>Khóa điểm</Text>
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' },
    header: { flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
    backBtn: { marginRight: 12 },
    headerTitle: { fontSize: 16, fontWeight: '700', color: '#1e293b' },
    headerSub: { fontSize: 12, color: '#94a3b8', marginTop: 2 },
    statusBadge: { backgroundColor: '#eff6ff', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
    statusBadgeText: { fontSize: 10, fontWeight: '800', color: BLUE },
    tabsContainer: { backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
    tab: { paddingVertical: 14, paddingHorizontal: 20, borderBottomWidth: 2, borderBottomColor: 'transparent' },
    tabActive: { borderBottomColor: BLUE },
    tabText: { fontSize: 14, color: '#94a3b8', fontWeight: '600' },
    tabTextActive: { color: BLUE },
    infoCard: { margin: 16, padding: 16, backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: '#f1f5f9' },
    topicRow: { flexDirection: 'row', alignItems: 'center' },
    iconBox: { width: 44, height: 44, borderRadius: 12, backgroundColor: '#eff6ff', alignItems: 'center', justifyContent: 'center' },
    topicTitle: { fontSize: 15, fontWeight: '700', color: '#1e293b', lineHeight: 22 },
    department: { fontSize: 12, color: '#94a3b8', marginTop: 4 },
    timeRow: { flexDirection: 'row', alignItems: 'center', marginTop: 16, gap: 6 },
    timeText: { fontSize: 12, color: '#94a3b8' },
    scoreBoard: { marginHorizontal: 16, marginBottom: 16, padding: 20, backgroundColor: '#fff', borderRadius: 16, flexDirection: 'row', borderWidth: 1, borderColor: '#f1f5f9' },
    scoreCol: { flex: 1, alignItems: 'center' },
    divider: { width: 1, backgroundColor: '#f1f5f9', marginHorizontal: 10 },
    scoreLabel: { fontSize: 10, fontWeight: '800', color: '#94a3b8', marginBottom: 8 },
    scoreValue: { fontSize: 28, fontWeight: '900', color: BLUE },
    scoreMax: { fontSize: 14, color: '#94a3b8' },
    statusBox: { backgroundColor: '#ecfdf5', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
    statusText: { fontSize: 12, fontWeight: '800', color: GREEN },
    section: { paddingHorizontal: 16, marginBottom: 16 },
    sectionTitle: { fontSize: 11, fontWeight: '800', color: '#64748b', marginBottom: 12, letterSpacing: 1 },
    criteriaCard: { backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: '#f1f5f9', overflow: 'hidden' },
    criteriaRow: { flexDirection: 'row', padding: 16, alignItems: 'flex-start', justifyContent: 'space-between', backgroundColor: '#fff' },
    rowBorder: { borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
    criteriaTitleCol: { flex: 1, marginRight: 12 },
    nameRow: { flexDirection: 'row', alignItems: 'flex-start' },
    chevronBox: { marginTop: 2, marginRight: 8 },
    criterionName: { flex: 1, fontSize: 14, fontWeight: '600', color: '#334155', lineHeight: 20 },
    criterionDesc: { fontSize: 12, color: '#64748b', marginTop: 8, lineHeight: 18, borderLeftWidth: 2, borderLeftColor: '#e2e8f0', paddingLeft: 10, paddingVertical: 2 },
    scoreContainer: { alignItems: 'flex-end', minWidth: 44, marginTop: 0 },
    itemScore: { fontSize: 18, fontWeight: '800', color: BLUE },
    itemMax: { fontSize: 11, color: '#94a3b8' },
    commentBox: { padding: 16, backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: '#f1f5f9' },
    commentContent: { fontSize: 14, color: '#334155', lineHeight: 22 },
    emptyState: { padding: 40, alignItems: 'center', justifyContent: 'center' },
    emptyText: { marginTop: 12, color: '#94a3b8', fontSize: 14, textAlign: 'center' },
    footer: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 16, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#f1f5f9', flexDirection: 'row', gap: 12 },
    editBtn: { flex: 1, height: 54, borderRadius: 12, backgroundColor: '#eff6ff', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1, borderColor: '#dbeafe' },
    editBtnText: { fontSize: 15, fontWeight: '700', color: BLUE },
    lockBtn: { flex: 1, height: 54, borderRadius: 12, backgroundColor: '#ef4444', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, shadowColor: '#ef4444', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 4 },
    lockBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' }
});
