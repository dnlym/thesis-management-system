import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import permissionService from '../services/permission.service';
import { UserRole } from '@prisma/client';

export class PermissionController {
    async getMatrix(req: AuthRequest, res: Response) {
        try {
            const matrix = await permissionService.getPermissionMatrix();
            res.json({
                success: true,
                data: matrix,
            });
        } catch (error: any) {
            res.status(400).json({
                success: false,
                error: error.message,
            });
        }
    }

    async updateRolePermissions(req: AuthRequest, res: Response) {
        try {
            const { role, permissionIds } = req.body;
            
            if (!Object.values(UserRole).includes(role)) {
                throw new Error('Invalid role');
            }

            const result = await permissionService.updateRolePermissions(role, permissionIds);
            res.json({
                success: true,
                data: result,
            });
        } catch (error: any) {
            res.status(400).json({
                success: false,
                error: error.message,
            });
        }
    }

    async seedPermissions(req: AuthRequest, res: Response) {
        try {
            await permissionService.seedPermissions();
            res.json({
                success: true,
                message: 'Permissions seeded successfully',
            });
        } catch (error: any) {
            res.status(400).json({
                success: false,
                error: error.message,
            });
        }
    }
}

export default new PermissionController();
