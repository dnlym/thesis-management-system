import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import { registrationExtensionService } from '../services/registration-extension.service';
import { UserRole } from '@prisma/client';

export class RegistrationExtensionController {
  async createExtension(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const role = req.user!.role;
      const { semesterId, extendedUntil, reason } = req.body;

      if (!semesterId || !extendedUntil || !reason) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields: semesterId, extendedUntil, reason'
        });
      }

      const extension = await registrationExtensionService.createExtension(userId, role, {
        semesterId,
        extendedUntil: new Date(extendedUntil),
        reason
      });

      res.status(201).json({
        success: true,
        data: extension
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  async getExtensions(req: AuthRequest, res: Response) {
    try {
      const semesterId = req.params.semesterId as string;
      
      const extensions = await registrationExtensionService.getExtensionsBySemester(semesterId);

      res.json({
        success: true,
        data: extensions
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }
}

export const registrationExtensionController = new RegistrationExtensionController();
