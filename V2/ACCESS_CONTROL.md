# Ma trận Phân quyền (Access Control Matrix)

Tài liệu này mô tả chi tiết quyền truy cập của các vai trò (Roles) đối với **TẤT CẢ** các chức năng (Controllers/API) và các trang (Pages) trong hệ thống.

## 1. Ma trận Role vs Controller (Backend API)

Bảng dưới đây liệt kê toàn bộ API endpoint và các role được phép truy cập.
**Lưu ý:** "All Auth" nghĩa là tất cả người dùng đã đăng nhập đều có quyền truy cập.

| Controller | Method | Endpoint | Allowed Roles | Mô tả Chi tiết |
| :--- | :--- | :--- | :--- | :--- |
| **Auth** | POST | `/auth/register` | Public | Đăng ký tài khoản mới |
| | POST | `/auth/login` | Public | Đăng nhập vào hệ thống |
| | POST | `/auth/refresh-token` | Public | Lấy token truy cập mới (khi token cũ hết hạn) |
| | POST | `/auth/logout` | Public | Đăng xuất khỏi hệ thống |
| | GET | `/auth/profile` | All Auth | Xem thông tin hồ sơ cá nhân |
| | PUT | `/auth/profile` | All Auth | Cập nhật thông tin hồ sơ cá nhân |
| | POST | `/auth/change-password` | All Auth | Thay đổi mật khẩu đăng nhập |
| **Assignment** | POST | `/assignments/reviewer` | HEAD | Phân công giảng viên phản biện cho đề tài |
| | POST | `/assignments/:id/accept` | REVIEWER, SUPERVISOR | Chấp nhận yêu cầu phân công phản biện |
| | POST | `/assignments/:id/decline` | REVIEWER, SUPERVISOR | Từ chối yêu cầu phân công phản biện |
| | POST | `/assignments/defense-schedule` | HEAD | Tạo lịch bảo vệ luận văn |
| | GET | `/assignments/defense-schedules` | All Auth | Xem danh sách lịch bảo vệ |
| | GET | `/assignments` | All Auth | Xem danh sách các phân công liên quan đến mình |
| | DELETE | `/assignments/:id` | HEAD | Xóa phân công phản biện |
| **Dashboard** | GET | `/dashboard/stats` | All Auth | Xem số liệu thống kê tổng quan (theo role) |
| | GET | `/dashboard/charts` | All Auth | Xem dữ liệu biểu đồ thống kê |
| **Defense** | GET | `/defenses` | All Auth | Xem lịch bảo vệ (chế độ xem chung) |
| **Department** | POST | `/departments` | HEAD | Tạo mới khoa/bộ môn |
| | PUT | `/departments/:id` | HEAD | Cập nhật thông tin khoa/bộ môn |
| | GET | `/departments` | All Auth | Xem danh sách tất cả khoa/bộ môn |
| | GET | `/departments/:id` | All Auth | Xem chi tiết thông tin một khoa/bộ môn |
| **Extra Points** | POST | `/extra-points` | STUDENT | Gửi yêu cầu cộng điểm ngoại khóa |
| | POST | `/extra-points/:id/approve` | HEAD | Duyệt chấp nhận yêu cầu cộng điểm |
| | POST | `/extra-points/:id/reject` | HEAD | Từ chối yêu cầu cộng điểm |
| | GET | `/extra-points` | All Auth | Xem danh sách các yêu cầu cộng điểm |
| | GET | `/extra-points/:id` | All Auth | Xem chi tiết một yêu cầu cộng điểm |
| | DELETE | `/extra-points/:id` | STUDENT | Hủy/Xóa yêu cầu cộng điểm |
| **Grading** | POST | `/grading/criteria` | HEAD | Tạo mới tiêu chí chấm điểm |
| | GET | `/grading/criteria` | All Auth | Xem danh sách tiêu chí chấm điểm |
| | POST | `/grading/submit` | SUPERVISOR, REVIEWER | Gửi điểm chấm cho đề tài |
| | POST | `/grading/:id/compute` | HEAD | Tính toán điểm tổng kết từ các đầu điểm |
| | POST | `/grading/:id/finalize` | HEAD | Chốt điểm tổng kết cuối cùng |
| | GET | `/grading/:id` | All Auth | Xem chi tiết điểm của đề tài |
| **Group** | POST | `/groups` | STUDENT | Tạo nhóm sinh viên mới |
| | POST | `/groups/invite` | STUDENT | Mời sinh viên khác vào nhóm |
| | POST | `/groups/:id/accept` | STUDENT | Chấp nhận lời mời vào nhóm |
| | POST | `/groups/:id/reject` | STUDENT | Từ chối lời mời vào nhóm |
| | POST | `/groups/remove-member` | STUDENT | Xóa thành viên khỏi nhóm |
| | POST | `/groups/change-leader` | STUDENT | Yêu cầu thay đổi trưởng nhóm |
| | POST | `/groups/leader-change/:id/approve` | STUDENT | Duyệt yêu cầu thay đổi trưởng nhóm |
| | GET | `/groups` | STUDENT | Xem thông tin nhóm của tôi |
| | GET | `/groups/:id` | STUDENT | Xem chi tiết thông tin một nhóm |
| | DELETE | `/groups/:id` | STUDENT | Giải tán/Xóa nhóm |
| **Notification** | GET | `/notifications` | All Auth | Xem danh sách thông báo |
| | GET | `/notifications/unread-count` | All Auth | Xem số lượng thông báo chưa đọc |
| | POST | `/notifications/:id/read` | All Auth | Đánh dấu một thông báo là đã đọc |
| | POST | `/notifications/read-all` | All Auth | Đánh dấu tất cả thông báo là đã đọc |
| | DELETE | `/notifications/:id` | All Auth | Xóa một thông báo |
| **Registration** | POST | `/registrations` | STUDENT | Đăng ký đề tài luận văn |
| | POST | `/registrations/:id/confirm` | SUPERVISOR | Xác nhận duyệt đăng ký đề tài |
| | POST | `/registrations/:id/reject` | SUPERVISOR | Từ chối đăng ký đề tài |
| | DELETE | `/registrations/:id` | STUDENT | Hủy đăng ký đề tài |
| | GET | `/registrations` | All Auth | Xem danh sách các lượt đăng ký |
| | GET | `/registrations/:id` | All Auth | Xem chi tiết một lượt đăng ký |
| **Semester** | POST | `/semesters` | HEAD | Tạo học kỳ mới |
| | PUT | `/semesters/:id` | HEAD | Cập nhật thông tin học kỳ |
| | GET | `/semesters` | All Auth | Xem danh sách các học kỳ |
| | GET | `/semesters/active` | All Auth | Xem thông tin học kỳ đang hoạt động |
| | GET | `/semesters/:id` | All Auth | Xem chi tiết một học kỳ |
| | POST | `/semesters/:id/set-active` | HEAD | Kích hoạt học kỳ hiện tại |
| **Submission** | POST | `/submissions/upload` | STUDENT | Tải lên file báo cáo/luận văn |
| | POST | `/submissions/:id/approve` | SUPERVISOR | Duyệt chấp nhận bài nộp |
| | POST | `/submissions/:id/reject` | SUPERVISOR | Từ chối bài nộp |
| | POST | `/submissions/:id/lock` | HEAD | Khóa chức năng nộp bài |
| | POST | `/submissions/:id/unlock` | HEAD | Mở khóa chức năng nộp bài |
| | GET | `/submissions` | All Auth | Xem danh sách các bài nộp |
| | GET | `/submissions/:id/versions` | All Auth | Xem lịch sử các phiên bản bài nộp |
| | GET | `/submissions/download/:versionId` | All Auth | Tải xuống file bài nộp |
| **Topic** | POST | `/topics` | SUPERVISOR | Tạo đề tài mới |
| | PUT | `/topics/:id` | SUPERVISOR | Cập nhật thông tin đề tài |
| | POST | `/topics/:id/approve` | HEAD | Duyệt chấp nhận đề tài |
| | POST | `/topics/:id/reject` | HEAD | Từ chối đề tài |
| | GET | `/topics` | All Auth | Xem danh sách các đề tài |
| | GET | `/topics/:id` | All Auth | Xem chi tiết nội dung đề tài |
| | DELETE | `/topics/:id` | SUPERVISOR | Xóa đề tài |
| **User** | GET | `/users` | ADMIN, HEAD | Xem danh sách người dùng hệ thống |
| | POST | `/users` | ADMIN | Tạo tài khoản người dùng mới |
| | PUT | `/users/:id` | ADMIN | Cập nhật thông tin người dùng |
| | DELETE | `/users/:id` | ADMIN | Xóa tài khoản người dùng |

