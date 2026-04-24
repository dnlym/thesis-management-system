import { Router } from 'express';
import extraPointsController from '../controllers/extra-points.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { body, param } from 'express-validator';
import { validate } from '../middleware/validator.middleware';
import { uploadExtraPointEvidence } from '../middleware/upload.middleware';
import { UserRole } from '@prisma/client';

const router = Router();

router.use(authenticate);

router.post(
  '/',
  authorize(UserRole.STUDENT),
  validate([
    body('topicId').isUUID().withMessage('Invalid topic ID'),
    body('reason').isLength({ min: 50 }).withMessage('Reason must be at least 50 characters'),
    body('pointsRequested').isFloat({ min: 0.1, max: 1.0 }).withMessage('Points must be between 0.1 and 1.0'),
  ]),
  extraPointsController.submitRequest.bind(extraPointsController)
);

router.post(
  '/:requestId/approve',
  authorize(UserRole.HEAD, UserRole.ADMIN),
  validate([
    param('requestId').isUUID().withMessage('Invalid request ID'),
    body('approvedPoints').isFloat({ min: 0.1, max: 1.0 }).withMessage('Approved points must be between 0.1 and 1.0'),
  ]),
  extraPointsController.approveRequest.bind(extraPointsController)
);

router.post(
  '/:requestId/reject',
  authorize(UserRole.HEAD, UserRole.ADMIN),
  validate([
    param('requestId').isUUID().withMessage('Invalid request ID'),
    body('rejectionReason').isLength({ min: 50 }).withMessage('Rejection reason must be at least 50 characters'),
  ]),
  extraPointsController.rejectRequest.bind(extraPointsController)
);

router.get('/', extraPointsController.getRequests.bind(extraPointsController));

router.get(
  '/:requestId',
  validate([param('requestId').isUUID().withMessage('Invalid request ID')]),
  extraPointsController.getRequestById.bind(extraPointsController)
);

router.delete(
  '/:requestId',
  authorize(UserRole.STUDENT),
  validate([param('requestId').isUUID().withMessage('Invalid request ID')]),
  extraPointsController.withdrawRequest.bind(extraPointsController)
);

// Upload evidence
router.post(
  '/upload',
  authorize(UserRole.STUDENT),
  uploadExtraPointEvidence.single('file'),
  extraPointsController.uploadEvidence.bind(extraPointsController)
);

// Confirm no extra points (student has no research achievements)
router.post(
  '/confirm-no-points',
  authorize(UserRole.STUDENT),
  validate([
    body('topicId').isUUID().withMessage('Invalid topic ID'),
  ]),
  extraPointsController.confirmNoExtraPoints.bind(extraPointsController)
);

// Get my extra points status for a topic
router.get(
  '/my-status/:topicId',
  authorize(UserRole.STUDENT),
  validate([param('topicId').isUUID().withMessage('Invalid topic ID')]),
  extraPointsController.getMyExtraPointsStatus.bind(extraPointsController)
);

export default router;
