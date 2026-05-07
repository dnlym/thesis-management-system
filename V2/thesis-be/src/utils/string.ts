/**
 * Normalize topic title for duplicate checking
 * Rule: Lowercase, remove accents, keep technical symbols (+, #, -), and collapse spaces
 */
export function normalizeTitle(title: string): string {
    if (!title) return '';

    // 1. Chuyển về chữ thường
    let result = title.toLowerCase();

    // 2. Bỏ dấu tiếng Việt (giữ nguyên 'd' cho 'đ')
    result = result.normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/đ/g, 'd')
        .replace(/Đ/g, 'd');

    // 3. Whitelist symbols: Chỉ giữ lại chữ cái, số, khoảng trắng và các ký tự kỹ thuật (+, #, -)
    result = result.replace(/[^a-z0-9\s\+\#-]/g, '');

    // 4. Xử lý khoảng trắng thừa
    result = result.trim().replace(/\s+/g, ' ');

    return result;
}

/**
 * Convert snake_case or kebab-case to camelCase
 */
export function snakeToCamel(str: string): string {
    return str.replace(/([-_][a-z0-9])/ig, ($1) => {
        return $1.toUpperCase()
            .replace('-', '')
            .replace('_', '');
    });
}

/**
 * Recursively convert object keys to camelCase
 */
export function keysToCamel(obj: any): any {
    if (Array.isArray(obj)) {
        return obj.map(v => keysToCamel(v));
    } else if (obj !== null && obj.constructor === Object) {
        return Object.keys(obj).reduce(
            (result, key) => ({
                ...result,
                [snakeToCamel(key)]: keysToCamel(obj[key]),
            }),
            {},
        );
    }
    return obj;
}
