import prisma from '../config/database';
import { AssignmentType, AssignmentStatus, TopicStatus, UserRole, Prisma, MidtermStatus, RaterRole } from '@prisma/client';
import { CreateAssignmentRequest, CreateDefenseScheduleRequest } from '../types';
import { ERROR_CODES } from '../constants';
import notificationService from './notification.service';


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
        ],
      },
    },
    include: {
      criterion: true,
    },
  },
  defense_schedule: {
    include: {
      committee: true
    }
  } as any
} satisfies Prisma.TopicInclude;

export type TopicForCommitteeAssignment = Prisma.TopicGetPayload<{
  include: typeof topicForCommitteeAssignmentInclude
}>;

export class AssignmentService {
  async createReviewerAssignment(userId: string, data: CreateAssignmentRequest) {
    // Verify topic exists and is in correct status
    const topic = await prisma.topic.findUnique({
      where: { id: data.topicId },
      include: {
        assignments: true,
        registrations: true,
      },
    });

    if (!topic) {
      throw new Error(ERROR_CODES.TOPIC_NOT_FOUND);
    }

    if (topic.status !== TopicStatus.REGISTERED) {
      throw new Error('Äá» tÃ i pháº£i á»Ÿ tráº¡ng thÃ¡i REGISTERED');
    }



    // Validate reviewer order (1, 2, or 3)
    if (data.reviewerOrder && ![1, 2, 3].includes(data.reviewerOrder)) {
      throw new Error('Reviewer order must be 1, 2, or 3');
    }

    // Check if supervisor is trying to review their own topic
    if (topic.supervisor_id === data.reviewerId) {
      throw new Error(ERROR_CODES.SUPERVISOR_CONFLICT);
    }

    // Check for duplicate reviewer
    const existingAssignment = topic.assignments.find(
      a => a.reviewer_id === data.reviewerId && a.assignment_type === AssignmentType.REVIEWER
    );

    if (existingAssignment) {
      throw new Error(ERROR_CODES.REVIEWER_DUPLICATE);
    }

    // Check for duplicate reviewer order
    if (data.reviewerOrder) {
      const orderExists = topic.assignments.find(
        a => a.reviewer_order === data.reviewerOrder && a.assignment_type === AssignmentType.REVIEWER
      );

      if (orderExists) {
        throw new Error(`Reviewer ${data.reviewerOrder} already assigned`);
      }
    }

    // Check workload limit
    const workload = await prisma.userWorkloadLimit.findFirst({
      where: {
        user_id: data.reviewerId,
        semester_id: topic.semester_id,
        role_type: 'REVIEWER',
      },
    });

    if (workload && workload.current_count >= workload.max_count) {
      throw new Error(ERROR_CODES.WORKLOAD_EXCEEDED);
    }

    // Create assignment
    const assignment = await prisma.assignment.create({
      data: {
        topic_id: data.topicId,
        reviewer_id: data.reviewerId,
        assignment_type: AssignmentType.REVIEWER,
        reviewer_order: data.reviewerOrder,
        assigned_by: userId,
        deadline_at: data.deadlineAt,
        status: AssignmentStatus.AUTO_ACCEPTED,
        responded_at: new Date(),
      },
    });

    // Update workload
    if (workload) {
      await prisma.userWorkloadLimit.update({
        where: { id: workload.id },
        data: {
          current_count: { increment: 1 },
        },
      });
    }

    // Update topic status if needed
    const reviewerCount = topic.assignments.filter(a => a.assignment_type === AssignmentType.REVIEWER).length + 1;
    if (reviewerCount >= 2) {
      await prisma.topic.update({
        where: { id: data.topicId },
        data: {
          status: TopicStatus.UNDER_REVIEW,
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

    // Update workload
    const workload = await prisma.userWorkloadLimit.findFirst({
      where: {
        user_id: userId,
        semester_id: assignment.topic.semester_id,
        role_type: assignment.assignment_type === AssignmentType.REVIEWER ? 'REVIEWER' : 'COMMITTEE',
      },
    });

    if (workload) {
      await prisma.userWorkloadLimit.update({
        where: { id: workload.id },
        data: {
          current_count: { decrement: 1 },
        },
      });
    }

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
    // Verify topic
    const topic = await prisma.topic.findUnique({
      where: { id: data.topicId },
      include: {
        grades: true,
      },
    });

    if (!topic) {
      throw new Error(ERROR_CODES.TOPIC_NOT_FOUND);
    }

    if (topic.status !== TopicStatus.WAITING_FOR_DEFENSE_ASSIGNMENT) {
      throw new Error('Topic must be in WAITING_FOR_DEFENSE_ASSIGNMENT status');
    }

    // Check if all reviewers have graded
    const reviewerGrades = topic.grades.filter(g =>
      ([RaterRole.REVIEWER_1, RaterRole.REVIEWER_2, RaterRole.REVIEWER_3] as RaterRole[]).includes(g.rater_role)
    );

    const assignments = await prisma.assignment.findMany({
      where: {
        topic_id: data.topicId,
        assignment_type: AssignmentType.REVIEWER,
        status: AssignmentStatus.ACCEPTED,
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

    // Create defense schedule
    const schedule = await prisma.defenseSchedule.create({
      data: {
        topic_id: data.topicId,
        semester_id: topic.semester_id, // [FIX] Added required field
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
      await prisma.assignment.create({
        data: {
          topic_id: data.topicId,
          reviewer_id: member.reviewer_id,
          assignment_type: AssignmentType.COMMITTEE,
          committee_role: member.role as any, // CHAIR, SECRETARY, MEMBER
          assigned_by: userId,
          deadline_at: data.defenseDate,
          status: AssignmentStatus.AUTO_ACCEPTED,
        },
      });

      // Update workload
      const workload = await prisma.userWorkloadLimit.findFirst({
        where: {
          user_id: member.reviewer_id,
          semester_id: topic.semester_id,
          role_type: 'COMMITTEE',
        },
      });

      if (workload) {
        await prisma.userWorkloadLimit.update({
          where: { id: workload.id },
          data: {
            current_count: { increment: 1 },
          },
        });
      }
    }

    // Update topic status
    await prisma.topic.update({
      where: { id: data.topicId },
      data: {
        status: TopicStatus.WAITING_FOR_DEFENSE,
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

    // Apply filters
    if (filters?.topicId) {
      where.topic_id = filters.topicId;
    }
    if (filters?.assignmentType) {
      where.assignment_type = filters.assignmentType;
    }
    if (filters?.status) {
      where.status = filters.status;
    }

    // Role-based filtering
    if (user.role === UserRole.LECTURER) {
      where.reviewer_id = userId;
    } else if (user.role === UserRole.HEAD) {
      where.topic = {
        departmentId: user.departmentId,
      };
    }

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
            registrations: {
              include: {
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

    // Map to camelCase and include topicTitle for frontend compatibility
    return assignments.map(a => ({
      ...a,
      topicTitle: a.topic.title,
      reviewerOrder: a.reviewer_order,
      assignedAt: a.assigned_at,
      deadline: a.deadline_at,
    }));
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

    // Update workload
    const workload = await prisma.userWorkloadLimit.findFirst({
      where: {
        user_id: assignment.reviewer_id,
        semester_id: assignment.topic.semester_id,
        role_type: assignment.assignment_type === AssignmentType.REVIEWER ? 'REVIEWER' : 'COMMITTEE',
      },
    });

    if (workload && workload.current_count > 0) {
      await prisma.userWorkloadLimit.update({
        where: { id: workload.id },
        data: {
          current_count: { decrement: 1 },
        },
      });
    }

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
    if (!user || user.role !== UserRole.HEAD) {
      throw new Error(ERROR_CODES.FORBIDDEN);
    }

    const topics = await prisma.topic.findMany({
      where: {
        departmentId: user.departmentId,
        // Only topics with PASS midterm registrations
        registrations: {
          some: {
            midterm_status: 'PASS',
          },
        },
      },
      include: {
        supervisor: {
          select: { id: true, full_name: true, email: true },
        },
        registrations: {
          where: {
            midterm_status: 'PASS',
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
                    user: {
                      select: { id: true, full_name: true, student_code: true, email: true },
                    },
                  },
                },
              },
            },
          },
        },
        assignments: {
          where: { assignment_type: AssignmentType.REVIEWER },
          include: {
            reviewer: {
              select: { id: true, full_name: true },
            },
          },
        },
      },
      orderBy: { created_at: 'desc' },
    });

    // Add computed fields
    return topics.map(topic => {
      const reviewerCount = topic.assignments.length;
      let assignmentStatus = 'NOT_ASSIGNED';
      if (reviewerCount >= 2) {
        assignmentStatus = 'FULLY_ASSIGNED';
      } else if (reviewerCount > 0) {
        assignmentStatus = 'PARTIALLY_ASSIGNED';
      }

      return {
        ...topic,
        topicTitle: topic.title, // Add for compatibility
        reviewerCount,
        assignmentStatus,
        canAssignMore: reviewerCount < 3,
      };
    });
  }

  /**
   * Get topics eligible for committee assignment (HEAD only)
   * Topics must have completed reviewer grading
   */
  async getTopicsForCommitteeAssignment(userId: string): Promise<TopicForCommitteeAssignment[]> {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.role !== UserRole.HEAD) {
      throw new Error(ERROR_CODES.FORBIDDEN);
    }

    const topics = await prisma.topic.findMany({
      where: {
        departmentId: user.departmentId,
        // Has reviewer assignments that are accepted
        assignments: {
          some: {
            assignment_type: AssignmentType.REVIEWER,
            status: AssignmentStatus.ACCEPTED,
          },
        },
      },
      include: topicForCommitteeAssignmentInclude,
      orderBy: { created_at: 'desc' },
    }) as TopicForCommitteeAssignment[];

    // Filter topics that have reviewer grades completed
    const processedTopics = topics.filter(topic => {
      const reviewerAssignments = topic.assignments.filter(
        a => a.assignment_type === AssignmentType.REVIEWER && a.status === AssignmentStatus.ACCEPTED
      );

      // Get unique reviewers who have graded
      const reviewersWhoGraded = new Set(
        topic.grades
          .filter(g =>
            ([RaterRole.REVIEWER_1, RaterRole.REVIEWER_2, RaterRole.REVIEWER_3] as RaterRole[]).includes(g.rater_role)
          )
          .map(g => g.grader_id)
      );

      // Ensures ALL assigned reviewers have graded, and there are at least 2 reviewers
      return reviewerAssignments.length >= 2 && reviewersWhoGraded.size >= reviewerAssignments.length;
    }).map(topic => {
      const committeeAssignments = topic.assignments.filter(
        a => a.assignment_type === AssignmentType.COMMITTEE
      );
      const hasCommittee = committeeAssignments.length > 0;

      // Calculate weighted scores based on criteria
      const calculateWeightedScore = (grades: any[]) => {
        if (grades.length === 0) return 0;
        return grades.reduce((sum, grade) => sum + (grade.score * (grade.criterion?.weight || 0)), 0);
      };

      const advisorGrades = topic.grades.filter(g => g.rater_role === RaterRole.SUPERVISOR);
      const reviewerGrades = topic.grades.filter(g =>
        ([RaterRole.REVIEWER_1, RaterRole.REVIEWER_2, RaterRole.REVIEWER_3] as RaterRole[]).includes(g.rater_role)
      );
      const studentIds = [...new Set(topic.grades.map(g => g.student_id).filter(Boolean))];

      let defenseScore = 0;
      let totalReviewerScoreOnly = 0;

      if (studentIds.length > 0) {
        let totalStudentScores = 0;
        let totalStudentReviewerScores = 0;
        for (const studentId of studentIds) {
          const studentAdvisorGrades = advisorGrades.filter(g => g.student_id === studentId);
          const studentReviewerGrades = reviewerGrades.filter(g => g.student_id === studentId);

          const advScore = studentAdvisorGrades.length > 0 ? calculateWeightedScore(studentAdvisorGrades) : null;

          const distinctReviewers = [...new Set(studentReviewerGrades.map(g => g.grader_id))];
          const reviewerScores = [];
          for (const reviewerId of distinctReviewers) {
            reviewerScores.push(calculateWeightedScore(studentReviewerGrades.filter(g => g.grader_id === reviewerId)));
          }

          // Final Formula: Average of all available scores (Supervisor + Reviewers)
          const allStudentScores = [advScore, ...reviewerScores].filter((s): s is number => s !== null);
          const avgScoreForStudent = allStudentScores.length > 0 ? (allStudentScores.reduce((a, b) => a + b, 0) / allStudentScores.length) : 0;

          // Also track just reviewer average for display
          const avgReviewerScoreForStudent = reviewerScores.length > 0 ? (reviewerScores.reduce((a, b) => a + b, 0) / reviewerScores.length) : 0;

          totalStudentScores += avgScoreForStudent;
          totalStudentReviewerScores += avgReviewerScoreForStudent;
        }
        defenseScore = totalStudentScores / studentIds.length;
        totalReviewerScoreOnly = totalStudentReviewerScores / studentIds.length;
      } else {
        const advScore = advisorGrades.length > 0 ? calculateWeightedScore(advisorGrades) : null;

        const distinctReviewers = [...new Set(reviewerGrades.map(g => g.grader_id))];
        const reviewerScores = [];
        for (const reviewerId of distinctReviewers) {
          reviewerScores.push(calculateWeightedScore(reviewerGrades.filter(g => g.grader_id === reviewerId)));
        }

        const allScores = [advScore, ...reviewerScores].filter((s): s is number => s !== null);

        defenseScore = allScores.length > 0 ? allScores.reduce((a, b) => a + b, 0) / allScores.length : 0;
        totalReviewerScoreOnly = reviewerScores.length > 0 ? (reviewerScores.reduce((a, b) => a + b, 0) / reviewerScores.length) : 0;
      }

      return {
        ...topic,
        topicTitle: topic.title,
        hasCommittee,
        avgReviewerScore: totalReviewerScoreOnly,
        defense_score: defenseScore,
        committeeAssignments,
        currentSchedule: topic.defense_schedule ? {
          committee_id: (topic.defense_schedule as any).committee_id,
          committee_name: (topic.defense_schedule as any).committee?.name,
          defense_date: topic.defense_schedule.defense_date,
          start_time: (topic.defense_schedule as any).start_time,
          end_time: (topic.defense_schedule as any).end_time,
          room: topic.defense_schedule.room,
        } : null,
      };
    });

    processedTopics.sort((a, b) => b.defense_score - a.defense_score);

    return processedTopics;
  }

  /**
   * Get available reviewers for a topic (excluding GVHD)
   */
  async getAvailableReviewers(userId: string, topicId: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.role !== UserRole.HEAD) {
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

    // Get available reviewers (SUPERVISOR role, same department, not GVHD, not already assigned)
    const reviewers = await prisma.user.findMany({
      where: {
        departmentId: user.departmentId,
        role: { in: [UserRole.LECTURER, UserRole.HEAD] },
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
    if (!user || user.role !== UserRole.HEAD) {
      throw new Error(ERROR_CODES.FORBIDDEN);
    }

    const reviewers = await prisma.user.findMany({
      where: {
        departmentId: user.departmentId,
        role: { in: [UserRole.LECTURER, UserRole.HEAD] },
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
    if (!user || user.role !== UserRole.HEAD) {
      throw new Error(ERROR_CODES.FORBIDDEN);
    }

    const topic = await prisma.topic.findUnique({
      where: { id: data.topicId },
    });

    if (!topic) {
      throw new Error(ERROR_CODES.TOPIC_NOT_FOUND);
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
    if (!user || user.role !== UserRole.HEAD) {
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
}

export default new AssignmentService();
