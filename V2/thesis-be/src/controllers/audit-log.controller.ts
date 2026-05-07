import { Response } from 'express';
import { AuthRequest } from '../types';
import prisma from '../config/database';
import { UserRole } from '@prisma/client';

class AuditLogController {
  /**
   * Get all audit logs with pagination and filters
   */
  async getLogs(req: AuthRequest, res: Response) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const skip = (page - 1) * limit;

      const { userId, action, entityType, startDate, endDate, search } = req.query;

      const where: any = {};

      if (userId) where.user_id = userId;
      if (action) where.action = action;
      if (entityType) where.entity_type = entityType;
      
      if (startDate || endDate) {
        where.created_at = {};
        if (startDate) where.created_at.gte = new Date(startDate as string);
        if (endDate) where.created_at.lte = new Date(endDate as string);
      }

      if (search) {
        where.OR = [
          { description: { contains: search as string, mode: 'insensitive' } },
          { reason: { contains: search as string, mode: 'insensitive' } },
          { entity_id: { contains: search as string, mode: 'insensitive' } },
        ];
      }

      const [logs, total] = await Promise.all([
        prisma.auditLog.findMany({
          where,
          include: {
            user: {
              select: {
                id: true,
                full_name: true,
                email: true,
                role: true,
                avatar_url: true
              }
            }
          },
          orderBy: { created_at: 'desc' },
          skip,
          take: limit,
        }),
        prisma.auditLog.count({ where }),
      ]);

      res.json({
        success: true,
        data: logs,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        }
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Get audit logs for a specific entity
   */
  async getEntityLogs(req: AuthRequest, res: Response) {
    try {
      const { entityType, entityId } = req.params;
      
      const logs = await prisma.auditLog.findMany({
        where: {
          entity_type: String(entityType),
          entity_id: String(entityId)
        },
        include: {
          user: {
            select: {
              id: true,
              full_name: true,
              role: true
            }
          }
        },
        orderBy: { created_at: 'desc' }
      });

      res.json({
        success: true,
        data: logs
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }
}

export default new AuditLogController();
