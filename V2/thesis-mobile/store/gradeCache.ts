/**
 * Module-level cache để truyền dữ liệu điểm tươi giữa grading → grade-review
 * mà không cần fetch lại từ server sau khi vừa lưu xong.
 */
type GradeCacheEntry = {
  data: any;
  topicId: string;
  timestamp: number;
};

let _cache: GradeCacheEntry | null = null;

export const GradeCache = {
  set(topicId: string, data: any) {
    _cache = { topicId, data, timestamp: Date.now() };
  },

  get(topicId: string): any | null {
    if (!_cache) return null;
    // Chỉ dùng cache trong vòng 10 giây
    if (_cache.topicId !== topicId || Date.now() - _cache.timestamp > 10000) {
      _cache = null;
      return null;
    }
    return _cache.data;
  },

  clear() {
    _cache = null;
  }
};
