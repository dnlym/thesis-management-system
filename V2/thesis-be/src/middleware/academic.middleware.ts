import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth.middleware';
import { AcademicAction, AcademicPolicy } from '../utils/academic-policy';
import semesterService from '../services/semester.service';
import prisma from '../config/database';
import { UserRole } from '@prisma/client';
import { ERROR_CODES } from '../constants';

/**
 * enforceAcademicAction — Middleware that protects routes based on the academic timeline.
 * -----------------------------------------------------------------------------------
 * It resolves the current semester context and evaluates the action against the policy engine.
 * 
 * @param action The AcademicAction or a function that returns an AcademicAction based on the request.
 */
export const enforceAcademicAction = (action: AcademicAction | ((req: AuthRequest) => AcademicAction)) => {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    // Resolve Dynamic Action early for scope visibility in catch block
    const resolvedAction = typeof action === 'function' ? action(req) : action;

    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: ERROR_CODES.UNAUTHORIZED,
          message: 'User authentication required.',
        });
      }

      // 1. Resolve Semester Context
      // If semesterId is in params/body, use it. Otherwise, use active semester.
      const semesterId = req.params?.semesterId || req.body?.semesterId || req.params?.id;
      let semester;

      if (semesterId) {
        semester = await prisma.semester.findUnique({ where: { id: semesterId } });
      } else {
        semester = await semesterService.getActiveSemester();
      }

      if (!semester) {
        return res.status(404).json({
          success: false,
          error: ERROR_CODES.NOT_FOUND,
          message: 'Không tìm thấy học kỳ hiện tại hoặc học kỳ chỉ định.',
        });
      }

      // 2. Resolve Student Registration Context (if applicable)
      // Only needed for students to check for "Midterm PASS" gates.
      let registration = null;
      if (req.user.role === UserRole.STUDENT) {
        registration = await prisma.topicRegistration.findFirst({
          where: {
            student_id: req.user.id,
            semester_id: semester.id,
          },
        });
      }

      // 3. Evaluate Policy
      const result = AcademicPolicy.canPerform(resolvedAction, req.user, semester, registration);

      if (!result.allowed) {
        return res.status(403).json({
          success: false,
          error: ERROR_CODES.FORBIDDEN,
          message: result.reason,
          code: result.code,
        });
      }

      // Attach context to request for reuse in controllers/services (optional optimization)
      (req as any).academicContext = {
        semester,
        registration,
        phase: (semester as any).calculated_phase,
      };

      next();
    } catch (error: any) {
      console.error(`[AcademicMiddleware] Error enforcing action ${resolvedAction}:`, error);
      res.status(500).json({
        success: false,
        error: 'INTERNAL_SERVER_ERROR',
        message: 'Lỗi khi kiểm tra chính sách học thuật.',
      });
    }
  };
};
