import { Response } from 'express';
import { AuthRequest } from '../types';
import gradingService from '../services/grading.service';
import { RaterRole, MidtermStatus } from '@prisma/client';
import prisma from '../config/database';
import { SemesterResolver } from '../utils/semester-resolver';

class GradingController {
  /**
   * @swagger
   * /grading/topics/{topicId}/grades:
   *   post:
   *     summary: Submit grades for a topic
   *     tags: [Grading]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: topicId
   *         schema:
   *           type: string
   *         required: true
   *         description: Topic ID
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - topicId
   *               - raterRole
   *               - criteria
   *             properties:
   *               topicId:
   *                 type: string
   *               raterRole:
   *                 type: string
   *                 enum: [ADVISOR, REVIEWER, COUNCIL_MEMBER]
   *               criteria:
   *                 type: array
   *                 items:
   *                   type: object
   *                   properties:
   *                     criterionId:
   *                       type: string
   *                     score:
   *                       type: number
   *     responses:
   *       201:
   *         description: Grades submitted successfully
   *       400:
   *         description: Bad request
   */
  async submitGrade(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.id;
      let { raterRole, topicId } = req.body;
      let resolvedTopicId = topicId;

      // [RESOLUTION STRATEGY] Try to resolve the actual Topic ID from various possible input IDs
      const group = await prisma.group.findUnique({
        where: { id: topicId },
        select: { id: true, topic_id: true }
      });
  
      if (group && group.topic_id) {
        resolvedTopicId = group.topic_id;
      } else {
        const assignment = await prisma.assignment.findUnique({
          where: { id: topicId },
          select: { topic_id: true }
        });
        if (assignment && assignment.topic_id) {
          resolvedTopicId = assignment.topic_id;
        }
      }

      // Map generic frontend role names to exact Prisma RaterRole enum values
      if (raterRole === 'ADVISOR') {
        raterRole = RaterRole.SUPERVISOR;
      } else if (raterRole === 'REVIEWER') {
        // Auto-detect reviewer order from assignment
        const assignment = await prisma.assignment.findFirst({
          where: {
            topic_id: resolvedTopicId,
            reviewer_id: userId,
            assignment_type: 'REVIEWER',
            status: { in: ['ACCEPTED', 'AUTO_ACCEPTED', 'PENDING'] },
          },
        });
        if (assignment?.reviewer_order === 1) raterRole = RaterRole.REVIEWER_1;
        else if (assignment?.reviewer_order === 2) raterRole = RaterRole.REVIEWER_2;
        else if (assignment?.reviewer_order === 3) raterRole = RaterRole.REVIEWER_3;
        else raterRole = RaterRole.REVIEWER_1; // fallback
      } else if (raterRole === 'COUNCIL_MEMBER' || raterRole === 'COMMITTEE') {
        // Auto-detect committee role from assignment
        const assignment = await prisma.assignment.findFirst({
          where: {
            topic_id: resolvedTopicId,
            reviewer_id: userId,
            assignment_type: 'COMMITTEE',
            status: { in: ['AUTO_ACCEPTED', 'ACCEPTED', 'PENDING'] },
          },
        });
        if (assignment?.committee_role === 'CHAIR') raterRole = RaterRole.COMMITTEE_CHAIR;
        else if (assignment?.committee_role === 'SECRETARY') raterRole = RaterRole.COMMITTEE_SECRETARY;
        else if (assignment?.committee_role === 'MEMBER_1') raterRole = RaterRole.COMMITTEE_MEMBER_1;
        else if (assignment?.committee_role === 'MEMBER_2') raterRole = RaterRole.COMMITTEE_MEMBER_2;
        else raterRole = RaterRole.COMMITTEE_MEMBER;
      }

      const grades = await gradingService.submitGrade(userId, req.body, raterRole as RaterRole);
      res.status(201).json({
        success: true,
        data: grades,
      });
    } catch (error: any) {
      console.error('\n=== SUBMIT GRADE ERROR ===\n', error.message, error.stack, '\n==========================\n');
      res.status(400).json({
        success: false,
        error: error.message,
      });
    }
  }

  /**
   * @swagger
   * /grading/topics/{topicId}/compute:
   *   post:
   *     summary: Compute final score for a topic
   *     tags: [Grading]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: topicId
   *         schema:
   *           type: string
   *         required: true
   *         description: Topic ID
   *     responses:
   *       200:
   *         description: Final score computed successfully
   *       400:
   *         description: Bad request
   */
  async computeFinalScore(req: AuthRequest, res: Response) {
    try {
      const topicId = req.params.topicId as string;
      const finalScore = await gradingService.computeFinalScore(topicId);
      res.json({
        success: true,
        data: finalScore,
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
   * /grading/topics/{topicId}/grades:
   *   get:
   *     summary: Get grades for a topic
   *     tags: [Grading]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: topicId
   *         schema:
   *           type: string
   *         required: true
   *         description: Topic ID
   *     responses:
   *       200:
   *         description: Grades retrieved successfully
   *       400:
   *         description: Bad request
   */
  async getGrades(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const topicId = req.params.topicId as string;
      const grades = await gradingService.getGrades(userId, topicId);
      res.json({
        success: true,
        data: grades,
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        error: error.message,
      });
    }
  }

  async getGradeSummary(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.id;
      // [CONTROLLER RESOLUTION] Resolve học kỳ tại đây - Admin được xem tất cả, còn lại buộc phải có ACTIVE
      const semesterId = await SemesterResolver.resolve(
        req.query.semesterId as string | undefined,
        { required: true }
      );
      const summary = await gradingService.getGradeSummary(userId, semesterId!);
      res.json({ success: true, data: summary });
    } catch (error: any) {
      const status = error.statusCode || (error.message?.includes('FORBIDDEN') ? 403 : 400);
      res.status(status).json({ success: false, error: error.error || error.message });
    }
  }

  /**
   * @swagger
   * /grading/criteria:
   *   post:
   *     summary: Create a grading criterion
   *     tags: [Grading]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - name
   *               - weight
   *               - type
   *             properties:
   *               name:
   *                 type: string
   *               weight:
   *                 type: number
   *               type:
   *                 type: string
   *                 enum: [ADVISOR, REVIEWER, COUNCIL]
   *     responses:
   *       201:
   *         description: Grading criterion created successfully
   *       400:
   *         description: Bad request
   */
  async createGradingCriterion(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const criterion = await gradingService.createGradingCriterion(userId, req.body);
      res.status(201).json({
        success: true,
        data: criterion,
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
   * /grading/criteria/{id}:
   *   put:
   *     summary: Update a grading criterion
   *     tags: [Grading]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         schema:
   *           type: string
   *         required: true
   *         description: Criterion ID
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               name:
   *                 type: string
   *               weight:
   *                 type: number
   *               type:
   *                 type: string
   *                 enum: [ADVISOR, REVIEWER, COUNCIL]
   *     responses:
   *       200:
   *         description: Grading criterion updated successfully
   *       400:
   *         description: Bad request
   *       404:
   *         description: Criterion not found
   */
  async updateGradingCriterion(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const id = req.params.id as string;
      const criterion = await gradingService.updateGradingCriterion(userId, id, req.body);
      res.json({
        success: true,
        data: criterion,
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
   * /grading/criteria/{id}:
   *   delete:
   *     summary: Delete a grading criterion
   *     tags: [Grading]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         schema:
   *           type: string
   *         required: true
   *         description: Criterion ID
   *     responses:
   *       200:
   *         description: Grading criterion deleted successfully
   *       400:
   *         description: Bad request
   *       404:
   *         description: Criterion not found
   */
  async deleteGradingCriterion(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const id = req.params.id as string;
      const criterion = await gradingService.deleteGradingCriterion(userId, id);
      res.json({
        success: true,
        data: criterion,
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
   * /grading/criteria:
   *   get:
   *     summary: Get grading criteria
   *     tags: [Grading]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: query
   *         name: criteriaType
   *         schema:
   *           type: string
   *           enum: [ADVISOR, REVIEWER, COUNCIL]
   *     responses:
   *       200:
   *         description: Grading criteria retrieved successfully
   *       400:
   *         description: Bad request
   */
  async getGradingCriteria(req: AuthRequest, res: Response) {
    try {
      const role = req.query.criteriaType as RaterRole;
      const topicId = req.query.topicId as string;
      const departmentId = req.query.departmentId as string;
      const criteria = await gradingService.getGradingCriteria(role, topicId, departmentId);
      res.json({
        success: true,
        data: criteria,
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        error: error.message,
      });
    }
  }

  // =====================================================
  // UC07: MIDTERM GRADING ENDPOINTS
  // =====================================================

  /**
   * @swagger
   * /grading/midterm:
   *   get:
   *     summary: Get registrations for midterm grading (GVHD only)
   *     tags: [Grading]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: Registrations retrieved successfully
   *       400:
   *         description: Bad request
   */
  async getRegistrationsForMidtermGrading(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const registrations = await gradingService.getRegistrationsForMidtermGrading(userId);
      res.json({
        success: true,
        data: registrations,
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
   * /grading/midterm/{registrationId}:
   *   post:
   *     summary: Update midterm status (PASS/FAIL) - Only GVHD can grade
   *     tags: [Grading]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: registrationId
   *         schema:
   *           type: string
   *         required: true
   *         description: Registration ID
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - status
   *             properties:
   *               status:
   *                 type: string
   *                 enum: [PASS, FAIL]
   *               feedback:
   *                 type: string
   *     responses:
   *       200:
   *         description: Midterm status updated successfully
   *       400:
   *         description: Bad request
   *       403:
   *         description: Only GVHD can grade midterm
   */
  async updateMidtermStatus(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const registrationId = req.params.registrationId as string;
      const { status, feedback } = req.body;

      const result = await gradingService.updateMidtermStatus(userId, registrationId, status as MidtermStatus, feedback);
      res.json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      console.error('Submit Grade Error in Controller:', error.message, error);
      res.status(400).json({
        success: false,
        error: error.message,
      });
    }
  }

  /**
   * Get current user's grades for a topic
   * GET /grading/:topicId/my-grades
   */
  async getMyGrades(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const topicId = req.params.topicId as string;
      let { raterRole } = req.query;

      // Map generic frontend role names to exact Prisma RaterRole enum values
      if (raterRole === 'ADVISOR') {
        raterRole = RaterRole.SUPERVISOR;
      } else if (raterRole === 'REVIEWER') {
        const assignment = await prisma.assignment.findFirst({
          where: {
            topic_id: topicId,
            reviewer_id: userId,
            assignment_type: 'REVIEWER',
            status: { in: ['ACCEPTED', 'AUTO_ACCEPTED', 'PENDING'] },
          },
        });
        if (assignment?.reviewer_order === 1) raterRole = RaterRole.REVIEWER_1;
        else if (assignment?.reviewer_order === 2) raterRole = RaterRole.REVIEWER_2;
        else if (assignment?.reviewer_order === 3) raterRole = RaterRole.REVIEWER_3;
        else raterRole = RaterRole.REVIEWER_1;
      } else if (raterRole === 'COUNCIL_MEMBER' || raterRole === 'COMMITTEE') {
        const assignment = await prisma.assignment.findFirst({
          where: {
            topic_id: topicId,
            reviewer_id: userId,
            assignment_type: 'COMMITTEE',
            status: { in: ['AUTO_ACCEPTED', 'ACCEPTED', 'PENDING'] },
          },
        });
        if (assignment?.committee_role === 'CHAIR') raterRole = RaterRole.COMMITTEE_CHAIR;
        else if (assignment?.committee_role === 'SECRETARY') raterRole = RaterRole.COMMITTEE_SECRETARY;
        else if (assignment?.committee_role === 'MEMBER_1') raterRole = RaterRole.COMMITTEE_MEMBER_1;
        else if (assignment?.committee_role === 'MEMBER_2') raterRole = RaterRole.COMMITTEE_MEMBER_2;
        else raterRole = RaterRole.COMMITTEE_MEMBER;
      }

      const result = await gradingService.getMyGrades(userId, topicId, raterRole as RaterRole);
      res.json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        error: error.message,
      });
    }
  }

  /**
   * Get Grade History
   */
  async getGradeHistory(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const topicId = req.params.topicId as string;
      const { studentId, groupId } = req.query;
      const history = await gradingService.getGradeHistory(
        userId, 
        studentId as string, 
        groupId as string,
        topicId
      );
      res.json({
        success: true,
        data: history
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Get pending grade change requests (HOD only)
   */
  async getPendingGradeChangeRequests(req: AuthRequest, res: Response) {
    try {
      const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
      if (!user) throw new Error('User not found');
      const requests = await gradingService.getPendingGradeChangeRequests(user.departmentId);
      res.json({
        success: true,
        data: requests
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Approve a grade change request (HOD only)
   */
  async approveGradeChangeRequest(req: AuthRequest, res: Response) {
    try {
      const hodId = req.user!.id;
      const requestId = req.params.requestId as string;
      const result = await gradingService.approveGradeChangeRequest(hodId, requestId);
      res.json({
        success: true,
        data: result
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Reject a grade change request (HOD only)
   */
  async rejectGradeChangeRequest(req: AuthRequest, res: Response) {
    try {
      const hodId = req.user!.id;
      const requestId = req.params.requestId as string;
      const { reason } = req.body;
      const result = await gradingService.rejectGradeChangeRequest(hodId, requestId, reason);
      res.json({
        success: true,
        data: result
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }
  /**
   * POST /grading/recompute-all
   * One-time fix: recompute all FinalScore records in the active semester
   * so that stale 0-values from old code get replaced with proper null.
   * HEAD or ADMIN only.
   */
  async recomputeAllFinalScores(req: AuthRequest, res: Response) {
    try {
      // Collect all distinct topic_ids that have FinalScore records
      const distinctTopics = await prisma.finalScore.findMany({
        distinct: ['topic_id'],
        select: { topic_id: true },
      });

      const results: { topicId: string; status: string }[] = [];

      for (const { topic_id } of distinctTopics) {
        try {
          await gradingService.computeFinalScore(topic_id);
          results.push({ topicId: topic_id, status: 'recomputed' });
        } catch (err: any) {
          results.push({ topicId: topic_id, status: `error: ${err.message}` });
        }
      }

      res.json({ success: true, data: { recomputed: results.length, results } });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }
}

export default new GradingController();
