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
      is_registration_open?: boolean;
    }
  ) {
    // Create the config
    const config = await prisma.departmentSemesterConfig.upsert({
      where: {
        department_id_semester_id: {
          department_id: departmentId,
          semester_id: semesterId,
        },
      },
      update: {
        ...data,
        updated_by: userId,
      },
      create: {
        department_id: departmentId,
        semester_id: semesterId,
        defense_date: data.defense_date,
        is_registration_open: data.is_registration_open || false,
        updated_by: userId,
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
          new_value: { is_registration_open: data.is_registration_open, department_id: departmentId },
        },
      });
    }

    return config;
  }
}

export default new DepartmentSemesterConfigService();
