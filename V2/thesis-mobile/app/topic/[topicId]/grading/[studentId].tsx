import React from 'react';
import {
    View, Text, ScrollView, TouchableOpacity,
    TextInput, StyleSheet, Alert, ActivityIndicator,
    Platform, StatusBar, Pressable, Modal
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
    ChevronLeft, GraduationCap, MapPin, Users, User, ChevronRight,
    Save, CheckCircle, ClipboardCheck, FileText, Info, Award, AlertCircle
} from 'lucide-react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
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
    const queryClient = useQueryClient();
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
    const backendRole = React.useMemo(() => {
    if (raterRole === 'SUPERVISOR') {
        return 'SUPERVISOR';
    }

    if (
        raterRole.startsWith('COMMITTEE') ||
        raterRole.includes('COUNCIL')
    ) {
        return 'COMMITTEE';
    }

    if (raterRole.startsWith('REVIEWER')) {
        return 'REVIEWER';
    }

    return raterRole;
}, [raterRole]);

const {
    data: criteriaRes,
    isLoading: isLoadingCriteria,
} = useGradingCriteria({
    raterRole: backendRole,
    topicId: topicId as string,
});

    const [isSubmitting, setIsSubmitting] = React.useState(false);
    
    const students = React.useMemo(() => {
        const all = topic?.students || [];
        if (!groupId) return all;
        return all.filter((s: any) => s.groupId === groupId);
    }, [topic?.students, groupId]);

    // Helper: Check if student has failed midterm
    const isStudentMidtermFailed = React.useCallback((student: any) => {
        return student?.midterm_status === 'FAIL' || student?.midtermStatus === 'FAIL' || student?.status === 'FAILED';
    }, []);

    const eligibleStudents = React.useMemo(() => {
        return students.filter((s: any) => !isStudentMidtermFailed(s));
    }, [students, isStudentMidtermFailed]);

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

    // Khởi tạo index thông minh dựa trên danh sách sinh viên đủ điều kiện
    const startIdx = React.useMemo(() => {
        const initialIdx = eligibleStudents.findIndex((s: any) => s.id === studentId);
        return initialIdx >= 0 ? initialIdx : 0;
    }, [eligibleStudents, studentId]);

    const [idx, setIdx] = React.useState(startIdx); 

    React.useEffect(() => {
        setIdx(startIdx);
    }, [startIdx]);

    const [allScores, setAllScores] = React.useState<Record<string, Record<string, string>>>({});
    const [allComments, setAllComments] = React.useState<Record<string, Record<string, string>>>({});
    const [originalScores, setOriginalScores] = React.useState<Record<string, Record<string, string>>>({});
    const [originalComments, setOriginalComments] = React.useState<Record<string, Record<string, string>>>({});
    const [expandedComments, setExpandedComments] = React.useState<Record<string, boolean>>({});
    const [submittedAt, setSubmittedAt] = React.useState<string | null>(null);
    const [isRestoring, setIsRestoring] = React.useState(true);
    const [submittedStudents, setSubmittedStudents] = React.useState<Record<string, boolean>>({});
    const [gradeHistory, setGradeHistory] = React.useState<any[]>([]);
    const [isRequestMode, setIsRequestMode] = React.useState(false);
    const [requestModalVisible, setRequestModalVisible] = React.useState(false);
    const [requestReason, setRequestReason] = React.useState('');
    const [myGradesData, setMyGradesData] = React.useState<any>(null);
    const inputRefs = React.useRef<Record<string, TextInput | null>>({});

    React.useEffect(() => {
        setExpandedComments({});
    }, [idx]);

    // Restoration Logic
    React.useEffect(() => {
        const restoreAndCheck = async () => {
            if (!user || !topic || eligibleStudents.length === 0) {
                if (eligibleStudents.length === 0 && !isLoadingTopic) setIsRestoring(false);
                return;
            }
            try {
                const myGrades = await GradingApi.getMyGrades(topicId as string, raterRole);
                setMyGradesData(myGrades);
                const restoredScores: Record<string, Record<string, string>> = {};
                const restoredComments: Record<string, Record<string, string>> = {};

                if (myGrades) {
                    setGradeHistory(myGrades.gradeHistory || []);
                    if (myGrades.students && myGrades.students.length > 0) {
                        const restoredSubmitted: Record<string, boolean> = {};
                        for (const sGrade of myGrades.students) {
                            if (sGrade.status === 'SUBMITTED' || sGrade.status === 'PENDING_APPROVAL') {
                                restoredSubmitted[sGrade.studentId] = true;
                                const sScores: Record<string, string> = {};
                                const sComments: Record<string, string> = {};
                                sGrade.grades.forEach((g: any) => {
                                    sScores[g.criterionId] = g.score.toString();
                                    if (g.comment) {
                                        sComments[g.criterionId] = g.comment;
                                    }
                                });
                                restoredScores[sGrade.studentId] = sScores;
                                restoredComments[sGrade.studentId] = sComments;
                                if (sGrade.studentId === studentId) {
                                    setSubmittedAt(sGrade.updatedAt || sGrade.createdAt);
                                }
                            }
                        }
                        if (Object.keys(restoredSubmitted).length > 0) {
                            setAllScores(JSON.parse(JSON.stringify(restoredScores)));
                            setOriginalScores(JSON.parse(JSON.stringify(restoredScores)));
                            setAllComments(restoredComments);
                            setOriginalComments(JSON.parse(JSON.stringify(restoredComments)));
                            setSubmittedStudents(restoredSubmitted);
                            setIsRestoring(false);
                            return;
                        }
                    }
                }
                
                // If not submitted, try local drafts
                for (const student of eligibleStudents) {
                    const draft = await OfflineStorage.getDraft(user.id, topicId as string, groupId as string || null, raterRole, student.id);
                    if (draft) {
                        if (draft.scores) restoredScores[student.id] = draft.scores;
                        if (draft.comment) restoredComments[student.id] = typeof draft.comment === 'object' ? draft.comment : {};
                    }
                }
                setAllScores(restoredScores);
                setOriginalScores(JSON.parse(JSON.stringify(restoredScores)));
                setAllComments(restoredComments);
                setOriginalComments(JSON.parse(JSON.stringify(restoredComments)));
            } catch (err) { console.error(err); } finally { setIsRestoring(false); }
        };
        if (topic && !isLoadingTopic) restoreAndCheck();
    }, [topic, isLoadingTopic, raterRole, user, topicId, groupId, studentId, eligibleStudents]);

    const isDirty = React.useMemo(() => {
        const currentId = eligibleStudents[idx]?.id;
        if (!currentId) return false;
        
        const scoresChanged = JSON.stringify(allScores[currentId] || {}) !== JSON.stringify(originalScores[currentId] || {});
        const commentChanged = JSON.stringify(allComments[currentId] || {}) !== JSON.stringify(originalComments[currentId] || {});
        
        return scoresChanged || commentChanged;
    }, [allScores, originalScores, allComments, originalComments, idx, eligibleStudents]);

    // Real-time synchronization polling (3 seconds)
    React.useEffect(() => {
        if (!user || !topic || eligibleStudents.length === 0 || isRestoring) return;

        const interval = setInterval(async () => {
            // Only update from server if user has no unsaved changes (not dirty)
            if (isDirty) return;

            try {
                const myGrades = await GradingApi.getMyGrades(topicId as string, raterRole);
                if (myGrades) {
                    setMyGradesData(myGrades);
                    setGradeHistory(myGrades.gradeHistory || []);

                    if (myGrades.students && myGrades.students.length > 0) {
                        const restoredScores: Record<string, Record<string, string>> = {};
                        const restoredComments: Record<string, Record<string, string>> = {};
                        const restoredSubmitted: Record<string, boolean> = {};

                        for (const sGrade of myGrades.students) {
                            if (sGrade.status === 'SUBMITTED' || sGrade.status === 'PENDING_APPROVAL') {
                                restoredSubmitted[sGrade.studentId] = true;
                                const sScores: Record<string, string> = {};
                                const sComments: Record<string, string> = {};
                                sGrade.grades.forEach((g: any) => {
                                    sScores[g.criterionId] = g.score.toString();
                                    if (g.comment) {
                                        sComments[g.criterionId] = g.comment;
                                    }
                                });
                                restoredScores[sGrade.studentId] = sScores;
                                restoredComments[sGrade.studentId] = sComments;
                                if (sGrade.studentId === studentId) {
                                    setSubmittedAt(sGrade.updatedAt || sGrade.createdAt);
                                }
                            }
                        }

                        // Update states only if we are still not dirty (safety check)
                        if (!isDirty) {
                            setAllScores(prev => ({ ...prev, ...restoredScores }));
                            setOriginalScores(JSON.parse(JSON.stringify(restoredScores)));
                            setAllComments(prev => ({ ...prev, ...restoredComments }));
                            setOriginalComments(JSON.parse(JSON.stringify(restoredComments)));
                            setSubmittedStudents(restoredSubmitted);
                        }
                    }
                }
            } catch (err) {
                console.error('Polling error:', err);
            }
        }, 3000);

        return () => clearInterval(interval);
    }, [user, topic, raterRole, topicId, groupId, studentId, eligibleStudents, isRestoring, isDirty]);



    const roleLabel = React.useMemo(() => {
        if (raterRole === 'SUPERVISOR') return 'GVHD';
        if (raterRole === 'COMMITTEE_CHAIR') return 'Chủ tịch HĐ';
        if (raterRole === 'COMMITTEE_SECRETARY') return 'Thư ký HĐ';
        if (raterRole === 'COMMITTEE_MEMBER') return 'Ủy viên HĐ';
        if (raterRole === 'REVIEWER_1') return 'GVPB 1';
        if (raterRole === 'REVIEWER_2') return 'GVPB 2';
        if (raterRole === 'REVIEWER_3') return 'GVPB 3';
        if (raterRole.startsWith('REVIEWER')) return 'GVPB';
        return raterRole;
    }, [raterRole]);

    const missingSupervisorGrades = React.useMemo(() => {
        const currentStudentId = eligibleStudents[idx]?.id;
        if (!currentStudentId || !myGradesData) return false;
        const normalizedRole = backendRole; // 'SUPERVISOR', 'REVIEWER', 'COMMITTEE'
        if (normalizedRole !== 'REVIEWER' && normalizedRole !== 'COMMITTEE') return false;

        const sData = myGradesData.students?.find((ms: any) => ms.studentId === currentStudentId);
        return sData && !sData.raterStatuses?.hasSupervisorGraded;
    }, [eligibleStudents, idx, myGradesData, backendRole]);

    const missingReviewerGrades = React.useMemo(() => {
        const currentStudentId = eligibleStudents[idx]?.id;
        if (!currentStudentId || !myGradesData) return false;
        const normalizedRole = backendRole;
        if (normalizedRole !== 'COMMITTEE') return false;

        const sData = myGradesData.students?.find((ms: any) => ms.studentId === currentStudentId);
        return sData && !sData.raterStatuses?.hasReviewerGraded;
    }, [eligibleStudents, idx, myGradesData, backendRole]);

    const canGrade = React.useMemo(() => {
        if (missingSupervisorGrades || missingReviewerGrades) return false;

        const actions = (topic as any)?.allowedActions;
        if (!actions) return true; 

        if (raterRole === 'SUPERVISOR') return actions.GRADE_SUPERVISOR?.allowed;
        if (raterRole.startsWith('REVIEWER')) return actions.GRADE_REVIEWER?.allowed;
        if (raterRole.startsWith('COMMITTEE')) return actions.GRADE_COMMITTEE?.allowed;
        
        return true;
    }, [topic, raterRole, missingSupervisorGrades, missingReviewerGrades]);

    const disableReason = React.useMemo(() => {
        if (missingSupervisorGrades) {
            return 'Chưa thể chấm điểm do Giảng viên hướng dẫn chưa hoàn tất nhập điểm cho đề tài/sinh viên này.';
        }
        if (missingReviewerGrades) {
            return 'Chưa thể chấm điểm do Giảng viên phản biện chưa hoàn tất nhập điểm cho đề tài/sinh viên này.';
        }

        const actions = (topic as any)?.allowedActions;
        if (!actions) return null;

        let result = null;
        if (raterRole === 'SUPERVISOR') result = actions.GRADE_SUPERVISOR;
        else if (raterRole.startsWith('REVIEWER')) result = actions.GRADE_REVIEWER;
        else if (raterRole.startsWith('COMMITTEE')) result = actions.GRADE_COMMITTEE;

        return result?.allowed ? null : result?.reason;
    }, [topic, raterRole, missingSupervisorGrades, missingReviewerGrades]);

    if (isLoadingTopic || isLoadingCriteria || isRestoring) {
        return (
            <SafeAreaView style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={BLUE} />
            </SafeAreaView>
        );
    }

    if (eligibleStudents.length === 0) {
        return (
            <SafeAreaView style={{ flex: 1, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
                <AlertCircle size={48} color="#dc2626" />
                <Text style={{ fontSize: 16, fontWeight: '700', color: '#dc2626', marginTop: 12, marginBottom: 8 }}>Không có sinh viên đủ điều kiện</Text>
                <Text style={{ fontSize: 14, color: '#64748b', textAlign: 'center', marginBottom: 20 }}>Tất cả sinh viên trong nhóm này đều đã rớt giữa kỳ hoặc không đủ điều kiện chấm bảo vệ cuối kỳ.</Text>
                <TouchableOpacity onPress={() => router.back()} style={{ backgroundColor: BLUE, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8 }}>
                    <Text style={{ color: '#fff', fontWeight: '700' }}>Quay lại</Text>
                </TouchableOpacity>
            </SafeAreaView>
        );
    }

    const currentStudent = eligibleStudents[idx];
    const submitted = submittedStudents[currentStudent?.id] || false;
    const isMidtermFailed = isStudentMidtermFailed(currentStudent);
    const canEditStudent = (canGrade || isRequestMode) && !isMidtermFailed;
    const scores = allScores[currentStudent?.id] || {};

    const isLastEligibleStudent = idx === eligibleStudents.length - 1;

    const totalScore = criteria.reduce((acc: number, c: any) =>
        acc + (parseFloat(scores[c.id] || '0') || 0) * (c.weight || 1), 0
    );

    const handleScore = (cId: string, val: string, max: number = 10) => {
        if (!canEditStudent) return;
        const normalized = val.replace(',', '.').replace(/[^0-9.]/g, '');
        let finalized = normalized;
        const num = parseFloat(normalized);
        if (!isNaN(num) && num > max) finalized = max.toString();
        
        setAllScores(prev => {
            const nextScores = { ...prev, [currentStudent.id]: { ...(prev[currentStudent.id] || {}), [cId]: finalized } };
            if (user && topic) {
                OfflineStorage.saveDraft(user.id, topicId as string, groupId as string || null, raterRole, currentStudent.id, {
                    scores: nextScores[currentStudent.id], comment: allComments[currentStudent.id] || {}
                }).catch(console.error);
            }
            return nextScores;
        });
    };

    const handleComment = (cId: string, val: string) => {
        if (!canEditStudent) return;
        setAllComments(prev => {
            const nextComments = {
                ...prev,
                [currentStudent.id]: {
                    ...(prev[currentStudent.id] || {}),
                    [cId]: val
                }
            };
            if (user && topic) {
                OfflineStorage.saveDraft(user.id, topicId as string, groupId as string || null, raterRole, currentStudent.id, {
                    scores: allScores[currentStudent.id] || {}, comment: nextComments[currentStudent.id]
                }).catch(console.error);
            }
            return nextComments;
        });
    };

    const handleNext = async (requesting = false) => {
        const currentStudentId = eligibleStudents[idx].id;
        const currentScores = allScores[currentStudentId] || {};
        const incomplete = criteria.some((c: any) => !currentScores[c.id]);
        if (incomplete) { Alert.alert('Thiếu điểm', 'Vui lòng nhập đủ điểm trước khi lưu.'); return; }
        
        if (requesting && !requestReason.trim()) {
            Alert.alert('Lỗi', 'Vui lòng nhập lý do giải trình');
            return;
        }

        setIsSubmitting(true);
        try {
            const myAssignment = topic?.assignments?.find(a => a.reviewer_id === user?.id);
            const submissionData = {
                topic_id: topicId as string,
                group_id: groupId as string || undefined,
                student_id: currentStudentId,
                rater_role: raterRole,
                reviewer_order: myAssignment?.assignment_type === 'REVIEWER' ? myAssignment.reviewer_order : undefined,
                committee_role: myAssignment?.assignment_type === 'COMMITTEE' ? myAssignment.committee_role : undefined,
                scores: criteria.map((c: any) => ({
                    criterion_id: c.id,
                    score: parseFloat(currentScores[c.id] || '0'),
                    comment: (allComments[currentStudentId] || {})[c.id] || ''
                })),
                general_comment: '',
                reason: requesting ? requestReason : undefined
            };

            const response = await GradingApi.submitGrade(submissionData as any);
            const isPendingApproval = response && !Array.isArray(response) && response.status === 'PENDING_APPROVAL';

            // Invalidate React Query caches to trigger refetch of topic and grades
            try {
                await queryClient.invalidateQueries({ queryKey: ['topics'] });
                await queryClient.invalidateQueries({ queryKey: ['grading'] });
            } catch (err) {
                console.error('Failed to invalidate queries:', err);
            }

            if (requesting || isPendingApproval) {
                const alertMsg = (response && !Array.isArray(response) && response.message) || 'Đã gửi yêu cầu phê duyệt điểm tới Trưởng bộ môn do quá hạn.';
                Alert.alert('Thông báo', alertMsg);
                if (requesting) {
                    setRequestModalVisible(false);
                    setRequestReason('');
                    setIsRequestMode(false);
                }
                setOriginalScores(prev => ({ ...prev, [currentStudentId]: { ...currentScores } }));
                setOriginalComments(prev => ({ ...prev, [currentStudentId]: { ...(allComments[currentStudentId] || {}) } }));
                setSubmittedStudents(prev => ({ ...prev, [currentStudentId]: true }));
                setSubmittedAt(new Date().toISOString());

                if (isLastEligibleStudent) {
                    router.push(`/topic/${topicId}/grade-review/${currentStudentId}?groupId=${groupId || ''}`);
                } else {
                    setIdx(i => i + 1);
                }
                return;
            }

            setOriginalScores(prev => ({ ...prev, [currentStudentId]: { ...currentScores } }));
            setOriginalComments(prev => ({ ...prev, [currentStudentId]: { ...(allComments[currentStudentId] || {}) } }));
            setSubmittedStudents(prev => ({ ...prev, [currentStudentId]: true }));
            setSubmittedAt(new Date().toISOString());
            
            if (isLastEligibleStudent) {
                Alert.alert('Thành công', 'Đã lưu điểm cho toàn bộ nhóm đủ điều kiện.');
                router.push(`/topic/${topicId}/grade-review/${currentStudentId}?groupId=${groupId || ''}`);
            } else {
                setIdx(i => i + 1);
            }
        } catch (err: any) {
            Alert.alert('Lỗi', err.message || 'Không thể lưu điểm. Vui lòng thử lại.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleSaveDraft = async () => {
        if (!user || !currentStudent) return;
        const currentScores = allScores[currentStudent.id] || {};
        await OfflineStorage.saveDraft(user.id, topicId as string, groupId as string || null, raterRole, currentStudent.id, {
            scores: currentScores, comment: allComments[currentStudent.id] || {}
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

            {!canGrade && !submitted && !isRequestMode && (
                <View style={styles.phaseWarning}>
                    <Info size={16} color="#92400e" />
                    <View style={{ flex: 1, marginLeft: 8 }}>
                        <Text style={styles.phaseWarningTitle}>Không trong giai đoạn chấm điểm</Text>
                        <Text style={styles.phaseWarningText}>{disableReason || 'Bạn hiện không thể nhập điểm.'}</Text>
                    </View>
                </View>
            )}

            {isMidtermFailed && (
                <View style={[styles.phaseWarning, { backgroundColor: '#fee2e2', borderColor: '#fca5a5' }]}>
                    <AlertCircle size={16} color="#dc2626" />
                    <View style={{ flex: 1, marginLeft: 8 }}>
                        <Text style={[styles.phaseWarningTitle, { color: '#dc2626' }]}>Rớt giữa kỳ</Text>
                        <Text style={[styles.phaseWarningText, { color: '#991b1b' }]}>Sinh viên này không đủ điều kiện chấm bảo vệ cuối kỳ.</Text>
                    </View>
                </View>
            )}

            {submitted && (
                <View style={[styles.phaseWarning, { backgroundColor: '#f0fdf4', borderColor: '#bbf7d0' }]}>
                    <CheckCircle size={16} color="#15803d" />
                    <View style={{ flex: 1, marginLeft: 8 }}>
                        <Text style={[styles.phaseWarningTitle, { color: '#15803d' }]}>Đã hoàn thành chấm điểm</Text>
                        <Text style={[styles.phaseWarningText, { color: '#166534' }]}>
                            Bảng điểm được lưu lúc {submittedAt ? new Date(submittedAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) + ' ngày ' + new Date(submittedAt).toLocaleDateString('vi-VN') : '---'}
                        </Text>
                    </View>
                </View>
            )}

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
                    {students.map((sv: any, i: number) => {
                        const isFailed = isStudentMidtermFailed(sv);
                        const eligibleIdx = eligibleStudents.findIndex((es: any) => es.id === sv.id);
                        const isActive = eligibleIdx === idx;
                        return (
                            <TouchableOpacity
                                key={sv.id}
                                onPress={() => {
                                    if (eligibleIdx >= 0) {
                                        setIdx(eligibleIdx);
                                    }
                                }}
                                disabled={isFailed} // KHÓA CLICK ĐỐI VỚI SV RỚT
                                style={[
                                    styles.tab, 
                                    isActive && styles.tabActive,
                                    isFailed && { opacity: 0.5, backgroundColor: '#f8fafc' } // BÔI XÁM TAB
                                ]}
                            >
                                <User size={16} color={isActive ? BLUE : (isFailed ? '#cbd5e1' : '#94a3b8')} />
                                <Text 
                                    style={[
                                        styles.tabText, 
                                        isActive && styles.tabTextActive,
                                        isFailed && { textDecorationLine: 'line-through', color: '#94a3b8' } // GẠCH NGANG TÊN
                                    ]} 
                                    numberOfLines={1}
                                >
                                    {sv.full_name.split(' ').pop()}
                                </Text>
                                {isFailed && (
                                    <View style={styles.failedBadge}>
                                        <Text style={styles.failedBadgeText}>Rớt GK</Text>
                                    </View>
                                )}
                            </TouchableOpacity>
                        );
                    })}
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
                        <View style={[styles.gradeBadge, { backgroundColor: totalScore === 0 ? '#f1f5f9' : (totalScore >= 6 ? '#dcfce7' : '#fee2e2') }]}>
                            <Text style={[styles.gradeBadgeText, { color: totalScore === 0 ? '#64748b' : (totalScore >= 6 ? '#166534' : '#991b1b') }]}>
                                {totalScore === 0 ? 'Chưa chấm' : (totalScore >= 6 ? 'Đạt' : 'Rớt')}
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
                    {criteria.map((c: any, i: number) => {
                        const hasCriterionComment = !!(allComments[currentStudent.id] || {})[c.id];
                        const isExpanded = !!expandedComments[c.id];
                        return (
                            <View key={c.id} style={styles.criterionCard}>
                                <View style={styles.criterionMain}>
                                    <View style={styles.criterionInfo}>
                                        <View style={styles.criterionTitleRow}>
                                            <ClipboardCheck size={16} color={BLUE} style={{ marginRight: 8 }} />
                                            <Text style={styles.criterionName} numberOfLines={2}>{c.name}</Text>
                                            {gradeHistory.some((h: any) => h.studentName === currentStudent?.full_name && h.criterionName === c.name) && (
                                                <View style={{ marginLeft: 6, backgroundColor: '#fef3c7', padding: 4, borderRadius: 4 }}>
                                                    <Info size={12} color="#d97706" />
                                                </View>
                                            )}
                                        </View>
                                    </View>
                                    <Pressable 
                                        style={styles.scoreInputGroup}
                                        onPress={() => {
                                            inputRefs.current[c.id]?.focus();
                                        }}
                                    >
                                        <TextInput
                                            ref={el => { inputRefs.current[c.id] = el; }}
                                            style={[styles.input, !canEditStudent && styles.disabledInput, scores[c.id] ? styles.inputFilled : {}]}
                                            keyboardType="decimal-pad"
                                            value={scores[c.id] || ''}
                                            onChangeText={v => handleScore(c.id, v, c.max_score)}
                                            placeholder="0.0"
                                            editable={canEditStudent}
                                            selectTextOnFocus
                                        />
                                        <View style={styles.maxBadge}>
                                            <Text style={styles.maxBadgeText}>/{c.max_score}</Text>
                                        </View>
                                    </Pressable>
                                </View>

                                {(hasCriterionComment || isExpanded) && (
                                    <View style={styles.commentInputWrapper}>
                                        <View style={styles.commentInputHeader}>
                                            <Text style={styles.commentInputLabel}>Nhận xét tiêu chí:</Text>
                                            {canEditStudent && (
                                                <TouchableOpacity 
                                                    onPress={() => {
                                                        handleComment(c.id, '');
                                                        setExpandedComments(prev => ({ ...prev, [c.id]: false }));
                                                    }}
                                                >
                                                    <Text style={styles.removeCommentText}>Xóa</Text>
                                                </TouchableOpacity>
                                            )}
                                        </View>
                                        <TextInput
                                            style={[styles.criterionCommentInput, (submitted || !canEditStudent) && styles.disabledInput]}
                                            multiline
                                            placeholder="Nhập nhận xét chi tiết..."
                                            value={(allComments[currentStudent.id] || {})[c.id] || ''}
                                            onChangeText={v => handleComment(c.id, v)}
                                            editable={canEditStudent}
                                            textAlignVertical="top"
                                        />
                                    </View>
                                )}

                                {!hasCriterionComment && !isExpanded && (
                                    <TouchableOpacity 
                                        style={styles.addCommentBtn}
                                        onPress={() => setExpandedComments(prev => ({ ...prev, [c.id]: true }))}
                                        disabled={!canEditStudent}
                                    >
                                        <FileText size={12} color={canEditStudent ? BLUE : '#94a3b8'} style={{ marginRight: 4 }} />
                                        <Text style={[styles.addCommentBtnText, !canEditStudent && { color: '#94a3b8' }]}>Thêm nhận xét</Text>
                                    </TouchableOpacity>
                                )}
                            </View>
                        );
                    })}
                </View>

                {gradeHistory && gradeHistory.length > 0 && (
                    <View style={styles.historySection}>
                        <View style={styles.commentHeader}>
                            <Info size={16} color="#64748b" />
                            <Text style={styles.commentLabel}>LỊCH SỬ CHỈNH SỬA</Text>
                        </View>
                        <View style={{ gap: 8 }}>
                            {gradeHistory.filter((h: any) => h.studentName === currentStudent?.full_name).map((h: any) => (
                                <View key={h.id} style={styles.historyItem}>
                                    <View style={styles.historyPoint} />
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.historyText}>
                                            <Text style={{ fontWeight: '700' }}>{h.graderName}</Text> đã sửa điểm 
                                            <Text style={{ color: BLUE }}> {h.criterionName}</Text>
                                        </Text>
                                        <Text style={styles.historyChange}>
                                            Thay đổi: <Text style={{ color: '#94a3b8', textDecorationLine: 'line-through' }}>{h.oldScore}</Text> → <Text style={{ color: BLUE, fontWeight: '700' }}>{h.newScore}</Text>
                                        </Text>
                                        <Text style={styles.historyDate}>{new Date(h.createdAt).toLocaleString('vi-VN')}</Text>
                                    </View>
                                </View>
                            ))}
                        </View>
                    </View>
                )}
            </ScrollView>

            <View style={styles.footer}>
                {!isRequestMode ? (
                        <TouchableOpacity 
                            style={[styles.submitBtn, (!canEditStudent || !isDirty || isSubmitting) && styles.disabledSubmitBtn]} 
                            onPress={() => handleNext(false)}
                            disabled={!canEditStudent || !isDirty || isSubmitting}
                        >
                            {isSubmitting ? <ActivityIndicator color="#fff" size="small" /> : (
                                <>
                                    {/* THAY ĐỔI LABEL THEO TÌNH TRẠNG SINH VIÊN PASS CUỐI CÙNG */}
                                    <Text style={styles.submitBtnText}>{isLastEligibleStudent ? 'Lưu điểm & Kết thúc' : 'Lưu & Tiếp tục'}</Text>
                                    <ChevronRight size={18} color="#fff" />
                                </>
                            )}
                        </TouchableOpacity>
                ) : (
                    <>
                        <TouchableOpacity 
                            style={styles.draftBtn} 
                            onPress={() => setIsRequestMode(false)}
                            disabled={isSubmitting}
                        >
                            <Text style={styles.draftBtnText}>Hủy</Text>
                        </TouchableOpacity>
                        <TouchableOpacity 
                            style={[styles.submitBtn, { backgroundColor: '#ea580c' }]} 
                            onPress={() => setRequestModalVisible(true)}
                            disabled={isSubmitting}
                        >
                            <Text style={styles.submitBtnText}>Gửi yêu cầu sửa</Text>
                        </TouchableOpacity>
                    </>
                )}
            </View>

            {!canGrade && !isRequestMode && !isMidtermFailed && (
                <View style={{ paddingHorizontal: 16, paddingBottom: Platform.OS === 'ios' ? 24 : 16, backgroundColor: '#fff' }}>
                    <TouchableOpacity 
                        style={{ padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#ea580c', alignItems: 'center', backgroundColor: '#fff7ed' }}
                        onPress={() => setIsRequestMode(true)}
                    >
                        <Text style={{ color: '#ea580c', fontWeight: '700' }}>Yêu cầu sửa điểm</Text>
                    </TouchableOpacity>
                </View>
            )}

            <Modal visible={requestModalVisible} transparent animationType="fade">
                <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 }}>
                    <View style={{ backgroundColor: '#fff', borderRadius: 12, padding: 20 }}>
                        <Text style={{ fontSize: 16, fontWeight: '700', marginBottom: 12 }}>Lý do sửa điểm</Text>
                        <TextInput 
                            style={{ borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8, padding: 12, minHeight: 80, textAlignVertical: 'top' }}
                            placeholder="Nhập lý do chi tiết..."
                            multiline
                            value={requestReason}
                            onChangeText={setRequestReason}
                        />
                        <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 16, gap: 12 }}>
                            <TouchableOpacity onPress={() => setRequestModalVisible(false)} style={{ padding: 10 }}>
                                <Text style={{ color: '#64748b', fontWeight: '600' }}>Hủy</Text>
                            </TouchableOpacity>
                            <TouchableOpacity 
                                onPress={() => handleNext(true)} 
                                style={{ backgroundColor: BLUE, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8 }}
                            >
                                <Text style={{ color: '#fff', fontWeight: '700' }}>Gửi yêu cầu</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' },
    header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
    backBtn: { marginRight: 8 },
    headerTitle: { fontSize: 16, fontWeight: '800', color: '#1e293b' },
    headerSub: { fontSize: 11, color: '#94a3b8', marginTop: 0, fontWeight: '500' },
    roleBadge: { backgroundColor: LIGHT_BLUE, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 },
    roleBadgeText: { fontSize: 10, fontWeight: '800', color: BLUE },
    phaseWarning: { flexDirection: 'row', backgroundColor: '#fffbeb', padding: 8, marginHorizontal: 12, marginTop: 8, borderRadius: 8, borderWidth: 1, borderColor: '#fef3c7', alignItems: 'center' },
    phaseWarningTitle: { fontSize: 12, fontWeight: '700', color: '#92400e' },
    phaseWarningText: { fontSize: 11, color: '#b45309', marginTop: 1 },

    topicCardContainer: { padding: 12, backgroundColor: '#fff', paddingBottom: 8 },
    topicCard: {
        backgroundColor: '#fff', borderRadius: 12,
        shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 6, elevation: 2,
        borderWidth: 1, borderColor: '#f1f5f9', overflow: 'hidden'
    },
    topicCardBody: { padding: 10, flexDirection: 'row', gap: 10 },
    topicIconBox: { width: 32, height: 32, borderRadius: 8, backgroundColor: LIGHT_BLUE, alignItems: 'center', justifyContent: 'center' },
    topicCardTitle: { fontSize: 13, fontWeight: '700', color: '#1e293b', lineHeight: 18 },
    topicInfoGrid: { flexDirection: 'row', gap: 12, marginTop: 4 },
    topicInfoItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    topicInfoText: { fontSize: 11, color: '#64748b', fontWeight: '500' },
    topicCardFooter: {
        backgroundColor: '#f8fafc', paddingHorizontal: 12, paddingVertical: 6,
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        borderTopWidth: 1, borderTopColor: '#f1f5f9'
    },
    supervisorBox: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    supervisorText: { fontSize: 10, color: '#64748b', fontWeight: '600' },
    detailBtn: { flexDirection: 'row', alignItems: 'center', gap: 2 },
    detailBtnText: { fontSize: 10, color: BLUE, fontWeight: '700' },

    switcher: { backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
    tabWrapper: { flexDirection: 'row', paddingHorizontal: 12 },
    tab: {
        flex: 1, paddingVertical: 10, alignItems: 'center', justifyContent: 'center',
        flexDirection: 'row', gap: 6, borderBottomWidth: 2, borderBottomColor: 'transparent'
    },
    tabActive: { borderBottomColor: BLUE, backgroundColor: '#f0f7ff' },
    tabText: { fontSize: 12, color: '#94a3b8', fontWeight: '700' },
    tabTextActive: { color: BLUE },
    
    // CSS DÀNH CHO LABEL RỚT GIỮA KỲ BÊN TRONG TAB
    failedBadge: { backgroundColor: '#fee2e2', paddingHorizontal: 4, paddingVertical: 2, borderRadius: 4, marginLeft: 4 },
    failedBadgeText: { fontSize: 8, fontWeight: '800', color: '#dc2626' },

    statsCard: {
        flexDirection: 'row', margin: 12, padding: 12, backgroundColor: '#fff',
        borderRadius: 12, borderWidth: 1, borderColor: '#f1f5f9', alignItems: 'center',
        shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.02, shadowRadius: 4, elevation: 1,
    },
    statsCol: { flex: 1, alignItems: 'center' },
    statsLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4 },
    statsLabel: { fontSize: 9, fontWeight: '800', color: '#94a3b8', letterSpacing: 0.5 },
    statsValue: { fontSize: 24, fontWeight: '900', color: '#0f172a' },
    statsMax: { fontSize: 12, fontWeight: '600', color: '#cbd5e1' },
    statsDivider: { width: 1, height: 30, backgroundColor: '#f1f5f9' },
    gradeBadge: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 8 },
    gradeBadgeText: { fontSize: 12, fontWeight: '900', textTransform: 'uppercase' },

    sectionHeader: { paddingHorizontal: 12, paddingTop: 8, paddingBottom: 6, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    sectionTitle: { fontSize: 11, fontWeight: '800', color: '#64748b', letterSpacing: 0.5 },
    badge: { backgroundColor: '#e2e8f0', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
    badgeText: { fontSize: 9, color: '#475569', fontWeight: '700' },

    criteriaContainer: { paddingHorizontal: 12, gap: 8 },
    criterionCard: {
        backgroundColor: '#fff', padding: 8, borderRadius: 10,
        borderWidth: 1, borderColor: '#f1f5f9',
        shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.01, shadowRadius: 1, elevation: 1
    },
    criterionMain: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
    criterionInfo: { flex: 1, marginRight: 8 },
    criterionTitleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 0, flexWrap: 'wrap' },
    criterionName: { fontSize: 13, fontWeight: '700', color: '#334155', lineHeight: 18, flexShrink: 1 },
    modifiedDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#f59e0b', marginLeft: 6 },
    criterionDesc: { fontSize: 10, color: '#94a3b8', lineHeight: 14 },
    scoreInputGroup: { flexDirection: 'row', alignItems: 'center', minWidth: 78, justifyContent: 'flex-end' },
    input: {
        width: 44, height: 32, backgroundColor: '#f8fafc', borderTopLeftRadius: 6, borderBottomLeftRadius: 6,
        borderWidth: 1, borderColor: '#e2e8f0', textAlign: 'center', fontSize: 14, fontWeight: '800', color: '#1e293b',
        paddingVertical: 0, paddingHorizontal: 0, textAlignVertical: 'center'
    },
    inputFilled: { color: BLUE, borderColor: BLUE, backgroundColor: '#f0f7ff' },
    maxBadge: {
        height: 32, paddingHorizontal: 6, backgroundColor: '#f1f5f9',
        borderTopRightRadius: 6, borderBottomRightRadius: 6,
        justifyContent: 'center', borderWidth: 1, borderLeftWidth: 0, borderColor: '#e2e8f0'
    },
    maxBadgeText: { fontSize: 10, fontWeight: '700', color: '#94a3b8' },

    commentSection: { padding: 12, marginTop: 4 },
    commentHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
    commentLabel: { fontSize: 10, fontWeight: '800', color: '#64748b' },
    commentInput: {
        backgroundColor: '#fff', borderRadius: 12, padding: 12, minHeight: 80,
        fontSize: 13, color: '#334155', borderWidth: 1, borderColor: '#e2e8f0', lineHeight: 18
    },

    commentInputWrapper: {
        marginTop: 8,
        paddingTop: 8,
        borderTopWidth: 1,
        borderTopColor: '#f1f5f9',
    },
    commentInputHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 4,
    },
    commentInputLabel: {
        fontSize: 10,
        fontWeight: '700',
        color: '#64748b',
    },
    removeCommentText: {
        fontSize: 10,
        fontWeight: '700',
        color: '#ef4444',
    },
    criterionCommentInput: {
        backgroundColor: '#f8fafc',
        borderRadius: 6,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        paddingHorizontal: 8,
        paddingVertical: 6,
        fontSize: 12,
        color: '#334155',
        minHeight: 40,
        maxHeight: 100,
    },
    addCommentBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 4,
        alignSelf: 'flex-start',
    },
    addCommentBtnText: {
        fontSize: 10,
        fontWeight: '700',
        color: BLUE,
    },

    footer: {
        flexDirection: 'row', padding: 12, backgroundColor: '#fff',
        borderTopWidth: 1, borderTopColor: '#f1f5f9', gap: 10,
        paddingBottom: Platform.OS === 'ios' ? 24 : 12,
        shadowColor: '#000', shadowOffset: { width: 0, height: -2 }, shadowOpacity: 0.03, shadowRadius: 4, elevation: 5
    },
    draftBtn: {
        flex: 1, height: 44, borderRadius: 10, borderWidth: 1.5, borderColor: BLUE,
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6
    },
    draftBtnText: { color: BLUE, fontSize: 14, fontWeight: '700' },
    submitBtn: {
        flex: 1, height: 44, borderRadius: 10, backgroundColor: BLUE,
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6
    },
    disabledSubmitBtn: { backgroundColor: '#e2e8f0' },
    submitBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
    disabledInput: { backgroundColor: '#f8fafc', color: '#94a3b8' },
    historySection: { padding: 12, marginTop: 4, borderTopWidth: 1, borderTopColor: '#f1f5f9' },
    historyItem: { flexDirection: 'row', gap: 12, paddingBottom: 12, borderLeftWidth: 1, borderLeftColor: '#f1f5f9', marginLeft: 6, paddingLeft: 16 },
    historyPoint: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#f59e0b', position: 'absolute', left: -4, top: 4 },
    historyText: { fontSize: 12, color: '#334155', lineHeight: 18 },
    historyChange: { fontSize: 11, color: '#64748b', marginTop: 2 },
    historyDate: { fontSize: 10, color: '#94a3b8', marginTop: 4 }
});