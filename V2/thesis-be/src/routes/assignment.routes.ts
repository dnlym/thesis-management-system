import { Router } from 'express';
import assignmentController from '../controllers/assignment.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { body, param } from 'express-validator';
import { validate } from '../middleware/validator.middleware';
import { UserRole } from '@prisma/client';

const router = Router();

router.use(authenticate);

router.post(
  '/reviewer',
  authorize(UserRole.HEAD, UserRole.COORDINATOR, UserRole.ADMIN),
  validate([
    body('topicId').isUUID().withMessage('Invalid topic ID'),
    body('reviewerId').isUUID().withMessage('Invalid reviewer ID'),
    body('reviewerOrder').optional().isInt({ min: 1, max: 3 }).withMessage('Reviewer order must be 1, 2, or 3'),
    body('defenseFormat').optional().isIn(['ONLINE', 'OFFLINE']).withMessage('Invalid defense format'),
    body('room').optional({ nullable: true }).isString(),
    body('zoomPassword').optional({ nullable: true }).isString(),
    body('startTime').optional({ nullable: true }).isISO8601().withMessage('Invalid start time'),
    body('endTime').optional({ nullable: true }).isISO8601().withMessage('Invalid end time'),
  ]),
  assignmentController.createReviewerAssignment.bind(assignmentController)
);

router.post(
  '/:assignmentId/accept',
  authorize(UserRole.LECTURER, UserRole.COORDINATOR, UserRole.HEAD, UserRole.ADMIN),
  validate([param('assignmentId').isUUID().withMessage('Invalid assignment ID')]),
  assignmentController.acceptAssignment.bind(assignmentController)
);

router.post(
  '/:assignmentId/decline',
  authorize(UserRole.LECTURER, UserRole.COORDINATOR, UserRole.HEAD, UserRole.ADMIN),
  validate([
    param('assignmentId').isUUID().withMessage('Invalid assignment ID'),
    body('declineReason').isLength({ min: 30 }).withMessage('Decline reason must be at least 30 characters'),
  ]),
  assignmentController.declineAssignment.bind(assignmentController)
);

router.post(
  '/defense-schedule',
  authorize(UserRole.HEAD, UserRole.COORDINATOR, UserRole.ADMIN),
  validate([
    body('topicId').isUUID().withMessage('Invalid topic ID'),
    body('defenseDate').isISO8601().withMessage('Invalid defense date'),
    body('defenseTime').notEmpty().withMessage('Defense time is required'),
    body('room').notEmpty().withMessage('Room is required'),
    body('committeeChair').isUUID().withMessage('Invalid committee chair ID'),
    body('committeeSecretary').isUUID().withMessage('Invalid committee secretary ID'),
    body('committeeMembers').isArray().withMessage('Committee members must be an array'),
  ]),
  assignmentController.createDefenseSchedule.bind(assignmentController)
);

router.get('/defense-schedules', assignmentController.getDefenseSchedules.bind(assignmentController));
router.get('/', assignmentController.getAssignments.bind(assignmentController));

router.delete(
  '/:assignmentId',
  authorize(UserRole.HEAD, UserRole.COORDINATOR, UserRole.ADMIN),
  validate([param('assignmentId').isUUID().withMessage('Invalid assignment ID')]),
  assignmentController.deleteAssignment.bind(assignmentController)
);

// ============ HEAD-only routes for assignment management ============

// Get topics eligible for reviewer assignment
router.get(
  '/topics-for-reviewer',
  authorize(UserRole.HEAD, UserRole.COORDINATOR, UserRole.ADMIN),
  assignmentController.getTopicsForReviewerAssignment.bind(assignmentController)
);

// Get topics eligible for committee assignment
router.get(
  '/topics-for-committee',
  authorize(UserRole.HEAD, UserRole.COORDINATOR, UserRole.ADMIN),
  assignmentController.getTopicsForCommitteeAssignment.bind(assignmentController)
);

// Get all potential reviewers for a department (HEAD only)
router.get(
  '/available-reviewers',
  authorize(UserRole.HEAD, UserRole.COORDINATOR, UserRole.ADMIN),
  assignmentController.getAvailableReviewersForDepartment.bind(assignmentController)
);

// Get available reviewers for a topic (excluding GVHD)
router.get(
  '/available-reviewers/:topicId',
  authorize(UserRole.HEAD, UserRole.COORDINATOR, UserRole.ADMIN),
  validate([param('topicId').isUUID().withMessage('Invalid topic ID')]),
  assignmentController.getAvailableReviewers.bind(assignmentController)
);

// Assign committee members to a topic
router.post(
  '/committee',
  authorize(UserRole.HEAD, UserRole.COORDINATOR, UserRole.ADMIN),
  validate([
    body('topicId').isUUID().withMessage('Invalid topic ID'),
    body('chairId').isUUID().withMessage('Invalid chair ID'),
    body('secretaryId').isUUID().withMessage('Invalid secretary ID'),
    body('memberIds').isArray().withMessage('Member IDs must be an array'),
    body('defenseDate').isISO8601().withMessage('Invalid defense date'),
  ]),
  assignmentController.assignCommittee.bind(assignmentController)
);

// Update defense type of a topic
router.patch(
  '/:topicId/defense-type',
  authorize(UserRole.HEAD, UserRole.COORDINATOR, UserRole.ADMIN),
  validate([
    param('topicId').isUUID().withMessage('Invalid topic ID'),
    body('type').optional({ nullable: true }).isIn(['ORAL', 'POSTER']).withMessage('Invalid defense type'),
  ]),
  assignmentController.updateDefenseType.bind(assignmentController)
);

// Update reviewer schedule (date, start/end time, room/Zoom details)
router.put(
  '/reviewer/schedule',
  authorize(UserRole.HEAD, UserRole.COORDINATOR, UserRole.ADMIN),
  validate([
    body('topicId').isUUID().withMessage('Invalid topic ID'),
    body('groupId').isUUID().withMessage('Invalid group ID'),
    body('defenseFormat').isIn(['ONLINE', 'OFFLINE']).withMessage('Invalid defense format'),
    body('room').optional({ nullable: true }).isString(),
    body('zoomPassword').optional({ nullable: true }).isString(),
    body('startTime').optional({ nullable: true }).isISO8601().withMessage('Invalid start time'),
    body('endTime').optional({ nullable: true }).isISO8601().withMessage('Invalid end time'),
  ]),
  assignmentController.updateReviewerSchedule.bind(assignmentController)
);

export default router;
