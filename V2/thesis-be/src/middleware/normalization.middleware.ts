import { Request, Response, NextFunction } from 'express';
import { keysToCamel } from '../utils/string';

/**
 * Global Request Normalization Middleware
 *
 * Mục tiêu:
 * - Đồng bộ naming giữa FE và BE
 * - Hỗ trợ snake_case -> camelCase
 * - Deep normalize object + nested array
 * - Không mutate object readonly của Express
 * - Không crash request nếu normalize lỗi
 * - Tránh lỗi "Cannot set property ... which has only a getter"
 */

type PlainObject = Record<string, any>;

const isPlainObject = (value: unknown): value is PlainObject => {
    return (
        typeof value === 'object' &&
        value !== null &&
        !Array.isArray(value)
    );
};

const safeNormalize = <T>(data: T): T => {
    try {
        if (
            data === null ||
            data === undefined ||
            typeof data !== 'object'
        ) {
            return data;
        }

        return keysToCamel(data) as T;
    } catch (error: any) {
        console.error('[Normalization] Normalize failed:', error?.message);
        return data;
    }
};

const replaceObjectValues = (
    target: PlainObject,
    source: PlainObject
) => {
    try {
        // remove old keys safely
        for (const key of Object.keys(target)) {
            delete target[key];
        }

        // assign normalized keys
        Object.assign(target, source);
    } catch (error: any) {
        console.error('[Normalization] Replace object failed:', error?.message);
    }
};

export const normalizationMiddleware = (
    req: Request,
    _res: Response,
    next: NextFunction
) => {
    try {
        // BODY
        if (isPlainObject(req.body)) {
            const normalizedBody = safeNormalize(req.body);
            replaceObjectValues(req.body, normalizedBody);
        }

        // QUERY
        if (isPlainObject(req.query)) {
            const normalizedQuery = safeNormalize(req.query);
            replaceObjectValues(req.query as PlainObject, normalizedQuery);
        }

        // PARAMS
        if (isPlainObject(req.params)) {
            const normalizedParams = safeNormalize(req.params);
            replaceObjectValues(req.params, normalizedParams);
        }

        next();
    } catch (error: any) {
        console.error(
            '[NormalizationMiddleware] Critical Error:',
            error?.message
        );

        // không block request flow
        next();
    }
};
