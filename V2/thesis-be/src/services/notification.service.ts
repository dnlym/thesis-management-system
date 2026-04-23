import prisma from '../config/database';
import { NOTIFICATION_TYPES } from '../constants';

export class NotificationService {
  async createNotification(
    userId: string,
    type: string,
    title: string,
    content: string,
    relatedId?: string
  ) {
    const notification = await prisma.notification.create({
      data: {
        user_id: userId,
        type,
        title,
        content,
        related_id: relatedId,
      },
    });

    return notification;
  }

  async createBulkNotifications(
    userIds: string[],
    type: string,
    title: string,
    content: string,
    relatedId?: string
  ) {
    const notifications = await prisma.notification.createMany({
      data: userIds.map(userId => ({
        user_id: userId,
        type,
        title,
        content,
        related_id: relatedId,
      })),
    });

    return notifications;
  }

  async getNotifications(userId: string, unreadOnly: boolean = false) {
    const where: any = { user_id: userId };

    if (unreadOnly) {
      where.is_read = false;
    }

    const notifications = await prisma.notification.findMany({
      where,
      orderBy: { created_at: 'desc' },
      take: 50,
    });

    return notifications;
  }

  async markAsRead(userId: string, notificationId: string) {
    const notification = await prisma.notification.findUnique({
      where: { id: notificationId },
    });

    if (!notification || notification.user_id !== userId) {
      throw new Error('Notification not found');
    }

    await prisma.notification.update({
      where: { id: notificationId },
      data: { is_read: true },
    });

    return { message: 'Notification marked as read' };
  }

  async markAllAsRead(userId: string) {
    await prisma.notification.updateMany({
      where: {
        user_id: userId,
        is_read: false,
      },
      data: { is_read: true },
    });

    return { message: 'All notifications marked as read' };
  }

  async getUnreadCount(userId: string) {
    const count = await prisma.notification.count({
      where: {
        user_id: userId,
        is_read: false,
      },
    });

    return { count };
  }

  async deleteNotification(userId: string, notificationId: string) {
    const notification = await prisma.notification.findUnique({
      where: { id: notificationId },
    });

    if (!notification || notification.user_id !== userId) {
      throw new Error('Notification not found');
    }

    await prisma.notification.delete({
      where: { id: notificationId },
    });

    return { message: 'Notification deleted' };
  }

  // Helper methods for specific notification types
  async notifyTopicApproved(topicId: string, supervisorId: string) {
    const topic = await prisma.topic.findUnique({ where: { id: topicId } });
    if (!topic) return;

    await this.createNotification(
      supervisorId,
      NOTIFICATION_TYPES.TOPIC_APPROVED,
      'Đề tài đã được duyệt',
      `Đề tài "${topic.title}" đã được trưởng bộ môn phê duyệt.`,
      topicId
    );
  }

  async notifyTopicRejected(topicId: string, supervisorId: string, reason: string) {
    const topic = await prisma.topic.findUnique({ where: { id: topicId } });
    if (!topic) return;

    await this.createNotification(
      supervisorId,
      NOTIFICATION_TYPES.TOPIC_REJECTED,
      'Đề tài bị từ chối',
      `Đề tài "${topic.title}" đã bị từ chối. Lý do: ${reason}`,
      topicId
    );
  }

  async notifyTopicRequireEdit(topicId: string, supervisorId: string, notes: string) {
    const topic = await prisma.topic.findUnique({ where: { id: topicId } });
    if (!topic) return;

    await this.createNotification(
      supervisorId,
      NOTIFICATION_TYPES.TOPIC_REQUIRE_EDIT,
      'Yêu cầu chỉnh sửa đề tài',
      `Đề tài "${topic.title}" cần được chỉnh sửa theo yêu cầu của trưởng bộ môn: ${notes}`,
      topicId
    );
  }

  async notifyRegistrationConfirmed(registrationId: string) {
    const registration = await prisma.topicRegistration.findUnique({
      where: { id: registrationId },
      include: {
        group: {
          include: {
            members: {
              where: { status: 'ACCEPTED' },
            },
          },
        },
        topic: true,
      },
    });

    if (!registration || !registration.group) return;

    const memberIds = registration.group.members.map(m => m.user_id);

    await this.createBulkNotifications(
      memberIds,
      NOTIFICATION_TYPES.REGISTRATION_CONFIRMED,
      'Đăng ký đề tài thành công',
      `Đăng ký đề tài "${registration.topic.title}" đã được GVHD xác nhận.`,
      registrationId
    );
  }

  async notifyRegistrationRejected(registrationId: string, studentId: string, reason: string) {
    const registration = await prisma.topicRegistration.findUnique({
      where: { id: registrationId },
      include: { topic: true },
    });
    if (!registration) return;

    await this.createNotification(
      studentId,
      NOTIFICATION_TYPES.REGISTRATION_REJECTED,
      'Đăng ký đề tài bị từ chối',
      `Đăng ký đề tài "${registration.topic.title}" của bạn đã bị từ chối. Lý do: ${reason}`,
      registrationId
    );
  }

