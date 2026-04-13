import prisma from '../config/database';
import { SubmissionType, SubmissionStatus, StudentProgressStatus } from '@prisma/client';
import { ERROR_CODES, FILE_UPLOAD } from '../constants';
import notificationService from './notification.service';
import * as crypto from 'crypto';
import { AcademicAction, AcademicPolicy } from '../utils/academic-policy';
import { UserRole } from '@prisma/client';

import * as fs from 'fs/promises';
import * as path from 'path';

export class SubmissionService {
  async uploadFile(
    userId: string,
    topicId: string,
    groupId: string,
    type: SubmissionType,
    file: Express.Multer.File,
    comments?: string
  ) {
    // Verify user is in the group
    const membership = await prisma.groupMember.findFirst({
      where: {
        group_id: groupId,
        user_id: userId,
        status: 'ACCEPTED',
      },
    });

    if (!membership) {
      throw new Error('You are not a member of this group');
    }

    // Resolve Student Registration Context for Policy Evaluation
    // (Needed to check Midterm Status gates)
    const registration = await prisma.topicRegistration.findFirst({
      where: {
        topic_id: topicId,
        group_id: groupId,
      },
    });

    if (!registration) {
      throw new Error('Đăng ký đề tài của nhóm không tồn tại.');
    }

    // Resolve Semester
    const semester = await prisma.semester.findUnique({ where: { id: registration.semester_id } });
    if (!semester) throw new Error('Semester not found');

    // Resolve Action based on submission type
    let action = AcademicAction.SUBMIT_PROPOSAL;
    if (type === SubmissionType.THESIS) action = AcademicAction.SUBMIT_THESIS;
    if (type === SubmissionType.SOURCE_CODE) action = AcademicAction.SUBMIT_SOURCE_CODE;
    // (Note: Add SUBMIT_MIDTERM if a specific type is defined, for now we follow the type mapping)

    // Enforce Policy (This handles both the Phase and the Midterm Status Gate)
    AcademicPolicy.enforce(action, { id: userId, role: UserRole.STUDENT }, semester, registration);

    // Check file size
    const maxSize = FILE_UPLOAD.MAX_SIZE[type];
    if (file.size > maxSize) {
      throw new Error(`File size exceeds limit (${maxSize / 1024 / 1024}MB)`);
    }

    // Check file type
    const allowedTypes = FILE_UPLOAD.ALLOWED_TYPES[type];
    if (!allowedTypes.includes(file.mimetype)) {
      throw new Error(`File type not allowed. Allowed types: ${allowedTypes.join(', ')}`);
    }

    // Find or create submission
    let submission = await prisma.submission.findFirst({
      where: {
        topic_id: topicId,
        group_id: groupId,
        type: type,
      },
    });

    // Check if submission is locked
    if (submission?.is_locked) {
      throw new Error('Submission is locked. Cannot upload new files.');
    }

    // Generate checksum
    const checksum = crypto.createHash('sha256').update(file.buffer).digest('hex');

    // Generate secure filename
    const ext = path.extname(file.originalname);
    const secureFilename = `${crypto.randomBytes(16).toString('hex')}${ext}`;
    const filePath = path.join(FILE_UPLOAD.STORAGE_PATH, type.toLowerCase(), secureFilename);

    // Ensure directory exists
    await fs.mkdir(path.dirname(filePath), { recursive: true });

    // Save file
    await fs.writeFile(filePath, file.buffer);

    if (!submission) {
      // Create new submission
      submission = await prisma.submission.create({
        data: {
          topic_id: topicId,
          group_id: groupId,
          type: type,
          status: SubmissionStatus.DRAFT,
          current_version: 1,
        },
      });

      // Create first version
      await prisma.submissionVersion.create({
        data: {
          submission_id: submission.id,
          version: 1,
          file_url: filePath,
          file_name: file.originalname,
          file_size: file.size,
          mime_type: file.mimetype,
          checksum: checksum,
          uploaded_by: userId,
          comments: comments,
        },
      });
    } else {
      // Create new version
      const newVersion = submission.current_version + 1;

      await prisma.submissionVersion.create({
        data: {
          submission_id: submission.id,
          version: newVersion,
          file_url: filePath,
          file_name: file.originalname,
          file_size: file.size,
          mime_type: file.mimetype,
          checksum: checksum,
          uploaded_by: userId,
          comments: comments,
        },
      });

      // Update submission
      submission = await prisma.submission.update({
        where: { id: submission.id },
        data: {
          current_version: newVersion,
          status: SubmissionStatus.DRAFT,
        },
      });
    }

    // Update student progress status
    if (type === SubmissionType.PROPOSAL) {
      await prisma.topicRegistration.update({
        where: { id: registration.id },
        data: {
          student_progress_status: StudentProgressStatus.PROPOSAL_SUBMITTED,
        },
      });
    } else if (type === SubmissionType.THESIS) {
      await prisma.topicRegistration.update({
        where: { id: registration.id },
        data: {
          student_progress_status: StudentProgressStatus.THESIS_SUBMITTED,
        },
      });
    }

    // Create audit log
    await prisma.auditLog.create({
      data: {
        user_id: userId,
        action: 'UPLOAD_FILE',
        entity_type: 'Submission',
        entity_id: submission.id,
        new_value: {
          type: type,
          version: submission.current_version,
          filename: file.originalname,
        },
      },
    });

    // Send notification to supervisor
    const student = await prisma.user.findUnique({ where: { id: userId } });
    const topic = await prisma.topic.findUnique({ where: { id: topicId } });
    if (topic) {
      await notificationService.notifySubmissionUploaded(
        topicId,
        topic.supervisor_id,
        registration.group_id ? `Nhóm ${registration.group_id.substring(0, 8)}` : student?.full_name || 'Sinh viên',
        type
      );
    }

    return submission;

  }

