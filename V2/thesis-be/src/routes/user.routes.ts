import { Router } from 'express';
import userController from '../controllers/user.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';

const router = Router();

router.use(authenticate);

router.get('/', authorize('ADMIN', 'HEAD'), userController.getUsers);
router.get('/:id', userController.getUserById); // Allow authenticated users to view profiles (or restrict to self/admin if needed)
router.post('/', authorize('ADMIN'), userController.createUser);
router.put('/:id', userController.updateUser); // Allow users to update their own profile (controller should check ownership)
router.delete('/:id', authorize('ADMIN'), userController.deleteUser);

export default router;
