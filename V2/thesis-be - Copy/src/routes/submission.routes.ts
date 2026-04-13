import { Router } from 'express';
import submissionController from '../controllers/submission.controller';
import { UserRole } from '@prisma/client';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { validate } from '../middleware/validator.middleware';
import { body, param } from 'express-validator';
import { upload } from '../middleware/upload.middleware';
import { enforceAcademicAction } from '../middleware/academic.middleware';
import { AcademicAction } from '../utils/academic-policy';

const router = Router();

router.use(authenticate);

router.post(
  '/upload',
  authorize(UserRole.STUDENT),
  enforceAcademicAction((req) => {
    const type = req.body.type;
    if (type === 'PROPOSAL') return AcademicAction.SUBMIT_PROPOSAL;
    if (type === 'THESIS') return AcademicAction.SUBMIT_THESIS;
    if (type === 'SOURCE_CODE') return AcademicAction.SUBMIT_SOURCE_CODE;
    return AcademicAction.SUBMIT_PROPOSAL; // Default to proposal for now
  }),
  upload.single('file'),
  validate([
    body('topicId').isUUID().withMessage('Invalid topic ID'),
    body('groupId').isUUID().withMessage('Invalid group ID'),
    body('type').isIn(['PROPOSAL', 'THESIS', 'SOURCE_CODE', 'PRESENTATION']).withMessage('Invalid submission type'),
  ]),
  submissionController.uploadFile.bind(submissionController)
);

router.post(
  '/:submissionId/approve',
  authorize(UserRole.LECTURER),
  validate([param('submissionId').isUUID().withMessage('Invalid submission ID')]),
  submissionController.approveSubmission.bind(submissionController)
);

router.post(
  '/:submissionId/reject',
  authorize(UserRole.LECTURER),
  validate([
    param('submissionId').isUUID().withMessage('Invalid submission ID'),
    body('rejectionReason').isLength({ min: 20 }).withMessage('Rejection reason must be at least 20 characters'),
  ]),
  submissionController.rejectSubmission.bind(submissionController)
);

router.post(
  '/:submissionId/lock',
  authorize(UserRole.HEAD),
  validate([param('submissionId').isUUID().withMessage('Invalid submission ID')]),
  submissionController.lockSubmission.bind(submissionController)
);

router.post(
  '/:submissionId/unlock',
  authorize(UserRole.HEAD),
  validate([
    param('submissionId').isUUID().withMessage('Invalid submission ID'),
    body('reason').isLength({ min: 20 }).withMessage('Reason must be at least 20 characters'),
  ]),
  submissionController.unlockSubmission.bind(submissionController)
);

router.get('/', submissionController.getSubmissions.bind(submissionController));

router.get(
  '/:submissionId/versions',
  validate([param('submissionId').isUUID().withMessage('Invalid submission ID')]),
  submissionController.getSubmissionVersions.bind(submissionController)
);

router.get(
  '/download/:versionId',
  validate([param('versionId').isUUID().withMessage('Invalid version ID')]),
  submissionController.downloadFile.bind(submissionController)
);

export default router;
