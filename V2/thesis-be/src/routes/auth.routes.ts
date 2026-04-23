import { Router } from 'express';
import authController from '../controllers/auth.controller';
import { authenticate } from '../middleware/auth.middleware';
import { body } from 'express-validator';
import { validate } from '../middleware/validator.middleware';

const router = Router();

// Public routes
router.post(
  '/register',
  validate([
    body('email').isEmail().withMessage('Invalid email'),
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
    body('fullName').notEmpty().withMessage('Full name is required'),
    body('role').isIn(['STUDENT', 'SUPERVISOR', 'REVIEWER', 'HEAD']).withMessage('Invalid role'),
  ]),
  authController.register.bind(authController)
);

router.post(
  '/login',
  validate([
    body('email').isEmail().withMessage('Invalid email'),
    body('password').notEmpty().withMessage('Password is required'),
  ]),
  authController.login.bind(authController)
);

router.post(
  '/refresh-token',
  validate([body('refreshToken').notEmpty().withMessage('Refresh token is required')]),
  authController.refreshToken.bind(authController)
);

router.post(
  '/logout',
  validate([body('refreshToken').notEmpty().withMessage('Refresh token is required')]),
  authController.logout.bind(authController)
);

// Protected routes
router.get('/profile', authenticate, authController.getProfile.bind(authController));

router.put(
  '/profile',
  authenticate,
  validate([body('fullName').optional().notEmpty().withMessage('Full name cannot be empty')]),
  authController.updateProfile.bind(authController)
);

router.post(
  '/change-password',
  authenticate,
  validate([
    body('currentPassword').notEmpty().withMessage('Current password is required'),
    body('newPassword').isLength({ min: 8 }).withMessage('New password must be at least 8 characters'),
  ]),
  authController.changePassword.bind(authController)
);

export default router;
