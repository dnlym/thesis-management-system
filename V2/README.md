# 🎓 Thesis Management System (TMS) - V2

Hệ thống Quản lý Khóa luận Tốt nghiệp toàn diện dành cho sinh viên, giảng viên và quản lý khoa. Giải pháp hiện đại giúp số hóa toàn bộ quy trình từ đăng ký đề tài đến chấm điểm và bảo vệ khóa luận.

---

## 🚀 Tính năng chính

### 👤 Người dùng & Phân quyền
- **Xác thực:** Đăng nhập, đăng ký, phân quyền dựa trên vai trò (Sinh viên, Giảng viên, Trưởng bộ môn, Giáo vụ).
- **Hồ sơ:** Quản lý thông tin cá nhân và thông báo hệ thống.

### 📝 Quản lý Đề tài & Đăng ký
- **Đề tài:** Giảng viên đề xuất đề tài, Trưởng bộ môn phê duyệt.
- **Đăng ký:** Sinh viên đăng ký đề tài theo nhóm hoặc cá nhân.
- **Phân công:** Tự động hoặc thủ công phân công Giảng viên hướng dẫn (GVHD) và Giảng viên phản biện (GVPB).

### 📊 Hệ thống Chấm điểm Đa cấp
- **Grading Workflow:** Quy trình chấm điểm linh hoạt qua 3 giai đoạn: GVHD, GVPB và Hội đồng bảo vệ.
- **Tiêu chí chấm điểm:** Tùy biến tiêu chí dựa trên quy định của từng bộ môn.
- **Điểm cộng:** Quản lý và phê duyệt điểm thưởng cho sinh viên.
- **Tổng hợp:** Tự động tính toán điểm trung bình và xếp loại theo trọng số.

### 🏛️ Hội đồng & Bảo vệ
- **Hội đồng:** Thành lập hội đồng bảo vệ, phân công thành viên (Chủ tịch, Thư ký, Ủy viên).
- **Phòng bảo vệ:** Quản lý địa điểm và sắp xếp lịch bảo vệ.

### 📱 Tiện ích khác
- **Mobile App:** Ứng dụng dành cho giảng viên để chấm điểm nhanh chóng và theo dõi lịch trình.
- **Dashboard:** Thống kê dữ liệu trực quan cho quản lý khoa.
- **Audit Log:** Lưu vết mọi thao tác quan trọng trên hệ thống.

---

## 🛠️ Công nghệ sử dụng

### 💻 Backend
- **Core:** Node.js, Express.js, TypeScript.
- **Database:** PostgreSQL với **Prisma ORM**.
- **Security:** JWT, BcryptJS, Helmet, Rate Limiting.
- **Docs:** Swagger UI.
- **Logging:** Winston & Morgan.

### 🎨 Frontend (Web)
- **Framework:** ReactJS, Vite, TypeScript.
- **UI:** Shadcn/UI (TailwindCSS + Radix UI), Ant Design.
- **State Management:** Zustand, TanStack Query.
- **Animations:** Framer Motion.
- **Charts:** Recharts.

### 📱 Mobile App
- **Framework:** React Native, Expo, TypeScript.
- **Styling:** NativeWind (TailwindCSS for Mobile).
- **Navigation:** Expo Router.

---

## ⚙️ Cài đặt & Khởi chạy

### 1. Yêu cầu hệ thống
- Node.js >= 18
- PostgreSQL >= 14
- npm hoặc yarn

### 2. Thiết lập Backend
```bash
cd thesis-be
npm install
cp .env.example .env # Cấu hình DATABASE_URL và JWT_SECRET
npx prisma generate
npx prisma migrate dev
npm run dev
```

### 3. Thiết lập Frontend
```bash
cd thesis-fe
npm install
cp .env.example .env # Cấu hình VITE_API_URL
npm run dev
```

### 4. Thiết lập Mobile
```bash
cd thesis-mobile
npm install
npx expo start
```

---

## 📁 Cấu trúc dự án
```text
.
├── thesis-be/         # Source code Backend (Node.js/Express)
├── thesis-fe/         # Source code Frontend Web (React/Vite)
├── thesis-mobile/     # Source code Mobile App (React Native/Expo)
├── ACCESS_CONTROL.md  # Tài liệu quy định phân quyền
└── SITEMAP.md         # Sơ đồ cấu trúc trang web
```

---

## 📄 Giấy phép
Dự án được phát triển nhằm mục đích phục vụ cho Khóa luận tốt nghiệp.

---
**Phát triển bởi:** [Tên của bạn]
