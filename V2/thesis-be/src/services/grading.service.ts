import prisma from '../config/database';
import { Prisma, RaterRole, TopicStatus, StudentProgressStatus, MidtermStatus, AssignmentType, SemesterPhase, GradingCriterion, UserRole, AssignmentStatus, ProgressStage, RegistrationStatus } from '@prisma/client';
import { isSupervisor, isReviewer as isReviewerPermission, isCommitteeMember } from '../utils/permission.utils';
import { SemesterGuard } from '../utils/semester-guard';
import { SubmitGradeRequest, CreateGradingCriterionRequest, UpdateGradingCriterionRequest } from '../types';
import { ERROR_CODES, GRADING, ROLE_GROUP_MAP, RoleGroup } from '../constants';
import { AcademicAction, AcademicPolicy } from '../utils/academic-policy';
import {
  isCommittee,
  isReviewer,
  calculateFinalScore,
  validateScores,
  isGradingComplete,
  calculateWeightedScore,
  getRolesByGroup,
  roundScore
} from '../utils/grading.utils';
import { logger } from '../utils/logger';
import { AuditLogger } from '../utils/audit-logger';
import notificationService from './notification.service';

type TopicWithRelations = Prisma.TopicGetPayload<{
  include: typeof topicSummaryInclude
}>;

const topicSummaryInclude = {
  supervisor: { select: { id: true, full_name: true, avatar_url: true } },
  semester: { select: { id: true, name: true, thesis_deadline: true } },
  registrations: {
    include: {
      student: { select: { id: true, full_name: true, student_code: true, avatar_url: true, class_name: true } },
      group: { select: { id: true, name: true } }
    },
  },
  grades: { include: { criterion: true } },
  assignments: true,
  final_scores: true,
} as const;

type TopicSummaryPayload = Prisma.TopicGetPayload<{
  include: typeof topicSummaryInclude
}>;


export class GradingService {
  private static gradeSummaryCache = new Map<string, { data: any; timestamp: number }>();
  private static activeSummaryQueries = new Map<string, Promise<any>>();

  public static clearGradeSummaryCache() {
    GradingService.gradeSummaryCache.clear();
    GradingService.activeSummaryQueries.clear();
  }

  async submitGrade(userId: string, data: SubmitGradeRequest, raterRole: RaterRole) {
    // Preprocess scores: if score > 10, divide by 10
    if (data.grades && Array.isArray(data.grades)) {
      data.grades = data.grades.map(grade => {
        const numScore = typeof grade.score === 'string' ? parseFloat(grade.score) : grade.score;
        if (typeof numScore === 'number' && !isNaN(numScore) && numScore > 10) {
          return {
            ...grade,
            score: numScore / 10
          };
        }
        return grade;
      });
    }

    let resolvedTopicId = data.topicId;

    // [RESOLUTION STRATEGY] Try to resolve the actual Topic ID from various possible input IDs
    const group = await prisma.group.findUnique({
      where: { id: data.topicId },
      select: { id: true, topic_id: true }
    });

    if (group && group.topic_id) {
      resolvedTopicId = group.topic_id;
    } else {
      const assignment = await prisma.assignment.findUnique({
        where: { id: data.topicId },
        select: { topic_id: true }
      });
      if (assignment && assignment.topic_id) {
        resolvedTopicId = assignment.topic_id;
      }
    }

    // Verify topic
    const topic = await prisma.topic.findUnique({
      where: { id: resolvedTopicId },
      include: topicSummaryInclude,
    }) as TopicSummaryPayload | null;

    if (!topic) {
      throw new Error(ERROR_CODES.TOPIC_NOT_FOUND);
    }

    // [ROBUSTNESS] Ensure groupId is valid. If omitted, extract from topic registrations.
    let finalGroupId: string | undefined | null = data.groupId;
    if (finalGroupId === 'undefined' || finalGroupId === 'null') {
      finalGroupId = undefined;
    }
    if (!finalGroupId && topic.registrations && topic.registrations.length > 0) {
      finalGroupId = topic.registrations[0].group_id;
    }

    // [DEPRECATED] Hard finalization check removed. Now relying on Semester Deadline logic.

    // Determine academic action based on role
    let action = AcademicAction.GRADE_REVIEWER;
    if (raterRole === RaterRole.SUPERVISOR) {
      action = AcademicAction.GRADE_SUPERVISOR;
    } else if (isCommittee(raterRole)) {
      action = AcademicAction.GRADE_COMMITTEE;
    }

    // Refresh semester and user data to ensure absolute consistency
    const [semester, user] = await Promise.all([
      prisma.semester.findUnique({
        where: { id: topic.semester_id },
        include: {
          department_configs: {
            where: { department_id: topic.departmentId },
            take: 1
          }
        }
      }).then(s => s ? ({ ...s, deptConfig: s.department_configs[0] }) : null),
      prisma.user.findUnique({ where: { id: userId } })
    ]);

    if (!semester) throw new Error('Không tìm thấy thông tin học kỳ.');
    if (!user) throw new Error('Không tìm thấy thông tin người dùng.');
    // Fetch student registration to check midterm status and pass to AcademicPolicy
    let reg = null;
    if (data.studentId) {
      reg = await prisma.topicRegistration.findFirst({
        where: {
          student_id: data.studentId,
          semester_id: semester.id,
        },
      });
      if (reg && (reg.midterm_status === 'FAIL' || reg.status === 'FAILED')) {
        throw new Error('Sinh viên này đã rớt đánh giá giữa kỳ và bị khóa toàn bộ quyền thao tác học thuật.');
      }
    }

    const existingGrades = await prisma.grade.findMany({
      where: {
        topic_id: resolvedTopicId,
        group_id: finalGroupId || null,
        student_id: data.studentId || null,
        grader_id: userId,
        rater_role: raterRole,
        reviewer_order: data.reviewerOrder || null,
      },
    });
    const isChangeRequest = existingGrades.length > 0;

    AcademicPolicy.enforce(action, { id: userId, role: user.role as UserRole }, semester, reg ? { ...reg, topic, isChangeRequest } : { topic, isChangeRequest });

    // Verify user has permission to grade using helpers
    let hasPermission = false;
    if (raterRole === RaterRole.SUPERVISOR) {
      hasPermission = await isSupervisor(userId, resolvedTopicId);
    } else if (isReviewer(raterRole)) {
      hasPermission = await isReviewerPermission(userId, resolvedTopicId);
    } else if (isCommittee(raterRole)) {
      hasPermission = await isCommitteeMember(userId, resolvedTopicId);
    }

    if (user.role === UserRole.ADMIN) {
      hasPermission = true;
    }

    if (!hasPermission) {
      throw new Error(ERROR_CODES.FORBIDDEN);
    }

    // [PRODUCTION GUARD] Permission already verified by AcademicPolicy.enforce and isReviewerPermission/isCommitteeMember helpers above

    // Get defense type from topic
    const defenseType = topic.defense_type || 'ORAL';

    // Validate rater role against defense type
    if (defenseType === 'ORAL' && raterRole === RaterRole.POSTER_COMMITTEE) {
      throw new Error('Đề tài Vấn đáp không thể chấm điểm bởi Hội đồng Poster');
    }
    if (defenseType === 'POSTER' && isCommittee(raterRole) && raterRole !== RaterRole.POSTER_COMMITTEE) {
      throw new Error('Đề tài Poster chỉ được chấm điểm bởi Giảng viên hướng dẫn, Phản biện hoặc Hội đồng Poster');
    }

    // Get criteria for this rater role with true priority fallback
    const criteria = await this.getPriorityCriteria(raterRole, topic.departmentId);

    // Validate that weights sum to 1.0
    this.validateCriteriaWeights(criteria);

    // Validate all criteria are provided
    const providedCriteriaIds = data.grades.map((g: any) => g.criterionId);
    const requiredCriteriaIds = criteria.map((c: GradingCriterion) => c.id);
    const missingCriteria = requiredCriteriaIds.filter((id: string) => !providedCriteriaIds.includes(id));

    if (missingCriteria.length > 0) {
      console.log(`[GradingService] Validation Failed: Missing criteria for role ${raterRole}`);
      console.log(`[GradingService] Required:`, requiredCriteriaIds);
      console.log(`[GradingService] Provided:`, providedCriteriaIds);
      console.log(`[GradingService] Missing:`, missingCriteria);
      throw new Error('Tất cả các tiêu chí phải được chấm điểm');
    }

    // Validate scores (0-10 and range)
    for (const grade of data.grades) {
      const criterion = criteria.find((c: GradingCriterion) => c.id === grade.criterionId);
      if (!criterion) {
        throw new Error(`Tiêu chí không hợp lệ: ${grade.criterionId}`);
      }

      if (typeof grade.score !== 'number' || isNaN(grade.score) || grade.score < 0 || grade.score > 10) {
        throw new Error(`Điểm cho ${criterion.name} phải là số từ 0 đến 10`);
      }

      if (grade.score < criterion.min_score || grade.score > criterion.max_score) {
        throw new Error(`Điểm cho ${criterion.name} phải nằm trong khoảng ${criterion.min_score} - ${criterion.max_score}`);
      }
    }

    // --- DEADLINE CHECK & ROUTING (MILESTONE LOGIC) ---
    const phase = AcademicPolicy.getPhase(semester) || SemesterPhase.PLANNING;

    const isPastDeadline = this.isPastMilestone(
      raterRole,
      phase
    );

    // If it's a modification after deadline, we MUST use the Request-Approval workflow (Except for ADMIN/HOD)
    // Ensure studentId is available for comparison (essential for individual grading within topics)
    const studentId = data.studentId || (data as any).student_id;

    if (isPastDeadline) {
      if (existingGrades.length === 0) {
        throw new Error('Không thể yêu cầu sửa điểm do điểm số chưa từng được nhập trước thời hạn khóa.');
      }

      const changedGrades = data.grades.filter(newGrade => {
        const old = existingGrades.find(eg => eg.criterion_id === newGrade.criterionId);
        return !old || old.score !== roundScore(newGrade.score);
      });

      if (changedGrades.length > 0) {
        return await this.requestGradeChange(userId, data, raterRole, existingGrades, resolvedTopicId, studentId);
      }

      // If nothing changed, throw an error to notify that no changes were made
      throw new Error('Không có điểm số nào thay đổi so với điểm cũ để gửi yêu cầu chỉnh sửa.');
    }

    // We will use upsert instead of delete-create to preserve graded_at for yellow dot detection
    /* 
    await prisma.grade.deleteMany({
      where: {
        topic_id: resolvedTopicId,
        group_id: finalGroupId || null,
        student_id: data.studentId || null,
        grader_id: userId,
        rater_role: raterRole,
        reviewer_order: data.reviewerOrder || null,
      },
    });
    */

    // Create or Update grades
    const grades = await Promise.all(
      data.grades.map(async (grade) => {
        const roundedScore = roundScore(grade.score);

        // Find existing grade manually to handle nulls in compound unique constraints
        const existingGradeRecord = existingGrades.find(
          (eg: any) => eg.criterion_id === grade.criterionId
        );

        let savedGrade;
        if (existingGradeRecord) {
          // UPDATE: Preserves graded_at, updates updated_at -> Yellow dot works!
          savedGrade = await prisma.grade.update({
            where: { id: existingGradeRecord.id },
            data: {
              score: roundedScore,
              comments: grade.comments,
            }
          });
        } else {
          // CREATE: First time grading
          savedGrade = await prisma.grade.create({
            data: {
              topic_id: resolvedTopicId,
              group_id: finalGroupId || null,
              student_id: data.studentId || null,
              grader_id: userId,
              criterion_id: grade.criterionId,
              rater_role: raterRole,
              reviewer_order: data.reviewerOrder || null,
              score: roundedScore,
              comments: grade.comments,
            },
          });
        }

        // [POLICY] Post-deadline interventions by Admin/HOD must be logged to GradeHistory
        if (isPastDeadline && (user?.role === UserRole.ADMIN || user?.role === UserRole.HEAD)) {
          const oldScore = existingGradeRecord?.score || null;
          const newScore = roundedScore;

          if (oldScore !== newScore) {
            await prisma.gradeHistory.create({
              data: {
                student_id: data.studentId || '',
                grader_id: userId,
                topic_id: resolvedTopicId,
                criterion_id: grade.criterionId,
                old_score: oldScore,
                new_score: newScore,
                reason: `[Can thiệp đặc cách bởi ${user.role}] ${grade.comments || 'Cập nhật điểm sau thời hạn'}`,
                rater_role: raterRole,
              }
            });
          }
        }

        return savedGrade;
      })
    );

    // Professional Logging
    logger.info('SUBMIT_GRADE', {
      topicId: resolvedTopicId,
      studentId: data.studentId,
      group_id: data.groupId,
      raterRole: raterRole,
      criteriaCount: grades.length,
      timestamp: new Date().toISOString()
    });

    // --- AUDIT LOGGING ---
    await AuditLogger.log({
      userId,
      action: 'SUBMIT_GRADE',
      entityType: 'Grade',
      entityId: resolvedTopicId,
      newValue: {
        studentId: data.studentId,
        role: raterRole,
        grades: data.grades
      },
      description: `Giảng viên ${userId} đã chấm điểm cho sinh viên ${data.studentId} với vai trò ${raterRole}`
    });

    // Update student progress status
    const regs = data.groupId
      ? topic.registrations.filter((reg: any) =>
        (reg.group_id || reg.groupId)?.toString() === data.groupId?.toString()
      )
      : topic.registrations.filter((reg: any) => reg.student_id === data.studentId);

    for (const registration of regs) {
      if (raterRole === RaterRole.SUPERVISOR) {
        await prisma.topicRegistration.update({
          where: { id: registration.id },
          data: {
            student_progress_status: StudentProgressStatus.ADVISOR_GRADED,
          },
        });
      } else if (isReviewer(raterRole)) {
        // Check if all reviewers have graded
        const allReviewersGraded = await this.checkAllReviewersGraded(resolvedTopicId);
        if (allReviewersGraded) {
          await prisma.topicRegistration.update({
            where: { id: registration.id },
            data: {
              student_progress_status: StudentProgressStatus.REVIEWER_GRADED,
            },
          });

          // [PRODUCTION GUARD] Idempotent status transition to READY_FOR_DEFENSE stage
          if (topic.progress_stage !== ProgressStage.READY_FOR_DEFENSE) {
            await prisma.topic.update({
              where: { id: resolvedTopicId },
              data: {
                progress_stage: ProgressStage.READY_FOR_DEFENSE,
              },
            });
            logger.info('TOPIC_PROGRESS_TRANSITION', {
              topicId: resolvedTopicId,
              to: ProgressStage.READY_FOR_DEFENSE,
              trigger: 'ALL_REVIEWERS_GRADED'
            });
          }
        }
      } else if (isCommittee(raterRole)) {
        // Check if all committee members have graded
        const allCommitteeGraded = await this.checkAllCommitteeGraded(resolvedTopicId);
        if (allCommitteeGraded) {
          await prisma.topicRegistration.update({
            where: { id: registration.id },
            data: {
              student_progress_status: StudentProgressStatus.COUNCIL_GRADED,
            },
          });

          // [PRODUCTION GUARD] Idempotent status transition to COMPLETED
          if (topic.status !== TopicStatus.COMPLETED) {
            await prisma.topic.update({
              where: { id: resolvedTopicId },
              data: {
                status: TopicStatus.COMPLETED,
                progress_stage: ProgressStage.DONE,
              },
            });
          }

          // Auto-compute final score
          await this.computeFinalScore(resolvedTopicId);
        }
      }
    }

    // Create audit log
    await prisma.auditLog.create({
      data: {
        user_id: userId,
        action: 'SUBMIT_GRADE',
        entity_type: 'Grade',
        entity_id: resolvedTopicId,
        new_value: { rater_role: raterRole, grades: grades.length },
      },
    });

    // TODO: Send notification

    // Ensure final score is recalculated on every grade submission to synchronize grades table and final_scores table
    await this.computeFinalScore(resolvedTopicId);

    // 4. Auto-evaluate eligibility for defense
    await this.autoEvaluateEligibility(resolvedTopicId);

    GradingService.clearGradeSummaryCache();
    return grades;
  }