---

## 2. Ma trận Page vs Role (Frontend)

Bảng dưới đây liệt kê toàn bộ các trang giao diện và các role được phép truy cập.

| Page (Route) | Tên trang | Allowed Roles | Hành động cho phép (Chi tiết) |
| :--- | :--- | :--- | :--- |
| **Public** | | | |
| `/auth/login` | Đăng nhập | All Roles | Nhập email và mật khẩu để truy cập hệ thống. |
| **General** | | | |
| `/dashboard` | Dashboard | All Roles | **Student**: Xem tiến độ cá nhân, thông báo mới.<br>**Lecturer**: Xem thống kê đề tài, lịch bảo vệ.<br>**Admin**: Xem tổng quan hệ thống. |
| `/profile` | Cá nhân | All Roles | Xem thông tin cá nhân, cập nhật hồ sơ, đổi mật khẩu. |
| `/messages` | Tin nhắn | All Roles | Gửi/nhận tin nhắn với thành viên khác trong hệ thống. |
| `/schedule` | Lịch trình | All Roles | Xem lịch bảo vệ, hạn chót nộp bài, các sự kiện quan trọng. |
| **Student** | | | |
| `/my-group` | Nhóm của tôi | STUDENT | Tạo nhóm mới, mời thành viên, chấp nhận/từ chối lời mời, xem thông tin nhóm. |
| `/topics` | Đề tài | STUDENT | Xem danh sách đề tài được công bố, tìm kiếm, đăng ký đề tài (nếu chưa có). |
| `/topics/:id` | Chi tiết đề tài | STUDENT | Xem chi tiết yêu cầu đề tài, giảng viên hướng dẫn. |
| `/progress` | Tiến độ | STUDENT | Xem các mốc thời gian, trạng thái hoàn thành của từng giai đoạn. |
| `/submissions` | Nộp bài | STUDENT | Nộp file báo cáo/luận văn, xem lịch sử nộp, xem nhận xét của GV. |
| **Supervisor** | | | |
| `/topics` | Quản lý đề tài | SUPERVISOR | Xem danh sách đề tài của mình, tạo đề tài mới, sửa/xóa đề tài chưa duyệt. |
| `/topics/:id` | Chi tiết đề tài | SUPERVISOR | Xem chi tiết, quản lý sinh viên đăng ký vào đề tài. |
| `/progress` | Tiến độ SV | SUPERVISOR | Theo dõi tiến độ thực hiện của các nhóm sinh viên mình hướng dẫn. |
| `/submissions` | Duyệt bài | SUPERVISOR | Xem bài nộp của sinh viên, tải file, duyệt hoặc từ chối bài nộp. |
| `/evaluation` | Đánh giá | SUPERVISOR | Chấm điểm hướng dẫn, nhập nhận xét cho sinh viên. |
| **Head** | | | |
| `/topics` | Duyệt đề tài | HEAD | Xem danh sách đề tài chờ duyệt, phê duyệt hoặc từ chối đề tài. |
| `/submissions` | Quản lý bài nộp | HEAD | Khóa/Mở khóa chức năng nộp bài cho sinh viên (khi quá hạn). |
| `/evaluation` | Đánh giá | HEAD | Xem bảng điểm tổng hợp, chốt điểm cuối cùng. |
| `/reports` | Báo cáo | HEAD | Xem các báo cáo thống kê về số lượng đề tài, sinh viên, điểm số. |
| `/admin/users` | Quản lý User | HEAD | Xem danh sách giảng viên/sinh viên thuộc bộ môn. |
| `/admin/criteria` | Tiêu chí | HEAD | Quản lý bộ tiêu chí chấm điểm cho các đợt bảo vệ. |
| `/admin/council` | Hội đồng | HEAD | Thành lập hội đồng bảo vệ, phân công thành viên hội đồng. |
| **Admin** | | | |
| `/admin/users` | Quản lý User | ADMIN | Quản lý toàn bộ tài khoản (Thêm, Sửa, Xóa, Reset mật khẩu). |
| `/admin/roles` | Quản lý Role | ADMIN | Định nghĩa các vai trò và quyền hạn trong hệ thống. |
| `/admin/settings` | Cài đặt | ADMIN | Cấu hình tham số hệ thống (Năm học, Học kỳ, Thời gian đăng ký). |
| **Committee** | | | |
| `/evaluation` | Đánh giá | COMMITTEE_* | Chấm điểm bảo vệ, nhập nhận xét cho nhóm sinh viên bảo vệ. |

**Chú thích Role:**
- **STUDENT**: Sinh viên
- **SUPERVISOR**: Giảng viên hướng dẫn
- **REVIEWER**: Giảng viên phản biện
- **HEAD**: Trưởng bộ môn/ngành
- **COMMITTEE_***: Thành viên hội đồng (Chair, Secretary, Member)
- **ADMIN**: Quản trị viên hệ thống
