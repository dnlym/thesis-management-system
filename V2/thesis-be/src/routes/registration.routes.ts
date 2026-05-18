import { Router } from 'express';
import registrationController from '../controllers/registration.controller';
import { UserRole } from '@prisma/client';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { validate } from '../middleware/validator.middleware';
import { body, param } from 'express-validator';
import { enforceAcademicAction } from '../middleware/academic.middleware';
import { AcademicAction } from '../utils/academic-policy';

const router = Router();

router.use(authenticate);

// =====================================================
// NEW FLOW: Individual registration (topic first, then group)
// =====================================================

// Register for a topic individually (no group required)
router.post(
  '/topic/:topicId',
  authorize(UserRole.STUDENT),
  enforceAcademicAction(AcademicAction.REGISTER_TOPIC),
  validate([param('topicId').isUUID().withMessage('Invalid topic ID')]),
  registrationController.registerTopicIndividual.bind(registrationController)
);

// GVHD registers a topic on behalf of a student (optional flow)
router.post(
  '/register-for-student',
  authorize(UserRole.LECTURER, UserRole.COORDINATOR),
  enforceAcademicAction(AcademicAction.REGISTER_TOPIC),
  validate([
    body('studentId').isUUID().withMessage('Invalid student ID'),
    body('topicId').isUUID().withMessage('Invalid topic ID'),
  ]),
  registrationController.registerTopicForStudent.bind(registrationController)
);

// Get my topic registration for current semester
router.get(
  '/my-topic',
  authorize(UserRole.STUDENT),
  registrationController.getMyTopicRegistration.bind(registrationController)
);

// Get students registered for the same topic (for grouping)
router.get(
  '/topic/:topicId/students',
  authorize(UserRole.STUDENT),
  validate([param('topicId').isUUID().withMessage('Invalid topic ID')]),
  registrationController.getStudentsSameTopic.bind(registrationController)
);

// Create a group with another student in the same topic
router.post(
  '/topic/:topicId/create-group',
  authorize(UserRole.STUDENT),
  enforceAcademicAction(AcademicAction.JOIN_GROUP),
  validate([
    param('topicId').isUUID().withMessage('Invalid topic ID'),
    body('partnerId').isUUID().withMessage('Invalid partner ID'),
  ]),
  registrationController.createGroupInTopic.bind(registrationController)
);

// Cancel individual registration (only if no group yet)
router.delete(
  '/my-topic',
  authorize(UserRole.STUDENT),
  enforceAcademicAction(AcademicAction.CANCEL_REGISTRATION),
  registrationController.cancelIndividualRegistration.bind(registrationController)
);

// Disband my group
router.delete(
  '/my-group',
  authorize(UserRole.STUDENT),
  enforceAcademicAction(AcademicAction.CANCEL_REGISTRATION),
  registrationController.disbandGroup.bind(registrationController)
);

// =====================================================
// GROUP INVITE SYSTEM (hide student list, use invite flow)
// IMPORTANT: These routes MUST come BEFORE /:registrationId
// =====================================================

// Search student by MSSV for invite
router.get(
  '/topic/:topicId/search-student',
  authorize(UserRole.STUDENT),
  validate([param('topicId').isUUID().withMessage('Invalid topic ID')]),
  registrationController.searchStudentForInvite.bind(registrationController)
);

// Send group invite
router.post(
  '/topic/:topicId/invite',
  authorize(UserRole.STUDENT),
  validate([
    param('topicId').isUUID().withMessage('Invalid topic ID'),
    body('studentCode').notEmpty().withMessage('Mã sinh viên là bắt buộc'),
  ]),
  registrationController.sendGroupInvite.bind(registrationController)
);

// Get my invites (sent and received)
router.get(
  '/invites',
  authorize(UserRole.STUDENT),
  registrationController.getMyInvites.bind(registrationController)
);

// Accept an invite
router.post(
  '/invites/:inviteId/accept',
  authorize(UserRole.STUDENT),
  enforceAcademicAction(AcademicAction.JOIN_GROUP),
  validate([param('inviteId').isUUID().withMessage('Invalid invite ID')]),
  registrationController.acceptInvite.bind(registrationController)
);

// Reject an invite
router.post(
  '/invites/:inviteId/reject',
  authorize(UserRole.STUDENT),
  validate([param('inviteId').isUUID().withMessage('Invalid invite ID')]),
  registrationController.rejectInvite.bind(registrationController)
);

// Cancel an invite I sent
router.delete(
  '/invites/:inviteId',
  authorize(UserRole.STUDENT),
  validate([param('inviteId').isUUID().withMessage('Invalid invite ID')]),
  registrationController.cancelInvite.bind(registrationController)
);

// =====================================================
// SHARED ROUTES
// IMPORTANT: Dynamic routes like /:registrationId MUST come LAST
// =====================================================

// Get all registrations (filtered by role)
router.get('/', registrationController.getRegistrations.bind(registrationController));

// Get registration logs
router.get('/:registrationId/logs', registrationController.getRegistrationLogs.bind(registrationController));

// Get registration by ID
router.get(
  '/:registrationId',
  validate([param('registrationId').isUUID().withMessage('Invalid registration ID')]),
  registrationController.getRegistrationById.bind(registrationController)
);

// Update student progress (supervisor only)
router.put(
  '/:registrationId/progress',
  authorize(UserRole.LECTURER, UserRole.COORDINATOR),
  validate([
    param('registrationId').isUUID().withMessage('Invalid registration ID'),
    body('status').notEmpty().withMessage('Status is required'),
  ]),
  registrationController.updateProgress.bind(registrationController)
);

export default router;
