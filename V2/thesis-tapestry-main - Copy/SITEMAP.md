# Sơ đồ trang web (Sitemap) - Hệ thống KLTN

Tài liệu này mô tả cấu trúc các trang và chức năng chính phân loại theo vai trò của người dùng trong hệ thống.

---

## 🌍 Trang dùng chung (Tất cả vai trò)

| Đường dẫn | Tên trang | Mô tả |
|-----------|-----------|-------|
| `/auth/login` | Đăng nhập | Truy cập vào hệ thống |
| `/dashboard` | Tổng quan | Bảng điều khiển hiển thị thống kê nhanh và hoạt động gần đây |
| `/topics` | Danh sách đề tài | Xem toàn bộ đề tài (Sinh viên có thể đăng ký tại đây) |
| `/schedule` | Lịch trình | Xem lịch cá nhân và lịch bảo vệ |
| `/messages` | Tin nhắn | Trao đổi trực tiếp theo từng đề tài hoặc nhóm |
| `/profile` | Thông tin cá nhân | Cập nhật hồ sơ người dùng |

---

## 🎓 Phân hệ Sinh viên (Student)

| Đường dẫn | Tên trang | Mô tả |
|-----------|-----------|-------|
| `/my-topic` | Đề tài của tôi | Quản lý đề tài đã đăng ký, xem phản hồi GVHD |
| `/extra-points` | Điểm cộng NCKH | Nộp minh chứng để được cộng điểm thưởng |
| `/progress` | Theo dõi tiến độ | Xem trạng thái hiện tại của khóa luận (Đề cương -> Cuối kỳ) |
| `/submissions` | Nộp bài | Upload các file báo cáo theo từng giai đoạn |

---

## 👨‍🏫 Phân hệ Giảng viên (Lecturer/Supervisor/Reviewer)

### 1. Vai trò Hướng dẫn (Supervisor)
- `/supervisor/create-topic`: Đề xuất đề tài mới.
- `/supervisor/registrations`: Duyệt sinh viên đăng ký vào đề tài của mình.
- `/supervisor/submissions`: Xem và nhận xét bài nộp của sinh viên.
- `/midterm-evaluation`: Chấm điểm và nhận xét giai đoạn giữa kỳ.
- `/evaluation`: Form bài chấm điểm GVHD cuối kỳ.

### 2. Vai trò Phản biện (Reviewer)
- `/reviewer/assignments`: Danh sách các đề tài được phân công phản biện.
- `/evaluation?type=reviewer`: Form chấm điểm GVPB (Tối đa 2-3 GVPB tùy cấu hình).

---

## 🏠 Phân hệ Trưởng bộ môn (Head of Dept)

| Đường dẫn | Tên trang | Mô tả |
|-----------|-----------|-------|
| `/head/approve-topics` | Duyệt đề tài | Phê duyệt/Yêu cầu sửa các đề tài do giảng viên đề xuất |
| `/reviewer-assignment` | Phân công phản biện | Gán giảng viên phản biện cho từng đề tài |
| `/committee-assignment` | Phân công Hội đồng | Gán đề tài vào các hội đồng bảo vệ |
| `/head/committees` | Quản lý Hội đồng | Thiết lập danh sách các hội đồng chuyên môn |
| `/head/committee-schedules`| Tổng hợp lịch | Xem bảng tổng hợp lịch bảo vệ toàn bộ bộ môn |
| `/head/extra-points` | Duyệt điểm cộng | Phê duyệt các yêu cầu cộng điểm từ sinh viên |
| `/head/semester-settings` | Cài đặt Học kỳ | Quản lý các giai đoạn (Phases) và thời hạn của học kỳ |
| `/reports` | Báo cáo thống kê | Biểu đồ phân tích dữ liệu khóa luận |
| `/final-results` | Kết quả tổng kết | Xem bảng điểm tổng hợp sau cùng |

---

## ⚙️ Phân hệ Quản trị (Admin)

| Đường dẫn | Tên trang | Mô tả |
|-----------|-----------|-------|
| `/admin/users` | Quản lý người dùng | Thêm/Xóa/Sửa tài khoản trong hệ thống |
| `/admin/roles` | Vai trò & Quyền | Cấu hình phân quyền chi tiết |
| `/admin/criteria` | Tiêu chí đánh giá | Thiết lập thang điểm và các tiêu chí chấm |
| `/admin/settings` | Cài đặt hệ thống | Cấu hình tham số toàn cục |

---

## 🔄 Luồng nghiệp vụ chính

1. **Chuẩn bị**: Admin/Head tạo học kỳ -> Giảng viên đề xuất đề tài -> Head duyệt đề tài.
2. **Đăng ký**: Sinh viên chọn đề tài -> GVHD xác nhận -> (Tùy chọn) Sinh viên tìm bạn lập nhóm.
3. **Thực hiện**: Sinh viên thực hiện -> Cập nhật tiến độ -> Nộp bài -> GVHD nhận xét/duyệt.
4. **Giữa kỳ**: GVHD đánh giá Midterm (Đạt mới được đi tiếp).
5. **Đánh giá & Bảo vệ**: Head phân công GVPB/Hội đồng -> GVPB chấm điểm -> Bảo vệ Hội đồng -> Nhập điểm cuối cùng.
6. **Tổng kết**: Hệ thống tính điểm tổng kết -> Head công bố kết quả.
