import React from 'react';
import {
    View, Text, ScrollView, TouchableOpacity,
    TextInput, StyleSheet, Alert, ActivityIndicator,
    Platform, StatusBar
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
    ChevronLeft, GraduationCap, MapPin, Users, User, ChevronRight,
    Save, CheckCircle, ClipboardCheck, FileText, Info, Award
} from 'lucide-react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { OfflineStorage } from '@/api/offline';
import { useAuthStore } from '@/store/auth';
import { useTopic } from '@/hooks/useTopics';
import { useGradingCriteria } from '@/hooks/useGrading';
import { GradingApi } from '@/api/grading';

const BLUE = '#2563eb';
const LIGHT_BLUE = '#eff6ff';

export default function GradingScreen() {
    const { topicId, studentId, groupId } = useLocalSearchParams();
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
    const students = React.useMemo(() => {
        const all = topic?.students || [];
        if (!groupId) return all;
        return all.filter((s: any) => s.groupId === groupId);
    }, [topic?.students, groupId]);

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
                    const draft = await OfflineStorage.getDraft(user.id, topicId as string, groupId as string || null, raterRole, student.id);
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
        
        OfflineStorage.saveDraft(user!.id, topicId as string, groupId as string || null, raterRole, currentStudent.id, {
            scores: currentScores, comment: allComments[currentStudent.id] || ''
        });
        
        if (isLast) router.push(`/topic/${topicId}/grade-review/${studentId}?groupId=${groupId || ''}`);
        else setIdx(i => i + 1);
    };

    const handleSaveDraft = async () => {
        if (!user || !currentStudent) return;
        const currentScores = allScores[currentStudent.id] || {};
        await OfflineStorage.saveDraft(user.id, topicId as string, groupId as string || null, raterRole, currentStudent.id, {
            scores: currentScores, comment: allComments[currentStudent.id] || ''
        });
        Alert.alert('Thành công', 'Đã lưu bản nháp cho sinh viên này');
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
                    <View style={styles.topicCardBody}>
                        <View style={styles.topicIconBox}>
                            <GraduationCap size={24} color={BLUE} />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.topicCardTitle} numberOfLines={2}>{topic?.title}</Text>
                            <View style={styles.topicInfoGrid}>
                                <View style={styles.topicInfoItem}>
                                    <MapPin size={12} color="#94a3b8" />
                                    <Text style={styles.topicInfoText}>{topic?.room || '---'}</Text>
                                </View>
                                <View style={styles.topicInfoItem}>
                                    <Users size={12} color="#94a3b8" />
                                    <Text style={styles.topicInfoText}>Nhóm: {topic?.registrations?.[0]?.group?.name || '---'}</Text>
                                </View>
                            </View>
                        </View>
                    </View>
                    <View style={styles.topicCardFooter}>
                        <View style={styles.supervisorBox}>
                            <User size={12} color="#64748b" />
                            <Text style={styles.supervisorText}>GVHD: {topic?.supervisor?.full_name}</Text>
                        </View>
                        <TouchableOpacity style={styles.detailBtn}>
                            <Text style={styles.detailBtnText}>Chi tiết</Text>
                            <ChevronRight size={14} color={BLUE} />
                        </TouchableOpacity>
                    </View>
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
                            <User size={16} color={i === idx ? BLUE : '#94a3b8'} />
                            <Text style={[styles.tabText, i === idx && styles.tabTextActive]} numberOfLines={1}>
                                {sv.full_name.split(' ').pop()}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>
            </View>

            <ScrollView style={{ flex: 1, backgroundColor: '#f8fafc' }} keyboardShouldPersistTaps="handled">
                <View style={styles.statsCard}>
                    <View style={styles.statsCol}>
                        <View style={styles.statsLabelRow}>
                            <Award size={14} color="#94a3b8" />
                            <Text style={styles.statsLabel}>TỔNG ĐIỂM</Text>
                        </View>
                        <Text style={styles.statsValue}>{totalScore.toFixed(1)} <Text style={styles.statsMax}>/ 10</Text></Text>
                    </View>
                    <View style={styles.statsDivider} />
                    <View style={styles.statsCol}>
                        <View style={styles.statsLabelRow}>
                            <Info size={14} color="#94a3b8" />
                            <Text style={styles.statsLabel}>DỰ KIẾN</Text>
                        </View>
                        <View style={[styles.gradeBadge, { backgroundColor: totalScore >= 6 ? '#dcfce7' : '#fee2e2' }]}>
                            <Text style={[styles.gradeBadgeText, { color: totalScore >= 6 ? '#166534' : '#991b1b' }]}>
                                {totalScore >= 6 ? 'Đạt' : 'Rớt'}
                            </Text>
                        </View>
                    </View>
                </View>

                <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>DANH SÁCH TIÊU CHÍ</Text>
                    <View style={styles.badge}>
                        <Text style={styles.badgeText}>{criteria.length} tiêu chí</Text>
                    </View>
                </View>

                <View style={styles.criteriaContainer}>
                    {criteria.map((c: any, i: number) => (
                        <View key={c.id} style={styles.criterionCard}>
                            <View style={styles.criterionMain}>
                                <View style={styles.criterionInfo}>
                                    <View style={styles.criterionTitleRow}>
                                        <ClipboardCheck size={16} color={BLUE} style={{ marginRight: 8 }} />
                                        <Text style={styles.criterionName}>{c.name}</Text>
                                    </View>
                                    <Text style={styles.criterionDesc} numberOfLines={2}>{c.description || 'Chấm điểm dựa trên kết quả thực hiện.'}</Text>
                                </View>
                                <View style={styles.scoreInputGroup}>
                                    <TextInput
                                        style={[styles.input, scores[c.id] ? styles.inputFilled : {}]}
                                        keyboardType="decimal-pad"
                                        value={scores[c.id] || ''}
                                        onChangeText={v => handleScore(c.id, v, c.max_score)}
                                        placeholder="0.0"
                                        editable={!submitted}
                                    />
                                    <View style={styles.maxBadge}>
                                        <Text style={styles.maxBadgeText}>/{c.max_score}</Text>
                                    </View>
                                </View>
                            </View>
                        </View>
                    ))}
                </View>

                <View style={styles.commentSection}>
                    <View style={styles.commentHeader}>
                        <FileText size={16} color="#64748b" />
                        <Text style={styles.commentLabel}>NHẬN XÉT CỦA GIẢNG VIÊN</Text>
                    </View>
                    <TextInput
                        style={styles.commentInput}
                        multiline
                        placeholder="Nhập nhận xét chi tiết về phần thể hiện của sinh viên..."
                        value={comment}
                        onChangeText={v => setAllComments(prev => ({ ...prev, [currentStudent.id]: v }))}
                        editable={!submitted}
                        textAlignVertical="top"
                    />
                </View>
                <View style={{ height: 120 }} />
            </ScrollView>

            <View style={styles.footer}>
                <TouchableOpacity style={styles.draftBtn} onPress={handleSaveDraft}>
                    <Save size={18} color={BLUE} />
                    <Text style={styles.draftBtnText}>Lưu bản nháp</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.submitBtn} onPress={handleNext}>
                    <Text style={styles.submitBtnText}>{isLast ? 'Tiếp tục xem lại' : 'Sinh viên tiếp theo'}</Text>
                    <ChevronRight size={18} color="#fff" />
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

    topicCardContainer: { padding: 16, backgroundColor: '#fff' },
    topicCard: {
        backgroundColor: '#fff', borderRadius: 20,
        shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 4,
        borderWidth: 1, borderColor: '#f1f5f9', overflow: 'hidden'
    },
    topicCardBody: { padding: 16, flexDirection: 'row', gap: 16 },
    topicIconBox: { width: 44, height: 44, borderRadius: 12, backgroundColor: LIGHT_BLUE, alignItems: 'center', justifyContent: 'center' },
    topicCardTitle: { fontSize: 15, fontWeight: '700', color: '#1e293b', lineHeight: 22 },
    topicInfoGrid: { flexDirection: 'row', gap: 16, marginTop: 8 },
    topicInfoItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    topicInfoText: { fontSize: 12, color: '#64748b', fontWeight: '500' },
    topicCardFooter: {
        backgroundColor: '#f8fafc', paddingHorizontal: 16, paddingVertical: 10,
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        borderTopWidth: 1, borderTopColor: '#f1f5f9'
    },
    supervisorBox: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    supervisorText: { fontSize: 11, color: '#64748b', fontWeight: '600' },
    detailBtn: { flexDirection: 'row', alignItems: 'center', gap: 2 },
    detailBtnText: { fontSize: 11, color: BLUE, fontWeight: '700' },

    switcher: { backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
    tabWrapper: { flexDirection: 'row', paddingHorizontal: 16 },
    tab: {
        flex: 1, paddingVertical: 14, alignItems: 'center', justifyContent: 'center',
        flexDirection: 'row', gap: 8, borderBottomWidth: 3, borderBottomColor: 'transparent'
    },
    tabActive: { borderBottomColor: BLUE, backgroundColor: '#f0f7ff' },
    tabText: { fontSize: 13, color: '#94a3b8', fontWeight: '700' },
    tabTextActive: { color: BLUE },

    statsCard: {
        flexDirection: 'row', margin: 16, padding: 20, backgroundColor: '#fff',
        borderRadius: 20, borderWidth: 1, borderColor: '#f1f5f9', alignItems: 'center',
        shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.03, shadowRadius: 8, elevation: 2,
    },
    statsCol: { flex: 1, alignItems: 'center' },
    statsLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
    statsLabel: { fontSize: 10, fontWeight: '800', color: '#94a3b8', letterSpacing: 0.5 },
    statsValue: { fontSize: 32, fontWeight: '900', color: '#0f172a' },
    statsMax: { fontSize: 16, fontWeight: '600', color: '#cbd5e1' },
    statsDivider: { width: 1, height: 40, backgroundColor: '#f1f5f9' },
    gradeBadge: { paddingHorizontal: 16, paddingVertical: 6, borderRadius: 12 },
    gradeBadgeText: { fontSize: 14, fontWeight: '900', textTransform: 'uppercase' },

    sectionHeader: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    sectionTitle: { fontSize: 12, fontWeight: '800', color: '#64748b', letterSpacing: 1 },
    badge: { backgroundColor: '#e2e8f0', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
    badgeText: { fontSize: 10, color: '#475569', fontWeight: '700' },

    criteriaContainer: { paddingHorizontal: 16, gap: 12 },
    criterionCard: {
        backgroundColor: '#fff', padding: 16, borderRadius: 16,
        borderWidth: 1, borderColor: '#f1f5f9',
        shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.02, shadowRadius: 4, elevation: 1
    },
    criterionMain: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
    criterionInfo: { flex: 1 },
    criterionTitleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
    criterionName: { fontSize: 14, fontWeight: '700', color: '#334155', lineHeight: 20 },
    criterionDesc: { fontSize: 11, color: '#94a3b8', lineHeight: 16 },
    scoreInputGroup: { flexDirection: 'row', alignItems: 'center' },
    input: {
        width: 54, height: 44, backgroundColor: '#f8fafc', borderTopLeftRadius: 10, borderBottomLeftRadius: 10,
        borderWidth: 1, borderColor: '#e2e8f0', textAlign: 'center', fontSize: 18, fontWeight: '800', color: '#1e293b'
    },
    inputFilled: { color: BLUE, borderColor: BLUE, backgroundColor: '#f0f7ff' },
    maxBadge: {
        height: 44, paddingHorizontal: 8, backgroundColor: '#f1f5f9',
        borderTopRightRadius: 10, borderBottomRightRadius: 10,
        justifyContent: 'center', borderWidth: 1, borderLeftWidth: 0, borderColor: '#e2e8f0'
    },
    maxBadgeText: { fontSize: 12, fontWeight: '700', color: '#94a3b8' },

    commentSection: { padding: 16, marginTop: 8 },
    commentHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
    commentLabel: { fontSize: 11, fontWeight: '800', color: '#64748b' },
    commentInput: {
        backgroundColor: '#fff', borderRadius: 16, padding: 16, minHeight: 120,
        fontSize: 14, color: '#334155', borderWidth: 1, borderColor: '#e2e8f0', lineHeight: 22
    },

    footer: {
        flexDirection: 'row', padding: 16, backgroundColor: '#fff',
        borderTopWidth: 1, borderTopColor: '#f1f5f9', gap: 12,
        paddingBottom: Platform.OS === 'ios' ? 34 : 16,
        shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 10
    },
    draftBtn: {
        flex: 1, height: 52, borderRadius: 14, borderWidth: 1.5, borderColor: BLUE,
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8
    },
    draftBtnText: { color: BLUE, fontSize: 15, fontWeight: '700' },
    submitBtn: {
        flex: 1.2, height: 52, borderRadius: 14, backgroundColor: BLUE,
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8
    },
    submitBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' }
});
