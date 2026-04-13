import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import groupService from '../services/group.service';

/**
 * @swagger
 * tags:
 *   name: Group
 *   description: Group management
 */
export class GroupController {
  /**
   * @swagger
   * /groups:
   *   post:
   *     summary: Create a new group
   *     tags: [Group]
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
   *               - semesterId
   *             properties:
   *               name:
   *                 type: string
   *               semesterId:
   *                 type: string
   *     responses:
   *       201:
   *         description: Group created successfully
   *       400:
   *         description: Bad request
   */
  async createGroup(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const group = await groupService.createGroup(userId, req.body);
      res.status(201).json({
        success: true,
        data: group,
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
   * /groups/invite:
   *   post:
   *     summary: Invite a member to the group
   *     tags: [Group]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - email
   *               - groupId
   *             properties:
   *               email:
   *                 type: string
   *                 format: email
   *               groupId:
   *                 type: string
   *     responses:
   *       201:
   *         description: Invitation sent successfully
   *       400:
   *         description: Bad request
   */
  async inviteMember(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const invitation = await groupService.inviteMember(userId, req.body);
      res.status(201).json({
        success: true,
        data: invitation,
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
   * /groups/{groupId}/accept:
   *   put:
   *     summary: Accept group invitation
   *     tags: [Group]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: groupId
   *         schema:
   *           type: string
   *         required: true
   *         description: Group ID
   *     responses:
   *       200:
   *         description: Invitation accepted successfully
   *       400:
   *         description: Bad request
   */
  async acceptInvitation(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const groupId = req.params.groupId as string;
      const result = await groupService.acceptInvitation(userId, groupId);
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

  /**
   * @swagger
   * /groups/{groupId}/reject:
   *   put:
   *     summary: Reject group invitation
   *     tags: [Group]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: groupId
   *         schema:
   *           type: string
   *         required: true
   *         description: Group ID
   *     responses:
   *       200:
   *         description: Invitation rejected successfully
   *       400:
   *         description: Bad request
   */
  async rejectInvitation(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const groupId = req.params.groupId as string;
      const result = await groupService.rejectInvitation(userId, groupId);
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

  /**
   * @swagger
   * /groups/remove-member:
   *   post:
   *     summary: Remove a member from the group
   *     tags: [Group]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - memberId
   *               - groupId
   *             properties:
   *               memberId:
   *                 type: string
   *               groupId:
   *                 type: string
   *     responses:
   *       200:
   *         description: Member removed successfully
   *       400:
   *         description: Bad request
   */
  async removeMember(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const result = await groupService.removeMember(userId, req.body);
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

  /**
   * @swagger
   * /groups/change-leader:
   *   post:
   *     summary: Request to change group leader
   *     tags: [Group]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - newLeaderId
   *               - groupId
   *             properties:
   *               newLeaderId:
   *                 type: string
   *               groupId:
   *                 type: string
   *     responses:
   *       201:
   *         description: Leader change request created successfully
   *       400:
   *         description: Bad request
   */
  async changeLeader(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const request = await groupService.changeLeader(userId, req.body);
      res.status(201).json({
        success: true,
        data: request,
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
   * /groups/change-leader/{requestId}/approve:
   *   put:
   *     summary: Approve leader change request
   *     tags: [Group]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: requestId
   *         schema:
   *           type: string
   *         required: true
   *         description: Request ID
   *     responses:
   *       200:
   *         description: Leader change approved successfully
   *       400:
   *         description: Bad request
   */
  async approveLeaderChange(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const requestId = req.params.requestId as string;
      const result = await groupService.approveLeaderChange(userId, requestId);
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

  /**
   * @swagger
   * /groups/my-groups:
   *   get:
   *     summary: Get my groups
   *     tags: [Group]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: query
   *         name: semesterId
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: Groups retrieved successfully
   *       400:
   *         description: Bad request
   */
  async getMyGroups(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const semesterId = req.query.semesterId as string;
      const groups = await groupService.getMyGroups(userId, semesterId);
      res.json({
        success: true,
        data: groups,
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
   * /groups/{groupId}:
   *   get:
   *     summary: Get group by ID
   *     tags: [Group]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: groupId
   *         schema:
   *           type: string
   *         required: true
   *         description: Group ID
   *     responses:
   *       200:
   *         description: Group retrieved successfully
   *       404:
   *         description: Group not found
   */
  async getGroupById(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const groupId = req.params.groupId as string;
      const group = await groupService.getGroupById(userId, groupId);
      res.json({
        success: true,
        data: group,
      });
    } catch (error: any) {
      res.status(404).json({
        success: false,
        error: error.message,
      });
    }
  }

  /**
   * @swagger
   * /groups/{groupId}:
   *   delete:
   *     summary: Delete a group
   *     tags: [Group]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: groupId
   *         schema:
   *           type: string
   *         required: true
   *         description: Group ID
   *     responses:
   *       200:
   *         description: Group deleted successfully
   *       400:
   *         description: Bad request
   */
  async deleteGroup(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const groupId = req.params.groupId as string;
      const result = await groupService.deleteGroup(userId, groupId);
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

  /**
   * @swagger
   * /groups/available:
   *   get:
   *     summary: Get available groups for topic assignment
   *     tags: [Group]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: query
   *         name: semesterId
   *         schema:
   *           type: string
   *         required: true
   *         description: Semester ID
   *     responses:
   *       200:
   *         description: Available groups retrieved successfully
   *       400:
   *         description: Bad request
   */
  async getAvailableGroups(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const semesterId = req.query.semesterId as string;
      if (!semesterId) {
        return res.status(400).json({
          success: false,
          error: 'Semester ID is required',
        });
      }
      const groups = await groupService.getAvailableGroups(userId, semesterId);
      res.json({
        success: true,
        data: groups,
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        error: error.message,
      });
    }
  }

  /**
   * Get groups needing members for students to join
   */
  async getGroupsNeedingMembers(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const semesterId = req.query.semesterId as string;
      if (!semesterId) {
        return res.status(400).json({
          success: false,
          error: 'Semester ID is required',
        });
      }
      const groups = await groupService.getGroupsNeedingMembers(userId, semesterId);
      res.json({
        success: true,
        data: groups,
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        error: error.message,
      });
    }
  }

  /**
   * Request to join a group
   */
  async requestJoinGroup(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const { groupId } = req.body;
      const result = await groupService.requestJoinGroup(userId, groupId);
      res.status(201).json({
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

  /**
   * Accept a join request (leader only)
   */
  async acceptJoinRequest(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const requestId = req.params.requestId as string;
      const result = await groupService.acceptJoinRequest(userId, requestId);
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

  /**
   * Reject a join request (leader only)
   */
  async rejectJoinRequest(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const requestId = req.params.requestId as string;
      const result = await groupService.rejectJoinRequest(userId, requestId);
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

  /**
   * Get pending join requests for a group (leader only)
   */
  async getPendingJoinRequests(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const groupId = req.params.groupId as string;
      const requests = await groupService.getPendingJoinRequests(userId, groupId);
      res.json({
        success: true,
        data: requests,
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        error: error.message,
      });
    }
  }
}

export default new GroupController();
