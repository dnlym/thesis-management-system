import prisma from '../config/database';
import { ERROR_CODES } from '../constants';
import { Prisma, Semester, SemesterPhase, UserRole, SemesterStatus } from '@prisma/client';
import { SemesterGuard } from '../utils/semester-guard';
import dayjs from '../config/dayjs';

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

/**
 * Convert an ISO date string to the end of the local day (23:59:59.999).
 * Ensures that choosing the same start and end day includes the entire end day.
 */
function toEndDate(value: string | Date | undefined | null): Date | undefined {
  const d = toDate(value);
  if (!d) return undefined;
  return dayjs(d).endOf('day').toDate();
}

export class SemesterService {
  private async checkOverlap(start_date: Date, end_date: Date, excludeId?: string) {
    const overlapping = await prisma.semester.findFirst({
      where: {
        AND: [
          { start_date: { lt: end_date } },
          { end_date: { gt: start_date } }
        ],
        ...(excludeId ? { id: { not: excludeId } } : {})
      }
    });

    if (overlapping) {
      throw new Error(`Thời gian học kỳ bị chồng lấn với học kỳ: ${overlapping.name} (${overlapping.code})`);
    }
  }

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
    // Using toEndDate for all deadlines / phase boundaries
    const start_date = toDate(data.start_date)!;
    const end_date = toEndDate(data.end_date)!;
    const proposal_deadline = toEndDate(data.proposal_deadline)!;
    const thesis_deadline = toEndDate(data.thesis_deadline)!;
    const defense_start = toDate(data.defense_start);
    const defense_end = toEndDate(data.defense_end);
    const topic_viewing_start = toDate(data.topic_viewing_start);
    const topic_viewing_end = toEndDate(data.topic_viewing_end);
    const topic_registration_start = toDate(data.topic_registration_start);
    const topic_registration_end = toEndDate(data.topic_registration_end);
    const midterm_start = toDate(data.midterm_start);
    const midterm_end = toEndDate(data.midterm_end);

    // Validate timeline integrity
    this.validateTimelineIntegrity({
      start_date,
      end_date,
      topic_viewing_start,
      topic_viewing_end,
      topic_registration_start,
      topic_registration_end,
      proposal_deadline,
      thesis_deadline,
      defense_start,
      defense_end,
      midterm_start,
      midterm_end
    });

    // Check for semester overlapping
    await this.checkOverlap(start_date, end_date);

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

    if (semester.status === SemesterStatus.COMPLETED) {
      throw new Error('Học kỳ đã kết thúc, không được phép chỉnh sửa thông tin.');
    }

    // Resolve final values (merge incoming with existing)
    const final_start_date = toDate(data.start_date) ?? semester.start_date;
    const final_end_date = toEndDate(data.end_date) ?? semester.end_date;
    const final_proposal_deadline = toEndDate(data.proposal_deadline) ?? semester.proposal_deadline;
    const final_thesis_deadline = toEndDate(data.thesis_deadline) ?? semester.thesis_deadline;
    const final_defense_start = toDate(data.defense_start) ?? semester.defense_start;
    const final_defense_end = toEndDate(data.defense_end) ?? semester.defense_end;
    const final_topic_registration_end = toEndDate(data.topic_registration_end) ?? semester.topic_registration_end;
    const final_midterm_start = toDate(data.midterm_start) ?? semester.midterm_start;
    const final_midterm_end = toEndDate(data.midterm_end) ?? semester.midterm_end;

    // Validate timeline integrity of the final merged result
    this.validateTimelineIntegrity({
      start_date: final_start_date,
      end_date: final_end_date,
      topic_viewing_start: toDate(data.topic_viewing_start) ?? semester.topic_viewing_start,
      topic_viewing_end: toEndDate(data.topic_viewing_end) ?? semester.topic_viewing_end,
      topic_registration_start: toDate(data.topic_registration_start) ?? semester.topic_registration_start,
      topic_registration_end: final_topic_registration_end,
      proposal_deadline: final_proposal_deadline,
      thesis_deadline: final_thesis_deadline,
      defense_start: final_defense_start,
      defense_end: final_defense_end,
      midterm_start: final_midterm_start,
      midterm_end: final_midterm_end
    });

