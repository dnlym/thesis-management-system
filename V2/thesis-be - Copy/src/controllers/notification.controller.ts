import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import notificationService from '../services/notification.service';

/**
 * @swagger
 * tags:
 *   name: Notification
 *   description: Notification management
 */
export class NotificationController {
  /**
   * @swagger
   * /notifications:
   *   get:
   *     summary: Get notifications
   *     tags: [Notification]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: query
   *         name: unreadOnly
   *         schema:
   *           type: boolean
   *     responses:
   *       200:
   *         description: Notifications retrieved successfully
   *       400:
   *         description: Bad request
   */
  async getNotifications(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const unreadOnly = req.query.unreadOnly === 'true';
      const notifications = await notificationService.getNotifications(userId, unreadOnly);
      res.json({
        success: true,
        data: notifications,
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
   * /notifications/{notificationId}/read:
   *   put:
   *     summary: Mark notification as read
   *     tags: [Notification]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: notificationId
   *         schema:
   *           type: string
   *         required: true
   *         description: Notification ID
   *     responses:
   *       200:
   *         description: Notification marked as read successfully
   *       400:
   *         description: Bad request
   */
  async markAsRead(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const notificationId = req.params.notificationId as string;
      const result = await notificationService.markAsRead(userId, notificationId);
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
   * /notifications/read-all:
   *   put:
   *     summary: Mark all notifications as read
   *     tags: [Notification]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: All notifications marked as read successfully
   *       400:
   *         description: Bad request
   */
  async markAllAsRead(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const result = await notificationService.markAllAsRead(userId);
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
   * /notifications/unread-count:
   *   get:
   *     summary: Get unread notification count
   *     tags: [Notification]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: Unread count retrieved successfully
   *       400:
   *         description: Bad request
   */
  async getUnreadCount(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const result = await notificationService.getUnreadCount(userId);
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
   * /notifications/{notificationId}:
   *   delete:
   *     summary: Delete a notification
   *     tags: [Notification]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: notificationId
   *         schema:
   *           type: string
   *         required: true
   *         description: Notification ID
   *     responses:
   *       200:
   *         description: Notification deleted successfully
   *       400:
   *         description: Bad request
   */
  async deleteNotification(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const notificationId = req.params.notificationId as string;
      const result = await notificationService.deleteNotification(userId, notificationId);
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

export default new NotificationController();
