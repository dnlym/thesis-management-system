import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import authService from '../services/auth.service';

export class AuthController {
    async register(req: AuthRequest, res: Response) {
        try {
            await authService.register(req.body);
            res.status(201).json({
                success: true,
                message: 'User registered successfully',
            });
        } catch (error: any) {
            res.status(400).json({
                success: false,
                error: error.message,
            });
        }
    }

    async login(req: AuthRequest, res: Response) {
        try {
            const { email, password } = req.body;
            const result = await authService.login(
                { email, password },
                req.ip,
                req.get('user-agent')
            );
            res.json({
                success: true,
                data: result,
            });
        } catch (error: any) {
            res.status(401).json({
                success: false,
                error: error.message,
            });
        }
    }

    async refreshToken(req: AuthRequest, res: Response) {
        try {
            const { refreshToken } = req.body;
            const result = await authService.refreshAccessToken(refreshToken);
            res.json({
                success: true,
                data: result,
            });
        } catch (error: any) {
            res.status(401).json({
                success: false,
                error: error.message,
            });
        }
    }

    async logout(req: AuthRequest, res: Response) {
        try {
            const { refreshToken } = req.body;
            await authService.logout(refreshToken);
            res.json({
                success: true,
                message: 'Logged out successfully',
            });
        } catch (error: any) {
            res.status(400).json({
                success: false,
                error: error.message,
            });
        }
    }

    async getProfile(req: AuthRequest, res: Response) {
        try {
            const userId = req.user!.id;
            const profile = await authService.getProfile(userId);
            res.json({
                success: true,
                data: profile,
            });
        } catch (error: any) {
            res.status(404).json({
                success: false,
                error: error.message,
            });
        }
    }

    async updateProfile(req: AuthRequest, res: Response) {
        try {
            const userId = req.user!.id;
            const profile = await authService.updateProfile(userId, req.body);
            res.json({
                success: true,
                data: profile,
            });
        } catch (error: any) {
            res.status(400).json({
                success: false,
                error: error.message,
            });
        }
    }

    async changePassword(req: AuthRequest, res: Response) {
        try {
            const userId = req.user!.id;
            const { currentPassword, newPassword } = req.body;
            await authService.changePassword(userId, currentPassword, newPassword);
            res.json({
                success: true,
                message: 'Password changed successfully',
            });
        } catch (error: any) {
            res.status(400).json({
                success: false,
                error: error.message,
            });
        }
    }
}

export default new AuthController();
