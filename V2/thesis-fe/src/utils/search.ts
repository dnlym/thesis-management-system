/**
 * Chuẩn hóa chuỗi tiếng Việt: loại bỏ dấu, chuyển về chữ thường, xử lý khoảng trắng.
 */
export const normalizeVietnamese = (str: string = ""): string => {
  if (!str) return "";
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .replace(/\s+/g, " ") // Chuẩn hóa nhiều khoảng trắng thành 1
    .trim();
};

/**
 * Kiểm tra xem từ khóa có khớp với các trường dữ liệu hay không (Token-based matching).
 * "nguyen a" sẽ khớp với "Nguyen Van A"
 */
export const matchKeyword = (keyword: string, ...fields: (string | null | undefined)[]): boolean => {
  if (!keyword || keyword.trim() === "") return true;
  
  const normalizedKeyword = normalizeVietnamese(keyword);
  const tokens = normalizedKeyword.split(" ").filter(t => t.length > 0);
  
  if (tokens.length === 0) return true;

  const normalizedFields = fields
    .filter(f => f != null)
    .map(f => normalizeVietnamese(f as string));

  // Mỗi token trong từ khóa phải xuất hiện trong ít nhất một trường bất kỳ
  return tokens.every(token =>
    normalizedFields.some(field => field.includes(token))
  );
};
