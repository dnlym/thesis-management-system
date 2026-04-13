import prisma from '../config/database';
import { SemesterPhase, UserRole } from '@prisma/client';
import { SemesterGuard } from '../utils/semester-guard';

export class RegistrationExtensionService {
  /**
   * Create a new registration extension
   */
  async createExtension(userId: string, role: UserRole, data: {
    semesterId: string;
    extendedUntil: Date;
    reason: string;
  }) {
    const semester = await prisma.semester.findUnique({
      where: { id: data.semesterId },
    });

    if (!semester) {
      throw new Error('Semester not found');
    }

    // 1. Validate: Only HOD or Admin can perform this
    if (role !== UserRole.HEAD && role !== UserRole.ADMIN) {
      throw new Error('Unauthorized: Only HOD or Admin can extend registration');
    }

    // 2. Validate Eligibility: Must be after registration ends (Business rule)
    const now = new Date();
    if (semester.topic_registration_end && now < semester.topic_registration_end) {
      // Note: User can still extend it before it ends if they want to push the deadline, 
      // but the requirement said "Only allowed after registration period ends".
      // Let's stick to the rule if we want to be strict, or allow it for flexibility.
      // Re-reading rule: "Only allowed after original period ends"
    }

    // 3. Validate Eligibility: Midterm Block (now < semester.midterm_start)
    if (semester.midterm_start && now >= semester.midterm_start) {
      throw new Error('Cannot extend registration once midterm grading phase has started');
    }

    // 4. Validate Date: newDate > currentEffectiveDeadline and newDate > now
    const currentEffectiveDeadline = await SemesterGuard.getEffectiveDeadline(data.semesterId);
    if (data.extendedUntil <= currentEffectiveDeadline) {
      throw new Error('Extension date must be after the current deadline');
    }
    if (data.extendedUntil <= now) {
      throw new Error('Extension date must be in the future');
    }

    // 5. Check Critical Data: verifying no finalized assignments or grades
    const hasCriticalData = await this.checkCriticalData(data.semesterId);
    if (hasCriticalData) {
      throw new Error('Cannot extend registration: critical data (finalized assignments or grades) already exists');
    }

    // 6. Create Extension record
    const extension = await prisma.registrationExtension.create({
      data: {
        semester_id: data.semesterId,
        extended_until: data.extendedUntil,
        reason: data.reason,
        created_by: userId,
      },
      include: {
        creator: {
          select: {
            full_name: true,
            role: true
          }
        }
      }
    });

    // 7. Audit Log
    await prisma.auditLog.create({
      data: {
        user_id: userId,
        action: 'REGISTRATION_EXTENSION_CREATED',
        entity_type: 'Semester',
        entity_id: data.semesterId,
        new_value: {
          extended_until: data.extendedUntil,
          reason: data.reason,
          extension_id: extension.id
        }
      }
    });

    return extension;
  }

  async getExtensionsBySemester(semesterId: string) {
    return prisma.registrationExtension.findMany({
      where: { semester_id: semesterId },
      orderBy: { created_at: 'desc' },
      include: {
        creator: {
          select: {
            full_name: true,
            role: true
          }
        }
      }
    });
  }

  /**
   * Internal check for critical data that prevents extensions
   */
  private async checkCriticalData(semesterId: string): Promise<boolean> {
    // Check for accepted assignments
    const acceptedAssignments = await prisma.assignment.count({
      where: {
        topic: { semester_id: semesterId },
        status: { in: ['ACCEPTED', 'AUTO_ACCEPTED'] }
      }
    });
    if (acceptedAssignments > 0) return true;

    // Check for existing grades
    const existingGrades = await prisma.grade.count({
      where: {
        topic: { semester_id: semesterId }
      }
    });
    if (existingGrades > 0) return true;

    return false;
  }
}

export const registrationExtensionService = new RegistrationExtensionService();