  async notifyProgressUpdated(registrationId: string, studentId: string, status: string) {
    const registration = await prisma.topicRegistration.findUnique({
      where: { id: registrationId },
      include: { topic: true },
    });
    if (!registration) return;

    await this.createNotification(
      studentId,
      'PROGRESS_UPDATED',
      'Cập nhật tiến độ',
      `Tiến độ của bạn trong đề tài "${registration.topic.title}" đã được cập nhật thành: ${status}`,
      registrationId
    );
  }

  async notifyBulkProgressUpdated(studentIds: string[], topicTitle: string, status: string, feedback?: string) {
    const content = feedback
      ? `GVHD đã cập nhật trạng thái tiến độ của bạn thành "${status}". Phản hồi: ${feedback}`
      : `GVHD đã cập nhật trạng thái tiến độ của bạn thành "${status}".`;

    await this.createBulkNotifications(
      studentIds,
      'PROGRESS_UPDATED',
      'Cập nhật tiến độ',
      content,
      ''
    );
  }

  async notifyBulkMidtermStatusUpdated(studentIds: string[], topicTitle: string, status: string) {
    await this.createBulkNotifications(
      studentIds,
      'MIDTERM_RESULT',
      'Kết quả giữa kỳ',
      `Bạn đã được đánh giá "${status === 'PASS' ? 'Đạt' : 'Không đạt'}" trong đợt đánh giá giữa kỳ của đề tài "${topicTitle}".`,
      ''
    );
  }

  async notifyGroupInvitation(inviteeId: string, inviterName: string, topicTitle: string, inviteId: string) {
    await this.createNotification(
      inviteeId,
      NOTIFICATION_TYPES.GROUP_INVITATION,
      'Lời mời vào nhóm',
      `Bạn nhận được lời mời tham gia nhóm từ "${inviterName}" cho đề tài "${topicTitle}".`,
      inviteId
    );
  }

  async notifyGroupInvitationResponse(inviterId: string, inviteeName: string, accepted: boolean, topicTitle: string) {
    await this.createNotification(
      inviterId,
      NOTIFICATION_TYPES.GROUP_INVITATION,
      'Phản hồi lời mời vào nhóm',
      `"${inviteeName}" đã ${accepted ? 'chấp nhận' : 'từ chối'} lời mời vào nhóm của bạn cho đề tài "${topicTitle}".`,
      ''
    );
  }



  async notifyAssignmentCreated(assignmentId: string) {
    const assignment = await prisma.assignment.findUnique({
      where: { id: assignmentId },
      include: { topic: true },
    });
    if (!assignment) return;

    await this.createNotification(
      assignment.reviewer_id,
      NOTIFICATION_TYPES.ASSIGNMENT_CREATED,
      'Phân công phản biện mới',
      `Bạn được phân công ${assignment.assignment_type === 'REVIEWER' ? 'phản biện' : 'hội đồng'} cho đề tài "${assignment.topic.title}".`,
      assignmentId
    );
  }

  async notifyExtraPointResponse(studentId: string, approved: boolean, points: number, reason?: string) {
    await this.createNotification(
      studentId,
      approved ? NOTIFICATION_TYPES.EXTRA_POINT_APPROVED : NOTIFICATION_TYPES.EXTRA_POINT_REJECTED,
      `Yêu cầu điểm cộng đã được ${approved ? 'duyệt' : 'từ chối'}`,
      approved 
        ? `Yêu cầu điểm cộng của bạn đã được duyệt với ${points} điểm.`
        : `Yêu cầu điểm cộng của bạn đã bị từ chối.${reason ? ` Lý do: ${reason}` : ''}`,
      ''
    );
  }

  async notifyDefenseScheduled(params: {
    userIds: string[];
    topicId: string;
    date: string;
    startTime: string;
    endTime?: string;
    room: string;
  }) {
    const { userIds, topicId, date, startTime, endTime, room } = params;
    const topic = await prisma.topic.findUnique({ where: { id: topicId } });
    if (!topic) return;

    const timeRange = endTime ? `từ ${startTime} đến ${endTime}` : `lúc ${startTime}`;

    await this.createBulkNotifications(
      userIds,
      NOTIFICATION_TYPES.DEFENSE_SCHEDULED,
      'Lịch bảo vệ khóa luận',
      `Lịch bảo vệ cho đề tài "${topic.title}" đã được sắp xếp vào ngày ${date}, ${timeRange} tại phòng ${room}.`,
      topicId
    );
  }

  async notifyScoreFinalized(topicId: string) {
    const topic = await prisma.topic.findUnique({
      where: { id: topicId },
      include: {
        registrations: {
          include: { student: true },
        },
        final_scores: true,
      },
    });

    if (!topic || topic.final_scores.length === 0) return;

    for (const registration of topic.registrations) {
      const studentFinalScore = topic.final_scores.find(fs => fs.student_id === registration.student_id);
      if (studentFinalScore) {
        await this.createNotification(
          registration.student_id,
          NOTIFICATION_TYPES.SCORE_FINALIZED,
          'Điểm đã được công bố',
          `Điểm khóa luận của bạn đã được công bố: ${studentFinalScore.final_score.toFixed(2)}/10 (${studentFinalScore.grade_classification})`,
          topicId
        );
      }
    }
  }
}

export default new NotificationService();
