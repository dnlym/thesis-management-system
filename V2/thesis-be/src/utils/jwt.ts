import jwt, { SignOptions } from 'jsonwebtoken';
import { env } from '../config/env';
import { JWTPayload } from '../types';
import { JWT_CONFIG } from '../constants';

/**
 * Sinh access token chung
 * @param payload payload của token
 * @param expiresIn thời gian hết hạn (vd: "15m", "1h")
 */
export const generateToken = (payload: JWTPayload, expiresIn: string | number = JWT_CONFIG.ACCESS_TOKEN_EXPIRY): string => {
  const options: SignOptions = { expiresIn: expiresIn as any };
  return jwt.sign(payload as object, env.JWT_SECRET, options);
};

/**
 * Sinh access token riêng
 */
export const generateAccessToken = (payload: JWTPayload): string => {
  const options: SignOptions = {
    expiresIn: JWT_CONFIG.ACCESS_TOKEN_EXPIRY as any,
  };
  return jwt.sign(payload as object, env.JWT_SECRET, options);
};

/**
 * Sinh refresh token riêng
 */
export const generateRefreshToken = (payload: JWTPayload): string => {
  const options: SignOptions = {
    expiresIn: JWT_CONFIG.REFRESH_TOKEN_EXPIRY as any,
  };
  return jwt.sign(payload as object, env.JWT_SECRET, options);
};

/**
 * Verify access token
 */
export function verifyAccessToken(token: string) {
  const secret = env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET not set');
  try {
    return jwt.verify(token, secret) as JWTPayload;
  } catch (err) {
    throw new Error('Invalid access token');
  }
}

/**
 * Verify token chung
 */
export const verifyToken = (token: string): JWTPayload => {
  try {
    return jwt.verify(token, env.JWT_SECRET) as JWTPayload;
  } catch (error) {
    throw new Error('Invalid or expired token');
  }
};
