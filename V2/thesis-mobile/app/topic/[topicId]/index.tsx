import React from 'react';
import {
    View, Text, ScrollView, TouchableOpacity,
    StyleSheet, ActivityIndicator, StatusBar
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTopic } from '@/hooks/useTopics';
import { useAuthStore } from '@/store/auth';
import { Grade } from '@/types';
import { GradingApi } from '@/api/grading';

import { ChevronLeft, MapPin, Users, User, BookOpen } from 'lucide-react-native';

const BLUE = '#2563eb';

export default function TopicDetailScreen() {
    const { topicId, groupId } = useLocalSearchParams();
    const router = useRouter();

    const { user } = useAuthStore();
    const { data: topic, isLoading } = useTopic(topicId as string);
    const [myGradesData, setMyGradesData] = React.useState<any>(null);
    const [isLoadingMyGrades, setIsLoadingMyGrades] = React.useState(true);

    const students = React.useMemo(() => {
        if (!topic) return [];
        const allStudents = topic.students || [];
        const effectiveGroupId = groupId || topicId;
        if (!effectiveGroupId) return allStudents;
        
        return allStudents.filter((s: any) => {
            const sGroupId = s.groupId || s.group_id;
            return sGroupId === effectiveGroupId || (!sGroupId && !effectiveGroupId) || (effectiveGroupId && sGroupId === effectiveGroupId);
        });
    }, [topic, topicId, groupId]);

    const isHead = user?.role === 'HEAD' || user?.role === 'ADMIN' || user?.role === 'COORDINATOR';
    const isAdvisor = topic?.supervisor_id === user?.id;
    const reviewerAssignment = topic?.assignments?.find(a => a.reviewer_id === user?.id && a.assignment_type === 'REVIEWER');
    const committeeAssignment = topic?.assignments?.find(a => a.reviewer_id === user?.id && a.assignment_type === 'COMMITTEE');
    const isAssigned = isAdvisor || !!reviewerAssignment || !!committeeAssignment;
    const isSpectator = isHead && !isAssigned;

    const raterRole = React.useMemo(() => {
        if (isSpectator) return 'HEAD';
        if (isAdvisor) return 'SUPERVISOR';
        if (committeeAssignment) {
            const role = committeeAssignment.committee_role;
            return `COMMITTEE_${role}`;
        }
        if (reviewerAssignment) {
            return `REVIEWER_${reviewerAssignment.reviewer_order}`;
        }
        return 'GVPB';
    }, [isSpectator, isAdvisor, committeeAssignment, reviewerAssignment]);

    React.useEffect(() => {
        const fetchMyGrades = async () => {
            if (!topicId || !topic) return;
            try {
                const data = await GradingApi.getMyGrades(topicId as string, raterRole);
                setMyGradesData(data);
            } catch (err) {
                console.error('Error fetching my grades:', err);
            } finally {
                setIsLoadingMyGrades(false);
            }
        };
        fetchMyGrades();
    }, [topicId, raterRole, topic]);

    if (isLoading || !topic) {
        return (
            <SafeAreaView style={{ flex: 1, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center' }}>
                <ActivityIndicator size="large" color={BLUE} />
            </SafeAreaView>
        );
    }

    let roleCode = 'GVPB';
    let roleLabel = 'Giảng viên phản biện';
    let specificRole: string | null = null;

    if (user?.role === 'HEAD') {
        roleCode = 'TBM';
        roleLabel = 'Trưởng bộ môn';
    } else if (user?.role === 'COORDINATOR') {
        roleCode = 'ĐPV';
        roleLabel = 'Người phụ trách khóa luận';
    } else if (user?.role === 'ADMIN') {
        roleCode = 'ADMIN';
        roleLabel = 'Quản trị viên';
    } else if (isAdvisor) {
        roleCode = 'GVHD';
        roleLabel = 'Giảng viên hướng dẫn';
    } else if (committeeAssignment) {
        roleCode = 'HĐBV';
        const cRole = committeeAssignment.committee_role;
        roleLabel = 'Thành viên Hội đồng';

        const memberAssignments = topic.assignments?.filter(
            (a: any) => a.assignment_type === 'COMMITTEE' && a.committee_role?.startsWith('MEMBER')
        ) || [];
        const hasMultipleMembers = memberAssignments.length > 1;

        if (cRole === 'CHAIR') {
            specificRole = 'Chủ tịch';
        } else if (cRole === 'SECRETARY') {
            specificRole = 'Thư ký';
        } else if (cRole?.startsWith('MEMBER')) {
            if (hasMultipleMembers) {
                const memberNumber = cRole.split('_')[1];
                specificRole = memberNumber ? `Ủy viên ${memberNumber}` : 'Ủy viên';
            } else {
                specificRole = 'Ủy viên';
            }
        } else {
            specificRole = 'Ủy viên';
        }
    } else if (reviewerAssignment) {
        roleCode = 'GVPB';
        roleLabel = 'Giảng viên phản biện';
    }

    // Formatting session string if defense schedule exists
    let sessionString = 'Chưa sắp lịch bảo vệ';
    let roomString = 'Chưa có phòng';

    const ds = topic.defense_schedule || topic.defense_schedules?.[0];
    if (ds) {
        const formattedDate = ds.defense_date ? new Date(ds.defense_date).toLocaleDateString('vi-VN') : '';
        let time = 'Chưa rõ giờ';
        if (ds.defense_time || ds.start_time) {
            const rawTime = ds.defense_time || ds.start_time;
            const timeStr = String(rawTime);
            if (timeStr.includes('T') || timeStr.includes('-')) {
                try {
                    const date = new Date(timeStr);
                    if (!isNaN(date.getTime())) {
                        const hours = date.getHours().toString().padStart(2, '0');
                        const minutes = date.getMinutes().toString().padStart(2, '0');
                        time = `${hours}:${minutes}`;
                    } else {
                        time = timeStr;
                    }
                } catch (e) {
                    time = timeStr;
                }
            } else {
                time = timeStr;
            }
        }
        const committeeName = ds.committee?.name || '';
        const prefix = (committeeName.toLowerCase().startsWith('hội đồng') || committeeName.toLowerCase().startsWith('hđ')) ? '' : 'Hội đồng ';
        sessionString = `${prefix}${committeeName} – ${time}, ${formattedDate}`;
    }

    roomString = topic.room || ds?.room || ds?.committee?.room_preference || 'Chưa xếp phòng';

    const isAnyGraded = isHead ? true : (myGradesData?.students?.some((s: any) => s.status === 'SUBMITTED' || s.status === 'PENDING_APPROVAL') || false);

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
                    <Text style={styles.headerSub}>{sessionString}</Text>
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
                    </View>
                    
                    <View style={styles.listCard}>
                        {students.length === 0 ? (
                            <Text style={{ padding: 20, color: '#94a3b8', textAlign: 'center' }}>Chưa có sinh viên</Text>
                        ) : students.map((sv: any, i: number) => {
                            const isMidtermFailed = sv?.midterm_status === 'FAIL' || sv?.midtermStatus === 'FAIL';
                            const isFinalFailed = sv.finalScore?.finalized && (sv.finalScore?.final_score !== null && sv.finalScore?.final_score < 6.0);
                            const isFailed = isMidtermFailed || isFinalFailed;

                            let statusText = 'Chờ chấm';
                            let statusColor = '#ea580c';
                            let statusBg = '#fff7ed';
                            let scoreToDisplay: number | null = null;

                            if (isFailed) {
                                statusText = 'Đã rớt';
                                statusColor = '#ef4444';
                                statusBg = '#fef2f2';
                                if (sv.finalScore?.final_score !== null && sv.finalScore?.final_score !== undefined) {
                                    scoreToDisplay = sv.finalScore.final_score;
                                }
                            } else if (isSpectator) {
                                const hasScore = !!sv.finalScore && sv.finalScore.final_score !== null;
                                const isFinalized = sv.finalScore?.finalized === true;
                                if (isFinalized) {
                                    statusText = 'Đã chốt';
                                    statusColor = BLUE;
                                    statusBg = '#f0f9ff';
                                } else {
                                    statusText = 'Đang chấm';
                                    statusColor = '#ea580c';
                                    statusBg = '#fff7ed';
                                }
                                if (hasScore) {
                                    scoreToDisplay = sv.finalScore?.final_score ?? sv.finalScore?.total_score ?? 0;
                                }
                            } else {
                                const myStudentGrade = myGradesData?.students?.find((s: any) => s.studentId === sv.id);
                                const isGraded = myStudentGrade && (myStudentGrade.status === 'SUBMITTED' || myStudentGrade.status === 'PENDING_APPROVAL');
                                statusText = isGraded ? 'Đã chấm' : 'Chờ chấm';
                                statusColor = isGraded ? '#16a34a' : '#ea580c';
                                statusBg = isGraded ? '#f0fdf4' : '#fff7ed';
                                if (isGraded && myStudentGrade) {
                                    scoreToDisplay = myStudentGrade.grades.reduce((sum: number, g: any) => sum + g.score * (g.criterionWeight || 0), 0);
                                }
                            }

                            return (
                                <TouchableOpacity
                                    key={sv.id}
                                    style={[styles.studentRow, i < students.length - 1 && styles.rowBorder]}
                                    onPress={() => {
                                        if (isHead) {
                                            router.push(`/topic/${topicId}/grade-review/${sv.id}?groupId=${groupId || ''}` as any);
                                        } else {
                                            router.push(`/topic/${topicId}/grading/${sv.id}?groupId=${groupId || ''}` as any);
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
                                        <View style={[styles.statusChip, { backgroundColor: statusBg }]}>
                                            <Text style={[styles.statusChipText, { color: statusColor }]}>
                                                {statusText}
                                            </Text>
                                        </View>
                                        {scoreToDisplay !== null && (
                                            <Text style={[styles.scoreText, { color: statusColor }]}>
                                                {Number(scoreToDisplay.toFixed(2)).toString()}
                                            </Text>
                                        )}
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
                            <View style={{ gap: 10 }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                    <User size={16} color="#64748b" />
                                    <Text style={styles.roleLabelText}>
                                        GV Hướng dẫn: <Text style={{ fontWeight: '700', color: '#1e293b' }}>{topic?.supervisor?.full_name || 'N/A'}</Text>
                                    </Text>
                                </View>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                    <Users size={16} color="#64748b" />
                                    <Text style={styles.roleLabelText}>
                                        Vai trò của bạn: <Text style={{ fontWeight: '700', color: BLUE }}>{roleLabel}{specificRole ? ` (${specificRole})` : ''}</Text>
                                    </Text>
                                </View>
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
                        style={[styles.ctaBtn, isHead && styles.reviewBtn]}
                        onPress={() => {
                            if (isHead) {
                                // HOD: always goes to full grade review summary
                                router.push(`/topic/${topicId}/grade-review/${students[0].id}?groupId=${groupId || ''}` as any);
                            } else {
                                // Regular lecturers: go straight to grading form (whether graded or not)
                                router.push(`/topic/${topicId}/grading/${students[0].id}?groupId=${groupId || ''}` as any);
                            }
                        }}
                    >
                        <Text style={[styles.ctaBtnText, isHead && styles.reviewBtnText]}>
                            {isHead ? 'Xem bảng điểm' : isAnyGraded ? 'Chỉnh sửa điểm' : 'Bắt đầu nhập điểm'}
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
    specificRoleText: { fontSize: 11, color: '#94a3b8', marginTop: 2, fontWeight: '600' },
    footer: { backgroundColor: '#fff', padding: 16, borderTopWidth: 1, borderTopColor: '#f1f5f9', position: 'absolute', bottom: 0, left: 0, right: 0 },
    ctaBtn: { backgroundColor: BLUE, borderRadius: 14, paddingVertical: 16, alignItems: 'center', shadowColor: BLUE, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
    ctaBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
    reviewBtn: { backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: '#e2e8f0', shadowOpacity: 0 },
    reviewBtnText: { color: '#475569' },
});
