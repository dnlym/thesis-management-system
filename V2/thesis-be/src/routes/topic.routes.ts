import { Router } from 'express';
import topicController from '../controllers/topic.controller';
import { UserRole } from '@prisma/client';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { validate } from '../middleware/validator.middleware';
import { body, param } from 'express-validator';
import { enforceAcademicAction } from '../middleware/academic.middleware';
import { AcademicAction } from '../utils/academic-policy';

const router = Router();

router.use(authenticate);

router.post(
  '/',
  authorize(UserRole.LECTURER, UserRole.HEAD, UserRole.ADMIN),
  enforceAcademicAction(AcademicAction.CREATE_TOPIC),
  validate([
    body('title').notEmpty().withMessage('Title is required'),
    body('description').notEmpty().withMessage('Description is required'),
    body('objectives').optional(),
    body('requirements').optional(),
    body('maxStudents').isInt({ min: 1 }).withMessage('Max students must be at least 1'),
    body('semesterId').notEmpty().withMessage('Semester ID is required'),
    body('departmentId').optional().isUUID().withMessage('Invalid department ID'),
    body('isDraft').optional().isBoolean().withMessage('isDraft must be boolean'),
    body('isInterdisciplinary').optional().isBoolean(),
    body('coSupervisorId').optional().isUUID(),
    body('secondaryDepartmentId').optional().isUUID(),
  ]),
  topicController.createTopic.bind(topicController)
);

router.put(
  '/:topicId',
  authorize(UserRole.LECTURER),
  enforceAcademicAction(AcademicAction.UPDATE_TOPIC),
  validate([param('topicId').isUUID().withMessage('Invalid topic ID')]),
  topicController.updateTopic.bind(topicController)
);

// Submit for approval (SUPERVISOR)
router.put(
  '/:topicId/submit',
  authorize(UserRole.LECTURER),
  enforceAcademicAction(AcademicAction.UPDATE_TOPIC),
  validate([param('topicId').isUUID().withMessage('Invalid topic ID')]),
  topicController.submitForApproval.bind(topicController)
);

router.post(
  '/:topicId/approve',
  authorize(UserRole.HEAD, UserRole.ADMIN),
  enforceAcademicAction(AcademicAction.APPROVE_TOPIC),
  validate([param('topicId').isUUID().withMessage('Invalid topic ID')]),
  topicController.approveTopic.bind(topicController)
);

router.post(
  '/:topicId/reject',
  authorize(UserRole.HEAD, UserRole.ADMIN),
  validate([
    param('topicId').isUUID().withMessage('Invalid topic ID'),
    body('rejectionReason').isLength({ min: 20 }).withMessage('Rejection reason must be at least 20 characters'),
  ]),
  topicController.rejectTopic.bind(topicController)
);

// Request revision (HEAD)
router.patch(
  '/:topicId/revision',
  authorize(UserRole.HEAD, UserRole.ADMIN),
  validate([
    param('topicId').isUUID().withMessage('Invalid topic ID'),
    body('notes').isLength({ min: 20 }).withMessage('Notes must be at least 20 characters'),
  ]),
  topicController.requestRevision.bind(topicController)
);

router.get(
  '/stats',
  authorize(UserRole.HEAD, UserRole.LECTURER, UserRole.ADMIN),
  topicController.getTopicStats.bind(topicController)
);

router.get('/', topicController.getTopics.bind(topicController));

router.get(
  '/:topicId',
  validate([param('topicId').isUUID().withMessage('Invalid topic ID')]),
  topicController.getTopicById.bind(topicController)
);

// Get topic approval history (HEAD, SUPERVISOR, ADMIN)
router.get(
  '/:topicId/history',
  authorize(UserRole.HEAD, UserRole.LECTURER, UserRole.ADMIN),
  validate([param('topicId').isUUID().withMessage('Invalid topic ID')]),
  topicController.getApprovalHistory.bind(topicController)
);

router.put(
  '/:topicId/interdisciplinary-response',
  authorize(UserRole.LECTURER),
  validate([
    param('topicId').isUUID().withMessage('Invalid topic ID'),
    body('status').isIn(['APPROVED', 'REJECTED']).withMessage('Invalid status'),
  ]),
  topicController.respondToInterdisciplinaryInvite.bind(topicController)
);

router.delete(
  '/:topicId',
  authorize(UserRole.LECTURER),
  enforceAcademicAction(AcademicAction.DELETE_TOPIC),
  validate([param('topicId').isUUID().withMessage('Invalid topic ID')]),
  topicController.deleteTopic.bind(topicController)
);

// Hide topic (SUPERVISOR can hide their own topics)
router.post(
  '/:topicId/hide',
  authorize(UserRole.LECTURER, UserRole.HEAD, UserRole.ADMIN),
  validate([param('topicId').isUUID().withMessage('Invalid topic ID')]),
  topicController.hideTopic.bind(topicController)
);

// Clone topic (SUPERVISOR)
router.post(
  '/:topicId/clone',
  authorize(UserRole.LECTURER),
  validate([
    param('topicId').isUUID().withMessage('Invalid topic ID'),
    body('semesterId').notEmpty().withMessage('Semester ID is required'),
  ]),
  topicController.cloneTopic.bind(topicController)
);

// Finalize defense eligibility and type (HOD)
router.post(
  '/:topicId/finalize-defense-pivot',
  authorize(UserRole.HEAD, UserRole.ADMIN),
  enforceAcademicAction(AcademicAction.ASSIGN_DEFENSE_PIVOT),
  validate([
    param('topicId').isUUID().withMessage('Invalid topic ID'),
    body('isEligible').isBoolean().withMessage('isEligible must be boolean'),
    body('defenseType').optional().isIn(['ORAL', 'POSTER']).withMessage('Invalid defense type'),
  ]),
  topicController.finalizeDefensePivot.bind(topicController)
);

// Unhide topic (restore to previous status)
router.post(
  '/:topicId/unhide',
  authorize(UserRole.LECTURER, UserRole.HEAD, UserRole.ADMIN),
  validate([param('topicId').isUUID().withMessage('Invalid topic ID')]),
  topicController.unhideTopic.bind(topicController)
);

export default router;
