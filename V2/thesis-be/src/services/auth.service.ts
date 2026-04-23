import bcrypt from 'bcryptjs';
import prisma from '../config/database';
import { generateAccessToken, generateRefreshToken } from '../utils/jwt';
import { LoginRequest, LoginResponse, RegisterRequest } from '../types';
import { ERROR_CODES } from '../constants';

export class AuthService {
  changePassword(userId: string, currentPassword: any, newPassword: any) {
    throw new Error('Method not implemented.');
  }
  updateProfile(userId: string, body: any) {
    throw new Error('Method not implemented.');
  }
  async getProfile(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { department: true },
    });

    if (!user) {
      throw new Error('User not found');
    }

    return {
      id: user.id,
      email: user.email,
      fullName: user.full_name,
      role: user.role,
      departmentId: user.departmentId,
      avatarUrl: user.avatar_url,
      joinedAt: user.joined_at,
    };
  }
  refreshToken(refreshToken: any) {
    throw new Error('Method not implemented.');
  }
  async login(data: LoginRequest, ip?: string, userAgent?: string): Promise<LoginResponse> {
    const user = await prisma.user.findUnique({
      where: { email: data.email },
      include: { department: true },
    });

    if (!user || !user.active) {
      throw new Error(ERROR_CODES.INVALID_CREDENTIALS);
    }

    const isPasswordValid = await bcrypt.compare(data.password, user.password_hash);
    if (!isPasswordValid) {
      throw new Error(ERROR_CODES.INVALID_CREDENTIALS);
    }

    const payload = {
      userId: user.id,
      email: user.email,
      role: user.role,
      departmentId: user.departmentId,
    };

    const accessToken = generateAccessToken(payload);
    const refreshToken = generateRefreshToken(payload);

    // Save refresh token
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await prisma.refreshToken.create({
      data: {
        token: refreshToken,
        user_id: user.id,
        expires_at: expiresAt,
        created_by_ip: ip,
        user_agent: userAgent,
      },
    });

    // Update last login
    await prisma.user.update({
      where: { id: user.id },
      data: {
        last_login_at: new Date(),
        last_login_ip: ip,
      },
    });

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.full_name,
        role: user.role,
        departmentId: user.departmentId,
      },
    };
  }

  async register(data: RegisterRequest): Promise<void> {
    const existingUser = await prisma.user.findUnique({
      where: { email: data.email },
    });

    if (existingUser) {
      throw new Error('Email already exists');
    }

    if (data.studentCode) {
      const existingStudent = await prisma.user.findUnique({
        where: { student_code: data.studentCode },
      });

      if (existingStudent) {
        throw new Error('Student code already exists');
      }
    }

    const hashedPassword = await bcrypt.hash(data.password, 10);

    await prisma.user.create({
      data: {
        email: data.email,
        password_hash: hashedPassword,
        full_name: data.fullName,
        role: data.role,
        departmentId: data.departmentId,
        student_code: data.studentCode,
        phone: data.phone,
      },
    });
  }

  async refreshAccessToken(refreshToken: string): Promise<{ accessToken: string }> {
    const tokenRecord = await prisma.refreshToken.findUnique({
      where: { token: refreshToken },
      include: { user: true },
    });

    if (!tokenRecord || tokenRecord.revoked_at || tokenRecord.expires_at < new Date()) {
      throw new Error(ERROR_CODES.TOKEN_EXPIRED);
    }

    const payload = {
      userId: tokenRecord.user.id,
      email: tokenRecord.user.email,
      role: tokenRecord.user.role,
      departmentId: tokenRecord.user.departmentId,
    };

    const accessToken = generateAccessToken(payload);

    return { accessToken };
  }

  async logout(refreshToken: string): Promise<void> {
    await prisma.refreshToken.update({
      where: { token: refreshToken },
      data: { revoked_at: new Date() },
    });
  }
}

export default new AuthService();
