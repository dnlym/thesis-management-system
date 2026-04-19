import prisma from '../config/database';
import dayjs from 'dayjs';
import {
  CommitteeRole,
  ScheduleStatus,
  AssignmentType,
  AssignmentStatus,
  TopicStatus
} from '@prisma/client';
import {
  CreateCommitteeRequest,
  UpdateCommitteeRequest,
  AssignTopicToCommitteeRequest,
  CommitteeScheduleResponse
} from '../types';
import { ERROR_CODES } from '../constants';
import notificationService from './notification.service';

function combineDateAndTime(date: string, time: string): Date {
  const dt = dayjs(`${date} ${time}`, 'YYYY-MM-DD HH:mm');
  if (!dt.isValid()) {
    throw new Error('Định dạng ngày/giờ không hợp lệ. Vui lòng sử dụng YYYY-MM-DD và HH:mm');
  }
  return dt.toDate();
}

function formatDateTime(date: Date): string {
  return dayjs(date).format('HH:mm DD/MM/YYYY');
}

export class CommitteeService {
  /**
   * Create a new committee with members
   */
  async createCommittee(userId: string, data: CreateCommitteeRequest) {
    return await prisma.$transaction(async (tx) => {
      // 1. Validation based on committee type
      if (data.type === 'POSTER') {
        if (data.members.length !== 2) {
          throw new Error('Hội đồng Poster phải có đúng 2 giảng viên');
        }
        // Assign specific roles for poster members
        data.members = [
          { ...data.members[0], role: 'MEMBER_1' as CommitteeRole },
          { ...data.members[1], role: 'MEMBER_2' as CommitteeRole },
        ];
      } else {
        // ORAL (default)
        if (data.members.length < 3) {
          throw new Error('Hội đồng Vấn đáp phải có ít nhất 3 giảng viên');
        }
        const hasChair = data.members.some((m: any) => m.role === 'CHAIR');
        const hasSecretary = data.members.some((m: any) => m.role === 'SECRETARY');
        if (!hasChair || !hasSecretary) {
          throw new Error('Hội đồng Vấn đáp phải có ít nhất 1 Chủ tịch và 1 Thư ký');
        }
      }

      // 2. [DEPARTMENT GUARD] All members must be from the same department as the committee
      if (data.departmentId) {
        const memberIds = data.members.map((m: any) => m.lecturerId);
        const memberUsers = await tx.user.findMany({
          where: { id: { in: memberIds } },
          select: { id: true, full_name: true, departmentId: true },
        });
        const wrongDept = memberUsers.filter((u: any) => u.departmentId !== data.departmentId);
        if (wrongDept.length > 0) {
          const names = wrongDept.map((u: any) => u.full_name).join(', ');
          throw new Error(`Giảng viên không thuộc bộ môn này: ${names}`);
        }
      }

      // 3. Check if any lecturer is already in a committee for this semester
      const lecturerIds = data.members.map((m: any) => m.lecturerId);
      const existingMemberships = await tx.committeeMember.findMany({
        where: {
          semester_id: data.semesterId,
          lecturer_id: { in: lecturerIds }
        },
        include: { lecturer: true }
      });

      if (existingMemberships.length > 0) {
        const names = existingMemberships.map((m: any) => m.lecturer.full_name).join(', ');
        throw new Error(`Giảng viên đã thuộc hội đồng khác trong học kỳ này: ${names}`);
      }

      // 3. Create Committee
      const committee = await tx.committee.create({
        data: {
          name: data.name,
          type: data.type || 'ORAL',
          semester_id: data.semesterId,
          departmentId: data.departmentId,
          room_preference: data.roomPreference,
          members: {
            create: data.members.map((m: any) => ({
              lecturer_id: m.lecturerId,
              role: m.role as CommitteeRole,
              semester_id: data.semesterId
            }))
          }
        },
        include: {
          members: {
            include: { lecturer: true }
          }
        }
      });

      return {
        ...committee,
        members: committee.members.map((m: any) => ({
          lecturerId: m.lecturer_id,
          fullName: m.lecturer.full_name,
          role: m.role
        }))
      };
    });
  }