  async computeFinalScore(topicId: string) {
    // 1. Partial compute allowed: We update scores as they come in.
    // Full validation only happens at the FINALIZE step.
    const topicData = await prisma.topic.findUnique({
      where: { id: topicId },
      include: { registrations: true }
    });

    if (!topicData) throw new Error(ERROR_CODES.TOPIC_NOT_FOUND);

    const topic = await prisma.topic.findUnique({
      where: { id: topicId },
      include: {
        grades: {
          include: {
            criterion: true,
          },
        },
        registrations: {
          where: { midterm_status: 'PASS' },
          select: { student_id: true, group_id: true },
        },
      },
    });

    if (!topic) {
      throw new Error(ERROR_CODES.TOPIC_NOT_FOUND);
    }

    const results = [];

    // Get all students and their group_ids
    const studentData = topic.registrations.map(r => ({
      studentId: r.student_id,
      groupId: r.group_id
    }));

    // Get defense type from topic
    const defenseType = topic.defense_type || 'ORAL';

    for (const data of studentData) {
      const studentId = data.studentId;
      const groupId = data.groupId;
      // Filter grades for this student (ONLY individual grades)
      const studentGrades = topic.grades.filter(g => g.student_id === studentId);

      // Fetch all approved extra points from research evidence (AUTOMATIC)
      const approvedExtraPointsSum = await prisma.extraPointRequest.aggregate({
        where: {
          topic_id: topicId,
          student_id: studentId,
          status: 'APPROVED'
        },
        _sum: {
          points_requested: true
        }
      });
      const extraPoints = approvedExtraPointsSum._sum.points_requested || 0;

      // 1. Calculate weighted score for supervisor
      const supervisorGrades = studentGrades.filter(g => g.rater_role === RaterRole.SUPERVISOR);
      const supervisorScore = supervisorGrades.length > 0 ? calculateWeightedScore(supervisorGrades) : null;

      // 2. Calculate average of ALL reviewers assigned
      const reviewerGrades = studentGrades.filter(g => isReviewer(g.rater_role));
      const reviewerGraderIds = [...new Set(reviewerGrades.map(g => g.grader_id))];
      const reviewerScores = reviewerGraderIds.map(graderId => {
        const graderGrades = reviewerGrades.filter(g => g.grader_id === graderId);
        return calculateWeightedScore(graderGrades);
      });
      const reviewerAvgScore = reviewerScores.length > 0 ? reviewerScores.reduce((a, b) => a + b, 0) / reviewerScores.length : null;

      // 3. Calculate average of all assigned committee members
      // VALIDATION: ORAL topics must not have poster scores, POSTER topics must not have oral scores
      const committeeGrades = studentGrades.filter(g => {
        if (!isCommittee(g.rater_role)) return false;
        if (defenseType === 'ORAL' && g.rater_role === RaterRole.POSTER_COMMITTEE) return false;
        if (defenseType === 'POSTER' && g.rater_role !== RaterRole.POSTER_COMMITTEE) return false;
        return true;
      });

      const committeeGraderIds = [...new Set(committeeGrades.map(g => g.grader_id))];
      const committeeGraderScores = committeeGraderIds.map(graderId => {
        const graderGrades = committeeGrades.filter(g => g.grader_id === graderId);
        return calculateWeightedScore(graderGrades);
      });
      const committeeAvgScore = committeeGraderScores.length > 0
        ? committeeGraderScores.reduce((a, b) => a + b, 0) / committeeGraderScores.length
        : null;

      // Validate all scores before final calculation
      const scoresToValidate = [supervisorScore, reviewerAvgScore, committeeAvgScore].filter(s => s !== null) as number[];
      if (scoresToValidate.length > 0 && !validateScores(scoresToValidate)) {
        throw new Error('Detected invalid scores outside of range (0-10)');
      }

      const finalScore = await prisma.finalScore.findFirst({
        where: {
          topic_id: topicId,
          student_id: studentId,
          group_id: groupId || null
        },
      });

      // All components must be graded to compute final score
      const isGradingComplete = supervisorScore !== null && reviewerAvgScore !== null && committeeAvgScore !== null;
      let finalScoreValue = null;
      let computedScore = null;
      let gradeClassification = null;

      if (isGradingComplete) {
        finalScoreValue = calculateFinalScore({
          supervisor: supervisorScore!,
          reviewerAvg: reviewerAvgScore!,
          committeeAvg: committeeAvgScore!,
          bonus: extraPoints
        });
        computedScore = roundScore(Math.max(finalScoreValue - extraPoints, 0));
        gradeClassification = this.getGradeClassification(finalScoreValue);
      }

      let resultScore;
      if (finalScore) {
        resultScore = await prisma.finalScore.update({
          where: { id: finalScore.id },
          data: {
            supervisor_score: supervisorScore,
            reviewer_avg_score: reviewerAvgScore,
            committee_score: committeeAvgScore,
            computed_score: computedScore,
            extra_points: extraPoints,
            final_score: finalScoreValue,
            grade_classification: gradeClassification,
            finalized: isGradingComplete ? true : finalScore.finalized,
          },
        });
      } else {
        resultScore = await prisma.finalScore.create({
          data: {
            topic_id: topicId,
            student_id: studentId,
            group_id: groupId,
            supervisor_score: supervisorScore,
            reviewer_avg_score: reviewerAvgScore,
            committee_score: committeeAvgScore,
            computed_score: computedScore,
            extra_points: extraPoints,
            final_score: finalScoreValue,
            grade_classification: gradeClassification,
            finalized: isGradingComplete,
          },
        });
      }

      results.push(resultScore);
    }

    GradingService.clearGradeSummaryCache();
    return results;
  }

