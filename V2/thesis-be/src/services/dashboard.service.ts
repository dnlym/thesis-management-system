import prisma from '../config/database';
import { UserRole, TopicStatus, RegistrationStatus, AssignmentStatus } from '@prisma/client';
import semesterService from './semester.service';
import { SemesterGuard } from '../utils/semester-guard';

export class DashboardService {
    async getStats(userId: string) {
        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user) throw new Error('User not found');

        let activeSemester: any = await semesterService.getActiveSemester();

        // Safety Fallback: If no ACTIVE semester found, get the most recent one with topics
        if (!activeSemester) {
            const mostRecentWithTopics = await prisma.topic.findFirst({
                orderBy: { created_at: 'desc' },
                select: { semester_id: true }
            });
            if (mostRecentWithTopics) {
                activeSemester = await prisma.semester.findUnique({
                    where: { id: mostRecentWithTopics.semester_id }
                });
            }
        }

        const currentPhase = activeSemester ? SemesterGuard.calculateCurrentPhase(activeSemester) : null;
        const milestones = this.getMilestones(activeSemester);
        const semesterId = activeSemester?.id;

        let roleStats: any = {};
        switch (user.role) {
            case UserRole.STUDENT:
                roleStats = await this.getStudentStats(userId, semesterId);
                break;
            case UserRole.LECTURER:
                roleStats = await this.getSupervisorStats(userId, semesterId);
                break;
            case UserRole.HEAD:
                roleStats = await this.getHeadStats(userId, user.departmentId!, semesterId);
                break;
            case UserRole.ADMIN:
                roleStats = await this.getAdminStats(semesterId);
                break;
        }

