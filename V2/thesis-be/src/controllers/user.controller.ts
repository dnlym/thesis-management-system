import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import userService from '../services/user.service';

export class UserController {
    async getUsers(req: AuthRequest, res: Response) {
        try {
            const filters = {
                role: req.query.role as any,
                departmentId: req.query.departmentId as string,
                search: req.query.search as string,
            };
            const users = await userService.getUsers(req.user!.id, filters);
            res.json({
                success: true,
                data: users,
            });
        } catch (error: any) {
            res.status(400).json({
                success: false,
                error: error.message,
            });
        }
    }

    async getUserById(req: AuthRequest, res: Response) {
        try {
            const id = req.params.id as string;
            const user = await userService.getUserById(id);
            res.json({
                success: true,
                data: user,
            });
        } catch (error: any) {
            res.status(404).json({
                success: false,
                error: error.message,
            });
        }
    }

    async createUser(req: AuthRequest, res: Response) {
        try {
            const user = await userService.createUser(req.body);
            res.status(201).json({
                success: true,
                data: user,
            });
        } catch (error: any) {
            res.status(400).json({
                success: false,
                error: error.message,
            });
        }
    }

    async updateUser(req: AuthRequest, res: Response) {
        try {
            const id = req.params.id as string;

            // Check if user is updating their own profile or is an admin
            if (req.user?.id !== id && req.user?.role !== 'ADMIN') {
                return res.status(403).json({
                    success: false,
                    error: 'Forbidden: You can only update your own profile',
                });
            }

            const user = await userService.updateUser(id, req.body);
            res.json({
                success: true,
                data: user,
            });
        } catch (error: any) {
            res.status(400).json({
                success: false,
                error: error.message,
            });
        }
    }

    async deleteUser(req: AuthRequest, res: Response) {
        try {
            const id = req.params.id as string;
            const result = await userService.deleteUser(id);
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
}

export default new UserController();
