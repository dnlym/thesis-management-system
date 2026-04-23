import { Router } from 'express';
import { registrationExtensionController } from '../controllers/registration-extension.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { UserRole } from '@prisma/client';

const router = Router();

// HOD and Admin can create extensions
router.post(
  '/',
  authenticate,
  authorize(UserRole.HEAD, UserRole.ADMIN),
  registrationExtensionController.createExtension
);

// HOD and Admin can view extension history
router.get(
  '/semester/:semesterId',
  authenticate,
  authorize(UserRole.HEAD, UserRole.ADMIN),
  registrationExtensionController.getExtensions
);

export default router;
