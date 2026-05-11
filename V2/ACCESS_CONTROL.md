# 🔐 Ma trận Phân quyền (Access Control Matrix)

Tài liệu này xác định các quyền hạn truy cập vào tài nguyên hệ thống (Backend API) và giao diện người dùng (Frontend Pages) dựa trên vai trò của người dùng.

---

## 👥 Định nghĩa Vai trò (Roles)

Hệ thống sử dụng mô hình **RBAC (Role-Based Access Control)** với các vai trò chính sau:

| Role | Tên vai trò | Mô tả |
| :--- | :--- | :--- |
| **ADMIN** | Quản trị viên | Quản lý người dùng, cấu hình hệ thống và danh mục dùng chung. |
| **HEAD** | Trưởng bộ môn | Phê duyệt đề tài, phân công phản biện, thành lập hội đồng và chốt điểm. |
| **LECTURER** | Giảng viên | Hướng dẫn đề tài (Supervisor), phản biện (Reviewer) hoặc thành viên hội đồng. |
| **STUDENT** | Sinh viên | Đăng ký đề tài, nộp báo cáo và xem kết quả học tập. |

---

## ⚙️ Ma trận Quyền hạn Backend (API Access)

| Module | Chức năng chính | ADMIN | HEAD | LECTURER | STUDENT |
| :--- | :--- | :---: | :---: | :---: | :---: |
| **Auth** | Đăng nhập, Profile, Đổi mật khẩu | ✅ | ✅ | ✅ | ✅ |
| **User** | Quản lý tài khoản (CRUD) | ✅ | 👁️ | ❌ | ❌ |
| **Topic** | Đề xuất đề tài mới | ❌ | ❌ | ✅ | ❌ |
| | Phê duyệt/Từ chối đề tài | ❌ | ✅ | ❌ | ❌ |
| | Xem danh sách đề tài công bố | ✅ | ✅ | ✅ | ✅ |
| **Group** | Tạo nhóm, mời thành viên | ❌ | ❌ | ❌ | ✅ |
| **Registration**| Đăng ký đề tài | ❌ | ❌ | ❌ | ✅ |
| | Duyệt sinh viên vào đề tài | ❌ | ❌ | ✅ | ❌ |
| **Assignment** | Phân công GVPB & Hội đồng | ❌ | ✅ | ❌ | ❌ |
| | Tiếp nhận phân công | ❌ | ❌ | ✅ | ❌ |
| **Grading** | Chấm điểm (GVHD, GVPB, HĐ) | ❌ | ❌ | ✅ | ❌ |
| | Quản lý tiêu chí chấm điểm | ❌ | ✅ | ❌ | ❌ |
| | Chốt điểm tổng kết (Finalize) | ❌ | ✅ | ❌ | ❌ |
| **Defense** | Sắp xếp lịch bảo vệ & phòng | ❌ | ✅ | ❌ | ❌ |
| **Extra Points** | Gửi yêu cầu cộng điểm | ❌ | ❌ | ❌ | ✅ |
| | Duyệt yêu cầu cộng điểm | ❌ | ✅ | ❌ | ❌ |
| **System** | Cấu hình Học kỳ, Năm học | ✅ | ✅ | ❌ | ❌ |

**Ghi chú:**
- ✅: Có quyền thực hiện (Full access/Write).
- 👁️: Chỉ có quyền xem (Read-only).
- ❌: Không có quyền truy cập.

---

## 🖥️ Giao diện & Chức năng Frontend

### 1. Dành cho Quản trị & Trưởng bộ môn
- **Dashboard Quản trị:** Thống kê tổng quan tình hình khóa luận toàn khoa.
- **Quản lý Người dùng:** Import danh sách sinh viên/giảng viên, reset mật khẩu.
- **Cấu hình Đợt khóa luận:** Thiết lập thời gian đăng ký, nộp bài và bảo vệ.
- **Duyệt Đề tài:** Bảng điều khiển tập trung để thẩm định các đề xuất từ giảng viên.
- **Điều phối Hội đồng:** Giao diện kéo-thả để phân bổ giảng viên vào các hội đồng bảo vệ.

### 2. Dành cho Giảng viên
- **Quản lý Hướng dẫn:** Theo dõi danh sách sinh viên đang hướng dẫn, duyệt bài nộp định kỳ.
- **Bảng chấm điểm (Grading Hub):** Giao diện chấm điểm tập trung hỗ trợ tính điểm tự động theo tiêu chí.
- **Lịch phản biện:** Danh sách các đề tài được phân công phản biện kèm tài liệu liên quan.
- **Hội đồng bảo vệ:** Xem danh sách nhóm bảo vệ trong hội đồng mình tham gia.

### 3. Dành cho Sinh viên
- **Sàn Đề tài:** Xem danh sách, lọc đề tài theo giảng viên hoặc lĩnh vực và đăng ký.
- **Quản lý Nhóm:** Tìm kiếm thành viên, gửi lời mời và thành lập nhóm thực hiện.
- **Cổng Nộp bài:** Tải lên các file báo cáo, luận văn theo từng giai đoạn.
- **Theo dõi Tiến độ:** Biểu đồ hiển thị các mốc thời gian và trạng thái hiện tại của khóa luận.

---

## 🔒 Cơ chế Bảo mật
1. **JWT Authentication:** Sử dụng Access Token và Refresh Token để duy trì phiên làm việc an toàn.
2. **Middleware Authorization:** Mọi API request đều được kiểm tra vai trò tại lớp Middleware trước khi vào Controller.
3. **Data Isolation:** Người dùng chỉ có quyền can thiệp vào dữ liệu liên quan trực tiếp đến vai trò và phân công của mình (ví dụ: Giảng viên chỉ được chấm điểm nhóm mình được phân công).

---
