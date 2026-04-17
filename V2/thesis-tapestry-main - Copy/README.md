# Hệ thống quản lý khóa luận tốt nghiệp (Thesis Management System)

Giải pháp toàn diện hỗ trợ quản lý quy trình làm khóa luận tốt nghiệp, từ đề xuất đề tài đến bảo vệ cuối kỳ và thống kê kết quả.

## 🏗 Cấu trúc dự án

Dự án bao gồm 2 phần chính:
- **Frontend**: Ứng dụng React xây dựng giao diện người dùng.
- **Backend**: RESTful API Node.js xử lý dữ liệu và logic nghiệp vụ.

---

## 🚀 Hướng dẫn cài đặt

### 1. Backend (BE)

**Yêu cầu**: Node.js, PostgreSQL.

```bash
# Di chuyển vào thư mục backend
cd thesis-be

# Cài đặt thư viện
npm install

# Cấu hình môi trường
# Tạo file .env dựa trên thông số DB của bạn
# DATABASE_URL="postgresql://user:password@localhost:5432/db_name?schema=public"

# Đồng bộ Database (Prisma)
npx prisma generate
npx prisma migrate dev --name init

# Tạo dữ liệu mẫu (Seed data)
npm run seed

# Chạy Server Development
npm run dev
```

### 2. Frontend (FE)

```bash
# Di chuyển vào thư mục frontend
cd thesis-tapestry-main

# Cài đặt thư viện
npm install

# Chạy ứng dụng Development
npm run dev
```
Mặc định ứng dụng sẽ chạy tại: `http://localhost:5173`

---

## 👥 Tài khoản demo (Sau khi Seed)

| Vai trò | Email | Mật khẩu | Mô tả |
|---------|-------|----------|-------|
| Admin | admin@uni.edu | 123456 | Toàn quyền hệ thống |
| Trưởng bộ môn | hod@uni.edu | 123456 | Duyệt đề tài, phân công |
| Giảng viên 1 | gv1@uni.edu | 123456 | GVHD / GVPB |
| Giảng viên 2 | gv2@uni.edu | 123456 | Hội đồng |
| Sinh viên | sv1@uni.edu | 123456 | Làm khóa luận |

---

## ✨ Tính năng nổi bật (Mới nhất)

### 🛡 Quản lý & Bảo mật
- **Cô lập dữ liệu theo Bộ môn**: Giảng viên và Sinh viên chỉ thấy dữ liệu thuộc bộ môn của mình.
- **Phân tách vai trò chấm điểm**: Form chấm điểm hiển thị động theo vai trò (GV hướng dẫn, Phản biện hoặc Hội đồng).

### 🎯 Quy trình học thuật
- **Đánh giá Giữa kỳ (Midterm)**: Quy trình đánh giá tập trung kèm theo phản hồi chi tiết từ GVHD.
- **Phân công tự động (Auto-Assignment)**: Trưởng bộ môn có thể phân công trực tiếp GV phản biện và Hội đồng (Tự động chấp nhận).
- **Hệ thống Điểm cộng NCKH**: Quy trình nộp và duyệt điểm thưởng từ các hoạt động nghiên cứu.

### 📢 Tương tác & Thông báo
- **Hệ thống Thông báo trung tâm**: Tự động gửi thông báo khi có các sự kiện: đăng ký, phê duyệt, được phân công...
- **Realtime Chat**: Trao đổi trực tiếp trong nhóm đề tài.

---

## 🛠 Công nghệ sử dụng

### Frontend (FE)
- **Framework**: React 18 + Vite + TypeScript.
- **UI & Styling**: Ant Design, TailwindCSS, Lucide Icons.
- **Quản lý trạng thái**: Zustand, TanStack Query (React Query).
- **Khác**: i18next (Đa ngôn ngữ), DayJS (Xử lý thời gian).

### Backend (BE)
- **Framework**: Node.js + Express (v5.1.0).
- **ORM**: Prisma với PostgreSQL.
- **Bảo mật**: JWT (Authentication), bcryptjs (Hash mật khẩu), Helmet, Rate Limit.
- **Validation**: Zod & Express Validator.
- **Logging**: Winston & Morgan.

---

## 🗺 Sitemap & Quy trình
Chi tiết về cấu trúc trang và luồng nghiệp vụ cho từng vai trò có thể xem tại: [SITEMAP.md](./SITEMAP.md)