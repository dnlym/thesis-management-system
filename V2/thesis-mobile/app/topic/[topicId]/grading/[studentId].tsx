import React from 'react';
import {
    View, Text, ScrollView, TouchableOpacity,
    TextInput, StyleSheet, SafeAreaView, Alert
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { OfflineStorage } from '@/api/offline';
import { useAuthStore } from '@/store/auth';
import { GradingApi } from '@/api/grading';

const BLUE = '#2563eb';

const CRITERIA = [
    { id: 'PB1', name: 'Nội dung đề tài', weight: 20 },
    { id: 'PB2', name: 'Phương pháp nghiên cứu', weight: 20 },
    { id: 'PB3', name: 'Kết quả & thảo luận', weight: 30 },
    { id: 'PB4', name: 'Hình thức báo cáo', weight: 15 },
    { id: 'PB5', name: 'Trả lời câu hỏi (phản biện)', weight: 15 },
];

const STUDENTS = [
    { id: 'SV001', name: 'Nguyễn Văn A' },
    { id: 'SV002', name: 'Trần Thị B' },
    { id: 'SV003', name: 'Lê Văn C' },
];

export default function GradingScreen() {
    const { topicId, studentId } = useLocalSearchParams();
    const router = useRouter();
    const { user } = useAuthStore();

    const initialIdx = STUDENTS.findIndex(s => s.id === studentId);
    const [idx, setIdx] = React.useState(initialIdx >= 0 ? initialIdx : 0);
    const [allScores, setAllScores] = React.useState<Record<string, Record<string, string>>>({});
    const [allComments, setAllComments] = React.useState<Record<string, string>>({});
    const [groupComment, setGroupComment] = React.useState('');
    const [showSummary, setShowSummary] = React.useState(false);
    const [isSubmitting, setIsSubmitting] = React.useState(false);
    const [submitted, setSubmitted] = React.useState(false);

    const currentStudent = STUDENTS[idx];
    const scores = allScores[currentStudent.id] || {};
    const comment = allComments[currentStudent.id] || '';
    const isLast = idx === STUDENTS.length - 1;

    const calcTotal = (svId: string) => {
        const s = allScores[svId] || {};
        return CRITERIA.reduce((acc, c) => acc + (parseFloat(s[c.id] || '0') || 0) * c.weight / 100, 0);
    };

    const totalScore = calcTotal(currentStudent.id);

    const handleScore = (cId: string, val: string) => {
        const cleaned = val.replace(/[^0-9.]/g, '');
        setAllScores(prev => ({ ...prev, [currentStudent.id]: { ...(prev[currentStudent.id] || {}), [cId]: cleaned } }));
    };

    const handleSaveDraft = async () => {
        if (user && topicId) {
            await OfflineStorage.saveDraft(user.id, topicId as string, 'REVIEWER', currentStudent.id, { scores, comment });
            Alert.alert('Đã lưu nháp!');
        }
    };

    const handleNext = () => {
        if (isLast) setShowSummary(true);
        else setIdx(i => i + 1);
    };

    const handleSubmit = async () => {
        setIsSubmitting(true);
        setTimeout(() => {
            setIsSubmitting(false);
            setSubmitted(true);
        }, 1500);
    };

    // ── Summary screen ──────────────────────────────────────────
    if (showSummary) {
        const avg = (STUDENTS.reduce((a, s) => a + calcTotal(s.id), 0) / STUDENTS.length).toFixed(2);
        return (
            <SafeAreaView style={{ flex: 1, backgroundColor: '#f8fafc' }}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => setShowSummary(false)} style={styles.backBtn}>
                        <Text style={styles.backArrow}>‹</Text>
                    </TouchableOpacity>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.headerTitle}>Nhóm AI-02</Text>
                        <Text style={styles.headerSub}>Hội đồng 1 – 08:00</Text>
                    </View>
                    <View style={styles.roleBadge}><Text style={styles.roleBadgeText}>GVPB</Text></View>
                </View>

                <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16 }}>
                    <Text style={styles.sectionTitle}>Tổng điểm theo sinh viên</Text>
                    <View style={styles.card}>
                        {STUDENTS.map((sv, i) => (
                            <View key={sv.id} style={[styles.svRow, i < STUDENTS.length - 1 && styles.rowBorder]}>
                                <View style={styles.svNum}><Text style={styles.svNumText}>{i + 1}</Text></View>
                                <View style={{ flex: 1, marginLeft: 10 }}>
                                    <Text style={styles.svName}>{sv.name}</Text>
                                    <Text style={styles.svId}>{sv.id}</Text>
                                </View>
                                <Text style={styles.svScore}>{calcTotal(sv.id).toFixed(2)}</Text>
                                <Text style={styles.svScoreMax}>/10</Text>
                            </View>
                        ))}
                    </View>

                    <Text style={[styles.sectionTitle, { marginTop: 16 }]}>Tổng quan điểm GVPB</Text>
                    <View style={styles.card}>
                        <View style={styles.summaryRow}><Text style={styles.summaryLabel}>Trung bình nhóm (tạm tính)</Text><Text style={styles.summaryVal}>{avg}</Text></View>
                        <View style={[styles.summaryRow, styles.rowBorder, { flexDirection: 'row-reverse' }]}><Text style={styles.summaryVal}>{Object.keys(allScores).length} / {STUDENTS.length}</Text><Text style={styles.summaryLabel}>Số sinh viên đã nhập</Text></View>
                    </View>

                    <Text style={[styles.sectionTitle, { marginTop: 16 }]}>Nhận xét chung cho nhóm (không bắt buộc)</Text>
                    <View style={styles.card}>
                        <TextInput
                            style={styles.commentInput}
                            placeholder="Nhập nhận xét chung..."
                            value={groupComment}
                            onChangeText={setGroupComment}
                            multiline
                        />
                    </View>
                </ScrollView>

                <View style={styles.footer}>
                    {submitted ? (
                        <View style={styles.submittedBox}>
                            <Text style={styles.submittedTitle}>✓ ĐÃ NỘP</Text>
                            <Text style={styles.submittedSub}>Không thể chỉnh sửa</Text>
                        </View>
                    ) : (
                        <>
                            <TouchableOpacity
                                style={[styles.ctaBtn, isSubmitting && { opacity: 0.6 }]}
                                onPress={handleSubmit}
                                disabled={isSubmitting}
                            >
                                <Text style={styles.ctaBtnText}>{isSubmitting ? 'Đang nộp...' : 'Nộp điểm (GVPB)'}</Text>
                            </TouchableOpacity>
                            <Text style={styles.ctaNote}>Sau khi nộp, bạn sẽ không thể chỉnh sửa.</Text>
                        </>
                    )}
                </View>
            </SafeAreaView>
        );
    }

    // ── Grading form ─────────────────────────────────────────────
    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <Text style={styles.backArrow}>‹</Text>
                </TouchableOpacity>
                <View style={{ flex: 1 }}>
                    <Text style={styles.headerTitle}>Nhóm AI-02</Text>
                    <Text style={styles.headerSub}>Hội đồng 1 – 08:00</Text>
                </View>
                <View style={styles.roleBadge}><Text style={styles.roleBadgeText}>GVPB</Text></View>
            </View>

            {/* Student switcher */}
            <View style={styles.switcherContainer}>
                <View style={styles.switcherRow}>
                    {STUDENTS.map((sv, i) => (
                        <TouchableOpacity key={sv.id} onPress={() => setIdx(i)} style={[styles.switcherTab, i === idx && styles.switcherTabActive]}>
                            <Text style={[styles.switcherText, i === idx && styles.switcherTextActive]}>{sv.id}</Text>
                        </TouchableOpacity>
                    ))}
                    <View style={{ flex: 1 }} />
                    <Text style={styles.switcherCounter}>Sinh viên: {idx + 1}/{STUDENTS.length}</Text>
                </View>
                <View style={styles.switcherHint}>
                    <Text style={styles.switcherHintText}>Tiêu chí đánh giá (GVPB)</Text>
                    <Text style={styles.switcherHintSub}>(Nhập điểm theo thang 0 – 10)</Text>
                </View>
            </View>

            <ScrollView style={{ flex: 1 }}>
                {/* Criteria table */}
                <View style={styles.tableCard}>
                    {/* Table header */}
                    <View style={styles.tableHeader}>
                        <Text style={[styles.tableHeaderText, { flex: 1 }]}>Tiêu chí</Text>
                        <Text style={[styles.tableHeaderText, { width: 60, textAlign: 'center' }]}>Trọng số</Text>
                        <Text style={[styles.tableHeaderText, { width: 64, textAlign: 'center' }]}>Điểm</Text>
                    </View>

                    {CRITERIA.map((c, i) => {
                        const val = scores[c.id] || '';
                        const num = parseFloat(val);
                        const isLow = !isNaN(num) && num < 5;
                        return (
                            <View key={c.id} style={[styles.tableRow, i < CRITERIA.length - 1 && styles.rowBorder]}>
                                <View style={{ flex: 1, marginRight: 8 }}>
                                    <Text style={styles.criteriaCode}>{c.id}</Text>
                                    <Text style={styles.criteriaName}>{c.name}</Text>
                                </View>
                                <Text style={styles.criteriaWeight}>{c.weight}%</Text>
                                <TextInput
                                    style={[styles.scoreInput, isLow ? styles.scoreInputLow : val ? styles.scoreInputFilled : {}]}
                                    keyboardType="decimal-pad"
                                    placeholder="—"
                                    placeholderTextColor="#cbd5e1"
                                    value={val}
                                    onChangeText={v => handleScore(c.id, v)}
                                    maxLength={4}
                                />
                            </View>
                        );
                    })}
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
                            placeholder="Nhập nhận xét..."
                            value={comment}
                            onChangeText={v => setAllComments(prev => ({ ...prev, [currentStudent.id]: v }))}
                            multiline
                        />
                    </View>
                </View>

                <View style={{ height: 20 }} />
            </ScrollView>

            {/* Action buttons */}
            <View style={styles.footer}>
                <TouchableOpacity style={styles.draftBtn} onPress={handleSaveDraft}>
                    <Text style={styles.draftBtnText}>Lưu nháp</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.nextBtn} onPress={handleNext}>
                    <Text style={styles.nextBtnText}>{isLast ? 'Xem tổng hợp' : 'Sinh viên tiếp theo'}</Text>
                </TouchableOpacity>
            </View>
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
    criteriaCode: { fontSize: 10, fontWeight: '700', color: '#9ca3af' },
    criteriaName: { fontSize: 12, color: '#374151', fontWeight: '500', marginTop: 1, lineHeight: 16 },
    criteriaWeight: { width: 60, textAlign: 'center', fontSize: 12, color: '#6b7280' },
    scoreInput: { width: 56, borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 8, paddingVertical: 6, textAlign: 'center', fontSize: 14, fontWeight: '700', color: '#374151', backgroundColor: '#f8fafc' },
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
});
