import prisma from '../config/database';
import { ERROR_CODES } from '../constants';

export class DepartmentService {
  async createDepartment(userId: string, data: { name: string; code: string; description?: string }) {
    // Check if code already exists
    const existing = await prisma.department.findUnique({
      where: { code: data.code },
    });

    if (existing) {
      throw new Error('Department code already exists');
    }

    const department = await prisma.department.create({
      data: {
        name: data.name,
        code: data.code,
        description: data.description,
      },
    });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        user_id: userId,
        action: 'CREATE',
        entity_type: 'Department',
        entity_id: department.id,
        new_value: department,
      },
    });

    return department;
  }

  async updateDepartment(userId: string, departmentId: string, data: { name?: string; description?: string }) {
    const department = await prisma.department.findUnique({
      where: { id: departmentId },
    });

    if (!department) {
      throw new Error(ERROR_CODES.NOT_FOUND);
    }

    const updated = await prisma.department.update({
      where: { id: departmentId },
      data: {
        name: data.name,
        description: data.description,
      },
    });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        user_id: userId,
        action: 'UPDATE',
        entity_type: 'Department',
        entity_id: departmentId,
        old_value: department,
        new_value: updated,
      },
    });

    return updated;
  }

  async getDepartments() {
    const departments = await prisma.department.findMany({
      include: {
        _count: {
          select: {
            User: true,
            Topic: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    return departments;
  }

  async getDepartmentById(departmentId: string) {
    const department = await prisma.department.findUnique({
      where: { id: departmentId },
      include: {
        User: {
          select: {
            id: true,
            full_name: true,
            email: true,
            role: true,
          },
        },
        _count: {
          select: {
            Topic: true,
          },
        },
      },
    });

    if (!department) {
      throw new Error(ERROR_CODES.NOT_FOUND);
    }

    return department;
  }
}

export default new DepartmentService();
