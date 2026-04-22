import React from 'react';
import {
    View, Text, ScrollView, TouchableOpacity,
    StyleSheet, SafeAreaView
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

const BLUE = '#2563eb';

const TOPIC = {
    name: 'Nhóm AI-02',
    session: 'Hội đồng 1 – 08:00, 22/05/2025',
    room: 'Phòng A.101',
    title: 'Ứng dụng trí tuệ nhân tạo trong giáo dục',
    roleCode: 'GVPB',
    roleLabel: 'Giảng viên phản biện',
};

const STUDENTS = [
    { id: 'SV001', name: 'Nguyễn Văn A' },
    { id: 'SV002', name: 'Trần Thị B' },
    { id: 'SV003', name: 'Lê Văn C' },
];

export default function TopicDetailScreen() {
    const { topicId } = useLocalSearchParams();
    const router = useRouter();

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: '#f8fafc' }}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <Text style={styles.backArrow}>‹</Text>
                </TouchableOpacity>
                <View style={{ flex: 1 }}>
                    <Text style={styles.headerTitle}>{TOPIC.name}</Text>
                    <Text style={styles.headerSub}>{TOPIC.session}</Text>
                </View>
                <View style={styles.roleBadge}>
                    <Text style={styles.roleBadgeText}>{TOPIC.roleCode}</Text>
                </View>
            </View>

            <ScrollView style={{ flex: 1 }}>
                {/* Room */}
                <View style={styles.infoCard}>
                    <Text style={styles.infoLabel}>📍 {TOPIC.room}</Text>
                </View>

                {/* Students */}
                <View style={[styles.section]}>
                    <Text style={styles.sectionTitle}>Sinh viên ({STUDENTS.length})</Text>
                    <View style={styles.listCard}>
                        {STUDENTS.map((sv, i) => (
                            <TouchableOpacity
                                key={sv.id}
                                style={[styles.studentRow, i < STUDENTS.length - 1 && styles.rowBorder]}
                                onPress={() => router.push(`/topic/${topicId}/grading/${sv.id}` as any)}
                            >
                                <View style={styles.avatar}>
                                    <Text style={styles.avatarText}>{sv.name.charAt(0)}</Text>
                                </View>
                                <View style={{ flex: 1, marginLeft: 12 }}>
                                    <Text style={styles.studentName}>{sv.name}</Text>
                                    <Text style={styles.studentId}>{sv.id}</Text>
                                </View>
                                <Text style={styles.chevron}>›</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>

                {/* Topic info */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Thông tin đề tài</Text>
                    <View style={styles.listCard}>
                        <Text style={styles.topicTitle}>{TOPIC.title}</Text>
                    </View>
                </View>

                {/* Role */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Vai trò của bạn (tự động xác định)</Text>
                    <View style={styles.listCard}>
                        <View style={styles.roleRow}>
                            <View style={styles.roleBadge}>
                                <Text style={styles.roleBadgeText}>{TOPIC.roleCode}</Text>
                            </View>
                            <Text style={styles.roleLabel}>{TOPIC.roleLabel}</Text>
                        </View>
                    </View>
                </View>

                <View style={{ height: 20 }} />
            </ScrollView>

            {/* CTA */}
            <View style={styles.footer}>
                <TouchableOpacity
                    style={styles.ctaBtn}
                    onPress={() => router.push(`/topic/${topicId}/grading/SV001` as any)}
                >
                    <Text style={styles.ctaBtnText}>Bắt đầu nhập điểm</Text>
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    header: { backgroundColor: '#fff', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
    backBtn: { marginRight: 8, padding: 4 },
    backArrow: { fontSize: 28, color: '#374151', lineHeight: 28 },
    headerTitle: { fontSize: 16, fontWeight: '700', color: '#111827' },
    headerSub: { fontSize: 11, color: '#9ca3af', marginTop: 1 },
    roleBadge: { backgroundColor: '#eff6ff', borderRadius: 6, paddingHorizontal: 9, paddingVertical: 3 },
    roleBadgeText: { fontSize: 10, fontWeight: '700', color: BLUE },
    infoCard: { backgroundColor: '#fff', marginHorizontal: 16, marginTop: 14, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#f1f5f9' },
    infoLabel: { fontSize: 12, color: '#6b7280' },
    section: { marginHorizontal: 16, marginTop: 14 },
    sectionTitle: { fontSize: 12, fontWeight: '700', color: '#6b7280', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
    listCard: { backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#f1f5f9', overflow: 'hidden' },
    studentRow: { flexDirection: 'row', alignItems: 'center', padding: 14 },
    rowBorder: { borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
    avatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#eff6ff', alignItems: 'center', justifyContent: 'center' },
    avatarText: { fontSize: 15, fontWeight: '700', color: BLUE },
    studentName: { fontSize: 14, fontWeight: '600', color: '#111827' },
    studentId: { fontSize: 11, color: '#9ca3af', marginTop: 1 },
    chevron: { fontSize: 20, color: '#d1d5db' },
    topicTitle: { fontSize: 13, color: '#374151', fontWeight: '600', padding: 14, lineHeight: 20 },
    roleRow: { flexDirection: 'row', alignItems: 'center', padding: 14 },
    roleLabel: { marginLeft: 10, fontSize: 13, color: '#374151' },
    footer: { backgroundColor: '#fff', padding: 16, borderTopWidth: 1, borderTopColor: '#f1f5f9' },
    ctaBtn: { backgroundColor: BLUE, borderRadius: 14, paddingVertical: 15, alignItems: 'center', shadowColor: BLUE, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
    ctaBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
