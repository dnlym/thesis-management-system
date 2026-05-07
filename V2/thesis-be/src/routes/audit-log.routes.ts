import { Router } from 'express';
import auditLogController from '../controllers/audit-log.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { UserRole } from '@prisma/client';

const router = Router();

router.use(authenticate);
router.use(authorize(UserRole.ADMIN, UserRole.HEAD));

/**
 * @swagger
 * /audit-logs:
 *   get:
 *     summary: Get all audit logs (Admin only)
 *     tags: [AuditLogs]
 */
router.get('/', auditLogController.getLogs.bind(auditLogController));

/**
 * @swagger
 * /audit-logs/{entityType}/{entityId}:
 *   get:
 *     summary: Get logs for a specific entity
 *     tags: [AuditLogs]
 */
router.get('/:entityType/:entityId', auditLogController.getEntityLogs.bind(auditLogController));

export default router;
