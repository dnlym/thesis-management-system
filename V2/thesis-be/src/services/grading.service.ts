import prisma from '../config/database';
import { RaterRole, TopicStatus, StudentProgressStatus, MidtermStatus, AssignmentType, SemesterPhase, GradingCriterion, UserRole, AssignmentStatus, ProgressStage } from '@prisma/client';
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
import notificationService from './notification.service';


export class GradingService {
  async submitGrade(userId: string, data: SubmitGradeRequest, raterRole: RaterRole) {
    // Verify topic
    const topic = await prisma.topic.findUnique({
      where: { id: data.topicId },
      include: {
        assignments: true,
        registrations: true,
        grades: true,
      },
    });

    if (!topic) {
      throw new Error(ERROR_CODES.TOPIC_NOT_FOUND);
    }

    // Determine academic action based on role
    let action = AcademicAction.GRADE_REVIEWER;
    if (raterRole === RaterRole.SUPERVISOR) {
      action = AcademicAction.GRADE_SUPERVISOR;
    } else if (isCommittee(raterRole)) {
      action = AcademicAction.GRADE_COMMITTEE;
    }

    // Check semester phase via AcademicPolicy
    const [semester, user] = await Promise.all([
      prisma.semester.findUnique({ where: { id: topic.semester_id } }),
      prisma.user.findUnique({ where: { id: userId } })
    ]);

    if (!user) throw new Error(ERROR_CODES.FORBIDDEN);

    AcademicPolicy.enforce(action, { id: userId, role: user.role as UserRole }, semester);

    // Verify user has permission to grade using helpers
    let hasPermission = false;
    if (raterRole === RaterRole.SUPERVISOR) {
      hasPermission = await isSupervisor(userId, data.topicId);
    } else if (isReviewer(raterRole)) {
      hasPermission = await isReviewerPermission(userId, data.topicId);
    } else if (isCommittee(raterRole)) {
      hasPermission = await isCommitteeMember(userId, data.topicId);
    }

    if (!hasPermission) {
      throw new Error(ERROR_CODES.FORBIDDEN);
    }

    // [PRODUCTION GUARD] Dependency Chain
    if (isReviewer(raterRole)) {
      const hasSupervisor = (topic as any).grades.some((g: any) =>
        g.rater_role === RaterRole.SUPERVISOR && g.student_id === (data.studentId || null)
      );
      if (!hasSupervisor) {
        throw new Error('GVHD chưa chấm điểm cho sinh viên này. Không thể chấm phản biện.');
      }
    }

    if (isCommittee(raterRole)) {
      if (!(topic as any).is_eligible_for_defense) {
        throw new Error('Đề tài chưa được duyệt đủ điều kiện bảo vệ hoặc chưa có quyết định từ Trưởng bộ môn.');
      }
    }

    // Get defense type from topic
    const defenseType = (topic as any).defense_type || 'ORAL';

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
    const providedCriteriaIds = data.grades.map(g => g.criterionId);
    const requiredCriteriaIds = criteria.map(c => c.id);
    const missingCriteria = requiredCriteriaIds.filter(id => !providedCriteriaIds.includes(id));

    if (missingCriteria.length > 0) {
      throw new Error('Tất cả các tiêu chí phải được chấm điểm');
    }

    // Validate scores (0-10 and range)
    for (const grade of data.grades) {
      const criterion = criteria.find(c => c.id === grade.criterionId);
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

    // Delete existing grades for this grader, topic, and optionally student
    await prisma.grade.deleteMany({
      where: {
        topic_id: data.topicId,
        student_id: data.studentId || null,
        grader_id: userId,
        rater_role: raterRole,
        reviewer_order: data.reviewerOrder || null,
      },
    });

    // Create new grades
    const grades = await Promise.all(
      data.grades.map(grade =>
        prisma.grade.create({
          data: {
            topic_id: data.topicId,
            student_id: data.studentId || null,
            grader_id: userId,
            criterion_id: grade.criterionId,
            rater_role: raterRole,
            reviewer_order: data.reviewerOrder || null,
            score: roundScore(grade.score),
            comments: grade.comments,
          },
        })
      )
    );

    // Professional Logging
    logger.info('SUBMIT_GRADE', {
      topicId: data.topicId,
      studentId: data.studentId,
      graderId: userId,
      role: raterRole,
      criteriaCount: grades.length,
      timestamp: new Date().toISOString()
    });

    // Update student progress status
    const registration = topic.registrations.find(r => r.student_id === data.studentId);
    if (registration) {
      if (raterRole === RaterRole.SUPERVISOR) {
        await prisma.topicRegistration.update({
          where: { id: registration.id },
          data: {
            student_progress_status: StudentProgressStatus.ADVISOR_GRADED,
          },
        });
      } else if (isReviewer(raterRole)) {
        // Check if all reviewers have graded
        const allReviewersGraded = await this.checkAllReviewersGraded(data.topicId);
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
              where: { id: data.topicId },
              data: {
                progress_stage: ProgressStage.READY_FOR_DEFENSE,
              },
            });
            logger.info('TOPIC_PROGRESS_TRANSITION', {
              topicId: data.topicId,
              to: ProgressStage.READY_FOR_DEFENSE,
              trigger: 'ALL_REVIEWERS_GRADED'
            });
          }
        }
      } else if (isCommittee(raterRole)) {
        // Check if all committee members have graded
        const allCommitteeGraded = await this.checkAllCommitteeGraded(data.topicId);
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
              where: { id: data.topicId },
              data: {
                status: TopicStatus.COMPLETED,
                progress_stage: ProgressStage.DONE,
              },
            });
          }

          // Auto-compute final score
          await this.computeFinalScore(data.topicId);
        }
      }
    }

    // Create audit log
    await prisma.auditLog.create({
      data: {
        user_id: userId,
        action: 'SUBMIT_GRADE',
        entity_type: 'Grade',
        entity_id: data.topicId,
        new_value: { rater_role: raterRole, grades: grades.length },
      },
    });

    // TODO: Send notification

    return grades;
  }

  async computeFinalScore(topicId: string) {
    // 1. Guard: Check if grading is complete for ALL students in this topic
    // This ensures we don't compute partial/incorrect final scores
    const topicData = await prisma.topic.findUnique({
      where: { id: topicId },
      include: { registrations: true }
    });

    if (!topicData) throw new Error(ERROR_CODES.TOPIC_NOT_FOUND);

    for (const reg of topicData.registrations) {
      const isDone = await this.checkAllFinalGraded(topicId, reg.student_id);
      if (!isDone) {
        throw new Error(`Chưa thể tính điểm tổng kết: Sinh viên ${reg.student_id} chưa được chấm điểm đầy đủ (GVHD, 2 GVPB, Hội đồng)`);
      }
    }

    const topic = await prisma.topic.findUnique({
      where: { id: topicId },
      include: {
        grades: {
          include: {
            criterion: true,
          },
        },
        registrations: {
          select: { student_id: true },
        },
      },
    });

    if (!topic) {
      throw new Error(ERROR_CODES.TOPIC_NOT_FOUND);
    }

    const results = [];

    // Get all student IDs registered for this topic
    const studentIds = topic.registrations.map(r => r.student_id);

    // Get defense type from topic
    const defenseType = topic.defense_type || 'ORAL';

    for (const studentId of studentIds) {
      // Filter grades for this student
      const studentGrades = topic.grades.filter(g => g.student_id === studentId);

      // Fetch approved extra points from research evidence (AUTOMATIC)
      const approvedExtraPoint = await prisma.extraPointRequest.findFirst({
        where: {
          topic_id: topicId,
          student_id: studentId,
          status: 'APPROVED'
        },
        select: { points_requested: true }
      });
      const extraPoints = approvedExtraPoint?.points_requested || 0;

      // 1. Calculate weighted score for supervisor
      const supervisorGrades = studentGrades.filter(g => g.rater_role === RaterRole.SUPERVISOR);
      const supervisorScore = supervisorGrades.length > 0 ? calculateWeightedScore(supervisorGrades) : 0;

      // 2. Calculate average of ALL reviewers assigned
      const reviewerGrades = studentGrades.filter(g => isReviewer(g.rater_role));
      const reviewerGraderIds = [...new Set(reviewerGrades.map(g => g.grader_id))];
      const reviewerScores = reviewerGraderIds.map(graderId => {
        const graderGrades = reviewerGrades.filter(g => g.grader_id === graderId);
        return calculateWeightedScore(graderGrades);
      });
      const reviewerAvgScore = reviewerScores.length > 0 ? reviewerScores.reduce((a, b) => a + b, 0) / reviewerScores.length : 0;

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
        : 0;

      // Validate all scores before final calculation
      if (!validateScores([supervisorScore, reviewerAvgScore, committeeAvgScore])) {
        throw new Error('Detected invalid scores outside of range (0-10)');
      }

      const finalScore = await prisma.finalScore.findUnique({
        where: { topic_id_student_id: { topic_id: topicId, student_id: studentId } },
      });

      const finalScoreValue = calculateFinalScore({
        supervisor: supervisorScore,
        reviewerAvg: reviewerAvgScore,
        committeeAvg: committeeAvgScore,
        bonus: extraPoints
      });

      // computed_score = base academic score without bonus
      const computedScore = roundScore(Math.max(finalScoreValue - extraPoints, 0));

      const gradeClassification = this.getGradeClassification(finalScoreValue);

      let resultScore;
      if (finalScore) {
        resultScore = await prisma.finalScore.update({
          where: { topic_id_student_id: { topic_id: topicId, student_id: studentId } },
          data: {
            supervisor_score: supervisorScore,
            reviewer_avg_score: reviewerAvgScore,
            committee_score: committeeAvgScore,
            computed_score: computedScore,
            extra_points: extraPoints,
            final_score: finalScoreValue,
            grade_classification: gradeClassification,
          },
        });
      } else {
        resultScore = await prisma.finalScore.create({
          data: {
            topic_id: topicId,
            student_id: studentId,
            supervisor_score: supervisorScore,
            reviewer_avg_score: reviewerAvgScore,
            committee_score: committeeAvgScore,
            computed_score: computedScore,
            extra_points: extraPoints,
            final_score: finalScoreValue,
            grade_classification: gradeClassification,
          },
        });
      }

      results.push(resultScore);
    }

    return results;
  }

  async finalizeFinalScore(userId: string, topicId: string) {
    const finalScores = await prisma.finalScore.findMany({
      where: { topic_id: topicId },
    });

    if (finalScores.length === 0) {
      throw new Error(ERROR_CODES.GRADE_NOT_FOUND);
    }

    // Check academic policy
    const topicCheck = await prisma.topic.findUnique({
      where: { id: topicId },
      include: { semester: true }
    });
    if (!topicCheck) throw new Error(ERROR_CODES.TOPIC_NOT_FOUND);
    AcademicPolicy.enforce(AcademicAction.FINALIZE_SCORE, { id: userId, role: UserRole.HEAD }, topicCheck.semester);

    // NEW: Proper complete validation before finalizing
    const topic = await prisma.topic.findUnique({
      where: { id: topicId },
      include: {
        grades: true,
        assignments: {
          where: { assignment_type: AssignmentType.COMMITTEE }
        }
      }
    });

    if (!topic) throw new Error(ERROR_CODES.TOPIC_NOT_FOUND);

    const supervisorGrades = topic.grades.filter(g => g.rater_role === RaterRole.SUPERVISOR);
    const gradedReviewerIds = [...new Set(topic.grades
      .filter(g => isReviewer(g.rater_role))
      .map(g => g.grader_id))];
    const committeeAssignedIds = topic.assignments.map(a => a.reviewer_id);
    const committeeGradedIds = [...new Set(topic.grades
      .filter(g => isCommittee(g.rater_role))
      .map(g => g.grader_id))];

    console.log(`[GradingService] Finalizing scores for Topic: ${topicId}. Supervisor graded: ${supervisorGrades.length > 0}, Reviewers: ${gradedReviewerIds.length}, Committee: ${committeeGradedIds.length}, DefenseType: ${topic.defense_type}`);

    if (!isGradingComplete({
      hasSupervisor: supervisorGrades.length > 0,
      reviewerCount: gradedReviewerIds.length,
      committeeCount: committeeGradedIds.length,
      defenseType: topic.defense_type || undefined
    })) {
      throw new Error(ERROR_CODES.INCOMPLETE_GRADES);
    }

    const alreadyFinalized = finalScores.some(fs => fs.finalized);
    if (alreadyFinalized) {
      throw new Error(ERROR_CODES.ALREADY_FINALIZED);
    }

    // Update all final scores for this topic
    await prisma.finalScore.updateMany({
      where: { topic_id: topicId },
      data: {
        finalized: true,
        finalized_by: userId,
        finalized_at: new Date(),
      },
    });

    // Update topic status
    await prisma.topic.update({
      where: { id: topicId },
      data: {
        status: TopicStatus.FINALIZED,
        progress_stage: ProgressStage.DONE,
      },
    });

    // Update all student progress
    await prisma.topicRegistration.updateMany({
      where: { topic_id: topicId },
      data: {
        student_progress_status: StudentProgressStatus.COMPLETED,
      },
    });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        user_id: userId,
        action: 'FINALIZE_SCORE',
        entity_type: 'FinalScore',
        entity_id: topicId,
        new_value: { finalized: true, studentCount: finalScores.length },
      },
    });

    // Notify Students
    await notificationService.notifyScoreFinalized(topicId);

    return { message: 'Final score finalized successfully' };
  }

  /**
   * Get Grade Summary list for HEAD — topics ready for finalization
   * Shows all COMPLETED topics (all 3 grading phases done) + already FINALIZED ones
   */
  /**
   * Get Grade Summary list for HEAD — topics ready for finalization or in progress
   * Shows topics from UNDER_REVIEW to FINALIZED
   */
  async getGradeSummary(userId: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || (user.role !== UserRole.HEAD && user.role !== UserRole.ADMIN)) throw new Error(ERROR_CODES.FORBIDDEN);

    const topics = await prisma.topic.findMany({
      where: {
        ...(user.role !== UserRole.ADMIN && { departmentId: user.departmentId }),
        status: {
          in: [
            TopicStatus.REGISTERED,
            TopicStatus.COMPLETED,
            TopicStatus.FINALIZED,
          ],
        },
      },
      include: {
        supervisor: { select: { id: true, full_name: true, avatar_url: true } },
        semester: { select: { id: true, name: true } },
        registrations: {
          include: {
            student: { select: { id: true, full_name: true, student_code: true, avatar_url: true } },
          },
        },
        grades: { include: { criterion: true } },
        assignments: { where: { assignment_type: AssignmentType.REVIEWER } },
        final_scores: true,
      },
      orderBy: { updated_at: 'desc' },
    });

    const topicIds = topics.map(t => t.id);
    const extraPoints = await prisma.extraPointRequest.findMany({
      where: { topic_id: { in: topicIds }, status: 'APPROVED' },
    });

    const summaryData = topics.map(topic => {
      const supervisorGraded = topic.grades.some(g => g.rater_role === RaterRole.SUPERVISOR);
      const reviewerAssignments = topic.assignments.filter(a => a.assignment_type === AssignmentType.REVIEWER);
      const totalReviewersRequired = (topic as any).reviewer_required_count || reviewerAssignments.length;

      const reviewerGraderIds = [...new Set(topic.grades.filter(g => isReviewer(g.rater_role)).map(g => g.grader_id))];
      const reviewerGradedCount = reviewerGraderIds.length;

      const isReviewerComplete = reviewerGradedCount >= totalReviewersRequired && totalReviewersRequired > 0;
      const committeeGradedIds = [...new Set(topic.grades.filter(g => isCommittee(g.rater_role)).map(g => g.grader_id))];

      const students = topic.registrations.map(reg => {
        let fs = topic.final_scores.find(s => s.student_id === reg.student_id);

        if (!fs) {
          const studentGrades = topic.grades.filter(g => g.student_id === reg.student_id);
          const sGrades = studentGrades.filter(g => g.rater_role === RaterRole.SUPERVISOR);
          const supervisor_score = sGrades.length > 0 ? calculateWeightedScore(sGrades) : null;

          const rGrades = studentGrades.filter(g => isReviewer(g.rater_role));
          const rGraderIdsForStudent = [...new Set(rGrades.map(g => g.grader_id))];
          const rScores = rGraderIdsForStudent.map(gid => calculateWeightedScore(rGrades.filter(g => g.grader_id === gid)));
          const reviewer_avg_score = rScores.length > 0 ? rScores.reduce((a, b) => a + b, 0) / rScores.length : null;

          const preDefenseScore = (supervisor_score !== null && reviewer_avg_score !== null)
            ? roundScore((supervisor_score + reviewer_avg_score) / 2)
            : null;

          const ep = extraPoints.find(e => e.topic_id === topic.id && e.student_id === reg.student_id);
          fs = {
            id: `temp-${reg.student_id}`,
            student_id: reg.student_id,
            supervisor_score,
            reviewer_avg_score,
            pre_defense_score: preDefenseScore,
            extra_points: ep?.points_requested || 0,
            finalized: false,
          } as any;
        }

        return { ...reg.student, finalScore: fs };
      });

      return {
        id: topic.id,
        code: topic.code,
        title: topic.title,
        status: topic.status,
        defense_type: topic.defense_type,
        is_eligible_for_defense: (topic as any).is_eligible_for_defense,
        supervisor: topic.supervisor,
        students,
        gradingStatus: {
          supervisorGraded,
          reviewerGradedCount,
          totalReviewersRequired,
          isReviewerComplete,
          committeeCount: committeeGradedIds.length,
          isReadyForDecision: supervisorGraded && isReviewerComplete,
          isFinalized: topic.status === TopicStatus.FINALIZED,
        },
      };
    });

    // Categorize for HOD Dashboard
    return {
      allTopics: summaryData,
      missingSupervisor: summaryData.filter(d => !d.gradingStatus.supervisorGraded),
      missingReviewer: summaryData.filter(d => d.gradingStatus.supervisorGraded && !d.gradingStatus.isReviewerComplete),
      ready: summaryData.filter(d => d.gradingStatus.isReadyForDecision && d.is_eligible_for_defense === null),
      finalized: summaryData.filter(d => d.is_eligible_for_defense !== null),
    };
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

    // 1. Check uniqueness: name + role + departmentId
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
        criteria_type: 'REGULAR',
        departmentId: targetDeptId,
      },
    });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        user_id: userId,
        action: 'CREATE_CRITERION',
        entity_type: 'GradingCriterion',
        entity_id: criterion.id,
        new_value: criterion,
      },
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

    // 0.5. Stability Check: Block if grades already exist
    const hasGrades = await prisma.grade.findFirst({
      where: { criterion_id: id }
    });
    if (hasGrades) {
      throw new Error('Không thể chỉnh sửa tiêu chí đã được sử dụng để chấm điểm. Vui lòng tạo tiêu chí mới nếu muốn thay đổi quy trình.');
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
    await prisma.auditLog.create({
      data: {
        user_id: userId,
        action: 'UPDATE_CRITERION',
        entity_type: 'GradingCriterion',
        entity_id: id,
        old_value: existing as any,
        new_value: updated as any,
      },
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

    // 0.5. Stability Check
    const hasGrades = await prisma.grade.findFirst({
      where: { criterion_id: id }
    });
    if (hasGrades) {
      throw new Error('Không thể xóa tiêu chí đã được sử dụng để chấm điểm. Hãy ẩn (deactivate) tiêu chí này thay vì xóa.');
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

  async getGradingCriteria(roleFilter?: RaterRole | 'FINAL', topicId?: string, explicitDeptId?: string): Promise<any> {
    let departmentId: string | undefined = explicitDeptId;

    if (topicId) {
      const topic = await prisma.topic.findUnique({
        where: { id: topicId },
        select: { departmentId: true },
      });
      departmentId = topic?.departmentId;
    }

    const where: any = { active: true };
    where.departmentId = departmentId || null;

    if (roleFilter === 'FINAL') {
      where.criteria_type = 'FINAL';
    } else if (roleFilter) {
      // Map requested role (specific or generic) to its group
      let group: string | undefined = undefined;

      // Explicit generic mapping
      const rf = roleFilter as string;
      if (rf === 'REVIEWER') group = RoleGroup.REVIEWER;
      else if (rf === 'SUPERVISOR' || rf === 'ADVISOR') group = RoleGroup.SUPERVISOR;
      else if (rf === 'COMMITTEE' || rf === 'COUNCIL' || rf === 'COUNCIL_MEMBER') group = RoleGroup.COMMITTEE;
      else {
        // Look up by specific RaterRole
        group = ROLE_GROUP_MAP[roleFilter as RaterRole];
      }

      if (group) {
        where.role = { in: getRolesByGroup(group as RoleGroup) };
      } else {
        where.role = roleFilter;
      }
    }

    const criteria = await prisma.gradingCriterion.findMany({
      where,
      orderBy: [
        { role: 'asc' },
        { order_index: 'asc' },
      ],
    });

    // If a specific role or type (like FINAL) was requested, we return a flat list
    // but filtered to the first role found in the result to ensure 10 items instead of many sets
    if (roleFilter) {
      if (criteria.length === 0 && departmentId) {
        return this.getGradingCriteria(roleFilter, undefined, undefined);
      }

      const groupByRole = criteria.reduce((acc, c) => {
        if (!acc[c.role]) acc[c.role] = [];
        acc[c.role].push(c);
        return acc;
      }, {} as Record<string, typeof criteria>);

      const firstRoleFound = Object.keys(groupByRole)[0];
      return firstRoleFound ? groupByRole[firstRoleFound] : [];
    }

    // Grouping logic for general (HOD) view: Pivot specific RaterRoles into generic RoleGroups
    const grouped = criteria.reduce((acc: any, criterion) => {
      const group = ROLE_GROUP_MAP[criterion.role] || criterion.role;
      if (!acc[group]) {
        acc[group] = [];
      }
      // Strategy: Take the first role's criteria we encounter in that group and stick with them.
      const existingRoleInGroup = acc[group][0]?.role;
      if (!existingRoleInGroup || existingRoleInGroup === criterion.role) {
        acc[group].push(criterion);
      }
      return acc;
    }, {} as Record<string, typeof criteria>);


    // Fallback logic for department -> global (for grouped view)
    if (Object.keys(grouped).length === 0 && departmentId) {
      return this.getGradingCriteria(roleFilter, undefined, undefined);
    }

    // Role handling for FINAL output
    if (roleFilter === 'FINAL') {
      const firstGroup = Object.keys(grouped)[0];
      if (firstGroup) return { FINAL: grouped[firstGroup] };
    }

    return grouped;
  }

  private getGradeClassification(score: number): string {
    if (score >= GRADING.CLASSIFICATION.EXCELLENT.min) return GRADING.CLASSIFICATION.EXCELLENT.label;
    if (score >= GRADING.CLASSIFICATION.GOOD.min) return GRADING.CLASSIFICATION.GOOD.label;
    if (score >= GRADING.CLASSIFICATION.FAIR.min) return GRADING.CLASSIFICATION.FAIR.label;
    if (score >= GRADING.CLASSIFICATION.AVERAGE.min) return GRADING.CLASSIFICATION.AVERAGE.label;
    return GRADING.CLASSIFICATION.FAIL.label;
  }

  private async getPriorityCriteria(role: RaterRole, departmentId: string) {
    // 1. Role Group lookup (Reviewer/Committee/Supervisor)
    const roleGroup = ROLE_GROUP_MAP[role];
    const rolesInGroup = getRolesByGroup(roleGroup);

    // 0. Final Evaluation Priority - MUST filter by role group and department
    const finalCriteria = await prisma.gradingCriterion.findMany({
      where: {
        criteria_type: 'FINAL',
        active: true,
        role: { in: rolesInGroup },
        departmentId: departmentId || null
      },
      orderBy: { order_index: 'asc' },
    });
    if (finalCriteria.length > 0) return finalCriteria;

    // Fallback: Global final criteria for this role group
    if (departmentId) {
      const globalFinalCriteria = await prisma.gradingCriterion.findMany({
        where: {
          criteria_type: 'FINAL',
          active: true,
          role: { in: rolesInGroup },
          departmentId: null
        },
        orderBy: { order_index: 'asc' },
      });
      if (globalFinalCriteria.length > 0) return globalFinalCriteria;
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

  private validateCriteriaWeights(criteria: any[]) {
    const totalWeight = criteria.reduce((sum, c) => sum + (c.weight || 0), 0);
    // Use float tolerance for weight validation
    if (Math.abs(totalWeight - 1.0) > 0.001) {
      throw new Error(`Tổng trọng số các tiêu chí cho vai trò này phải bằng 1.0 (Hiện tại: ${roundScore(totalWeight)})`);
    }
  }

  private async checkAllReviewersGraded(topicId: string): Promise<boolean> {
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

  private async checkAllCommitteeGraded(topicId: string): Promise<boolean> {
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

    // Check if registration is CONFIRMED
    if (registration.status !== 'CONFIRMED') {
      throw new Error('Can only grade midterm for confirmed registrations');
    }

    // Update midterm status for ALL registrations in this group
    // This is important because midterm grading applies to the entire group
    if (registration.group_id) {
      await prisma.topicRegistration.updateMany({
        where: {
          group_id: registration.group_id,
          topic_id: registration.topic_id,
        },
        data: {
          midterm_status: status,
          midterm_graded_at: new Date(),
          midterm_feedback: feedback || null,
          // Update progress status if PASS
          student_progress_status: StudentProgressStatus.HAS_TOPIC,
        },
      });
    } else {
      // Single student registration (no group)


      await prisma.topicRegistration.update({
        where: { id: registrationId },
        data: {
          midterm_status: status,
          midterm_feedback: feedback,
          midterm_graded_at: new Date(),
          student_progress_status: StudentProgressStatus.HAS_TOPIC,
        },
      });
    }

    // Fetch updated registration for return value
    const updatedRegistration = await prisma.topicRegistration.findUnique({
      where: { id: registrationId },
    });

    // Notify Student(s)
    const memberIds = registration.group_id
      ? registration.group?.members.map((m: any) => m.user_id) || []
      : [(registration as any).student_id];

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

    // Notify students
    if (registration.group) {
      await prisma.notification.createMany({
        data: registration.group.members.map(member => ({
          user_id: member.user_id,
          type: status === MidtermStatus.PASS ? 'SUCCESS' : 'WARNING',
          title: 'Kết quả đánh giá giữa kỳ',
          content: status === MidtermStatus.PASS
            ? 'Bạn đã PASS đánh giá giữa kỳ. Hãy tiếp tục hoàn thành khóa luận!'
            : `Bạn đã FAIL đánh giá giữa kỳ. ${feedback || 'Vui lòng liên hệ GVHD để biết thêm chi tiết.'}`,
          related_id: registrationId,
        })),
      });
    }

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
        status: 'CONFIRMED',
        topic: {
          supervisor_id: userId,
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

    // Deduplicate and attach permissions
    const seenGroups = new Set<string>();
    const result = [];

    for (const reg of registrations) {
      const key = reg.group_id || reg.id;
      if (seenGroups.has(key)) continue;
      seenGroups.add(key);

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
  async getGrades(userId: string, topicId: string) {
    const [topic, user] = await Promise.all([
      prisma.topic.findUnique({
        where: { id: topicId },
        include: {
          semester: true,
          supervisor: { select: { id: true, full_name: true, role: true, avatar_url: true } },
          registrations: {
            include: {
              student: { select: { id: true, full_name: true, student_code: true, email: true, avatar_url: true } },
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

    // Helper to group grades by grader and student
    const groupGrades = (grades: any[]) => {
      const grouped = new Map<string, any>();
      
      grades.forEach(g => {
        const key = `${g.grader_id}-${g.student_id || 'topic'}`;
        if (!grouped.has(key)) {
          grouped.set(key, {
            id: g.id, // Use the first grade ID as reference
            topic_id: g.topic_id,
            rater_id: g.grader_id,
            rater_name: g.grader.full_name,
            rater_role: g.rater_role,
            student_id: g.student_id,
            reviewer_order: g.reviewer_order,
            committee_role: g.grader.committee_role, // Note: might need to join assignments for exact role
            scores: [],
            submitted_at: g.graded_at,
          });
        }
        
        const entry = grouped.get(key);
        entry.scores.push({
          criterion_id: g.criterion_id,
          score: g.score,
          comment: g.comments,
        });
        
        // Ensure submitted_at is the latest
        if (new Date(g.graded_at) > new Date(entry.submitted_at)) {
          entry.submitted_at = g.graded_at;
        }
      });
      
      return Array.from(grouped.values());
    };

    const groupedGrades = groupGrades(allGrades);

    const advisorGrade = groupedGrades.find(g => g.rater_role === RaterRole.SUPERVISOR);
    const reviewerGrades = groupedGrades.filter(g => isReviewer(g.rater_role));
    const councilGrades = groupedGrades.filter(g => isCommittee(g.rater_role));

    const finalScore = await prisma.finalScore.findFirst({
      where: { topic_id: topicId },
      include: { student: true },
    });

    const permissions = this.getTopicPermissions(
      { id: userId, role: user.role },
      topic.semester,
      topic.registrations[0]
    );

    return {
      advisorGrade,
      reviewerGrades,
      councilGrades,
      finalScore,
      permissions,
      topic,
    };
  }

  async getMyGrades(userId: string, topicId: string, raterRole?: RaterRole) {
    // Fetch grades by this grader for this topic (filtered by role if provided)
    const where: any = {
      topic_id: topicId,
      grader_id: userId,
    };
    if (raterRole) {
      where.rater_role = raterRole;
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

    // Get list of students registered for this topic
    const registrations = await prisma.topicRegistration.findMany({
      where: { topic_id: topicId },
      include: {
        student: {
          select: { id: true, full_name: true, student_code: true },
        },
      },
    });

    // Compute permissions for this user on this topic
    const permissions = this.getTopicPermissions(
      { id: userId, role: grader.role },
      topic.semester,
      registrations[0] // Context for policy check
    );

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
    const auditHistory = await prisma.auditLog.findMany({
      where: {
        entity_type: 'Grade',
        entity_id: topicId,
        user_id: userId,
      },
      orderBy: { created_at: 'desc' },
      take: 20,
    });

    // Build per-student result
    const students = registrations.map(reg => {
      const studentId = reg.student_id;
      const studentInfo = reg.student;
      const sGrades = studentGradesMap.get(studentId) || [];

      // Extract metadata from the first grade comment
      let generalComment: string | null = null;
      const firstGrade = sGrades[0];
      if (firstGrade?.comments) {
        const metaMatch = firstGrade.comments.match(/\[META_DATA:(.*)\]/);
        if (metaMatch) {
          try {
            const meta = JSON.parse(metaMatch[1]);
            generalComment = meta.generalComment || null;
          } catch { }
        }
      }

      return {
        studentId,
        studentName: studentInfo.full_name,
        studentCode: studentInfo.student_code,
        status: sGrades.length > 0 ? 'SUBMITTED' as const : 'NOT_GRADED' as const,
        gradedAt: sGrades[0]?.graded_at || null,
        raterRole: sGrades[0]?.rater_role || null,
        generalComment,
        grades: sGrades.map(g => ({
          id: g.id,
          criterionId: g.criterion_id,
          criterionName: g.criterion.name,
          criterionDescription: g.criterion.description,
          criterionWeight: g.criterion.weight,
          criterionMaxScore: g.criterion.max_score,
          criterionMinScore: g.criterion.min_score,
          score: g.score,
          comment: g.comments?.replace(/\s*\[META_DATA:.*\]/, '') || null,
        })),
      };
    });

    return {
      grader,
      students,
      permissions,
      auditHistory: auditHistory.map(a => ({
        id: a.id,
        action: a.action,
        createdAt: a.created_at,
        details: a.new_value,
      })),
    };
  }
}

export default new GradingService();
