import prisma from '../config/database';
import { RegistrationStatus, StudentProgressStatus, TopicStatus, Prisma, TopicRegistration, UserRole, SemesterPhase } from '@prisma/client';
import { ERROR_CODES } from '../constants';
import notificationService from './notification.service';
import { SemesterGuard } from '../utils/semester-guard';
import { AcademicAction, AcademicPolicy } from '../utils/academic-policy';
import { GroupUtils } from '../utils/group.utils';
import semesterService from './semester.service';

export class RegistrationService {
  // =====================================================
  // NEW FLOW: Register topic individually, then form group
  // =====================================================

  /**
   * Student registers for a topic individually (no group required)
   * Flow: Student -> Register Topic -> See other students -> Form group
   */
  async registerTopicIndividual(userId: string, topicId: string, accepted: boolean) {
    if (!accepted) {
      throw new Error('Bạn phải xác nhận các điều khoản trước khi đăng ký đề tài');
    }

    // 1. Initial validation outside transaction
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.role !== 'STUDENT') {
      throw new Error('Chỉ sinh viên mới được đăng ký đề tài');
    }

    // 2. Perform registration within a transaction to ensure atomicity
    const result = await prisma.$transaction(async (tx) => {
      // Re-fetch topic inside transaction to get latest current_students
      const topic = await tx.topic.findUnique({
        where: { id: topicId },
        include: { semester: true },
      });

      if (!topic) throw new Error(ERROR_CODES.TOPIC_NOT_FOUND);

      // Strict Capacity Check
      if ((topic.current_students || 0) >= topic.max_students) {
        throw new Error('Đề tài này đã đủ số lượng sinh viên tối đa.');
      }

      if (topic.status !== TopicStatus.APPROVED) {
        throw new Error('Đề tài chưa được duyệt hoặc đã đóng đăng ký.');
      }

      // Dept check: Only same department allowed
      if (user.departmentId !== topic.departmentId) {
        throw new Error('Sinh viên chỉ được đăng ký đề tài thuộc đúng chuyên ngành.');
      }

      // Academic policy check
      AcademicPolicy.enforce(AcademicAction.REGISTER_TOPIC, user, topic.semester);

      // Duplicate registration check
      const existing = await tx.topicRegistration.findFirst({
        where: {
          student_id: userId,
          semester_id: topic.semester_id,
          status: { notIn: [RegistrationStatus.REJECTED, RegistrationStatus.CANCELLED] },
        },
      });

      if (existing) {
        if (existing.topic_id === topicId) return { type: 'EXISTING', data: existing };
        throw new Error('Bạn đã đăng ký đề tài khác trong học kỳ này.');
      }

      // Create registration
      const registration = await tx.topicRegistration.create({
        data: {
          student_id: userId,
          topic_id: topicId,
          semester_id: topic.semester_id,
          status: RegistrationStatus.CONFIRMED,
          student_progress_status: StudentProgressStatus.HAS_TOPIC,
          confirmed_at: new Date(),
        },
      });

      // Atomic increment & Potential Status Update
      const newCount = (topic.current_students || 0) + 1;
      const updateData: Prisma.TopicUpdateInput = { current_students: newCount };
      if (newCount >= topic.max_students) {
        updateData.status = TopicStatus.REGISTERED;
      }

      await tx.topic.update({
        where: { id: topicId },
        data: updateData,
      });

      return { type: 'NEW', data: registration };
    }) as { type: 'EXISTING' | 'NEW'; data: TopicRegistration };

    if (result.type === 'EXISTING') {
      // Return refreshed data
      const refreshed = await prisma.topicRegistration.findUnique({
        where: { id: result.data.id },
        include: { topic: { include: { supervisor: { select: { id: true, full_name: true, email: true, avatar_url: true } } } } },
      });
      return refreshed!;
    }

    const reg = result.data;

    // 3. Post-transaction: Audit & Notifications
    await prisma.auditLog.create({
      data: {
        user_id: userId,
        action: 'REGISTER_TOPIC_INDIVIDUAL',
        entity_type: 'TopicRegistration',
        entity_id: reg.id,
        new_value: reg,
      },
    });

    const updatedRegistration = await prisma.topicRegistration.findUnique({
      where: { id: reg.id },
      include: { topic: { include: { supervisor: { select: { id: true, full_name: true, email: true, avatar_url: true } } } } },
    });

    if (updatedRegistration) {
      await notificationService.createNotification(
        updatedRegistration.topic.supervisor_id,
        'TOPIC_REGISTRATION_NEW',
        'Có đăng ký mới cho đề tài',
        `Sinh viên "${user.full_name}" đã đăng ký tham gia đề tài "${updatedRegistration.topic.title}".`,
        updatedRegistration.id
      );
    }

