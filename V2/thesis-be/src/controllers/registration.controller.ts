import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import registrationService from '../services/registration.service';
import { RegistrationStatus, StudentProgressStatus } from '@prisma/client';

/**
 * @swagger
 * tags:
 *   name: Registration
 *   description: Topic Registration (Individual Flow)
 */
export class RegistrationController {
  // =====================================================
  // NEW FLOW: Individual registration (topic first, then group)
  // =====================================================

  /**
   * @swagger
   * /registrations/topic/{topicId}:
   *   post:
   *     summary: Register for a topic individually
   *     tags: [Registration]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: topicId
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: Registered successfully
   */
  async registerTopicIndividual(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const topicId = req.params.topicId as string;
      const { accepted } = req.body;
      const registration = await registrationService.registerTopicIndividual(userId, topicId, accepted);
      res.json({
        success: true,
        data: registration,
        message: 'Đăng ký đề tài thành công',
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
   * /registrations/register-for-student:
   *   post:
   *     summary: GVHD registers a topic on behalf of a student
   *     tags: [Registration]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - studentId
   *               - topicId
   *             properties:
   *               studentId:
   *                 type: string
   *               topicId:
   *                 type: string
   *     responses:
   *       200:
   *         description: Registered successfully
   */
  async registerTopicForStudent(req: AuthRequest, res: Response) {
    try {
      const supervisorId = req.user!.id;
      const { studentId, topicId } = req.body;
      const registration = await registrationService.registerTopicForStudent(supervisorId, studentId, topicId);
      res.status(201).json({
        success: true,
        data: registration,
        message: 'Đã đăng ký đề tài cho sinh viên thành công',
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
   * /registrations/my-topic:
   *   get:
   *     summary: Get current user's topic registration
   *     tags: [Registration]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: Registration retrieved
   */
  async getMyTopicRegistration(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const registration = await registrationService.getMyTopicRegistration(userId);
      res.json({
        success: true,
        data: registration,
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
   * /registrations/topic/{topicId}/students:
   *   get:
   *     summary: Get students registered for the same topic
   *     tags: [Registration]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: topicId
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: Students list retrieved
   */
  async getStudentsSameTopic(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const topicId = req.params.topicId as string;
      const result = await registrationService.getStudentsSameTopic(userId, topicId);
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
   * @swagger
   * /registrations/topic/{topicId}/create-group:
   *   post:
   *     summary: Create a group with another student
   *     tags: [Registration]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: topicId
   *         required: true
   *         schema:
   *           type: string
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - partnerId
   *             properties:
   *               partnerId:
   *                 type: string
   *     responses:
   *       200:
   *         description: Group created successfully
   */
  async createGroupInTopic(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const topicId = req.params.topicId as string;
      const { partnerId } = req.body;
      const group = await registrationService.createGroupInTopic(userId, topicId, partnerId);
      res.json({
        success: true,
        data: group,
        message: 'Đã lập nhóm thành công',
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
   * /registrations/my-topic:
   *   delete:
   *     summary: Cancel individual registration
   *     tags: [Registration]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: Registration cancelled
   */
  async cancelIndividualRegistration(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const result = await registrationService.cancelIndividualRegistration(userId);
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

  // =====================================================
  // SHARED METHODS
  // =====================================================

  /**
   * @swagger
   * /registrations:
   *   get:
   *     summary: Get registrations
   *     tags: [Registration]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: query
   *         name: status
   *         schema:
   *           type: string
   *           enum: [PENDING, GROUPED, CONFIRMED, REJECTED, CANCELLED]
   *       - in: query
   *         name: semesterId
   *         schema:
   *           type: string
   *       - in: query
   *         name: topicId
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: Registrations retrieved successfully
   */
  async getRegistrations(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const filters = {
        status: req.query.status as RegistrationStatus,
        semesterId: req.query.semesterId as string,
        topicId: req.query.topicId as string,
      };
      const registrations = await registrationService.getRegistrations(userId, filters);
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
   * /registrations/{registrationId}:
   *   get:
   *     summary: Get registration by ID
   *     tags: [Registration]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: registrationId
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: Registration retrieved successfully
   */
  async getRegistrationById(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const registrationId = req.params.registrationId as string;
      const registration = await registrationService.getRegistrationById(userId, registrationId);
      res.json({
        success: true,
        data: registration,
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
   * /registrations/{registrationId}/progress:
   *   put:
   *     summary: Update student progress status
   *     tags: [Registration]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: registrationId
   *         required: true
   *         schema:
   *           type: string
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
   *               feedback:
   *                 type: string
   *     responses:
   *       200:
   *         description: Progress updated successfully
   */
  async updateProgress(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const registrationId = req.params.registrationId as string;
      const { status, feedback } = req.body;
      const result = await registrationService.updateProgress(userId, registrationId, status as StudentProgressStatus, feedback);
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
   * @swagger
   * /registrations/{registrationId}/logs:
   *   get:
   *     summary: Get registration activity logs
   *     tags: [Registration]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: registrationId
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: Logs retrieved successfully
   */
  async getRegistrationLogs(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const registrationId = req.params.registrationId as string;
      const logs = await registrationService.getRegistrationLogs(userId, registrationId);
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

  // =====================================================
  // GROUP INVITE SYSTEM
  // =====================================================

  /**
   * Search student by MSSV for invite
   */
  async searchStudentForInvite(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const topicId = req.params.topicId as string;
      const { studentCode } = req.query;

      if (!studentCode || typeof studentCode !== 'string') {
        return res.status(400).json({
          success: false,
          error: 'Vui lòng nhập mã sinh viên',
        });
      }

      const student = await registrationService.searchStudentForInvite(userId, topicId, studentCode);

      res.json({
        success: true,
        data: student,
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        error: error.message,
      });
    }
  }

  /**
   * Send group invite
   */
  async sendGroupInvite(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const topicId = req.params.topicId as string;
      const { studentCode } = req.body;

      if (!studentCode) {
        return res.status(400).json({
          success: false,
          error: 'Vui lòng nhập mã sinh viên',
        });
      }

      const invite = await registrationService.sendGroupInvite(userId, topicId, studentCode);

      res.json({
        success: true,
        data: invite,
        message: 'Đã gửi lời mời',
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        error: error.message,
      });
    }
  }

  /**
   * Get my invites (sent and received)
   */
  async getMyInvites(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const { topicId } = req.query;

      const invites = await registrationService.getMyInvites(userId, topicId as string | undefined);

      res.json({
        success: true,
        data: invites,
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        error: error.message,
      });
    }
  }

  /**
   * Accept an invite
   */
  async acceptInvite(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const inviteId = req.params.inviteId as string;

      const group = await registrationService.acceptInvite(userId, inviteId);

      res.json({
        success: true,
        data: group,
        message: 'Đã chấp nhận lời mời và tạo nhóm',
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        error: error.message,
      });
    }
  }

  /**
   * Reject an invite
   */
  async rejectInvite(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const inviteId = req.params.inviteId as string;

      await registrationService.rejectInvite(userId, inviteId);

      res.json({
        success: true,
        message: 'Đã từ chối lời mời',
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        error: error.message,
      });
    }
  }

  /**
   * Cancel an invite I sent
   */
  async cancelInvite(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const inviteId = req.params.inviteId as string;

      await registrationService.cancelInvite(userId, inviteId);

      res.json({
        success: true,
        message: 'Đã hủy lời mời',
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        error: error.message,
      });
    }
  }

  /**
   * Disband my group
   */
  async disbandGroup(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.id;

      const result = await registrationService.disbandGroup(userId);

      res.json({
        success: true,
        message: result.message,
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        error: error.message,
      });
    }
  }
}

export default new RegistrationController();
