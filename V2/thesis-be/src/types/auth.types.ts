import { UserRole } from '@prisma/client';
import { Request } from 'express';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email?: string;
    role: UserRole;
  };
}

export interface JWTPayload {
  id?: string;
  userId?: string;  // Alternative name for id
  role: UserRole;
  email?: string;
  departmentId?: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    email: string;
    fullName: string;
    role: UserRole;
    departmentId: string;
    department?: {
      id: string;
      name: string;
      code: string;
    };
  };
}

export interface RefreshTokenRequest {
  refreshToken: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  fullName: string;
  role: UserRole;
  departmentId: string;
  studentCode?: string;
  phone?: string;
}