    return updatedRegistration!;
  }

  /**
   * GVHD registers a topic ON BEHALF of a student (optional flow)
   * GVHD involvement ends here - group formation is 100% student-driven
   */
  async registerTopicForStudent(supervisorId: string, studentId: string, topicId: string) {
    // 1. Validations outside transaction
    const [supervisor, student] = await Promise.all([
      prisma.user.findUnique({ where: { id: supervisorId } }),
      prisma.user.findUnique({ where: { id: studentId } }),
    ]);

    if (!supervisor || supervisor.role !== UserRole.LECTURER) {
      throw new Error('Chỉ giảng viên mới được đăng ký thay sinh viên');
    }
    if (!student || student.role !== 'STUDENT') {
      throw new Error('Người được đăng ký phải là sinh viên');
    }

    // 2. Transaction
    const result = await prisma.$transaction(async (tx) => {
      const topic = await tx.topic.findUnique({
        where: { id: topicId },
        include: { semester: true },
      });

      if (!topic) throw new Error(ERROR_CODES.TOPIC_NOT_FOUND);
      if (topic.supervisor_id !== supervisorId) throw new Error('Bạn chỉ được đăng ký sinh viên vào đề tài của mình');

      // Strict Capacity Check
      if ((topic.current_students || 0) >= topic.max_students) {
        throw new Error('Đề tài này đã đủ số lượng sinh viên tối đa.');
      }

      // Dept check
      if (student.departmentId !== topic.departmentId) {
        throw new Error('Sinh viên chỉ được đăng ký đề tài thuộc đúng chuyên ngành.');
      }

      // Academic policy
      AcademicPolicy.enforce(AcademicAction.REGISTER_TOPIC, supervisor, topic.semester);

      // Duplicate check
      const existing = await tx.topicRegistration.findFirst({
        where: {
          student_id: studentId,
          semester_id: topic.semester_id,
          status: { notIn: [RegistrationStatus.REJECTED, RegistrationStatus.CANCELLED] },
        },
      });

      if (existing) throw new Error('Sinh viên đã đăng ký đề tài trong học kỳ này');

      // Create
      const registration = await tx.topicRegistration.create({
        data: {
          student_id: studentId,
          topic_id: topicId,
          semester_id: topic.semester_id,
          status: RegistrationStatus.CONFIRMED,
          student_progress_status: StudentProgressStatus.HAS_TOPIC,
          confirmed_at: new Date(),
        },
      });

      // Update topic
      const newCount = (topic.current_students || 0) + 1;
      const updateData: any = { current_students: newCount };
      if (newCount >= topic.max_students) {
        updateData.status = TopicStatus.REGISTERED;
        updateData.progress_stage = 'WORKING';
      }

      await tx.topic.update({
        where: { id: topicId },
        data: updateData,
      });

      return registration;
    });

    // 3. Post-transaction
    await prisma.auditLog.create({
      data: {
        user_id: supervisorId,
        action: 'REGISTER_TOPIC_FOR_STUDENT',
        entity_type: 'TopicRegistration',
        entity_id: result.id,
        new_value: { supervisorId, studentId, topicId },
      },
    });

    await prisma.notification.create({
      data: {
        user_id: studentId,
        type: 'INFO',
        title: 'Đã được đăng ký đề tài',
        content: `GVHD ${supervisor.full_name} đã đăng ký bạn vào đề tài "${result.id}". Bạn có thể tự tìm bạn cùng nhóm.`,
        related_id: result.id,
      },
    });

    return await prisma.topicRegistration.findUnique({
      where: { id: result.id },
      include: {
        topic: { include: { supervisor: { select: { id: true, full_name: true, email: true, avatar_url: true } } } },
        student: { select: { id: true, full_name: true, email: true, student_code: true } },
      },
    });
  }

  /**
   * Get students who registered for the same topic (for grouping)
   */
  async getStudentsSameTopic(userId: string, topicId: string) {
    // Verify user has registered for this topic
    const myRegistration = await prisma.topicRegistration.findFirst({
      where: {
        student_id: userId,
        topic_id: topicId,
        status: { notIn: [RegistrationStatus.REJECTED, RegistrationStatus.CANCELLED] },
      },
    });

    if (!myRegistration) {
      throw new Error('Bạn chưa đăng ký đề tài này');
    }

    // PRIVACY ENFORCEMENT: 
    // The user specifically requested that students should NOT see other students
    // who registered for the same topic. They must use MSSV search instead.
    if (userId && (await prisma.user.findUnique({ where: { id: userId } }))?.role === UserRole.STUDENT) {
      return []; // Students get an empty list
    }
    const allStudents = await prisma.topicRegistration.findMany({
      where: {
        topic_id: topicId,
        status: { in: [RegistrationStatus.CONFIRMED, RegistrationStatus.PENDING] },
      },
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
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        registered_at: 'asc',
      },
    });

    // Separate into available (no group) and in-group students
    const availableStudents = allStudents
      .filter((s) => !s.group_id && s.student_id !== userId)
      .map((s) => ({
        registrationId: s.id,
        studentId: s.student_id,
        fullName: s.student?.full_name,
        email: s.student?.email,
        studentCode: s.student?.student_code,
        registeredAt: s.registered_at,
        hasGroup: false,
        groupName: null,
      }));

    const allRegisteredStudents = allStudents.map((s) => ({
      registrationId: s.id,
      studentId: s.student_id,
      fullName: s.student?.full_name,
      email: s.student?.email,
      studentCode: s.student?.student_code,
      registeredAt: s.registered_at,
      hasGroup: !!s.group_id,
      groupName: s.group?.name || null,
      isMe: s.student_id === userId,
    }));

    return {
      myRegistration,
      availableStudents, // For group formation
      allRegisteredStudents, // For display
    };
  }

  /**
   * Create a group with another student in the same topic
   * Auto-locks when group is full (2 members)
   */
  async createGroupInTopic(userId: string, topicId: string, partnerId: string) {
    // ENFORCE INVITE-ONLY FOR STUDENTS: 
    // Students must use the Invitation system (sendGroupInvite -> acceptInvite).
    // This direct method is now restricted to non-students (e.g. Admin/HOD fixup).
    const caller = await prisma.user.findUnique({ where: { id: userId } });
    if (caller?.role === UserRole.STUDENT) {
      throw new Error('Bạn phải sử dụng hệ thống lời mời để lập nhóm (Tìm kiếm bằng MSSV).');
    }

    // Get my registration
    const myRegistration = await prisma.topicRegistration.findFirst({
      where: {
        student_id: userId,
        topic_id: topicId,
        status: { in: [RegistrationStatus.CONFIRMED, RegistrationStatus.PENDING] },
        group_id: null, // Must not have a group yet
      },
    });

    if (!myRegistration) {
      throw new Error('Bạn chưa đăng ký đề tài này hoặc đã có nhóm');
    }

    // Check academic policy
    const semester = await prisma.semester.findUnique({ where: { id: myRegistration.semester_id } });
    if (!semester) throw new Error('Semester not found');
    AcademicPolicy.enforce(AcademicAction.JOIN_GROUP, { id: userId, role: UserRole.STUDENT }, semester);

    // Get partner's registration
    const partnerRegistration = await prisma.topicRegistration.findFirst({
      where: {
        student_id: partnerId,
        topic_id: topicId,
        status: { in: [RegistrationStatus.CONFIRMED, RegistrationStatus.PENDING] },
        group_id: null, // Must not have a group yet
      },
    });

    if (!partnerRegistration) {
      throw new Error('Bạn cùng nhóm chưa đăng ký đề tài này hoặc đã có nhóm');
    }

    // Get topic for semester_id and max_students
    const topic = await prisma.topic.findUnique({
      where: { id: topicId },
    });

    if (!topic) {
      throw new Error(ERROR_CODES.TOPIC_NOT_FOUND);
    }

    // Get department config for group completion
    const dept = await prisma.department.findUnique({
      where: { id: topic.departmentId }
    });
    const maxGroupSize = dept?.max_group_size || 2;

    // Create group
    const groupName = await GroupUtils.generateGroupCode(topicId, topic.code || "UNKNOWN");
    const group = await prisma.group.create({
      data: {
        name: groupName,
        topic_id: topicId,
        leader_id: userId, // Creator becomes leader
        semester_id: topic.semester_id,
        status: maxGroupSize <= 2 ? 'COMPLETE' : 'FORMING', // Status based on size
      },
    });

    // Add both as group members
    await prisma.groupMember.createMany({
      data: [
        { group_id: group.id, user_id: userId, status: 'ACCEPTED' },
        { group_id: group.id, user_id: partnerId, status: 'ACCEPTED' },
      ],
    });

    // Update both registrations individually: assign group_id and change status
    await prisma.topicRegistration.update({
      where: { id: myRegistration.id },
      data: {
        group_id: group.id,
        status: RegistrationStatus.CONFIRMED,
        student_progress_status: StudentProgressStatus.HAS_TOPIC,
        confirmed_at: new Date(),
      },
    });

    await prisma.topicRegistration.update({
      where: { id: partnerRegistration.id },
      data: {
        group_id: group.id,
        status: RegistrationStatus.CONFIRMED,
        student_progress_status: StudentProgressStatus.HAS_TOPIC,
        confirmed_at: new Date(),
      },
    });

    // Update group status to LOCKED (no more changes allowed)
    await prisma.group.update({
      where: { id: group.id },
      data: { status: 'LOCKED' },
    });

    // NOTE: Do NOT increment current_students here!
    // Students are already counted when they register for the topic.
    // Creating a group just links existing registrations together.

    // If topic is full (current_students >= max_students), change status to REGISTERED
    const topic_current = await prisma.topic.findUnique({ where: { id: topicId } });
    if (topic_current && topic_current.current_students >= topic_current.max_students) {
      await prisma.topic.update({
        where: { id: topicId },
        data: {
          status: TopicStatus.REGISTERED,
          progress_stage: 'WORKING'
        },
      });
    }

    // Create audit log
    await prisma.auditLog.create({
      data: {
        user_id: userId,
        action: 'CREATE_GROUP_IN_TOPIC',
        entity_type: 'Group',
        entity_id: group.id,
        new_value: { groupId: group.id, topicId, members: [userId, partnerId] },
      },
    });

    return group;
  }

  /**
   * Get my topic registration for current semester
   */
  async getMyTopicRegistration(userId: string) {
    // Get the latest registration for this user (not just active semester)
    const registration = await prisma.topicRegistration.findFirst({
      where: {
        student_id: userId,
        status: { notIn: [RegistrationStatus.REJECTED, RegistrationStatus.CANCELLED] },
      },
      include: {
        topic: {
          include: {
            supervisor: {
              select: { id: true, full_name: true, email: true, avatar_url: true, phone: true },
            },
            semester: true,
            assignments: {
              where: {
                status: { notIn: ['DECLINED', 'AUTO_DECLINED'] }
              },
              include: {
                reviewer: {
                  select: { id: true, full_name: true, email: true, phone: true, avatar_url: true }
                }
              }
            },
            defense_schedules: {
              include: {
                committee: true
              }
            }
          },
        },
        group: {
          include: {
            members: {
              include: {
                user: {
                  select: {
                    id: true,
                    full_name: true,
                    email: true,
                    student_code: true,
                    avatar_url: true,
                    topic_registrations: {
                      select: {
                        id: true,
                        topic_id: true,
                        midterm_status: true,
                        midterm_feedback: true
                      }
                    }
                  },
                },
              },
            },
          },
        },
      },
      orderBy: {
        registered_at: 'desc', // Get most recent registration
      },
    });

    if (registration?.topic?.semester) {
      (registration.topic.semester as any).calculated_phase = SemesterGuard.calculateCurrentPhase(registration.topic.semester);
    }

    return registration;
  }

  /**
   * Cancel individual registration (only if no group yet)
   */
  async cancelIndividualRegistration(userId: string) {
    const registration = await prisma.topicRegistration.findFirst({
      where: {
        student_id: userId,
        status: { in: [RegistrationStatus.PENDING, RegistrationStatus.CONFIRMED] },
        group_id: null, // Only can cancel if no group
      },
      include: {
        topic: true,
      },
    });

    if (!registration) {
      throw new Error('Không tìm thấy đăng ký hoặc bạn đã có nhóm (không thể hủy)');
    }

    // Check academic policy
    const semester = await prisma.semester.findUnique({ where: { id: registration.semester_id } });
    if (!semester) throw new Error('Semester not found');
    AcademicPolicy.enforce(AcademicAction.CANCEL_REGISTRATION, { id: userId, role: UserRole.STUDENT }, semester);

    await prisma.topicRegistration.update({
      where: { id: registration.id },
      data: { status: RegistrationStatus.CANCELLED },
    });

    // Decrement topic's current_students count
    const topic = registration.topic;
    const newCount = Math.max(0, (topic.current_students || 0) - 1);
    console.log(`📊 Decrementing topic current_students: ${topic.current_students} → ${newCount}`);

    const updateData: any = {
      current_students: newCount,
    };

    // If topic was locked (REGISTERED) and now has available slots, reopen it
    if (topic.status === TopicStatus.REGISTERED && newCount < topic.max_students) {
      console.log(`🔓 Topic now has available slots, reopening to APPROVED`);
      updateData.status = TopicStatus.APPROVED;
    }

    await prisma.topic.update({
      where: { id: topic.id },
      data: updateData,
    });

    await prisma.auditLog.create({
      data: {
        user_id: userId,
        action: 'CANCEL_INDIVIDUAL_REGISTRATION',
        entity_type: 'TopicRegistration',
        entity_id: registration.id,
        old_value: registration,
      },
    });

    return { message: 'Đã hủy đăng ký đề tài' };
  }

  // =====================================================
  // SHARED METHODS (kept from old flow)
  // =====================================================

  async getRegistrations(userId: string, filters?: {
    status?: RegistrationStatus;
    semesterId?: string;
    topicId?: string;
  }) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new Error(ERROR_CODES.NOT_FOUND);
    }

    const where: any = {};

    // Apply filters
    if (filters?.status) {
      where.status = filters.status;
    }
    // [SEMESTER ISOLATION] semesterId được Controller resolve và truyền xuống.
    // Nếu vẫn chưa có (lời gọi từ nội bộ), fallback về ACTIVE.
    if (filters?.semesterId) {
      where.semester_id = filters.semesterId;
    } else {
      const activeSem = await semesterService.getActiveSemester();
      if (activeSem) {
        where.semester_id = activeSem.id;
      }
    }
    if (filters?.topicId) {
      where.topic_id = filters.topicId;
    }

    // Role-based filtering
    if (user.role === UserRole.STUDENT) {
      where.student_id = userId;
    } else if (user.role === UserRole.LECTURER || user.role === UserRole.COORDINATOR || user.role === UserRole.HEAD) {
      where.topic = {
        supervisor_id: userId,
      };
    }

    const registrations = await prisma.topicRegistration.findMany({
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
            semester: true,
          },
        },
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
            leader: {
              select: {
                id: true,
                full_name: true,
                email: true,
              },
            },
            members: {
              where: {
                status: 'ACCEPTED',
              },
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
        semester: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
      },
      orderBy: { registered_at: 'desc' },
    });

    // Bổ sung các đề tài đã duyệt (hoặc đang active) nhưng chưa có sinh viên đăng ký
    if (user.role === UserRole.LECTURER || user.role === UserRole.COORDINATOR || user.role === UserRole.HEAD) {
      const topicWhere: any = {
        supervisor_id: userId,
        status: { in: [TopicStatus.APPROVED, TopicStatus.REGISTERED, TopicStatus.COMPLETED, TopicStatus.FINALIZED] }
      };
      if (filters?.semesterId) {
        topicWhere.semester_id = filters.semesterId;
      } else {
        const activeSem = await semesterService.getActiveSemester();
        if (activeSem) {
          topicWhere.semester_id = activeSem.id;
        }
      }
      if (filters?.topicId) {
        topicWhere.id = filters.topicId;
      }

      const myTopics = await prisma.topic.findMany({
        where: topicWhere,
        include: {
          supervisor: {
            select: { id: true, full_name: true, email: true }
          },
          semester: true,
        }
      });

      const unassignedTopics = myTopics.filter(t => !registrations.some((r: any) => r.topic_id === t.id));
      for (const t of unassignedTopics) {
        registrations.push({
          id: `dummy-${t.id}`,
          topic_id: t.id,
          student_id: null,
          group_id: null,
          status: 'NO_REGISTRATION' as any,
          registered_at: t.created_at || new Date(),
          confirmed_at: null,
          rejection_reason: null,
          semester_id: t.semester_id,
          topic: t,
          student: null,
          group: null,
          semester: t.semester,
        } as any);
      }
    }

    // [PHASE ENFORCEMENT] Add calculated_phase to each semester for all roles
    registrations.forEach((reg: any) => {
      if (reg.topic?.semester) {
        reg.topic.semester.calculated_phase = SemesterGuard.calculateCurrentPhase(reg.topic.semester);
      }
      if (reg.semester) {
        reg.semester.calculated_phase = SemesterGuard.calculateCurrentPhase(reg.semester);
      }
    });

    return registrations;
  }

  async getRegistrationById(userId: string, registrationId: string) {
    const registration = await prisma.topicRegistration.findUnique({
      where: { id: registrationId },
      include: {
        topic: {
          include: {
            supervisor: {
              select: {
                id: true,
                full_name: true,
                email: true,
                phone: true,
              },
            },
            department: true,
            semester: true,
          },
        },
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
            leader: {
              select: {
                id: true,
                full_name: true,
                email: true,
                phone: true,
              },
            },
            members: {
              where: {
                status: 'ACCEPTED',
              },
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
    });

    if (!registration) {
      throw new Error('Registration not found');
    }

    if (registration.topic?.semester) {
      (registration.topic.semester as any).calculated_phase = SemesterGuard.calculateCurrentPhase(registration.topic.semester);
    }

    return registration;
  }

  async updateProgress(userId: string, registrationId: string, status: StudentProgressStatus, feedback?: string) {
    const registration = await prisma.topicRegistration.findUnique({
      where: { id: registrationId },
      include: {
        topic: true,
        group: {
          include: {
            members: {
              where: {
                status: 'ACCEPTED',
              },
            },
          },
        },
      },
    });

    if (!registration) {
      throw new Error('Registration not found');
    }

    // Check if user is the supervisor
    if (registration.topic.supervisor_id !== userId) {
      throw new Error(ERROR_CODES.FORBIDDEN);
    }

    // Update registration
    const updatedRegistration = await prisma.topicRegistration.update({
      where: { id: registrationId },
      data: {
        student_progress_status: status,
      },
    });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        user_id: userId,
        action: 'UPDATE_PROGRESS',
        entity_type: 'TopicRegistration',
        entity_id: registrationId,
        new_value: { status, feedback },
      },
    });

    // Send notification to group members
    if (feedback || status !== registration.student_progress_status) {
      const memberIds = registration.group?.members.map(m => m.user_id) || [registration.student_id];
      await notificationService.notifyBulkProgressUpdated(
        memberIds,
        registration.topic.title,
        status,
        feedback || undefined
      );
    }

    return updatedRegistration;

  }

  async getRegistrationLogs(userId: string, registrationId: string) {
    await this.getRegistrationById(userId, registrationId);

    const logs = await prisma.auditLog.findMany({
      where: {
        entity_type: 'TopicRegistration',
        entity_id: registrationId,
      },
      include: {
        user: {
          select: {
            id: true,
            full_name: true,
            avatar_url: true,
          },
        },
      },
      orderBy: {
        created_at: 'desc',
      },
    });

    return logs;
  }

  // =====================================================
  // GROUP INVITE SYSTEM
  // =====================================================

  /**
   * Search student by student_code for invite
   * Must be registered for the same topic and not in a group
   */
  async searchStudentForInvite(userId: string, topicId: string, studentCode: string) {
    // Get my registration first to verify I'm registered for the topic
    const myRegistration = await prisma.topicRegistration.findFirst({
      where: {
        student_id: userId,
        topic_id: topicId,
        status: { in: [RegistrationStatus.CONFIRMED, RegistrationStatus.PENDING] },
        group_id: null, // I must not have a group
      },
    });

    if (!myRegistration) {
      throw new Error('Bạn chưa đăng ký đề tài này hoặc đã có nhóm');
    }

    // Find student by code
    const student = await prisma.user.findUnique({
      where: { student_code: studentCode },
      select: {
        id: true,
        full_name: true,
        email: true,
        student_code: true,
        avatar_url: true,
      },
    });

    if (!student) {
      throw new Error('Không tìm thấy sinh viên với mã số này');
    }

    if (student.id === userId) {
      throw new Error('Bạn không thể mời chính mình');
    }

    // Check if student is registered for the same topic and no group
    const studentRegistration = await prisma.topicRegistration.findFirst({
      where: {
        student_id: student.id,
        topic_id: topicId,
        status: { in: [RegistrationStatus.CONFIRMED, RegistrationStatus.PENDING] },
        group_id: null,
      },
    });

    if (!studentRegistration) {
      throw new Error('Sinh viên này chưa đăng ký đề tài này hoặc đã có nhóm');
    }

    // MIDTERM INTEGRITY CHECK: inviter and invitee must have the same midterm status (Both PASS or Both NONE)
    // A FAIL student cannot invite or be invited.
    if (myRegistration.midterm_status === 'FAIL') {
      throw new Error('Bạn không thể gửi lời mời do đã không đạt điểm giữa kỳ.');
    }
    if (studentRegistration.midterm_status === 'FAIL') {
      throw new Error('Sinh viên này không đủ điều kiện tham gia nhóm do không đạt điểm giữa kỳ.');
    }

    return student;
  }

  /**
   * Send group invite to a student
   * Limit: 1 pending invite at a time
   * Cooldown: 24h after reject
   */
  async sendGroupInvite(userId: string, topicId: string, inviteeCode: string) {
    // Verify target student is valid
    const invitee = await this.searchStudentForInvite(userId, topicId, inviteeCode);

    // Check if I already have a pending invite
    const existingPendingInvite = await prisma.groupInvite.findFirst({
      where: {
        inviter_id: userId,
        topic_id: topicId,
        status: 'PENDING',
        expires_at: { gt: new Date() },
      },
    });

    if (existingPendingInvite) {
      throw new Error('Bạn đã có lời mời đang chờ. Hãy hủy lời mời cũ trước khi mời người khác.');
    }

    // Check cooldown after reject (24h)
    const recentReject = await prisma.groupInvite.findFirst({
      where: {
        inviter_id: userId,
        invitee_id: invitee.id,
        topic_id: topicId,
        status: 'REJECTED',
        responded_at: { gt: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      },
    });

    if (recentReject) {
      throw new Error('Bạn cần đợi 24 giờ sau khi bị từ chối để mời lại người này');
    }

    // Create invite with 24h expiry
    const invite = await prisma.groupInvite.create({
      data: {
        topic_id: topicId,
        inviter_id: userId,
        invitee_id: invitee.id,
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24h from now
      },
      include: {
        invitee: { select: { id: true, full_name: true, student_code: true, avatar_url: true } },
        topic: { select: { id: true, title: true, code: true } },
      },
    });

    // Get inviter and topic info for notification
    const [inviter, topic] = await Promise.all([
      prisma.user.findUnique({ where: { id: userId } }),
      prisma.topic.findUnique({ where: { id: topicId } }),
    ]);

    // Create notification for invitee
    await notificationService.notifyGroupInvitation(
      invitee.id,
      inviter?.full_name || 'Một sinh viên',
      topic?.title || 'Đề tài',
      invite.id
    );



    return invite;
  }

  /**
   * Get my pending invites (sent and received)
   */
  async getMyInvites(userId: string, topicId?: string) {
    const now = new Date();

    // Auto-expire old invites
    await prisma.groupInvite.updateMany({
      where: {
        status: 'PENDING',
        expires_at: { lt: now },
      },
      data: { status: 'EXPIRED' },
    });

    const baseWhere = topicId ? { topic_id: topicId } : {};

    // Invites I sent
    const sentInvites = await prisma.groupInvite.findMany({
      where: {
        ...baseWhere,
        inviter_id: userId,
        status: 'PENDING',
        expires_at: { gt: now },
      },
      include: {
        invitee: { select: { id: true, full_name: true, student_code: true, avatar_url: true } },
        topic: { select: { id: true, title: true, code: true } },
      },
      orderBy: { created_at: 'desc' },
    });

    // Invites I received
    const receivedInvites = await prisma.groupInvite.findMany({
      where: {
        ...baseWhere,
        invitee_id: userId,
        status: 'PENDING',
        expires_at: { gt: now },
      },
      include: {
        inviter: { select: { id: true, full_name: true, student_code: true, avatar_url: true } },
        topic: { select: { id: true, title: true, code: true } },
      },
      orderBy: { created_at: 'desc' },
    });

    return { sentInvites, receivedInvites };
  }

  /**
   * Accept an invite - creates the group
   */
  async acceptInvite(userId: string, inviteId: string) {
    const invite = await prisma.groupInvite.findUnique({
      where: { id: inviteId },
      include: { topic: true },
    });

    if (!invite) {
      throw new Error('Lời mời không tồn tại');
    }

    if (invite.invitee_id !== userId) {
      throw new Error('Bạn không phải người được mời');
    }

    if (invite.status !== 'PENDING') {
      throw new Error('Lời mời đã được xử lý');
    }

    if (invite.expires_at < new Date()) {
      await prisma.groupInvite.update({
        where: { id: inviteId },
        data: { status: 'EXPIRED' },
      });
      throw new Error('Lời mời đã hết hạn');
    }

    // Verify both students still have valid registrations
    const [myReg, inviterReg] = await Promise.all([
      prisma.topicRegistration.findFirst({
        where: { student_id: userId, topic_id: invite.topic_id, group_id: null },
      }),
      prisma.topicRegistration.findFirst({
        where: { student_id: invite.inviter_id, topic_id: invite.topic_id, group_id: null },
      }),
    ]);

    if (!myReg || !inviterReg) {
      throw new Error('Một trong hai sinh viên đã có nhóm hoặc đã hủy đăng ký');
    }

    // MIDTERM INTEGRITY CHECK: final check before group creation
    if (myReg.midterm_status === 'FAIL' || inviterReg.midterm_status === 'FAIL') {
      throw new Error('Không thể lập nhóm do một thành viên không đạt điểm giữa kỳ.');
    }

    // Create group
    const groupName = await GroupUtils.generateGroupCode(invite.topic_id, invite.topic.code || "UNKNOWN");
    const group = await prisma.group.create({
      data: {
        name: groupName,
        topic_id: invite.topic_id,
        leader_id: invite.inviter_id, // Inviter becomes leader
        semester_id: invite.topic.semester_id,
        status: 'LOCKED', // 2 members = locked
      },
    });

    // Add both as members
    await prisma.groupMember.createMany({
      data: [
        { group_id: group.id, user_id: invite.inviter_id, status: 'ACCEPTED' },
        { group_id: group.id, user_id: userId, status: 'ACCEPTED' },
      ],
    });

    // Update registrations
    await prisma.topicRegistration.updateMany({
      where: { id: { in: [myReg.id, inviterReg.id] } },
      data: {
        group_id: group.id,
        status: RegistrationStatus.CONFIRMED,
        student_progress_status: StudentProgressStatus.HAS_TOPIC,
        confirmed_at: new Date(),
      },
    });

    // Update invite status
    await prisma.groupInvite.update({
      where: { id: inviteId },
      data: { status: 'ACCEPTED', responded_at: new Date() },
    });

    // Cancel any other pending invites for both students on this topic
    await prisma.groupInvite.updateMany({
      where: {
        topic_id: invite.topic_id,
        status: 'PENDING',
        OR: [
          { inviter_id: { in: [userId, invite.inviter_id] } },
          { invitee_id: { in: [userId, invite.inviter_id] } },
        ],
      },
      data: { status: 'CANCELLED' },
    });

    // Notify inviter
    const invitee = await prisma.user.findUnique({ where: { id: userId } });
    await notificationService.notifyGroupInvitationResponse(
      invite.inviter_id,
      invitee?.full_name || 'Một sinh viên',
      true,
      invite.topic.title
    );


    return group;
  }

  /**
   * Reject an invite
   */
  async rejectInvite(userId: string, inviteId: string) {
    const invite = await prisma.groupInvite.findUnique({
      where: { id: inviteId },
    });

    if (!invite) {
      throw new Error('Lời mời không tồn tại');
    }

    if (invite.invitee_id !== userId) {
      throw new Error('Bạn không phải người được mời');
    }

    if (invite.status !== 'PENDING') {
      throw new Error('Lời mời đã được xử lý');
    }

    await prisma.groupInvite.update({
      where: { id: inviteId },
      data: { status: 'REJECTED', responded_at: new Date() },
    });

    // Notify inviter
    const invitee = await prisma.user.findUnique({ where: { id: userId } });
    await notificationService.notifyGroupInvitationResponse(
      invite.inviter_id,
      invitee?.full_name || 'Một sinh viên',
      false,
      '' // Topic title not needed for rejection
    );


    return { success: true };
  }

  /**
   * Cancel invite I sent
   */
  async cancelInvite(userId: string, inviteId: string) {
    const invite = await prisma.groupInvite.findUnique({
      where: { id: inviteId },
    });

    if (!invite) {
      throw new Error('Lời mời không tồn tại');
    }

    if (invite.inviter_id !== userId) {
      throw new Error('Bạn không phải người gửi lời mời');
    }

    if (invite.status !== 'PENDING') {
      throw new Error('Lời mời đã được xử lý');
    }

    await prisma.groupInvite.update({
      where: { id: inviteId },
      data: { status: 'CANCELLED' },
    });

    return { success: true };
  }

  /**
   * Disband group - any member can do this
   * Students go back to individual status, keep registration
   * CANNOT disband if any member has midterm grade
   */
  async disbandGroup(userId: string) {
    // Find my registration with group
    const myRegistration = await prisma.topicRegistration.findFirst({
      where: {
        student_id: userId,
        group_id: { not: null },
        status: RegistrationStatus.CONFIRMED,
      },
      include: { group: { include: { members: true } } },
    });

    if (!myRegistration || !myRegistration.group) {
      throw new Error('Bạn không thuộc nhóm nào');
    }

    const group = myRegistration.group;
    const memberIds = group.members.map(m => m.user_id);

    // 1. Phase Check - Cannot disband in WORK phase or later
    const semester = await prisma.semester.findUnique({ where: { id: myRegistration.semester_id } });
    if (semester) {
      const { SemesterGuard } = require('../utils/semester-guard');
      const currentPhase = SemesterGuard.calculateCurrentPhase(semester);
      const isLocked = !['PLANNING', 'PREVIEW', 'REGISTRATION'].includes(currentPhase);
      if (isLocked) {
        throw new Error('Không thể giải tán nhóm trong giai đoạn thực hiện khóa luận hoặc muộn hơn.');
      }
    }

    // 2. Check if any member has midterm grade
    const gradedRegistrations = await prisma.topicRegistration.findMany({
      where: {
        group_id: group.id,
        midterm_status: { not: null },
      },
      include: {
        student: { select: { full_name: true } },
      },
    });

    if (gradedRegistrations.length > 0) {
      throw new Error('Không thể giải tán nhóm vì đã có điểm đánh giá giữa kỳ. Vui lòng liên hệ GVHD nếu cần hỗ trợ.');
    }

    // 3. Reset all registrations: remove group_id and STAY CONFIRMED
    await prisma.topicRegistration.updateMany({
      where: {
        group_id: group.id,
      },
      data: {
        group_id: null,
        status: RegistrationStatus.CONFIRMED, // Keep as CONFIRMED for individual work
      },
    });

    // Update group members status to LEFT
    await prisma.groupMember.updateMany({
      where: { group_id: group.id },
      data: { status: 'LEFT', left_at: new Date() },
    });

    // Delete the group
    await prisma.group.delete({
      where: { id: group.id },
    });

    // Notify other members
    const otherMembers = memberIds.filter(id => id !== userId);
    if (otherMembers.length > 0) {
      await notificationService.createBulkNotifications(
        otherMembers,
        'GROUP_DISBANDED',
        'Nhóm đã bị giải tán',
        `Nhóm của bạn đã bị giải tán. Bạn vẫn đăng ký đề tài và có thể tìm bạn nhóm mới.`,
        group.topic_id || undefined
      );
    }

    return { success: true, message: 'Nhóm đã được giải tán. Bạn vẫn đăng ký đề tài.' };
  }
}

export default new RegistrationService();
