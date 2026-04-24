import { Router } from 'express';
import gradingController from '../controllers/grading.controller';
import { UserRole } from '@prisma/client';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { validate } from '../middleware/validator.middleware';
import { body, param } from 'express-validator';
import { enforceAcademicAction } from '../middleware/academic.middleware';
import { AcademicAction } from '../utils/academic-policy';

const router = Router();

router.use(authenticate);

// ==========================================
// 1. CÁC ROUTES TĨNH (STATIC ROUTES) - ĐẶT LÊN ĐẦU
// ==========================================

router.post(
  '/criteria',
  authorize(UserRole.HEAD, UserRole.ADMIN),
  validate([
    body('name').notEmpty().withMessage('Criterion name is required'),
    body('weight').isFloat({ min: 0, max: 1 }).withMessage('Weight must be between 0 and 1'),
    body('maxScore').isFloat({ min: 0 }).withMessage('Max score must be positive'),
    body('criteriaType').notEmpty().withMessage('Criteria type is required'),
  ]),
  gradingController.createGradingCriterion.bind(gradingController)
);

// Route này gây lỗi lúc nãy, giờ đưa lên đây là an toàn
router.put(
  '/criteria/:id',
  authorize(UserRole.HEAD, UserRole.ADMIN),
  validate([
    body('name').optional().notEmpty().withMessage('Criterion name cannot be empty'),
    body('weight').optional().isFloat({ min: 0, max: 1 }).withMessage('Weight must be between 0 and 1'),
    body('maxScore').optional().isFloat({ min: 0 }).withMessage('Max score must be positive'),
    body('criteriaType').optional().notEmpty().withMessage('Criteria type cannot be empty'),
  ]),
  gradingController.updateGradingCriterion.bind(gradingController)
);

router.delete(
  '/criteria/:id',
  authorize(UserRole.HEAD, UserRole.ADMIN),
  gradingController.deleteGradingCriterion.bind(gradingController)
);

router.get('/criteria', gradingController.getGradingCriteria.bind(gradingController));

// ==========================================
// Grade Summary for HEAD (Tổng kết điểm)
// ==========================================
router.get(
  '/grade-summary',
  authorize(UserRole.HEAD, UserRole.ADMIN),
  gradingController.getGradeSummary.bind(gradingController)
);

// ==========================================
// UC07: MIDTERM GRADING ROUTES
// ==========================================

// Get registrations for midterm grading (GVHD only)
router.get(
  '/midterm',
  authorize(UserRole.LECTURER),
  gradingController.getRegistrationsForMidtermGrading.bind(gradingController)
);

// Update midterm status (PASS/FAIL) - Only GVHD can grade
router.put(
  '/midterm/:registrationId',
  authorize(UserRole.LECTURER),
  enforceAcademicAction(AcademicAction.GRADE_MIDTERM),
  validate([
    param('registrationId').isUUID().withMessage('Invalid registration ID'),
    body('status').isIn(['PASS', 'FAIL']).withMessage('Status must be PASS or FAIL'),
    body('feedback').optional().isString().withMessage('Feedback must be a string'),
  ]),
  gradingController.updateMidtermStatus.bind(gradingController)
);

router.post(
  '/submit',
  authorize(UserRole.LECTURER),
  enforceAcademicAction((req) => {
    const role = (req.body.raterRole || '').toUpperCase();
    // Committee roles: COUNCIL_MEMBER, COMMITTEE, COMMITTEE_CHAIR, COMMITTEE_SECRETARY, COMMITTEE_MEMBER, COMMITTEE_MEMBER_1, COMMITTEE_MEMBER_2, ORAL_COMMITTEE, POSTER_COMMITTEE
    if (role === 'COUNCIL_MEMBER' || role.startsWith('COMMITTEE') || role.includes('COUNCIL') || role === 'ORAL_COMMITTEE' || role === 'POSTER_COMMITTEE') {
      return AcademicAction.GRADE_COMMITTEE;
    }
    // Reviewer roles: REVIEWER, REVIEWER_1, REVIEWER_2, REVIEWER_3
    if (role === 'REVIEWER' || role.startsWith('REVIEWER_')) {
      return AcademicAction.GRADE_REVIEWER;
    }
    // Supervisor
    if (role === 'SUPERVISOR' || role === 'ADVISOR') {
      return AcademicAction.GRADE_SUPERVISOR;
    }
    return AcademicAction.GRADE_REVIEWER; // safe fallback
  }),
  validate([
    body('topicId').isUUID().withMessage('Invalid topic ID'),
    body('raterRole').notEmpty().withMessage('Rater role is required'),
    body('grades').isArray({ min: 1 }).withMessage('Grades must be a non-empty array'),
  ]),
  gradingController.submitGrade.bind(gradingController)
);

// ==========================================
// 2. CÁC ROUTES ĐỘNG (DYNAMIC ROUTES) - ĐẶT XUỐNG DƯỚI
// ==========================================

router.post(
  '/:topicId/compute',
  authorize(UserRole.HEAD, UserRole.ADMIN),
  validate([param('topicId').isUUID().withMessage('Invalid topic ID')]),
  gradingController.computeFinalScore.bind(gradingController)
);

router.post(
  '/:topicId/finalize',
  authorize(UserRole.HEAD, UserRole.ADMIN),
  enforceAcademicAction(AcademicAction.FINALIZE_SCORE),
  validate([param('topicId').isUUID().withMessage('Invalid topic ID')]),
  gradingController.finalizeFinalScore.bind(gradingController)
);

// Get current user's grades for a topic (for read-only confirmed state)
router.get(
  '/:topicId/my-grades',
  validate([param('topicId').isUUID().withMessage('Invalid topic ID')]),
  gradingController.getMyGrades.bind(gradingController)
);

// Route này sẽ hứng tất cả các GET request còn lại có dạng /{id}
router.get(
  '/:topicId',
  validate([param('topicId').isUUID().withMessage('Invalid topic ID')]),
  gradingController.getGrades.bind(gradingController)
);

export default router;
