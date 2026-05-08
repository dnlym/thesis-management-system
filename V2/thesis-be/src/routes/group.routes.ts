import { Router } from 'express';
import groupController from '../controllers/group.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { body, param, query } from 'express-validator';
import { validate } from '../middleware/validator.middleware';
import { UserRole } from '@prisma/client';

const router = Router();

router.use(authenticate);

// Route accessible by SUPERVISOR/HEAD for getting available groups (before STUDENT-only middleware)
router.get(
  '/available',
  authorize(UserRole.LECTURER, UserRole.HEAD, UserRole.ADMIN),
  validate([
    query('semesterId').notEmpty().withMessage('Semester ID is required'),
  ]),
  groupController.getAvailableGroups.bind(groupController)
);

// Student-only routes below
router.use(authorize(UserRole.STUDENT));

router.post(
  '/',
  validate([
    body('name').notEmpty().withMessage('Group name is required'),
    body('semesterId').notEmpty().withMessage('Semester ID is required'),
  ]),
  groupController.createGroup.bind(groupController)
);

router.post(
  '/invite',
  validate([
    body('groupId').isUUID().withMessage('Invalid group ID'),
    body('userId').isUUID().withMessage('Invalid user ID'),
  ]),
  groupController.inviteMember.bind(groupController)
);

router.post(
  '/:groupId/accept',
  validate([param('groupId').isUUID().withMessage('Invalid group ID')]),
  groupController.acceptInvitation.bind(groupController)
);

router.post(
  '/:groupId/reject',
  validate([param('groupId').isUUID().withMessage('Invalid group ID')]),
  groupController.rejectInvitation.bind(groupController)
);

router.post(
  '/remove-member',
  validate([
    body('groupId').isUUID().withMessage('Invalid group ID'),
    body('userId').isUUID().withMessage('Invalid user ID'),
  ]),
  groupController.removeMember.bind(groupController)
);



// Get groups needing members (for students to join)
router.get(
  '/needing-members',
  validate([
    query('semesterId').notEmpty().withMessage('Semester ID is required'),
  ]),
  groupController.getGroupsNeedingMembers.bind(groupController)
);

router.get('/', groupController.getMyGroups.bind(groupController));

router.get(
  '/:groupId',
  validate([param('groupId').isUUID().withMessage('Invalid group ID')]),
  groupController.getGroupById.bind(groupController)
);

router.delete(
  '/:groupId',
  validate([param('groupId').isUUID().withMessage('Invalid group ID')]),
  groupController.deleteGroup.bind(groupController)
);

// Join request routes
router.post(
  '/request-join',
  validate([
    body('groupId').isUUID().withMessage('Invalid group ID'),
  ]),
  groupController.requestJoinGroup.bind(groupController)
);

router.post(
  '/join-request/:requestId/accept',
  validate([param('requestId').isUUID().withMessage('Invalid request ID')]),
  groupController.acceptJoinRequest.bind(groupController)
);

router.post(
  '/join-request/:requestId/reject',
  validate([param('requestId').isUUID().withMessage('Invalid request ID')]),
  groupController.rejectJoinRequest.bind(groupController)
);

router.get(
  '/:groupId/pending-requests',
  validate([param('groupId').isUUID().withMessage('Invalid group ID')]),
  groupController.getPendingJoinRequests.bind(groupController)
);

export default router;
