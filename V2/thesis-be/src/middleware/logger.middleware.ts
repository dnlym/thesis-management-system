import { Request, Response, NextFunction } from 'express';

/**
 * Detailed API Request Logger
 * Logs Method, Path, and Source of incoming requests
 */
export const apiLogger = (req: Request, res: Response, next: NextFunction) => {
    const start = Date.now();
    const source = req.headers['user-agent']?.includes('Expo') || req.headers['user-agent']?.includes('Darwin')
        ? '📱 MOBILE'
        : '💻 WEB';

    // Capture the finish event to log status and duration
    res.on('finish', () => {
        const duration = Date.now() - start;
        const status = res.statusCode;
        const color = status >= 500 ? '🔴' : status >= 400 ? '🟡' : '🟢';

        console.log(`${color} [API] ${source} | ${req.method} ${req.originalUrl} | ${status} | ${duration}ms`);
    });

    next();
};
