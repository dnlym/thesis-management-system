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

    // Create audit logs for each changed field (Rule #5)
    if (data.defense_date !== undefined) {
      await prisma.auditLog.create({
        data: {
          user_id: userId,
          action: 'UPDATE_DEPT_DEFENSE_DATE',
          entity_type: 'DepartmentSemesterConfig',
          entity_id: config.id,
          new_value: { defense_date: data.defense_date, department_id: departmentId },
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
