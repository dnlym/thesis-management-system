# Sitemap (Frontend)

Cấu trúc sơ đồ trang web của ứng dụng Frontend.

## Public Pages
- `/auth/login`: Đăng nhập

## Protected Pages (Yêu cầu đăng nhập)

### General (Dành cho mọi người dùng)
- `/dashboard`: Dashboard (Trang chủ)
- `/profile`: Thông tin cá nhân
- `/messages`: Tin nhắn
- `/schedule`: Lịch trình chung

### Student (Sinh viên)
- `/my-group`: Quản lý nhóm (Tạo nhóm, mời thành viên)
- `/topics`: Danh sách đề tài (Xem và đăng ký)
- `/topics/:id`: Chi tiết đề tài
- `/progress`: Theo dõi tiến độ
- `/submissions`: Nộp bài (Báo cáo, Luận văn)

### Supervisor (Giảng viên hướng dẫn)
- `/topics`: Quản lý đề tài (Tạo, sửa, xóa)
- `/topics/:id`: Chi tiết đề tài
- `/progress`: Theo dõi tiến độ sinh viên
- `/submissions`: Duyệt bài nộp của sinh viên
- `/evaluation`: Đánh giá và chấm điểm

### Head (Trưởng bộ môn)
- `/topics`: Duyệt đề tài
- `/topics/:id`: Chi tiết đề tài
- `/progress`: Theo dõi tiến độ chung
- `/submissions`: Quản lý bài nộp (Khóa/Mở khóa)
- `/evaluation`: Đánh giá và chấm điểm
- `/reports`: Xem báo cáo thống kê
- `/admin/users`: Quản lý người dùng (Giảng viên, Sinh viên)
- `/admin/criteria`: Quản lý tiêu chí chấm điểm
- `/admin/council`: Quản lý hội đồng bảo vệ

### Admin (Quản trị viên)
- `/topics`: Xem danh sách đề tài
- `/topics/:id`: Chi tiết đề tài
- `/evaluation`: Xem kết quả đánh giá
- `/reports`: Xem báo cáo thống kê
- `/admin/users`: Quản lý toàn bộ người dùng
- `/admin/roles`: Quản lý vai trò và phân quyền
- `/admin/criteria`: Quản lý tiêu chí chấm điểm
- `/admin/council`: Quản lý hội đồng
- `/admin/settings`: Cài đặt hệ thống

### Committee Members (Thành viên hội đồng)
- `/evaluation`: Đánh giá và chấm điểm buổi bảo vệ
- `/messages`: Trao đổi thông tin
