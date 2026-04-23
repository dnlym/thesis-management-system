import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import departmentService from '../services/department.service';

/**
 * @swagger
 * tags:
 *   name: Department
 *   description: Department management
 */
export class DepartmentController {
  /**
   * @swagger
   * /departments:
   *   post:
   *     summary: Create a new department
   *     tags: [Department]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - name
   *               - code
   *             properties:
   *               name:
   *                 type: string
   *               code:
   *                 type: string
   *     responses:
   *       201:
   *         description: Department created successfully
   *       400:
   *         description: Bad request
   */
  async createDepartment(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const department = await departmentService.createDepartment(userId, req.body);
      res.status(201).json({
        success: true,
        data: department,
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
   * /departments/{departmentId}:
   *   put:
   *     summary: Update a department
   *     tags: [Department]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: departmentId
   *         schema:
   *           type: string
   *         required: true
   *         description: Department ID
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               name:
   *                 type: string
   *               code:
   *                 type: string
   *     responses:
   *       200:
   *         description: Department updated successfully
   *       400:
   *         description: Bad request
   */
  async updateDepartment(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const departmentId = req.params.departmentId as string;
      const department = await departmentService.updateDepartment(userId, departmentId, req.body);
      res.json({
        success: true,
        data: department,
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
   * /departments:
   *   get:
   *     summary: Get all departments
   *     tags: [Department]
   *     responses:
   *       200:
   *         description: Departments retrieved successfully
   *       400:
   *         description: Bad request
   */
  async getDepartments(req: AuthRequest, res: Response) {
    try {
      const departments = await departmentService.getDepartments();
      res.json({
        success: true,
        data: departments,
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
   * /departments/{departmentId}:
   *   get:
   *     summary: Get department by ID
   *     tags: [Department]
   *     parameters:
   *       - in: path
   *         name: departmentId
   *         schema:
   *           type: string
   *         required: true
   *         description: Department ID
   *     responses:
   *       200:
   *         description: Department retrieved successfully
   *       404:
   *         description: Department not found
   */
  async getDepartmentById(req: AuthRequest, res: Response) {
    try {
      const departmentId = req.params.departmentId as string;
      const department = await departmentService.getDepartmentById(departmentId);
      res.json({
        success: true,
        data: department,
      });
    } catch (error: any) {
      res.status(404).json({
        success: false,
        error: error.message,
      });
    }
  }
}

export default new DepartmentController();
