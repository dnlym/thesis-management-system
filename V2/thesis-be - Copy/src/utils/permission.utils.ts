import { UserRole, AssignmentType } from '@prisma/client';
import prisma from '../config/database';

/**
 * Check if a user is the supervisor of a topic
 */
export async function isSupervisor(userId: string, topicId: string): Promise<boolean> {
  const topic = await prisma.topic.findUnique({
    where: { id: topicId },
    select: { supervisor_id: true }
  });
  return topic?.supervisor_id === userId;
}

/**
 * Check if a user is a reviewer for a topic
 */
export async function isReviewer(userId: string, topicId: string): Promise<boolean> {
  const assignment = await prisma.assignment.findFirst({
    where: {
      topic_id: topicId,
      reviewer_id: userId,
      assignment_type: AssignmentType.REVIEWER
    }
  });
  return !!assignment;
}

/**
 * Check if a user is a committee member for a topic
 */
export async function isCommitteeMember(userId: string, topicId: string): Promise<boolean> {
  const assignment = await prisma.assignment.findFirst({
    where: {
      topic_id: topicId,
      reviewer_id: userId,
      assignment_type: AssignmentType.COMMITTEE
    }
  });
  return !!assignment;
}

/**
 * Check if a user can edit a topic
 * Supervisor can edit in DRAFT/REQUIRE_EDIT
 * HEAD can edit anytime (or restricted)
 */
export async function canEditTopic(user: { id: string, role: UserRole }, topicId: string): Promise<boolean> {
  if (user.role === UserRole.ADMIN || user.role === UserRole.HEAD) return true;
  
  if (user.role === UserRole.LECTURER) {
    const topic = await prisma.topic.findUnique({
      where: { id: topicId },
      select: { supervisor_id: true, status: true }
    });
    
    if (!topic || topic.supervisor_id !== user.id) return false;
    
    // Lecturers can only edit in certain statuses
    return ['DRAFT', 'REQUIRE_EDIT', 'PENDING_APPROVAL'].includes(topic.status);
  }
  
  return false;
}

/**
 * Check if a user can grade a topic
 */
export async function canGrade(user: { id: string, role: UserRole }, topicId: string): Promise<boolean> {
  if (user.role === UserRole.ADMIN || user.role === UserRole.HEAD) return true;
  
  // Check if they are supervisor, reviewer, or committee member
  const [supervisor, reviewer, committee] = await Promise.all([
    isSupervisor(user.id, topicId),
    isReviewer(user.id, topicId),
    isCommitteeMember(user.id, topicId)
  ]);
  
  return supervisor || reviewer || committee;
}
