import { Router } from 'express';
import departmentController from '../controllers/department.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { body, param } from 'express-validator';
import { validate } from '../middleware/validator.middleware';
import { UserRole } from '@prisma/client';

const router = Router();

router.use(authenticate);

router.post(
  '/',
  authorize(UserRole.ADMIN),
  validate([
    body('name').notEmpty().withMessage('Department name is required'),
    body('code').notEmpty().withMessage('Department code is required'),
  ]),
  departmentController.createDepartment.bind(departmentController)
);

router.put(
  '/:departmentId',
  authorize(UserRole.ADMIN),
  validate([param('departmentId').isUUID().withMessage('Invalid department ID')]),
  departmentController.updateDepartment.bind(departmentController)
);

router.get('/', departmentController.getDepartments.bind(departmentController));

router.get(
  '/:departmentId',
  validate([param('departmentId').isUUID().withMessage('Invalid department ID')]),
  departmentController.getDepartmentById.bind(departmentController)
);

export default router;
