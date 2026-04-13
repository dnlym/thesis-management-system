# Hệ thống quản lý khóa luận tốt nghiệp

Một ứng dụng web frontend hoàn chỉnh được xây dựng bằng React + TypeScript + Vite để quản lý toàn bộ quy trình khóa luận tốt nghiệp.

## 🚀 Cài đặt và chạy

```bash
# 1. Cài đặt dependencies
npm install

# 2. Chạy ứng dụng development
npm run dev

# 3. Mở trình duyệt tại http://localhost:5173
```

## 👥 Tài khoản demo

| Vai trò | Email | Mật khẩu | Mô tả |
|---------|-------|----------|-------|
| Admin | admin@uni.edu | 123456 | Quản trị viên hệ thống |
| Trưởng bộ môn | hod@uni.edu | 123456 | Quản lý toàn bộ quy trình |
| Giảng viên | gv1@uni.edu | 123456 | GVHD/GVPB |
| Hội đồng | hd1@uni.edu | 123456 | Thành viên hội đồng |
| Sinh viên | sv1@uni.edu | 123456 | Thực hiện khóa luận |

## ✨ Tính năng chính

### 🎯 Quản lý đề tài
- Tạo, chỉnh sửa, duyệt đề tài
- Lịch sử revision với ghi chú
- Đăng ký đề tài trực tuyến

### 📊 Theo dõi tiến độ  
- Timeline các giai đoạn (Đề cương → Chương 1,2,3 → Hoàn thành)
- Cập nhật tiến độ theo thời gian thực
- Phản hồi từ GVHD

### 📁 Nộp bài & quản lý phiên bản
- Upload files với drag & drop
- Quản lý phiên bản và so sánh
- Hỗ trợ đa định dạng file

### 🎓 Đánh giá & phân loại bảo vệ
- Phân công GVHD, GVPB, Hội đồng
- Chấm điểm theo vai trò với công thức tính toán
- Poster hoặc Hội đồng bảo vệ
- Điểm cộng thêm

### 💬 Trao đổi & thông báo
- Chat theo đề tài với realtime polling
- Thông báo hệ thống tự động
- Upload file đính kèm

### 📅 Quản lý lịch trình
- Calendar tích hợp
- Lịch báo cáo thử, phản biện, họp hội đồng
- Nhắc nhở tự động

### 📈 Báo cáo & thống kê
- Biểu đồ phân tích với Recharts
- Thống kê theo GV, trạng thái, thời gian
- Export báo cáo

### ⚙️ Quản trị hệ thống
- Quản lý người dùng & phân quyền
- Cấu hình tiêu chí đánh giá
- Thiết lập hội đồng & nhóm poster

## 🛠 Công nghệ sử dụng

- **Frontend**: React 18 + TypeScript + Vite
- **UI Framework**: Ant Design + TailwindCSS  
- **State Management**: Zustand + React Query
- **Routing**: React Router v6
- **Charts**: Recharts
- **i18n**: react-i18next (vi/en)
- **Auth**: Mock authentication với localStorage

## 📱 Responsive Design

Ứng dụng được thiết kế responsive hoàn toàn, hỗ trợ tất cả các thiết bị từ mobile đến desktop với academic design system chuyên nghiệp.

## 🎨 Design System

- Màu chủ đạo: Academic Blue (#3b82f6)
- Typography: Semantic tokens
- Status colors: Pending, In Progress, Completed, Defended, Rejected
- Components: Shadcn/ui + Custom Ant Design theme

## 🔐 Phân quyền

- **Student**: Đăng ký đề tài, cập nhật tiến độ, nộp bài, chat
- **Lecturer**: Tạo đề tài, đánh giá, chấm điểm GVHD/GVPB  
- **Head of Dept**: Duyệt đề tài, phân công, báo cáo, quản lý
- **Council**: Chấm điểm hội đồng, xem lịch trình
- **Admin**: Toàn quyền quản lý hệ thống

Hệ thống đã sẵn sàng cho demo đầy đủ chức năng! 🎉