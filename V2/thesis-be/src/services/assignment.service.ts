import prisma from '../config/database';
import { AssignmentType, AssignmentStatus, TopicStatus, UserRole, Prisma, MidtermStatus, RaterRole, ProgressStage, CommitteeRole, Assignment } from '@prisma/client';
import { CreateAssignmentRequest, CreateDefenseScheduleRequest } from '../types';
import { ERROR_CODES } from '../constants';
import { SemesterGuard } from '../utils/semester-guard';
import { AcademicPolicy, AcademicAction } from '../utils/academic-policy';
import notificationService from './notification.service';
import semesterService from './semester.service';
import { isReviewer, isCommittee } from '../utils/grading.utils';


const topicForCommitteeAssignmentInclude = {
  supervisor: {
    select: { id: true, full_name: true, email: true },
  },
  registrations: {
    where: {
      midterm_status: MidtermStatus.PASS,
    },
    include: {
      student: {
        select: { id: true, full_name: true, student_code: true, email: true },
      },
      group: {
        include: {
          members: {
            where: { status: 'ACCEPTED' },
            include: {
              user: { select: { id: true, full_name: true, student_code: true, email: true } }
            }
          }
        }
      }
    },
  },
  assignments: {
    include: {
      reviewer: {
        select: { id: true, full_name: true },
      },
    },
  },
  grades: {
    where: {
      rater_role: {
        in: [
          RaterRole.SUPERVISOR,
          RaterRole.REVIEWER_1,
          RaterRole.REVIEWER_2,
          RaterRole.REVIEWER_3,
        ] as RaterRole[],
      },
    },
    include: {
      criterion: true,
    },
  },
  defense_schedules: {
    include: {
      committee: true
    }
  }
} as const;

export type AssignmentWithRelations = Prisma.AssignmentGetPayload<{
  include: {
    topic: {
      include: {
        supervisor: true,
        defense_schedules: true,
        grades: true,
        registrations: {
          include: { student: true, group: true }
        }
      }
    },
    reviewer: true,
    assigner: true
  }
}>;

export type TopicForCommitteeAssignment = Prisma.TopicGetPayload<{
  include: typeof topicForCommitteeAssignmentInclude
}>;

type TopicWithAssignmentsPayload = Prisma.TopicGetPayload<{
  include: { assignments: true, registrations: true }
}>;

interface GroupInfo {
  group_id: string;
  group_name: string;
  registrations: any[];
  assignments: any[];
}

export interface CommitteeAssignmentSummary extends TopicForCommitteeAssignment {
  topicTitle: string;
  groupId: string;
  groupName: string;
  assignments: any[];
  registrations: any[];
  reviewerCount: number;
  assignmentStatus: string;
  canAssignMore: boolean;
  room: string | null;
}