        return {
            ...roleStats,
            activeSemester: activeSemester ? {
                id: activeSemester.id,
                name: activeSemester.name,
                code: activeSemester.code,
                calculated_phase_text: this.getPhaseText(currentPhase)
            } : null,
            milestones
        };
    }

    private getPhaseText(phase: string | null) {
        const map: Record<string, string> = {
            'PLANNING': 'Lập kế hoạch học kỳ',
            'PREVIEW': 'Đề xuất & Công bố đề tài',
            'REGISTRATION': 'Sinh viên đăng ký đề tài',
            'WORK': 'Thực hiện khóa luận',
            'REVIEWING': 'Chấm phản biện',
            'DEFENSE': 'Bảo vệ Hội đồng',
            'FINAL': 'Tổng kết học kỳ'
        };
        return phase ? map[phase] || phase : 'N/A';
    }

    private getMilestones(semester: any) {
        if (!semester) return [];
        const now = new Date();

        const items = [
            { title: 'Công bố danh sách đề tài', date: semester.topic_viewing_start, type: 'VIEWING' },
            { title: 'Bắt đầu đăng ký đề tài', date: semester.topic_registration_start, type: 'REGISTRATION_START' },
            { title: 'Kết thúc đợt đăng ký', date: semester.topic_registration_end, type: 'REGISTRATION_END' },
            { title: 'Hạn chót chấm giữa kỳ', date: semester.midterm_end, type: 'MIDTERM' },
            { title: 'Kết thúc thực hiện khóa luận', date: semester.proposal_deadline, type: 'PROPOSAL' },
            { title: 'Hạn chót chấm phản biện', date: semester.thesis_deadline, type: 'REVIEW' },
            { title: 'Bắt đầu bảo vệ Hội đồng', date: semester.defense_start, type: 'DEFENSE_START' },
            { title: 'Kết thúc học kỳ', date: semester.end_date, type: 'SEMESTER_END' },
        ].filter(item => item.date);

        return items.map(item => {
            const diffTime = new Date(item.date).getTime() - now.getTime();
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            return {
                ...item,
                daysLeft: diffDays,
                isOverdue: diffDays < 0,
                isUrgent: diffDays >= 0 && diffDays <= 3
            };
        });
    }

    private async getStudentStats(userId: string, semesterId?: string) {
        const registration = await prisma.topicRegistration.findFirst({
            where: {
                group: { members: { some: { user_id: userId, status: 'ACCEPTED' } } },
                ...(semesterId ? { semester_id: semesterId } : {})
            },
            include: {
                topic: {
                    include: { supervisor: { select: { full_name: true } } }
                }
            }
        });

        return {
            role: 'STUDENT',
            hasTopic: !!registration && registration.status === RegistrationStatus.CONFIRMED,
            topicName: registration?.topic?.title || null,
            supervisorName: registration?.topic?.supervisor?.full_name || null,
            progressStage: registration?.topic?.progress_stage || null,
            reviewAssignmentsCount: 0,
            pendingApprovalTopics: 0,
            completionRate: registration?.topic?.status === TopicStatus.COMPLETED ? 100 : 0
        };
    }

    private async getSupervisorStats(userId: string, semesterId?: string) {
        const where: any = { supervisor_id: userId };
        if (semesterId) where.semester_id = semesterId;

        const supervisedTopicsCount = await prisma.topic.count({ where });

        const pendingRegistrationsCount = await prisma.topicRegistration.count({
            where: {
                topic: { supervisor_id: userId },
                status: RegistrationStatus.PENDING,
                ...(semesterId ? { semester_id: semesterId } : {})
            }
        });

        // Count assignments that are either ACCEPTED or AUTO_ACCEPTED
        const reviewAssignmentsCount = await prisma.assignment.count({
            where: {
                reviewer_id: userId,
                assignment_type: 'REVIEWER',
                status: { in: [AssignmentStatus.ACCEPTED, 'AUTO_ACCEPTED' as any] },
                ...(semesterId ? { topic: { semester_id: semesterId } } : {})
            }
        });

        // Count assignments where the lecturer has already submitted grades
        const gradedAssignmentsCount = await prisma.assignment.count({
            where: {
                reviewer_id: userId,
                assignment_type: 'REVIEWER',
                topic: {
                    grades: {
                        some: {
                            grader_id: userId,
                            ...(semesterId ? { topic: { semester_id: semesterId } } : {})
                        }
                    }
                }
            }
        });

        return {
            role: UserRole.LECTURER,
            supervisedTopicsCount,
            pendingRegistrationsCount,
            reviewAssignmentsCount,
            gradedAssignmentsCount,
            pendingApprovalTopics: pendingRegistrationsCount,
            completionRate: 0
        };
    }

    private async getHeadStats(userId: string, departmentId: string, semesterId?: string) {
        const where: any = { departmentId };
        if (semesterId) where.semester_id = semesterId;

        const totalTopics = await prisma.topic.count({ where });
        const pendingApprovalTopics = await prisma.topic.count({
            where: { ...where, status: TopicStatus.PENDING_APPROVAL }
        });

        const completedCount = await prisma.topic.count({
            where: { ...where, status: { in: [TopicStatus.COMPLETED, TopicStatus.FINALIZED] } }
        });

        return {
            role: 'HEAD',
            totalTopics,
            pendingApprovalTopics,
            reviewAssignmentsCount: 0,
            completionRate: totalTopics > 0 ? (completedCount / totalTopics) * 100 : 0,
        };
    }

    private async getAdminStats(semesterId?: string) {
        const where: any = {};
        if (semesterId) where.semester_id = semesterId;

        const totalUsers = await prisma.user.count();
        const pendingApprovalTopics = await prisma.topic.count({
            where: { ...where, status: TopicStatus.PENDING_APPROVAL }
        });
        const totalTopics = await prisma.topic.count({ where });
        const completedCount = await prisma.topic.count({
            where: { ...where, status: { in: [TopicStatus.COMPLETED, TopicStatus.FINALIZED] } }
        });

        return {
            role: 'ADMIN',
            totalUsers,
            pendingApprovalTopics,
            reviewAssignmentsCount: 0,
            totalTopics,
            completionRate: totalTopics > 0 ? (completedCount / totalTopics) * 100 : 0,
        };
    }

    async getCharts(userId: string, semesterId?: string) {
        const where: any = {};
        if (semesterId) where.semester_id = semesterId;

        // Topic status distribution
        const statusDistribution = await prisma.topic.groupBy({
            by: ['status'],
            where,
            _count: { id: true }
        });

        // Student progress distribution
        const progressDistribution = await prisma.topicRegistration.groupBy({
            by: ['status'],
            where: semesterId ? { semester_id: semesterId } : {},
            _count: { id: true }
        });

        return {
            topicStatus: statusDistribution.map(s => ({
                status: s.status,
                count: s._count.id
            })),
            studentProgress: progressDistribution.map(p => ({
                status: p.status,
                count: p._count.id
            }))
        };
    }
}

export default new DashboardService();
