import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import defenseService from '../services/defense.service';

/**
 * @swagger
 * tags:
 *   name: Defenses
 *   description: Defense schedule management
 */
export class DefenseController {
    /**
     * @swagger
     * /defenses:
     *   get:
     *     summary: Get defense schedules
     *     tags: [Defenses]
     *     security:
     *       - bearerAuth: []
     *     parameters:
     *       - in: query
     *         name: semesterId
     *         schema:
     *           type: string
     *         description: Semester ID to filter
     *     responses:
     *       200:
     *         description: Schedules retrieved successfully
     *       401:
     *         description: Unauthorized
     */
    async getSchedules(req: AuthRequest, res: Response) {
        try {
            const { semesterId } = req.query;
            const schedules = await defenseService.getSchedules(semesterId as string);
            res.json({
                success: true,
                data: schedules,
            });
        } catch (error: any) {
            res.status(400).json({
                success: false,
                error: error.message,
            });
        }
    }
}

export default new DefenseController();
