import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import dashboardService from '../services/dashboard.service';

/**
 * @swagger
 * tags:
 *   name: Dashboard
 *   description: Dashboard statistics
 */
export class DashboardController {
    /**
     * @swagger
     * /dashboard/stats:
     *   get:
     *     summary: Get dashboard statistics
     *     tags: [Dashboard]
     *     security:
     *       - bearerAuth: []
     *     responses:
     *       200:
     *         description: Statistics retrieved successfully
     *       401:
     *         description: Unauthorized
     */
    async getStats(req: AuthRequest, res: Response) {
        try {
            const userId = req.user!.id;
            const stats = await dashboardService.getStats(userId);
            res.json({
                success: true,
                data: stats,
            });
        } catch (error: any) {
            res.status(400).json({
                success: false,
                error: error.message,
            });
        }
    }

    /**
     * @swagger
     * /dashboard/charts:
     *   get:
     *     summary: Get dashboard charts data
     *     tags: [Dashboard]
     *     security:
     *       - bearerAuth: []
     *     responses:
     *       200:
     *         description: Charts data retrieved successfully
     *       401:
     *         description: Unauthorized
     */
    async getCharts(req: AuthRequest, res: Response) {
        try {
            const userId = req.user!.id;
            const { semesterId } = req.query;
            const charts = await dashboardService.getCharts(userId, semesterId as string);
            res.json({
                success: true,
                data: charts,
            });
        } catch (error: any) {
            res.status(400).json({
                success: false,
                error: error.message,
            });
        }
    }
}

export default new DashboardController();
