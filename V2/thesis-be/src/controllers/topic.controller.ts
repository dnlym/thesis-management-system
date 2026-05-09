import { Response } from 'express';
import { TopicStatus, ProgressStage, UserRole } from '@prisma/client';
import { AuthRequest } from '../middleware/auth.middleware';
import topicService from '../services/topic.service';
import { SemesterResolver } from '../utils/semester-resolver';
import prisma from '../config/database';
import { AcademicPolicy, AcademicAction } from '../utils/academic-policy';

/**
 * @swagger
 * tags:
 *   name: Topic
 *   description: Topic management
 */
export class TopicController {
  /**
   * @swagger
   * /topics:
   *   post:
   *     summary: Create a new topic
   *     tags: [Topic]
   */
  async createTopic(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const topic = await topicService.createTopic(userId, req.body);
      res.status(201).json({
        success: true,
        data: topic,
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        error: error.message,
        message: error.message,
      });
    }
  }

  /**
   * @swagger
   * /topics/{topicId}:
   *   put:
   *     summary: Update a topic
   *     tags: [Topic]
   */
  async updateTopic(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const topicId = req.params.topicId as string;
      const topic = await topicService.updateTopic(userId, topicId, req.body);
      res.json({
        success: true,
        data: topic,
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        error: error.message,
        message: error.message,
      });
    }
  }

  /**
   * @swagger
   * /topics/{topicId}/submit:
   *   put:
   *     summary: Submit a topic for approval
   *     tags: [Topic]
   */
  async submitForApproval(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const topicId = req.params.topicId as string;
      const result = await topicService.submitForApproval(userId, topicId);
      res.json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        error: error.message,
        message: error.message,
      });
    }
  }

  /**
   * @swagger
   * /topics/{topicId}/approve:
   *   put:
   *     summary: Approve a topic
   *     tags: [Topic]
   */
  async approveTopic(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const topicId = req.params.topicId as string;
      const result = await topicService.approveTopic(userId, topicId);
      res.json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        error: error.message,
        message: error.message,
      });
    }
  }

  /**
   * @swagger
   * /topics/{topicId}/reject:
   *   put:
   *     summary: Reject a topic
   *     tags: [Topic]
   */
  async rejectTopic(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const topicId = req.params.topicId as string;
      const { rejectionReason } = req.body;
      const result = await topicService.rejectTopic(userId, { topicId, rejectionReason });
      res.json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        error: error.message,
        message: error.message,
      });
    }
  }

  /**
   * @swagger
   * /topics/{topicId}/require-edit:
   *   put:
   *     summary: Request topic edits (HEAD only)
   *     tags: [Topic]
   */
  async requestRevision(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const topicId = req.params.topicId as string;
      const { notes } = req.body;
      const result = await topicService.requestRevision(userId, { topicId, editNotes: notes });
      res.json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        error: error.message,
        message: error.message,
      });
    }
  }

  /**
   * @swagger
   * /topics:
   *   get:
   *     summary: Get topics
   *     tags: [Topic]
   */
  async getTopics(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const includeAll = req.query.includeAll === 'true';
      const inputSemesterId = req.query.semesterId as string | undefined;

      // [CONTROLLER RESOLUTION] Xác định học kỳ tại cửa ngõ - chỉ query DB 1 lần
      // Admin/includeAll: không bắt buộc có semester
      // Các role khác: nếu không có ACTIVE semester → throw lỗi rõ ràng
      const resolvedSemesterId = includeAll
        ? await SemesterResolver.resolveForAdmin(inputSemesterId)
        : await SemesterResolver.resolve(inputSemesterId, { required: !req.query.status });

      const filters = {
        status: req.query.status as any,
        semesterId: resolvedSemesterId || undefined,
        departmentId: req.query.departmentId as string,
        search: req.query.search as string,
        supervisorId: req.query.supervisorId as string,
        includeAll,
        midtermStatus: req.query.midtermStatus as 'PASS' | 'FAIL' | undefined,
        page: req.query.page ? parseInt(req.query.page as string) : undefined,
        limit: req.query.size ? parseInt(req.query.size as string) : undefined,
      };
      const topics = await topicService.getTopics(userId, filters);
      res.json({
        success: true,
        data: topics,
      });
    } catch (error: any) {
      res.status(error.statusCode || 400).json({
        success: false,
        error: error.error || 'BAD_REQUEST',
        message: error.message,
      });
    }
  }

  /**
   * Clone a topic into the active semester
   */
  async cloneTopic(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const topicId = req.params.topicId as string;
      const { semesterId } = req.body;

      if (!semesterId) {
        throw new Error('Semester ID is required for cloning');
      }

      const topic = await topicService.cloneTopic(userId, topicId, semesterId);
      res.status(201).json({
        success: true,
        data: topic,
        message: 'Sao chép đề tài thành công',
      });
    } catch (error: any) {
      res.status(error.statusCode || 400).json({
        success: false,
        error: error.error || 'BAD_REQUEST',
        message: error.message,
      });
    }
  }

  /**
   * @swagger
   * /topics/{topicId}:
   *   get:
   *     summary: Get topic by ID
   *     tags: [Topic]
   */
  async getTopicById(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const topicId = req.params.topicId as string;
      const groupId = req.query.groupId as string | undefined;
      const topic = await topicService.getTopicById(userId, topicId, groupId);
      
      // Calculate allowed actions for the UI
      const user = await prisma.user.findUnique({ where: { id: userId } });
      const semester = await prisma.semester.findUnique({ 
        where: { id: (topic as any).semester_id } 
      });

      if (semester && user) {
        // Fetch Department-specific config for the user's department
        const deptConfig = await prisma.departmentSemesterConfig.findUnique({
          where: {
            department_id_semester_id: {
              department_id: user.departmentId!,
              semester_id: semester.id
            }
          }
        });
        (semester as any).deptConfig = deptConfig;

        // Fetch user's assignments for this topic
        const userAssignments = await prisma.assignment.findMany({
          where: {
            topic_id: topicId,
            reviewer_id: userId,
            status: { in: ['ACCEPTED', 'AUTO_ACCEPTED'] }
          }
        });

        const registration = (topic as any).registrations?.[0];
        const allActions = AcademicPolicy.getAllAllowedActions(
          { id: userId, role: user.role as any },
          semester,
          registration
        );

        // EXTRA GUARD: Even if AcademicPolicy allows it based on Phase, 
        // we block it if there is no accepted assignment (for Reviewer/Committee)
        const isSupervisorOfTopic = (topic as any).supervisor_id === userId;
        const hasAcceptedReviewerAssignment = userAssignments.some(a => a.assignment_type === 'REVIEWER');
        const hasAcceptedCommitteeAssignment = userAssignments.some(a => a.assignment_type === 'COMMITTEE');

        if (!isSupervisorOfTopic) {
          allActions[AcademicAction.GRADE_SUPERVISOR].allowed = false;
          allActions[AcademicAction.GRADE_SUPERVISOR].reason = 'Bạn không phải giảng viên hướng dẫn đề tài này.';
        }

        if (!hasAcceptedReviewerAssignment) {
          allActions[AcademicAction.GRADE_REVIEWER].allowed = false;
          allActions[AcademicAction.GRADE_REVIEWER].reason = 'Bạn không có phân công phản biện đã chấp nhận cho đề tài này.';
        }

        if (!hasAcceptedCommitteeAssignment) {
          allActions[AcademicAction.GRADE_COMMITTEE].allowed = false;
          allActions[AcademicAction.GRADE_COMMITTEE].reason = 'Bạn không có phân công hội đồng đã chấp nhận cho đề tài này.';
        }

        (topic as any).allowedActions = allActions;
      }

      res.json({
        success: true,
        data: topic,
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
   * /topics/{topicId}:
   *   delete:
   *     summary: Delete a topic
   *     tags: [Topic]
   */
  async deleteTopic(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const topicId = req.params.topicId as string;
      const result = await topicService.deleteTopic(userId, topicId);
      res.json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        error: error.message,
        message: error.message,
      });
    }
  }

  /**
   * Hide a topic (supervisor can hide their own topics)
   */
  async hideTopic(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const topicId = req.params.topicId as string;
      const topic = await topicService.hideTopic(userId, topicId);
      res.json({
        success: true,
        data: topic,
        message: 'Đã ẩn đề tài',
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        error: error.message,
        message: error.message,
      });
    }
  }

  /**
   * Unhide a topic (restore to previous status)
   */
  async unhideTopic(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const topicId = req.params.topicId as string;
      const topic = await topicService.unhideTopic(userId, topicId);
      res.json({
        success: true,
        data: topic,
        message: 'Đã hiện đề tài',
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        error: error.message,
        message: error.message,
      });
    }
  }

  /**
   * Get topic approval history
   */
  async getApprovalHistory(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const topicId = req.params.topicId as string;
      const history = await topicService.getTopicApprovalHistory(userId, topicId);
      res.json({
        success: true,
        data: history,
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        error: error.message,
        message: error.message,
      });
    }
  }

  async getTopicStats(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const stats = await topicService.getTopicStats(userId);
      res.json({
        success: true,
        data: stats,
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        error: error.message,
        message: error.message,
      });
    }
  }

  /**
   * Respond to interdisciplinary co-supervisor invitation
   */
  async respondToInterdisciplinaryInvite(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const topicId = req.params.topicId as string;
      const { status } = req.body;
      const result = await topicService.respondToInterdisciplinaryInvite(userId, topicId, status);
      res.json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        error: error.message,
        message: error.message,
      });
    }
  }
  /**
   * Finalize the defense eligibility and type (HOD only)
   */
  async finalizeDefensePivot(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const topicId = req.params.topicId as string;
      const { isEligible, defenseType } = req.body;

      const topic = await topicService.finalizeDefensePivot(userId, topicId, {
        isEligible,
        defenseType,
      });

      res.json({
        success: true,
        data: topic,
        message: isEligible ? 'Đã duyệt đủ điều kiện bảo vệ' : 'Đã chốt đề tài không đủ điều kiện bảo vệ',
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        error: error.message,
        message: error.message,
      });
    }
  }
}

export default new TopicController();