  /**
   * HOD Finalizes all grades for a specific group (DEPRECATED)
   */
  async finalizeGroup(userId: string, groupId: string) {
    throw new Error('Cơ chế chốt điểm thủ công đã bị loại bỏ. Hệ thống hiện quản lý theo Deadline.');
  }

  /**
   * Get Grade History
   * Permissions: Lecturer (own), HOD/Admin (all)
   */
  async getGradeHistory(userId: string, studentId?: string, groupId?: string, topicId?: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new Error('User not found');

    const where: Prisma.GradeHistoryWhereInput = {};
    if (studentId) where.student_id = studentId;
    if (groupId) where.group_id = groupId;
    if (topicId) where.topic_id = topicId;

    // Filter by grader if user is LECTURER
    if (user.role === 'LECTURER') {
      where.grader_id = userId;
    }

    return await prisma.gradeHistory.findMany({
      where,
      include: {
        grader: { select: { id: true, full_name: true } },
        student: { select: { id: true, full_name: true, student_code: true } },
        topic: { select: { id: true, title: true, code: true } },
        criterion: true
      },
      orderBy: { changed_at: 'desc' }
    });
  }

  /**
   * Get Grade Summary list for HEAD — groups ready for finalization or in progress
   */
  async getGradeSummary(userId: string, semesterId: string) {
    const cacheKey = `${userId}:${semesterId}`;
    const cached = GradingService.gradeSummaryCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < 5000) {
      return cached.data;
    }

    if (GradingService.activeSummaryQueries.has(cacheKey)) {
      return GradingService.activeSummaryQueries.get(cacheKey);
    }

    const queryPromise = this.executeGradeSummaryQuery(userId, semesterId);
    GradingService.activeSummaryQueries.set(cacheKey, queryPromise);

