import { Router } from 'express';
import committeeController from '../controllers/committee.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { UserRole } from '@prisma/client';

const router = Router();

// All committee routes require authentication and HEAD/ADMIN role
router.use(authenticate);
router.use(authorize(UserRole.HEAD, UserRole.COORDINATOR, UserRole.ADMIN));

router.post('/', committeeController.createCommittee);
router.get('/', committeeController.getCommittees);
router.get('/schedules', committeeController.getMasterSchedules);
router.get('/busy-lecturers', committeeController.getBusyLecturers);
router.put('/:id', committeeController.updateCommittee);
router.delete('/:id', committeeController.deleteCommittee);
router.post('/assign-topic', committeeController.assignTopic);

export default router;
