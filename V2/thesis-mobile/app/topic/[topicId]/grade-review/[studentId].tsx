import React from 'react';
import {
    View, Text, ScrollView, TouchableOpacity,
    StyleSheet, ActivityIndicator, StatusBar, LayoutAnimation, Platform, UIManager, Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { 
    ChevronLeft, ChevronRight, ChevronDown, CheckCircle2, 
    GraduationCap, Lock, Clock, Edit3, AlertCircle,
    User, Users, Award, Info, FileText
} from 'lucide-react-native';
import { useTopic } from '@/hooks/useTopics';
import { useAuthStore } from '@/store/auth';
import { useGradingCriteria } from '@/hooks/useGrading';
import { GradingApi } from '@/api/grading';
import { Grade, FinalScore } from '@/types';
import { useQueryClient } from '@tanstack/react-query';

interface TopicGradesResponse {
    advisorGrades: any[];
    reviewerGrades: any[];
    councilGrades: any[];
    finalScores: FinalScore[];
    gradingStatus?: any;
    gradeHistory?: any[];
}

function SummaryBreakdown({ data, studentId, criteriaRes }: any) {
    const [expandedSections, setExpandedSections] = React.useState<string[]>(['ADVISOR', 'REVIEWER', 'COUNCIL', 'EXTRA']);

    const toggleSection = (section: string) => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setExpandedSections(prev => 
            prev.includes(section) ? prev.filter(s => s !== section) : [...prev, section]
        );
    };

    const calculateWeightedAverage = (grades: any[], role: string) => {
        if (!grades || grades.length === 0 || !criteriaRes) return 0;
        
        let roleKey = 'REVIEWER';
        if (role === 'SUPERVISOR' || role === 'ADVISOR') roleKey = 'SUPERVISOR';
        else if (role.startsWith('COMMITTEE') || role === 'COUNCIL' || role === 'COMMITTEE') roleKey = 'COMMITTEE';
        
        const criteria = criteriaRes[roleKey] || criteriaRes.FINAL || [];
        if (criteria.length === 0) return 0;

        const total = grades.reduce((acc, g) => {
            const criterion = criteria.find((c: any) => c.id === g.criterion_id);
            return acc + (g.score * (criterion?.weight || 0));
        }, 0);
        const max = grades.reduce((acc, g) => {
            const criterion = criteria.find((c: any) => c.id === g.criterion_id);
            return acc + ((criterion?.max_score || 10) * (criterion?.weight || 0));
        }, 0);
        return max > 0 ? (total / max) * 10 : 0;
    };

    const advisor = data.advisorGrades?.filter((g: any) => g.student_id === studentId || !g.student_id)[0];
    const reviewers = data.reviewerGrades?.filter((g: any) => g.student_id === studentId || !g.student_id);
    const council = data.councilGrades?.filter((g: any) => g.student_id === studentId || !g.student_id);
    const finalScore = data.finalScores?.find((fs: any) => fs.student_id === studentId);

    const advisorScore = advisor ? calculateWeightedAverage(advisor.scores, 'SUPERVISOR') : 0;
    
    return (
        <View style={styles.summaryContainer}>
            {/* 1. ĐIỂM GV HƯỚNG DẪN */}
            <View style={styles.summarySection}>
                <TouchableOpacity 
                    style={styles.summarySectionHeader} 
                    onPress={() => toggleSection('ADVISOR')}
                    activeOpacity={0.7}
                >
                    <View style={[styles.sectionIndicator, { backgroundColor: BLUE }]} />
                    <Text style={styles.summarySectionTitle}>1. ĐIỂM GV HƯỚNG DẪN</Text>
                    <View style={{ flex: 1 }} />
                    {expandedSections.includes('ADVISOR') ? <ChevronDown size={16} color="#94a3b8" /> : <ChevronRight size={16} color="#94a3b8" />}
                </TouchableOpacity>
                {expandedSections.includes('ADVISOR') && (
                    <View style={styles.summaryCard}>
                        <View style={styles.summaryCardBody}>
                            <View style={styles.raterIconBox}>
                                <Text style={styles.raterIconText}>T</Text>
                            </View>
                            <Text style={styles.raterName}>{advisor?.rater_name || 'GV Hướng dẫn'}</Text>
                            <Text style={styles.raterScore}>{advisorScore.toFixed(2)}</Text>
                        </View>
                    </View>
                )}
            </View>

            {/* 2. ĐIỂM PHẢN BIỆN */}
            <View style={styles.summarySection}>
                <TouchableOpacity 
                    style={styles.summarySectionHeader} 
                    onPress={() => toggleSection('REVIEWER')}
                    activeOpacity={0.7}
                >
                    <View style={[styles.sectionIndicator, { backgroundColor: '#16a34a' }]} />
                    <Text style={styles.summarySectionTitle}>2. ĐIỂM PHẢN BIỆN</Text>
                    <View style={{ flex: 1 }} />
                    {expandedSections.includes('REVIEWER') ? <ChevronDown size={16} color="#94a3b8" /> : <ChevronRight size={16} color="#94a3b8" />}
                </TouchableOpacity>
                {expandedSections.includes('REVIEWER') && (
                    <View style={{ gap: 10 }}>
                        {reviewers?.map((r: any, idx: number) => (
                            <View key={r.rater_id || idx} style={styles.summaryCard}>
                                <View style={styles.summaryCardBody}>
                                    <View style={[styles.raterIconBox, { backgroundColor: '#f0fdf4' }]}>
                                        <Text style={[styles.raterIconText, { color: '#16a34a' }]}>PB{idx + 1}</Text>
                                    </View>
                                    <Text style={styles.raterName}>{r.rater_name}</Text>
                                    <Text style={[styles.raterScore, { color: '#16a34a' }]}>{calculateWeightedAverage(r.scores, 'REVIEWER').toFixed(2)}</Text>
                                </View>
                            </View>
                        ))}
                        {(!reviewers || reviewers.length === 0) && (
                            <Text style={{ fontSize: 12, color: '#94a3b8', textAlign: 'center', fontStyle: 'italic' }}>Chưa có điểm phản biện</Text>
                        )}
                    </View>
                )}
            </View>

            {/* 3. ĐIỂM HỘI ĐỒNG */}
            <View style={styles.summarySection}>
                <TouchableOpacity 
                    style={styles.summarySectionHeader} 
                    onPress={() => toggleSection('COUNCIL')}
                    activeOpacity={0.7}
                >
                    <View style={[styles.sectionIndicator, { backgroundColor: '#6366f1' }]} />
                    <Text style={styles.summarySectionTitle}>3. ĐIỂM HỘI ĐỒNG</Text>
                    <View style={{ flex: 1 }} />
                    {expandedSections.includes('COUNCIL') ? <ChevronDown size={16} color="#94a3b8" /> : <ChevronRight size={16} color="#94a3b8" />}
                </TouchableOpacity>
                {expandedSections.includes('COUNCIL') && (
                    <View style={{ gap: 10 }}>
                        {council?.map((c: any, idx: number) => (
                            <View key={c.rater_id || idx} style={styles.summaryCard}>
                                <View style={styles.summaryCardBody}>
                                    <View style={[styles.raterIconBox, { backgroundColor: '#eef2ff' }]}>
                                        <Text style={[styles.raterIconText, { color: '#6366f1' }]}>T</Text>
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.raterName}>{c.rater_name}</Text>
                                        <Text style={styles.raterSubRole}>{c.rater_role === 'COMMITTEE_CHAIR' ? 'CHỦ TỊCH' : c.rater_role === 'COMMITTEE_SECRETARY' ? 'THƯ KÝ' : 'ỦY VIÊN'}</Text>
                                    </View>
                                    <Text style={[styles.raterScore, { color: '#6366f1' }]}>{calculateWeightedAverage(c.scores, 'COMMITTEE').toFixed(2)}</Text>
                                </View>
                            </View>
                        ))}
                        {(!council || council.length === 0) && (
                            <Text style={{ fontSize: 12, color: '#94a3b8', textAlign: 'center', fontStyle: 'italic' }}>Chưa có điểm hội đồng</Text>
                        )}
                    </View>
                )}
            </View>

            {/* 4. ĐIỂM CỘNG */}
            <View style={styles.summarySection}>
                <TouchableOpacity 
                    style={styles.summarySectionHeader} 
                    onPress={() => toggleSection('EXTRA')}
                    activeOpacity={0.7}
                >
                    <View style={[styles.sectionIndicator, { backgroundColor: '#f59e0b' }]} />
                    <Text style={styles.summarySectionTitle}>4. ĐIỂM THƯỞNG NCKH</Text>
                    <View style={{ flex: 1 }} />
                    {expandedSections.includes('EXTRA') ? <ChevronDown size={16} color="#94a3b8" /> : <ChevronRight size={16} color="#94a3b8" />}
                </TouchableOpacity>
                {expandedSections.includes('EXTRA') && (
                    <View style={styles.summaryCard}>
                        <View style={styles.summaryCardBody}>
                            <View style={[styles.raterIconBox, { backgroundColor: '#fffbeb' }]}>
                                <Award size={18} color="#f59e0b" />
                            </View>
                            <Text style={styles.raterName}>Điểm thưởng thành tích</Text>
                            <Text style={[styles.raterScore, { color: '#f59e0b' }]}>{(finalScore?.extra_points || 0).toFixed(2)}</Text>
                        </View>
                    </View>
                )}
            </View>
        </View>
    );
}

