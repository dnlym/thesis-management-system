import { PrismaClient } from '@prisma/client';
import prisma from '../config/database';

export interface AuditLogParams {
  userId?: string;
  action: string;
  entityType: string;
  entityId: string;
  oldValue?: any;
  newValue?: any;
  reason?: string;
  description?: string;
  ipAddress?: string;
}

/**
 * Utility class for standardized audit logging across the application.
 */
export class AuditLogger {
  /**
   * Logs an action to the AuditLog table.
   */
  static async log(params: AuditLogParams) {
    try {
      return await prisma.auditLog.create({
        data: {
          user_id: params.userId,
          action: params.action,
          entity_type: params.entityType,
          entity_id: params.entityId,
          old_value: params.oldValue,
          new_value: params.newValue,
          reason: params.reason,
          description: params.description,
          ip_address: params.ipAddress,
        },
      });
    } catch (error) {
      // We don't want to break the main transaction if logging fails, 
      // but we should definitely log the error to console/logger.
      console.error('FAILED_TO_WRITE_AUDIT_LOG:', error);
    }
  }
}
