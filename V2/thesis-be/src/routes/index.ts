import { Router } from 'express';
import authRoutes from './auth.routes';
import userRoutes from './user.routes';
import topicRoutes from './topic.routes';
import groupRoutes from './group.routes';
import registrationRoutes from './registration.routes';
import assignmentRoutes from './assignment.routes';
import gradingRoutes from './grading.routes';
import extraPointsRoutes from './extra-points.routes';
import notificationRoutes from './notification.routes';
import departmentRoutes from './department.routes';
import semesterRoutes from './semester.routes';
import dashboardRoutes from './dashboard.routes';
import defenseRoutes from './defense.routes';
import committeeRoutes from './committee.routes';
import registrationExtensionRoutes from './registration-extension.routes';
import permissionRoutes from './permission.routes';


const router = Router();

router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/topics', topicRoutes);
router.use('/registrations', registrationRoutes);
router.use('/groups', groupRoutes);
router.use('/assignments', assignmentRoutes);
router.use('/grading', gradingRoutes);
router.use('/extra-points', extraPointsRoutes);
router.use('/notifications', notificationRoutes);
router.use('/semesters', semesterRoutes);
router.use('/departments', departmentRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/defenses', defenseRoutes);
router.use('/committees', committeeRoutes);
router.use('/registration-extensions', registrationExtensionRoutes);
router.use('/permissions', permissionRoutes);

export default router;