function RoleChip({ label, active, onPress, icon }: any) {
    return (
        <TouchableOpacity 
            style={[styles.roleChip, active && styles.roleChipActive]} 
            onPress={onPress}
        >
            {icon}
            <Text style={[styles.roleChipText, active && styles.roleChipTextActive]}>{label}</Text>
        </TouchableOpacity>
    );
}

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
}

const BLUE = '#2563eb';
const LIGHT_BLUE = '#eff6ff';
// Hệ thống xếp loại mới (đồng bộ với web GradeBreakdown)
const getClassification = (score: number) => {
    if (score >= 9.0) return { letter: 'A+', point4: '4.0', status: 'Đạt', color: '#7c3aed' };
    if (score >= 8.5) return { letter: 'A',  point4: '3.8', status: 'Đạt', color: '#2563eb' };
    if (score >= 8.0) return { letter: 'B+', point4: '3.5', status: 'Đạt', color: '#3b82f6' };
    if (score >= 7.0) return { letter: 'B',  point4: '3.0', status: 'Đạt', color: '#16a34a' };
    if (score >= 6.0) return { letter: 'C+', point4: '2.5', status: 'Đạt', color: '#22c55e' };
    if (score >= 5.5) return { letter: 'C',  point4: '2.0', status: 'Không đạt', color: '#ef4444' };
    if (score >= 5.0) return { letter: 'D+', point4: '1.5', status: 'Không đạt', color: '#ef4444' };
    if (score >= 4.0) return { letter: 'D',  point4: '1.0', status: 'Không đạt', color: '#ef4444' };
    return { letter: 'F', point4: '0.0', status: 'Không đạt', color: '#dc2626' };
};