  /**
   * Update committee details and members
   */
  async updateCommittee(userId: string, committeeId: string, data: UpdateCommitteeRequest) {
    return await prisma.$transaction(async (tx) => {
      const committee = await tx.committee.findUnique({
        where: { id: committeeId },
        include: { members: true }
      });

      if (!committee) throw new Error('Không tìm thấy hội đồng');

      // Update basic info
      await tx.committee.update({
        where: { id: committeeId },
        data: {
          name: data.name,
          type: data.type,
          room_preference: data.roomPreference
        }
      });

      // Update members if provided
      if (data.members) {
        // Delete old members
        await tx.committeeMember.deleteMany({
          where: { committee_id: committeeId }
        });

        // Check uniqueness for new members
        const lecturerIds = data.members.map((m: any) => m.lecturerId);
        const existingMemberships = await tx.committeeMember.findMany({
          where: {
            semester_id: committee.semester_id,
            lecturer_id: { in: lecturerIds },
            committee_id: { not: committeeId }
          },
          include: { lecturer: true }
        });

        if (existingMemberships.length > 0) {
          const names = existingMemberships.map((m: any) => m.lecturer.full_name).join(', ');
          throw new Error(`Giảng viên đã thuộc hội đồng khác: ${names}`);
        }

        // [DEPARTMENT GUARD] All new members must be from same department as committee
        if (committee.departmentId) {
          const newMemberIds = data.members.map((m: any) => m.lecturerId);
          const newMemberUsers = await tx.user.findMany({
            where: { id: { in: newMemberIds } },
            select: { id: true, full_name: true, departmentId: true },
          });
          const wrongDept = newMemberUsers.filter((u: any) => u.departmentId !== committee.departmentId);
          if (wrongDept.length > 0) {
            const names = wrongDept.map((u: any) => u.full_name).join(', ');
            throw new Error(`Giảng viên không thuộc bộ môn này: ${names}`);
          }
        }

        // Create new members
        await tx.committeeMember.createMany({
          data: data.members.map((m: any) => ({
            committee_id: committeeId,
            lecturer_id: m.lecturerId,
            role: m.role as CommitteeRole,
            semester_id: committee.semester_id
          }))
        });
      }

      const result = await tx.committee.findUnique({
        where: { id: committeeId },
        include: { members: { include: { lecturer: true } } }
      });

      if (!result) return null;

      return {
        ...result,
        members: result.members.map((m: any) => ({
          lecturerId: m.lecturer_id,
          fullName: m.lecturer.full_name,
          role: m.role
        }))
      };
    });
  }

  /**
   * Delete a committee
   */
  async deleteCommittee(userId: string, committeeId: string) {
    const usage = await prisma.defenseSchedule.count({
      where: { committee_id: committeeId }
    });

    if (usage > 0) {
      throw new Error('Không thể xóa hội đồng đã được phân công đề tài');
    }

    await prisma.committee.delete({
      where: { id: committeeId }
    });

    return { message: 'Đã xóa hội đồng thành công' };
  }

  /**
   * Get all committees for a semester
   */
  async getCommittees(semesterId: string, departmentId?: string) {
    const committees = await prisma.committee.findMany({
      where: {
        semester_id: semesterId,
        ...(departmentId ? { departmentId: departmentId } : {}),
      },
      include: {
        members: {
          include: { lecturer: { select: { id: true, full_name: true } } }
        }
      },
      orderBy: { name: 'asc' }
    });

    return committees.map((c: any) => ({
      ...c,
      members: c.members.map((m: any) => ({
        lecturerId: m.lecturer_id,
        fullName: m.lecturer.full_name,
        role: m.role
      }))
    }));
  }

  /**
   * Get all lecturer IDs already in a committee for a semester
   */
  async getBusyLecturerIds(semesterId: string) {
    const memberships = await prisma.committeeMember.findMany({
      where: { semester_id: semesterId },
      select: { lecturer_id: true }
    });
    return [...new Set(memberships.map((m: any) => m.lecturer_id))];
  }

