import { Router } from 'express';
import permissionController from '../controllers/permission.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { UserRole } from '@prisma/client';

const router = Router();

router.use(authenticate);

// Only ADMIN can manage permissions
router.get('/matrix', authorize(UserRole.ADMIN), permissionController.getMatrix);
router.post('/update', authorize(UserRole.ADMIN), permissionController.updateRolePermissions);
router.post('/seed', authorize(UserRole.ADMIN), permissionController.seedPermissions);

export default router;
