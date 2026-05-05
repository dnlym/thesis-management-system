import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import deptSemesterConfigService from '../services/dept-semester-config.service';
import prisma from '../config/database';

export class DeptSemesterConfigController {
  async getConfig(req: AuthRequest, res: Response) {
    try {
      const { semesterId } = req.params;
      
      const userRole = req.user!.role;
      let targetDepartmentId: string | undefined;

      if (userRole === 'ADMIN') {
        targetDepartmentId = req.query.departmentId as string;
      } else {
        const user = await prisma.user.findUnique({
          where: { id: req.user!.id },
          select: { departmentId: true }
        });
        targetDepartmentId = user?.departmentId || undefined;
      }

      // If Admin hasn't selected a dept, just return null (Global view)
      if (!targetDepartmentId) {
        if (userRole === 'ADMIN') {
          return res.json({ success: true, data: null });
        }
        return res.status(400).json({ success: false, message: 'Người dùng không thuộc bộ môn nào' });
      }

      if (!semesterId || typeof semesterId !== 'string') {
        return res.status(400).json({ success: false, message: 'ID học kỳ không hợp lệ' });
      }

      const config = await deptSemesterConfigService.getConfig(targetDepartmentId, semesterId);
      
      res.json({
        success: true,
        data: config
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  async updateConfig(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const { semesterId } = req.params;
      const userRole = req.user!.role;
      let targetDepartmentId: string | undefined;
      const { defense_date, is_registration_open, departmentId: bodyDeptId } = req.body;

      if (userRole === 'ADMIN') {
        targetDepartmentId = bodyDeptId;
      } else {
        const user = await prisma.user.findUnique({
          where: { id: userId },
          select: { departmentId: true }
        });
        targetDepartmentId = user?.departmentId || undefined;
      }

      if (!targetDepartmentId) {
        return res.status(400).json({ 
          success: false, 
          message: userRole === 'ADMIN' ? 'Admin cần cung cấp departmentId' : 'Người dùng không thuộc bộ môn nào' 
        });
      }

      if (!semesterId || typeof semesterId !== 'string') {
        return res.status(400).json({ success: false, message: 'ID học kỳ không hợp lệ' });
      }

      const config = await deptSemesterConfigService.updateConfig(
        userId,
        targetDepartmentId,
        semesterId,
        {
          defense_date: defense_date ? new Date(defense_date) : undefined,
          is_registration_open
        }
      );

      res.json({
        success: true,
        data: config
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }
}

export default new DeptSemesterConfigController();
