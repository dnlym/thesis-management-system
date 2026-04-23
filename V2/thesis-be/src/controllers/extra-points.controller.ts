import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import extraPointsService from '../services/extra-points.service';
import { ExtraPointStatus } from '@prisma/client';

/**
 * @swagger
 * tags:
 *   name: ExtraPoints
 *   description: Extra points management
 */
export class ExtraPointsController {
  /**
   * @swagger
   * /extra-points:
   *   post:
   *     summary: Submit an extra points request
   *     tags: [ExtraPoints]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - topicId
   *               - description
   *               - proofUrl
   *             properties:
   *               topicId:
   *                 type: string
   *               description:
   *                 type: string
   *               proofUrl:
   *                 type: string
   *     responses:
   *       201:
   *         description: Request submitted successfully
   *       400:
   *         description: Bad request
   */
  async submitRequest(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const request = await extraPointsService.submitRequest(userId, req.body);
      res.status(201).json({
        success: true,
        data: request,
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
   * /extra-points/{requestId}/approve:
   *   put:
   *     summary: Approve an extra points request
   *     tags: [ExtraPoints]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: requestId
   *         schema:
   *           type: string
   *         required: true
   *         description: Request ID
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - approvedPoints
   *             properties:
   *               approvedPoints:
   *                 type: number
   *     responses:
   *       200:
   *         description: Request approved successfully
   *       400:
   *         description: Bad request
   */
  async approveRequest(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const requestId = req.params.requestId as string;
      const { approvedPoints } = req.body;
      const result = await extraPointsService.approveRequest(userId, requestId, approvedPoints);
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
   * /extra-points/{requestId}/reject:
   *   put:
   *     summary: Reject an extra points request
   *     tags: [ExtraPoints]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: requestId
   *         schema:
   *           type: string
   *         required: true
   *         description: Request ID
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - rejectionReason
   *             properties:
   *               rejectionReason:
   *                 type: string
   *     responses:
   *       200:
   *         description: Request rejected successfully
   *       400:
   *         description: Bad request
   */
  async rejectRequest(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const requestId = req.params.requestId as string;
      const { rejectionReason } = req.body;
      const result = await extraPointsService.rejectRequest(userId, requestId, rejectionReason);
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
   * /extra-points:
   *   get:
   *     summary: Get extra points requests
   *     tags: [ExtraPoints]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: query
   *         name: topicId
   *         schema:
   *           type: string
   *       - in: query
   *         name: status
   *         schema:
   *           type: string
   *           enum: [PENDING, APPROVED, REJECTED, WITHDRAWN]
   *     responses:
   *       200:
   *         description: Requests retrieved successfully
   *       400:
   *         description: Bad request
   */
  async getRequests(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const filters = {
        topicId: req.query.topicId as string,
        status: req.query.status as ExtraPointStatus,
      };
      const requests = await extraPointsService.getRequests(userId, filters);
      res.json({
        success: true,
        data: requests,
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
   * /extra-points/{requestId}:
   *   get:
   *     summary: Get extra points request by ID
   *     tags: [ExtraPoints]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: requestId
   *         schema:
   *           type: string
   *         required: true
   *         description: Request ID
   *     responses:
   *       200:
   *         description: Request retrieved successfully
   *       404:
   *         description: Request not found
   */
  async getRequestById(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const requestId = req.params.requestId as string;
      const request = await extraPointsService.getRequestById(userId, requestId);
      res.json({
        success: true,
        data: request,
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
   * /extra-points/{requestId}/withdraw:
   *   put:
   *     summary: Withdraw an extra points request
   *     tags: [ExtraPoints]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: requestId
   *         schema:
   *           type: string
   *         required: true
   *         description: Request ID
   *     responses:
   *       200:
   *         description: Request withdrawn successfully
   *       400:
   *         description: Bad request
   */
  async withdrawRequest(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const requestId = req.params.requestId as string;
      const result = await extraPointsService.withdrawRequest(userId, requestId);
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
   * Confirm that student has no extra points (no research achievements)
   */
  async confirmNoExtraPoints(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const { topicId } = req.body;
      const result = await extraPointsService.confirmNoExtraPoints(userId, topicId);
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

  async uploadEvidence(req: AuthRequest, res: Response) {
    try {
      const file = req.file;
      if (!file) {
        return res.status(400).json({ success: false, error: 'No file uploaded' });
      }

      const result = await extraPointsService.uploadEvidence(file);
      res.status(201).json({ success: true, data: result });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message });
    }
  }

  /**
   * Get student's extra points confirmation status for a topic
   */
  async getMyExtraPointsStatus(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const topicId = req.params.topicId as string;
      const result = await extraPointsService.getMyExtraPointsStatus(userId, topicId);
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
}

export default new ExtraPointsController();