export default function GradeReviewScreen() {
    const { topicId, studentId: initialStudentId, groupId } = useLocalSearchParams();
    const router = useRouter();
    const { user: currentUser } = useAuthStore();
    
    const { data: topic, isLoading: isTopicLoading } = useTopic(topicId as string);
    const [selectedStudentId, setSelectedStudentId] = React.useState(initialStudentId as string);
    
    const [topicGradesData, setTopicGradesData] = React.useState<TopicGradesResponse | null>(null);
    const [isInitialLoading, setIsInitialLoading] = React.useState(true);
    const [isSubmitting, setIsSubmitting] = React.useState(false);
    const [viewRole, setViewRole] = React.useState<'SUMMARY' | 'SUPERVISOR' | 'REVIEWER' | 'COMMITTEE'>('SUMMARY');
    const [topicTitleExpanded, setTopicTitleExpanded] = React.useState(false);

    const queryClient = useQueryClient();

    const isHead = currentUser?.role === 'HEAD';
    
    const canGrade = React.useMemo(() => {
        if (!topic) return false;
        if (isHead) return false;
        if (topic.status === 'FINALIZED') return false;
        if (topic.supervisor_id === currentUser?.id) return true;
        return topic.assignments?.some(a => a.reviewer_id === currentUser?.id);
    }, [topic, currentUser, isHead]);

    React.useEffect(() => {
        if (isHead) setViewRole('SUMMARY');
        else {
            if (topic) {
                if (topic.supervisor_id === currentUser?.id) setViewRole('SUPERVISOR');
                else {
                    const assignment = topic.assignments?.find(a => a.reviewer_id === currentUser?.id);
                    if (assignment?.assignment_type === 'REVIEWER') setViewRole('REVIEWER');
                    else if (assignment?.assignment_type === 'COMMITTEE') setViewRole('COMMITTEE');
                }
            }
        }
    }, [isHead, topic, currentUser?.id]);

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
        // Fetch all criteria for this topic (grouped by role) to support the SummaryBreakdown view
        topicId: (topicId as string) || undefined
    });

    const criteriaList = React.useMemo(() => {
        if (!criteriaRes) return [];
        if (Array.isArray(criteriaRes)) return criteriaRes;
        
        const data = criteriaRes as any;
        let roleKey = 'REVIEWER';
        if (raterRole === 'SUPERVISOR' || raterRole === 'ADVISOR') roleKey = 'SUPERVISOR';
        else if (raterRole.startsWith('COMMITTEE') || raterRole.includes('COUNCIL')) roleKey = 'COMMITTEE';
        
        return data[roleKey] || data.FINAL || Object.values(data)[0] || [];
    }, [criteriaRes, raterRole]);

    const students = React.useMemo(() => {
        const all = topic?.students || [];
        const effectiveGroupId = groupId || topicId;
        if (!effectiveGroupId) return all;

        return all.filter((s: any) => {
            const sGroupId = s.groupId || s.group_id;
            return sGroupId === effectiveGroupId || (!sGroupId && !effectiveGroupId) || (effectiveGroupId && sGroupId === effectiveGroupId);
        });
    }, [topic?.students, groupId, topicId]);

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

        const flattenGrades = (grouped: any[]) => {
            const flattened: Grade[] = [];
            grouped.forEach(group => {
                if (group.student_id === selectedStudentId || !group.student_id) {
                    group.scores?.forEach((s: any) => {
                        flattened.push({
                            criterion_id: s.criterion_id,
                            score: s.score,
                            comments: s.comment,
                            grader_id: group.rater_id,
                            rater_role: group.rater_role,
                            graded_at: group.submitted_at,
                            student_id: group.student_id,
                            grader: { full_name: group.rater_name } as any
                        } as Grade);
                    });
                }
            });
            return flattened;
        };

        const flattenedAdvisor = flattenGrades(topicGradesData.advisorGrades || []);
        const flattenedReviewer = flattenGrades(topicGradesData.reviewerGrades || []);
        const flattenedCouncil = flattenGrades(topicGradesData.councilGrades || []);

        const allGrades = [...flattenedAdvisor, ...flattenedReviewer, ...flattenedCouncil];
        const myGrades = allGrades.filter(g => g.grader_id === currentUser?.id);
        const studentGrades = allGrades;
        
        const rawFinalScore = topicGradesData.finalScores?.find((fs: any) => fs.student_id === selectedStudentId);
        const finalScore = rawFinalScore ? {
            ...rawFinalScore,
            final_score: rawFinalScore.final_score ?? rawFinalScore.total_score ?? 0,
            // Ngưỡng đạt 6.0 (đồng bộ web)
            result: rawFinalScore.result || ((rawFinalScore.final_score ?? rawFinalScore.total_score ?? 0) >= 6.0 ? 'PASS' : 'FAIL')
        } : undefined;

        const isSummaryMode = viewRole === 'SUMMARY';
        
        let gradesToDisplay: Grade[] = [];
        if (isSummaryMode) {
            gradesToDisplay = (myGrades.length > 0) ? myGrades : studentGrades;
        } else if (viewRole === 'SUPERVISOR') {
            gradesToDisplay = flattenedAdvisor;
        } else if (viewRole === 'REVIEWER') {
            gradesToDisplay = flattenedReviewer;
        } else if (viewRole === 'COMMITTEE') {
            gradesToDisplay = flattenedCouncil;
        }

        const firstGrade = gradesToDisplay[0];
        
        const gradedItems = criteriaList.map((c: any) => {
            const g = gradesToDisplay.find((grade: Grade) => grade.criterion_id === c.id);
            // Consider modified if updatedAt is at least 1 second after createdAt
            const up = g?.updated_at || (g as any)?.updatedAt;
            const cr = g?.created_at || (g as any)?.createdAt;
            const isModified = g && up && cr && new Date(up).getTime() > new Date(cr).getTime() + 1000;
            return { criterion: c, score: g?.score ?? 0, isGraded: !!g, isModified };
        });

        const totalScoreValue = gradedItems.reduce((acc: number, item: any) => acc + (item.score * (item.criterion.weight || 0)), 0);
        const maxPossibleValue = gradedItems.reduce((acc: number, item: any) => acc + ((item.criterion.max_score || 10) * (item.criterion.weight || 0)), 0);
        const calculatedScore10 = maxPossibleValue > 0 ? (totalScoreValue / maxPossibleValue) * 10 : 0;
        
        const score10 = (isSummaryMode && finalScore?.final_score !== undefined) ? finalScore.final_score : calculatedScore10;
        
        return {
            isSummary: isSummaryMode,
            view_role: viewRole,
            rater_role: isSummaryMode ? 'SUMMARY' : (firstGrade?.rater_role || viewRole),
            rater_name: isSummaryMode ? 'Tổng hợp kết quả' : (firstGrade?.grader?.full_name || `Dữ liệu ${viewRole}`),
            graded_at: isSummaryMode ? finalScore?.created_at : firstGrade?.graded_at,
            items: gradedItems,
            totalScore: score10,
            finalScore: finalScore as FinalScore | undefined,
            isReadyForDecision: !!topicGradesData.gradingStatus?.isReadyForDecision,
            gradingStatus: topicGradesData.gradingStatus,
            generalComment: isSummaryMode ? '' : (firstGrade?.comments || ''),
            gradeHistory: topicGradesData.gradeHistory || []
        };
    }, [topicGradesData, criteriaList, selectedStudentId, currentUser, viewRole]);

    const roleDisplay = React.useMemo(() => {
        if (raterRole === 'SUPERVISOR') return 'GV hướng dẫn';
        if (raterRole === 'COMMITTEE_CHAIR') return 'Chủ tịch HĐ';
        if (raterRole === 'COMMITTEE_SECRETARY') return 'Thư ký HĐ';
        if (raterRole.startsWith('COMMITTEE')) return 'Thành viên HĐ';
        return 'GV phản biện';
    }, [raterRole]);

    if (isTopicLoading || isInitialLoading || isLoadingCriteria || !topic) {
        return (
            <SafeAreaView style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={BLUE} />
            </SafeAreaView>
        );
    }

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

            {isHead && (topic?.status !== 'FINALIZED' && !reviewData?.finalScore?.finalized) && (
                <View style={styles.phaseWarning}>
                    <AlertCircle size={18} color="#92400e" />
                    <View style={{ flex: 1, marginLeft: 8 }}>
                        <Text style={styles.phaseWarningTitle}>Chưa thể khóa điểm</Text>
                        <Text style={styles.phaseWarningText}>Hệ thống đang chờ hoàn tất điểm từ các bên khác trước khi chốt.</Text>
                    </View>
                </View>
            )}

            {/* View Role Selector (HOD Only) */}
            {isHead && (
                <View style={styles.roleSelector}>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.roleSelectorScroll}>
                        <RoleChip 
                            label="TỔNG KẾT" 
                            active={viewRole === 'SUMMARY'} 
                            onPress={() => setViewRole('SUMMARY')} 
                            icon={<Award size={14} color={viewRole === 'SUMMARY' ? '#fff' : BLUE} />}
                        />
                        <RoleChip 
                            label="GVHD" 
                            active={viewRole === 'SUPERVISOR'} 
                            onPress={() => setViewRole('SUPERVISOR')} 
                            icon={<User size={14} color={viewRole === 'SUPERVISOR' ? '#fff' : '#64748b'} />}
                        />
                        <RoleChip 
                            label="PHẢN BIỆN" 
                            active={viewRole === 'REVIEWER'} 
                            onPress={() => setViewRole('REVIEWER')} 
                            icon={<Users size={14} color={viewRole === 'REVIEWER' ? '#fff' : '#64748b'} />}
                        />
                        <RoleChip 
                            label="HỘI ĐỒNG" 
                            active={viewRole === 'COMMITTEE'} 
                            onPress={() => setViewRole('COMMITTEE')} 
                            icon={<GraduationCap size={14} color={viewRole === 'COMMITTEE' ? '#fff' : '#64748b'} />}
                        />
                    </ScrollView>
                </View>
            )}

            <View style={styles.switcher}>
                <View style={styles.tabWrapper}>
                    {students.map((sv: any) => (
                        <TouchableOpacity
                            key={sv.id}
                            style={[styles.tab, sv.id === selectedStudentId && styles.tabActive]}
                            onPress={() => {
                                setSelectedStudentId(sv.id);
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
                                <TouchableOpacity onPress={() => setTopicTitleExpanded(!topicTitleExpanded)}>
                                    <Text style={styles.topicCardTitle} numberOfLines={topicTitleExpanded ? undefined : 2}>{topic.title}</Text>
                                </TouchableOpacity>
                                <View style={styles.topicInfoGrid}>
                                    <View style={styles.topicInfoItem}>
                                        {reviewData?.isSummary ? <User size={12} color={BLUE} /> : <Clock size={12} color="#94a3b8" />}
                                        <Text style={[styles.topicInfoText, reviewData?.isSummary && { color: BLUE, fontWeight: '700' }]}>
                                            {reviewData?.isSummary 
                                                ? `Người chấm: ${reviewData.rater_name || 'Giảng viên'}` 
                                                : (reviewData?.graded_at ? new Date(reviewData.graded_at).toLocaleDateString('vi-VN') : 'Đang chấm')}
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

                {reviewData?.finalScore && (
                    <View style={{ paddingHorizontal: 16, marginBottom: 16 }}>
                        <View style={[styles.statsCard, { marginHorizontal: 0, marginBottom: 0, backgroundColor: '#f0f9ff', borderColor: '#bae6fd' }]}>
                            <View style={styles.statsCol}>
                                <View style={styles.statsLabelRow}>
                                    <Award size={14} color={BLUE} />
                                    <Text style={[styles.statsLabel, { color: BLUE }]}>ĐIỂM TỔNG KẾT</Text>
                                </View>
                                <Text style={[styles.statsValue, { color: BLUE }]}>
                                    {(reviewData.finalScore.final_score ?? reviewData.finalScore.total_score)?.toFixed(1) || '0.0'}
                                    <Text style={[styles.statsMax, { color: '#93c5fd' }]}> / 10</Text>
                                </Text>
                                <Text style={{ fontSize: 11, color: BLUE, fontWeight: '700', marginTop: 2 }}>
                                    Thang 4: {getClassification(reviewData.finalScore.final_score ?? reviewData.finalScore.total_score ?? 0).point4}
                                </Text>
                            </View>
                            <View style={[styles.statsDivider, { backgroundColor: '#e0f2fe' }]} />
                            <View style={styles.statsCol}>
                                <View style={styles.statsLabelRow}>
                                    <Info size={14} color="#64748b" />
                                    <Text style={[styles.statsLabel, { color: '#64748b' }]}>XẾP LOẠI</Text>
                                </View>
                                {(() => {
                                    const finalVal = reviewData.finalScore.final_score ?? reviewData.finalScore.total_score ?? 0;
                                    const cls = getClassification(finalVal);
                                    const letter = reviewData.finalScore.grade_classification || cls.letter;
                                    const isPass = cls.status === 'Đạt';
                                    return (
                                        <View style={{ alignItems: 'center', gap: 4 }}>
                                            <View style={[styles.gradeBadge, { backgroundColor: isPass ? '#dcfce7' : '#fee2e2' }]}>
                                                <Text style={[styles.gradeBadgeText, { color: isPass ? '#166534' : '#991b1b', fontSize: 14, fontWeight: '900' }]}>
                                                    {letter}
                                                </Text>
                                            </View>
                                            <Text style={{ fontSize: 10, fontWeight: '800', color: isPass ? '#16a34a' : '#dc2626', marginTop: 2 }}>
                                                {isPass ? 'Đạt' : 'Không đạt'}
                                            </Text>
                                        </View>
                                    );
                                })()}
                            </View>
                        </View>
                    </View>
                )}

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
                                    <Text style={styles.statsLabel}>ĐIỂM TRUNG BÌNH</Text>
                                </View>
                                <Text style={styles.statsValue}>
                                    {reviewData.totalScore.toFixed(1)} 
                                    <Text style={styles.statsMax}> / 10</Text>
                                </Text>
                                <Text style={{ fontSize: 11, color: '#64748b', fontWeight: '700', marginTop: 2 }}>
                                    Thang 4: {getClassification(reviewData.totalScore).point4}
                                </Text>
                            </View>
                            <View style={styles.statsDivider} />
                            <View style={styles.statsCol}>
                                <View style={styles.statsLabelRow}>
                                    <Info size={14} color="#94a3b8" />
                                    <Text style={styles.statsLabel}>XẾP LOẠI</Text>
                                </View>
                                {(() => {
                                    const cls = getClassification(reviewData.totalScore);
                                    const isPass = cls.status === 'Đạt';
                                    return (
                                        <View style={{ alignItems: 'center', gap: 4 }}>
                                            <View style={[styles.gradeBadge, { backgroundColor: isPass ? '#dcfce7' : '#fee2e2' }]}>
                                                <Text style={[styles.gradeBadgeText, { color: isPass ? '#166534' : '#991b1b', fontSize: 14, fontWeight: '900' }]}>
                                                    {cls.letter}
                                                </Text>
                                            </View>
                                            <Text style={{ fontSize: 10, fontWeight: '800', color: isPass ? '#16a34a' : '#dc2626', marginTop: 2 }}>
                                                {isPass ? 'Đạt' : 'Không đạt'}
                                            </Text>
                                        </View>
                                    );
                                })()}
                            </View>
                        </View>

                        {reviewData.isSummary ? (
                            <SummaryBreakdown 
                                data={topicGradesData} 
                                studentId={selectedStudentId} 
                                criteriaRes={criteriaRes}
                            />
                        ) : (
                            <>
                                <View style={styles.sectionHeader}>
                                    <Text style={styles.sectionTitle}>CHI TIẾT ĐIỂM THÀNH PHẦN</Text>
                                </View>

                                <View style={styles.criteriaContainer}>
                                    {reviewData?.items.map((item: any, i: number) => (
                                        <View key={item.criterion.id} style={styles.criterionCard}>
                                            <View style={styles.criterionMain}>
                                                <View style={styles.criterionInfo}>
                                                    <View style={styles.criterionTitleRow}>
                                                        <Text style={styles.criterionName}>
                                                            {i + 1}. {item.criterion.name}
                                                        </Text>
                                                    </View>
                                                </View>
                                                <View style={styles.scoreContainer}>
                                                    <Text style={styles.itemScore}>{item.score.toFixed(1)}</Text>
                                                    <Text style={styles.itemMax}>/{item.criterion.max_score}</Text>
                                                </View>
                                            </View>
                                        </View>
                                    ))}
                                </View>
                            </>
                        )}

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

                        {reviewData.gradeHistory && reviewData.gradeHistory.length > 0 && (
                            <View style={[styles.summarySection, { padding: 16, marginTop: 10 }]}>
                                <View style={styles.summarySectionHeader}>
                                    <View style={[styles.sectionIndicator, { backgroundColor: '#f59e0b' }]} />
                                    <Text style={styles.summarySectionTitle}>LỊCH SỬ CHỈNH SỬA</Text>
                                </View>
                                <View style={{ gap: 8, marginTop: 10 }}>
                                    {reviewData.gradeHistory.map((h: any) => (
                                        <View key={h.id} style={styles.historyItem}>
                                            <View style={styles.historyPoint} />
                                            <View style={{ flex: 1 }}>
                                                <Text style={styles.historyText}>
                                                    <Text style={{ fontWeight: '700' }}>{h.graderName}</Text> đã sửa điểm 
                                                    <Text style={{ color: BLUE }}> {h.criterionName}</Text> cho 
                                                    <Text style={{ fontWeight: '600' }}> {h.studentName}</Text>
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
                    </>
                )}
                <View style={{ height: 120 }} />
            </ScrollView>

            <View style={styles.footer}>
                {!reviewData?.finalScore?.finalized && (
                    <>
                        {canGrade && (
                            <TouchableOpacity 
                                style={styles.editBtn} 
                                onPress={() => router.push(`/topic/${topicId}/grading/${selectedStudentId}?groupId=${groupId || ''}` as any)}
                            >
                                <Edit3 size={18} color={BLUE} />
                                <Text style={styles.editBtnText}>Chỉnh sửa</Text>
                            </TouchableOpacity>
                        )}
                        
                        {isHead && reviewData?.isReadyForDecision && (
                            <TouchableOpacity 
                                style={[styles.finalizeBtn, isSubmitting && styles.finalizeBtnDisabled]} 
                                disabled={isSubmitting}
                                onPress={async () => {
                                    if (isSubmitting) return;
                                    Alert.alert(
                                        'Xác nhận chốt điểm',
                                        'Sau khi chốt điểm, tất cả điểm số sẽ được công bố và không thể chỉnh sửa. Bạn có chắc chắn?',
                                        [
                                            { text: 'Hủy', style: 'cancel' },
                                            { 
                                                text: 'Đồng ý', 
                                                onPress: async () => {
                                                    setIsSubmitting(true);
                                                    try {
                                                        await GradingApi.finalizeGrades(topicId as string);
                                                        queryClient.invalidateQueries({ queryKey: ['grade-summary'] });
                                                        queryClient.invalidateQueries({ queryKey: ['topic-grades', topicId] });
                                                        Alert.alert('Thành công', 'Đã chốt điểm thành công cho đề tài.');
                                                        router.back();
                                                    } catch (err: any) {
                                                        Alert.alert('Lỗi', err.message || 'Không thể chốt điểm');
                                                    } finally {
                                                        setIsSubmitting(false);
                                                    }
                                                }
                                            }
                                        ]
                                    );
                                }}
                            >
                                {isSubmitting ? <ActivityIndicator color="#fff" /> : <CheckCircle2 size={18} color="#fff" />}
                                <Text style={styles.finalizeBtnText}>CHỐT ĐIỂM CUỐI CÙNG</Text>
                            </TouchableOpacity>
                        )}
                    </>
                )}
                {reviewData?.finalScore?.finalized && (
                    <View style={styles.finalizedBadge}>
                        <Lock size={16} color="#64748b" />
                        <Text style={styles.finalizedBadgeText}>ĐIỂM ĐÃ ĐƯỢC KHÓA (CHỐT)</Text>
                    </View>
                )}
            </View>
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
    topicCardBody: { padding: 10, flexDirection: 'row', gap: 10 },
    topicIconBox: { width: 32, height: 32, borderRadius: 8, backgroundColor: LIGHT_BLUE, alignItems: 'center', justifyContent: 'center' },
    topicCardTitle: { fontSize: 13, fontWeight: '700', color: '#1e293b', lineHeight: 18 },
    topicInfoGrid: { flexDirection: 'row', gap: 16, marginTop: 8 },
    topicInfoItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    topicInfoText: { fontSize: 12, color: '#94a3b8', fontWeight: '500' },

    statsCard: {
        flexDirection: 'row', marginHorizontal: 12, marginBottom: 12, padding: 12, backgroundColor: '#fff',
        borderRadius: 12, borderWidth: 1, borderColor: '#f1f5f9', alignItems: 'center',
        shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.02, shadowRadius: 4, elevation: 1,
    },
    statsCol: { flex: 1, alignItems: 'center' },
    statsLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4 },
    statsLabel: { fontSize: 9, fontWeight: '800', color: '#94a3b8', letterSpacing: 0.5 },
    statsValue: { fontSize: 24, fontWeight: '900', color: '#0f172a' },
    statsMax: { fontSize: 12, fontWeight: '600', color: '#cbd5e1' },
    statsDivider: { width: 1, height: 30, backgroundColor: '#f1f5f9' },
    gradeBadge: { backgroundColor: '#f1f5f9', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 8 },
    gradeBadgeText: { fontSize: 12, fontWeight: '900', color: '#475569' },

    sectionHeader: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12 },
    sectionTitle: { fontSize: 12, fontWeight: '800', color: '#64748b', letterSpacing: 1 },

    criteriaContainer: { paddingHorizontal: 12, gap: 6 },
    criterionCard: {
        backgroundColor: '#fff', padding: 8, borderRadius: 10,
        borderWidth: 1, borderColor: '#f1f5f9',
    },
    criterionMain: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
    criterionInfo: { flex: 1 },
    criterionTitleRow: { flexDirection: 'row', alignItems: 'center' },
    criterionName: { fontSize: 13, fontWeight: '700', color: '#334155', lineHeight: 18 },
    criterionDesc: { fontSize: 10, color: '#94a3b8', marginTop: 4, lineHeight: 14 },
    scoreContainer: { alignItems: 'flex-end', minWidth: 40 },
    itemScore: { fontSize: 16, fontWeight: '900', color: BLUE },
    itemMax: { fontSize: 10, color: '#cbd5e1', fontWeight: '700' },

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
    lockBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
    finalizeBtn: {
        flex: 1, height: 54, borderRadius: 16, backgroundColor: BLUE,
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
        shadowColor: BLUE, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4
    },
    finalizeBtnDisabled: { backgroundColor: '#cbd5e1', shadowOpacity: 0 },
    finalizeBtnText: { color: '#fff', fontSize: 14, fontWeight: '800', letterSpacing: 0.5 },
    finalizedBadge: {
        flex: 1, height: 54, borderRadius: 16, backgroundColor: '#f1f5f9',
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
        borderWidth: 1, borderColor: '#e2e8f0'
    },
    finalizedBadgeText: { color: '#64748b', fontSize: 13, fontWeight: '800' },
    
    roleSelector: { backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f1f5f9', paddingVertical: 12 },
    roleSelectorScroll: { paddingHorizontal: 16, gap: 10 },
    roleChip: {
        flexDirection: 'row', alignItems: 'center', backgroundColor: '#f1f5f9',
        paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12, gap: 6,
        borderWidth: 1, borderColor: '#e2e8f0'
    },
    roleChipActive: { backgroundColor: BLUE, borderColor: BLUE },
    roleChipText: { fontSize: 11, fontWeight: '800', color: '#64748b' },
    roleChipTextActive: { color: '#fff' },

    summaryContainer: { padding: 16, gap: 20 },
    summarySection: { gap: 12 },
    summarySectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    sectionIndicator: { width: 4, height: 16, borderRadius: 2 },
    summarySectionTitle: { fontSize: 13, fontWeight: '800', color: '#1e293b' },
    summaryCard: {
        backgroundColor: '#fff', borderRadius: 16, padding: 12,
        borderWidth: 1, borderColor: '#f1f5f9',
        shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2
    },
    summaryCardBody: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    raterIconBox: { width: 36, height: 36, borderRadius: 10, backgroundColor: LIGHT_BLUE, alignItems: 'center', justifyContent: 'center' },
    raterIconText: { fontSize: 12, fontWeight: '800', color: BLUE },
    raterName: { flex: 1, fontSize: 14, fontWeight: '700', color: '#334155' },
    raterSubRole: { fontSize: 10, fontWeight: '800', color: '#94a3b8', marginTop: 2, textTransform: 'uppercase' },
    raterScore: { fontSize: 16, fontWeight: '900', color: BLUE },
    phaseWarning: { flexDirection: 'row', padding: 12, backgroundColor: '#fffbeb', borderBottomWidth: 1, borderBottomColor: '#fef3c7' },
    phaseWarningTitle: { fontSize: 12, fontWeight: '700', color: '#92400e' },
    phaseWarningText: { fontSize: 11, color: '#b45309', marginTop: 1 },
    
    modifiedDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#f59e0b', marginLeft: 6 },
    historyItem: { flexDirection: 'row', gap: 12, paddingBottom: 12, borderLeftWidth: 1, borderLeftColor: '#f1f5f9', marginLeft: 6, paddingLeft: 16 },
    historyPoint: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#f59e0b', position: 'absolute', left: -4, top: 4 },
    historyText: { fontSize: 12, color: '#334155', lineHeight: 18 },
    historyChange: { fontSize: 11, color: '#64748b', marginTop: 2 },
    historyDate: { fontSize: 10, color: '#94a3b8', marginTop: 4 }
});