export class AssignmentService {
  async createReviewerAssignment(userId: string, data: CreateAssignmentRequest) {
    const activeSemester = await semesterService.getActiveSemester();
    if (!activeSemester) throw new Error('Không tìm thấy học kỳ đang hoạt động');



    // Verify topic exists and is in correct status
    const topic = await prisma.topic.findUnique({
      where: { id: data.topicId },
      include: {
        assignments: true,
        registrations: true,
        grades: true,
        final_scores: true,
      },
    }) as any;

    if (!topic) {
      throw new Error(ERROR_CODES.TOPIC_NOT_FOUND);
    }

    // 1. Academic Policy Guard (Phase & Failed Status checking)
    AcademicPolicy.enforce(AcademicAction.ASSIGN_REVIEWER, { id: userId, role: UserRole.HEAD }, activeSemester, { topic });

    // Topics must not be REJECTED, COMPLETED, or FINALIZED to have assignments
    if (topic.status === TopicStatus.REJECTED || topic.status === TopicStatus.FINALIZED || topic.status === TopicStatus.COMPLETED) {
      throw new Error('Chỉ có thể gán phản biện cho đề tài chưa bị hủy, chưa hoàn tất và chưa kết thúc (COMPLETED)');
    }

    if (topic.current_students === 0) {
      throw new Error('Đề tài không có sinh viên đăng ký không được đi vào giai đoạn sau.');
    }



    // Validate reviewer order (1, 2, or 3)
    if (data.reviewerOrder && ![1, 2, 3].includes(data.reviewerOrder)) {
      throw new Error('Reviewer order must be 1, 2, or 3');
    }

    // Check if supervisor is trying to review their own topic
    if (topic.supervisor_id === data.reviewerId) {
      throw new Error(ERROR_CODES.SUPERVISOR_CONFLICT);
    }

    // Check for duplicate reviewer in the same group
    const existingAssignment = topic.assignments.find(
      (a: Assignment) => a.reviewer_id === data.reviewerId && a.assignment_type === AssignmentType.REVIEWER && a.group_id === data.groupId
    );

    if (existingAssignment) {
      throw new Error(ERROR_CODES.REVIEWER_DUPLICATE);
    }

    if (data.reviewerOrder) {
      const orderExists = topic.assignments.find(
        (a: Assignment) => a.reviewer_order === data.reviewerOrder && a.assignment_type === AssignmentType.REVIEWER && a.group_id === data.groupId
      );

      if (orderExists) {
        throw new Error(`Reviewer ${data.reviewerOrder} already assigned`);
      }
    }

    // [PRODUCTION GUARD] Check for unique reviewer across all positions for this group
    const reviewerExists = topic.assignments.find(
      (a: Assignment) => a.reviewer_id === data.reviewerId && a.assignment_type === AssignmentType.REVIEWER && a.group_id === data.groupId
    );
    if (reviewerExists) {
      throw new Error(ERROR_CODES.REVIEWER_DUPLICATE || 'Giảng viên đã được gán phản biện cho đề tài này');
    }

    // [DEPARTMENT GUARD] Reviewer must be from the same department as the topic
    const reviewer = await prisma.user.findUnique({ where: { id: data.reviewerId } });
    if (!reviewer) throw new Error('Không tìm thấy giảng viên phản biện');
    if (reviewer.departmentId !== topic.departmentId) {
      throw new Error('Giảng viên phản biện phải thuộc cùng bộ môn với đề tài');
    }

    // Validate that dates are in the future
    if (data.deadlineAt && new Date(data.deadlineAt) <= new Date()) {
      throw new Error('Hạn chót nộp điểm phản biện phải lớn hơn thời gian hiện tại');
    }
    if (data.startTime && new Date(data.startTime) <= new Date()) {
      throw new Error('Thời gian bắt đầu phản biện phải lớn hơn thời gian hiện tại');
    }
    if (data.endTime && new Date(data.endTime) <= new Date()) {
      throw new Error('Thời gian kết thúc phản biện phải lớn hơn thời gian hiện tại');
    }

    // [SCHEDULE CONFLICT GUARD] Reviewer must not have overlapping reviewer assignments
    if (data.startTime && data.endTime) {
      if (new Date(data.startTime) >= new Date(data.endTime)) {
        throw new Error('Giờ bắt đầu phải trước giờ kết thúc');
      }
      await this.checkReviewerConflict(
        data.reviewerId,
        new Date(data.startTime),
        new Date(data.endTime),
        data.topicId,
        data.groupId
      );
    }

    const assignment = await (prisma.assignment as any).create({
      data: {
        topic_id: data.topicId,
        group_id: data.groupId,
        reviewer_id: data.reviewerId,
        assignment_type: AssignmentType.REVIEWER,
        reviewer_order: data.reviewerOrder,
        assigned_by: userId,
        deadline_at: data.deadlineAt,
        room: data.room,
        defense_format: data.defenseFormat || 'OFFLINE',
        zoom_password: data.zoomPassword,
        start_time: data.startTime ? new Date(data.startTime) : null,
        end_time: data.endTime ? new Date(data.endTime) : null,
        status: AssignmentStatus.AUTO_ACCEPTED,
        responded_at: new Date(),
      },
    });

    // Update topic status if needed
    const reviewerCount = topic.assignments.filter((a: Assignment) => a.assignment_type === AssignmentType.REVIEWER).length + 1;
    if (reviewerCount >= 2) {
      await prisma.topic.update({
        where: { id: data.topicId },
        data: {
          progress_stage: ProgressStage.REVIEWING,
        },
      });
    }

    // Create audit log
    await prisma.auditLog.create({
      data: {
        user_id: userId,
        action: 'ASSIGN_REVIEWER',
        entity_type: 'Assignment',
        entity_id: assignment.id,
        new_value: assignment,
      },
    });

    // Send notification to reviewer
    await notificationService.notifyAssignmentCreated(assignment.id);

    return assignment;

  }

