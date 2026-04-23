import { Request, Response } from 'express';
import assignmentService from '../services/assignment.service';
import { AuthRequest } from '../middleware/auth.middleware';

export class AssignmentController {
    async createReviewerAssignment(req: AuthRequest, res: Response) {
        try {
            const userId = req.user!.id;
            const assignment = await assignmentService.createReviewerAssignment(userId, req.body);
            res.json({
                success: true,
                data: assignment,
            });
        } catch (error: any) {
            res.status(400).json({
                success: false,
                error: error.message,
            });
        }
    }

    async acceptAssignment(req: AuthRequest, res: Response) {
        try {
            const userId = req.user!.id;
            const assignmentId = req.params.assignmentId as string;
            const result = await assignmentService.acceptAssignment(userId, assignmentId);
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

    async declineAssignment(req: AuthRequest, res: Response) {
        try {
            const userId = req.user!.id;
            const assignmentId = req.params.assignmentId as string;
            const { declineReason } = req.body;
            const result = await assignmentService.declineAssignment(userId, assignmentId, declineReason);
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

    async createDefenseSchedule(req: AuthRequest, res: Response) {
        try {
            const userId = req.user!.id;
            const schedule = await assignmentService.createDefenseSchedule(userId, req.body);
            res.json({
                success: true,
                data: schedule,
            });
        } catch (error: any) {
            res.status(400).json({
                success: false,
                error: error.message,
            });
        }
    }

    async getDefenseSchedules(req: AuthRequest, res: Response) {
        try {
            const userId = req.user!.id;
            const schedules = await assignmentService.getDefenseSchedules(userId);
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

    async getAssignments(req: AuthRequest, res: Response) {
        try {
            const userId = req.user!.id;
            const filters = {
                topicId: req.query.topicId as string,
                assignmentType: req.query.assignmentType as any,
                status: req.query.status as any,
            };
            const assignments = await assignmentService.getAssignments(userId, filters);
            res.json({
                success: true,
                data: assignments,
            });
        } catch (error: any) {
            res.status(400).json({
                success: false,
                error: error.message,
            });
        }
    }

    async deleteAssignment(req: AuthRequest, res: Response) {
        try {
            const userId = req.user!.id;
            const assignmentId = req.params.assignmentId as string;
            await assignmentService.deleteAssignment(userId, assignmentId);
            res.json({
                success: true,
                message: 'Assignment deleted successfully',
            });
        } catch (error: any) {
            res.status(400).json({
                success: false,
                error: error.message,
            });
        }
    }

    // ============ HEAD-only endpoints ============

    /**
     * Get topics eligible for reviewer assignment (HEAD only)
     */
    async getTopicsForReviewerAssignment(req: AuthRequest, res: Response) {
        try {
            const userId = req.user!.id;
            const topics = await assignmentService.getTopicsForReviewerAssignment(userId);
            res.json({
                success: true,
                data: topics,
            });
        } catch (error: any) {
            res.status(400).json({
                success: false,
                error: error.message,
            });
        }
    }

    /**
     * Get topics eligible for committee assignment (HEAD only)
     */
    async getTopicsForCommitteeAssignment(req: AuthRequest, res: Response) {
        try {
            const userId = req.user!.id;
            const topics = await assignmentService.getTopicsForCommitteeAssignment(userId);
            res.json({
                success: true,
                data: topics,
            });
        } catch (error: any) {
            res.status(400).json({
                success: false,
                error: error.message,
            });
        }
    }

    /**
     * Get available reviewers for a topic (HEAD only)
     */
    async getAvailableReviewers(req: AuthRequest, res: Response) {
        try {
            const userId = req.user!.id;
            const topicId = req.params.topicId as string;
            const reviewers = await assignmentService.getAvailableReviewers(userId, topicId);
            res.json({
                success: true,
                data: reviewers,
            });
        } catch (error: any) {
            res.status(400).json({
                success: false,
                error: error.message,
            });
        }
    }

    /**
     * Get all potential reviewers for a department (HEAD only)
     */
    async getAvailableReviewersForDepartment(req: AuthRequest, res: Response) {
        try {
            const userId = req.user!.id;
            const reviewers = await assignmentService.getAvailableReviewersForDepartment(userId);
            res.json({
                success: true,
                data: reviewers,
            });
        } catch (error: any) {
            res.status(400).json({
                success: false,
                error: error.message,
            });
        }
    }

    /**
     * Assign committee members to a topic (HEAD only)
     */
    async assignCommittee(req: AuthRequest, res: Response) {
        try {
            const userId = req.user!.id;
            const assignments = await assignmentService.assignCommittee(userId, req.body);
            res.json({
                success: true,
                data: assignments,
            });
        } catch (error: any) {
            res.status(400).json({
                success: false,
                error: error.message,
            });
        }
    }
    async updateDefenseType(req: AuthRequest, res: Response) {
        try {
            const userId = req.user!.id;
            const topicId = req.params.topicId as string;
            const { type } = req.body;
            const updated = await assignmentService.updateDefenseType(userId, topicId, type);
            res.json({
                success: true,
                data: updated,
            });
        } catch (error: any) {
            res.status(400).json({
                success: false,
                error: error.message,
            });
        }
    }
}

export default new AssignmentController();
