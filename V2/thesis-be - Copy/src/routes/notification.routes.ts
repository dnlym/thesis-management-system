import { Router } from 'express';
import notificationController from '../controllers/notification.controller';
import { authenticate } from '../middleware/auth.middleware';
import { param } from 'express-validator';
import { validate } from '../middleware/validator.middleware';

const router = Router();

router.use(authenticate);

router.get('/', notificationController.getNotifications.bind(notificationController));

router.get('/unread-count', notificationController.getUnreadCount.bind(notificationController));

router.post(
  '/:notificationId/read',
  validate([param('notificationId').isUUID().withMessage('Invalid notification ID')]),
  notificationController.markAsRead.bind(notificationController)
);

router.post('/read-all', notificationController.markAllAsRead.bind(notificationController));

router.delete(
  '/:notificationId',
  validate([param('notificationId').isUUID().withMessage('Invalid notification ID')]),
  notificationController.deleteNotification.bind(notificationController)
);

export default router;