    // Check for semester overlapping
    await this.checkOverlap(final_start_date, final_end_date, semesterId);

    const updateData: Prisma.SemesterUpdateInput = {
      name: data.name,
      start_date: toDate(data.start_date),
      end_date: toEndDate(data.end_date),
      proposal_deadline: toEndDate(data.proposal_deadline),
      thesis_deadline: toEndDate(data.thesis_deadline),
      defense_start: toDate(data.defense_start),
      defense_end: toEndDate(data.defense_end),
      topic_viewing_start: toDate(data.topic_viewing_start),
      topic_viewing_end: toEndDate(data.topic_viewing_end),
      topic_registration_start: toDate(data.topic_registration_start),
      topic_registration_end: toEndDate(data.topic_registration_end),
      midterm_start: toDate(data.midterm_start),
      midterm_end: toEndDate(data.midterm_end),
    };

    const oldPhase = SemesterGuard.calculateCurrentPhase(semester);

    const updated = await prisma.semester.update({
      where: { id: semesterId },
      data: updateData,
    });

    const newPhase = SemesterGuard.calculateCurrentPhase(updated);

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

    return {
      ...updated,
      calculated_phase: newPhase,
      previous_phase: oldPhase,
    };
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
    // 1. Priority 1: Strictly find the semester marked as ACTIVE
    const activeSemester = await prisma.semester.findFirst({
      where: { status: SemesterStatus.ACTIVE }
    });

    if (activeSemester) {
      return {
        ...activeSemester,
        calculated_phase: SemesterGuard.calculateCurrentPhase(activeSemester)
      };
    }

    // 2. Priority 2: If no ACTIVE semester, fallback to the most recent one that is in a valid phase
    const semesters = await prisma.semester.findMany({
      orderBy: { start_date: 'desc' }
    });

    for (const sem of semesters) {
      const phase = SemesterGuard.calculateCurrentPhase(sem);
      if (phase && phase !== SemesterPhase.FINAL) {
        return {
          ...sem,
          calculated_phase: phase
        };
      }
    }

    // 3. Last resort: just the latest one
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



