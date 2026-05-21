import prisma from '../config/database';
import { ERROR_CODES } from '../constants';
import dayjs from '../config/dayjs';

export class DepartmentSemesterConfigService {
  async getConfig(departmentId: string, semesterId: string) {
    return prisma.departmentSemesterConfig.findUnique({
      where: {
        department_id_semester_id: {
          department_id: departmentId,
          semester_id: semesterId,
        },
      },
    });
  }

  async updateConfig(
    userId: string,
    departmentId: string,
    semesterId: string,
    data: {
      defense_date?: Date;
      council_grading_deadline?: Date;
      is_registration_open?: boolean;
      reason?: string;
    }
  ) {
    if (data.is_registration_open === true) {
      const semester = await prisma.semester.findUnique({ where: { id: semesterId } });
      if (semester && semester.midterm_start && dayjs().isSameOrAfter(dayjs(semester.midterm_start))) {
        throw new Error('Chức năng mở đăng ký bổ sung chỉ được phép thực hiện trước thời điểm chấm giữa kỳ.');
      }
    }

    // Create the config
    const upsertData = {
      defense_date: data.defense_date,
      council_grading_deadline: data.council_grading_deadline,
      is_registration_open: data.is_registration_open ?? false,
      updated_by: userId,
    };

    const config = await prisma.departmentSemesterConfig.upsert({
      where: {
        department_id_semester_id: {
          department_id: departmentId,
          semester_id: semesterId,
        },
      },
      update: upsertData,
      create: {
        ...upsertData,
        department_id: departmentId,
        semester_id: semesterId,
      },
    });

    // Create audit logs and SYNC existing schedules (Rule: Dynamic update)
    if (data.defense_date !== undefined) {
      // 1. Update all existing defense schedules for this department/semester
      await prisma.defenseSchedule.updateMany({
        where: {
          semester_id: semesterId,
          topic: {
            departmentId: departmentId
          }
        },
        data: {
          defense_date: data.defense_date
        }
      });

      // 2. Update all committee assignments deadlines for this department/semester
      await prisma.assignment.updateMany({
        where: {
          assignment_type: 'COMMITTEE',
          topic: {
            semester_id: semesterId,
            departmentId: departmentId
          }
        },
        data: {
          deadline_at: data.defense_date
        }
      });

      await prisma.auditLog.create({
        data: {
          user_id: userId,
          action: 'UPDATE_DEPT_DEFENSE_DATE',
          entity_type: 'DepartmentSemesterConfig',
          entity_id: config.id,
          new_value: { defense_date: data.defense_date, department_id: departmentId },
          description: `Đã tự động đồng bộ ngày bảo vệ mới (${dayjs(data.defense_date).format('DD/MM/YYYY')}) cho toàn bộ đề tài của bộ môn.`
        },
      });
    }

    if (data.is_registration_open !== undefined) {
      await prisma.auditLog.create({
        data: {
          user_id: userId,
          action: data.is_registration_open ? 'DEPT_REGISTRATION_OPENED' : 'DEPT_REGISTRATION_CLOSED',
          entity_type: 'DepartmentSemesterConfig',
          entity_id: config.id,
          new_value: { is_registration_open: data.is_registration_open, department_id: departmentId, reason: data.reason },
        },
      });
    }

    if (data.council_grading_deadline !== undefined) {
      await prisma.auditLog.create({
        data: {
          user_id: userId,
          action: 'UPDATE_COUNCIL_GRADING_DEADLINE',
          entity_type: 'DepartmentSemesterConfig',
          entity_id: config.id,
          new_value: { council_grading_deadline: data.council_grading_deadline, department_id: departmentId },
          description: `Đã cập nhật hạn chót nhập điểm Hội đồng mới: ${dayjs(data.council_grading_deadline).format('HH:mm DD/MM/YYYY')}`
        },
      });
    }

    return config;
  }


  async syncDepartmentDefenseDates(semesterId: string, userId: string = 'SYSTEM') {
    const semester = await prisma.semester.findUnique({ where: { id: semesterId } });
    if (!semester || !semester.defense_start || !semester.defense_end) return;

    const globalStart = dayjs(semester.defense_start).startOf('day');
    const globalEnd = dayjs(semester.defense_end).startOf('day');
    
    // Generate all available dates in the global window
    const availableDates = [];
    let curr = globalStart.clone();
    while (curr.isSameOrBefore(globalEnd)) {
      availableDates.push(curr.format('YYYY-MM-DD'));
      curr = curr.add(1, 'day');
    }
    if (availableDates.length === 0) return;

    const departments = await prisma.department.findMany({ where: { active: true } });
    const configs = await prisma.departmentSemesterConfig.findMany({ where: { semester_id: semesterId } });

    const dateUsageMap = new Map<string, number>();
    availableDates.forEach(d => dateUsageMap.set(d, 0));

    const needsAssignment = [];

    // 1. Identify valid and invalid configs
    for (const dept of departments) {
      const config = configs.find(c => c.department_id === dept.id);
      if (config && config.defense_date) {
        const configDate = dayjs(config.defense_date).startOf('day');
        if (configDate.isSameOrAfter(globalStart) && configDate.isSameOrBefore(globalEnd)) {
          // Valid config
          const dStr = configDate.format('YYYY-MM-DD');
          dateUsageMap.set(dStr, (dateUsageMap.get(dStr) || 0) + 1);
          continue; // No need to re-assign
        }
      }
      needsAssignment.push(dept.id);
    }

    // 2. Assign dates to those who need it
    for (const deptId of needsAssignment) {
      // Find the date with the minimum usage
      let bestDate = availableDates[0];
      let minUsage = Infinity;
      for (const d of availableDates) {
        const usage = dateUsageMap.get(d) || 0;
        if (usage < minUsage) {
          minUsage = usage;
          bestDate = d;
        }
      }

      // Assign to bestDate
      dateUsageMap.set(bestDate, minUsage + 1);
      
      const newDate = dayjs(bestDate).toDate();
      
      // Update config using the existing updateConfig method to trigger all side effects
      await this.updateConfig(userId, deptId, semesterId, { defense_date: newDate });
    }
  }


}

export default new DepartmentSemesterConfigService();
