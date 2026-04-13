import prisma from '../config/database';
import { ExtraPointStatus, MidtermStatus } from '@prisma/client';
import { SubmitExtraPointRequest, ApproveExtraPointRequest, RejectExtraPointRequest } from '../types';
import { ERROR_CODES, VALIDATION, GRADING, FILE_UPLOAD } from '../constants';
import notificationService from './notification.service';
import * as fs from 'fs/promises';

import * as path from 'path';
import * as crypto from 'crypto';

export class ExtraPointsService {
  /**
   * Submit extra points request (after midterm PASS, before reviewer assignment)
   * Each student submits individually
   */
  async submitRequest(userId: string, data: SubmitExtraPointRequest) {
    // Validate reason length
    if (data.reason.length < VALIDATION.REASON.EXTRA_POINT_MIN) {
      throw new Error(`Lý do phải có ít nhất ${VALIDATION.REASON.EXTRA_POINT_MIN} ký tự`);
    }

    // Validate points requested
    if (data.pointsRequested <= 0 || data.pointsRequested > GRADING.CONFIG.MAX_EXTRA_POINTS) {
      throw new Error(`Điểm cộng phải từ 0 đến ${GRADING.CONFIG.MAX_EXTRA_POINTS}`);
    }

    // Check student's registration
    const registration = await prisma.topicRegistration.findFirst({
      where: {
        student_id: userId,
        topic_id: data.topicId,
      },
      include: {
        topic: {
          include: {
            final_scores: {
              where: { student_id: userId }
            },
          },
        },
      },
    });

    if (!registration) {
      throw new Error('Bạn chưa đăng ký đề tài này');
    }

    // Check if midterm is PASS (required before extra points submission)
    if (registration.midterm_status !== MidtermStatus.PASS) {
      throw new Error('Bạn cần đạt điểm giữa kỳ (PASS) trước khi submit điểm cộng NCKH');
    }

    // Check if already confirmed
    if (registration.extra_points_confirmed) {
      throw new Error('Bạn đã xác nhận điểm cộng cho đề tài này');
    }

    // Check if already has a pending or approved request
    const existingRequest = await prisma.extraPointRequest.findFirst({
      where: {
        student_id: userId,
        topic_id: data.topicId,
        status: { in: [ExtraPointStatus.PENDING, ExtraPointStatus.APPROVED] },
      },
    });

    if (existingRequest) {
      throw new Error('Bạn đã có yêu cầu điểm cộng đang chờ duyệt hoặc đã được duyệt');
    }

    // Check if final score is finalized (if somehow already exists)
    if (registration.topic.final_scores?.[0]?.finalized) {
      throw new Error('Không thể submit điểm cộng sau khi điểm cuối kỳ đã được duyệt');
    }

    // Create request
    const request = await prisma.extraPointRequest.create({
      data: {
        student_id: userId,
        topic_id: data.topicId,
        reason: data.reason,
        points_requested: data.pointsRequested,
        evidence_url: data.evidenceUrl,
        evidence_versions: data.evidenceVersions,
        status: ExtraPointStatus.PENDING,
      },
    });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        user_id: userId,
        action: 'REQUEST_EXTRA_POINTS',
        entity_type: 'ExtraPointRequest',
        entity_id: request.id,
        new_value: request,
      },
    });

    // Send notification to HEAD
    const student = await prisma.user.findUnique({ where: { id: userId } });
    const head = await prisma.user.findFirst({ 
      where: { role: 'HEAD', departmentId: student?.departmentId } 
    });
    
    if (head) {
      await notificationService.createNotification(
        head.id,
        'EXTRA_POINT_REQUEST',
        'Yêu cầu điểm cộng NCKH mới',
        `Sinh viên "${student?.full_name}" đã gửi yêu cầu cộng điểm NCKH cho đề tài "${registration.topic.title}".`,
        request.id
      );
    }

    return request;

  }

  async approveRequest(userId: string, requestId: string, approvedPoints: number) {
    const request = await prisma.extraPointRequest.findUnique({
      where: { id: requestId },
      include: {
        topic: {
          include: {
            final_scores: true,
          },
        },
      },
    });

    if (!request) {
      throw new Error('Không tìm thấy yêu cầu');
    }

    if (request.status !== ExtraPointStatus.PENDING) {
      throw new Error('Yêu cầu đã được xử lý');
    }

    // 1. Permissions Check: Only ADMIN, HEAD, or the topic's SUPERVISOR can approve
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        supervised_topics: {
          where: { id: request.topic_id }
        }
      }
    });

    const isSupervisor = (user?.supervised_topics?.length || 0) > 0;
    const isAdminOrHead = user?.role === 'ADMIN' || user?.role === 'HEAD';

    if (!isAdminOrHead && !isSupervisor) {
      throw new Error('Bạn không có quyền duyệt điểm cộng cho đề tài này');
    }

    // 2. Validate approved points against request and global max
    if (approvedPoints <= 0 || approvedPoints > GRADING.CONFIG.MAX_EXTRA_POINTS) {
      throw new Error(`Điểm duyệt phải từ 0 đến ${GRADING.CONFIG.MAX_EXTRA_POINTS}`);
    }

    if (approvedPoints > request.points_requested) {
      throw new Error('Điểm duyệt không được vượt quá điểm yêu cầu');
    }

    // 3. Update request
    await prisma.extraPointRequest.update({
      where: { id: requestId },
      data: {
        status: ExtraPointStatus.APPROVED,
        points_requested: approvedPoints, // Set the final points to what was approved
        reviewed_by: userId,
        reviewed_at: new Date(),
      },
    });

    // Mark student's registration as confirmed for extra points
    await prisma.topicRegistration.updateMany({
      where: {
        student_id: request.student_id,
        topic_id: request.topic_id,
      },
      data: {
        extra_points_confirmed: true,
      },
    });

    // Update final score (if exists - for post-defense flow)
    const studentFinalScore = request.topic.final_scores.find(fs => fs.student_id === request.student_id);
    if (studentFinalScore) {
      const newExtraPoints = studentFinalScore.extra_points + approvedPoints;
      const newFinalScore = Math.min(
        studentFinalScore.computed_score + newExtraPoints,
        10.0
      );

      const gradeClassification = this.getGradeClassification(newFinalScore);

      await prisma.finalScore.update({
        where: { topic_id_student_id: { topic_id: request.topic_id, student_id: request.student_id } },
        data: {
          extra_points: newExtraPoints,
          final_score: newFinalScore,
          grade_classification: gradeClassification,
        },
      });
    }

    // Create audit log
    await prisma.auditLog.create({
      data: {
        user_id: userId,
        action: 'APPROVE_EXTRA_POINTS',
        entity_type: 'ExtraPointRequest',
        entity_id: requestId,
        new_value: { status: 'APPROVED', approved_points: approvedPoints },
      },
    });

    // Send notification to student
    await notificationService.createNotification(
      request.student_id,
      'EXTRA_POINT_APPROVED',
      'Yêu cầu điểm cộng được chấp nhận',
      `Chúc mừng! Yêu cầu điểm cộng NCKH cho đề tài "${request.topic.title}" của bạn đã được duyệt với ${approvedPoints} điểm.`,
      request.id
    );

    return { message: 'Đã duyệt điểm cộng NCKH' };

  }

  async rejectRequest(userId: string, requestId: string, rejectionReason: string) {
    if (rejectionReason.length < 50) {
      throw new Error('Rejection reason must be at least 50 characters');
    }

    const request = await prisma.extraPointRequest.findUnique({
      where: { id: requestId },
    });

    if (!request) {
      throw new Error('Request not found');
    }

    if (request.status !== ExtraPointStatus.PENDING) {
      throw new Error('Request already processed');
    }

    // Update request
    await prisma.extraPointRequest.update({
      where: { id: requestId },
      data: {
        status: ExtraPointStatus.REJECTED,
        reviewed_by: userId,
        reviewed_at: new Date(),
        rejection_reason: rejectionReason,
      },
    });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        user_id: userId,
        action: 'REJECT_EXTRA_POINTS',
        entity_type: 'ExtraPointRequest',
        entity_id: requestId,
        new_value: { status: 'REJECTED', rejection_reason: rejectionReason },
      },
    });

    // Send notification to student
    const requestWithTopic = await prisma.extraPointRequest.findUnique({
      where: { id: requestId },
      include: { topic: true }
    });
    
    await notificationService.createNotification(
      request.student_id,
      'EXTRA_POINT_REJECTED',
      'Yêu cầu điểm cộng bị từ chối',
      `Yêu cầu điểm cộng NCKH cho đề tài "${requestWithTopic?.topic.title}" của bạn đã bị từ chối. Lý do: ${rejectionReason}`,
      requestId
    );

    return { message: 'Extra points request rejected' };

  }

  async getRequests(userId: string, filters?: {
    topicId?: string;
    status?: ExtraPointStatus;
  }) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new Error(ERROR_CODES.NOT_FOUND);
    }

    const where: any = {};

    // Apply filters
    if (filters?.topicId) {
      where.topic_id = filters.topicId;
    }
    if (filters?.status) {
      where.status = filters.status;
    }

    // Role-based filtering
    if (user.role === 'STUDENT') {
      where.student_id = userId;
    } else if (user.role === 'HEAD') {
      where.topic = {
        departmentId: user.departmentId,
      };
    }

    const requests = await prisma.extraPointRequest.findMany({
      where,
      include: {
        student: {
          select: {
            id: true,
            full_name: true,
            email: true,
            student_code: true,
          },
        },
        topic: {
          select: {
            id: true,
            title: true,
            status: true,
            semester: {
              select: {
                id: true,
                name: true,
              }
            }
          },
        },
        reviewer: {
          select: {
            id: true,
            full_name: true,
          },
        },
      },
      orderBy: { created_at: 'desc' },
    });

    return requests;
  }

  async getRequestById(userId: string, requestId: string) {
    const request = await prisma.extraPointRequest.findUnique({
      where: { id: requestId },
      include: {
        student: {
          select: {
            id: true,
            full_name: true,
            email: true,
            student_code: true,
            phone: true,
          },
        },
        topic: {
          include: {
            supervisor: {
              select: {
                id: true,
                full_name: true,
                email: true,
              },
            },
            final_scores: true,
          },
        },
        reviewer: {
          select: {
            id: true,
            full_name: true,
            email: true,
          },
        },
      },
    });

    if (!request) {
      throw new Error('Request not found');
    }

    return request;
  }

  async withdrawRequest(userId: string, requestId: string) {
    const request = await prisma.extraPointRequest.findUnique({
      where: { id: requestId },
    });

    if (!request) {
      throw new Error('Request not found');
    }

    if (request.student_id !== userId) {
      throw new Error(ERROR_CODES.FORBIDDEN);
    }

    if (request.status !== ExtraPointStatus.PENDING) {
      throw new Error('Can only withdraw pending requests');
    }

    // Delete request
    await prisma.extraPointRequest.delete({
      where: { id: requestId },
    });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        user_id: userId,
        action: 'WITHDRAW_EXTRA_POINTS',
        entity_type: 'ExtraPointRequest',
        entity_id: requestId,
        old_value: request,
      },
    });

    return { message: 'Request withdrawn' };
  }

  async uploadEvidence(file: Express.Multer.File) {
    if (!file) {
      throw new Error('No file provided');
    }

    // Generate secure filename
    const ext = path.extname(file.originalname);
    const secureFilename = `${crypto.randomBytes(16).toString('hex')}${ext}`;
    // Use 'extra_points' folder
    const relativeDir = path.join('extra_points');
    const absoluteDir = path.join(FILE_UPLOAD.STORAGE_PATH, relativeDir);
    const filePath = path.join(absoluteDir, secureFilename);

    // Ensure directory exists
    await fs.mkdir(absoluteDir, { recursive: true });

    // Save file
    await fs.writeFile(filePath, file.buffer);

    // Return path accessible via static serve (usually starting with /uploads/...)
    // Assuming backend serves FILE_UPLOAD.STORAGE_PATH at /uploads
    const publicUrl = `/uploads/${relativeDir}/${secureFilename}`.replace(/\\/g, '/');

    return {
      url: publicUrl,
      filename: secureFilename,
      originalName: file.originalname
    };
  }

  /**
   * Confirm that student has NO extra points (no research achievements)
   * This allows reviewer assignment to proceed
   */
  async confirmNoExtraPoints(userId: string, topicId: string) {
    // Check student's registration
    const registration = await prisma.topicRegistration.findFirst({
      where: {
        student_id: userId,
        topic_id: topicId,
      },
    });

    if (!registration) {
      throw new Error('Bạn chưa đăng ký đề tài này');
    }

    // Check if midterm is PASS
    if (registration.midterm_status !== 'PASS') {
      throw new Error('Bạn cần đạt điểm giữa kỳ (PASS) trước khi xác nhận điểm cộng');
    }

    // Check if already confirmed
    if (registration.extra_points_confirmed) {
      throw new Error('Bạn đã xác nhận điểm cộng cho đề tài này');
    }

    // Check if has pending request
    const pendingRequest = await prisma.extraPointRequest.findFirst({
      where: {
        student_id: userId,
        topic_id: topicId,
        status: ExtraPointStatus.PENDING,
      },
    });

    if (pendingRequest) {
      throw new Error('Bạn có yêu cầu điểm cộng đang chờ duyệt. Vui lòng rút yêu cầu trước.');
    }

    // Update registration
    await prisma.topicRegistration.updateMany({
      where: {
        student_id: userId,
        topic_id: topicId,
      },
      data: {
        extra_points_confirmed: true,
      },
    });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        user_id: userId,
        action: 'CONFIRM_NO_EXTRA_POINTS',
        entity_type: 'TopicRegistration',
        entity_id: registration.id,
        new_value: { extra_points_confirmed: true, has_extra_points: false },
      },
    });

    return { message: 'Đã xác nhận không có điểm cộng NCKH' };
  }

  /**
   * Get student's extra points confirmation status for a topic
   */
  async getMyExtraPointsStatus(userId: string, topicId: string) {
    const registration = await prisma.topicRegistration.findFirst({
      where: {
        student_id: userId,
        topic_id: topicId,
      },
    });

    if (!registration) {
      throw new Error('Bạn chưa đăng ký đề tài này');
    }

    const request = await prisma.extraPointRequest.findFirst({
      where: {
        student_id: userId,
        topic_id: topicId,
      },
      orderBy: { created_at: 'desc' },
    });

    return {
      midtermPassed: registration.midterm_status === 'PASS',
      confirmed: registration.extra_points_confirmed,
      hasRequest: !!request,
      request: request,
    };
  }

  private getGradeClassification(score: number): string {
    if (score >= GRADING.CLASSIFICATION.EXCELLENT.min) return GRADING.CLASSIFICATION.EXCELLENT.label;
    if (score >= GRADING.CLASSIFICATION.GOOD.min) return GRADING.CLASSIFICATION.GOOD.label;
    if (score >= GRADING.CLASSIFICATION.FAIR.min) return GRADING.CLASSIFICATION.FAIR.label;
    if (score >= GRADING.CLASSIFICATION.AVERAGE.min) return GRADING.CLASSIFICATION.AVERAGE.label;
    return GRADING.CLASSIFICATION.FAIL.label;
  }
}

export default new ExtraPointsService();
