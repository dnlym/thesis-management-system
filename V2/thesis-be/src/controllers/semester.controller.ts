import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import semesterService from '../services/semester.service';
import { AcademicPolicy } from '../utils/academic-policy';
import prisma from '../config/database';
import { UserRole } from '@prisma/client';

/**
 * @swagger
 * tags:
 *   name: Semester
 *   description: Semester management
 */
export class SemesterController {
  /**
   * @swagger
   * /semesters:
   *   post:
   *     summary: Create a new semester
   *     tags: [Semester]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - code
   *               - year
   *               - startDate
   *               - endDate
   *             properties:
   *               code:
   *                 type: string
   *               year:
   *                 type: string
   *               startDate:
   *                 type: string
   *                 format: date
   *               endDate:
   *                 type: string
   *                 format: date
   *     responses:
   *       201:
   *         description: Semester created successfully
   *       400:
   *         description: Bad request
   */
  async createSemester(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const semester = await semesterService.createSemester(userId, req.body);
      res.status(201).json({
        success: true,
        data: semester,
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        error: error.message,
      });
    }
  }

  /**
   * @swagger
   * /semesters/{semesterId}:
   *   put:
   *     summary: Update a semester
   *     tags: [Semester]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: semesterId
   *         schema:
   *           type: string
   *         required: true
   *         description: Semester ID
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               code:
   *                 type: string
   *               year:
   *                 type: string
   *               startDate:
   *                 type: string
   *                 format: date
   *               endDate:
   *                 type: string
   *                 format: date
   *     responses:
   *       200:
   *         description: Semester updated successfully
   *       400:
   *         description: Bad request
   */
  async updateSemester(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const semesterId = req.params.semesterId as string;
      const semester = await semesterService.updateSemester(userId, semesterId, req.body);
      res.json({
        success: true,
        data: semester,
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        error: error.message,
      });
    }
  }

  /**
   * @swagger
   * /semesters:
   *   get:
   *     summary: Get all semesters
   *     tags: [Semester]
   *     responses:
   *       200:
   *         description: Semesters retrieved successfully
   *       400:
   *         description: Bad request
   */
  async getSemesters(req: AuthRequest, res: Response) {
    try {
      const semesters = await semesterService.getSemesters();
      res.json({
        success: true,
        data: semesters,
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        error: error.message,
      });
    }
  }

  /**
   * @swagger
   * /semesters/active:
   *   get:
   *     summary: Get active semester
   *     tags: [Semester]
   *     responses:
   *       200:
   *         description: Active semester retrieved successfully
   *       404:
   *         description: Active semester not found
   */
  async getActiveSemester(req: AuthRequest, res: Response) {
    try {
      const semester = await semesterService.getActiveSemester();
      if (!semester) {
        return res.status(404).json({
          success: false,
          error: 'NO_ACTIVE_SEMESTER',
          message: 'Không tìm thấy học kỳ hoạt động.',
        });
      }

      // Resolve user context
      const user = req.user;
      if (!user) {
        return res.status(401).json({
          success: false,
          error: 'UNAUTHORIZED',
          message: 'Yêu cầu đăng nhập để lấy thông tin học kỳ.',
        });
      }

      // Resolve student registration if applicable
      let registration = null;
      if (user.role === UserRole.STUDENT) {
        registration = await prisma.topicRegistration.findFirst({
          where: {
            student_id: user.id,
            semester_id: semester.id,
          },
        });
      }

      // Calculate allowed actions for the UI
      const allowedActions = AcademicPolicy.getAllAllowedActions(
        { id: user.id, role: user.role as UserRole },
        semester,
        registration
      );

      res.json({
        success: true,
        data: {
          ...semester,
          allowedActions,
        },
      });
    } catch (error: any) {
      console.error('[SemesterController] Error in getActiveSemester:', error);
      res.status(500).json({
        success: false,
        error: 'INTERNAL_SERVER_ERROR',
        message: 'Lỗi khi tải thông tin học kỳ.',
      });
    }
  }

  /**
   * @swagger
   * /semesters/{semesterId}:
   *   get:
   *     summary: Get semester by ID
   *     tags: [Semester]
   *     parameters:
   *       - in: path
   *         name: semesterId
   *         schema:
   *           type: string
   *         required: true
   *         description: Semester ID
   *     responses:
   *       200:
   *         description: Semester retrieved successfully
   *       404:
   *         description: Semester not found
   */
  async getSemesterById(req: AuthRequest, res: Response) {
    try {
      const semesterId = req.params.semesterId as string;
      const semester = await semesterService.getSemesterById(semesterId);
      res.json({
        success: true,
        data: semester,
      });
    } catch (error: any) {
      res.status(404).json({
        success: false,
        error: error.message,
      });
    }
  }

  /**
   * @swagger
   * /semesters/{semesterId}/activate:
   *   put:
   *     summary: Set active semester
   *     tags: [Semester]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: semesterId
   *         schema:
   *           type: string
   *         required: true
   *         description: Semester ID
   *     responses:
   *       200:
   *         description: Semester activated successfully
   *       400:
   *         description: Bad request
   */
  async setActiveSemester(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const role = req.user!.role;
      const semesterId = req.params.semesterId as string;
      const semester = await semesterService.setActiveSemester(userId, role, semesterId);
      res.json({
        success: true,
        data: semester,
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        error: error.message,
      });
    }
  }

  async finalizeSemester(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const semesterId = req.params.semesterId as string;
      const semester = await semesterService.finalizeSemester(userId, semesterId);
      res.json({
        success: true,
        data: semester,
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        error: error.message,
      });
    }
  }

  async updateDefenseDate(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const id = req.params.id as string;
      const { defense_start } = req.body;
      if (!defense_start) {
        throw new Error('defense_start is required');
      }
      const semester = await semesterService.updateDefenseDate(userId, id, new Date(defense_start));
      res.json({
        success: true,
        data: semester,
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        error: error.message,
      });
    }
  }

  async toggleRegistrationOverride(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const semesterId = req.params.semesterId as string;
      const { override, reason } = req.body;

      const semester = await semesterService.toggleRegistrationOverride(userId, semesterId, override, reason);

      res.json({
        success: true,
        data: semester,
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        error: error.message,
      });
    }
  }

  async getOverrideLogs(req: AuthRequest, res: Response) {
    try {
      const semesterId = req.params.semesterId as string;
      const logs = await prisma.auditLog.findMany({
        where: {
          entity_type: 'Semester',
          entity_id: semesterId,
          action: {
            in: ['REGISTRATION_OVERRIDE_ENABLED', 'REGISTRATION_OVERRIDE_DISABLED']
          }
        },
        include: {
          user: {
            select: {
              full_name: true,
              role: true
            }
          }
        },
        orderBy: {
          created_at: 'desc'
        }
      });

      res.json({
        success: true,
        data: logs,
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        error: error.message,
      });
    }
  }
}

export default new SemesterController();