  async setActiveSemester(userId: string, role: UserRole, semesterId: string) {
    // 1. Ensure absolute exclusivity: Only ONE semester can be ACTIVE at any given time.
    const currentlyActive = await prisma.semester.findFirst({
      where: { status: SemesterStatus.ACTIVE },
    });

    if (currentlyActive && currentlyActive.id !== semesterId) {
      throw new Error(`Hệ thống đang có học kỳ [${currentlyActive.name}] ở trạng thái Đang Hoạt Động (ACTIVE). Vui lòng Tổng kết (COMPLETED) học kỳ cũ trước khi kích hoạt học kỳ mới!`);
    }

    // 2. Move status to ACTIVE
    const updated = await prisma.semester.update({
      where: { id: semesterId },
      data: { 
        status: SemesterStatus.ACTIVE
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
        status: SemesterStatus.COMPLETED
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

    const newPhase = SemesterGuard.calculateCurrentPhase(updated);

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

    return {
      ...updated,
      calculated_phase: newPhase,
    };
  }

  /**
   * Validates that the timeline is consistent and non-overlapping.
   * Preview < Registration < Work < Review < Defense
   */
  private validateTimelineIntegrity(data: {
    start_date: Date;
    end_date: Date;
    topic_viewing_start?: Date | null;
    topic_viewing_end?: Date | null;
    topic_registration_start?: Date | null;
    topic_registration_end?: Date | null;
    proposal_deadline: Date;
    thesis_deadline: Date;
    defense_start?: Date | null;
    defense_end?: Date | null;
    midterm_start?: Date | null;
    midterm_end?: Date | null;
  }) {
    const {
      start_date,
      end_date,
      topic_viewing_start,
      topic_registration_start,
      topic_registration_end,
      proposal_deadline,
      thesis_deadline,
      defense_start,
      defense_end,
      midterm_start,
      midterm_end
    } = data;

    // 1. Array-based Boundary Lock (Fail-Fast: Prevent NULL bypass)
    const timeline = [
      { name: 'Ngày Khai giảng (start_date)', date: start_date },
      { name: 'Bắt đầu Xem đề tài (topic_viewing_start)', date: topic_viewing_start },
      { name: 'Bắt đầu Đăng ký (topic_registration_start)', date: topic_registration_start },
      { name: 'Kết thúc Đăng ký (topic_registration_end)', date: topic_registration_end },
      { name: 'Hạn nộp Báo cáo / Kết thúc Thực hiện (proposal_deadline)', date: proposal_deadline },
      { name: 'Hạn chót Phản biện / Reviewing (thesis_deadline)', date: thesis_deadline },
      { name: 'Bắt đầu Bảo vệ (defense_start)', date: defense_start },
      { name: 'Kết thúc Bảo vệ (defense_end)', date: defense_end },
      { name: 'Ngày Bế giảng (end_date)', date: end_date },
    ];

    // Trích xuất những cột bị NULL
    const missingFields = timeline.filter(t => !t.date).map(t => t.name);
    if (missingFields.length > 0) {
      throw new Error(`Dữ liệu Timeline bị khuyết các mốc bắt buộc: ${missingFields.join(', ')}`);
    }

    // 2. Strict Sequential Validator (Must dynamically increment or equal over time)
    for (let i = 0; i < timeline.length - 1; i++) {
      const current = dayjs(timeline[i].date!);
      const next = dayjs(timeline[i + 1].date!);
      
      // Compare by day to allow same-day transitions (ignore 23:59 vs 00:00)
      if (current.isAfter(next, 'day')) {
        throw new Error(`Trật tự thời gian không hợp lệ: Mốc [${timeline[i].name}] phải diễn ra trước hoặc cùng ngày với [${timeline[i + 1].name}].`);
      }
    }

    // 3. Strict Boundary Anchor Checks (Phase Extreme Ends must perfectly match Global Bounds)
    if (timeline[1].date!.getTime() !== timeline[0].date!.getTime()) {
      throw new Error('Timeline must start from semester start (Giai đoạn Xem đề tài phải bắt đầu cùng ngày Khai giảng học kỳ).');
    }
    if (timeline[7].date!.getTime() !== timeline[8].date!.getTime()) {
      throw new Error('Timeline must end at semester end (Giai đoạn Bảo vệ phải kết thúc cùng ngày Bế giảng học kỳ).');
    }

    // 4. Midterm Bounds (Must strictly resolve inside WORK phase)
    // WORK phase: topic_registration_end -> proposal_deadline
    if (midterm_start || midterm_end) {
      if (!midterm_start || !midterm_end) {
        throw new Error('Ngày chấm giữa kỳ bắt buộc phải có đủ điểm Bắt đầu và Kết thúc.');
      }
      const mStart = dayjs(midterm_start);
      const mEnd = dayjs(midterm_end);

      if (mStart.isAfter(mEnd, 'day')) {
        throw new Error('Thời gian kết thúc giữa kỳ phải sau hoặc cùng ngày thời gian bắt đầu giữa kỳ.');
      }
      if (topic_registration_end && mStart.isBefore(dayjs(topic_registration_end), 'day')) {
        throw new Error('Giai đoạn chấm giữa kỳ phải bắt đầu sau hoặc cùng ngày với khi sinh viên bắt đầu Thực hiện khóa luận.');
      }
      if (proposal_deadline && mEnd.isAfter(dayjs(proposal_deadline), 'day')) {
        throw new Error('Giai đoạn chấm giữa kỳ phải kết thúc trước hoặc cùng ngày hạn nộp báo cáo (kết thúc giai đoạn Thực hiện).');
      }
    }
  }

  async toggleRegistrationOverride(userId: string, semesterId: string, override: boolean, reason: string) {
    const semester = await prisma.semester.findUnique({
      where: { id: semesterId }
    });

    if (!semester) throw new Error('Semester not found');

    const updatedSemester = await prisma.semester.update({
      where: { id: semesterId },
      data: { is_registration_override: override } as any
    });

    await prisma.auditLog.create({
      data: {
        user_id: userId,
        action: override ? 'REGISTRATION_OVERRIDE_ENABLED' : 'REGISTRATION_OVERRIDE_DISABLED',
        entity_type: 'Semester',
        entity_id: semesterId,
        new_value: { override, reason }
      }
    });

    return updatedSemester;
  }
}


export default new SemesterService();
