import { Request, Response, NextFunction } from 'express';
import { ERROR_CODES } from '../constants';
import { logger } from '../utils/logger';

export const errorHandler = (err: any, req: Request, res: Response, next: NextFunction) => {
  // Log the error using Winston
  if (err.statusCode && err.statusCode < 500) {
    logger.warn(`${req.method} ${req.url} - ${err.message}`, { 
      statusCode: err.statusCode,
      error: err.error
    });
  } else {
    logger.error(`${req.method} ${req.url} - Server Error`, {
      message: err.message,
      stack: err.stack,
      statusCode: err.statusCode || 500
    });
  }

  // Prisma errors
  if (err.code === 'P2002') {
    return res.status(409).json({
      success: false,
      error: 'DUPLICATE_ENTRY',
      message: 'A record with this value already exists',
    });
  }

  if (err.code === 'P2025') {
    return res.status(404).json({
      success: false,
      error: ERROR_CODES.NOT_FOUND,
      message: 'Record not found',
    });
  }

  if (err.code === 'P2003') {
    return res.status(400).json({
      success: false,
      error: 'FOREIGN_KEY_CONSTRAINT',
      message: 'This operation violates a relationship constraint',
    });
  }

  // Multer errors
  if (err.name === 'MulterError') {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        error: 'FILE_TOO_LARGE',
        message: 'File size exceeds limit',
      });
    }
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      success: false,
      error: ERROR_CODES.INVALID_TOKEN,
      message: 'Invalid token',
    });
  }

  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      success: false,
      error: ERROR_CODES.TOKEN_EXPIRED,
      message: 'Token expired',
    });
  }

  // Default error
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal server error';

  res.status(statusCode).json({
    success: false,
    error: err.error || 'INTERNAL_ERROR',
    message: message,
  });
};
