import prisma from '../config/database';
import { GroupMemberStatus, UserRole } from '@prisma/client';
import {
  CreateGroupRequest,
  InviteMemberRequest,
  AcceptInvitationRequest,
  RejectInvitationRequest,
  RemoveMemberRequest,
  ChangeLeaderRequest,
} from '../types';
import { ERROR_CODES, VALIDATION } from '../constants';
import notificationService from './notification.service';


export class GroupService {
  async createGroup(userId: string, data: CreateGroupRequest) {
    // Validate group name
    if (data.name.length < VALIDATION.GROUP.NAME_MIN || data.name.length > VALIDATION.GROUP.NAME_MAX) {
      throw new Error(`Group name must be between ${VALIDATION.GROUP.NAME_MIN} and ${VALIDATION.GROUP.NAME_MAX} characters`);
    }

    // Check if user already in a group for this semester
    const existingMembership = await prisma.groupMember.findFirst({
      where: {
        user_id: userId,
        group: {
          semester_id: data.semesterId,
        },
        status: { in: [GroupMemberStatus.PENDING, GroupMemberStatus.ACCEPTED] },
      },
    });

    if (existingMembership) {
      throw new Error(ERROR_CODES.ALREADY_IN_GROUP);
    }

    // Check if group name already exists in semester
    const existingGroup = await prisma.group.findFirst({
      where: {
        name: data.name,
        semester_id: data.semesterId,
      },
    });

    if (existingGroup) {
      throw new Error('Group name already exists in this semester');
    }

    // Create group
    const group = await prisma.group.create({
      data: {
        name: data.name,
        leader_id: userId,
        semester_id: data.semesterId,
      },
    });

    // Add creator as first member (ACCEPTED)
    await prisma.groupMember.create({
      data: {
        group_id: group.id,
        user_id: userId,
        status: GroupMemberStatus.ACCEPTED,
      },
    });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        user_id: userId,
        action: 'CREATE',
        entity_type: 'Group',
        entity_id: group.id,
        new_value: group,
      },
    });

    return group;
  }

  async inviteMember(userId: string, data: InviteMemberRequest) {
    const group = await prisma.group.findUnique({
      where: { id: data.groupId },
      include: {
        members: true,
        registrations: true,
      },
    });

    if (!group) {
      throw new Error(ERROR_CODES.GROUP_NOT_FOUND);
    }

    // Check if user is the leader
    if (group.leader_id !== userId) {
      throw new Error(ERROR_CODES.NOT_GROUP_LEADER);
    }

    // Check if group has registered a topic
    const activeRegistrations = group.registrations.filter(r => r.status !== 'REJECTED');
    const hasRegistration = activeRegistrations.length > 0;

    if (hasRegistration) {
      throw new Error('Cannot invite members after registering a topic');
    }

    // Get department config for group size
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { department: true }
    });

    const maxGroupSize = user?.department.max_group_size || 2;

    // Check if group is full
    const acceptedMembers = group.members.filter(m => m.status === GroupMemberStatus.ACCEPTED);
    if (acceptedMembers.length >= maxGroupSize) {
      throw new Error(`Group is full (maximum ${maxGroupSize} members)`);
    }

    // Check if invitee is already in the group
    const existingMember = group.members.find(m => m.user_id === data.userId);
    if (existingMember) {
      if (existingMember.status === GroupMemberStatus.PENDING) {
        throw new Error('User already has a pending invitation');
      }
      if (existingMember.status === GroupMemberStatus.ACCEPTED) {
        throw new Error('User is already a member');
      }
    }

    // Check if invitee is in another group
    const otherMembership = await prisma.groupMember.findFirst({
      where: {
        user_id: data.userId,
        group: {
          semester_id: group.semester_id,
        },
        status: { in: [GroupMemberStatus.PENDING, GroupMemberStatus.ACCEPTED] },
      },
    });

    if (otherMembership) {
      throw new Error('User is already in another group or has pending invitations');
    }

    // Get invitee details
    const invitee = await prisma.user.findUnique({
      where: { id: data.userId },
    });

    if (!invitee) {
      throw new Error('User not found');
    }

    if (invitee.role !== UserRole.STUDENT) {
      throw new Error('Can only invite students');
    }

    // STRICT DEPARTMENT CHECK
    // By default, members must be in the same department as the leader.
    // EXCEPTION: Interdisciplinary topics allow cross-department collaboration.
    const isSameDept = invitee.departmentId === user!.departmentId;
    
    // We allow cross-dept invites to facilitate interdisciplinary forming.
    // However, RegistrationService will enforce that such mixed groups 
    // can ONLY register for interdisciplinary topics.
    if (!isSameDept) {
       // We allow the invite here, but non-interdisciplinary topics will be blocked later.
    }

    // Create invitation
    const invitation = await prisma.groupMember.create({
      data: {
        group_id: data.groupId,
        user_id: data.userId,
        status: GroupMemberStatus.PENDING,
      },
    });

    // Send notification to invitee
    const inviter = await prisma.user.findUnique({ where: { id: userId } });
    await notificationService.notifyGroupInvitation(
      data.userId,
      inviter?.full_name || 'Một sinh viên',
      `nhóm ${group.name}`,
      invitation.id
    );

    return invitation;

  }

  async acceptInvitation(userId: string, groupId: string) {
    const membership = await prisma.groupMember.findFirst({
      where: {
        group_id: groupId,
        user_id: userId,
        status: GroupMemberStatus.PENDING,
      },
      include: {
        group: {
          include: {
            members: true,
            registrations: true,
          },
        },
      },
    });

    if (!membership) {
      throw new Error('Invitation not found');
    }

    // Check if user is in another group
    const otherMembership = await prisma.groupMember.findFirst({
      where: {
        user_id: userId,
        group_id: { not: groupId },
        group: {
          semester_id: membership.group.semester_id,
        },
        status: GroupMemberStatus.ACCEPTED,
      },
    });

    if (otherMembership) {
      throw new Error(ERROR_CODES.ALREADY_IN_GROUP);
    }

    // Check if group has registered
    const hasRegistration = membership.group.registrations.some(r => r.status !== 'REJECTED');
    if (hasRegistration) {
      throw new Error('Cannot accept invitation after group has registered a topic');
    }

    // Get group creator/leader department config for group size
    const leader = await prisma.user.findUnique({
      where: { id: membership.group.leader_id },
      include: { department: true }
    });
    const maxGroupSize = leader?.department.max_group_size || 2;

    // Check if group is full
    const acceptedMembers = membership.group.members.filter(m => m.status === GroupMemberStatus.ACCEPTED);
    if (acceptedMembers.length >= maxGroupSize) {
      throw new Error('Group is full');
    }

    // Accept invitation
    const updatedMembership = await prisma.groupMember.update({
      where: { id: membership.id },
      data: {
        status: GroupMemberStatus.ACCEPTED,
      },
    });

    // Send notification to group leader
    const invitee = await prisma.user.findUnique({ where: { id: userId } });
    await notificationService.notifyGroupInvitationResponse(
      membership.group.leader_id,
      invitee?.full_name || 'Một sinh viên',
      true,
      `nhóm ${membership.group.name}`
    );

    return updatedMembership;

  }

  async rejectInvitation(userId: string, groupId: string) {
    const membership = await prisma.groupMember.findFirst({
      where: {
        group_id: groupId,
        user_id: userId,
        status: GroupMemberStatus.PENDING,
      },
      include: { group: true },
    });


    if (!membership) {
      throw new Error('Invitation not found');
    }

    // Update status to REJECTED
    await prisma.groupMember.update({
      where: { id: membership.id },
      data: {
        status: GroupMemberStatus.REJECTED,
      },
    });

    // Send notification to group leader
    const invitee = await prisma.user.findUnique({ where: { id: userId } });
    await notificationService.notifyGroupInvitationResponse(
      membership.group.leader_id,
      invitee?.full_name || 'Một sinh viên',
      false,
      `nhóm ${membership.group.name}`
    );

    return { message: 'Invitation rejected' };

  }

  async removeMember(userId: string, data: RemoveMemberRequest) {
    const group = await prisma.group.findUnique({
      where: { id: data.groupId },
      include: {
        members: true,
        registrations: true,
      },
    });

    if (!group) {
      throw new Error(ERROR_CODES.GROUP_NOT_FOUND);
    }

    // Check permissions
    const isLeader = group.leader_id === userId;
    const isSelf = data.userId === userId;

    if (!isLeader && !isSelf) {
      throw new Error(ERROR_CODES.FORBIDDEN);
    }

    // Cannot remove leader
    if (data.userId === group.leader_id) {
      throw new Error('Cannot remove group leader. Change leader first.');
    }

    // Check if group has registered
    const hasRegistration = group.registrations.some(r => r.status !== 'REJECTED');
    if (hasRegistration) {
      throw new Error('Cannot remove members after registering a topic');
    }

    const membership = group.members.find(m => m.user_id === data.userId);
    if (!membership) {
      throw new Error('User is not a member of this group');
    }

    // Update status to LEFT
    await prisma.groupMember.update({
      where: { id: membership.id },
      data: {
        status: GroupMemberStatus.LEFT,
        left_at: new Date(),
      },
    });

    // Send notifications
    const actor = await prisma.user.findUnique({ where: { id: userId } });
    if (isSelf) {
      // Notify leader that member left
      await notificationService.createNotification(
        group.leader_id,
        'GROUP_MEMBER_LEFT',
        'Thành viên đã rời nhóm',
        `Sinh viên "${actor?.full_name}" đã rời khỏi nhóm "${group.name}".`,
        group.id
      );
    } else {
      // Notify member that they were removed
      await notificationService.createNotification(
        data.userId,
        'GROUP_MEMBER_REMOVED',
        'Bạn đã bị xóa khỏi nhóm',
        `Bạn đã bị xóa khỏi nhóm "${group.name}" bởi trưởng nhóm.`,
        group.id
      );
    }

    return { message: 'Member removed successfully' };

  }

  async changeLeader(userId: string, data: ChangeLeaderRequest) {
    // Reason length check removed as per user request
    if (!data.reason) {
      data.reason = "Chuyển quyền nhóm trưởng";
    }

    const group = await prisma.group.findUnique({
      where: { id: data.groupId },
      include: {
        members: true,
        registrations: true,
      },
    });

    if (!group) {
      throw new Error(ERROR_CODES.GROUP_NOT_FOUND);
    }

    // Check if new leader is a member
    const newLeaderMembership = group.members.find(
      m => m.user_id === data.newLeaderId && m.status === GroupMemberStatus.ACCEPTED
    );
    if (!newLeaderMembership) {
      throw new Error('New leader must be an accepted member of the group');
    }

    // Immediate transfer as per user request
    const updatedGroup = await prisma.group.update({
      where: { id: data.groupId },
      data: {
        leader_id: data.newLeaderId,
      },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        user_id: userId,
        action: 'CHANGE_LEADER',
        entity_type: 'Group',
        entity_id: data.groupId,
        old_value: { leader_id: group.leader_id },
        new_value: { leader_id: data.newLeaderId },
      },
    });

    // Notify members of leadership change
    const memberIds = group.members.map(m => m.user_id);
    const newLeader = await prisma.user.findUnique({ where: { id: data.newLeaderId } });
    
    await notificationService.createBulkNotifications(
      memberIds,
      'GROUP_LEADER_CHANGED',
      'Thay đổi trưởng nhóm',
      `"${newLeader?.full_name}" đã trở thành trưởng nhóm mới của nhóm "${group.name}".`,
      group.id
    );

    return updatedGroup;

  }

  async approveLeaderChange(userId: string, requestId: string) {
    const request = await prisma.groupLeaderChangeRequest.findUnique({
      where: { id: requestId },
      include: {
        group: {
          include: {
            registrations: {
              include: {
                topic: true,
              },
            },
          },
        },
      },
    });

    if (!request) {
      throw new Error('Request not found');
    }

    if (request.status !== 'PENDING') {
      throw new Error('Request already processed');
    }

    // Check permissions
    const confirmedRegistration = request.group.registrations.find(r => r.status === 'CONFIRMED');

    if (confirmedRegistration) {
      // Need GVHD approval
      const topic = confirmedRegistration?.topic;
      if (topic?.supervisor_id !== userId) {
        throw new Error(ERROR_CODES.FORBIDDEN);
      }
    } else {
      // Need current leader approval
      if (request.current_leader !== userId) {
        throw new Error(ERROR_CODES.FORBIDDEN);
      }
    }

    // Approve request
    await prisma.groupLeaderChangeRequest.update({
      where: { id: requestId },
      data: {
        status: 'APPROVED',
        approved_by: userId,
        responded_at: new Date(),
      },
    });

    // Update group leader
    await prisma.group.update({
      where: { id: request.group_id },
      data: {
        leader_id: request.new_leader,
      },
    });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        user_id: userId,
        action: 'CHANGE_LEADER',
        entity_type: 'Group',
        entity_id: request.group_id,
        old_value: { leader_id: request.current_leader },
        new_value: { leader_id: request.new_leader },
      },
    });

    // TODO: Send notifications

    return { message: 'Leader change approved' };
  }

  async getMyGroups(userId: string, semesterId?: string) {
    const where: any = {
      members: {
        some: {
          user_id: userId,
          status: { in: [GroupMemberStatus.PENDING, GroupMemberStatus.ACCEPTED] },
        },
      },
    };

    if (semesterId) {
      where.semester_id = semesterId;
    }

    const groups = await prisma.group.findMany({
      where,
      include: {
        leader: {
          select: {
            id: true,
            full_name: true,
            email: true,
          },
        },
        semester: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        members: {
          include: {
            user: {
              select: {
                id: true,
                full_name: true,
                email: true,
                student_code: true,
              },
            },
          },
        },
        registrations: {
          include: {
            topic: {
              select: {
                id: true,
                title: true,
                status: true,
              },
            },
          },
        },
      },
      orderBy: { created_at: 'desc' },
    });

    return groups;
  }

  async getGroupById(userId: string, groupId: string) {
    const group = await prisma.group.findUnique({
      where: { id: groupId },
      include: {
        leader: {
          select: {
            id: true,
            full_name: true,
            email: true,
            phone: true,
          },
        },
        semester: true,
        members: {
          include: {
            user: {
              select: {
                id: true,
                full_name: true,
                email: true,
                student_code: true,
                phone: true,
              },
            },
          },
          orderBy: { joined_at: 'asc' },
        },
        registrations: {
          include: {
            topic: {
              include: {
                supervisor: {
                  select: {
                    id: true,
                    full_name: true,
                    email: true,
                  },
                },
              },
            },
          },
        },
        leader_change_requests: {
          where: {
            status: 'PENDING',
          },
        },
      },
    });

    if (!group) {
      throw new Error(ERROR_CODES.GROUP_NOT_FOUND);
    }

    return group;
  }

  async deleteGroup(userId: string, groupId: string) {
    const group = await prisma.group.findUnique({
      where: { id: groupId },
      include: {
        registrations: true,
      },
    });

    if (!group) {
      throw new Error(ERROR_CODES.GROUP_NOT_FOUND);
    }

    // Only leader can delete
    if (group.leader_id !== userId) {
      throw new Error(ERROR_CODES.NOT_GROUP_LEADER);
    }

    // Cannot delete if has confirmed registration
    const hasConfirmedRegistration = group.registrations.some(r => r.status === 'CONFIRMED');
    if (hasConfirmedRegistration) {
      throw new Error('Cannot delete group with confirmed registration');
    }

    await prisma.group.delete({
      where: { id: groupId },
    });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        user_id: userId,
        action: 'DELETE',
        entity_type: 'Group',
        entity_id: groupId,
        old_value: group,
      },
    });

    return { message: 'Group deleted successfully' };
  }

  /**
   * Get available groups for topic assignment
   * Returns groups without any active registration in the specified semester
   */
  async getAvailableGroups(userId: string, semesterId: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    const groups = await prisma.group.findMany({
      where: {
        semester_id: semesterId,
        // STRICT DEPARTMENT FILTER
        leader: { departmentId: user?.departmentId },
        // Only groups with at least one accepted member
        members: {
          some: {
            status: GroupMemberStatus.ACCEPTED,
          },
        },
        // No active registration (PENDING or CONFIRMED)
        registrations: {
          none: {
            status: { in: ['PENDING', 'CONFIRMED'] },
          },
        },
      },
      include: {
        leader: {
          select: {
            id: true,
            full_name: true,
            email: true,
          },
        },
        members: {
          where: {
            status: GroupMemberStatus.ACCEPTED,
          },
          include: {
            user: {
              select: {
                id: true,
                full_name: true,
                email: true,
                student_code: true,
              },
            },
          },
        },
        registrations: true,
      },
      orderBy: { created_at: 'desc' },
    });

    // Filter out groups that have active registrations (double check)
    return groups.filter(g => g.registrations.length === 0 || g.registrations.every(r => r.status === 'REJECTED'));
  }

  /**
   * Get groups that need more members (for students to join)
   * Returns groups with only 1 member that haven't registered for a topic yet
   */
  async getGroupsNeedingMembers(userId: string, semesterId: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    const groups = await prisma.group.findMany({
      where: {
        semester_id: semesterId,
        // STRICT DEPARTMENT FILTER
        leader: { departmentId: user?.departmentId },
        // Groups without active registrations
        registrations: {
          none: {
            status: { in: ['PENDING', 'CONFIRMED'] },
          },
        },
      },
      include: {
        leader: {
          select: {
            id: true,
            full_name: true,
            email: true,
            student_code: true,
          },
        },
        members: {
          where: {
            status: GroupMemberStatus.ACCEPTED,
          },
          include: {
            user: {
              select: {
                id: true,
                full_name: true,
                email: true,
                student_code: true,
              },
            },
          },
        },
        registrations: true,
      },
      orderBy: { created_at: 'desc' },
    });

    // Filter: only groups with < max_group_size accepted members
    // For simplicity, this currently assumes groups needing members are those with < max_group_size
    // We'll need to fetch the department for each group leader
    const groupIds = groups.map(g => g.id);
    const groupsWithLeaders = await prisma.group.findMany({
      where: { id: { in: groupIds } },
      include: { leader: { include: { department: true } } }
    });

    return groups.filter(g => {
      const leaderInfo = groupsWithLeaders.find(gl => gl.id === g.id);
      const maxGroupSize = leaderInfo?.leader.department.max_group_size || 2;
      const acceptedMembers = g.members.length;
      const noActiveRegistration = g.registrations.length === 0 || g.registrations.every(r => r.status === 'REJECTED');
      
      // The prisma query above already filters by department, so we just check size and registration here
      return acceptedMembers < maxGroupSize && noActiveRegistration;
    });
  }

  /**
   * Request to join a group (student sends request, leader will approve/reject)
   */
  async requestJoinGroup(userId: string, groupId: string) {
    // Get user info
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.role !== UserRole.STUDENT) {
      throw new Error('Chỉ sinh viên mới có thể xin gia nhập nhóm');
    }

    // Check if user already in a group in this semester
    const existingMembership = await prisma.groupMember.findFirst({
      where: {
        user_id: userId,
        status: { in: [GroupMemberStatus.ACCEPTED, GroupMemberStatus.PENDING] },
        group: {
          semester_id: user.departmentId ? undefined : undefined, // Will check below
        },
      },
      include: { group: true },
    });

    // Get the target group
    const group = await prisma.group.findUnique({
      where: { id: groupId },
      include: {
        members: { where: { status: GroupMemberStatus.ACCEPTED } },
        registrations: true,
        semester: true,
      },
    });

    if (!group) {
      throw new Error(ERROR_CODES.GROUP_NOT_FOUND);
    }

    // STRICT DEPARTMENT CHECK
    const groupLeader = await prisma.user.findUnique({
      where: { id: group.leader_id },
      include: { department: true }
    });
    
    if (user?.departmentId !== groupLeader?.departmentId) {
       throw new Error('Bạn chỉ được gia nhập nhóm cùng chuyên ngành.');
    }

    // Check if user already has a group in this semester
    if (existingMembership && existingMembership.group.semester_id === group.semester_id) {
      throw new Error('Bạn đã có nhóm trong học kỳ này');
    }

    // Get department config for group size (using leader's department)
    const maxGroupSize = groupLeader?.department.max_group_size || 2;

    // Check if group already has max members
    if (group.members.length >= maxGroupSize) {
      throw new Error(`Nhóm đã đủ thành viên (tối đa ${maxGroupSize} người)`);
    }

    // Check if group has active registration
    if (group.registrations.some(r => r.status !== 'REJECTED')) {
      throw new Error('Không thể gia nhập nhóm đã đăng ký đề tài');
    }

    // Check if user already requested to join this group
    const existingRequest = await prisma.groupMember.findFirst({
      where: {
        user_id: userId,
        group_id: groupId,
      },
    });

    if (existingRequest) {
      if (existingRequest.status === GroupMemberStatus.PENDING) {
        throw new Error('Bạn đã gửi yêu cầu gia nhập nhóm này');
      }
      if (existingRequest.status === GroupMemberStatus.ACCEPTED) {
        throw new Error('Bạn đã là thành viên của nhóm này');
      }
    }

    // Create join request with PENDING status
    const joinRequest = await prisma.groupMember.create({
      data: {
        group_id: groupId,
        user_id: userId,
        status: GroupMemberStatus.PENDING,
      },
    });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        user_id: userId,
        action: 'REQUEST_JOIN_GROUP',
        entity_type: 'GroupMember',
        entity_id: joinRequest.id,
        new_value: joinRequest,
      },
    });

    // Send notification to group leader
    const requester = await prisma.user.findUnique({ where: { id: userId } });
    await notificationService.createNotification(
      group.leader_id,
      'GROUP_JOIN_REQUEST',
      'Yêu cầu gia nhập nhóm mới',
      `Sinh viên "${requester?.full_name}" muốn gia nhập nhóm "${group.name}".`,
      joinRequest.id
    );

    return { message: 'Đã gửi yêu cầu gia nhập nhóm', request: joinRequest };

  }

  /**
   * Accept a join request (leader only)
   */
  async acceptJoinRequest(leaderId: string, requestId: string) {
    const request = await prisma.groupMember.findUnique({
      where: { id: requestId },
      include: {
        group: {
          include: {
            members: { where: { status: GroupMemberStatus.ACCEPTED } },
            registrations: true,
          },
        },
      },
    });

    if (!request) {
      throw new Error('Yêu cầu không tồn tại');
    }

    if (request.group.leader_id !== leaderId) {
      throw new Error(ERROR_CODES.NOT_GROUP_LEADER);
    }

    if (request.status !== GroupMemberStatus.PENDING) {
      throw new Error('Yêu cầu đã được xử lý');
    }

    if (request.group.members.length >= 2) {
      throw new Error('Nhóm đã đủ thành viên');
    }

    if (request.group.registrations.some(r => r.status !== 'REJECTED')) {
      throw new Error('Không thể thêm thành viên sau khi đăng ký đề tài');
    }

    // Accept the request
    const updatedRequest = await prisma.groupMember.update({
      where: { id: requestId },
      data: { status: GroupMemberStatus.ACCEPTED },
    });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        user_id: leaderId,
        action: 'ACCEPT_JOIN_REQUEST',
        entity_type: 'GroupMember',
        entity_id: requestId,
        new_value: updatedRequest,
      },
    });

    // Notify the requester
    await notificationService.createNotification(
      request.user_id,
      'GROUP_JOIN_ACCEPTED',
      'Yêu cầu gia nhập nhóm được chấp nhận',
      `Chúc mừng! Yêu cầu gia nhập nhóm "${request.group.name}" của bạn đã được chấp nhận.`,
      request.group_id
    );

    return { message: 'Đã chấp nhận thành viên vào nhóm', member: updatedRequest };

  }

  /**
   * Reject a join request (leader only)
   */
  async rejectJoinRequest(leaderId: string, requestId: string) {
    const request = await prisma.groupMember.findUnique({
      where: { id: requestId },
      include: { group: true },
    });

    if (!request) {
      throw new Error('Yêu cầu không tồn tại');
    }

    if (request.group.leader_id !== leaderId) {
      throw new Error(ERROR_CODES.NOT_GROUP_LEADER);
    }

    // Reject the request
    const updatedRequest = await prisma.groupMember.update({
      where: { id: requestId },
      data: { status: GroupMemberStatus.REJECTED },
    });

    // Notify the requester
    await notificationService.createNotification(
      request.user_id,
      'GROUP_JOIN_REJECTED',
      'Yêu cầu gia nhập nhóm bị từ chối',
      `Yêu cầu gia nhập nhóm "${request.group.name}" của bạn đã bị từ chối.`,
      request.group_id
    );

    // Create audit log
    await prisma.auditLog.create({
      data: {
        user_id: leaderId,
        action: 'REJECT_JOIN_REQUEST',
        entity_type: 'GroupMember',
        entity_id: requestId,
        old_value: request,
      },
    });

    return { message: 'Đã từ chối yêu cầu gia nhập' };
  }

  /**
   * Get pending join requests for a group (leader only)
   */
  async getPendingJoinRequests(leaderId: string, groupId: string) {
    const group = await prisma.group.findUnique({
      where: { id: groupId },
    });

    if (!group) {
      throw new Error(ERROR_CODES.GROUP_NOT_FOUND);
    }

    if (group.leader_id !== leaderId) {
      throw new Error(ERROR_CODES.NOT_GROUP_LEADER);
    }

    const pendingRequests = await prisma.groupMember.findMany({
      where: {
        group_id: groupId,
        status: GroupMemberStatus.PENDING,
      },
      include: {
        user: {
          select: {
            id: true,
            full_name: true,
            email: true,
            student_code: true,
          },
        },
      },
      orderBy: { joined_at: 'desc' },
    });

    return pendingRequests;
  }
}

export default new GroupService();
