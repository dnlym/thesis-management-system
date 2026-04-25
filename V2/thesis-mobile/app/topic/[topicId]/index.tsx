import React from 'react';
import {
    View, Text, ScrollView, TouchableOpacity,
    StyleSheet, ActivityIndicator, StatusBar
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTopic } from '@/hooks/useTopics';
import { useAuthStore } from '@/store/auth';

import { ChevronLeft, MoreVertical, MapPin, Users } from 'lucide-react-native';

const NAVY = '#1e293b';
const BLUE = '#2563eb';

export default function TopicDetailScreen() {
    const { topicId } = useLocalSearchParams();
    const router = useRouter();

    const { user } = useAuthStore();
    const { data: topic, isLoading } = useTopic(topicId as string);

    if (isLoading || !topic) {
        return (
            <SafeAreaView style={{ flex: 1, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center' }}>
                <ActivityIndicator size="large" color={BLUE} />
            </SafeAreaView>
        );
    }

    const students = topic.students || [];

    // Determine Role dynamically
    const isAdvisor = topic.supervisor_id === user?.id;
    const reviewerAssignment = topic.assignments?.find(a => a.reviewer_id === user?.id && a.assignment_type === 'REVIEWER');
    const committeeAssignment = topic.assignments?.find(a => a.reviewer_id === user?.id && a.assignment_type === 'COMMITTEE');

    let roleCode = 'GVPB';
    let roleLabel = 'Giảng viên phản biện';

    if (isAdvisor) {
        roleCode = 'GVHD';
        roleLabel = 'Giảng viên hướng dẫn';
    } else if (committeeAssignment) {
        roleCode = 'HĐBV';
        const cRole = committeeAssignment.committee_role;
        if (cRole === 'CHAIR') roleLabel = 'Chủ tịch Hội đồng';
        else if (cRole === 'SECRETARY') roleLabel = 'Thư ký Hội đồng';
        else roleLabel = 'Thành viên Hội đồng';
    } else if (reviewerAssignment) {
        roleCode = 'GVPB';
        roleLabel = 'Giảng viên phản biện';
    }

    // Formatting session string if defense schedule exists
    let sessionString = 'Chưa sắp lịch bảo vệ';
    let roomString = 'Chưa có phòng';

    if (topic.defense_schedule) {
        const ds = topic.defense_schedule;
        const formattedDate = ds.defense_date ? new Date(ds.defense_date).toLocaleDateString('vi-VN') : '';
        const time = ds.defense_time || ds.start_time || '';
        sessionString = `Hội đồng ${ds.committee?.name || ''} – ${time}, ${formattedDate}`;
    }

    roomString = topic.room || topic.defense_schedule?.room || topic.defense_schedule?.committee?.room_preference || 'Chưa xếp phòng';

    const isAnyGraded = students.some((sv: any) => (topic.grades || []).some((g: any) => g.student_id === sv.id));

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: '#f8fafc' }}>
            <StatusBar barStyle="dark-content" />
            
            {/* Modern White Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <ChevronLeft size={28} color="#374151" />
                </TouchableOpacity>
                <View style={{ flex: 1 }}>
                    <Text style={styles.headerTitle}>{topic.code || 'Chi tiết đề tài'}</Text>
                    <Text style={styles.headerSub} numberOfLines={1}>{sessionString}</Text>
                </View>
                <View style={styles.roleBadge}>
                    <Text style={styles.roleBadgeText}>{roleCode}</Text>
                </View>
            </View>

            <ScrollView style={{ flex: 1 }}>
                {/* Location Card */}
                <View style={styles.infoCard}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <MapPin size={16} color={BLUE} />
                        <Text style={styles.infoLabel}>{roomString}</Text>
                    </View>
                </View>

                {/* Students Section */}
                <View style={styles.section}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                        <Text style={styles.sectionTitle}>SINH VIÊN ({students.length})</Text>
                        <View style={styles.badge}>
                            <Text style={styles.badgeText}>{roleCode}</Text>
                        </View>
                    </View>
                    
                    <View style={styles.listCard}>
                        {students.length === 0 ? (
                            <Text style={{ padding: 20, color: '#94a3b8', textAlign: 'center' }}>Chưa có sinh viên</Text>
                        ) : students.map((sv: any, i: number) => {
                            const studentGrades = (topic.grades || []).filter((g: any) => g.student_id === sv.id);
                            const isGraded = studentGrades.length > 0;
                            const avgScore = isGraded ? studentGrades.reduce((sum: number, g: any) => sum + g.score, 0) / studentGrades.length : 0;

                            return (
                                <TouchableOpacity
                                    key={sv.id}
                                    style={[styles.studentRow, i < students.length - 1 && styles.rowBorder]}
                                    onPress={() => {
                                        if (isGraded) {
                                            router.push(`/topic/${topicId}/grade-review/${sv.id}` as any);
                                        } else {
                                            router.push(`/topic/${topicId}/grading/${sv.id}` as any);
                                        }
                                    }}
                                >
                                    <View style={styles.avatar}>
                                        <Text style={styles.avatarText}>{sv.full_name?.charAt(0) || 'S'}</Text>
                                    </View>
                                    <View style={{ flex: 1, marginLeft: 16 }}>
                                        <Text style={styles.studentName}>{sv.full_name}</Text>
                                        <Text style={styles.studentId}>{sv.student_code || sv.id}</Text>
                                    </View>
                                    <View style={{ alignItems: 'flex-end', gap: 4 }}>
                                        <View style={[styles.statusChip, { backgroundColor: isGraded ? '#f0fdf4' : '#fff7ed' }]}>
                                            <Text style={[styles.statusChipText, { color: isGraded ? '#16a34a' : '#ea580c' }]}>
                                                {isGraded ? 'Đã chấm' : 'Chưa chấm'}
                                            </Text>
                                        </View>
                                        {isGraded && <Text style={styles.scoreText}>{avgScore.toFixed(1)}</Text>}
                                    </View>
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                </View>

                {/* Topic Info */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>THÔNG TIN ĐỀ TÀI</Text>
                    <View style={styles.listCard}>
                        <View style={{ padding: 16 }}>
                            <Text style={styles.topicTitleMain}>{topic.title}</Text>
                            <View style={{ height: 1, backgroundColor: '#f1f5f9', marginVertical: 12 }} />
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                <Users size={16} color="#64748b" />
                                <Text style={styles.roleLabelText}>{roleLabel}</Text>
                            </View>
                        </View>
                    </View>
                </View>

                <View style={{ height: 100 }} />
            </ScrollView>

            {/* Footer CTA */}
            {students.length > 0 && (
                <View style={styles.footer}>
                    <TouchableOpacity
                        style={[styles.ctaBtn, isAnyGraded && styles.reviewBtn]}
                        onPress={() => {
                            const target = isAnyGraded 
                                ? `/topic/${topicId}/grade-review/${students[0].id}` 
                                : `/topic/${topicId}/grading/${students[0].id}`;
                            router.push(target as any);
                        }}
                    >
                        <Text style={[styles.ctaBtnText, isAnyGraded && styles.reviewBtnText]}>
                            {isAnyGraded ? 'Xem lại điểm' : 'Bắt đầu nhập điểm'}
                        </Text>
                    </TouchableOpacity>
                </View>
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    header: { 
        backgroundColor: '#fff', 
        flexDirection: 'row', 
        alignItems: 'center', 
        paddingHorizontal: 16, 
        paddingVertical: 12, 
        borderBottomWidth: 1, 
        borderBottomColor: '#f1f5f9' 
    },
    backBtn: { marginRight: 12 },
    headerTitle: { fontSize: 16, fontWeight: '700', color: '#111827' },
    headerSub: { fontSize: 12, color: '#94a3b8', marginTop: 1 },
    roleBadge: { backgroundColor: '#eff6ff', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
    roleBadgeText: { fontSize: 11, fontWeight: '800', color: BLUE },
    infoCard: { backgroundColor: '#fff', marginHorizontal: 16, marginTop: 16, borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#f1f5f9', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.02, shadowRadius: 4, elevation: 1 },
    infoLabel: { fontSize: 14, color: '#1e293b', fontWeight: '600' },
    section: { marginTop: 24, paddingHorizontal: 16 },
    sectionTitle: { fontSize: 12, fontWeight: '800', color: '#64748b', letterSpacing: 1 },
    badge: { backgroundColor: '#eff6ff', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
    badgeText: { fontSize: 11, fontWeight: '800', color: BLUE },
    listCard: { backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: '#f1f5f9', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.03, shadowRadius: 10, elevation: 2 },
    studentRow: { flexDirection: 'row', alignItems: 'center', padding: 16 },
    rowBorder: { borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
    avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center' },
    avatarText: { fontSize: 18, fontWeight: '700', color: BLUE },
    studentName: { fontSize: 15, fontWeight: '700', color: '#1e293b' },
    studentId: { fontSize: 12, color: '#94a3b8', marginTop: 2 },
    statusChip: { backgroundColor: '#f0fdf4', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
    statusChipText: { fontSize: 10, fontWeight: '700', color: '#16a34a' },
    scoreText: { fontSize: 16, fontWeight: '800', color: '#16a34a' },
    topicTitleMain: { fontSize: 15, color: '#1e293b', fontWeight: '600', lineHeight: 22 },
    roleLabelText: { fontSize: 13, color: '#64748b', fontWeight: '500' },
    footer: { backgroundColor: '#fff', padding: 16, borderTopWidth: 1, borderTopColor: '#f1f5f9', position: 'absolute', bottom: 0, left: 0, right: 0 },
    ctaBtn: { backgroundColor: BLUE, borderRadius: 14, paddingVertical: 16, alignItems: 'center', shadowColor: BLUE, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
    ctaBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
    reviewBtn: { backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: '#e2e8f0', shadowOpacity: 0 },
    reviewBtnText: { color: '#475569' },
});