  async acceptAssignment(userId: string, assignmentId: string) {
    const assignment = await prisma.assignment.findUnique({
      where: { id: assignmentId },
    });

    if (!assignment) {
      throw new Error(ERROR_CODES.ASSIGNMENT_NOT_FOUND);
    }

    if (assignment.reviewer_id !== userId) {
      throw new Error(ERROR_CODES.FORBIDDEN);
    }

    if (assignment.status !== AssignmentStatus.PENDING) {
      throw new Error('Assignment already processed');
    }

    // Update assignment
    await prisma.assignment.update({
      where: { id: assignmentId },
      data: {
        status: AssignmentStatus.ACCEPTED,
        responded_at: new Date(),
      },
    });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        user_id: userId,
        action: 'ACCEPT_ASSIGNMENT',
        entity_type: 'Assignment',
        entity_id: assignmentId,
        new_value: { status: 'ACCEPTED' },
      },
    });

    // TODO: Send notification to HEAD

    return { message: 'Assignment accepted' };
  }

  async declineAssignment(userId: string, assignmentId: string, declineReason: string) {
    if (declineReason.length < 30) {
      throw new Error('Decline reason must be at least 30 characters');
    }

    const assignment = await prisma.assignment.findUnique({
      where: { id: assignmentId },
      include: {
        topic: true,
      },
    });

    if (!assignment) {
      throw new Error(ERROR_CODES.ASSIGNMENT_NOT_FOUND);
    }

    if (assignment.reviewer_id !== userId) {
      throw new Error(ERROR_CODES.FORBIDDEN);
    }

    if (assignment.status !== AssignmentStatus.PENDING) {
      throw new Error('Assignment already processed');
    }

    // Update assignment
    await prisma.assignment.update({
      where: { id: assignmentId },
      data: {
        status: AssignmentStatus.DECLINED,
        decline_reason: declineReason,
        responded_at: new Date(),
      },
    });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        user_id: userId,
        action: 'DECLINE_ASSIGNMENT',
        entity_type: 'Assignment',
        entity_id: assignmentId,
        new_value: { status: 'DECLINED', decline_reason: declineReason },
      },
    });

    // TODO: Send notification to HEAD

    return { message: 'Assignment declined' };
  }

  async createDefenseSchedule(userId: string, data: CreateDefenseScheduleRequest) {
    const activeSemester = await semesterService.getActiveSemester();
    if (!activeSemester) throw new Error('Không tìm thấy học kỳ đang hoạt động');



    // Verify topic
    const topic = await prisma.topic.findUnique({
      where: { id: data.topicId },
      include: {
        grades: true,
        final_scores: true,
        assignments: true,
        registrations: true,
      },
    });

    if (!topic) {
      throw new Error(ERROR_CODES.TOPIC_NOT_FOUND);
    }

    if (topic.current_students === 0) {
      throw new Error('Đề tài không có sinh viên đăng ký không được đi vào giai đoạn sau.');
    }

    // 1. Academic Policy Guard (Phase & Failed Status checking)
    AcademicPolicy.enforce(AcademicAction.ASSIGN_COMMITTEE, { id: userId, role: UserRole.HEAD }, activeSemester, { topic });

    // Topic must be in READY_FOR_DEFENSE stage
    if (topic.progress_stage !== ProgressStage.READY_FOR_DEFENSE) {
      // Logic: Review must be done first
      throw new Error('Đề tài phải hoàn thành phản biện (READY_FOR_DEFENSE) trước khi gán hội đồng');
    }

    // Check if all reviewers have graded
    const reviewerGrades = topic.grades.filter(g =>
      ([RaterRole.REVIEWER_1, RaterRole.REVIEWER_2, RaterRole.REVIEWER_3] as RaterRole[]).includes(g.rater_role)
    );

    const assignments = await prisma.assignment.findMany({
      where: {
        topic_id: data.topicId,
        assignment_type: AssignmentType.REVIEWER,
        status: { in: [AssignmentStatus.ACCEPTED, AssignmentStatus.AUTO_ACCEPTED] },
      },
    });

    if (reviewerGrades.length < assignments.length) {
      throw new Error('All reviewers must complete grading before scheduling defense');
    }

    // Validate committee members
    if (data.committeeChair === topic.supervisor_id) {
      throw new Error(ERROR_CODES.SUPERVISOR_CONFLICT);
    }

    if (data.committeeSecretary === topic.supervisor_id) {
      throw new Error(ERROR_CODES.SUPERVISOR_CONFLICT);
    }

    if (data.committeeMembers.some(m => m === topic.supervisor_id)) {
      throw new Error(ERROR_CODES.SUPERVISOR_CONFLICT);
    }

    // Check for duplicates
    const allMembers = [data.committeeChair, data.committeeSecretary, ...data.committeeMembers];
    const uniqueMembers = new Set(allMembers);
    if (uniqueMembers.size !== allMembers.length) {
      throw new Error('Committee members must be unique');
    }

    // Validate defense date/time in the future
    if (data.defenseDate) {
      let combinedDate = new Date(data.defenseDate);
      if (data.defenseTime) {
        const timeParts = data.defenseTime.split(':');
        if (timeParts.length >= 2) {
          combinedDate.setHours(parseInt(timeParts[0]), parseInt(timeParts[1]), 0, 0);
        }
      }
      if (combinedDate <= new Date()) {
        throw new Error('Lịch bảo vệ hội đồng phải bắt đầu vào một mốc thời gian trong tương lai (lớn hơn thời điểm hiện tại)');
      }
    }

    // Create defense schedule
    const schedule = await (prisma.defenseSchedule as any).create({
      data: {
        topic_id: data.topicId,
        group_id: data.groupId,
        semester_id: topic.semester_id,
        defense_date: data.defenseDate,
        defense_time: data.defenseTime,
        room: data.room,
        committee_chair: data.committeeChair,
        committee_secretary: data.committeeSecretary,
        notes: data.notes,
      },
    });

    // Create committee assignments
    const committeeAssignments = [
      { reviewer_id: data.committeeChair, role: 'CHAIR' },
      { reviewer_id: data.committeeSecretary, role: 'SECRETARY' },
      ...data.committeeMembers.map(m => ({ reviewer_id: m, role: 'MEMBER' })),
    ];

    for (const member of committeeAssignments) {
      await (prisma.assignment as any).create({
        data: {
          topic_id: data.topicId,
          group_id: data.groupId,
          reviewer_id: member.reviewer_id,
          assignment_type: AssignmentType.COMMITTEE,
          committee_role: member.role as CommitteeRole, // CHAIR, SECRETARY, MEMBER
          assigned_by: userId,
          deadline_at: data.defenseDate,
          status: AssignmentStatus.AUTO_ACCEPTED,
          room: data.room,
        },
      });
    }

    // Initial assignment of committee moves it to DEFENDING stage
    await prisma.topic.update({
      where: { id: data.topicId },
      data: {
        progress_stage: ProgressStage.DEFENDING,
      },
    });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        user_id: userId,
        action: 'CREATE_DEFENSE_SCHEDULE',
        entity_type: 'DefenseSchedule',
        entity_id: schedule.id,
        new_value: schedule,
      },
    });

    // Send notifications to all committee members and students
    const registrations = await prisma.topicRegistration.findMany({
      where: { topic_id: data.topicId, status: 'CONFIRMED' },
      include: {
        group: { include: { members: { where: { status: 'ACCEPTED' } } } }
      }
    });

    const studentIds = registrations.flatMap(reg =>
      reg.group_id ? reg.group?.members.map(m => m.user_id) || [] : [reg.student_id]
    );

    const userIds = [...new Set([...allMembers, ...studentIds])];

    await notificationService.notifyDefenseScheduled({
      userIds,
      topicId: data.topicId,
      date: data.defenseDate.toLocaleDateString('vi-VN'),
      startTime: data.defenseTime,
      room: data.room
    });

    return schedule;

  }

  async getDefenseSchedules(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new Error(ERROR_CODES.NOT_FOUND);
    }

    const where: any = {};
    // --- SEMESTER ISOLATION ---
    const activeSem = await (await import('./semester.service')).default.getActiveSemester();
    if (activeSem) {
      where.semester_id = activeSem.id;
    }

    // Role-based filtering
    if (user.role === UserRole.STUDENT) {
      // Students see their own defense schedule
      where.topic = {
        registrations: {
          some: {
            group: {
              members: {
                some: { user_id: userId, status: 'ACCEPTED' }
              }
            }
          }
        }
      };
    } else if (user.role === UserRole.LECTURER) {
      // Lecturers see schedules for their topics (as supervisor)
      // OR topics where they are part of the committee
      const committeeAssignments = await prisma.assignment.findMany({
        where: {
          reviewer_id: userId,
          assignment_type: AssignmentType.COMMITTEE
        },
        select: { topic_id: true }
      });
      const committeeTopicIds = committeeAssignments.map(a => a.topic_id);

      where.OR = [
        { topic: { supervisor_id: userId } },
        { topic_id: { in: committeeTopicIds } }
      ];
    } else if (user.role === UserRole.HEAD) {
      // Heads see all schedules in their department
      where.topic = {
        departmentId: user.departmentId
      };
    }

    const schedules = await prisma.defenseSchedule.findMany({
      where,
      include: {
        topic: {
          select: {
            id: true,
            title: true,
            registrations: {
              include: {
                group: {
                  include: {
                    members: {
                      include: { user: true }
                    }
                  }
                }
              }
            }
          }
        }
      },
      orderBy: { defense_date: 'asc' }
    });

    return schedules;
  }

  async getAssignments(userId: string, filters?: {
    topicId?: string;
    assignmentType?: AssignmentType;
    status?: AssignmentStatus;
  }) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new Error(ERROR_CODES.NOT_FOUND);
    }

    const where: any = {};
    const activeSem = await (await import('./semester.service')).default.getActiveSemester();
    
    where.topic = {
      current_students: { gt: 0 }
    };
    
    if (!filters?.topicId) {
      if (activeSem) {
        where.topic.semester_id = activeSem.id;
      }
    }

    // Apply filters
    if (filters?.topicId) {
      where.topic_id = filters.topicId;
    }
    if (filters?.assignmentType) {
      where.assignment_type = filters.assignmentType;
    }
    if (filters?.status && (filters.status as string) !== 'ALL') {
      where.status = filters.status;
    }

    // [FIX] Even if HEAD, the personal tabs (Reviewer/Council) should only show THEIR assignments.
    // Department-wide view is handled by a different logic/tab.
    where.reviewer_id = userId;

    const assignments = await prisma.assignment.findMany({
      where,
      include: {
        topic: {
          include: {
            supervisor: {
              select: {
                id: true,
                full_name: true,
                email: true,
              },
            },
            defense_schedules: true,
            grades: true, 
            final_scores: true,
            assignments: true, // Include assignments to check against assigned reviewers/committee
            registrations: {
              include: {
                student: {
                  select: {
                    id: true,
                    full_name: true,
                    email: true,
                    student_code: true,
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
                            email: true,
                            student_code: true,
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        reviewer: {
          select: {
            id: true,
            full_name: true,
            email: true,
          },
        },
        assigner: {
          select: {
            id: true,
            full_name: true,
          },
        },
      },
      orderBy: { assigned_at: 'desc' },
    });

    // Map to camelCase and include topicTitle and STUDENTS for frontend compatibility
    return (assignments as any[]).map(a => {
      const topicTitle = a.topic.title;
      
      // Extract students to a top-level property so frontend can find it easily like Topics
      const registrations = a.topic?.registrations || [];
      const firstReg = registrations[0];
      let students = [];
      
      if (firstReg?.group?.members?.length > 0) {
        students = firstReg.group.members.map((m: any) => ({ ...m.user }));
      } else if (firstReg?.student) {
        students = [{ ...firstReg.student }];
      }

      return {
        ...a,
        topicTitle,
        students, // Add this for direct access in frontend
        reviewerOrder: a.reviewer_order,
        assignedAt: a.assigned_at,
        deadline: a.deadline_at,
        is_eligible_for_defense: a.topic?.is_eligible_for_defense,
        // Calculate grading status for frontend logic
        gradingStatus: a.topic ? (() => {
          const topic = a.topic;
          const registrations = topic.registrations || [];
          const studentIds = registrations.flatMap((reg: any) => 
            reg.group?.members?.map((m: any) => m.user_id) || [reg.student_id]
          );
          
          const supervisorGraded = topic.grades.some((g: any) => g.rater_role === RaterRole.SUPERVISOR);
          
          // Reviewer Check
          const reviewerAssignments = topic.assignments.filter((as: any) => as.assignment_type === AssignmentType.REVIEWER);
          const isReviewerComplete = reviewerAssignments.length > 0 && reviewerAssignments.every((ra: any) => 
            studentIds.every((sid: string) => 
              topic.grades.some((g: any) => 
                g.grader_id === ra.reviewer_id && 
                g.student_id === sid &&
                isReviewer(g.rater_role)
              )
            )
          );

          // Committee Check
          const committeeAssignments = topic.assignments.filter((as: any) => as.assignment_type === AssignmentType.COMMITTEE);
          const isCommitteeComplete = committeeAssignments.length >= 3 && committeeAssignments.every((ca: any) => 
            studentIds.every((sid: string) => 
              topic.grades.some((g: any) => 
                g.grader_id === ca.reviewer_id && 
                g.student_id === sid &&
                isCommittee(g.rater_role)
              )
            )
          );

          return {
            supervisorGraded,
            reviewerGradedCount: [...new Set(topic.grades.filter((g: any) => isReviewer(g.rater_role)).map((g: any) => g.grader_id))].length,
            totalReviewersRequired: topic.reviewer_required_count || 2,
            isReviewerComplete,
            committeeGradedCount: [...new Set(topic.grades.filter((g: any) => isCommittee(g.rater_role)).map((g: any) => g.grader_id))].length,
            isCommitteeComplete,
            isReadyForDecision: supervisorGraded && isReviewerComplete && isCommitteeComplete
          };
        })() : null
      };
    });
  }

  async deleteAssignment(userId: string, assignmentId: string) {
    const assignment = await prisma.assignment.findUnique({
      where: { id: assignmentId },
      include: {
        topic: {
          include: {
            grades: true,
          },
        },
      },
    });

    if (!assignment) {
      throw new Error(ERROR_CODES.ASSIGNMENT_NOT_FOUND);
    }

    // Cannot delete if reviewer has graded
    const hasGraded = assignment.topic.grades.some(g => g.grader_id === assignment.reviewer_id);
    if (hasGraded) {
      throw new Error('Cannot delete assignment after grading');
    }

    // Delete assignment
    await prisma.assignment.delete({
      where: { id: assignmentId },
    });


    // Create audit log
    await prisma.auditLog.create({
      data: {
        user_id: userId,
        action: 'DELETE_ASSIGNMENT',
        entity_type: 'Assignment',
        entity_id: assignmentId,
        old_value: assignment,
      },
    });

    return { message: 'Assignment deleted' };
  }

  /**
   * Get topics eligible for reviewer assignment (HEAD only)
   * Topics must have at least one registration with midterm_status = PASS
   * and not yet fully assigned (< 2 reviewers)
   */
  async getTopicsForReviewerAssignment(userId: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || (user.role !== UserRole.HEAD && user.role !== UserRole.COORDINATOR && user.role !== UserRole.ADMIN)) {
      throw new Error(ERROR_CODES.FORBIDDEN);
    }

    const topics = await prisma.topic.findMany({
      where: {
        ...(user.role !== UserRole.ADMIN && { departmentId: user.departmentId }),
        // --- SEMESTER ISOLATION ---
        semester_id: (await (await import('./semester.service')).default.getActiveSemester())?.id,
        current_students: { gt: 0 },
        // Only topics with PASS midterm registrations
        registrations: {
          some: {
            midterm_status: 'PASS',
          },
        },
        // [NEW] Logic mới: chưa bị hủy, chưa finalized
        status: {
          notIn: [TopicStatus.REJECTED, TopicStatus.FINALIZED],
        },
      },
      include: topicForCommitteeAssignmentInclude,
      orderBy: { created_at: 'desc' },
    });

    const result: CommitteeAssignmentSummary[] = [];
    topics.forEach((topic: TopicForCommitteeAssignment) => {
      // Group registrations by group_id
      const groups = new Map<string, GroupInfo>();
      topic.registrations.forEach(reg => {
        if (!reg.group_id) return;
        if (!groups.has(reg.group_id)) {
          groups.set(reg.group_id, {
            group_id: reg.group_id,
            group_name: reg.group?.name || 'Nhóm Đang Lập',
            registrations: [],
            assignments: topic.assignments.filter(a => a.group_id === reg.group_id),
          });
        }
        groups.get(reg.group_id)!.registrations.push(reg);
      });

      groups.forEach(groupInfo => {
        const reviewerCount = groupInfo.assignments.length;
        let assignmentStatus = 'NOT_ASSIGNED';
        if (reviewerCount >= 2) {
          assignmentStatus = 'FULLY_ASSIGNED';
        } else if (reviewerCount > 0) {
          assignmentStatus = 'PARTIALLY_ASSIGNED';
        }

        const room = groupInfo.assignments[0]?.room || null;

        // Use groupId as part of the unique identifier in UI, but return topic_id for compatibility
        result.push({
          ...topic,
          topicTitle: topic.title, // Add for compatibility
          groupId: groupInfo.group_id,
          groupName: groupInfo.group_name,
          assignments: groupInfo.assignments,
          registrations: groupInfo.registrations,
          reviewerCount,
          assignmentStatus,
          canAssignMore: reviewerCount < 3,
          room,
        });
      });
    });

    return result;
  }

  /**
   * Get topics eligible for committee assignment (HEAD only)
   * Topics must have completed reviewer grading
   */
  async getTopicsForCommitteeAssignment(userId: string): Promise<TopicForCommitteeAssignment[]> {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || (user.role !== UserRole.HEAD && user.role !== UserRole.COORDINATOR && user.role !== UserRole.ADMIN)) {
      throw new Error(ERROR_CODES.FORBIDDEN);
    }

    const semesterId = (await (await import('./semester.service')).default.getActiveSemester())?.id;
    if (!semesterId) throw new Error('Không tìm thấy học kỳ đang hoạt động');

    const [deptConfig, topics] = await Promise.all([
      (user.role === UserRole.HEAD || user.role === UserRole.COORDINATOR) ? prisma.departmentSemesterConfig.findUnique({
        where: { department_id_semester_id: { department_id: user.departmentId, semester_id: semesterId } }
      }) : null,
      prisma.topic.findMany({
        where: {
          ...(user.role !== UserRole.ADMIN && { departmentId: user.departmentId }),
          status: {
            in: [TopicStatus.REGISTERED, TopicStatus.COMPLETED, TopicStatus.FINALIZED],
          },
          current_students: { gt: 0 },
          semester_id: semesterId,
        },
        include: topicForCommitteeAssignmentInclude,
        orderBy: { created_at: 'desc' },
      })
    ]);

    const deptDefenseDate = deptConfig?.defense_date;

    const results = (topics as TopicForCommitteeAssignment[]).map(topic => {
      const eligibility = this.isEligibleForCommittee(topic);

      // Standardized Production Log
      console.log({
        tag: 'COMMITTEE_ELIGIBILITY',
        topicId: topic.id,
        topicCode: topic.code,
        title: topic.title,
        assignments: topic.assignments.length,
        eligible: eligibility.eligible,
        reason: eligibility.reason,
      });

      return {
        topic,
        eligibility
      };
    });

    const finalTopics = results
      .filter(r => r.eligibility.eligible)
      .map(r => {
        const topic = r.topic as any;
        const committeeAssignments = topic.assignments.filter(
          (a: any) => a.assignment_type === AssignmentType.COMMITTEE
        );
        const hasCommittee = committeeAssignments.length > 0;

        const reviewerAssignments = topic.assignments.filter((a: any) =>
          a.assignment_type === AssignmentType.REVIEWER &&
          [AssignmentStatus.ACCEPTED, AssignmentStatus.AUTO_ACCEPTED].includes(a.status)
        );
        const reviewerIds = [...new Set(reviewerAssignments.map((a: any) => a.reviewer_id))] as string[];

        const reviewerGrades = (topic.grades as any[]).filter(g =>
          ([RaterRole.REVIEWER_1, RaterRole.REVIEWER_2, RaterRole.REVIEWER_3] as RaterRole[]).includes(g.rater_role)
        );

        const supervisorGrades = (topic.grades as any[]).filter(g => g.rater_role === RaterRole.SUPERVISOR);

        // Calculate average reviewer score PER student + supervisor score
        const registrationsWithScores = topic.registrations.map((reg: any) => {
          const studentId = reg.student_id;

          // Reviewer score per student
          const perReviewerScores = reviewerIds.map((reviewerId: string) => {
            const grades = reviewerGrades.filter((g: any) => g.grader_id === reviewerId && g.student_id === studentId);
            if (grades.length === 0) return null;
            return grades.reduce((sum: number, g: any) => sum + (g.score * (g.criterion?.weight || 0)), 0);
          }).filter(s => s !== null) as number[];

          const avgReviewerScore = perReviewerScores.length > 0
            ? Math.round((perReviewerScores.reduce((a, b) => a + b, 0) / perReviewerScores.length) * 100) / 100
            : null;

          // Supervisor score per student
          const svGrades = supervisorGrades.filter((g: any) => g.student_id === studentId);
          const supervisorScore = svGrades.length > 0
            ? Math.round(svGrades.reduce((sum: number, g: any) => sum + (g.score * (g.criterion?.weight || 0)), 0) * 100) / 100
            : null;
          
          return {
            ...reg,
            avgReviewerScore,
            supervisorScore,
          };
        });

        const allStudentScores = registrationsWithScores.map((r: any) => r.avgReviewerScore).filter((s: any) => s !== null) as number[];
        const avgReviewerScore = allStudentScores.length > 0
          ? Math.round((allStudentScores.reduce((a: number, b: number) => a + b, 0) / allStudentScores.length) * 100) / 100
          : null;

        return {
          ...topic,
          registrations: registrationsWithScores,
          hasCommittee,
          avgReviewerScore,
          currentSchedule: topic.defense_schedules?.[0] ? {
            committee_id: topic.defense_schedules[0].committee_id,
            committee_name: (topic.defense_schedules[0] as any).committee?.name,
            defense_date: topic.defense_schedules[0].defense_date,
            start_time: topic.defense_schedules[0].start_time,
            end_time: topic.defense_schedules[0].end_time,
            room: topic.defense_schedules[0].room,
          } : null,
        } as any;
      });

    return {
      topics: finalTopics,
      deptDefenseDate
    } as any;
  }

  /**
   * Production-Grade Eligibility Engine Component
   */
  private isEligibleForCommittee(topic: any): { eligible: boolean; reason?: string } {
    // 0. Bypass: Topic already has committee assigned → always show in list (for edit/view)
    const hasCommittee = topic.assignments.some((a: any) =>
      a.assignment_type === AssignmentType.COMMITTEE &&
      [AssignmentStatus.ACCEPTED, AssignmentStatus.AUTO_ACCEPTED].includes(a.status)
    );
    if (hasCommittee) {
      return { eligible: true, reason: 'COMMITTEE_ASSIGNED' };
    }

    // 1. Filter only accepted reviewer assignments
    const reviewers = topic.assignments.filter((a: any) =>
      a.assignment_type === AssignmentType.REVIEWER &&
      [AssignmentStatus.ACCEPTED, AssignmentStatus.AUTO_ACCEPTED].includes(a.status)
    );

    // 2. Consistency Guard: Ensure at least 2 unique reviewers
    const uniqueReviewerIds = new Set(reviewers.map((r: any) => r.reviewer_id));
    if (uniqueReviewerIds.size < 2) {
      return { eligible: false, reason: 'NOT_ENOUGH_UNIQUE_REVIEWERS' };
    }

    // 3. Completion Guard: Check if everyone has submitted grades
    const reviewersWhoGraded = new Set(
      topic.grades
        .filter((g: any) =>
          ([RaterRole.REVIEWER_1, RaterRole.REVIEWER_2, RaterRole.REVIEWER_3] as RaterRole[]).includes(g.rater_role)
        )
        .map((g: any) => g.grader_id)
    );

    const allGraded = reviewers.every((r: any) => reviewersWhoGraded.has(r.reviewer_id));
    if (!allGraded) {
      return { eligible: false, reason: 'GRADES_INCOMPLETE' };
    }

    return { eligible: true };
  }


  /**
   * Get available reviewers for a topic (excluding GVHD)
   */
  async getAvailableReviewers(userId: string, topicId: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || (user.role !== UserRole.HEAD && user.role !== UserRole.COORDINATOR && user.role !== UserRole.ADMIN)) {
      throw new Error(ERROR_CODES.FORBIDDEN);
    }

    const topic = await prisma.topic.findUnique({
      where: { id: topicId },
      include: {
        assignments: {
          where: { assignment_type: AssignmentType.REVIEWER },
        },
      },
    });

    if (!topic) {
      throw new Error(ERROR_CODES.TOPIC_NOT_FOUND);
    }

    // Get already assigned reviewer IDs
    const assignedReviewerIds = topic.assignments.map(a => a.reviewer_id);

    // Get available reviewers (LECTURER/HEAD role, same department as topic, not GVHD, not already assigned)
    const reviewers = await prisma.user.findMany({
      where: {
        departmentId: topic.departmentId,
        role: { in: [UserRole.LECTURER, UserRole.HEAD, UserRole.COORDINATOR] },
        id: {
          notIn: [...assignedReviewerIds, topic.supervisor_id], // Exclude GVHD and already assigned
        },
      },
      select: {
        id: true,
        full_name: true,
        email: true,
        avatar_url: true,
      },
      orderBy: { full_name: 'asc' },
    });

    return reviewers;
  }

  /**
   * Get all potential reviewers for a department (HEAD role only)
   */
  async getAvailableReviewersForDepartment(userId: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || (user.role !== UserRole.HEAD && user.role !== UserRole.COORDINATOR && user.role !== UserRole.ADMIN)) {
      throw new Error(ERROR_CODES.FORBIDDEN);
    }

    const reviewers = await prisma.user.findMany({
      where: {
        ...(user.role !== UserRole.ADMIN && { departmentId: user.departmentId }),
        role: { in: [UserRole.LECTURER, UserRole.HEAD, UserRole.COORDINATOR] },
      },
      select: {
        id: true,
        full_name: true,
        email: true,
        avatar_url: true,
      },
      orderBy: { full_name: 'asc' },
    });

    return reviewers;
  }

  /**
   * Assign committee members to a topic (HEAD only)
   */
  async assignCommittee(
    userId: string,
    data: {
      topicId: string;
      chairId: string;
      secretaryId: string;
      memberIds: string[];
      defenseDate: Date;
    }
  ) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || (user.role !== UserRole.HEAD && user.role !== UserRole.COORDINATOR && user.role !== UserRole.ADMIN)) {
      throw new Error(ERROR_CODES.FORBIDDEN);
    }

    const topic = await prisma.topic.findUnique({
      where: { id: data.topicId },
    });

    if (!topic) {
      throw new Error(ERROR_CODES.TOPIC_NOT_FOUND);
    }

    // Validate defenseDate in the future
    if (data.defenseDate && new Date(data.defenseDate) <= new Date()) {
      throw new Error('Ngày bảo vệ hội đồng phải lớn hơn thời gian hiện tại');
    }

    // Validate: GVHD cannot be committee member
    const allMembers = [data.chairId, data.secretaryId, ...data.memberIds];
    if (allMembers.includes(topic.supervisor_id)) {
      throw new Error('GVHD khÃ´ng Ä‘Æ°á»£c tham gia há»™i Ä‘á»“ng cá»§a Ä‘á» tÃ i mÃ¬nh hÆ°á»›ng dáº«n');
    }

    // Validate: No duplicate members
    const uniqueMembers = new Set(allMembers);
    if (uniqueMembers.size !== allMembers.length) {
      throw new Error('ThÃ nh viÃªn há»™i Ä‘á»“ng khÃ´ng Ä‘Æ°á»£c trÃ¹ng láº·p');
    }

    // [DEPARTMENT GUARD] All committee members must be from the same department as the topic
    const memberUsers = await prisma.user.findMany({
      where: { id: { in: allMembers } },
      select: { id: true, full_name: true, departmentId: true },
    });
    const wrongDeptMembers = memberUsers.filter(u => u.departmentId !== topic.departmentId);
    if (wrongDeptMembers.length > 0) {
      const names = wrongDeptMembers.map(u => u.full_name).join(', ');
      throw new Error(`Thành viên hội đồng phải thuộc cùng bộ môn với đề tài: ${names}`);
    }

    // Delete existing committee assignments if any
    await prisma.assignment.deleteMany({
      where: {
        topic_id: data.topicId,
        assignment_type: AssignmentType.COMMITTEE,
      },
    });

    // Create committee assignments
    const assignments = [];

    // Chair
    assignments.push(
      await prisma.assignment.create({
        data: {
          topic_id: data.topicId,
          reviewer_id: data.chairId,
          assignment_type: AssignmentType.COMMITTEE,
          committee_role: 'CHAIR',
          assigned_by: userId,
          deadline_at: data.defenseDate,
          status: AssignmentStatus.AUTO_ACCEPTED,
        },
      })
    );

    // Secretary
    assignments.push(
      await prisma.assignment.create({
        data: {
          topic_id: data.topicId,
          reviewer_id: data.secretaryId,
          assignment_type: AssignmentType.COMMITTEE,
          committee_role: 'SECRETARY',
          assigned_by: userId,
          deadline_at: data.defenseDate,
          status: AssignmentStatus.AUTO_ACCEPTED,
        },
      })
    );

    // Members
    for (const memberId of data.memberIds) {
      assignments.push(
        await prisma.assignment.create({
          data: {
            topic_id: data.topicId,
            reviewer_id: memberId,
            assignment_type: AssignmentType.COMMITTEE,
            committee_role: 'MEMBER',
            assigned_by: userId,
            deadline_at: data.defenseDate,
            status: AssignmentStatus.AUTO_ACCEPTED,
          },
        })
      );
    }

    // Create audit log
    await prisma.auditLog.create({
      data: {
        user_id: userId,
        action: 'ASSIGN_COMMITTEE',
        entity_type: 'Assignment',
        entity_id: data.topicId,
        new_value: { chairId: data.chairId, secretaryId: data.secretaryId, memberIds: data.memberIds },
      },
    });

    return assignments;
  }
  async updateDefenseType(userId: string, topicId: string, type: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || (user.role !== UserRole.HEAD && user.role !== UserRole.COORDINATOR && user.role !== UserRole.ADMIN)) {
      throw new Error(ERROR_CODES.FORBIDDEN);
    }

    if (type !== 'ORAL' && type !== 'POSTER' && type !== null) {
      throw new Error('Invalid defense type');
    }

    const topic = await prisma.topic.update({
      where: { id: topicId },
      data: { defense_type: type },
    });

    await prisma.auditLog.create({
      data: {
        user_id: userId,
        action: 'UPDATE_DEFENSE_TYPE',
        entity_type: 'Topic',
        entity_id: topicId,
        new_value: { defense_type: type },
      },
    });

    return topic;
  }

  async updateReviewerSchedule(
    userId: string,
    data: {
      topicId: string;
      groupId: string;
      defenseFormat: string;
      room?: string;
      zoomPassword?: string;
      startTime?: Date;
      endTime?: Date;
    }
  ) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || (user.role !== UserRole.HEAD && user.role !== UserRole.COORDINATOR && user.role !== UserRole.ADMIN)) {
      throw new Error(ERROR_CODES.FORBIDDEN);
    }

    const { topicId, groupId, defenseFormat, room, zoomPassword, startTime, endTime } = data;

    if (startTime && endTime && new Date(startTime) >= new Date(endTime)) {
      throw new Error('Giờ bắt đầu phải trước giờ kết thúc');
    }

    if (startTime && new Date(startTime) <= new Date()) {
      throw new Error('Thời gian bắt đầu phản biện phải lớn hơn thời gian hiện tại');
    }
    if (endTime && new Date(endTime) <= new Date()) {
      throw new Error('Thời gian kết thúc phản biện phải lớn hơn thời gian hiện tại');
    }

    // Check conflict for all assigned reviewers under this group if schedule is set
    if (startTime && endTime) {
      const existingAssignments = await prisma.assignment.findMany({
        where: {
          topic_id: topicId,
          group_id: groupId,
          assignment_type: AssignmentType.REVIEWER,
        },
      });

      for (const assignment of existingAssignments) {
        await this.checkReviewerConflict(
          assignment.reviewer_id,
          new Date(startTime),
          new Date(endTime),
          topicId,
          groupId
        );
      }
    }

    const result = await prisma.assignment.updateMany({
      where: {
        topic_id: topicId,
        group_id: groupId,
        assignment_type: AssignmentType.REVIEWER,
      },
      data: {
        defense_format: defenseFormat || 'OFFLINE',
        room: room || null,
        zoom_password: zoomPassword || null,
        start_time: startTime ? new Date(startTime) : null,
        end_time: endTime ? new Date(endTime) : null,
      },
    });

    await prisma.auditLog.create({
      data: {
        user_id: userId,
        action: 'UPDATE_REVIEWER_SCHEDULE',
        entity_type: 'Assignment',
        entity_id: topicId,
        new_value: { groupId, defenseFormat, room, zoomPassword, startTime, endTime },
      },
    });

    return result;
  }

  async checkReviewerConflict(reviewerId: string, startTime: Date, endTime: Date, currentTopicId: string, currentGroupId: string | null) {
    const overlapping = await prisma.assignment.findFirst({
      where: {
        reviewer_id: reviewerId,
        assignment_type: AssignmentType.REVIEWER,
        status: {
          in: [AssignmentStatus.PENDING, AssignmentStatus.ACCEPTED, AssignmentStatus.AUTO_ACCEPTED],
        },
        start_time: { not: null },
        end_time: { not: null },
        OR: [
          {
            start_time: { lt: endTime },
            end_time: { gt: startTime },
          },
        ],
        NOT: {
          topic_id: currentTopicId,
          ...(currentGroupId && { group_id: currentGroupId }),
        },
      },
      include: {
        topic: true,
        reviewer: true,
      },
    });

    if (overlapping) {
      const formattedStart = overlapping.start_time ? new Date(overlapping.start_time).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : '';
      const formattedEnd = overlapping.end_time ? new Date(overlapping.end_time).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : '';
      const formattedDate = overlapping.start_time ? new Date(overlapping.start_time).toLocaleDateString('vi-VN') : '';
      throw new Error(
        `Giảng viên ${overlapping.reviewer.full_name} đã có lịch phản biện khác vào thời gian này (${formattedStart} - ${formattedEnd} ngày ${formattedDate} cho đề tài "${overlapping.topic.title}").`
      );
    }
  }
}

export default new AssignmentService();
