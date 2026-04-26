import { UserRole } from '@prisma/client';

export interface PermissionDef {
  code: string;
  name: string;
  category: string;
  description?: string;
}

export const ALL_PERMISSIONS: PermissionDef[] = [
  // TOPIC Domain
  { code: 'TOPIC_CREATE', name: 'Tạo đề tài', category: 'TOPIC', description: 'Cho phép tạo đề tài mới' },
  { code: 'TOPIC_VIEW', name: 'Xem đề tài', category: 'TOPIC', description: 'Cho phép xem danh sách đề tài' },
  { code: 'TOPIC_UPDATE', name: 'Cập nhật đề tài', category: 'TOPIC', description: 'Cho phép chỉnh sửa thông tin đề tài' },
  { code: 'TOPIC_DELETE', name: 'Xóa đề tài', category: 'TOPIC', description: 'Cho phép xóa đề tài' },
  { code: 'TOPIC_REJECT', name: 'Từ chối đề tài', category: 'TOPIC', description: 'Cho phép từ chối đề tài của giảng viên' },
  { code: 'TOPIC_REQUEST_REVISION', name: 'Yêu cầu chỉnh sửa', category: 'TOPIC', description: 'Cho phép yêu cầu giảng viên chỉnh sửa đề tài' },
  { code: 'TOPIC_HIDE', name: 'Ẩn đề tài', category: 'TOPIC', description: 'Cho phép ẩn đề tài khỏi danh sách đăng ký' },
  { code: 'TOPIC_CLONE', name: 'Sao chép đề tài', category: 'TOPIC', description: 'Cho phép sao chép đề tài sang học kỳ khác' },
  
  // REGISTRATION Domain
  { code: 'TOPIC_REGISTER', name: 'Đăng ký đề tài', category: 'REGISTRATION', description: 'Cho phép sinh viên đăng ký đề tài' },
  { code: 'GROUP_MANAGE', name: 'Quản lý nhóm', category: 'REGISTRATION', description: 'Cho phép tạo và quản lý nhóm sinh viên' },
  
  // GRADING Domain
  { code: 'GRADE_MIDTERM', name: 'Chấm điểm giữa kỳ', category: 'GRADING', description: 'Cho phép nhập điểm đánh giá giữa kỳ' },
  { code: 'GRADE_SUPERVISOR', name: 'Chấm điểm hướng dẫn', category: 'GRADING', description: 'Cho phép GVHD nhập điểm' },
  { code: 'GRADE_REVIEWER', name: 'Chấm điểm phản biện', category: 'GRADING', description: 'Cho phép GVPB nhập điểm' },
  { code: 'GRADE_COMMITTEE', name: 'Chấm điểm hội đồng', category: 'GRADING', description: 'Cho phép thành viên hội đồng nhập điểm' },
  { code: 'SCORE_FINALIZE', name: 'Tổng kết điểm', category: 'GRADING', description: 'Cho phép chốt điểm cuối cùng' },
  { code: 'EXTRA_POINTS_MANAGE', name: 'Quản lý điểm cộng', category: 'GRADING', description: 'Cho phép quản lý và duyệt điểm cộng' },
  
  // ASSIGNMENT Domain
  { code: 'ASSIGN_REVIEWER', name: 'Phân công phản biện', category: 'ASSIGNMENT', description: 'Cho phép phân công giảng viên phản biện' },
  { code: 'ASSIGN_COMMITTEE', name: 'Phân công hội đồng', category: 'ASSIGNMENT', description: 'Cho phép phân công hội đồng bảo vệ' },
  { code: 'DEFENSE_MANAGE', name: 'Quản lý bảo vệ', category: 'ASSIGNMENT', description: 'Duyệt điều kiện và hình thức bảo vệ' },
  
  // SYSTEM Domain
  { code: 'SYSTEM_USERS', name: 'Quản lý người dùng', category: 'SYSTEM', description: 'Cho phép quản lý tài khoản người dùng' },
  { code: 'SYSTEM_ROLES', name: 'Quản lý vai trò', category: 'SYSTEM', description: 'Cho phép quản lý quyền hạn của vai trò' },
  { code: 'SYSTEM_SEMESTER', name: 'Quản lý học kỳ', category: 'SYSTEM', description: 'Cho phép thiết lập học kỳ và thời gian' },
  { code: 'SYSTEM_CONFIG', name: 'Cấu hình hệ thống', category: 'SYSTEM', description: 'Cho phép thay đổi cấu hình chung của hệ thống' },
];

export const DEFAULT_ROLE_PERMISSIONS: Record<UserRole, string[]> = {
  [UserRole.STUDENT]: [
    'TOPIC_VIEW',
    'TOPIC_REGISTER',
    'GROUP_MANAGE',
  ],
  [UserRole.LECTURER]: [
    'TOPIC_VIEW',
    'TOPIC_CREATE',
    'TOPIC_UPDATE',
    'TOPIC_DELETE',
    'GRADE_MIDTERM',
    'GRADE_SUPERVISOR',
    'GRADE_REVIEWER',
    'GRADE_COMMITTEE',
  ],
  [UserRole.HEAD]: [
    'TOPIC_VIEW',
    'TOPIC_CREATE',
    'TOPIC_UPDATE',
    'TOPIC_DELETE',
    'TOPIC_REJECT',
    'TOPIC_REQUEST_REVISION',
    'GRADE_MIDTERM',
    'GRADE_SUPERVISOR',
    'GRADE_REVIEWER',
    'GRADE_COMMITTEE',
    'SCORE_FINALIZE',
    'EXTRA_POINTS_MANAGE',
    'ASSIGN_REVIEWER',
    'ASSIGN_COMMITTEE',
    'DEFENSE_MANAGE',
    'SYSTEM_SEMESTER',
  ],
  [UserRole.ADMIN]: ALL_PERMISSIONS.map(p => p.code),
};
