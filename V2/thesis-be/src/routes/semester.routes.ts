import { Router } from 'express';
import semesterController from '../controllers/semester.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { body, param } from 'express-validator';
import { validate } from '../middleware/validator.middleware';
import { UserRole } from '@prisma/client';

const router = Router();


router.use(authenticate);

router.get('/', semesterController.getSemesters.bind(semesterController));
router.get('/active', semesterController.getActiveSemester.bind(semesterController));

router.post(
  '/',
  authorize(UserRole.ADMIN),
  validate([
    body('name').notEmpty().withMessage('Semester name is required'),
    body('code').notEmpty().withMessage('Semester code is required'),
    body('start_date').isISO8601().withMessage('Invalid start date'),
    body('end_date').isISO8601().withMessage('Invalid end date'),
    body('proposal_deadline').isISO8601().withMessage('Invalid proposal deadline'),
    body('thesis_deadline').isISO8601().withMessage('Invalid thesis deadline'),
    body('defense_start').optional().isISO8601().withMessage('Invalid defense start date'),
    body('defense_end').optional().isISO8601().withMessage('Invalid defense end date'),
    body('topic_viewing_start').optional().isISO8601().withMessage('Invalid topic viewing start'),
    body('topic_viewing_end').optional().isISO8601().withMessage('Invalid topic viewing end'),
    body('topic_registration_start').optional().isISO8601().withMessage('Invalid registration start'),
    body('topic_registration_end').optional().isISO8601().withMessage('Invalid registration end'),
    body('midterm_start').optional().isISO8601().withMessage('Invalid midterm start'),
    body('midterm_end').optional().isISO8601().withMessage('Invalid midterm end'),
  ]),
  semesterController.createSemester.bind(semesterController)
);

router.put(
  '/:semesterId',
  authorize(UserRole.ADMIN),
  validate([
    param('semesterId').isUUID().withMessage('Invalid semester ID'),
    body('name').optional().notEmpty().withMessage('Semester name cannot be empty'),
    body('start_date').optional().isISO8601(),
    body('end_date').optional().isISO8601(),
    body('proposal_deadline').optional().isISO8601(),
    body('thesis_deadline').optional().isISO8601(),
    body('defense_start').optional().isISO8601(),
    body('defense_end').optional().isISO8601(),
    body('topic_viewing_start').optional().isISO8601(),
    body('topic_viewing_end').optional().isISO8601(),
    body('topic_registration_start').optional().isISO8601(),
    body('topic_registration_end').optional().isISO8601(),
    body('midterm_start').optional().isISO8601(),
    body('midterm_end').optional().isISO8601(),
  ]),
  semesterController.updateSemester.bind(semesterController)
);


router.get(
  '/:semesterId',
  validate([param('semesterId').isUUID().withMessage('Invalid semester ID')]),
  semesterController.getSemesterById.bind(semesterController)
);

router.put(
  '/:semesterId/activate',
  authorize(UserRole.ADMIN),
  validate([param('semesterId').isUUID().withMessage('Invalid semester ID')]),
  semesterController.setActiveSemester.bind(semesterController)
);

router.put(
  '/:semesterId/finalize',
  authorize(UserRole.ADMIN),
  validate([param('semesterId').isUUID().withMessage('Invalid semester ID')]),
  semesterController.finalizeSemester.bind(semesterController)
);

router.patch(
  '/:id/defense-date',
  authorize(UserRole.HEAD, UserRole.ADMIN),
  validate([
    param('id').isUUID().withMessage('Invalid semester ID'),
    body('defense_start').isISO8601().withMessage('Invalid defense start date'),
  ]),
  semesterController.updateDefenseDate.bind(semesterController)
);

router.post(
  '/:semesterId/toggle-registration-override',
  authorize(UserRole.HEAD, UserRole.ADMIN),
  validate([
    param('semesterId').isUUID().withMessage('Invalid semester ID'),
    body('override').isBoolean().withMessage('Override must be a boolean'),
    body('reason').notEmpty().withMessage('Reason is required'),
  ]),
  semesterController.toggleRegistrationOverride.bind(semesterController)
);

router.get(
  '/:semesterId/override-logs',
  authorize(UserRole.HEAD, UserRole.ADMIN),
  validate([param('semesterId').isUUID().withMessage('Invalid semester ID')]),
  semesterController.getOverrideLogs.bind(semesterController)
);


export default router;
