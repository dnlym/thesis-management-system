import React from 'react';
import {
    View, Text, ScrollView, TouchableOpacity,
    TextInput, StyleSheet, SafeAreaView, Alert, ActivityIndicator,
    InputAccessoryView, Platform, Keyboard
} from 'react-native';
import { ChevronUp, ChevronDown, Check } from 'lucide-react-native';
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

    // Data fetching
    const { data: topic, isLoading: isLoadingTopic } = useTopic(topicId as string);
    const assignmentType = topic?.defense_schedule ? 'COMMITTEE' : 'REVIEWER';

    // Fetch all final criteria (web app behavior)
    const { data: criteriaRes, isLoading: isLoadingCriteria } = useGradingCriteria({
        criteriaType: 'FINAL' as any,
        topicId: (topicId as string) || undefined
    });

    const [isSubmitting, setIsSubmitting] = React.useState(false);

    const students = topic?.students || [];

    // Extract dynamic criteria array (web parity logic)
    const criteria = React.useMemo(() => {
        if (!criteriaRes) return [];
        if (Array.isArray(criteriaRes)) return criteriaRes;

        const data = criteriaRes as any;
        // Check for specific group, then generic FINAL, then fallback
        return data[assignmentType] || data.FINAL || Object.values(data)[0] || [];
    }, [criteriaRes, assignmentType]);

    const initialIdx = students.findIndex((s: any) => s.id === studentId);
    const [idx, setIdx] = React.useState(initialIdx >= 0 ? initialIdx : 0);
    const [allScores, setAllScores] = React.useState<Record<string, Record<string, string>>>({});
    const [allComments, setAllComments] = React.useState<Record<string, string>>({});
    const [groupComment, setGroupComment] = React.useState('');
    const [showSummary, setShowSummary] = React.useState(false);
    const [submitted, setSubmitted] = React.useState(false);
    const [isRestoring, setIsRestoring] = React.useState(true);
    const [focusedId, setFocusedId] = React.useState<string | null>(null);
    const inputRefs = React.useRef<Record<string, any>>({});

    // Initial draft restoration AND check for existing submissions
    React.useEffect(() => {
        const restoreAndCheck = async () => {
            if (!user || !topic || students.length === 0) {
                if (students.length === 0 && !isLoadingTopic) setIsRestoring(false);
                return;
            }

            try {
                // 1. Fetch official grades from backend first to check if already submitted
                // This prevents users from overwriting official grades with local drafts
                const myGrades = await GradingApi.getMyGrades(topicId as string, raterRoleInput);

                if (myGrades && myGrades.students && myGrades.students.length > 0) {
                    const restoredScores: Record<string, Record<string, string>> = {};
                    const restoredComments: Record<string, string> = {};
                    let anySubmitted = false;

                    for (const sGrade of myGrades.students) {
                        if (sGrade.status === 'SUBMITTED') {
                            anySubmitted = true;
                            // Map existing grades to scores state
                            const sScores: Record<string, string> = {};
                            sGrade.grades.forEach((g: any) => {
                                sScores[g.criterionId] = g.score.toString();
                            });
                            restoredScores[sGrade.studentId] = sScores;
                            restoredComments[sGrade.studentId] = sGrade.generalComment || '';
                        }
                    }

                    if (anySubmitted) {
                        setAllScores(restoredScores);
                        setAllComments(restoredComments);
                        setSubmitted(true);
                        // If fully submitted, we don't need to restore drafts
                        setIsRestoring(false);
                        return;
                    }
                }

                // 2. Fallback: Restore draft from OfflineStorage if no official grades submitted
                const restoredScores: Record<string, Record<string, string>> = {};
                const restoredComments: Record<string, string> = {};

                for (const student of students) {
                    const draft = await OfflineStorage.getDraft(user.id, topicId as string, assignmentType, student.id);
                    if (draft) {
                        if (draft.scores) restoredScores[student.id] = draft.scores;
                        if (draft.comment) restoredComments[student.id] = draft.comment;
                    }
                }

                if (Object.keys(restoredScores).length > 0) {
                    setAllScores(restoredScores);
                }
                if (Object.keys(restoredComments).length > 0) {
                    setAllComments(restoredComments);
                }
            } catch (err) {
                console.error('Failed to restore drafts or fetch grades:', err);
            } finally {
                setIsRestoring(false);
            }
        };

        if (topic && !isLoadingTopic) {
            restoreAndCheck();
        }
    }, [topic, isLoadingTopic]);

    if (isLoadingTopic || isLoadingCriteria || isRestoring) {
        return (
            <SafeAreaView style={{ flex: 1, backgroundColor: '#f8fafc', justifyContent: 'center', alignItems: 'center' }}>
                <ActivityIndicator size="large" color={BLUE} />
            </SafeAreaView>
        );
    }

    if (students.length === 0) {
        return (
            <SafeAreaView style={{ flex: 1, backgroundColor: '#f8fafc', justifyContent: 'center', alignItems: 'center' }}>
                <Text style={{ color: '#9ca3af' }}>Đề tài không có sinh viên.</Text>
                <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 20 }}>
                    <Text style={{ color: BLUE }}>Quay lại</Text>
                </TouchableOpacity>
            </SafeAreaView>
        );
    }

    const currentStudent = students[idx];
    const scores = allScores[currentStudent.id] || {};
    const comment = allComments[currentStudent.id] || '';
    const isLast = idx === students.length - 1;

    const calcTotal = (svId: string) => {
        const s = allScores[svId] || {};
        const score = criteria.reduce((acc: number, c: any) => acc + (parseFloat(s[c.id] || '0') || 0) * (c.weight || 0), 0);
        return Math.round(score * 100) / 100;
    };

    const totalScore = calcTotal(currentStudent.id);

    const handleScore = (cId: string, val: string, max: number = 10) => {
        // Allow empty string to clear the input
        if (val === '') {
            setAllScores(prev => ({ ...prev, [currentStudent.id]: { ...(prev[currentStudent.id] || {}), [cId]: '' } }));
            return;
        }

        // Replace comma with dot for international locales
        const normalized = val.replace(',', '.');

        // Only allow numbers and one dot
        const cleaned = normalized.replace(/[^0-9.]/g, '');
        const parts = cleaned.split('.');
        let finalized = parts[0] + (parts.length > 1 ? '.' + parts.slice(1).join('') : '');

        // Enforce max score from DB (default to 10)
        const num = parseFloat(finalized);
        if (!isNaN(num) && num > max) {
            finalized = max.toString();
        }

        if (submitted) return; // Prevent editing after submission

        setAllScores(prev => ({ ...prev, [currentStudent.id]: { ...(prev[currentStudent.id] || {}), [cId]: finalized } }));
    };

    const handleSaveDraft = async () => {
        if (user && topicId) {
            // Save drafts for ALL students that have any scores or comments
            const savePromises = students.map(async (s: any) => {
                const sScores = allScores[s.id];
                const sComment = allComments[s.id];
                if (sScores || sComment) {
                    return OfflineStorage.saveDraft(user.id, topicId as string, assignmentType, s.id, {
                        scores: sScores || {},
                        comment: sComment || ''
                    });
                }
            });
            await Promise.all(savePromises);
            Alert.alert('Thành công', 'Đã lưu bản nháp của tất cả sinh viên vào thiết bị!');
        }
    };

    const validateCurrentStudent = () => {
        const currentScores = allScores[currentStudent.id] || {};
        const missing = criteria.filter((c: any) => !currentScores[c.id] || currentScores[c.id].trim() === '');
        if (missing.length > 0) {
            Alert.alert(
                'Thiếu điểm',
                `Vui lòng nhập đầy đủ điểm cho các tiêu chí trước khi tiếp tục.`
            );
            return false;
        }
        return true;
    };

    const handleNext = () => {
        if (!validateCurrentStudent()) return;

        // Auto-save current student progress when clicking Next
        if (user && topicId) {
            OfflineStorage.saveDraft(user.id, topicId as string, assignmentType, currentStudent.id, {
                scores: allScores[currentStudent.id] || {},
                comment: allComments[currentStudent.id] || ''
            });
        }

        if (isLast) setShowSummary(true);
        else setIdx(i => i + 1);
    };

    const handleSubmit = async () => {
        const incomplete = students.some((s: any) => {
            const sScores = allScores[s.id] || {};
            return criteria.some((c: any) => !sScores[c.id] || sScores[c.id].trim() === '');
        });

        if (incomplete) {
            Alert.alert('Chưa hoàn tất', 'Vui lòng quay lại kiểm tra và nhập đầy đủ điểm cho tất cả sinh viên.');
            return;
        }

        setIsSubmitting(true);
        console.log(`[DEBUG] Starting bulk submission for ${students.length} students`);

        try {
            // Sequential submission for all students in the topic
            for (const sv of students) {
                const gradePayload: any = {
                    topic_id: topicId as string,
                    student_id: sv.id,
                    rater_role: raterRoleInput,
                    scores: criteria.map((c: any) => ({
                        criterion_id: c.id,
                        score: parseFloat(allScores[sv.id]?.[c.id] || '0'),
                        comment: allComments[sv.id] || ''
                    }))
                };
                console.log(`[DEBUG] Submitting for student: ${sv.full_name} (${sv.id})`);
                await GradingApi.submitGrade(gradePayload);
                console.log(`[DEBUG] Successfully submitted for: ${sv.full_name}`);
            }

            setSubmitted(true);
            Alert.alert('Thành công', 'Đã nộp điểm cho tất cả sinh viên thành công!');
        } catch (error: any) {
            console.error(`[DEBUG] Submission failed:`, error?.response?.data || error.message);
            Alert.alert('Lỗi', error?.response?.data?.message || 'Có lỗi xảy ra khi nộp điểm. Vui lòng thử lại.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const isSupervisor = topic?.supervisor_id === user?.id;
    const raterRoleInput = isSupervisor ? 'ADVISOR' : (topic?.defense_schedule ? 'COUNCIL_MEMBER' : 'REVIEWER');
    const roleCode = isSupervisor ? 'GVHD' : (topic?.defense_schedule ? 'HĐBV' : 'GVPB');

    // ── Summary screen ──────────────────────────────────────────
    if (showSummary) {
        const avg = students.length > 0 ? (students.reduce((a: number, s: any) => a + calcTotal(s.id), 0) / students.length).toFixed(2) : '0';
        return (
            <SafeAreaView style={{ flex: 1, backgroundColor: '#f8fafc' }}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => setShowSummary(false)} style={styles.backBtn}>
                        <Text style={styles.backArrow}>‹</Text>
                    </TouchableOpacity>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.headerTitle}>{topic?.code || 'Nhóm'}</Text>
                        <Text style={styles.headerSub}>{topic?.defense_schedule ? `Hội đồng ${topic.defense_schedule.committee?.name || ''}` : 'Chấm phản biện'}</Text>
                    </View>
                    <View style={styles.roleBadge}><Text style={styles.roleBadgeText}>{roleCode}</Text></View>
                </View>

                <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16 }}>
                    <Text style={styles.sectionTitle}>Tổng điểm theo sinh viên</Text>
                    <View style={styles.card}>
                        {students.map((sv: any, i: number) => (
                            <View key={sv.id} style={[styles.svRow, i < students.length - 1 && styles.rowBorder]}>
                                <View style={styles.svNum}><Text style={styles.svNumText}>{i + 1}</Text></View>
                                <View style={{ flex: 1, marginLeft: 10 }}>
                                    <Text style={styles.svName}>{sv.full_name}</Text>
                                    <Text style={styles.svId}>{sv.student_code || sv.id}</Text>
                                </View>
                                <Text style={styles.svScore}>{calcTotal(sv.id).toFixed(2)}</Text>
                                <Text style={styles.svScoreMax}>/10</Text>
                            </View>
                        ))}
                    </View>

                    <Text style={[styles.sectionTitle, { marginTop: 16 }]}>Tổng quan điểm</Text>
                    <View style={styles.card}>
                        <View style={styles.summaryRow}><Text style={styles.summaryLabel}>Trung bình nhóm (tạm tính)</Text><Text style={styles.summaryVal}>{avg}</Text></View>
                        <View style={[styles.summaryRow, styles.rowBorder, { flexDirection: 'row-reverse' }]}><Text style={styles.summaryVal}>{Object.keys(allScores).length} / {students.length}</Text><Text style={styles.summaryLabel}>Số sinh viên đã nhập</Text></View>
                    </View>

                    <Text style={[styles.sectionTitle, { marginTop: 16 }]}>Nhận xét toàn đội (không bắt buộc)</Text>
                    <View style={styles.card}>
                        <TextInput
                            style={styles.commentInput}
                            placeholder="Nhập nhận xét chung..."
                            value={groupComment}
                            onChangeText={setGroupComment}
                            multiline
                        />
                    </View>
                    <View style={{ height: 20 }} />
                </ScrollView>

                <View style={styles.footer}>
                    {submitted ? (
                        <View style={styles.submittedBox}>
                            <Text style={styles.submittedTitle}>✓ ĐÃ NỘP HỒ SƠ CHẤM</Text>
                            <Text style={styles.submittedSub}>Không thể chỉnh sửa</Text>
                        </View>
                    ) : (
                        <>
                            <TouchableOpacity
                                style={[styles.ctaBtn, isSubmitting && { opacity: 0.6 }]}
                                onPress={handleSubmit}
                                disabled={isSubmitting}
                            >
                                <Text style={styles.ctaBtnText}>{isSubmitting ? 'Đang nộp...' : `Nộp điểm (${roleCode})`}</Text>
                            </TouchableOpacity>
                            <Text style={styles.ctaNote}>Hệ thống sẽ đồng bộ khi có mạng. Sau khi nộp, bạn sẽ không thể chỉnh sửa.</Text>
                        </>
                    )}
                </View>
            </SafeAreaView>
        );
    }

    const inputAccessoryViewID = 'GRADING_INPUT_ACCESSORY';

    const handlePrevInput = () => {
        if (!focusedId) return;
        const currentIdx = criteria.findIndex((c: any) => c.id === focusedId);
        if (currentIdx > 0) {
            const prevId = criteria[currentIdx - 1].id;
            inputRefs.current[prevId]?.focus();
        }
    };

    const handleNextInput = () => {
        if (!focusedId) return;
        const currentIdx = criteria.findIndex((c: any) => c.id === focusedId);
        if (currentIdx < criteria.length - 1) {
            const nextId = criteria[currentIdx + 1].id;
            inputRefs.current[nextId]?.focus();
        } else {
            Keyboard.dismiss();
        }
    };

    // ── Grading form ─────────────────────────────────────────────
    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <Text style={styles.backArrow}>‹</Text>
                </TouchableOpacity>
                <View style={{ flex: 1 }}>
                    <Text style={styles.headerTitle}>{topic?.code || 'Nhóm đề tài'}</Text>
                    <Text style={styles.headerSub}>{topic?.defense_schedule ? `Hội đồng ${topic.defense_schedule.committee?.name || ''}` : 'Chấm phản biện'}</Text>
                </View>
                <View style={styles.roleBadge}><Text style={styles.roleBadgeText}>{roleCode}</Text></View>
            </View>

            {/* Student switcher */}
            <View style={styles.switcherContainer}>
                <View style={styles.switcherRow}>
                    {students.map((sv: any, i: number) => (
                        <TouchableOpacity key={sv.id} onPress={() => setIdx(i)} style={[styles.switcherTab, i === idx && styles.switcherTabActive]}>
                            <Text style={[styles.switcherText, i === idx && styles.switcherTextActive]}>{sv.full_name?.split(' ').pop() || sv.id}</Text>
                        </TouchableOpacity>
                    ))}
                    <View style={{ flex: 1 }} />
                    <Text style={styles.switcherCounter}>Sinh viên: {idx + 1}/{students.length}</Text>
                </View>
                <View style={styles.switcherHint}>
                    <Text style={styles.switcherHintText}>Tiêu chí đánh giá ({roleCode})</Text>
                    <Text style={styles.switcherHintSub}>(Nhập điểm theo thang 0 – 10)</Text>
                </View>
            </View>

            <ScrollView style={{ flex: 1 }}>
                {/* Criteria table */}
                <View style={styles.tableCard}>
                    {/* Table header */}
                    <View style={styles.tableHeader}>
                        <Text style={[styles.tableHeaderText, { width: 34, textAlign: 'center' }]}>STT</Text>
                        <Text style={[styles.tableHeaderText, { flex: 1, paddingLeft: 8 }]}>LO (Tiêu chí)</Text>
                        <Text style={[styles.tableHeaderText, { width: 64, textAlign: 'center' }]}>Điểm</Text>
                    </View>

                    {criteria.map((c: any, i: number) => {
                        const val = scores[c.id] || '';
                        const num = parseFloat(val);
                        const isLow = !isNaN(num) && num < 5;
                        return (
                            <View key={c.id} style={[styles.tableRow, i < criteria.length - 1 && styles.rowBorder]}>
                                <Text style={styles.criteriaIndex}>{i + 1}</Text>
                                <View style={{ flex: 1, paddingLeft: 8 }}>
                                    <Text style={styles.criteriaName}>{c.name}</Text>
                                </View>
                                <View style={{ alignItems: 'center', width: 64 }}>
                                    <TextInput
                                        ref={r => { inputRefs.current[c.id] = r; }}
                                        style={[styles.scoreInput, isLow ? styles.scoreInputLow : val ? styles.scoreInputFilled : {}]}
                                        keyboardType="decimal-pad"
                                        returnKeyType={i === criteria.length - 1 ? 'done' : 'next'}
                                        blurOnSubmit={i === criteria.length - 1}
                                        inputAccessoryViewID={inputAccessoryViewID}
                                        onFocus={() => setFocusedId(c.id)}
                                        onSubmitEditing={handleNextInput}
                                        placeholder="—"
                                        placeholderTextColor="#cbd5e1"
                                        value={val}
                                        onChangeText={v => handleScore(c.id, v, c.max_score)}
                                        maxLength={4}
                                        editable={!submitted}
                                    />
                                    <Text style={styles.maxScoreLabel}>/{c.max_score || 10}</Text>
                                </View>
                            </View>
                        );
                    })}
                    {criteria.length === 0 && (
                        <View style={{ padding: 20, alignItems: 'center' }}>
                            <Text style={{ color: '#9ca3af' }}>Không tìm thấy tiêu chí đánh giá cho vai trò này.</Text>
                        </View>
                    )}
                </View>

                {/* Total */}
                <View style={styles.totalBox}>
                    <View>
                        <Text style={styles.totalLabel}>Tổng điểm (tự động tính)</Text>
                        <Text style={styles.totalSub}>Tổng trọng số: 100%</Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'flex-end' }}>
                        <Text style={styles.totalScore}>{totalScore.toFixed(2)}</Text>
                        <Text style={styles.totalMax}> /10</Text>
                    </View>
                </View>

                {/* Comment */}
                <View style={styles.commentBox}>
                    <Text style={styles.commentLabel}>Nhận xét cho sinh viên (không bắt buộc)</Text>
                    <View style={styles.commentInputWrap}>
                        <TextInput
                            style={{ flex: 1, fontSize: 13, color: '#374151' }}
                            placeholder="Nhập nhận xét chi tiết..."
                            value={comment}
                            onChangeText={v => setAllComments(prev => ({ ...prev, [currentStudent.id]: v }))}
                            multiline
                            editable={!submitted}
                        />
                    </View>
                </View>

                <View style={{ height: 20 }} />
            </ScrollView>

            {/* Action buttons */}
            <View style={styles.footer}>
                <TouchableOpacity
                    style={[styles.draftBtn, submitted && { opacity: 0.5 }]}
                    onPress={handleSaveDraft}
                    disabled={submitted}
                >
                    <Text style={styles.draftBtnText}>Lưu nháp</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.nextBtn} onPress={handleNext}>
                    <Text style={styles.nextBtnText}>{isLast ? 'Xem tổng hợp' : 'Sinh viên tiếp theo'}</Text>
                </TouchableOpacity>
            </View>

            {Platform.OS === 'ios' && (
                <InputAccessoryView nativeID={inputAccessoryViewID}>
                    <View style={styles.accessory}>
                        <View style={{ flexDirection: 'row', gap: 16 }}>
                            <TouchableOpacity onPress={handlePrevInput} disabled={criteria.findIndex((c: any) => c.id === focusedId) === 0}>
                                <ChevronUp size={24} color={criteria.findIndex((c: any) => c.id === focusedId) === 0 ? '#cbd5e1' : BLUE} />
                            </TouchableOpacity>
                            <TouchableOpacity onPress={handleNextInput} disabled={criteria.findIndex((c: any) => c.id === focusedId) === criteria.length - 1}>
                                <ChevronDown size={24} color={criteria.findIndex((c: any) => c.id === focusedId) === criteria.length - 1 ? '#cbd5e1' : BLUE} />
                            </TouchableOpacity>
                        </View>
                        <TouchableOpacity onPress={() => Keyboard.dismiss()} style={styles.accessoryDoneBtn}>
                            <Text style={styles.accessoryDoneText}>Xong</Text>
                        </TouchableOpacity>
                    </View>
                </InputAccessoryView>
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    header: { backgroundColor: '#fff', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
    backBtn: { marginRight: 6, padding: 4 },
    backArrow: { fontSize: 28, color: '#374151', lineHeight: 28 },
    headerTitle: { fontSize: 15, fontWeight: '700', color: '#111827' },
    headerSub: { fontSize: 11, color: '#9ca3af', marginTop: 1 },
    roleBadge: { backgroundColor: '#eff6ff', borderRadius: 6, paddingHorizontal: 9, paddingVertical: 3 },
    roleBadgeText: { fontSize: 10, fontWeight: '700', color: BLUE },
    switcherContainer: { backgroundColor: '#f8fafc', borderBottomWidth: 1, borderBottomColor: '#e5e7eb', paddingHorizontal: 16, paddingTop: 10 },
    switcherRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
    switcherTab: { paddingHorizontal: 12, paddingVertical: 6, marginRight: 4, borderBottomWidth: 2, borderBottomColor: 'transparent' },
    switcherTabActive: { borderBottomColor: BLUE },
    switcherText: { fontSize: 13, fontWeight: '600', color: '#9ca3af' },
    switcherTextActive: { color: BLUE },
    switcherCounter: { fontSize: 11, color: '#9ca3af' },
    switcherHint: { paddingBottom: 10 },
    switcherHintText: { fontSize: 12, fontWeight: '600', color: '#374151' },
    switcherHintSub: { fontSize: 10, color: '#9ca3af' },
    tableCard: { margin: 16, borderRadius: 12, borderWidth: 1, borderColor: '#e5e7eb', overflow: 'hidden', backgroundColor: '#fff' },
    tableHeader: { flexDirection: 'row', backgroundColor: '#f8fafc', paddingHorizontal: 14, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
    tableHeaderText: { fontSize: 10, fontWeight: '700', color: '#9ca3af', textTransform: 'uppercase' },
    tableRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12 },
    rowBorder: { borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
    criteriaIndex: { width: 34, textAlign: 'center', fontSize: 12, fontWeight: '700', color: '#9ca3af' },
    criteriaCode: { fontSize: 10, fontWeight: '700', color: '#9ca3af' },
    criteriaName: { fontSize: 12, color: '#374151', fontWeight: '700', marginTop: 1, lineHeight: 16 },
    criteriaDesc: { fontSize: 10, color: '#6b7280', marginTop: 2, fontStyle: 'italic' },
    inlineWeight: { fontSize: 10, color: '#9ca3af', marginTop: 4, fontWeight: '500' },
    scoreInput: { width: 56, borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 8, paddingVertical: 6, textAlign: 'center', fontSize: 14, fontWeight: '700', color: '#374151', backgroundColor: '#f8fafc' },
    maxScoreLabel: { fontSize: 9, color: '#9ca3af', marginTop: 2 },
    scoreInputFilled: { borderColor: '#bfdbfe', backgroundColor: '#eff6ff', color: BLUE },
    scoreInputLow: { borderColor: '#fecaca', backgroundColor: '#fef2f2', color: '#dc2626' },
    totalBox: { marginHorizontal: 16, backgroundColor: '#eff6ff', borderRadius: 12, padding: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderColor: '#bfdbfe' },
    totalLabel: { fontSize: 12, fontWeight: '600', color: '#374151' },
    totalSub: { fontSize: 10, color: '#9ca3af', marginTop: 2 },
    totalScore: { fontSize: 32, fontWeight: '900', color: BLUE },
    totalMax: { fontSize: 14, color: '#9ca3af', marginBottom: 4 },
    commentBox: { margin: 16, marginTop: 12 },
    commentLabel: { fontSize: 12, fontWeight: '600', color: '#374151', marginBottom: 8 },
    commentInputWrap: { borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 10, padding: 12, backgroundColor: '#f8fafc', minHeight: 60 },
    footer: { backgroundColor: '#fff', paddingHorizontal: 16, paddingVertical: 14, borderTopWidth: 1, borderTopColor: '#f1f5f9', flexDirection: 'row', gap: 10 },
    draftBtn: { flex: 1, borderRadius: 12, paddingVertical: 13, alignItems: 'center', backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: '#e5e7eb' },
    draftBtnText: { color: '#374151', fontWeight: '600', fontSize: 14 },
    nextBtn: { flex: 1, borderRadius: 12, paddingVertical: 13, alignItems: 'center', backgroundColor: BLUE, shadowColor: BLUE, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.3, shadowRadius: 6, elevation: 3 },
    nextBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
    // Summary
    card: { backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#f1f5f9', overflow: 'hidden' },
    sectionTitle: { fontSize: 12, fontWeight: '700', color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
    svRow: { flexDirection: 'row', alignItems: 'center', padding: 14 },
    svNum: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#eff6ff', alignItems: 'center', justifyContent: 'center' },
    svNumText: { fontSize: 12, fontWeight: '700', color: BLUE },
    svName: { fontSize: 14, fontWeight: '600', color: '#111827' },
    svId: { fontSize: 11, color: '#9ca3af' },
    svScore: { fontSize: 22, fontWeight: '900', color: BLUE },
    svScoreMax: { fontSize: 12, color: '#9ca3af', alignSelf: 'flex-end', marginBottom: 3 },
    summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 14 },
    summaryLabel: { fontSize: 13, color: '#6b7280' },
    summaryVal: { fontSize: 14, fontWeight: '700', color: '#111827' },
    commentInput: { fontSize: 13, color: '#374151', padding: 14, minHeight: 60 },
    ctaBtn: { backgroundColor: BLUE, borderRadius: 14, paddingVertical: 15, alignItems: 'center', shadowColor: BLUE, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
    ctaBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
    ctaNote: { textAlign: 'center', fontSize: 11, color: '#9ca3af', marginTop: 8 },
    submittedBox: { backgroundColor: '#f0fdf4', borderRadius: 12, padding: 16, alignItems: 'center', borderWidth: 1, borderColor: '#bbf7d0' },
    submittedTitle: { fontSize: 18, fontWeight: '800', color: '#16a34a' },
    submittedSub: { fontSize: 12, color: '#6b7280', marginTop: 4 },
    accessory: {
        backgroundColor: '#f1f5f9',
        height: 44,
        paddingHorizontal: 16,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderTopWidth: 1,
        borderTopColor: '#e2e8f0',
    },
    accessoryDoneBtn: {
        paddingHorizontal: 4,
        paddingVertical: 4,
    },
    accessoryDoneText: {
        color: BLUE,
        fontWeight: '700',
        fontSize: 15,
    },
});
