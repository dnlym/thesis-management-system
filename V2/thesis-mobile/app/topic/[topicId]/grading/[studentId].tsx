import React from 'react';
import {
    View, Text, ScrollView, TouchableOpacity,
    TextInput, StyleSheet, Alert, ActivityIndicator,
    Platform, StatusBar
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
    ChevronLeft, GraduationCap, MapPin, Users, User, ChevronRight,
    Save, CheckCircle
} from 'lucide-react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { OfflineStorage } from '@/api/offline';
import { useAuthStore } from '@/store/auth';
import { useTopic } from '@/hooks/useTopics';
import { useGradingCriteria } from '@/hooks/useGrading';
import { GradingApi } from '@/api/grading';

const BLUE = '#2563eb';

export default function GradingScreen() {
    const { topicId, studentId } = useLocalSearchParams();
    const router = useRouter();
    const { user } = useAuthStore();

    // Topic Data
    const { data: topic, isLoading: isLoadingTopic } = useTopic(topicId as string);

    // Determine Role dynamically based on Backend assignments
    const raterRole = React.useMemo(() => {
        if (!topic || !user) return 'REVIEWER_1';
        if (topic.supervisor_id === user.id) return 'SUPERVISOR';
        const myAssignment = topic.assignments?.find(a => a.reviewer_id === user.id);
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
    }, [topic, user]);

    // Fetch criteria for this ROLE
    const { data: criteriaRes, isLoading: isLoadingCriteria } = useGradingCriteria({
        criteriaType: raterRole as any,
        topicId: (topicId as string) || undefined
    });

    const [isSubmitting, setIsSubmitting] = React.useState(false);
    const students = topic?.students || [];

    // Extract criteria array safely
    const criteria = React.useMemo(() => {
        if (!criteriaRes) return [];
        if (Array.isArray(criteriaRes)) return criteriaRes;
        const data = criteriaRes as any;
        let roleKey = 'REVIEWER';
        if (raterRole === 'SUPERVISOR') roleKey = 'SUPERVISOR';
        else if (raterRole.startsWith('COMMITTEE') || raterRole.includes('COUNCIL')) roleKey = 'COMMITTEE';
        return data[roleKey] || data.FINAL || Object.values(data)[0] || [];
    }, [criteriaRes, raterRole]);

    const initialIdx = students.findIndex((s: any) => s.id === studentId);
    const [idx, setIdx] = React.useState(initialIdx >= 0 ? initialIdx : 0);
    const [allScores, setAllScores] = React.useState<Record<string, Record<string, string>>>({});
    const [allComments, setAllComments] = React.useState<Record<string, string>>({});
    const [isRestoring, setIsRestoring] = React.useState(true);
    const [submitted, setSubmitted] = React.useState(false);

    // Restoration Logic
    React.useEffect(() => {
        const restoreAndCheck = async () => {
            if (!user || !topic || students.length === 0) {
                if (students.length === 0 && !isLoadingTopic) setIsRestoring(false);
                return;
            }
            try {
                const myGrades = await GradingApi.getMyGrades(topicId as string, raterRole);
                if (myGrades && myGrades.students && myGrades.students.length > 0) {
                    const restoredScores: Record<string, Record<string, string>> = {};
                    const restoredComments: Record<string, string> = {};
                    let anySubmitted = false;
                    for (const sGrade of myGrades.students) {
                        if (sGrade.status === 'SUBMITTED') {
                            anySubmitted = true;
                            const sScores: Record<string, string> = {};
                            sGrade.grades.forEach((g: any) => { sScores[g.criterionId] = g.score.toString(); });
                            restoredScores[sGrade.studentId] = sScores;
                            restoredComments[sGrade.studentId] = sGrade.generalComment || '';
                        }
                    }
                    if (anySubmitted) {
                        setAllScores(restoredScores);
                        setAllComments(restoredComments);
                        setSubmitted(true);
                        setIsRestoring(false);
                        return;
                    }
                }
                const restoredScores: Record<string, Record<string, string>> = {};
                const restoredComments: Record<string, string> = {};
                for (const student of students) {
                    const draft = await OfflineStorage.getDraft(user.id, topicId as string, raterRole, student.id);
                    if (draft) {
                        if (draft.scores) restoredScores[student.id] = draft.scores;
                        if (draft.comment) restoredComments[student.id] = draft.comment;
                    }
                }
                setAllScores(restoredScores);
                setAllComments(restoredComments);
            } catch (err) { console.error(err); } finally { setIsRestoring(false); }
        };
        if (topic && !isLoadingTopic) restoreAndCheck();
    }, [topic, isLoadingTopic, raterRole]);

    const roleLabel = React.useMemo(() => {
        if (raterRole === 'SUPERVISOR') return 'GVHD';
        if (raterRole === 'COMMITTEE_CHAIR') return 'Chủ tịch HĐ';
        if (raterRole === 'COMMITTEE_SECRETARY') return 'Thư ký HĐ';
        if (raterRole.startsWith('COMMITTEE')) return 'Thành viên HĐ';
        return 'GVPB';
    }, [raterRole]);

    if (isLoadingTopic || isLoadingCriteria || isRestoring) {
        return (
            <SafeAreaView style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={BLUE} />
            </SafeAreaView>
        );
    }

    const currentStudent = students[idx];
    const scores = allScores[currentStudent?.id] || {};
    const comment = allComments[currentStudent?.id] || '';
    const isLast = idx === students.length - 1;

    const totalScore = criteria.reduce((acc: number, c: any) =>
        acc + (parseFloat(scores[c.id] || '0') || 0) * (c.weight || 1), 0
    );

    const handleScore = (cId: string, val: string, max: number = 10) => {
        if (submitted) return;
        const normalized = val.replace(',', '.').replace(/[^0-9.]/g, '');
        let finalized = normalized;
        const num = parseFloat(normalized);
        if (!isNaN(num) && num > max) finalized = max.toString();
        setAllScores(prev => ({ ...prev, [currentStudent.id]: { ...(prev[currentStudent.id] || {}), [cId]: finalized } }));
    };

    const handleNext = () => {
        const currentScores = allScores[currentStudent.id] || {};
        const incomplete = criteria.some((c: any) => !currentScores[c.id]);
        if (incomplete) { Alert.alert('Thiếu điểm', 'Vui lòng nhập đủ điểm.'); return; }
        OfflineStorage.saveDraft(user!.id, topicId as string, raterRole, currentStudent.id, {
            scores: currentScores, comment: allComments[currentStudent.id] || ''
        });
        if (isLast) router.push(`/topic/${topicId}/grade-review/${studentId}`);
        else setIdx(i => i + 1);
    };

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
            <StatusBar barStyle="dark-content" />
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <ChevronLeft size={24} color="#374151" />
                </TouchableOpacity>
                <View style={{ flex: 1 }}>
                    <Text style={styles.headerTitle}>Nhập điểm</Text>
                    <Text style={styles.headerSub}>{topic?.code || 'N/A'}</Text>
                </View>
                <View style={styles.roleBadge}><Text style={styles.roleBadgeText}>{roleLabel}</Text></View>
            </View>

            <View style={styles.topicCardContainer}>
                <View style={styles.topicCard}>
                    <View style={styles.topicIconBox}>
                        <GraduationCap size={24} color={BLUE} />
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.topicCardTitle} numberOfLines={2}>{topic?.title}</Text>
                        <View style={styles.topicInfoRow}>
                            <MapPin size={12} color="#94a3b8" />
                            <Text style={styles.topicInfoText}>Phòng: {topic?.room || '---'}</Text>
                            <Text style={styles.topicInfoDivider}>•</Text>
                            <Users size={12} color="#94a3b8" />
                            <Text style={styles.topicInfoText}>Nhóm: {topic?.registrations?.[0]?.group?.name || '---'}</Text>
                        </View>
                        <View style={styles.topicInfoRow}>
                            <User size={12} color="#94a3b8" />
                            <Text style={styles.topicInfoText}>Giảng viên hướng dẫn: {topic?.supervisor?.full_name || '---'}</Text>
                        </View>
                    </View>
                    <TouchableOpacity style={styles.detailBtn}>
                        <Text style={styles.detailBtnText}>Chi tiết</Text>
                        <ChevronRight size={14} color={BLUE} />
                    </TouchableOpacity>
                </View>
            </View>

            <View style={styles.switcher}>
                <View style={styles.tabWrapper}>
                    {students.map((sv: any, i: number) => (
                        <TouchableOpacity
                            key={sv.id}
                            onPress={() => setIdx(i)}
                            style={[styles.tab, i === idx && styles.tabActive]}
                        >
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                <User size={16} color={i === idx ? BLUE : '#94a3b8'} />
                                <Text style={[styles.tabText, i === idx && styles.tabTextActive]}>
                                    {sv.full_name}
                                </Text>
                            </View>
                        </TouchableOpacity>
                    ))}
                </View>
            </View>

            <ScrollView style={{ flex: 1, backgroundColor: '#f8fafc' }} keyboardShouldPersistTaps="handled">
                <View style={styles.statsCard}>
                    <View style={styles.statsCol}>
                        <Text style={styles.statsLabel}>TỔNG ĐIỂM (TỐI ĐA 10)</Text>
                        <Text style={styles.statsValue}>{totalScore.toFixed(1)} <Text style={styles.statsMax}>/ 10</Text></Text>
                    </View>
                    <View style={styles.statsDivider} />
                    <View style={styles.statsCol}>
                        <Text style={styles.statsLabel}>XẾP LOẠI DỰ KIẾN</Text>
                        <View style={styles.gradeBadge}>
                            <Text style={styles.gradeBadgeText}>{totalScore >= 5 ? 'Đạt' : 'Chưa đạt'}</Text>
                        </View>
                        <Text style={styles.gradeSubText}>({totalScore >= 5 ? 'Đủ điều kiện' : 'Cần cố gắng'})</Text>
                    </View>
                </View>

                <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>DANH SÁCH TIÊU CHÍ</Text>
                    <Text style={styles.totalMaxHint}>Tổng tối đa: 10 điểm</Text>
                </View>

                {criteria.map((c: any, i: number) => (
                    <View key={c.id} style={styles.criterionCard}>
                        <View style={styles.criterionHeader}>
                            <View style={styles.idxCircle}>
                                <Text style={styles.idxCircleText}>{i + 1}</Text>
                            </View>
                            <View style={{ flex: 1, paddingRight: 8 }}>
                                <Text style={styles.criterionName}>{c.name}</Text>
                                <Text style={styles.maxHint}>Tối đa {c.max_score} điểm</Text>
                            </View>
                            <View style={styles.inputBox}>
                                <TextInput
                                    style={[styles.input, scores[c.id] ? styles.inputFilled : {}]}
                                    keyboardType="decimal-pad"
                                    value={scores[c.id] || ''}
                                    onChangeText={v => handleScore(c.id, v, c.max_score)}
                                    placeholder="0.0"
                                    editable={!submitted}
                                />
                                <View style={styles.inputDivider} />
                                <Text style={styles.maxSubText}>{c.max_score}</Text>
                            </View>
                        </View>
                    </View>
                ))}

                <View style={styles.commentSection}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 }}>
                        <Text style={styles.commentLabel}>NHẬN XÉT <Text style={{ color: '#94a3b8' }}>(KHÔNG BẮT BUỘC)</Text></Text>
                        <Text style={styles.charCount}>{comment.length}/1000</Text>
                    </View>
                    <TextInput
                        style={styles.commentInput}
                        multiline
                        placeholder="Nhập nhận xét của bạn..."
                        value={comment}
                        onChangeText={v => setAllComments(prev => ({ ...prev, [currentStudent.id]: v }))}
                        editable={!submitted}
                    />
                </View>
                <View style={{ height: 120 }} />
            </ScrollView>

            <View style={styles.footer}>
                <TouchableOpacity style={styles.draftBtn} onPress={() => Alert.alert('Thông báo', 'Đã lưu bản nháp')}>
                    <Save size={18} color={BLUE} />
                    <Text style={styles.draftBtnText}>Lưu nháp</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.submitBtn} onPress={handleNext}>
                    <CheckCircle size={18} color="#fff" />
                    <Text style={styles.submitBtnText}>{isLast ? 'Lưu điểm' : 'Tiếp theo'}</Text>
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
    roleBadge: { backgroundColor: '#eff6ff', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
    roleBadgeText: { fontSize: 11, fontWeight: '800', color: BLUE },

    topicCardContainer: { padding: 16, backgroundColor: '#fff' },
    topicCard: {
        backgroundColor: '#fff', borderRadius: 16, padding: 16,
        flexDirection: 'row', alignItems: 'center', gap: 12,
        shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 3,
        borderWidth: 1, borderColor: '#f1f5f9'
    },
    topicIconBox: { width: 48, height: 48, borderRadius: 12, backgroundColor: '#eff6ff', alignItems: 'center', justifyContent: 'center' },
    topicCardTitle: { fontSize: 14, fontWeight: '700', color: '#1e293b', lineHeight: 20 },
    topicInfoRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
    topicInfoText: { fontSize: 12, color: '#64748b', fontWeight: '500' },
    topicInfoDivider: { color: '#cbd5e1', fontSize: 12 },
    detailBtn: { alignItems: 'center', gap: 4, marginLeft: 8 },
    detailBtnText: { fontSize: 11, color: BLUE, fontWeight: '700' },

    switcher: { backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
    tabWrapper: { flexDirection: 'row', width: '100%' },
    tab: { flex: 1, paddingVertical: 14, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
    tabActive: { borderBottomColor: BLUE },
    tabText: { fontSize: 14, color: '#94a3b8', fontWeight: '600' },
    tabTextActive: { color: BLUE },

    statsCard: {
        flexDirection: 'row', margin: 16, padding: 16, backgroundColor: '#fff',
        borderRadius: 16, borderWidth: 1, borderColor: '#f1f5f9', alignItems: 'center',
        shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.02, shadowRadius: 5, elevation: 1,
    },
    statsCol: { flex: 1, alignItems: 'center' },
    statsDivider: { width: 1, height: 40, backgroundColor: '#f1f5f9' },
    statsLabel: { fontSize: 9, fontWeight: '800', color: '#94a3b8', letterSpacing: 0.5, marginBottom: 8 },
    statsValue: { fontSize: 28, fontWeight: '900', color: BLUE },
    statsMax: { fontSize: 14, fontWeight: '600', color: '#cbd5e1' },
    gradeBadge: { backgroundColor: '#f8fafc', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20, marginBottom: 4 },
    gradeBadgeText: { fontSize: 11, fontWeight: '800', color: '#64748b' },
    gradeSubText: { fontSize: 10, color: '#94a3b8', fontWeight: '500' },

    sectionHeader: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
    sectionTitle: { fontSize: 11, fontWeight: '800', color: '#64748b', letterSpacing: 1 },
    totalMaxHint: { fontSize: 11, color: BLUE, fontWeight: '700' },

    criterionCard: { backgroundColor: '#fff', paddingHorizontal: 16, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
    criterionHeader: { flexDirection: 'row', alignItems: 'center' },
    idxCircle: { width: 22, height: 22, borderRadius: 11, backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
    idxCircleText: { fontSize: 10, fontWeight: '800', color: '#94a3b8' },
    criterionName: { fontSize: 13, fontWeight: '600', color: '#334155', lineHeight: 18 },
    maxHint: { fontSize: 10, color: '#94a3b8', marginTop: 4, fontWeight: '500' },

    inputBox: {
        flexDirection: 'row', alignItems: 'center', backgroundColor: '#f8fafc',
        borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 10, paddingHorizontal: 8, height: 44
    },
    input: { width: 40, textAlign: 'center', fontSize: 15, fontWeight: '800', color: '#1e293b' },
    inputFilled: { color: BLUE },
    inputDivider: { width: 1, height: 16, backgroundColor: '#e2e8f0', marginHorizontal: 4 },
    maxSubText: { fontSize: 11, color: '#94a3b8', fontWeight: '700', width: 20, textAlign: 'center' },

    commentSection: { padding: 16 },
    commentLabel: { fontSize: 11, fontWeight: '800', color: '#475569' },
    charCount: { fontSize: 11, color: '#94a3b8', fontWeight: '600' },
    commentInput: {
        backgroundColor: '#fff', borderRadius: 16, padding: 16, minHeight: 120,
        fontSize: 14, color: '#334155', borderWidth: 1, borderColor: '#e2e8f0', lineHeight: 20
    },

    footer: {
        flexDirection: 'row', padding: 16, backgroundColor: '#fff',
        borderTopWidth: 1, borderTopColor: '#f1f5f9', gap: 12,
        paddingBottom: Platform.OS === 'ios' ? 34 : 16
    },
    draftBtn: {
        flex: 1, height: 50, borderRadius: 12, borderWidth: 1, borderColor: BLUE,
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8
    },
    draftBtnText: { color: BLUE, fontSize: 14, fontWeight: '700' },
    submitBtn: {
        flex: 1, height: 50, borderRadius: 12, backgroundColor: BLUE,
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8
    },
    submitBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' }
});
