import { Request, Response, NextFunction } from 'express';
import { keysToCamel } from '../utils/string';

/**
 * Middleware chuẩn hóa Request sang camelCase một cách an toàn.
 * Đảm bảo không gây lỗi "only a getter" và xử lý được mảng lồng nhau.
 */
export const normalizationMiddleware = (req: Request, res: Response, next: NextFunction) => {
    try {
        // Hàm phụ để xử lý việc ghi đè dữ liệu một cách an toàn
        const safeNormalize = (target: any) => {
            if (!target || typeof target !== 'object' || Object.keys(target).length === 0) {
                return;
            }

            // Thực hiện convert (phải đảm bảo keysToCamel xử lý được mảng - Deep Convert)
            const normalized = keysToCamel(target);

            // Thay vì gán req.target = normalized (gây lỗi getter)
            // Ta xóa key cũ và nạp key mới vào cùng một ô nhớ (Object Reference)
            Object.keys(target).forEach(key => {    
                delete target[key];
            });

            Object.assign(target, normalized);
        };

        // Chạy chuẩn hóa cho cả 3 nguồn dữ liệu
        safeNormalize(req.body);
        safeNormalize(req.query);
        safeNormalize(req.params);

        next();
    } catch (error: any) {
        // Log lỗi nhưng không làm sập luồng request
        console.error('[NormalizationMiddleware] Critical Error:', error.message);
        next();
    }
};
