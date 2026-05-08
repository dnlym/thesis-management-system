import { GroupMemberStatus } from '@prisma/client';

export interface CreateGroupRequest {
  name: string;
  semesterId: string;
}

export interface InviteMemberRequest {
  groupId: string;
  userId: string;
}

export interface AcceptInvitationRequest {
  groupId: string;
}

export interface RejectInvitationRequest {
  groupId: string;
}

export interface RemoveMemberRequest {
  groupId: string;
  userId: string;
}