  async approveSubmission(userId: string, submissionId: string) {
    const submission = await prisma.submission.findUnique({
      where: { id: submissionId },
      include: {
        topic: true,
      },
    });

    if (!submission) {
      throw new Error('Submission not found');
    }

    // Check if user is the supervisor
    if (submission.topic.supervisor_id !== userId) {
      throw new Error(ERROR_CODES.FORBIDDEN);
    }

    // Can only approve THESIS type
    if (submission.type !== SubmissionType.THESIS) {
      throw new Error('Can only approve thesis submissions');
    }

    // Check status
    if (!([SubmissionStatus.DRAFT, SubmissionStatus.REVISION_REQUIRED] as SubmissionStatus[]).includes(submission.status)) {
      throw new Error('Invalid submission status');
    }

    // Get department config for required submissions
    const topic = await prisma.topic.findUnique({
      where: { id: submission.topic_id },
      include: { department: true }
    });

    const requiredTypes = topic?.department.required_submission_types_for_review || [
      SubmissionType.PROPOSAL,
      SubmissionType.THESIS,
      SubmissionType.SOURCE_CODE,
    ];

    const submittedTypes = await prisma.submission.findMany({
      where: {
        topic_id: submission.topic_id,
        group_id: submission.group_id,
        type: { in: requiredTypes },
      },
      select: { type: true },
    });

    const missingTypes = requiredTypes.filter(
      type => !submittedTypes.some(s => s.type === type)
    );

    if (missingTypes.length > 0) {
      throw new Error(`Missing required submissions: ${missingTypes.join(', ')}`);
    }

    // Update submission
    await prisma.submission.update({
      where: { id: submissionId },
      data: {
        status: SubmissionStatus.APPROVED_FOR_REVIEW,
        approved_by: userId,
        approved_at: new Date(),
      },
    });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        user_id: userId,
        action: 'APPROVE_SUBMISSION',
        entity_type: 'Submission',
        entity_id: submissionId,
        new_value: { status: 'APPROVED_FOR_REVIEW' },
      },
    });

    // Send notification to students
    const members = await prisma.groupMember.findMany({
      where: { group_id: submission.group_id, status: 'ACCEPTED' },
      select: { user_id: true },
    });
    const studentIds = members.map(m => m.user_id);
    
    await notificationService.notifySubmissionStatus(
      studentIds,
      submission.topic.title,
      submission.type,
      true
    );

    return { message: 'Submission approved for review' };

  }

  async rejectSubmission(userId: string, submissionId: string, rejectionReason: string) {
    if (rejectionReason.length < 20) {
      throw new Error('Rejection reason must be at least 20 characters');
    }

    const submission = await prisma.submission.findUnique({
      where: { id: submissionId },
      include: {
        topic: true,
      },
    });

    if (!submission) {
      throw new Error('Submission not found');
    }

    // Check if user is the supervisor
    if (submission.topic.supervisor_id !== userId) {
      throw new Error(ERROR_CODES.FORBIDDEN);
    }

    // Update submission
    await prisma.submission.update({
      where: { id: submissionId },
      data: {
        status: SubmissionStatus.REVISION_REQUIRED,
        rejection_reason: rejectionReason,
      },
    });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        user_id: userId,
        action: 'REJECT_SUBMISSION',
        entity_type: 'Submission',
        entity_id: submissionId,
        new_value: { status: 'REVISION_REQUIRED', rejection_reason: rejectionReason },
      },
    });

    // Send notification to students
    const members = await prisma.groupMember.findMany({
      where: { group_id: submission.group_id, status: 'ACCEPTED' },
      select: { user_id: true },
    });
    const studentIds = members.map(m => m.user_id);

    await notificationService.notifySubmissionStatus(
      studentIds,
      submission.topic.title,
      submission.type,
      false,
      rejectionReason
    );

    return { message: 'Submission requires revision' };

  }

  async lockSubmission(userId: string, submissionId: string) {
    const submission = await prisma.submission.findUnique({
      where: { id: submissionId },
      include: {
        topic: {
          include: {
            assignments: true,
          },
        },
      },
    });

    if (!submission) {
      throw new Error('Submission not found');
    }

    // Check status
    if (!([SubmissionStatus.APPROVED_FOR_REVIEW, SubmissionStatus.FINAL_APPROVED] as SubmissionStatus[]).includes(submission.status)) {
      throw new Error('Can only lock approved submissions');
    }

    // Check if reviewers are assigned
    const hasReviewers = submission.topic.assignments.some(a => a.assignment_type === 'REVIEWER');
    if (!hasReviewers) {
      throw new Error('Must assign reviewers before locking submission');
    }

    // Lock submission
    await prisma.submission.update({
      where: { id: submissionId },
      data: {
        is_locked: true,
        locked_by: userId,
        locked_at: new Date(),
        status: SubmissionStatus.LOCKED,
      },
    });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        user_id: userId,
        action: 'LOCK_SUBMISSION',
        entity_type: 'Submission',
        entity_id: submissionId,
        new_value: { is_locked: true },
      },
    });

    // TODO: Send notification to students and reviewers

    return { message: 'Submission locked successfully' };
  }

  async unlockSubmission(userId: string, submissionId: string, reason: string) {
    if (reason.length < 20) {
      throw new Error('Reason must be at least 20 characters');
    }

    const submission = await prisma.submission.findUnique({
      where: { id: submissionId },
      include: {
        topic: {
          include: {
            grades: true,
          },
        },
      },
    });

    if (!submission) {
      throw new Error('Submission not found');
    }

    if (!submission.is_locked) {
      throw new Error('Submission is not locked');
    }

    // Check if any grades have been submitted
    if (submission.topic.grades.length > 0) {
      throw new Error('Cannot unlock submission after grades have been submitted');
    }

    // Unlock submission
    await prisma.submission.update({
      where: { id: submissionId },
      data: {
        is_locked: false,
        locked_by: null,
        locked_at: null,
        status: SubmissionStatus.REVISION_REQUIRED,
      },
    });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        user_id: userId,
        action: 'UNLOCK_SUBMISSION',
        entity_type: 'Submission',
        entity_id: submissionId,
        new_value: { is_locked: false, reason: reason },
      },
    });

    // TODO: Send notification

    return { message: 'Submission unlocked' };
  }

  async getSubmissions(userId: string, topicId?: string, groupId?: string) {
    const where: any = {};

    if (topicId) {
      where.topic_id = topicId;
    }

    if (groupId) {
      where.group_id = groupId;
    }

    const submissions = await prisma.submission.findMany({
      where,
      include: {
        topic: {
          select: {
            id: true,
            title: true,
          },
        },
        group: {
          select: {
            id: true,
            name: true,
          },
        },
        versions: {
          orderBy: { version: 'desc' },
          take: 1,
          include: {
            uploader: {
              select: {
                id: true,
                full_name: true,
              },
            },
          },
        },
      },
      orderBy: { updated_at: 'desc' },
    });

    return submissions;
  }

  async getSubmissionVersions(userId: string, submissionId: string) {
    const submission = await prisma.submission.findUnique({
      where: { id: submissionId },
    });

    if (!submission) {
      throw new Error('Submission not found');
    }

    const versions = await prisma.submissionVersion.findMany({
      where: { submission_id: submissionId },
      include: {
        uploader: {
          select: {
            id: true,
            full_name: true,
            email: true,
          },
        },
      },
      orderBy: { version: 'desc' },
    });

    return versions;
  }

  async downloadFile(userId: string, versionId: string) {
    const version = await prisma.submissionVersion.findUnique({
      where: { id: versionId },
      include: {
        submission: {
          include: {
            topic: true,
            group: {
              include: {
                members: true,
              },
            },
          },
        },
      },
    });

    if (!version) {
      throw new Error('Version not found');
    }

    // Check permissions
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new Error(ERROR_CODES.NOT_FOUND);
    }

    const isMember = version.submission.group.members.some(m => m.user_id === userId);
    const isSupervisor = version.submission.topic.supervisor_id === userId;
    const isReviewer = await prisma.assignment.findFirst({
      where: {
        topic_id: version.submission.topic_id,
        reviewer_id: userId,
      },
    });
    const isHead = user.role === 'HEAD';

    if (!isMember && !isSupervisor && !isReviewer && !isHead) {
      throw new Error(ERROR_CODES.FORBIDDEN);
    }

    // Return file path for download
    return {
      filePath: version.file_url,
      fileName: version.file_name,
      mimeType: version.mime_type,
    };
  }
}

export default new SubmissionService();
