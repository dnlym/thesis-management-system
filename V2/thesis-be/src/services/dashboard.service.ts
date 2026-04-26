import prisma from '../config/database';
import { UserRole, TopicStatus, RegistrationStatus, SemesterPhase, AssignmentStatus } from '@prisma/client';
import semesterService from './semester.service';

export class DashboardService {
    async getStats(userId: string) {
        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user) throw new Error('User not found');

        const activeSemester = await semesterService.getActiveSemester();
        const milestones = this.getMilestones(activeSemester);

        let roleStats = {};
        switch (user.role) {
            case 'STUDENT':
                roleStats = await this.getStudentStats(userId);
                break;
            case UserRole.LECTURER:
                roleStats = await this.getSupervisorStats(userId);
                break;
            case UserRole.HEAD:
                roleStats = await this.getHeadStats(userId, user.departmentId!);
                break;
            case UserRole.ADMIN:
                roleStats = await this.getAdminStats();
                break;
        }

        return {
            ...roleStats,
            activeSemester,
            milestones
        };
    }

    private getMilestones(semester: any) {
        if (!semester) return [];
        const now = new Date();
        
        const items = [
            { title: 'Hạn nộp đề cương', date: semester.proposal_deadline, type: 'PROPOSAL' },
            { title: 'Hạn nộp khóa luận', date: semester.thesis_deadline, type: 'THESIS' },
            { title: 'Bắt đầu bảo vệ', date: semester.defense_start, type: 'DEFENSE_START' },
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

    private async getStudentStats(userId: string) {
        const activeSemester = await semesterService.getActiveSemester();

        const registration = await prisma.topicRegistration.findFirst({
            where: {
                group: { members: { some: { user_id: userId, status: 'ACCEPTED' } } },
                semester_id: activeSemester?.id
            },
            include: { topic: true }
        });

        return {
            role: 'STUDENT',
            activeSemester: activeSemester,
            registration: registration,
            hasTopic: !!registration && registration.status === RegistrationStatus.CONFIRMED,
        };
    }

    private async getSupervisorStats(userId: string) {
        const activeSemester = await semesterService.getActiveSemester();

        const supervisedTopicsCount = await prisma.topic.count({
            where: {
                supervisor_id: userId,
                semester_id: activeSemester?.id
            }
        });

        const pendingRegistrationsCount = await prisma.topicRegistration.count({
            where: {
                topic: { supervisor_id: userId },
                status: RegistrationStatus.PENDING
            }
        });



        // Reviewer assignments
        const reviewAssignmentsCount = await prisma.assignment.count({
            where: {
                reviewer_id: userId,
                assignment_type: 'REVIEWER',
                status: AssignmentStatus.PENDING
            }
        });

        return {
            role: UserRole.LECTURER,
            supervisedTopicsCount,
            pendingRegistrationsCount,

            reviewAssignmentsCount
        };
    }

    async getCharts(userId: string, semesterId?: string) {
        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user) throw new Error('User not found');

        const activeSemester = semesterId
            ? await prisma.semester.findUnique({ where: { id: semesterId } })
            : await semesterService.getActiveSemester();

        const where: any = { semester_id: activeSemester?.id };
        if (user.role === UserRole.HEAD) {
            where.departmentId = user.departmentId;
        }

        // 1. Topic Status Distribution
        const topics = await prisma.topic.findMany({
            where,
            select: { status: true, progress_stage: true }
        });

        const statusMap: Record<string, number> = {};
        const progressMap: Record<string, number> = {};
        topics.forEach(t => { 
            statusMap[t.status] = (statusMap[t.status] || 0) + 1;
            if (t.status === TopicStatus.REGISTERED) {
                progressMap[t.progress_stage] = (progressMap[t.progress_stage] || 0) + 1;
            }
        });

        const topicStatus = [
            { name: 'Chờ duyệt', value: (statusMap[TopicStatus.PENDING_APPROVAL] || 0) + (statusMap[TopicStatus.REQUIRES_REVISION] || 0), color: '#FCD34D' }, // Amber
            { name: 'Đang thực hiện', value: (progressMap['WORKING'] || 0) + (progressMap['REVIEWING'] || 0), color: '#60A5FA' }, // Blue
            { name: 'Sẵn sàng bảo vệ', value: (progressMap['READY_FOR_DEFENSE'] || 0), color: '#818CF8' }, // Indigo
            { name: 'Hoàn thành', value: (statusMap[TopicStatus.COMPLETED] || 0) + (statusMap[TopicStatus.FINALIZED] || 0), color: '#34D399' }, // Emerald
            { name: 'Đang bảo vệ', value: (progressMap['DEFENDING'] || 0), color: '#A78BFA' }, // Violet
            { name: 'Từ chối', value: statusMap[TopicStatus.REJECTED] || 0, color: '#F87171' } // Red
        ];

        // 2. Defense Type Distribution (Real Committee Data)
        const committees = await prisma.committee.findMany({
            where,
            include: {
                defense_schedules: {
                    where: { topic: { status: { not: TopicStatus.REJECTED } } }
                }
            }
        });

        const oralCount = committees.filter(c => c.type === 'ORAL').reduce((acc, c) => acc + c.defense_schedules.length, 0);
        const posterCount = committees.filter(c => c.type === 'POSTER').reduce((acc, c) => acc + c.defense_schedules.length, 0);

        const defenseType = [
            { type: 'Hội đồng (Oral)', count: oralCount, color: '#3b82f6' },
            { type: 'Poster', count: posterCount, color: '#8b5cf6' }
        ];

        // 3. Score Distribution
        const scores = await prisma.finalScore.findMany({
            where: { topic: where },
            select: { final_score: true }
        });

        const scoreDistribution = [
            { range: 'Yếu (<5)', count: scores.filter(s => s.final_score < 5).length },
            { range: 'Trung bình (5-7)', count: scores.filter(s => s.final_score >= 5 && s.final_score < 7).length },
            { range: 'Khá (7-8.5)', count: scores.filter(s => s.final_score >= 7 && s.final_score < 8.5).length },
            { range: 'Giỏi (8.5-10)', count: scores.filter(s => s.final_score >= 8.5).length },
        ];

        // 4. Monthly Progress (Realistic logic based on creation dates)
        const registrations = await prisma.topicRegistration.findMany({
            where: {
                semester_id: activeSemester?.id,
                ...(user.role === UserRole.HEAD ? { topic: { departmentId: user.departmentId } } : {})
            },
            select: { registered_at: true, status: true }
        });

        const monthNames = ['T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8', 'T9', 'T10', 'T11', 'T12'];
        const monthlyDataMap: Record<number, any> = {};

        registrations.forEach(reg => {
            const month = new Date(reg.registered_at).getMonth();
            if (!monthlyDataMap[month]) {
                monthlyDataMap[month] = { month: monthNames[month], registered: 0, completed: 0 };
            }
            monthlyDataMap[month].registered++;
            if (reg.status === RegistrationStatus.CONFIRMED) {
                // Approximate completion or just confirmed registrations for now
            }
        });

        const monthlyProgress = Object.keys(monthlyDataMap)
            .sort((a, b) => parseInt(a) - parseInt(b))
            .map(m => monthlyDataMap[parseInt(m)]);

        // 5. Leaderboard: Top Lecturers by Topic Count
        const topLecturersRaw = await prisma.topic.groupBy({
            where,
            by: ['supervisor_id'],
            _count: { id: true },
            orderBy: { _count: { id: 'desc' } },
            take: 5
        });

        const supervisorIds = topLecturersRaw.map(l => l.supervisor_id);
        const supervisors = await prisma.user.findMany({
            where: { id: { in: supervisorIds } },
            select: { id: true, full_name: true }
        });

        const leaderboard = topLecturersRaw.map(tl => ({
            name: supervisors.find(s => s.id === tl.supervisor_id)?.full_name || 'N/A',
            count: tl._count.id
        }));

        return {
            topicStatus,
            scoreDistribution,
            defenseType,
            monthlyProgress: monthlyProgress.length > 0 ? monthlyProgress : [{ month: 'N/A', registered: 0, completed: 0 }],
            leaderboard
        };
    }

    private async getHeadStats(userId: string, departmentId: string) {
        const activeSemester = await semesterService.getActiveSemester();

        const totalTopics = await prisma.topic.count({
            where: {
                departmentId: departmentId,
                semester_id: activeSemester?.id
            }
        });

        const pendingApprovalTopics = await prisma.topic.count({
            where: {
                departmentId: departmentId,
                semester_id: activeSemester?.id,
                status: TopicStatus.PENDING_APPROVAL
            }
        });

        const totalStudents = await prisma.user.count({
            where: {
                departmentId: departmentId,
                role: UserRole.STUDENT
            }
        });

        const totalLecturers = await prisma.user.count({
            where: {
                departmentId: departmentId,
                role: { in: [UserRole.LECTURER, UserRole.HEAD] }
            }
        });

        // New Stats for Reports
        const completedCount = await prisma.topic.count({
            where: {
                departmentId: departmentId,
                semester_id: activeSemester?.id,
                status: { in: [TopicStatus.COMPLETED, TopicStatus.FINALIZED] }
            }
        });

        const defendedCount = await prisma.topic.count({
            where: {
                departmentId: departmentId,
                semester_id: activeSemester?.id,
                status: TopicStatus.REGISTERED,
                progress_stage: { in: ['READY_FOR_DEFENSE', 'DEFENDING'] } 
            }
        });

        const scores = await prisma.finalScore.findMany({
            where: { topic: { departmentId: departmentId, semester_id: activeSemester?.id } },
            select: { final_score: true }
        });
        const avgScore = scores.length > 0
            ? scores.reduce((a, b) => a + b.final_score, 0) / scores.length
            : 0;

        return {
            role: 'HEAD',
            totalTopics,
            pendingApprovalTopics,
            totalStudents,
            totalLecturers,
            // Report Stats
            completionRate: totalTopics > 0 ? (completedCount / totalTopics) * 100 : 0,
            avgScore,
            defendedCount
        };
    }

    private async getAdminStats() {
        const totalUsers = await prisma.user.count();
        const totalSemesters = await prisma.semester.count();
        const totalDepartments = await prisma.department.count();
        const activeSemester = await semesterService.getActiveSemester();

        const userDistribution = await prisma.user.groupBy({
            by: ['role'],
            _count: {
                role: true
            }
        });

        // New Stats for Reports
        const totalTopics = await prisma.topic.count({
            where: { semester_id: activeSemester?.id }
        });

        const pendingApprovalTopics = await prisma.topic.count({
            where: {
                semester_id: activeSemester?.id,
                status: TopicStatus.PENDING_APPROVAL
            }
        });

        const completedCount = await prisma.topic.count({
            where: {
                semester_id: activeSemester?.id,
                status: { in: [TopicStatus.COMPLETED, TopicStatus.FINALIZED] }
            }
        });

        const defendedCount = await prisma.topic.count({
            where: {
                semester_id: activeSemester?.id,
                status: TopicStatus.REGISTERED,
                progress_stage: { in: ['READY_FOR_DEFENSE', 'DEFENDING'] }
            }
        });

        const scores = await prisma.finalScore.findMany({
            where: { topic: { semester_id: activeSemester?.id } },
            select: { final_score: true }
        });
        const avgScore = scores.length > 0
            ? scores.reduce((a, b) => a + b.final_score, 0) / scores.length
            : 0;

        return {
            role: 'ADMIN',
            totalUsers,
            totalSemesters,
            totalDepartments,
            activeSemester,
            pendingApprovalTopics,
            userDistribution: userDistribution.map(u => ({ role: u.role, count: u._count.role })),
            // Report Stats
            totalTopics,
            completionRate: totalTopics > 0 ? (completedCount / totalTopics) * 100 : 0,
            avgScore,
            defendedCount
        };
    }
}

export default new DashboardService();