    try {
      const result = await queryPromise;
      GradingService.gradeSummaryCache.set(cacheKey, { data: result, timestamp: Date.now() });
      return result;
    } finally {
      GradingService.activeSummaryQueries.delete(cacheKey);
    }
  }

  private async executeGradeSummaryQuery(userId: string, semesterId: string) {
    console.log("🔥 [DB QUERY] executeGradeSummaryQuery EXECUTED FOR USER:", userId);
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || (user.role !== UserRole.HEAD && user.role !== UserRole.COORDINATOR && user.role !== UserRole.ADMIN)) throw new Error(ERROR_CODES.FORBIDDEN);

    const topics = await prisma.topic.findMany({
      where: {
        semester_id: semesterId,
        ...(user.role !== UserRole.ADMIN && { departmentId: user.departmentId }),
        status: {
          in: [
            TopicStatus.REGISTERED,
            TopicStatus.COMPLETED,
            TopicStatus.FINALIZED,
          ],
        },
        current_students: { gt: 0 },
      },
      include: topicSummaryInclude,
      orderBy: { updated_at: 'desc' },
    });

    const topicIds = topics.map(t => t.id);
    const extraPoints = await prisma.extraPointRequest.findMany({
      where: { topic_id: { in: topicIds }, status: 'APPROVED' },
    });

    const summaryData: any[] = [];

    topics.forEach(topic => {
      // Group registrations by group_id
      const groupMap = new Map<string, TopicSummaryPayload['registrations']>();
      topic.registrations.forEach(reg => {
        const gid = reg.group_id || 'no-group';
        if (!groupMap.has(gid)) groupMap.set(gid, []);
        groupMap.get(gid)!.push(reg);
      });

      groupMap.forEach((members, groupId) => {
        const actualGroupId = groupId === 'no-group' ? null : groupId;

        const studentSummaries = members.map(reg => {
          const isFailedMidterm = reg.midterm_status === 'FAIL' || reg.status === 'FAILED';

          // Safe comparison for group_id
          const fs = topic.final_scores.find(s =>
            s.student_id === reg.student_id &&
            (s.group_id === actualGroupId || (s.group_id === null && actualGroupId === null))
          );

          const studentObj = {
            ...reg.student,
            midtermStatus: reg.midterm_status,
            midtermFeedback: reg.midterm_feedback,
            registrationStatus: reg.status
          };

          if (isFailedMidterm) {
            return {
              student: studentObj,
              finalScore: fs || {
                id: `failed-midterm-${reg.student_id}`,
                student_id: reg.student_id,
                supervisor_score: 0,
                reviewer_avg_score: 0,
                pre_defense_score: 0,
                extra_points: 0,
                final_score: 0,
                grade_classification: 'Rớt giữa kỳ',
                finalized: true
              }
            };
          }

          if (!fs) {
            const studentGrades = topic.grades.filter(g => g.student_id === reg.student_id);
            const sGrades = studentGrades.filter(g => g.rater_role === RaterRole.SUPERVISOR);
            const supervisor_score = sGrades.length > 0 ? calculateWeightedScore(sGrades) : null;

            const rGrades = studentGrades.filter(g => isReviewer(g.rater_role));
            const rGraderIdsForStudent = [...new Set(rGrades.map(g => g.grader_id))];
            const rScores = rGraderIdsForStudent.map(grid => calculateWeightedScore(rGrades.filter(g => g.grader_id === grid)));
            const reviewer_avg_score = rScores.length > 0 ? rScores.reduce((a, b) => a + b, 0) / rScores.length : null;

            const cGrades = studentGrades.filter(g => isCommittee(g.rater_role));
            const cGraderIdsForStudent = [...new Set(cGrades.map(g => g.grader_id))];
            const cScores = cGraderIdsForStudent.map(grid => calculateWeightedScore(cGrades.filter(g => g.grader_id === grid)));
            const committee_score = cScores.length > 0 ? cScores.reduce((a, b) => a + b, 0) / cScores.length : null;

            const preDefenseScore = (supervisor_score !== null && reviewer_avg_score !== null)
              ? roundScore((supervisor_score + reviewer_avg_score) / 2)
              : null;

            const ep = extraPoints.find(e => e.topic_id === topic.id && e.student_id === reg.student_id);

            return {
              student: studentObj,
              finalScore: {
                id: `temp-${reg.student_id}`,
                student_id: reg.student_id,
                supervisor_score,
                reviewer_avg_score,
                committee_score,
                pre_defense_score: preDefenseScore,
                extra_points: ep?.points_requested || 0,
                final_score: null,
                finalized: false
              }
            };
          }
          return {
            student: studentObj,
            finalScore: fs
          };
        });

        const supervisorGraded = topic.grades.some(g =>
          g.rater_role === RaterRole.SUPERVISOR &&
          (g.group_id === actualGroupId || (!g.group_id && !actualGroupId))
        );

        const sIds = members.map(m => m.student_id);

        const groupGrades = topic.grades.filter(g =>
          g.group_id === actualGroupId || (!g.group_id && !actualGroupId)
        );

        // Production-grade Reviewer Check
        const reviewerAssignments = topic.assignments.filter(as => as.assignment_type === AssignmentType.REVIEWER && as.group_id === actualGroupId);
        const isReviewerComplete = reviewerAssignments.length > 0 && reviewerAssignments.every(ra =>
          sIds.every(sid =>
            groupGrades.some(g =>
              g.grader_id === ra.reviewer_id &&
              g.student_id === sid &&
              isReviewer(g.rater_role)
            )
          )
        );

        // Production-grade Committee Check
        const committeeAssignments = topic.assignments.filter(as => as.assignment_type === AssignmentType.COMMITTEE && as.group_id === actualGroupId);
        const isCommitteeComplete = committeeAssignments.length > 0 && committeeAssignments.every(ca =>
          sIds.every(sid =>
            groupGrades.some(g =>
              g.grader_id === ca.reviewer_id &&
              g.student_id === sid &&
              isCommittee(g.rater_role)
            )
          )
        );

        const reviewerGraderIds = [...new Set(groupGrades.filter(g => isReviewer(g.rater_role)).map(g => g.grader_id))];
        const committeeGraderIds = [...new Set(groupGrades.filter(g => isCommittee(g.rater_role)).map(g => g.grader_id))];
        const totalReviewersRequired = reviewerAssignments.length || topic.reviewer_required_count || 2;
        const defaultCommitteeCount = topic.defense_type === 'POSTER' ? 2 : 3;
        const totalCommitteeRequired = committeeAssignments.length || defaultCommitteeCount;

        const isGroupFinalized = studentSummaries.every(s => s.finalScore && 'finalized' in s.finalScore && s.finalScore.finalized);

        summaryData.push({
          id: actualGroupId || topic.id, // Use Group ID as primary if available
          topicId: topic.id,
          code: topic.code,
          title: topic.title,
          groupId: actualGroupId,
          groupName: members[0]?.group?.name || topic.code,
          supervisor: topic.supervisor,
          semester: topic.semester,
          registrations: members,
          students: studentSummaries,
          status: isGroupFinalized ? TopicStatus.FINALIZED : topic.status,
          gradingStatus: {
            supervisorGraded,
            reviewerGradedCount: reviewerGraderIds.length,
            totalReviewersRequired,
            isReviewerComplete,
            committeeGradedCount: committeeGraderIds.length,
            totalCommitteeRequired,
            isCommitteeComplete,
            isReadyForDecision: supervisorGraded && isReviewerComplete && isCommitteeComplete,
            isFinalized: isGroupFinalized
          }
        });
      });
    });

    const result = {
      allTopics: summaryData,
      missingSupervisor: summaryData.filter(d => !d.gradingStatus.supervisorGraded && !d.gradingStatus.isFinalized),
      missingReviewer: summaryData.filter(d => d.gradingStatus.supervisorGraded && !d.gradingStatus.isReviewerComplete && !d.gradingStatus.isFinalized),
      ready: summaryData.filter(d => d.gradingStatus.isReadyForDecision && !d.gradingStatus.isFinalized),
      finalized: summaryData.filter(d => d.gradingStatus.isFinalized),
    };

    return result;
  }

  async createGradingCriterion(userId: string, data: CreateGradingCriterionRequest) {
    // 0. Permission & Department check
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new Error('User not found');

    let targetDeptId = data.departmentId || null;

    if (user.role === UserRole.HEAD) {
      // HOD must create for their own department unless explicitly allowed otherwise
      targetDeptId = user.departmentId || null;
    } else if (user.role === UserRole.ADMIN) {
      // Admin can specify any departmentId or null for global
      targetDeptId = data.departmentId || null;
    } else {
      throw new Error('Chỉ Trưởng bộ môn hoặc Admin mới có quyền tạo tiêu chí');
    }

    // 1. Validate Canonical Role: Only SUPERVISOR, REVIEWER, COMMITTEE allowed for templates
    const roleGroup = ROLE_GROUP_MAP[data.role];
    if (!roleGroup || (data.role !== RaterRole.SUPERVISOR && data.role !== RaterRole.REVIEWER && data.role !== RaterRole.COMMITTEE)) {
      throw new Error(`Chỉ được phép tạo tiêu chí cho các vai trò chuẩn: SUPERVISOR, REVIEWER, COMMITTEE. Không được dùng vai trò định danh cụ thể như ${data.role}.`);
    }

    // 2. Check uniqueness: name + role + departmentId
    const existing = await prisma.gradingCriterion.findFirst({
      where: {
        name: data.name,
        role: data.role,
        departmentId: targetDeptId,
        active: true
      }
    });

    if (existing) {
      throw new Error(`Tiêu chí "${data.name}" đã tồn tại cho vai trò ${data.role} trong khoa này`);
    }

    // 2. Validate weights if multiple criteria exist for this role+dept
    const currentCriteria = await prisma.gradingCriterion.findMany({
      where: { role: data.role, departmentId: data.departmentId || null, active: true }
    });

    const newTotalWeight = currentCriteria.reduce((sum, c) => sum + c.weight, 0) + data.weight;
    if (newTotalWeight > 1.001) {
      throw new Error(`Tổng trọng số (${roundScore(newTotalWeight)}) vượt quá 1.0. Vui lòng điều chỉnh các tiêu chí khác trước.`);
    }

    const criterion = await prisma.gradingCriterion.create({
      data: {
        name: data.name,
        description: data.description,
        weight: data.weight,
        max_score: data.maxScore,
        min_score: data.minScore,
        role: data.role,
        order_index: data.orderIndex,
        departmentId: targetDeptId,
      },
    });

    // Create audit log
    await AuditLogger.log({
      userId,
      action: 'CREATE_CRITERION',
      entityType: 'GradingCriterion',
      entityId: criterion.id,
      newValue: criterion,
      description: `Người dùng ${userId} đã tạo tiêu chí mới: ${criterion.name}`
    });

    return criterion;
  }

  async updateGradingCriterion(userId: string, id: string, data: UpdateGradingCriterionRequest) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    const existing = await prisma.gradingCriterion.findUnique({ where: { id } });
    if (!existing) throw new Error('Không tìm thấy tiêu chí');

    // 0. Permission check
    if (user?.role === UserRole.HEAD && user.departmentId !== existing.departmentId) {
      throw new Error('Bạn không có quyền chỉnh sửa tiêu chí của bộ môn khác');
    } else if (user?.role !== UserRole.HEAD && user?.role !== UserRole.ADMIN) {
      throw new Error('Không có quyền thực hiện');
    }

    // 0.5. Stability Check: Block nếu tiêu chí đã có điểm trong học kỳ ĐANG ACTIVE
    const activeSemesterForUpdate = await prisma.semester.findFirst({ where: { status: 'ACTIVE' } });
    const hasGradesInActiveSemester = await prisma.grade.findFirst({
      where: {
        criterion_id: id,
        ...(activeSemesterForUpdate ? { topic: { semester_id: activeSemesterForUpdate.id } } : {}),
      },
    });
    if (hasGradesInActiveSemester) {
      throw new Error('Không thể chỉnh sửa tiêu chí đã được sử dụng để chấm điểm trong học kỳ hiện tại. Vui lòng tạo tiêu chí mới nếu muốn thay đổi.');
    }

    // 1. If name changes, check uniqueness
    if (data.name && data.name !== existing.name) {
      const duplicate = await prisma.gradingCriterion.findFirst({
        where: {
          name: data.name,
          role: data.role || existing.role,
          departmentId: (data.departmentId !== undefined ? data.departmentId : existing.departmentId) || null,
          active: true,
          NOT: { id }
        }
      });
      if (duplicate) throw new Error(`Tiêu chí "${data.name}" đã tồn tại`);
    }

    // 2. If weight changes, validate total weight
    if (data.weight !== undefined && data.weight !== existing.weight) {
      const others = await prisma.gradingCriterion.findMany({
        where: {
          role: existing.role,
          departmentId: existing.departmentId,
          active: true,
          NOT: { id }
        }
      });
      const newTotal = others.reduce((sum, c) => sum + c.weight, 0) + data.weight;
      if (newTotal > 1.001) {
        throw new Error(`Tổng trọng số (${roundScore(newTotal)}) vượt quá 1.0`);
      }
    }

    const updated = await prisma.gradingCriterion.update({
      where: { id },
      data: {
        name: data.name,
        description: data.description,
        weight: data.weight,
        role: data.role,
        departmentId: data.departmentId,
        order_index: data.orderIndex,
        active: data.active,
      },
    });

    // Create audit log
    await AuditLogger.log({
      userId,
      action: 'UPDATE_CRITERION',
      entityType: 'GradingCriterion',
      entityId: id,
      oldValue: existing,
      newValue: updated,
      description: `Người dùng ${userId} đã cập nhật tiêu chí: ${existing.name}`
    });

    return updated;
  }

  async deleteGradingCriterion(userId: string, id: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    const criterion = await prisma.gradingCriterion.findUnique({
      where: { id },
    });

    if (!criterion) {
      throw new Error('Criterion not found');
    }

    // 0. Permission check
    if (user?.role === UserRole.HEAD && user.departmentId !== criterion.departmentId) {
      throw new Error('Bạn không có quyền xóa tiêu chí của bộ môn khác');
    } else if (user?.role !== UserRole.HEAD && user?.role !== UserRole.ADMIN) {
      throw new Error('Không có quyền thực hiện');
    }

    // 0.5. Stability Check: Block nếu tiêu chí đã có điểm trong học kỳ ĐANG ACTIVE
    const activeSemesterForDelete = await prisma.semester.findFirst({ where: { status: 'ACTIVE' } });
    const hasGradesInActiveSemesterForDelete = await prisma.grade.findFirst({
      where: {
        criterion_id: id,
        ...(activeSemesterForDelete ? { topic: { semester_id: activeSemesterForDelete.id } } : {}),
      },
    });
    if (hasGradesInActiveSemesterForDelete) {
      throw new Error('Không thể xóa tiêu chí đã được sử dụng để chấm điểm trong học kỳ hiện tại.');
    }

    // Soft delete
    const updatedCriterion = await prisma.gradingCriterion.update({
      where: { id },
      data: {
        active: false,
      },
    });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        user_id: userId,
        action: 'DELETE_CRITERION',
        entity_type: 'GradingCriterion',
        entity_id: criterion.id,
        new_value: { active: false },
      },
    });

    return updatedCriterion;
  }

  /**
   * Clone all global criteria (departmentId=null) into HOD's department.
   * Skips criteria that already exist for the department (same name + role).
   */
  async cloneGlobalCriteriaToDepartment(userId: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new Error('User not found');
    if (user.role !== UserRole.HEAD && user.role !== UserRole.ADMIN) {
      throw new Error('Chỉ Trưởng bộ môn hoặc Admin mới có quyền thực hiện');
    }
    if (!user.departmentId) {
      throw new Error('Tài khoản chưa được gán bộ môn');
    }

    // Fetch all active global criteria
    const globalCriteria = await prisma.gradingCriterion.findMany({
      where: { departmentId: null, active: true },
      orderBy: { order_index: 'asc' },
    });

    if (globalCriteria.length === 0) {
      throw new Error('Không có tiêu chí mặc định (global) nào để sao chép');
    }

    // Fetch existing dept criteria to avoid duplicates
    const existingDeptCriteria = await prisma.gradingCriterion.findMany({
      where: { departmentId: user.departmentId, active: true },
    });

    const cloned: any[] = [];
    const skipped: string[] = [];

    for (const c of globalCriteria) {
      const alreadyExists = existingDeptCriteria.some(
        e => e.name === c.name && e.role === c.role
      );
      if (alreadyExists) {
        skipped.push(c.name);
        continue;
      }
      const created = await prisma.gradingCriterion.create({
        data: {
          name: c.name,
          description: c.description,
          weight: c.weight,
          max_score: c.max_score,
          min_score: c.min_score,
          role: c.role,
          order_index: c.order_index,
          departmentId: user.departmentId,
        },
      });
      cloned.push(created);
    }

    await AuditLogger.log({
      userId,
      action: 'CREATE_CRITERION',
      entityType: 'GradingCriterion',
      entityId: user.departmentId,
      newValue: { cloned: cloned.length, skipped: skipped.length },
      description: `HOD ${userId} đã sao chép ${cloned.length} tiêu chí global vào bộ môn`,
    });

    return { cloned: cloned.length, skipped: skipped.length, items: cloned };
  }


  async getGradingCriteria(roleFilter?: RaterRole | 'FINAL', topicId?: string, explicitDeptId?: string): Promise<any> {
    let departmentId: string | undefined = explicitDeptId;

    if (topicId) {
      const topic = await prisma.topic.findUnique({
        where: { id: topicId },
        select: { departmentId: true },
      });
      departmentId = topic?.departmentId;
    }

    const where: Prisma.GradingCriterionWhereInput = { active: true };
    where.departmentId = departmentId || null;

    if (roleFilter) {
      // Map requested role to its canonical group (e.g. REVIEWER_1 -> REVIEWER)
      let canonicalRole: RaterRole | undefined = undefined;

      if (roleFilter === 'FINAL') {
        where.criteria_type = 'FINAL';
      } else {
        const group = ROLE_GROUP_MAP[roleFilter as RaterRole] || (Object.values(RoleGroup).includes(roleFilter as any) ? roleFilter : undefined);
        if (group) {
          canonicalRole = group as unknown as RaterRole;
          where.role = canonicalRole;
        } else {
          where.role = roleFilter;
        }
      }
    }

    // Lấy học kỳ active để scope _count grades
    const activeSemesterForCount = await prisma.semester.findFirst({ where: { status: 'ACTIVE' } });

    const criteria = await prisma.gradingCriterion.findMany({
      where,
      orderBy: [
        { role: 'asc' },
        { order_index: 'asc' },
      ],
      include: {
        _count: {
          select: {
            grades: activeSemesterForCount
              ? { where: { topic: { semester_id: activeSemesterForCount.id } } }
              : true,
          },
        },
      },
    });


    // 2. Return Logic
    if (roleFilter && roleFilter !== 'FINAL') {
      // If a specific role was requested, we return a flat list
      const groupByRole = criteria.reduce((acc, c) => {
        if (!acc[c.role]) acc[c.role] = [];
        acc[c.role].push(c);
        return acc;
      }, {} as Record<string, typeof criteria>);

      const firstRoleFound = Object.keys(groupByRole)[0];
      if (!firstRoleFound && departmentId) {
        return this.getGradingCriteria(roleFilter, undefined, undefined);
      }
      return firstRoleFound ? groupByRole[firstRoleFound] : [];
    }

    // 3. Grouping logic for general (HOD) view or FINAL view
    const grouped = criteria.reduce((acc: any, criterion) => {
      const group = ROLE_GROUP_MAP[criterion.role] || criterion.role;
      if (!acc[group]) {
        acc[group] = [];
      }
      // Take the first role's criteria encountered in that group
      const existingRoleInGroup = acc[group][0]?.role;
      if (!existingRoleInGroup || existingRoleInGroup === criterion.role) {
        acc[group].push(criterion);
      }
      return acc;
    }, {} as Record<string, typeof criteria>);

    // Fallback: If empty but department specified, try global
    if (Object.keys(grouped).length === 0 && departmentId) {
      return this.getGradingCriteria(roleFilter, undefined, undefined);
    }

    return grouped;
  }

  public getGradeClassification(score: number): string {
    if (score >= 9.0) return 'A+';
    if (score >= 8.5) return 'A';
    if (score >= 8.0) return 'B+';
    if (score >= 7.0) return 'B';
    if (score >= 6.0) return 'C+';
    if (score >= 5.5) return 'C';
    if (score >= 5.0) return 'D+';
    if (score >= 4.0) return 'D';
    return 'F';
  }

  public async getPriorityCriteria(role: RaterRole, departmentId: string): Promise<GradingCriterion[]> {
    // 1. Canonical Role lookup
    const roleGroup = ROLE_GROUP_MAP[role] || RoleGroup.SUPERVISOR;
    const canonicalRole = roleGroup as unknown as RaterRole;
    const rolesInGroup = getRolesByGroup(roleGroup);

    // 0. Final Evaluation Priority - Filter by CANONICAL role and department
    const finalCriteria = await prisma.gradingCriterion.findMany({
      where: {
        active: true,
        role: canonicalRole,
        departmentId: departmentId || null
      },
      orderBy: { order_index: 'asc' },
    });

    if (finalCriteria.length > 0) {
      console.log(`[GradingService] Found ${finalCriteria.length} criteria for canonical role ${canonicalRole} (Dept: ${departmentId})`);
      return finalCriteria;
    }

    // Fallback: Global final criteria for this canonical role
    if (departmentId) {
      const globalFinalCriteria = await prisma.gradingCriterion.findMany({
        where: {
          active: true,
          role: canonicalRole,
          departmentId: null
        },
        orderBy: { order_index: 'asc' },
      });
      if (globalFinalCriteria.length > 0) {
        console.log(`[GradingService] Found ${globalFinalCriteria.length} GLOBAL criteria for canonical role ${canonicalRole}`);
        return globalFinalCriteria;
      }
    }

    // Try department-specific group criteria
    const deptCriteria = await prisma.gradingCriterion.findMany({
      where: {
        role: { in: rolesInGroup },
        departmentId,
        active: true
      },
      orderBy: { order_index: 'asc' },
    });

    if (deptCriteria.length > 0) {
      // Return the set for the FIRST encountered role in that group
      const targetRole = deptCriteria[0].role;
      return deptCriteria.filter(c => c.role === targetRole);
    }

    // 2. Fallback: Global group criteria
    const globalCriteria = await prisma.gradingCriterion.findMany({
      where: {
        role: { in: rolesInGroup },
        departmentId: null,
        active: true
      },
      orderBy: { order_index: 'asc' },
    });

    if (globalCriteria.length > 0) {
      const targetRole = globalCriteria[0].role;
      return globalCriteria.filter(c => c.role === targetRole);
    }

    throw new Error(`Không tìm thấy tiêu chí chấm điểm cho vai trò ${role}`);
  }

  public validateCriteriaWeights(criteria: GradingCriterion[]): void {
    const totalWeight = criteria.reduce((sum, c) => sum + (c.weight || 0), 0);
    // Use float tolerance for weight validation
    if (Math.abs(totalWeight - 1.0) > 0.001) {
      throw new Error(`Tổng trọng số các tiêu chí cho vai trò này phải bằng 1.0 (Hiện tại: ${roundScore(totalWeight)})`);
    }
  }

  public async checkAllReviewersGraded(topicId: string): Promise<boolean> {
    const topic = await prisma.topic.findUnique({
      where: { id: topicId },
      include: {
        assignments: {
          where: {
            assignment_type: 'REVIEWER',
            status: { in: [AssignmentStatus.ACCEPTED, AssignmentStatus.AUTO_ACCEPTED] },
          },
        },
        grades: {
          where: {
            rater_role: {
              in: getRolesByGroup(RoleGroup.REVIEWER),
            },
          },
        },
      },
    });

    if (!topic) return false;

    const reviewerIds = topic.assignments.map(a => a.reviewer_id);
    const gradedReviewerIds = [...new Set(topic.grades.map(g => g.grader_id))];

    return reviewerIds.length > 0 && reviewerIds.every(id => gradedReviewerIds.includes(id));
  }

  public async checkAllCommitteeGraded(topicId: string): Promise<boolean> {
    const topic = await prisma.topic.findUnique({
      where: { id: topicId },
      include: {
        assignments: {
          where: {
            assignment_type: 'COMMITTEE',
            status: { in: [AssignmentStatus.ACCEPTED, AssignmentStatus.AUTO_ACCEPTED] },
          },
        },
        grades: {
          where: {
            rater_role: {
              in: getRolesByGroup(RoleGroup.COMMITTEE),
            },
          },
        },
      },
    });

    if (!topic) return false;

    const committeeIds = topic.assignments.map(a => a.reviewer_id);
    const gradedCommitteeIds = [...new Set(topic.grades.map(g => g.grader_id))];

    return committeeIds.length > 0 && committeeIds.every(id => gradedCommitteeIds.includes(id));
  }

  private async checkAllFinalGraded(topicId: string, studentId: string): Promise<boolean> {
    const topic = await prisma.topic.findUnique({
      where: { id: topicId },
      include: {
        assignments: {
          where: {
            status: { in: ['ACCEPTED', 'AUTO_ACCEPTED'] }
          }
        },
        grades: {
          where: { student_id: studentId }
        }
      }
    });

    if (!topic) return false;

    // 1. Supervisor?
    const hasSupervisor = topic.grades.some(g => g.rater_role === RaterRole.SUPERVISOR);

    // 2. Reviewer? (Strictly MUST HAVE 2 reviewers graded)
    const gradedReviewerIds = [...new Set(topic.grades
      .filter(g => isReviewer(g.rater_role))
      .map(g => g.grader_id))];

    const isReviewerDone = gradedReviewerIds.length === 2;

    // 3. Committee?
    const committeeAssignedIds = topic.assignments
      .filter(a => a.assignment_type === AssignmentType.COMMITTEE)
      .map(a => a.reviewer_id);

    const committeeGradedIds = [...new Set(topic.grades
      .filter(g => isCommittee(g.rater_role))
      .map(g => g.grader_id))];

    const isCommitteeDone = committeeAssignedIds.length > 0 && committeeAssignedIds.every(id => committeeGradedIds.includes(id));

    return hasSupervisor && isReviewerDone && isCommitteeDone;
  }

  // =====================================================
  // UC07: MIDTERM GRADING (PASS/FAIL) - Only GVHD can grade
  // =====================================================

  async updateMidtermStatus(
    userId: string,
    registrationId: string,
    status: MidtermStatus,
    feedback?: string
  ) {
    // Get registration with topic
    const registration = await prisma.topicRegistration.findUnique({
      where: { id: registrationId },
      include: {
        topic: true,
        group: {
          include: {
            members: {
              where: { status: 'ACCEPTED' },
              include: { user: true },
            },
          },
        },
      },
    });

    if (!registration) {
      throw new Error(ERROR_CODES.NOT_FOUND);
    }

    // Check academic policy
    const semester = await prisma.semester.findUnique({ where: { id: registration.semester_id } });
    if (!semester) throw new Error('Semester not found');
    AcademicPolicy.enforce(AcademicAction.GRADE_MIDTERM, { id: userId, role: UserRole.LECTURER }, semester);

    // Check if user is the GVHD (supervisor) of this topic
    if (registration.topic.supervisor_id !== userId) {
      throw new Error('Only the supervisor (GVHD) of this topic can grade midterm');
    }

    // Check if registration is CONFIRMED or FAILED
    if (registration.status !== 'CONFIRMED' && registration.status !== 'FAILED') {
      throw new Error('Can only grade midterm for confirmed or failed registrations');
    }

    // Update midterm status ONLY for this specific registration
    await prisma.topicRegistration.update({
      where: { id: registrationId },
      data: {
        midterm_status: status,
        midterm_feedback: feedback || null,
        midterm_graded_at: new Date(),
        // Hard Status update:
        status: status === 'FAIL' ? RegistrationStatus.FAILED : RegistrationStatus.CONFIRMED,
        student_progress_status: status === 'FAIL' ? StudentProgressStatus.MIDTERM_FAILED : StudentProgressStatus.HAS_TOPIC,
      },
    });

    // Fetch updated registration for return value
    const updatedRegistration = await prisma.topicRegistration.findUnique({
      where: { id: registrationId },
    });

    // Notify only the graded student
    const memberIds = [registration.student_id];

    await notificationService.notifyBulkMidtermStatusUpdated(
      memberIds,
      registration.topic.title,
      status
    );

    // Create audit log
    await prisma.auditLog.create({
      data: {
        user_id: userId,
        action: 'GRADE_MIDTERM',
        entity_type: 'TopicRegistration',
        entity_id: registrationId,
        new_value: { midterm_status: status, feedback },
      },
    });

    // Notify the graded student
    await prisma.notification.create({
      data: {
        user_id: registration.student_id,
        type: status === MidtermStatus.PASS ? 'SUCCESS' : 'WARNING',
        title: 'Kết quả đánh giá giữa kỳ',
        content: status === MidtermStatus.PASS
          ? 'Bạn đã PASS đánh giá giữa kỳ. Hãy tiếp tục hoàn thành khóa luận!'
          : `Bạn đã FAIL đánh giá giữa kỳ. ${feedback || 'Vui lòng liên hệ GVHD để biết thêm chi tiết.'}`,
        related_id: registrationId,
      },
    });

    GradingService.clearGradeSummaryCache();
    return updatedRegistration;
  }

  // Helper to compute permissions for a topic/registration
  private getTopicPermissions(user: { id: string; role: UserRole }, semester: any, registration?: any) {
    const actions = [
      AcademicAction.GRADE_MIDTERM,
      AcademicAction.GRADE_SUPERVISOR,
      AcademicAction.GRADE_REVIEWER,
      AcademicAction.GRADE_COMMITTEE,
    ];

    const permissions: Record<string, any> = {};
    for (const action of actions) {
      const result = AcademicPolicy.canPerform(action, user, semester, registration);
      const key = action.toLowerCase();
      permissions[key] = result.allowed;
      permissions[`${key}_code`] = result.code;
      permissions[`${key}_reason`] = result.reason;
    }

    return permissions;
  }

  // Get registrations for midterm grading (for GVHD)
  // Business rule: No group → no midterm grading
  // Show one entry per group (not per student) to avoid duplicates
  async getRegistrationsForMidtermGrading(userId: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new Error(ERROR_CODES.USER_NOT_FOUND);

    const registrations = await prisma.topicRegistration.findMany({
      where: {
        status: { in: ['CONFIRMED', 'FAILED'] },
        topic: {
          supervisor_id: userId,
          current_students: { gt: 0 },
        },
      },
      include: {
        topic: {
          select: {
            id: true,
            title: true,
            supervisor_id: true,
            semester: true,
          },
        },
        student: {
          select: {
            id: true,
            full_name: true,
            student_code: true,
            email: true,
            avatar_url: true,
          },
        },
        group: {
          include: {
            members: {
              where: { status: 'ACCEPTED' },
              include: {
                user: {
                  select: {
                    id: true,
                    full_name: true,
                    student_code: true,
                    email: true,
                    avatar_url: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: { registered_at: 'desc' },
    });

    // Attach permissions to all registrations (one row per student)
    const result = [];

    for (const reg of registrations) {
      const permissions = this.getTopicPermissions(
        { id: userId, role: user.role },
        reg.topic.semester,
        reg
      );

      result.push({
        ...reg,
        permissions
      });
    }

    return result;
  }

  /**
   * Get all grades for a topic, grouped by rater and student.
   * This is used by the HEAD/ADMIN to see a comprehensive breakdown of all scores.
   */
  async getGrades(userId: string, id: string) {
    let topicId = id;

    // Support passing groupId instead of topicId
    const group = await prisma.group.findUnique({
      where: { id },
      select: { topic_id: true }
    });

    if (group && group.topic_id) {
      topicId = group.topic_id;
    }

    const [topic, user] = await Promise.all([
      prisma.topic.findUnique({
        where: { id: topicId },
        include: {
          semester: true,
          supervisor: { select: { id: true, full_name: true, role: true, avatar_url: true } },
          assignments: {
            include: {
              reviewer: { select: { id: true, full_name: true, role: true, avatar_url: true } }
            }
          },
          registrations: {
            select: {
              id: true,
              group_id: true,
              student_id: true,
              midterm_status: true,
              midterm_feedback: true,
              status: true,
              student: true,
              topic: {
                select: {
                  id: true,
                  is_eligible_for_defense: true,
                  is_locked: true,
                  progress_stage: true,
                  grades: true,
                }
              }
            }
          }
        }
      }),
      prisma.user.findUnique({ where: { id: userId } })
    ]);

    if (!topic) throw new Error(ERROR_CODES.TOPIC_NOT_FOUND);
    if (!user) throw new Error(ERROR_CODES.USER_NOT_FOUND);

    const allGrades = await prisma.grade.findMany({
      where: { topic_id: topicId },
      include: {
        criterion: true,
        grader: { select: { id: true, full_name: true, role: true, avatar_url: true } },
      },
      orderBy: { graded_at: 'asc' },
    });

    const pendingRequests = await prisma.gradeChangeRequest.findMany({
      where: {
        topic_id: topicId,
        status: 'PENDING',
      },
      include: {
        criterion: true,
        grader: { select: { id: true, full_name: true, role: true, avatar_url: true } },
      },
    });

    const mappedPending = pendingRequests.map(r => ({
      id: r.id,
      topic_id: r.topic_id,
      student_id: r.student_id,
      grader_id: r.grader_id,
      criterion_id: r.criterion_id,
      rater_role: r.rater_role,
      reviewer_order: r.rater_role?.startsWith('REVIEWER_') ? parseInt(r.rater_role.split('_')[1]) : undefined,
      score: r.new_score,
      comments: r.reason,
      graded_at: r.created_at,
      updated_at: r.updated_at,
      criterion: r.criterion,
      grader: r.grader,
      isPending: true,
    }));

    const filteredExisting = allGrades.filter(eg => {
      const hasPendingOverride = pendingRequests.some(pr =>
        pr.grader_id === eg.grader_id &&
        pr.student_id === eg.student_id &&
        pr.criterion_id === eg.criterion_id
      );
      return !hasPendingOverride;
    });

    const combinedAllGrades = [...filteredExisting, ...mappedPending];

    // Helper to group grades by grader and student
    const groupGrades = (grades: any[]) => {
      const grouped = new Map<string, any>();

      grades.forEach(g => {
        const key = `${g.grader_id}-${g.student_id || 'topic'}`;

        let cleanedComment = g.comments?.replace(/\s*\[META_DATA:.*\]/, '') || null;
        let generalComment: string | null = null;
        if (g.comments) {
          const metaMatch = g.comments.match(/\[META_DATA:(.*)\]/);
          if (metaMatch) {
            try {
              const meta = JSON.parse(metaMatch[1]);
              generalComment = meta.generalComment || null;
            } catch { }
          }
        }

        if (!grouped.has(key)) {
          grouped.set(key, {
            id: g.id,
            topic_id: g.topic_id,
            rater_id: g.grader_id,
            rater_name: g.grader.full_name,
            rater_role: g.rater_role,
            student_id: g.student_id,
            reviewer_order: g.reviewer_order,
            scores: [],
            submitted_at: g.graded_at,
            comments: generalComment || null,
          });
        }

        const entry = grouped.get(key);
        if (generalComment && !entry.comments) {
          entry.comments = generalComment;
        }

        entry.scores.push({
          criterion_id: g.criterion_id,
          score: g.score,
          comment: cleanedComment,
          createdAt: g.graded_at,
          updatedAt: g.updated_at,
          isPending: (g as any).isPending || false,
        });

        if (new Date(g.graded_at) > new Date(entry.submitted_at)) {
          entry.submitted_at = g.graded_at;
        }
      });

      return Array.from(grouped.values());
    };

    const groupedGrades = groupGrades(combinedAllGrades);

    const reviewerGrades = groupedGrades.filter(g => isReviewer(g.rater_role));
    const councilGrades = groupedGrades.filter(g => isCommittee(g.rater_role));

    // Get assignments breakdown
    const reviewerAssignments = topic.assignments
      .filter(a => a.assignment_type === 'REVIEWER')
      .map(a => ({ ...a, reviewer: a.reviewer }));

    const councilAssignments = topic.assignments
      .filter(a => a.assignment_type === 'COMMITTEE')
      .map(a => ({ ...a, reviewer: a.reviewer }));

    const finalScores = await prisma.finalScore.findMany({
      where: { topic_id: topicId },
      include: { student: true },
    });

    const permissions = this.getTopicPermissions(
      { id: userId, role: user.role },
      topic.semester,
      topic.registrations[0]
    );

    const isPrivilegedUser = user.role === UserRole.HEAD || user.role === UserRole.COORDINATOR || user.role === UserRole.ADMIN || user.role === UserRole.STUDENT;
    const finalScoresToReturn = isPrivilegedUser ? finalScores : [];

    const students = topic.registrations.map(reg => {
      const fs = isPrivilegedUser ? finalScores.find(s => s.student_id === reg.student_id) : undefined;
      return {
        ...reg.student,
        className: (reg.student as any).class_name,
        class_name: (reg.student as any).class_name,
        midterm_status: reg.midterm_status,
        midtermFeedback: reg.midterm_feedback,
        registrationStatus: reg.status,
        groupId: reg.group_id,
        finalScore: fs
      };
    });

    // Calculate grading status for the frontend
    const supervisorGraded = allGrades.some((g: any) => g.rater_role === RaterRole.SUPERVISOR);
    const sIds = topic.registrations.map(r => r.student_id);

    const isReviewerComplete = reviewerAssignments.length > 0 && reviewerAssignments.every(ra =>
      sIds.every(sid =>
        allGrades.some((g: any) =>
          g.grader_id === ra.reviewer_id &&
          g.student_id === sid &&
          isReviewer(g.rater_role)
        )
      )
    );

    const isCommitteeComplete = councilAssignments.length > 0 && councilAssignments.every(ca =>
      sIds.every(sid =>
        allGrades.some((g: any) =>
          g.grader_id === ca.reviewer_id &&
          g.student_id === sid &&
          isCommittee(g.rater_role)
        )
      )
    );

    const reviewerGraderIds = [...new Set(allGrades.filter((g: any) => isReviewer(g.rater_role)).map((g: any) => g.grader_id))];
    const committeeGraderIds = [...new Set(allGrades.filter((g: any) => isCommittee(g.rater_role)).map((g: any) => g.grader_id))];

    const totalReviewersRequired = reviewerAssignments.length || topic.reviewer_required_count || 2;
    const defaultCommitteeCount = topic.defense_type === 'POSTER' ? 2 : 3;
    const totalCommitteeRequired = councilAssignments.length || defaultCommitteeCount;

    const isGroupFinalized = finalScores.length > 0 && finalScores.every(fs => fs.finalized);

    const gradingStatus = {
      supervisorGraded,
      reviewerGradedCount: reviewerGraderIds.length,
      totalReviewersRequired,
      isReviewerComplete,
      committeeGradedCount: committeeGraderIds.length,
      totalCommitteeRequired,
      isCommitteeComplete,
      isReadyForDecision: supervisorGraded && isReviewerComplete && isCommitteeComplete,
      isFinalized: isGroupFinalized
    };

    return {
      advisorGrades: groupedGrades.filter(g => g.rater_role === RaterRole.SUPERVISOR),
      reviewerGrades,
      councilGrades,
      reviewerAssignments,
      councilAssignments,
      finalScores: finalScoresToReturn,
      permissions,
      gradingStatus, // Add this!
      topic: { ...topic, students, gradingStatus }, // Also add to topic object just in case
    };
  }

  async getMyGrades(userId: string, id: string, raterRole?: RaterRole) {
    let topicId = id;

    // Support passing groupId instead of topicId
    const group = await prisma.group.findUnique({
      where: { id },
      select: { topic_id: true }
    });

    if (group && group.topic_id) {
      topicId = group.topic_id;
    }

    // Fetch grades by this grader for this topic (filtered by role if provided)
    // Fetch grades by this grader for this topic (filtered by role if provided)
    const where: Prisma.GradeWhereInput = {
      topic_id: topicId,
      grader_id: userId,
    };
    if (raterRole) {
      if (isCommittee(raterRole)) {
        where.rater_role = { in: getRolesByGroup(RoleGroup.COMMITTEE) };
      } else {
        where.rater_role = raterRole;
      }
    }

    const grades = await prisma.grade.findMany({
      where,
      include: {
        criterion: true,
        student: {
          select: { id: true, full_name: true, student_code: true },
        },
      },
      orderBy: { criterion: { order_index: 'asc' } },
    });

    // Fetch all grades for this topic to check completion statuses of other roles
    const allTopicGrades = await prisma.grade.findMany({
      where: { topic_id: topicId }
    });

    // Get grader info
    const grader = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, full_name: true, role: true, avatar_url: true },
    });

    if (!grader) throw new Error(ERROR_CODES.USER_NOT_FOUND);

    // Get topic and semester info
    const topic = await prisma.topic.findUnique({
      where: { id: topicId },
      include: { semester: true },
    });

    if (!topic) throw new Error(ERROR_CODES.TOPIC_NOT_FOUND);

    // Get list of students registered for this topic (exclude failed students)
    const registrations = await prisma.topicRegistration.findMany({
      where: {
        topic_id: topicId,
        NOT: [
          { midterm_status: 'FAIL' },
          { status: 'FAILED' }
        ]
      },
      select: {
        id: true,
        group_id: true,
        student_id: true,
        midterm_status: true,
        student: true,
        topic: {
          select: {
            id: true,
            is_eligible_for_defense: true,
            is_locked: true,
            progress_stage: true,
            grades: true, // Needed for AcademicPolicy.isTopicFailed
          }
        }
      },
    });

    // Compute permissions for this user on this topic
    const permissions = this.getTopicPermissions(
      { id: userId, role: grader.role },
      topic.semester,
      registrations[0] // Context for policy check
    );

    // Fetch pending change requests for this grader and topic
    const pendingRequests = await prisma.gradeChangeRequest.findMany({
      where: {
        topic_id: topicId,
        grader_id: userId,
        status: 'PENDING',
      },
      include: {
        criterion: true,
      },
    });

    // Group grades by student_id
    const studentGradesMap = new Map<string, typeof grades>();
    grades.forEach(g => {
      const sid = g.student_id || 'unknown';
      if (!studentGradesMap.has(sid)) {
        studentGradesMap.set(sid, []);
      }
      studentGradesMap.get(sid)!.push(g);
    });

    // Fetch audit logs
    // Fetch detailed grade history for auditing (per student/grader)
    const gradeHistory = await (prisma.gradeHistory as any).findMany({
      where: {
        topic_id: topicId,
        grader_id: userId
      },
      include: {
        grader: { select: { full_name: true } },
        criterion: { select: { name: true } },
        student: { select: { full_name: true } }
      },
      orderBy: { changed_at: 'desc' },
      take: 20,
    });

    // Build per-student result
    const students = registrations.map(reg => {
      const studentId = reg.student_id;
      const studentInfo = reg.student;
      const sGrades = studentGradesMap.get(studentId) || [];
      const sPending = pendingRequests.filter(r => r.student_id === studentId);

      const isPending = sPending.length > 0;
      const combinedGradesMap = new Map<string, any>();

      // First populate with existing grades
      sGrades.forEach(g => {
        combinedGradesMap.set(g.criterion_id, {
          id: g.id,
          criterionId: g.criterion_id,
          criterionName: g.criterion.name,
          criterionDescription: g.criterion.description,
          criterionWeight: g.criterion.weight,
          criterionMaxScore: g.criterion.max_score,
          criterionMinScore: g.criterion.min_score,
          score: g.score,
          comment: g.comments?.replace(/\s*\[META_DATA:.*\]/, '') || null,
          createdAt: g.graded_at,
          updatedAt: g.updated_at,
        });
      });

      // Override with pending change requests
      sPending.forEach(r => {
        combinedGradesMap.set(r.criterion_id, {
          id: r.id,
          criterionId: r.criterion_id,
          criterionName: r.criterion.name,
          criterionDescription: r.criterion.description,
          criterionWeight: r.criterion.weight,
          criterionMaxScore: r.criterion.max_score,
          criterionMinScore: r.criterion.min_score,
          score: r.new_score,
          comment: r.reason,
          createdAt: r.created_at,
          updatedAt: r.updated_at,
          isPending: true,
        });
      });

      const mergedGrades = Array.from(combinedGradesMap.values());

      // Extract metadata from the first grade comment
      let generalComment: string | null = null;
      const firstGrade = sGrades[0] || sPending[0];
      if (firstGrade) {
        const comments = (firstGrade as any).comments || (firstGrade as any).reason;
        if (comments) {
          const metaMatch = comments.match(/\[META_DATA:(.*)\]/);
          if (metaMatch) {
            try {
              const meta = JSON.parse(metaMatch[1]);
              generalComment = meta.generalComment || null;
            } catch { }
          }
        }
      }

      const studentGrades = allTopicGrades.filter(g => g.student_id === studentId);
      const hasSupervisorGraded = studentGrades.some(g => g.rater_role?.startsWith('SUPERVISOR'));
      const hasReviewerGraded = studentGrades.some(g => g.rater_role?.startsWith('REVIEWER'));

      const hasGrades = sGrades.length > 0;
      const status = isPending
        ? ('PENDING_APPROVAL' as const)
        : (hasGrades ? ('SUBMITTED' as const) : ('NOT_GRADED' as const));

      return {
        studentId,
        fullName: studentInfo.full_name,
        studentCode: studentInfo.student_code,
        className: studentInfo.class_name,
        class_name: studentInfo.class_name,
        status,
        gradedAt: sGrades[0]?.graded_at || sPending[0]?.created_at || null,
        raterRole: sGrades[0]?.rater_role || sPending[0]?.rater_role || null,
        generalComment,
        grades: mergedGrades,
        raterStatuses: {
          hasSupervisorGraded,
          hasReviewerGraded
        }
      };
    });

    return {
      grader,
      students,
      permissions,
      gradeHistory: gradeHistory.map((h: any) => ({
        id: h.id,
        graderName: h.grader?.full_name,
        studentName: h.student?.full_name,
        criterionName: h.criterion?.name,
        oldScore: h.old_score,
        newScore: h.new_score,
        reason: h.reason,
        createdAt: h.changed_at
      })),
    };
  }

  /**
   * Automatically evaluates if a topic is eligible for defense or should be failed.
   */
  private async autoEvaluateEligibility(topicId: string) {
    const topic = await prisma.topic.findUnique({
      where: { id: topicId },
      include: {
        grades: true,
        final_scores: true,
        semester: true,
        assignments: { where: { assignment_type: 'REVIEWER' } },
        registrations: { where: { midterm_status: 'PASS' } },
      },
    });

    if (!topic || topic.is_eligible_for_defense !== null) return;

    // 1. Re-compute final scores to get latest averages and use the returned values directly
    const finalScores = await this.computeFinalScore(topicId);

    const activeRegs = topic.registrations || [];
    if (activeRegs.length === 0) return;

    const hasScoresForAll = activeRegs.every(reg =>
      finalScores.some(fs => fs.student_id === reg.student_id)
    );
    if (!hasScoresForAll) return;

    // 2. Logic: Automatic Eligibility Assessment
    const supervisorGraded = topic.grades.some(g => g.rater_role === 'SUPERVISOR');
    const reviewerGraderIds = [...new Set(topic.grades.filter(g => isReviewer(g.rater_role)).map(g => g.grader_id))];
    const totalReviewersRequired = topic.assignments.length || topic.reviewer_required_count || 2;
    const isReviewerComplete = reviewerGraderIds.length >= totalReviewersRequired;

    // 3. Auto-Pass check: All required grades are in and all are >= 6.0
    if (supervisorGraded && isReviewerComplete) {
      const allPassed = activeRegs.every(reg => {
        const fs = finalScores.find(f => f.student_id === reg.student_id);
        return fs &&
          fs.supervisor_score !== null && fs.supervisor_score >= 6 &&
          fs.reviewer_avg_score !== null && fs.reviewer_avg_score >= 6;
      });

      if (allPassed) {
        await this.setTopicEligibility(topicId, true, 'Tất cả sinh viên trong đề tài đều đạt điểm hướng dẫn và phản biện từ 6.0 trở lên.');
      }
    }
  }

  private async setTopicEligibility(topicId: string, isEligible: boolean, reason?: string) {
    await prisma.topic.update({
      where: { id: topicId },
      data: {
        is_eligible_for_defense: isEligible,
        progress_stage: isEligible ? 'READY_FOR_DEFENSE' : 'DONE',
        status: isEligible ? TopicStatus.REGISTERED : TopicStatus.COMPLETED,
        defense_type: isEligible ? 'ORAL' : null,
      },
    });

    await prisma.auditLog.create({
      data: {
        user_id: null,
        action: 'AUTO_EVALUATE_ELIGIBILITY',
        entity_type: 'Topic',
        entity_id: topicId,
        new_value: { isEligible, reason },
        description: `Hệ thống tự động đánh giá điều kiện bảo vệ: ${isEligible ? 'Đủ điều kiện' : 'Không đủ điều kiện'}. Lý do: ${reason || 'Điểm trung bình đạt yêu cầu.'}`
      }
    });
  }
  /**
   * Create a grade change request for HOD approval
   */
  public async requestGradeChange(
    userId: string,
    data: SubmitGradeRequest,
    raterRole: RaterRole,
    existingGrades: any[],
    topicId: string,
    studentId?: string
  ) {
    console.log(`[GradingService] Creating change request for topic ${topicId}. Global reason: "${data.reason}", student: ${studentId}`);

    const requests = await Promise.all(
      data.grades.map(async (g) => {
        const existing = existingGrades.find(eg => eg.criterion_id === g.criterionId);
        const newScore = roundScore(g.score);

        // Only create request if score actually changed
        if (existing && existing.score === newScore) return null;

        return prisma.gradeChangeRequest.create({
          data: {
            topic_id: topicId,
            student_id: studentId || data.studentId || '',
            grader_id: userId,
            criterion_id: g.criterionId,
            rater_role: raterRole,
            old_score: existing?.score || null,
            new_score: newScore,
            reason: data.reason || g.comments || 'Cập nhật điểm sau thời hạn',
            status: 'PENDING'
          }
        });
      })
    );

    const createdRequests = requests.filter(r => r !== null);

    // Notify HOD
    const topic = await prisma.topic.findUnique({ where: { id: topicId }, select: { departmentId: true } });
    const grader = await prisma.user.findUnique({ where: { id: userId }, select: { full_name: true } });
    const studentInfo = await prisma.user.findUnique({ where: { id: studentId || data.studentId || '' }, select: { full_name: true } });

    if (topic?.departmentId && grader && studentInfo) {
      await notificationService.notifyGradeChangeRequested(
        studentInfo.full_name,
        grader.full_name,
        topic.departmentId,
        topicId
      );
    }

    return {
      message: 'Đã gửi yêu cầu sửa điểm tới Trưởng bộ môn phê duyệt.',
      status: 'PENDING_APPROVAL',
      requestCount: createdRequests.length
    };
  }

  /**
   * Get pending requests for HOD
   */
  public async getPendingGradeChangeRequests(departmentId: string) {
    return prisma.gradeChangeRequest.findMany({
      where: {
        status: 'PENDING',
        topic: { departmentId }
      },
      include: {
        grader: { select: { id: true, full_name: true } },
        student: { select: { id: true, full_name: true, student_code: true } },
        topic: { select: { id: true, title: true } },
        criterion: true
      },
      orderBy: { created_at: 'desc' }
    });
  }

  /**
   * Approve a grade change request
   */
  public async approveGradeChangeRequest(hodId: string, requestId: string) {
    const request = await prisma.gradeChangeRequest.findUnique({
      where: { id: requestId },
      include: { topic: true }
    });

    if (!request) throw new Error('Không tìm thấy yêu cầu');

    // Check permission (HOD of the same department)
    const hod = await prisma.user.findUnique({ where: { id: hodId } });
    if (hod?.role !== UserRole.HEAD || hod.departmentId !== request.topic.departmentId) {
      throw new Error(ERROR_CODES.FORBIDDEN);
    }

    // 1. Update the actual Grade
    const existingGrade = await prisma.grade.findFirst({
      where: {
        topic_id: request.topic_id,
        student_id: request.student_id as string,
        criterion_id: request.criterion_id as string,
        rater_role: request.rater_role,
        grader_id: request.grader_id
      }
    });

    if (existingGrade) {
      await prisma.grade.update({
        where: { id: existingGrade.id },
        data: {
          score: request.new_score ?? undefined,
          comments: request.reason
        }
      });
    } else {
      await prisma.grade.create({
        data: {
          topic_id: request.topic_id,
          student_id: request.student_id as string,
          grader_id: request.grader_id,
          criterion_id: request.criterion_id as string,
          rater_role: request.rater_role,
          score: request.new_score as number,
          comments: request.reason
        }
      });
    }

    // 2. Log History
    await prisma.gradeHistory.create({
      data: {
        student_id: request.student_id as string,
        grader_id: request.grader_id,
        topic_id: request.topic_id,
        criterion_id: request.criterion_id as string,
        old_score: request.old_score ?? undefined,
        new_score: request.new_score as number,
        reason: `[Phê duyệt bởi HOD] ${request.reason}`,
        rater_role: request.rater_role
      }
    });

    // Write to central Audit Log
    await AuditLogger.log({
      userId: hodId,
      action: 'APPROVE_GRADE_CHANGE',
      entityType: 'GRADE',
      entityId: request.topic_id,
      oldValue: {
        score: request.old_score,
        grader_id: request.grader_id,
        student_id: request.student_id,
        criterion_id: request.criterion_id,
      },
      newValue: {
        score: request.new_score,
        approved_by: hodId,
      },
      reason: request.reason,
      description: `Phê duyệt yêu cầu sửa điểm của GV (ID: ${request.grader_id}) cho SV (ID: ${request.student_id}) đối với tiêu chí (ID: ${request.criterion_id}). Điểm cũ: ${request.old_score ?? 'Chưa có'}, Điểm mới: ${request.new_score}. Lý do: ${request.reason}`,
    });

    // 3. Update Request status
    const updatedRequest = await prisma.gradeChangeRequest.update({
      where: { id: requestId },
      data: {
        status: 'APPROVED',
        reviewed_by: hodId,
        reviewed_at: new Date()
      }
    });

    // 4. Notify Grader
    await notificationService.createNotification(
      request.grader_id,
      'GRADE_CHANGE_APPROVED',
      'Yêu cầu sửa điểm đã được duyệt',
      `Trưởng bộ môn đã phê duyệt thay đổi điểm cho sinh viên.`,
      request.topic_id
    );

    // 5. Re-calculate final score
    await this.computeFinalScore(request.topic_id);

    return updatedRequest;
  }

  /**
   * Reject a grade change request
   */
  public async rejectGradeChangeRequest(hodId: string, requestId: string, reason: string) {
    const request = await prisma.gradeChangeRequest.findUnique({
      where: { id: requestId },
      include: { topic: true }
    });

    if (!request) throw new Error('Không tìm thấy yêu cầu');

    const updatedRequest = await prisma.gradeChangeRequest.update({
      where: { id: requestId },
      data: {
        status: 'REJECTED',
        reviewed_by: hodId,
        reviewed_at: new Date(),
        rejection_reason: reason
      }
    });

    // Notify Grader
    await notificationService.createNotification(
      request.grader_id,
      'GRADE_CHANGE_REJECTED',
      'Yêu cầu sửa điểm bị từ chối',
      `Trưởng bộ môn đã từ chối yêu cầu sửa điểm. Lý do: ${reason}`,
      request.topic_id
    );

    return updatedRequest;
  }

  /**
   * Helper to determine if a rater is past their specific milestone (deadline)
   * Milestone logic:
   * - Supervisor: Past if phase === FINAL
   * - Reviewer: Past if phase >= DEFENSE
   * - Council: Past if phase === FINAL
   */
  private isPastMilestone(
    role: RaterRole,
    phase: SemesterPhase
  ): boolean {
    // Phase-based locking is the cleanest and most intuitive approach.
    // The "Semester Ceiling" logic in SemesterGuard handles the timing boundaries.

    switch (role) {
      case RaterRole.SUPERVISOR:
        // Supervisor can grade until the REVIEWING phase ends (locked when DEFENSE or FINAL starts).
        return phase === SemesterPhase.DEFENSE || phase === SemesterPhase.FINAL;

      case RaterRole.REVIEWER:
      case RaterRole.REVIEWER_1:
      case RaterRole.REVIEWER_2:
      case RaterRole.REVIEWER_3:
        // Reviewers are locked when the Council Defense phase starts.
        return phase === SemesterPhase.DEFENSE || phase === SemesterPhase.FINAL;

      case RaterRole.COMMITTEE:
      case RaterRole.COMMITTEE_CHAIR:
      case RaterRole.COMMITTEE_SECRETARY:
      case RaterRole.COMMITTEE_MEMBER:
      case RaterRole.COMMITTEE_MEMBER_1:
      case RaterRole.COMMITTEE_MEMBER_2:
      case RaterRole.POSTER_COMMITTEE:
      case RaterRole.ORAL_COMMITTEE:
        // Council is locked when the Defense phase ends (moves to FINAL).
        return phase === SemesterPhase.FINAL;


      default:
        return false;
    }
  }
}

export default new GradingService();



