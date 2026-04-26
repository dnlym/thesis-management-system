import { Request, Response, NextFunction } from "express";
import { verifyAccessToken } from "../utils/jwt";
import { UserRole } from "@prisma/client";
import { ERROR_CODES } from "../constants";
import { AuthRequest } from "../types";

export { AuthRequest };

/**
 * Middleware xác thực token
 */
export const authenticate = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: ERROR_CODES.UNAUTHORIZED,
        message: 'No token provided',
      });
    }

    const token = authHeader.substring(7);
    const payload = verifyAccessToken(token) as any;

    if (!payload) {
      return res.status(401).json({
        success: false,
        error: ERROR_CODES.INVALID_TOKEN,
        message: 'Invalid or expired token',
      });
    }

    const { userId, sub, email, role } = payload;
    const id = (userId ?? sub) as string | undefined;

    if (!id || !email || !role) {
      return res.status(401).json({
        success: false,
        error: ERROR_CODES.INVALID_TOKEN,
        message: 'Invalid token payload',
      });
    }

    req.user = {
      id,
      email,
      role: role as UserRole,
    };

    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      error: ERROR_CODES.UNAUTHORIZED,
      message: 'Authentication failed',
    });
  }
};

/**
 * Middleware phân quyền theo role
 * @param roles danh sách role được phép truy cập
 */
export const authorize = (...roles: UserRole[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: ERROR_CODES.UNAUTHORIZED,
        message: "Người dùng chưa đăng nhập",
      });
    }
    console.log(`[AUTH DEBUG] User Role: ${req.user.role}, Required Roles: ${roles.join(', ')}`);
    if (!roles.includes(req.user.role)) {
      console.log(`[AUTH DEBUG] Authorization failed for user ${req.user.id}`);
      return res.status(403).json({
        success: false,
        error: ERROR_CODES.FORBIDDEN,
        message: "Không có quyền truy cập",
      });
    }

    next();
  };
};

import permissionService from "../services/permission.service";

/**
 * Middleware kiểm tra quyền hạn (Permission)
 * @param permissionCode mã quyền hạn cần kiểm tra (ví dụ: 'TOPIC_CREATE')
 */
export const checkPermission = (permissionCode: string) => {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: ERROR_CODES.UNAUTHORIZED,
        message: "Người dùng chưa đăng nhập",
      });
    }

    try {
      const hasPerm = await permissionService.hasPermission(req.user.role, permissionCode);
      
      if (!hasPerm) {
        return res.status(403).json({
          success: false,
          error: ERROR_CODES.FORBIDDEN,
          message: `Không có quyền thực hiện hành động này (${permissionCode})`,
        });
      }

      next();
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: ERROR_CODES.INTERNAL_ERROR,
        message: "Lỗi kiểm tra quyền hạn",
      });
    }
  };
};

/**
 * Giữ tên cũ để các file khác không bị ảnh hưởng
 */
export const authMiddleware = authenticate;
export const roleMiddleware = authorize;