  /**
   * Assign a topic to a committee with conflict validation
   */
  async assignTopicToCommittee(userId: string, data: AssignTopicToCommitteeRequest) {
    return await prisma.$transaction(async (tx) => {
      // 1. Verify Topic & Committee
      const topic = await tx.topic.findUnique({
        where: { id: data.topicId },
        include: { supervisor: true, semester: true }
      });
      if (!topic) throw new Error(ERROR_CODES.TOPIC_NOT_FOUND);

      if (!topic.semester.defense_start) {
        throw new Error('Ngày bảo vệ của học kỳ chưa được Trưởng bộ môn thiết lập');
      }

      const committee = await tx.committee.findUnique({
        where: { id: data.committeeId },
        include: { members: { include: { lecturer: true } } }
      });
      if (!committee) throw new Error('Không tìm thấy hội đồng');

      // [DEPARTMENT GUARD] Committee must belong to the same department as the topic
      if (committee.departmentId && topic.departmentId && committee.departmentId !== topic.departmentId) {
        throw new Error('Hội đồng không thuộc cùng bộ môn với đề tài. Vui lòng chọn hội đồng đúng bộ môn.');
      }

      // 2. Validate Rule: Supervisor NOT in committee
      const isSupervisorInCommittee = committee.members.some(m => m.lecturer_id === topic.supervisor_id);
      if (isSupervisorInCommittee) {
        throw new Error(`Giảng viên hướng dẫn (${topic.supervisor.full_name}) không được nằm trong hội đồng chấm đề tài này`);
      }

      // 3. Conflict Validation: No overlapping time slots for the same committee
      const start = combineDateAndTime(data.defenseDate, data.startTime);
      const end = combineDateAndTime(data.defenseDate, data.endTime);

      if (end <= start) {
        throw new Error('Thời gian kết thúc phải sau thời gian bắt đầu');
      }

      const overlap = await tx.defenseSchedule.findFirst({
        where: {
          committee_id: data.committeeId,
          defense_date: start,
          topic_id: { not: data.topicId },
          OR: [
            {
              AND: [
                { start_time: { lte: start } },
                { end_time: { gt: start } }
              ]
            },
            {
              AND: [
                { start_time: { lt: end } },
                { end_time: { gte: end } }
              ]
            },
            {
              AND: [
                { start_time: { gte: start } },
                { end_time: { lte: end } }
              ]
            }
          ]
        }
      });

      if (overlap) {
        throw new Error('Hội đồng đã có lịch bảo vệ trùng thời gian này');
      }

      // 4. Create or Update DefenseSchedule
      const schedule = await tx.defenseSchedule.upsert({
        where: { topic_id: data.topicId },
        create: {
          topic_id: data.topicId,
          committee_id: data.committeeId,
          semester_id: topic.semester_id,
          defense_date: start,
          start_time: start,
          end_time: end,
          room: data.room || committee.room_preference,
          notes: data.notes,
          status: ScheduleStatus.PENDING
        },
        update: {
          committee_id: data.committeeId,
          defense_date: start,
          start_time: start,
          end_time: end,
          room: data.room || committee.room_preference,
          notes: data.notes
        }
      });

      // 5. Create Assignments for committee members
      // Delete old committee assignments for this topic
      await tx.assignment.deleteMany({
        where: {
          topic_id: data.topicId,
          assignment_type: AssignmentType.COMMITTEE
        }
      });

      // Create new ones
      for (const member of committee.members) {
        await tx.assignment.create({
          data: {
            topic_id: data.topicId,
            reviewer_id: member.lecturer_id,
            assignment_type: AssignmentType.COMMITTEE,
            committee_role: member.role,
            assigned_by: userId,
            deadline_at: start,
            status: AssignmentStatus.AUTO_ACCEPTED
          }
        });
      }

      // 6. Update Topic Status
      await tx.topic.update({
        where: { id: data.topicId },
        data: { status: TopicStatus.WAITING_FOR_DEFENSE }
      });

      // 7. Send Notifications to committee members and students
      const registrations = await tx.topicRegistration.findMany({
        where: { topic_id: data.topicId, status: 'CONFIRMED' },
        include: { 
          group: { include: { members: { where: { status: 'ACCEPTED' } } } } 
        }
      });

      const studentIds = registrations.flatMap(reg => 
        reg.group_id ? reg.group?.members.map((m: any) => m.user_id) || [] : [reg.student_id]
      );

      const committeeMemberIds = committee.members.map((m: any) => m.lecturer_id);
      const userIds = [...new Set([...committeeMemberIds, ...studentIds])];

      await notificationService.notifyDefenseScheduled({
        userIds,
        topicId: data.topicId,
        date: dayjs(start).format('DD/MM/YYYY'),
        startTime: formatDateTime(start),
        endTime: formatDateTime(end),
        room: data.room || committee.room_preference || ''
      });

      return schedule;
    });

  }

  /**
   * Get Master Table structure (Committee -> Schedules)
   */
  async getCommitteeSchedules(semesterId: string, departmentId?: string): Promise<CommitteeScheduleResponse[]> {
    const committees = await prisma.committee.findMany({
      where: {
        semester_id: semesterId,
        ...(departmentId ? { departmentId: departmentId } : {}),
      },
      include: {
        members: {
          include: { lecturer: { select: { id: true, full_name: true } } }
        },
        defense_schedules: {
          include: {
            topic: {
              include: {
                registrations: {
                  include: {
                    student: { select: { student_code: true, full_name: true } },
                    group: { select: { name: true } }
                  }
                }
              }
            }
          },
          orderBy: { start_time: 'asc' }
        }
      },
      orderBy: { name: 'asc' }
    });

    return committees.map((c: any) => ({
      committee: {
        id: c.id,
        name: c.name,
        roomPreference: c.room_preference,
        type: c.type,
        members: c.members.map((m: any) => ({
          lecturerId: m.lecturer_id,
          fullName: m.lecturer.full_name,
          role: m.role
        }))
      },
      schedules: c.defense_schedules.map((s: any) => ({
        topicId: s.topic_id,
        topicCode: s.topic.code,
        topicName: s.topic.title,
        groupCode: s.topic.registrations?.[0]?.group?.name,
        students: s.topic.registrations.map((r: any) => ({
          studentCode: r.student.student_code!,
          fullName: r.student.full_name
        })),
        date: s.defense_date,
        startTime: s.start_time,
        endTime: s.end_time,
        room: s.room,
        status: s.status
      }))
    }));
  }
}

export default new CommitteeService();
