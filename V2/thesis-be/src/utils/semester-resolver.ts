import prisma from '../config/database';
import { ERROR_CODES } from '../constants';

/**
 * SemesterResolver - Giải pháp "Cache trong Request"
 *
 * Nguyên tắc hoạt động:
 * 1. Nếu client truyền semesterId cụ thể → dùng luôn (bao gồm 'ALL' để lấy tất cả).
 * 2. Nếu không có semesterId → tìm học kỳ ACTIVE.
 * 3. Nếu không tìm thấy học kỳ ACTIVE → throw lỗi rõ ràng (Fail-fast).
 *
 * Utility này được gọi DUY NHẤT 1 lần ở Controller, sau đó
 * truyền `effectiveSemesterId` xuống Service để tránh truy vấn DB lặp lại.
 */
export class SemesterResolver {
  /**
   * Resolve semester ID từ input.
   * @param inputSemesterId - semesterId từ query params (có thể undefined).
   * @param options.allowAll - Cho phép trả về null khi input là 'ALL' (dùng cho Admin).
   * @param options.required - Nếu true, throw lỗi khi không có Active Semester (default: true).
   * @returns Semester ID đã được resolve.
   */
  static async resolve(
    inputSemesterId: string | undefined,
    options: { allowAll?: boolean; required?: boolean } = {}
  ): Promise<string | null> {
    const { allowAll = false, required = true } = options;

    // Trường hợp: Admin muốn lấy tất cả (includeAll)
    if (allowAll && (inputSemesterId === 'ALL' || inputSemesterId === undefined && !required)) {
      return null;
    }

    // Trường hợp: có semesterId cụ thể → validate và dùng luôn
    if (inputSemesterId && inputSemesterId !== 'ALL') {
      const semester = await prisma.semester.findUnique({
        where: { id: inputSemesterId },
        select: { id: true },
      });
      if (!semester) {
        const err: any = new Error(
          `Không tìm thấy học kỳ với ID: ${inputSemesterId}`
        );
        err.error = ERROR_CODES.SEMESTER_NOT_FOUND;
        err.statusCode = 404;
        throw err;
      }
      return semester.id;
    }

    // Trường hợp: không có semesterId → tìm ACTIVE (chỉ query DB 1 lần)
    const activeSemester = await prisma.semester.findFirst({
      where: { status: 'ACTIVE' },
      select: { id: true },
    });

    if (!activeSemester) {
      if (!required) return null;
      const err: any = new Error(
        'Không có học kỳ nào đang hoạt động. Vui lòng liên hệ Admin để kích hoạt học kỳ.'
      );
      err.error = ERROR_CODES.ACTIVE_SEMESTER_REQUIRED;
      err.statusCode = 422; // Unprocessable Entity
      throw err;
    }

    return activeSemester.id;
  }

  /**
   * Resolve nhưng không bắt buộc (dùng cho các API có thể hiển thị mà không cần filter học kỳ).
   * @returns Semester ID hoặc null nếu không có ACTIVE.
   */
  static async resolveOptional(inputSemesterId?: string): Promise<string | null> {
    return this.resolve(inputSemesterId, { required: false });
  }

  /**
   * Resolve cho Admin - cho phép truyền 'ALL' để lấy tất cả học kỳ.
   * @returns Semester ID hoặc null nếu input là 'ALL'.
   */
  static async resolveForAdmin(inputSemesterId?: string): Promise<string | null> {
    if (!inputSemesterId || inputSemesterId === 'ALL') return null;
    return this.resolve(inputSemesterId, { allowAll: true, required: false });
  }
}
