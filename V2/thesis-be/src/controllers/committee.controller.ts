import { Response } from 'express';
import prisma from '../config/database';
import committeeService from '../services/committee.service';
import { AuthRequest } from '../middleware/auth.middleware';

/** Look up the user's departmentId from DB */
async function getUserDepartmentId(userId: string): Promise<string> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { departmentId: true },
  });
  if (!user) throw new Error('User not found');
  return user.departmentId;
}

export class CommitteeController {
  async createCommittee(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const departmentId = await getUserDepartmentId(userId);
      const committee = await committeeService.createCommittee(userId, {
        ...req.body,
        departmentId,
      });
      res.json({
        success: true,
        data: committee,
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        error: error.message,
      });
    }
  }

  async updateCommittee(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const id = req.params.id as string;
      const committee = await committeeService.updateCommittee(userId, id, req.body);
      res.json({
        success: true,
        data: committee,
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        error: error.message,
      });
    }
  }

  async deleteCommittee(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const id = req.params.id as string;
      const result = await committeeService.deleteCommittee(userId, id);
      res.json({
        success: true,
        ...result,
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        error: error.message,
      });
    }
  }

  async assignTopic(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const schedule = await committeeService.assignTopicToCommittee(userId, req.body);
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

  async getMasterSchedules(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const userRole = req.user!.role;
      const semesterId = req.query.semesterId as string;
      if (!semesterId) {
        throw new Error('semesterId is required');
      }
      // HEAD/COORDINATOR sees only their department; ADMIN sees all
      let departmentId: string | undefined;
      if (userRole === 'HEAD' || userRole === 'COORDINATOR') {
        departmentId = await getUserDepartmentId(userId);
      }
      const data = await committeeService.getCommitteeSchedules(semesterId, departmentId);
      res.json({
        success: true,
        data,
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        error: error.message,
      });
    }
  }

  /**
   * Get all lecturer IDs already in a committee for a semester
   */
  async getBusyLecturers(req: AuthRequest, res: Response) {
    try {
      const semesterId = req.query.semesterId as string;
      if (!semesterId) throw new Error('semesterId is required');
      const data = await committeeService.getBusyLecturerIds(semesterId);
      res.json({
        success: true,
        data,
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        error: error.message,
      });
    }
  }

  /**
   * Get all committees for a semester (for selection in assignment UI)
   */
  async getCommittees(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const userRole = req.user!.role;
      const semesterId = req.query.semesterId as string;
      // HEAD/COORDINATOR sees only their department; ADMIN sees all
      let departmentId: string | undefined;
      if (userRole === 'HEAD' || userRole === 'COORDINATOR') {
        departmentId = await getUserDepartmentId(userId);
      }
      const committees = await committeeService.getCommittees(semesterId, departmentId);
      res.json({
        success: true,
        data: committees,
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        error: error.message,
      });
    }
  }
}

export default new CommitteeController();
