import prisma from '../config/database';
import { Prisma, TopicStatus, UserRole, SemesterPhase, AssignmentStatus, AssignmentType, InterdisciplinaryStatus, RegistrationStatus } from '@prisma/client';
import { canEditTopic } from '../utils/permission.utils';
import { SemesterGuard } from '../utils/semester-guard';
import { AcademicAction, AcademicPolicy } from '../utils/academic-policy';
import {
  CreateTopicRequest,
  UpdateTopicRequest,
  ApproveTopicRequest,
  RejectTopicRequest,
  RequireEditRequest,
  TopicFilter,
} from '../types';
import { ERROR_CODES, VALIDATION } from '../constants';
import notificationService from './notification.service';
import { AuditLogger } from '../utils/audit-logger';
import semesterService from './semester.service';
import { normalizeTitle } from '../utils/string';
import { ApiError } from '../utils/errors';
import { GroupUtils } from '../utils/group.utils';


type TopicDetailsPayload = Prisma.TopicGetPayload<{
  include: {
    supervisor: {
      select: {
        id: true,
        full_name: true,
        avatar_url: true,
      },
    },
    semester: true,
    department: true,
    co_supervisor: {
      select: {
        id: true,
        full_name: true,
        email: true,
      }
    },
    source_topic: {
      include: {
        semester: true
      }
    },
    registrations: {
      include: {
        student: {
          select: {
            id: true,
            full_name: true,
            email: true,
            avatar_url: true,
            student_code: true,
            class_name: true,
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
                    avatar_url: true,
                    student_code: true,
                    class_name: true,
                  },
                },
              },
            },
          },
        },
      },
    },
    defense_schedules: {
      include: {
        committee: {
          select: {
            id: true,
            name: true,
            type: true,
          },
        },
      },
    },
    final_scores: true,
    grades: true,
    assignments: true,
  }
}>;


export class TopicService {
  // Helper to check department access
  private async checkDepartmentAccess(userId: string, topic: any): Promise<void> {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new Error(ERROR_CODES.NOT_FOUND);
    }

