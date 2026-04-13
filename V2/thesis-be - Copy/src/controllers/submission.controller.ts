import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import submissionService from '../services/submission.service';
import { SubmissionType } from '@prisma/client';

/**
 * @swagger
 * tags:
 *   name: Submission
 *   description: Submission management
 */
export class SubmissionController {
  /**
   * @swagger
   * /submissions/upload:
   *   post:
   *     summary: Upload a file
   *     tags: [Submission]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         multipart/form-data:
   *           schema:
   *             type: object
   *             required:
   *               - topicId
   *               - groupId
   *               - type
   *               - file
   *             properties:
   *               topicId:
   *                 type: string
   *               groupId:
   *                 type: string
   *               type:
   *                 type: string
   *                 enum: [PROPOSAL, REPORT, SLIDES, SOURCE_CODE, OTHER]
   *               comments:
   *                 type: string
   *               file:
   *                 type: string
   *                 format: binary
   *     responses:
   *       201:
   *         description: File uploaded successfully
   *       400:
   *         description: Bad request
   */
  async uploadFile(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const { topicId, groupId, type, comments } = req.body;
      const file = req.file;

      if (!file) {
        return res.status(400).json({
          success: false,
          error: 'No file uploaded',
        });
      }

      const submission = await submissionService.uploadFile(
        userId,
        topicId,
        groupId,
        type as SubmissionType,
        file,
        comments
      );

      res.status(201).json({
        success: true,
        data: submission,
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
   * /submissions/{submissionId}/approve:
   *   put:
   *     summary: Approve a submission
   *     tags: [Submission]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: submissionId
   *         schema:
   *           type: string
   *         required: true
   *         description: Submission ID
   *     responses:
   *       200:
   *         description: Submission approved successfully
   *       400:
   *         description: Bad request
   */
  async approveSubmission(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const submissionId = req.params.submissionId as string;
      const result = await submissionService.approveSubmission(userId, submissionId);
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
   * /submissions/{submissionId}/reject:
   *   put:
   *     summary: Reject a submission
   *     tags: [Submission]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: submissionId
   *         schema:
   *           type: string
   *         required: true
   *         description: Submission ID
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
   *         description: Submission rejected successfully
   *       400:
   *         description: Bad request
   */
  async rejectSubmission(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const submissionId = req.params.submissionId as string;
      const { rejectionReason } = req.body;
      const result = await submissionService.rejectSubmission(userId, submissionId, rejectionReason);
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
   * /submissions/{submissionId}/lock:
   *   put:
   *     summary: Lock a submission
   *     tags: [Submission]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: submissionId
   *         schema:
   *           type: string
   *         required: true
   *         description: Submission ID
   *     responses:
   *       200:
   *         description: Submission locked successfully
   *       400:
   *         description: Bad request
   */
  async lockSubmission(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const submissionId = req.params.submissionId as string;
      const result = await submissionService.lockSubmission(userId, submissionId);
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
   * /submissions/{submissionId}/unlock:
   *   put:
   *     summary: Unlock a submission
   *     tags: [Submission]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: submissionId
   *         schema:
   *           type: string
   *         required: true
   *         description: Submission ID
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - reason
   *             properties:
   *               reason:
   *                 type: string
   *     responses:
   *       200:
   *         description: Submission unlocked successfully
   *       400:
   *         description: Bad request
   */
  async unlockSubmission(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const submissionId = req.params.submissionId as string;
      const { reason } = req.body;
      const result = await submissionService.unlockSubmission(userId, submissionId, reason);
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
   * /submissions:
   *   get:
   *     summary: Get submissions
   *     tags: [Submission]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: query
   *         name: topicId
   *         schema:
   *           type: string
   *       - in: query
   *         name: groupId
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: Submissions retrieved successfully
   *       400:
   *         description: Bad request
   */
  async getSubmissions(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const topicId = req.query.topicId as string;
      const groupId = req.query.groupId as string;
      const submissions = await submissionService.getSubmissions(userId, topicId, groupId);
      res.json({
        success: true,
        data: submissions,
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
   * /submissions/{submissionId}/versions:
   *   get:
   *     summary: Get submission versions
   *     tags: [Submission]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: submissionId
   *         schema:
   *           type: string
   *         required: true
   *         description: Submission ID
   *     responses:
   *       200:
   *         description: Submission versions retrieved successfully
   *       400:
   *         description: Bad request
   */
  async getSubmissionVersions(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const submissionId = req.params.submissionId as string;
      const versions = await submissionService.getSubmissionVersions(userId, submissionId);
      res.json({
        success: true,
        data: versions,
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
   * /submissions/versions/{versionId}/download:
   *   get:
   *     summary: Download a submission file
   *     tags: [Submission]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: versionId
   *         schema:
   *           type: string
   *         required: true
   *         description: Version ID
   *     responses:
   *       200:
   *         description: File downloaded successfully
   *       400:
   *         description: Bad request
   */
  async downloadFile(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const versionId = req.params.versionId as string;
      const fileInfo = await submissionService.downloadFile(userId, versionId);

      res.download(fileInfo.filePath, fileInfo.fileName);
    } catch (error: any) {
      res.status(400).json({
        success: false,
        error: error.message,
      });
    }
  }
}

export default new SubmissionController();
