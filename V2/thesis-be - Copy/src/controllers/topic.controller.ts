import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import topicService from '../services/topic.service';

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
  async requireEdit(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const topicId = req.params.topicId as string;
      const { notes } = req.body;
      const result = await topicService.requireEdit(userId, { topicId, editNotes: notes });
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
      const filters = {
        status: req.query.status as any,
        semesterId: req.query.semesterId as string,
        departmentId: req.query.departmentId as string,
        search: req.query.search as string,
        supervisorId: req.query.supervisorId as string,
        midtermStatus: req.query.midtermStatus as 'PASS' | 'FAIL' | undefined,
      };
      const topics = await topicService.getTopics(userId, filters);
      res.json({
        success: true,
        data: topics,
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
   *   get:
   *     summary: Get topic by ID
   *     tags: [Topic]
   */
  async getTopicById(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const topicId = req.params.topicId as string;
      const topic = await topicService.getTopicById(userId, topicId);
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
}

export default new TopicController();
