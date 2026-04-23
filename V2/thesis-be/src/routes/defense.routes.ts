import { Router } from 'express';
import defenseController from '../controllers/defense.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

router.use(authenticate);

router.get('/', defenseController.getSchedules);

export default router;