    // LECTURER and HEAD can only access topics in their department
    if (user.role === UserRole.LECTURER || user.role === UserRole.HEAD) {
      if (topic.departmentId !== user.departmentId) {
        throw new Error('Bạn không có quyền truy cập đề tài của chuyên ngành khác');
      }
    }
  }

  /**
   * Generate unique topic code for a semester
   * Format: DT-{semester_code}-{sequence_number}
   * Example: DT-HK1-2025-001
   */
  private async generateTopicCode(semesterId: string, departmentId: string, tx?: any): Promise<string> {
    const client = tx || prisma;
    // Get semester and department info
    const [semester, department] = await Promise.all([
      client.semester.findUnique({ where: { id: semesterId } }),
      client.department.findUnique({ where: { id: departmentId } })
    ]);

    if (!semester || !department) {
      throw new Error('Semester or Department not found');
    }

    // Extract year and term from semester code (e.g., HK2_2023_2024)
    const semesterCodeParts = semester.code.split(/[-_]/);
    const term = semesterCodeParts[0] || 'HK';
    const year = semesterCodeParts[1] || new Date().getFullYear().toString();
    const deptCode = department.code;

    const prefix = deptCode;

    // Attempt to generate unique code with retry logic to handle race conditions
    let attempts = 0;
    // Find the topic with the highest sequence number for this department and semester
    const topics = await client.topic.findMany({
      where: {
        semester_id: semesterId,
        departmentId: departmentId,
        code: { startsWith: prefix }
      },
      select: { code: true }
    });

    let nextSeq = 1;
    if (topics.length > 0) {
      const sequences = topics.map((t: any) => {
        const seqStr = t.code.substring(prefix.length);
        const seq = parseInt(seqStr);
        return isNaN(seq) ? 0 : seq;
      });
      nextSeq = Math.max(...sequences) + 1;
    }

    // Pad with zeros (e.g., CNTT001) to ensure string sorting works better in the future
    const code = `${prefix}${nextSeq.toString().padStart(3, '0')}`;

    return code;
  }

  async createTopic(userId: string, data: CreateTopicRequest) {
    // Get user first to validate role
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new Error(ERROR_CODES.NOT_FOUND);
    }

    // Check academic policy
    const semester = await prisma.semester.findUnique({ where: { id: data.semesterId } });
    if (!semester) throw new Error('Semester not found');
    AcademicPolicy.enforce(AcademicAction.CREATE_TOPIC, user, semester);

    // Check department access - LECTURER can only create for their department
    if (user.role === UserRole.LECTURER && user.departmentId !== data.departmentId) {
      // Use user's own department for GVHD
    }

    // Validate title: 20-500 chars
    if (!data.title || data.title.length < VALIDATION.TOPIC.TITLE_MIN || data.title.length > VALIDATION.TOPIC.TITLE_MAX) {
      throw new Error(`Tên đề tài phải từ ${VALIDATION.TOPIC.TITLE_MIN} đến ${VALIDATION.TOPIC.TITLE_MAX} ký tự`);
    }

    // Validate description: min 100 chars
    if (!data.description || data.description.length < VALIDATION.TOPIC.DESCRIPTION_MIN) {
      throw new Error(`Mô tả chi tiết phải có ít nhất ${VALIDATION.TOPIC.DESCRIPTION_MIN} ký tự`);
    }

    // Validate objectives: min 50 chars
    if (!data.objectives || data.objectives.length < VALIDATION.TOPIC.OBJECTIVES_MIN) {
      throw new Error(`Mục tiêu phải có ít nhất ${VALIDATION.TOPIC.OBJECTIVES_MIN} ký tự`);
    }

    // Validate requirements: min 50 chars
    if (!data.requirements || data.requirements.length < VALIDATION.TOPIC.REQUIREMENTS_MIN) {
      throw new Error(`Yêu cầu phải có ít nhất ${VALIDATION.TOPIC.REQUIREMENTS_MIN} ký tự`);
    }

    // Process normalized title
    const normalizedTitle = normalizeTitle(data.title);

    // Check for duplicate title in the same semester and department
    const existingTopic = await prisma.topic.findFirst({
      where: {
        normalized_title: normalizedTitle,
        semester_id: data.semesterId,
        departmentId: user.departmentId,
        status: { not: TopicStatus.DRAFT }, // Only check against non-draft topics
      },
    });

    if (existingTopic) {
      throw new ApiError(400, 'DUPLICATE_TITLE', 'Tên đề tài đã tồn tại trong học kỳ này của bộ môn');
    }

    // Determine initial status based on user role and isDraft flag
    // GVHD creates:
    //   - isDraft=true → DRAFT (Lưu bản nháp)
    //   - isDraft=false → PENDING_APPROVAL (Chờ duyệt)
    // HEAD creates:
    //   - isDraft=true → DRAFT
    //   - isDraft=false → APPROVED (tự duyệt)
    let initialStatus: TopicStatus;
    if (user.role === UserRole.LECTURER) {
      if (data.isDraft) {
        initialStatus = TopicStatus.DRAFT; // Lưu bản nháp
      } else {
        initialStatus = TopicStatus.PENDING_APPROVAL; // Gửi chờ duyệt
      }
    } else if (user.role === UserRole.HEAD || user.role === UserRole.ADMIN) {
      if (data.isDraft) {
        initialStatus = TopicStatus.DRAFT;
      } else {
        initialStatus = TopicStatus.APPROVED; // HEAD tự duyệt
      }
    } else {
      throw new Error('Bạn không có quyền tạo đề tài');
    }

    // Use user's department
    const topicDepartmentId = user.departmentId;

    // Generate unique topic code for this semester
    const topicCode = await this.generateTopicCode(data.semesterId, topicDepartmentId);

    // Get department config
    const department = await prisma.department.findUnique({
      where: { id: topicDepartmentId }
    });

    // Create topic - Use provided maxStudents or fallback to department/system default
    const maxStudents = data.maxStudents || department?.max_group_size || 2;

    // Validate maxStudents is even if not a draft
    if (!data.isDraft && maxStudents % 2 !== 0) {
      throw new Error('Số lượng sinh viên tối đa phải là số chẵn (2, 4, 6,...)');
    }

    try {
      const topic = await prisma.topic.create({
        data: {
          code: topicCode,
          title: data.title,
          normalized_title: normalizedTitle,
          description: data.description,
          objectives: data.objectives,
          requirements: data.requirements,
          max_students: maxStudents,
          status: initialStatus,
          supervisor_id: userId,
          departmentId: topicDepartmentId,
          semester_id: data.semesterId,
          is_interdisciplinary: data.isInterdisciplinary || false,
          co_supervisor_id: data.coSupervisorId || null,
          secondary_department_id: data.secondaryDepartmentId || null,
          interdisciplinary_status: data.isInterdisciplinary ? 'PENDING' : null,
        },
      });



      // Create initial version
      await prisma.topicVersion.create({
        data: {
          topic_id: topic.id,
          version_number: 1,
          snapshot_data: topic,
          changed_by: userId,
          change_reason: 'Initial creation',
        },
      });

      // Create audit log
      await prisma.auditLog.create({
        data: {
          user_id: userId,
          action: 'CREATE',
          entity_type: 'Topic',
          entity_id: topic.id,
          new_value: {
            title: topic.title,
            status: topic.status,
            co_supervisor_id: topic.co_supervisor_id
          },
        },
      });

      if (initialStatus === TopicStatus.PENDING_APPROVAL) {
        await notificationService.notifyTopicSubmitted(topic.id, topic.title, user.full_name, topicDepartmentId);
      }

      return topic;
    } catch (error: any) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new Error('Tên đề tài đã tồn tại trong học kỳ này');
      }
      throw error;
    }
  }

  async updateTopic(userId: string, topicId: string, data: UpdateTopicRequest) {
    const topic = await prisma.topic.findUnique({
      where: { id: topicId },
      include: { registrations: true },
    });

    if (!topic) {
      throw new Error(ERROR_CODES.TOPIC_NOT_FOUND);
    }

    // Check department access
    await this.checkDepartmentAccess(userId, topic);

    // Check permissions
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new Error(ERROR_CODES.NOT_FOUND);
    }

    // Check academic policy
    const semester = await prisma.semester.findUnique({ where: { id: topic.semester_id } });
    AcademicPolicy.enforce(AcademicAction.UPDATE_TOPIC, user, semester);

    // Standard Permission Check
    if (!(await canEditTopic(user, topicId))) {
      throw new Error('Bạn không có quyền chỉnh sửa đề tài này ở trạng thái hiện tại');
    }

    const oldValue = { ...topic };

    // STRICT LOCKING: If topic has registrations, only allow editing description, objectives, requirements
    const hasRegistrations = topic.registrations.length > 0;
    if (hasRegistrations) {
      if (data.title || data.maxStudents) {
        throw new Error('Không thể sửa tên hoặc số lượng sinh viên khi đã có sinh viên đăng ký.');
      }
    }

    let statusUpdate: any = {};
    if (topic.status === TopicStatus.APPROVED) {
      statusUpdate.status = TopicStatus.PENDING_APPROVAL;
    }

    // Validate maxStudents is even
    if (data.maxStudents && data.maxStudents % 2 !== 0) {
      throw new Error('Số lượng sinh viên tối đa phải là số chẵn (2, 4, 6,...)');
    }

    // Process data to update
    const updateData: any = { ...data };

    // Handle camelCase mapping
    if (data.maxStudents) {
      updateData.max_students = data.maxStudents;
      delete updateData.maxStudents;
    }
    if (data.coSupervisorId !== undefined) {
      updateData.co_supervisor_id = data.coSupervisorId;
      delete updateData.coSupervisorId;
    }

    // Always force interdisciplinary to false if it somehow comes in
    updateData.is_interdisciplinary = false;
    updateData.interdisciplinary_status = null;
    updateData.secondary_department_id = null;

    delete updateData.isDraft;
    delete updateData.changeReason;

    if (data.title) {
      updateData.normalized_title = normalizeTitle(data.title);
    }

    // Apply updates
    try {
      const updatedTopic = await prisma.topic.update({
        where: { id: topicId },
        data: {
          ...updateData,
          ...statusUpdate
        },
      });

      // --- AUDIT LOGGING ---
      await AuditLogger.log({
        userId,
        action: 'UPDATE_TOPIC',
        entityType: 'Topic',
        entityId: topicId,
        oldValue: topic,
        newValue: updatedTopic,
        reason: data.changeReason || 'Cập nhật thông tin đề tài',
        description: `Người dùng ${userId} đã cập nhật đề tài "${topic.title}"`,
      });

      // Create new version if critical fields changed
      if (data.title || data.description || data.objectives || data.requirements) {
        const lastVersion = await prisma.topicVersion.findFirst({
          where: { topic_id: topicId },
          orderBy: { version_number: 'desc' },
        });

        await prisma.topicVersion.create({
          data: {
            topic_id: topicId,
            version_number: (lastVersion?.version_number || 0) + 1,
            snapshot_data: updatedTopic,
            changed_by: userId,
            change_reason: data.changeReason || 'Topic updated',
          },
        });
      }

      // Create audit log
      await prisma.auditLog.create({
        data: {
          user_id: userId,
          action: 'UPDATE',
          entity_type: 'Topic',
          entity_id: topicId,
          old_value: oldValue,
          new_value: updatedTopic,
        },
      });

      return updatedTopic;
    } catch (error: any) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new Error('Tên đề tài đã tồn tại trong học kỳ này');
      }
      throw error;
    }
  }

  async submitForApproval(userId: string, topicId: string) {
    const topic = await prisma.topic.findUnique({
      where: { id: topicId },
    });

    if (!topic) {
      throw new Error(ERROR_CODES.TOPIC_NOT_FOUND);
    }

    // Check department access
    await this.checkDepartmentAccess(userId, topic);

    if (topic.supervisor_id !== userId) {
      throw new Error(ERROR_CODES.FORBIDDEN);
    }

    if (!([TopicStatus.DRAFT, TopicStatus.REQUIRES_REVISION] as TopicStatus[]).includes(topic.status)) {
      throw new Error('Chỉ có thể cập nhật đề tài ở trạng thái nháp hoặc yêu cầu chỉnh sửa');
    }

    const updatedTopic = await prisma.topic.update({
      where: { id: topicId },
      data: {
        status: TopicStatus.PENDING_APPROVAL,
      },
    });

    // Create new version
    const latestVersion = await prisma.topicVersion.findFirst({
      where: { topic_id: topicId },
      orderBy: { version_number: 'desc' },
    });

    await prisma.topicVersion.create({
      data: {
        topic_id: topicId,
        version_number: (latestVersion?.version_number || 0) + 1,
        snapshot_data: updatedTopic,
        changed_by: userId,
        change_reason: 'Submitted for approval',
      },
    });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        user_id: userId,
        action: 'SUBMIT_FOR_APPROVAL',
        entity_type: 'Topic',
        entity_id: topicId,
        new_value: updatedTopic,
      },
    });

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (user) {
      await notificationService.notifyTopicSubmitted(topic.id, topic.title, user.full_name, topic.departmentId);
    }

    return updatedTopic;
  }

  async approveTopic(userId: string, topicId: string) {
    const topic = await prisma.topic.findUnique({
      where: { id: topicId },
    });

    if (!topic) {
      throw new Error(ERROR_CODES.TOPIC_NOT_FOUND);
    }

    // Phase Check
    const [semester, user] = await Promise.all([
      prisma.semester.findUnique({ where: { id: topic.semester_id } }),
      prisma.user.findUnique({ where: { id: userId } })
    ]);
    if (!user) throw new Error('User not found');
    AcademicPolicy.enforce(AcademicAction.APPROVE_TOPIC, { id: userId, role: user.role }, semester);

    // Check department access - HEAD can only approve topics in their department
    await this.checkDepartmentAccess(userId, topic);

    if (topic.status !== TopicStatus.PENDING_APPROVAL) {
      throw new Error(ERROR_CODES.INVALID_TOPIC_STATUS);
    }

    // REFINED APPROVAL FLOW: 
    // Transition directly to APPROVED (Interdisciplinary handled via flag)
    let nextStatus: TopicStatus = TopicStatus.APPROVED;

    const updatedTopic = await prisma.topic.update({
      where: { id: topicId },
      data: {
        status: nextStatus,
        approved_at: new Date(),
        approved_by: userId,
      },
    });

    // Create new version
    const latestVersion = await prisma.topicVersion.findFirst({
      where: { topic_id: topicId },
      orderBy: { version_number: 'desc' },
    });

    await prisma.topicVersion.create({
      data: {
        topic_id: topicId,
        version_number: (latestVersion?.version_number || 0) + 1,
        snapshot_data: updatedTopic,
        changed_by: userId,
        change_reason: 'Approved by HEAD',
      },
    });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        user_id: userId,
        action: 'APPROVE',
        entity_type: 'Topic',
        entity_id: topicId,
        new_value: updatedTopic,
      },
    });

    // Notify Supervisor
    await notificationService.notifyTopicApproved(topicId, topic.supervisor_id);

    return updatedTopic;

  }

  async rejectTopic(userId: string, data: RejectTopicRequest) {
    if (data.rejectionReason.length < VALIDATION.REASON.REJECTION_MIN) {
      throw new Error(`Rejection reason must be at least ${VALIDATION.REASON.REJECTION_MIN} characters`);
    }

    const topic = await prisma.topic.findUnique({
      where: { id: data.topicId },
    });

    if (!topic) {
      throw new Error(ERROR_CODES.TOPIC_NOT_FOUND);
    }

    // Phase Check
    const [semester, user] = await Promise.all([
      prisma.semester.findUnique({ where: { id: topic.semester_id } }),
      prisma.user.findUnique({ where: { id: userId } })
    ]);
    if (!user) throw new Error('User not found');
    AcademicPolicy.enforce(AcademicAction.APPROVE_TOPIC, { id: userId, role: user.role }, semester);

    // Check department access - HEAD can only reject topics in their department
    await this.checkDepartmentAccess(userId, topic);

    if (topic.status !== TopicStatus.PENDING_APPROVAL) {
      throw new Error(ERROR_CODES.INVALID_TOPIC_STATUS);
    }

    const updatedTopic = await prisma.topic.update({
      where: { id: data.topicId },
      data: {
        status: TopicStatus.REJECTED,
        rejection_reason: data.rejectionReason,
        approved_by: userId,
        approved_at: new Date(),
      },
    });

    // Create new version for history tracking
    const latestVersion = await prisma.topicVersion.findFirst({
      where: { topic_id: data.topicId },
      orderBy: { version_number: 'desc' },
    });

    await prisma.topicVersion.create({
      data: {
        topic_id: data.topicId,
        version_number: (latestVersion?.version_number || 0) + 1,
        snapshot_data: updatedTopic,
        changed_by: userId,
        change_reason: `Rejected by HEAD: ${data.rejectionReason}`,
      },
    });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        user_id: userId,
        action: 'REJECT',
        entity_type: 'Topic',
        entity_id: data.topicId,
        old_value: topic,
        new_value: updatedTopic,
      },
    });

    // Notify Supervisor
    await notificationService.notifyTopicRejected(data.topicId, topic.supervisor_id, data.rejectionReason);

    return updatedTopic;

  }

  async requestRevision(userId: string, data: RequireEditRequest) {
    if (data.editNotes.length < VALIDATION.REASON.EDIT_NOTES_MIN) {
      throw new Error(`Edit notes must be at least ${VALIDATION.REASON.EDIT_NOTES_MIN} characters`);
    }

    const topic = await prisma.topic.findUnique({
      where: { id: data.topicId },
    });

    if (!topic) {
      throw new Error(ERROR_CODES.TOPIC_NOT_FOUND);
    }

    // Check department access - HEAD can only require edit for topics in their department
    await this.checkDepartmentAccess(userId, topic);

    if (topic.status !== TopicStatus.PENDING_APPROVAL) {
      throw new Error(ERROR_CODES.INVALID_TOPIC_STATUS);
    }

    const updatedTopic = await prisma.topic.update({
      where: { id: data.topicId },
      data: {
        status: TopicStatus.REQUIRES_REVISION,
        edit_notes: data.editNotes,
      },
    });

    // Create new version for history tracking
    const latestVersion = await prisma.topicVersion.findFirst({
      where: { topic_id: data.topicId },
      orderBy: { version_number: 'desc' },
    });

    await prisma.topicVersion.create({
      data: {
        topic_id: data.topicId,
        version_number: (latestVersion?.version_number || 0) + 1,
        snapshot_data: updatedTopic,
        changed_by: userId,
        change_reason: `Requires revision by HEAD: ${data.editNotes}`,
      },
    });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        user_id: userId,
        action: 'REQUEST_REVISION',
        entity_type: 'Topic',
        entity_id: data.topicId,
        old_value: topic,
        new_value: updatedTopic,
      },
    });

    // Notify Supervisor
    await notificationService.notifyTopicRequireEdit(data.topicId, topic.supervisor_id, data.editNotes);

    return updatedTopic;

    return updatedTopic;
  }

  /**
   * Helper to create a new topic version snapshot
   */
  private async createVersion(topicId: string, userId: string, changeReason: string) {
    const topic = await prisma.topic.findUnique({
      where: { id: topicId },
      include: {
        supervisor: { select: { id: true, full_name: true } },
        co_supervisor: { select: { id: true, full_name: true } },
        department: { select: { id: true, name: true } },
        secondary_department: { select: { id: true, name: true } },
        semester: { select: { id: true, name: true } },
      }
    });

    if (!topic) return;

    const latestVersion = await prisma.topicVersion.findFirst({
      where: { topic_id: topicId },
      orderBy: { version_number: 'desc' },
    });

    return await prisma.topicVersion.create({
      data: {
        topic_id: topicId,
        version_number: (latestVersion?.version_number || 0) + 1,
        snapshot_data: topic as any,
        changed_by: userId,
        change_reason: changeReason,
      },
    });
  }

  async getTopics(userId: string, filter: TopicFilter) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new Error(ERROR_CODES.NOT_FOUND);
    }

    const page = filter.page || 1;
    const limit = filter.limit || 20;
    const skip = (page - 1) * limit;

    const where: any = {};
    const andConditions: any[] = [];

    // --- SEAMLESS SEMESTER ISOLATION ---
    // If no specific semester is requested and not includeAll, ALWAYS default to the ACTIVE one.
    if (!filter.semesterId && !filter.includeAll) {
      const activeSem = await semesterService.getActiveSemester();
      if (activeSem) {
        where.semester_id = activeSem.id;
      }
    } else if (filter.semesterId) {
      where.semester_id = filter.semesterId;
    }

    // Role-based filtering
    // DRAFT topics are only visible to their owner (GVHD who created them)
    // HIDDEN topics are only visible to their owner (GVHD who created them)
    if (user.role === UserRole.STUDENT) {
      // Tái sử dụng semester đã được set (không query DB lần 2)
      // Controller đã resolve semester_id, nên where.semester_id đã có giá trị
      if (where.semester_id) {
        const semester = await prisma.semester.findUnique({
          where: { id: where.semester_id },
          select: { topic_viewing_start: true, topic_viewing_end: true }
        });
        const now = new Date();
        if (semester?.topic_viewing_start && now < semester.topic_viewing_start) {
          return { topics: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 0 } };
        }
      }
      // Students see only APPROVED (fully signed off) topics
      andConditions.push({ status: TopicStatus.APPROVED });
      if (user.departmentId) {
        andConditions.push({
          OR: [
            { departmentId: user.departmentId }, // Their own department
            {
              AND: [ // Approved interdisciplinary topics from other departments
                { is_interdisciplinary: true },
                { secondary_department_id: user.departmentId },
                { interdisciplinary_status: 'APPROVED' }
              ]
            }
          ]
        });
      }
    } else if (user.role === UserRole.LECTURER) {
      // Find committee assignments
      const committeeAssignments = await prisma.assignment.findMany({
        where: { reviewer_id: userId, status: { in: [AssignmentStatus.ACCEPTED, AssignmentStatus.AUTO_ACCEPTED] } },
        select: { topic_id: true }
      });
      const committeeTopicIds = committeeAssignments.map(a => a.topic_id);

      // Relaxed logic: Show if (Owner) OR (In Department AND Committee Member)
      andConditions.push({
        OR: [
          { supervisor_id: userId },
          {
            AND: [
              { departmentId: user.departmentId },
              { id: { in: committeeTopicIds } }
            ]
          }
        ]
      });
    } else if (user.role === UserRole.HEAD) {
      // Relaxed logic: Show if (Owner) OR (In Department AND not private draft)
      andConditions.push({
        OR: [
          { supervisor_id: userId },
          {
            AND: [
              { departmentId: user.departmentId },
              { status: { notIn: [TopicStatus.DRAFT] } }
            ]
          }
        ]
      });
    } else if (user.role === UserRole.ADMIN) {
      // ADMIN sees all but DRAFT/HIDDEN logic is handled by visibility flag for others
      andConditions.push({
        OR: [
          { status: { notIn: [TopicStatus.DRAFT] } },
          { supervisor_id: userId },
        ]
      });
    }

    // Apply filters
    if (filter.status) {
      const statuses = Array.isArray(filter.status) ? filter.status : [filter.status];
      if (statuses.includes(TopicStatus.FINALIZED)) {
        andConditions.push({
          OR: [
            { status: { in: statuses } },
            { registrations: { some: { midterm_status: 'FAIL' } } }
          ]
        });
      } else {
        where.status = { in: statuses };
      }
    } else {
      // Default: Exclude REJECTED topics from all general lists 
      // unless specifically requested via filter.status
      andConditions.push({ status: { not: TopicStatus.REJECTED } });
    }

    // Role-based status constraints & logic
    if (user.role === UserRole.STUDENT) {
      const allowedStatuses: TopicStatus[] = [TopicStatus.APPROVED, TopicStatus.REGISTERED];

      // Mandatory visibility filter for students
      andConditions.push({ is_visible: true });

      // If student filters for a specific status, ensure it's allowed
      if (filter.status && allowedStatuses.includes(filter.status as TopicStatus)) {
        if (filter.status === TopicStatus.APPROVED) {
          where.status = { in: allowedStatuses };
        }
      } else {
        where.status = { in: allowedStatuses };
      }
    } else if (user.role === UserRole.LECTURER && userId !== filter.supervisorId) {
      // Lecturers only see visible topics of others
      andConditions.push({
        OR: [
          { supervisor_id: userId },
          { is_visible: true }
        ]
      });
    }
    if (filter.supervisorId) {
      where.supervisor_id = filter.supervisorId;
    }

    // [NOTE] Semester filter đã được set ở đầu hàm từ dữ liệu Controller đã resolve.
    // Không cần fetch lại ACTIVE semester ở đây (tránh duplicate query).
    if (filter.includeAll) {
      // Xóa semester filter để lấy tất cả - chỉ dùng cho Admin
      delete where.semester_id;
    }

    if (filter.search) {
      const searchTokens = filter.search.split(' ').filter(t => t.length > 0);
      const normalizedSearch = normalizeTitle(filter.search);

      if (searchTokens.length > 0) {
        // Phrase match conditions (higher precision)
        const phraseConditions = [
          { title: { contains: filter.search, mode: 'insensitive' as const } },
          { normalized_title: { contains: normalizedSearch, mode: 'insensitive' as const } },
        ];

        // Token match conditions (for partial words)
        const andSearchConditions = searchTokens.map(token => {
          const normalizedToken = normalizeTitle(token);
          return {
            OR: [
              { title: { contains: token, mode: 'insensitive' as const } },
              { normalized_title: { contains: normalizedToken, mode: 'insensitive' as const } },
              { code: { contains: token, mode: 'insensitive' as const } },
              { supervisor: { full_name: { contains: token, mode: 'insensitive' as const } } },
              { registrations: { some: { student: { full_name: { contains: token, mode: 'insensitive' as const } } } } },
              { registrations: { some: { student: { student_code: { contains: token, mode: 'insensitive' as const } } } } },
            ]
          };
        });
        andConditions.push({
          OR: [
            ...phraseConditions,
            { AND: andSearchConditions }
          ]
        });
      }
    }
    // Filter by midterm status - only return topics where at least one registration has this status
    if (filter.midtermStatus) {
      where.registrations = {
        some: {
          midterm_status: filter.midtermStatus,
        },
      };
    }

    if (filter.hasStudents) {
      where.current_students = { gt: 0 };
    }

    if (andConditions.length > 0) {
      where.AND = andConditions;
    }

    const [topics, total] = await Promise.all([
      prisma.topic.findMany({
        where,
        include: {
          supervisor: {
            select: {
              id: true,
              full_name: true,
              email: true,
              avatar_url: true,
            },
          },
          semester: true,
          department: true,
          secondary_department: true,
          co_supervisor: {
            select: {
              id: true,
              full_name: true,
              email: true,
            }
          },
          source_topic: {
            include: {
              semester: true
            }
          },
          registrations: {
            where: filter.midtermStatus
              ? { midterm_status: filter.midtermStatus }
              : undefined,
            include: {
              student: {
                select: {
                  id: true,
                  full_name: true,
                  email: true,
                  avatar_url: true,
                  student_code: true,
                  class_name: true,
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
                          avatar_url: true,
                          student_code: true,
                          class_name: true,
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          defense_schedules: {
            include: {
              committee: {
                select: {
                  id: true,
                  name: true,
                  type: true,
                },
              },
            },
          },
          final_scores: true,
          grades: {
            where: { grader_id: userId }
          },
          assignments: true,
          groups: {
            select: { id: true, name: true, members: { include: { user: true } } }
          },
        } as any,
        skip,
        take: limit,
        orderBy: { code: 'asc' },
      }) as any,
      prisma.topic.count({ where }),
    ]);

    // Flatten topics into groups for LECTURER/HEAD/ADMIN roles
    const finalProcessedTopics: any[] = [];

    for (const topic of topics as any[]) {
      if (user.role === UserRole.STUDENT) {
        // Students only see the count, not the actual registrations
        const { registrations, final_scores, assignments, groups, ...cleanTopic } = topic;
        finalProcessedTopics.push({
          ...cleanTopic,
          topicId: topic.id,
          registrations: [],
          registrationCount: (registrations || []).length,
        });
        continue;
      }

      // For other roles, split by groups
      const room = topic.assignments?.[0]?.room || null;
      const committee = topic.defense_schedules?.[0]?.committee || null;

      // Check if registration period is over using AcademicPolicy
      const currentPhase = topic.semester ? AcademicPolicy.getPhase(topic.semester) : null;
      const isRegistrationOver = currentPhase && !['PLANNING', 'PREVIEW', 'REGISTRATION'].includes(currentPhase);

      if (topic.groups && topic.groups.length > 0) {
        for (const group of topic.groups) {
          const groupStudents = (topic.registrations as any[])
            ?.filter((reg: any) => reg.group_id === group.id)
            .map((reg: any) => {
              const student = reg.student;
              const finalScore = topic.final_scores?.find((fs: any) => fs.student_id === student.id);
              return {
                ...student,
                finalScore,
                midtermStatus: reg.midterm_status,
                midtermFeedback: reg.midterm_feedback,
                registrationStatus: reg.status
              };
            }) || [];

          const { registrations, groups: topicGroups, ...cleanTopic } = topic;
          finalProcessedTopics.push({
            ...cleanTopic,
            id: group.id,
            topicId: topic.id,
            code: group.name, // Keep for compatibility
            groupName: group.name, // Explicitly add groupName
            students: groupStudents,
            current_students: group.members.length,
            max_students: (isRegistrationOver && group.members.length === 1) ? 1 : 2,
            room,
            committee,
            defense_schedule: topic.defense_schedules?.[0] || null,
          });
        }

        // Handle students without group (if any)
        const individualStudents = (topic.registrations as any[])
          ?.filter((reg: any) => !reg.group_id)
          .map((reg: any) => {
            const student = reg.student;
            const finalScore = topic.final_scores?.find((fs: any) => fs.student_id === student.id);
            return {
              ...student,
              finalScore,
              midtermStatus: reg.midterm_status,
              midtermFeedback: reg.midterm_feedback,
              registrationStatus: reg.status
            };
          }) || [];

        const { registrations, groups: topicGroups, ...cleanTopic } = topic;
        if (individualStudents.length > 0) {
          finalProcessedTopics.push({
            ...cleanTopic,
            id: `${topic.id}-individual`,
            topicId: topic.id,
            students: individualStudents,
            current_students: individualStudents.length,
            max_students: 1, // Cá nhân thì sĩ số tối đa là 1
            room,
            committee,
            defense_schedule: topic.defense_schedules?.[0] || null,
          });
        }
      } else {
        // No groups yet, show the topic as is
        const students = (topic.registrations as any[])?.map((reg: any) => ({
          ...reg.student,
          finalScore: topic.final_scores?.find((fs: any) => fs.student_id === reg.student.id),
          midtermStatus: reg.midterm_status,
          midtermFeedback: reg.midterm_feedback,
          registrationStatus: reg.status
        })) || [];

        finalProcessedTopics.push({
          ...topic,
          topicId: topic.id,
          students,
          room,
          committee,
          defense_schedule: topic.defense_schedules?.[0] || null,
        });
      }
    }

    return {
      topics: finalProcessedTopics,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getTopicById(userId: string, id: string, queryGroupId?: string) {
    let topicId = id;
    let resolvedGroupId = queryGroupId;

    // [RESOLUTION STRATEGY] Try to resolve the actual Topic ID from various possible input IDs
    // 1. Check if it's a Group ID
    const group = await prisma.group.findUnique({
      where: { id },
      select: { id: true, topic_id: true }
    });

    if (group && group.topic_id) {
      topicId = group.topic_id;
      resolvedGroupId = group.id;
    } else {
      // 2. Check if it's an Assignment ID (Reviewer/Committee context)
      const assignment = await prisma.assignment.findUnique({
        where: { id },
        select: { topic_id: true, group_id: true }
      });

      if (assignment && assignment.topic_id) {
        topicId = assignment.topic_id;
        resolvedGroupId = assignment.group_id || undefined;
      }
    }

    const topic = await prisma.topic.findUnique({
      where: { id: topicId },
      include: {
        supervisor: {
          select: {
            id: true,
            full_name: true,
            email: true,
            avatar_url: true,
          },
        },
        semester: true,
        department: true,
        secondary_department: true,
        co_supervisor: {
          select: {
            id: true,
            full_name: true,
            email: true,
          }
        },
        source_topic: {
          include: {
            semester: true
          }
        },
        registrations: {
          include: {
            student: {
              select: {
                id: true,
                full_name: true,
                email: true,
                avatar_url: true,
                student_code: true,
                class_name: true,
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
                        avatar_url: true,
                        student_code: true,
                        class_name: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
        assignments: true,
        groups: {
          select: { id: true, name: true }
        },
        defense_schedules: {
          include: {
            committee: {
              select: {
                id: true,
                name: true,
                type: true,
              },
            },
          },
        },
        final_scores: true,
        grades: {
          where: { grader_id: userId }
        },
      } as any,
    }) as unknown as TopicDetailsPayload | null;

    if (!topic) {
      throw new Error(ERROR_CODES.TOPIC_NOT_FOUND);
    }

    // Check department access for LECTURER and HEAD
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (user && (user.role === UserRole.LECTURER || user.role === UserRole.HEAD)) {
      if (topic.departmentId !== user.departmentId) {
        throw new Error('Bạn không có quyền xem đề tài của chuyên ngành khác');
      }
    }

    // Hide registrations from students - they can only see their own registration
    if (user && user.role === UserRole.STUDENT) {
      // Filter to only show their own registration (if they have one)
      const myRegistration = topic.registrations.filter(r => r.student_id === userId);

      // Mask other sensitive relations for students
      const { registrations, final_scores, assignments, ...cleanTopic } = topic;

      return {
        ...cleanTopic,
        code: GroupUtils.formatGroupDisplay((topic as any).groups, topic.code || ""),
        registrations: myRegistration, // Only show their own registration
        registrationCount: (registrations || []).length, // But show total count
      };
    }

    // LECTURER, HEAD, ADMIN can see all registrations
    // [LOGIC ENHANCEMENT] If we resolved this topic via a groupId, we should prioritize that group's info
    let displayCode = GroupUtils.formatGroupDisplay((topic as any).groups, topic.code || "");
    let filteredStudents = topic.registrations?.map(reg => {
      const student = reg.student;
      const finalScore = topic.final_scores?.find(fs => fs.student_id === (student as any).id);
      return {
        ...student,
        groupId: reg.group_id,
        groupCode: (reg as any).group?.name,
        finalScore,
        midtermStatus: reg.midterm_status,
        midtermFeedback: reg.midterm_feedback,
        registrationStatus: reg.status
      };
    }) || [];

    // If we have a resolved groupId (either from path or query)
    if (resolvedGroupId) {
      const selectedGroup = (topic as any).groups?.find((g: any) => g.id === resolvedGroupId);
      if (selectedGroup) {
        displayCode = selectedGroup.name;
        filteredStudents = filteredStudents.filter(s => s.groupId === resolvedGroupId);
      }
    }

    const room = topic.assignments[0]?.room || null;

    return {
      ...topic,
      code: displayCode,
      committee: (topic as any).defense_schedules?.[0]?.committee || null,
      defense_schedule: (topic as any).defense_schedules?.[0] || null,
      registrations: topic.registrations || [],
      students: filteredStudents,
      room,
    };
  }

  async deleteTopic(userId: string, topicId: string) {
    const topic = await prisma.topic.findUnique({
      where: { id: topicId },
      include: { registrations: true, assignments: true },
    });

    if (!topic) {
      throw new Error(ERROR_CODES.TOPIC_NOT_FOUND);
    }

    // Check department access
    await this.checkDepartmentAccess(userId, topic);

    // Check if user has permission
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new Error(ERROR_CODES.NOT_FOUND);
    }

    // Phase Check
    const semester = await prisma.semester.findUnique({ where: { id: topic.semester_id } });
    AcademicPolicy.enforce(AcademicAction.DELETE_TOPIC, user as any, semester);

    if (topic.supervisor_id !== userId && user.role !== UserRole.HEAD) {
      throw new Error(ERROR_CODES.FORBIDDEN);
    }

    // Check if topic can be deleted
    if (!([TopicStatus.DRAFT, TopicStatus.REJECTED, TopicStatus.REQUIRES_REVISION] as TopicStatus[]).includes(topic.status)) {
      throw new Error('Cannot delete topic in current status');
    }

    if (topic.registrations.length > 0) {
      throw new Error('Cannot delete topic with registrations');
    }

    if (topic.assignments.length > 0) {
      throw new Error('Cannot delete topic with assignments');
    }

    await prisma.topic.delete({
      where: { id: topicId },
    });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        user_id: userId,
        action: 'DELETE',
        entity_type: 'Topic',
        entity_id: topicId,
        old_value: topic,
      },
    });

    return { message: 'Topic deleted successfully' };
  }

  /**
   * Get topic approval history (versions + audit logs)
   */
  async getTopicApprovalHistory(userId: string, topicId: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new Error(ERROR_CODES.NOT_FOUND);
    }

    const topic = await prisma.topic.findUnique({
      where: { id: topicId },
      include: { supervisor: { select: { id: true, full_name: true } } },
    });

    if (!topic) {
      throw new Error(ERROR_CODES.TOPIC_NOT_FOUND);
    }

    // Check access - HEAD/ADMIN can view all, LECTURER can view their own
    if (user.role === UserRole.LECTURER && topic.supervisor_id !== userId) {
      throw new Error('Bạn không có quyền xem lịch sử đề tài này');
    }

    // Get topic versions
    const versions = await prisma.topicVersion.findMany({
      where: { topic_id: topicId },
      orderBy: { created_at: 'desc' },
    });

    // Get audit logs for this topic
    const auditLogs = await prisma.auditLog.findMany({
      where: {
        entity_type: 'Topic',
        entity_id: topicId,
      },
      include: {
        user: {
          select: {
            id: true,
            full_name: true,
            role: true,
          },
        },
      },
      orderBy: { created_at: 'desc' },
    });

    // Combine and format the history
    const history = auditLogs.map((log) => ({
      id: log.id,
      action: log.action,
      performedBy: log.user?.full_name || 'Hệ thống',
      performedByRole: log.user?.role || 'SYSTEM',
      timestamp: log.created_at,
      oldValue: log.old_value,
      newValue: log.new_value,
      // Extract status change
      statusChange: {
        from: (log.old_value as { status?: string })?.status || null,
        to: (log.new_value as { status?: string })?.status || null,
      },
      reason: (log.new_value as { rejection_reason?: string })?.rejection_reason || '',
    }));

    return {
      topic: {
        id: topic.id,
        code: topic.code,
        title: topic.title,
        currentStatus: topic.status,
        supervisor: topic.supervisor,
      },
      versions,
      history,
      totalEvents: history.length,
    };
  }

  /**
   * Hide a topic (supervisor only, for old or overused topics)
   */
  async hideTopic(userId: string, topicId: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new Error(ERROR_CODES.NOT_FOUND);
    }

    const topic = await prisma.topic.findUnique({
      where: { id: topicId },
    });

    if (!topic) {
      throw new Error(ERROR_CODES.TOPIC_NOT_FOUND);
    }

    // Only the supervisor who created the topic can hide it
    if (topic.supervisor_id !== userId && user.role !== UserRole.ADMIN && user.role !== UserRole.HEAD) {
      throw new Error('Bạn không có quyền ẩn đề tài này');
    }

    // Cannot hide topics that are already registered or completed
    if (topic.status === TopicStatus.REGISTERED || topic.status === TopicStatus.COMPLETED || topic.status === TopicStatus.FINALIZED) {
      throw new Error('Không thể ẩn đề tài đang được thực hiện hoặc đã hoàn thành');
    }

    const updatedTopic = await prisma.topic.update({
      where: { id: topicId },
      data: {
        is_visible: false,
      },
    });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        user_id: userId,
        action: 'HIDE_TOPIC',
        entity_type: 'Topic',
        entity_id: topicId,
        old_value: { is_visible: true },
        new_value: { is_visible: false },
      },
    });

    return updatedTopic;
  }

  /**
   * Unhide a topic (restore to previous status)
   */
  async unhideTopic(userId: string, topicId: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new Error(ERROR_CODES.NOT_FOUND);
    }

    const topic = await prisma.topic.findUnique({
      where: { id: topicId },
    });

    if (!topic) {
      throw new Error(ERROR_CODES.TOPIC_NOT_FOUND);
    }

    // Only the supervisor who created the topic can unhide it
    if (topic.supervisor_id !== userId && user.role !== UserRole.ADMIN && user.role !== UserRole.HEAD) {
      throw new Error('Bạn không có quyền hiện đề tài này');
    }

    if (topic.is_visible) {
      throw new Error('Đề tài này không bị ẩn');
    }

    const updatedTopic = await prisma.topic.update({
      where: { id: topicId },
      data: {
        is_visible: true,
      },
    });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        user_id: userId,
        action: 'UNHIDE_TOPIC',
        entity_type: 'Topic',
        entity_id: topicId,
        old_value: { is_visible: false },
        new_value: { is_visible: true },
      },
    });

    return updatedTopic;
  }

  async getTopicStats(userId: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new Error(ERROR_CODES.NOT_FOUND);
    }

    // Role-based filtering logic
    const baseWhere: any = {};

    if (user.role === UserRole.HEAD) {
      baseWhere.departmentId = user.departmentId;
      // Head doesn't see DRAFT topics of others
      baseWhere.status = { notIn: [TopicStatus.DRAFT] };
      baseWhere.is_visible = true;
    } else if (user.role === UserRole.ADMIN) {
      // Admin sees everything except personal drafts (simplified)
      baseWhere.status = { notIn: [TopicStatus.DRAFT] };
      baseWhere.is_visible = true;
    } else {
      // LECTURER stats only for their own topics
      baseWhere.supervisor_id = userId;
    }

    // Get current active semester to focus stats
    const activeSemester = await semesterService.getActiveSemester();

    if (activeSemester) {
      baseWhere.semester_id = activeSemester.id;
    }

    const statuses = [
      TopicStatus.DRAFT,
      TopicStatus.PENDING_APPROVAL,
      TopicStatus.REQUIRES_REVISION,
      TopicStatus.APPROVED,
      TopicStatus.REJECTED,
      TopicStatus.REGISTERED,
      TopicStatus.COMPLETED,
      TopicStatus.FINALIZED
    ];

    const stats: Record<string, number> = {};

    // Use Promise.all to count all statuses in parallel
    await Promise.all(statuses.map(async (status) => {
      let currentWhere: any = {
        ...baseWhere,
        status: status
      };

      // Ensure HEAD/ADMIN only count their own drafts
      if (status === TopicStatus.DRAFT && user.role !== UserRole.LECTURER) {
        currentWhere.supervisor_id = userId;
      }

      const count = await prisma.topic.count({
        where: currentWhere
      });
      stats[status] = count;
    }));

    return stats;
  }

  /**
   * Respond to interdisciplinary co-supervisor invitation
   */
  async respondToInterdisciplinaryInvite(userId: string, topicId: string, status: 'APPROVED' | 'REJECTED') {
    const topic = await prisma.topic.findUnique({
      where: { id: topicId }
    });

    if (!topic) {
      throw new Error(ERROR_CODES.TOPIC_NOT_FOUND);
    }

    if (topic.co_supervisor_id !== userId) {
      throw new Error('Bạn không phải đồng hướng dẫn của đề tài này');
    }

    if (topic.interdisciplinary_status !== 'PENDING') {
      throw new Error('Yêu cầu đã được xử lý hoặc không còn hiệu lực');
    }

    // FALLBACK LOGIC: If REJECTED, the topic reverts to APPROVED (for primary department only)
    // and is_interdisciplinary flag is cleared.
    const isActuallyApproved = status === 'APPROVED';
    const nextInterStatus = status as InterdisciplinaryStatus;

    let nextTopicStatus = topic.status;
    let nextIsInter = topic.is_interdisciplinary;

    // Simplified check
    if (topic.is_interdisciplinary && topic.interdisciplinary_status === 'PENDING') {
      if (isActuallyApproved) {
        nextTopicStatus = TopicStatus.APPROVED;
      } else {
        // REJECTED by co-supervisor: 
        // Revert to a standard topic for the primary department since HOD already approved it.
        nextTopicStatus = TopicStatus.APPROVED;
        nextIsInter = false;
      }
    }

    const updatedTopic = await prisma.topic.update({
      where: { id: topicId },
      data: {
        interdisciplinary_status: nextInterStatus,
        status: nextTopicStatus as any,
        is_interdisciplinary: nextIsInter
      }
    });

    // Create Audit Log
    await prisma.auditLog.create({
      data: {
        user_id: userId,
        action: status === 'APPROVED' ? 'APPROVE_INTERDISCIPLINARY' : 'REJECT_INTERDISCIPLINARY',
        entity_type: 'Topic',
        entity_id: topic.id,
        old_value: { status: topic.interdisciplinary_status },
        new_value: { status: updatedTopic.interdisciplinary_status }
      }
    });

    // Create New Version
    await this.createVersion(topic.id, userId, `Co-supervisor ${status} interdisciplinary invite`);

    // Notify primary supervisor
    await notificationService.createNotification(
      topic.supervisor_id,
      'INFO',
      `Phản hồi lời mời đồng hướng dẫn`,
      `Giảng viên đồng hướng dẫn đã ${status === 'APPROVED' ? 'CHẤP NHẬN' : 'TỪ CHỐI'} lời mời cho đề tài "${topic.title}".`,
      topic.id
    );

    return updatedTopic;
  }

  /**
   * Clone an existing topic into a new active semester.
   * Only the supervisor of the original topic can clone it.
   */
  async cloneTopic(userId: string, topicId: string, newSemesterId: string) {
    const oldTopic = await prisma.topic.findUnique({
      where: { id: topicId },
      include: { semester: true }
    });

    if (!oldTopic) {
      throw new ApiError(404, 'NOT_FOUND', 'Đề tài không tồn tại');
    }

    // 1. Security Check: Only supervisor can clone their own topic
    if (oldTopic.supervisor_id !== userId) {
      throw new ApiError(403, 'FORBIDDEN', 'Bạn không có quyền sao chép đề tài của giảng viên khác');
    }

    // 2. Semester Status Guard: Must clone into an ACTIVE semester
    const targetSemester = await prisma.semester.findUnique({
      where: { id: newSemesterId }
    });

    if (!targetSemester || targetSemester.status !== 'ACTIVE') {
      throw new ApiError(400, 'INVALID_SEMESTER', 'Chỉ có thể sao chép đề tài vào học kỳ đang ở trạng thái Hoạt động (ACTIVE)');
    }

    // 3. Prevention: Cannot clone within same semester
    if (oldTopic.semester_id === newSemesterId) {
      throw new ApiError(400, 'SAME_SEMESTER', 'Đề tài này đã tồn tại trong học kỳ hiện tại');
    }

    // 4. Transaction for atomicity
    return await prisma.$transaction(async (tx) => {
      // Generate new topic code for target semester
      const newCode = await this.generateTopicCode(newSemesterId, oldTopic.departmentId, tx);

      const newTopic = await tx.topic.create({
        data: {
          code: newCode,
          title: oldTopic.title,
          normalized_title: oldTopic.normalized_title,
          description: oldTopic.description,
          objectives: oldTopic.objectives,
          requirements: oldTopic.requirements,
          max_students: oldTopic.max_students,
          status: TopicStatus.DRAFT, // Cloned topics always start as DRAFT
          departmentId: oldTopic.departmentId,
          semester_id: newSemesterId,
          supervisor_id: userId,
          source_topic_id: oldTopic.id,
          is_interdisciplinary: oldTopic.is_interdisciplinary,
          co_supervisor_id: oldTopic.co_supervisor_id,
          secondary_department_id: oldTopic.secondary_department_id,
        }
      });

      // Create initial version for history tracking
      await tx.topicVersion.create({
        data: {
          topic_id: newTopic.id,
          version_number: 1,
          snapshot_data: newTopic as any,
          changed_by: userId,
          change_reason: `Được sao chép từ đề tài ${oldTopic.code} (Học kỳ: ${oldTopic.semester.name})`,
        }
      });

      // Create audit log
      await tx.auditLog.create({
        data: {
          user_id: userId,
          action: 'CLONE',
          entity_type: 'Topic',
          entity_id: newTopic.id,
          new_value: {
            source_topic_id: oldTopic.id,
            semester_id: newSemesterId
          },
        },
      });

      return newTopic;
    });
  }
  /**
   * Finalize the defense eligibility and type (HOD only)
   * This is the "Pivot" point after Supervisor and Reviewers have graded.
   */
  async finalizeDefensePivot(userId: string, topicId: string, data: { isEligible: boolean; defenseType?: any }) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.role !== UserRole.HEAD) {
      throw new ApiError(403, ERROR_CODES.FORBIDDEN, 'Chỉ Trưởng bộ môn mới có quyền thực hiện rà soát và quyết định hình thức bảo vệ.');
    }

    return await prisma.$transaction(async (tx) => {
      const topic = await tx.topic.findUnique({
        where: { id: topicId },
        include: {
          assignments: { where: { assignment_type: 'REVIEWER' } },
          grades: true,
          final_scores: true,
          semester: true,
          registrations: true,
        },
      });

      if (!topic) throw new ApiError(404, ERROR_CODES.TOPIC_NOT_FOUND, 'Không tìm thấy đề tài yêu cầu.');

      // Lock check: once decided, cannot change easily without reset
      if (topic.is_eligible_for_defense !== null) {
        throw new ApiError(400, ERROR_CODES.VALIDATION_ERROR, 'Quyết định xét bảo vệ của đề tài này đã được chốt trước đó.');
      }

      // Phase check via AcademicPolicy
      AcademicPolicy.enforce(AcademicAction.ASSIGN_DEFENSE_PIVOT, user, topic.semester, { topic });

      // Dependency check: Supervisor must have graded
      const hasSupervisor = topic.grades.some((g) => g.rater_role === 'SUPERVISOR');
      if (!hasSupervisor) {
        throw new ApiError(400, ERROR_CODES.VALIDATION_ERROR, 'GVHD chưa chấm điểm, không thể chốt kết quả xét bảo vệ.');
      }

      // Dependency check: All assigned reviewers must have graded
      const totalReviewersRequired = topic.reviewer_required_count || topic.assignments.length;
      const gradedReviewerIds = [...new Set(topic.grades.filter((g) => g.rater_role.startsWith('REVIEWER')).map((g) => g.grader_id))];

      if (gradedReviewerIds.length < totalReviewersRequired) {
        throw new ApiError(400, ERROR_CODES.VALIDATION_ERROR, `Chưa đủ điểm phản biện (${gradedReviewerIds.length}/${totalReviewersRequired}). Vui lòng đợi giảng viên phản biện chấm xong.`);
      }

      // Update topic
      const updatedTopic = await tx.topic.update({
        where: { id: topicId },
        data: {
          is_eligible_for_defense: data.isEligible,
          defense_type: data.isEligible ? (data.defenseType || 'ORAL') : null,
          progress_stage: data.isEligible ? 'READY_FOR_DEFENSE' : 'DONE', // If fail, move to DONE/COMPLETED
          status: data.isEligible ? TopicStatus.REGISTERED : TopicStatus.COMPLETED,
        },
      });

      // Audit log
      await tx.auditLog.create({
        data: {
          user_id: userId,
          action: 'FINALIZE_DEFENSE_PIVOT',
          entity_type: 'Topic',
          entity_id: topicId,
          new_value: { is_eligible: data.isEligible, defense_type: data.defenseType },
        },
      });

      return updatedTopic;
    });
  }
}

export default new TopicService();
