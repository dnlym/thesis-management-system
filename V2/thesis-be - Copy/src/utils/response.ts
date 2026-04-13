// src/utils/response.ts
import { Response } from "express";

export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  error?: any;
}

/**
 * ✅ Trả về phản hồi thành công
 */
export function success<T>(res: Response, data?: T, message = "Thành công") {
  return res.status(200).json({
    success: true,
    message,
    data,
  } as ApiResponse<T>);
}

/**
 * ⚠️ Trả về lỗi từ client (400)
 */
export function badRequest(res: Response, message = "Yêu cầu không hợp lệ", error?: any) {
  return res.status(400).json({
    success: false,
    message,
    error,
  } as ApiResponse);
}

/**
 * 🔒 Không có quyền truy cập
 */
export function unauthorized(res: Response, message = "Bạn không có quyền truy cập") {
  return res.status(401).json({
    success: false,
    message,
  } as ApiResponse);
}

/**
 * 🚫 Không tìm thấy
 */
export function notFound(res: Response, message = "Không tìm thấy dữ liệu") {
  return res.status(404).json({
    success: false,
    message,
  } as ApiResponse);
}

/**
 * 💥 Lỗi máy chủ nội bộ
 */
export function serverError(res: Response, error: any, message = "Lỗi máy chủ") {
  console.error("❌ SERVER ERROR:", error);
  return res.status(500).json({
    success: false,
    message,
    error: error instanceof Error ? error.message : error,
  } as ApiResponse);
}
