import prisma from '../config/database';
import { ERROR_CODES } from '../constants';
import { SemesterPhase, UserRole, SemesterStatus } from '@prisma/client';
import { SemesterGuard } from '../utils/semester-guard';

/**
 * Convert a date string ("YYYY-MM-DD" or ISO) to a Date object.
 * Appends T00:00:00 to prevent UTC shift causing the date to roll back 1 day.
 */
function toDate(value: string | Date | undefined | null): Date | undefined {
  if (!value) return undefined;
  if (value instanceof Date) return value;
  // If it looks like a plain date "YYYY-MM-DD", append time to avoid UTC shift
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return new Date(value + 'T00:00:00');
  }
  return new Date(value);
}

export class SemesterService {
  async createSemester(userId: string, data: {
    name: string;
    code: string;
    start_date: Date;
    end_date: Date;
    proposal_deadline: Date;
    thesis_deadline: Date;
    defense_start?: Date;
    defense_end?: Date;
    topic_viewing_start?: Date;
    topic_viewing_end?: Date;
    topic_registration_start?: Date;
    topic_registration_end?: Date;
    midterm_start?: Date;
    midterm_end?: Date;
  }) {
    // Parse all date strings to Date objects
    const start_date = toDate(data.start_date)!;
    const end_date = toDate(data.end_date)!;
    const proposal_deadline = toDate(data.proposal_deadline)!;
    const thesis_deadline = toDate(data.thesis_deadline)!;
    const defense_start = toDate(data.defense_start);
    const defense_end = toDate(data.defense_end);
    const topic_viewing_start = toDate(data.topic_viewing_start);
    const topic_viewing_end = toDate(data.topic_viewing_end);
    const topic_registration_start = toDate(data.topic_registration_start);
    const topic_registration_end = toDate(data.topic_registration_end);
    const midterm_start = toDate(data.midterm_start);
    const midterm_end = toDate(data.midterm_end);

    // Validate phase sequence
    if (start_date >= end_date) {
      throw new Error('Ngày kết thúc phải sau ngày bắt đầu');
    }

    if (proposal_deadline >= thesis_deadline) {
      throw new Error('Thời hạn nộp khóa luận phải sau hạn nộp đề cương');
    }

    if (defense_start && defense_end && defense_start >= defense_end) {
      throw new Error('Ngày kết thúc bảo vệ phải sau ngày bắt đầu bảo vệ');
    }

    if (topic_registration_start && topic_registration_end && topic_registration_start >= topic_registration_end) {
      throw new Error('Ngày kết thúc đăng ký phải sau ngày bắt đầu đăng ký');
    }

    // Validate midterm milestone: must be INSIDE the WORK phase
    // WORK phase = [topic_registration_end + 1 day, proposal_deadline]
    if (midterm_start || midterm_end) {
      const work_start = topic_registration_end
        ? new Date(topic_registration_end.getTime() + 86400000) // +1 day
        : start_date;
      const work_end = proposal_deadline;

      if (midterm_start && midterm_start < work_start) {
        throw new Error('Ngày bắt đầu chấm giữa kỳ phải nằm trong giai đoạn Thực hiện khóa luận');
      }

      if (midterm_end && midterm_end > work_end) {
        throw new Error('Ngày kết thúc chấm giữa kỳ phải nằm trong giai đoạn Thực hiện khóa luận');
      }

      if (midterm_start && midterm_end && midterm_start > midterm_end) {
        throw new Error('Ngày kết thúc chấm giữa kỳ phải sau hoặc bằng ngày bắt đầu');
      }
    }

    // Check if code already exists
    const existing = await prisma.semester.findUnique({
      where: { code: data.code },
    });

    if (existing) {
      throw new Error('Semester code already exists');
    }

    const semester = await prisma.semester.create({
      data: {
        name: data.name,
        code: data.code,
        start_date: start_date,
        end_date: end_date,
        proposal_deadline: proposal_deadline,
        thesis_deadline: thesis_deadline,
        defense_start: defense_start,
        defense_end: defense_end,
        topic_viewing_start: topic_viewing_start,
        topic_viewing_end: topic_viewing_end,
        topic_registration_start: topic_registration_start,
        topic_registration_end: topic_registration_end,
        midterm_start: midterm_start,
        midterm_end: midterm_end,
        current_phase: SemesterPhase.PLANNING,
        status: SemesterStatus.PLANNING,
      },
    });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        user_id: userId,
        action: 'CREATE',
        entity_type: 'Semester',
        entity_id: semester.id,
        new_value: semester,
      },
    });

    return semester;
  }

  async updateSemester(userId: string, semesterId: string, data: {
    name?: string;
    start_date?: Date;
    end_date?: Date;
    proposal_deadline?: Date;
    thesis_deadline?: Date;
    defense_start?: Date;
    defense_end?: Date;
    topic_viewing_start?: Date;
    topic_viewing_end?: Date;
    topic_registration_start?: Date;
    topic_registration_end?: Date;
    midterm_start?: Date;
    midterm_end?: Date;
    isActive?: boolean;
    phase?: SemesterPhase;
    manualPhaseOverride?: SemesterPhase | null;
  }) {
    const semester = await prisma.semester.findUnique({
      where: { id: semesterId },
    });

    if (!semester) {
      throw new Error(ERROR_CODES.NOT_FOUND);
    }

    // Resolve final values (merge incoming with existing)
    const final_start_date = toDate(data.start_date) ?? semester.start_date;
    const final_end_date = toDate(data.end_date) ?? semester.end_date;
    const final_proposal_deadline = toDate(data.proposal_deadline) ?? semester.proposal_deadline;
    const final_thesis_deadline = toDate(data.thesis_deadline) ?? semester.thesis_deadline;
    const final_defense_start = toDate(data.defense_start) ?? semester.defense_start;
    const final_defense_end = toDate(data.defense_end) ?? semester.defense_end;
    const final_topic_registration_end = toDate(data.topic_registration_end) ?? semester.topic_registration_end;
    const final_midterm_start = toDate(data.midterm_start);
    const final_midterm_end = toDate(data.midterm_end);

    // Validate phase sequence
    if (final_start_date >= final_end_date) {
      throw new Error('Ngày kết thúc phải sau ngày bắt đầu');
    }

    if (final_proposal_deadline >= final_thesis_deadline) {
      throw new Error('Thời hạn nộp khóa luận phải sau hạn nộp đề cương');
    }

    if (final_defense_start && final_defense_end && final_defense_start >= final_defense_end) {
      throw new Error('Ngày kết thúc bảo vệ phải sau ngày bắt đầu bảo vệ');
    }

    // Validate midterm milestone: must be INSIDE the WORK phase
    if (final_midterm_start || final_midterm_end) {
      const work_start = final_topic_registration_end
        ? new Date(final_topic_registration_end.getTime() + 86400000)
        : final_start_date;
      const work_end = final_proposal_deadline;

      if (final_midterm_start && final_midterm_start < work_start) {
        throw new Error('Ngày bắt đầu chấm giữa kỳ phải nằm trong giai đoạn Thực hiện khóa luận');
      }

      if (final_midterm_end && final_midterm_end > work_end) {
        throw new Error('Ngày kết thúc chấm giữa kỳ phải nằm trong giai đoạn Thực hiện khóa luận');
      }

      if (final_midterm_start && final_midterm_end && final_midterm_start > final_midterm_end) {
        throw new Error('Ngày kết thúc chấm giữa kỳ phải sau hoặc bằng ngày bắt đầu');
      }
    }

    const updateData: any = {
      name: data.name,
      start_date: toDate(data.start_date),
      end_date: toDate(data.end_date),
      proposal_deadline: toDate(data.proposal_deadline),
      thesis_deadline: toDate(data.thesis_deadline),
      defense_start: toDate(data.defense_start),
      defense_end: toDate(data.defense_end),
      topic_viewing_start: toDate(data.topic_viewing_start),
      topic_viewing_end: toDate(data.topic_viewing_end),
      topic_registration_start: toDate(data.topic_registration_start),
      topic_registration_end: toDate(data.topic_registration_end),
      midterm_start: final_midterm_start,
      midterm_end: final_midterm_end,
    };

    if (data.phase) {
      updateData.current_phase = data.phase;
    }

    if (data.manualPhaseOverride !== undefined) {
      updateData.manual_phase_override = data.manualPhaseOverride;
    }

    const updated = await prisma.semester.update({
      where: { id: semesterId },
      data: updateData,
    });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        user_id: userId,
        action: 'UPDATE',
        entity_type: 'Semester',
        entity_id: semesterId,
        old_value: semester,
        new_value: updated,
      },
    });

    return updated;
  }

  async getSemesters() {
    const semesters = await prisma.semester.findMany({
      include: {
        _count: {
          select: {
            topics: true,
            groups: true,
            topic_registrations: true,
          },
        },
      },
      orderBy: { start_date: 'desc' },
    });

    // Calculate effective phase for each semester for display
    return semesters.map(s => ({
      ...s,
      calculated_phase: SemesterGuard.calculateCurrentPhase(s)
    }));
  }

  async getActiveSemester() {
    // Usually the one that is currently REGISTRATION or TOPIC_PROPOSAL or IMPLEMENTATION
    // For simplicity, we can still use a flag or just find the "most active" one
    const semesters = await prisma.semester.findMany({
      orderBy: { start_date: 'desc' }
    });

    for (const sem of semesters) {
      const phase = SemesterGuard.calculateCurrentPhase(sem);
      if (phase !== SemesterPhase.FINAL) {
        return {
          ...sem,
          calculated_phase: phase
        };
      }
    }

    return semesters[0] || null;
  }

  async getSemesterById(semesterId: string) {
    const semester = await prisma.semester.findUnique({
      where: { id: semesterId },
      include: {
        _count: {
          select: {
            topics: true,
            groups: true,
            topic_registrations: true,
          },
        },
      },
    });

    if (!semester) {
      throw new Error(ERROR_CODES.NOT_FOUND);
    }

    return {
      ...semester,
      calculated_phase: SemesterGuard.calculateCurrentPhase(semester)
    };
  }

  /**
   * HOD/Admin sets manual phase override
   */
  async setManualOverride(userId: string, role: UserRole, semesterId: string, phase: SemesterPhase | null) {
    const semester = await prisma.semester.findUnique({
      where: { id: semesterId },
    });

    if (!semester) {
      throw new Error(ERROR_CODES.NOT_FOUND);
    }

    // Validate transition
    const currentEffectivePhase = SemesterGuard.calculateCurrentPhase(semester);
    if (phase && !SemesterGuard.canTransition(currentEffectivePhase, phase, role)) {
      throw new Error('Chuyển đổi giai đoạn không hợp lệ. Bạn chỉ có thể tiến hoặc lùi 1 bước.');
    }

    const updated = await prisma.semester.update({
      where: { id: semesterId },
      data: { manual_phase_override: phase },
    });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        user_id: userId,
        action: 'PHASE_OVERRIDE',
        entity_type: 'Semester',
        entity_id: semesterId,
        old_value: { 
          phase: currentEffectivePhase, 
          override: semester.manual_phase_override 
        },
        new_value: { 
          phase: phase || 'AUTO', 
          override: phase,
          performed_by_role: role
        },
      },
    });

    return {
      ...updated,
      calculated_phase: SemesterGuard.calculateCurrentPhase(updated)
    };
  }

  async setActiveSemester(userId: string, role: UserRole, semesterId: string) {
    // 1. Move status to ACTIVE
    // 2. Starting a semester usually begins with PREVIEW phase
    const updated = await prisma.semester.update({
      where: { id: semesterId },
      data: { 
        status: SemesterStatus.ACTIVE,
        manual_phase_override: SemesterPhase.PREVIEW 
      },
    });

    await prisma.auditLog.create({
      data: {
        user_id: userId,
        action: 'ACTIVATE_SEMESTER',
        entity_type: 'Semester',
        entity_id: semesterId,
        new_value: { status: SemesterStatus.ACTIVE, phase: SemesterPhase.PREVIEW },
      },
    });

    return {
      ...updated,
      calculated_phase: SemesterGuard.calculateCurrentPhase(updated)
    };
  }

  /**
   * Admin explicitly ends the semester.
   * This locks the system for this semester.
   */
  async finalizeSemester(userId: string, semesterId: string) {
    const semester = await prisma.semester.findUnique({
      where: { id: semesterId },
    });

    if (!semester) {
      throw new Error(ERROR_CODES.NOT_FOUND);
    }

    // Check if already finalized
    if (semester.status === SemesterStatus.COMPLETED) {
      throw new Error('Học kỳ này đã được kết thúc trước đó.');
    }

    const updated = await prisma.semester.update({
      where: { id: semesterId },
      data: { 
        status: SemesterStatus.COMPLETED,
        manual_phase_override: null // Clear override so status dictates FINAL phase
      },
    });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        user_id: userId,
        action: 'FINALIZE_SEMESTER',
        entity_type: 'Semester',
        entity_id: semesterId,
        old_value: { status: semester.status },
        new_value: { status: SemesterStatus.COMPLETED },
      },
    });

    return {
      ...updated,
      calculated_phase: SemesterGuard.calculateCurrentPhase(updated)
    };
  }

  async updateDefenseDate(userId: string, semesterId: string, defenseDate: Date) {
    const semester = await prisma.semester.findUnique({
      where: { id: semesterId },
    });

    if (!semester) {
      throw new Error(ERROR_CODES.NOT_FOUND);
    }

    const phase = SemesterGuard.calculateCurrentPhase(semester);
    if (phase === SemesterPhase.FINAL) {
      throw new Error('Không thể cập nhật ngày bảo vệ ở giai đoạn này');
    }

    const updated = await prisma.semester.update({
      where: { id: semesterId },
      data: {
        defense_start: defenseDate,
        defense_end: defenseDate
      },
    });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        user_id: userId,
        action: 'UPDATE_DEFENSE_DATE',
        entity_type: 'Semester',
        entity_id: semesterId,
        old_value: { defense_start: semester.defense_start },
        new_value: { defense_start: defenseDate },
      },
    });

    return updated;
  }
}

export default new SemesterService();
