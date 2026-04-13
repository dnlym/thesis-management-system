# Thesis Project V2

Kho lưu trữ này chứa mã nguồn cho Hệ thống Quản lý Luận văn (Thesis Management System), bao gồm Backend (Node.js/Express) và Frontend (React/Vite).

## Yêu cầu tiên quyết (Prerequisites)

- **Node.js**: Khuyên dùng phiên bản v18 trở lên.
- **PostgreSQL**: Đảm bảo bạn đã cài đặt và đang chạy PostgreSQL.
- **npm**: Trình quản lý gói (thường đi kèm với Node.js).

## Cấu trúc dự án

- `thesis-be - Copy`: Ứng dụng Backend (Express, Prisma, PostgreSQL).
- `thesis-tapestry-main - Copy`: Ứng dụng Frontend (React, Vite, TailwindCSS, Shadcn/UI).

## Cài đặt & Thiết lập (Installation & Setup)

### 1. Thiết lập Backend

Di chuyển vào thư mục backend:

```bash
cd "thesis-be - Copy"
```

Cài đặt các thư viện phụ thuộc:
> **[LẦN ĐẦU]**: Bước này chỉ cần chạy một lần khi mới tải code về hoặc khi có thư viện mới.
```bash
npm install
```

**Cấu hình môi trường (.env):**
> **[LẦN ĐẦU]**: Tạo file `.env` trong thư mục `thesis-be - Copy`. Copy nội dung từ `.env.example` (nếu có) hoặc đảm bảo có các biến sau (ví dụ):
```env
DATABASE_URL="postgresql://user:password@localhost:5432/thesis_db?schema=public"
JWT_SECRET="your_super_secret_key"
PORT=5000
```

Thiết lập Cơ sở dữ liệu (Database):
> **[LẦN ĐẦU]**: Chạy các lệnh sau để khởi tạo database.
```bash
# Tạo Prisma client (Chạy lại mỗi khi sửa schema.prisma)
npm run prisma:generate

# Chạy migration để tạo bảng trong database (Chạy lần đầu hoặc khi sửa schema)
npm run prisma:migrate

# (Tùy chọn) Tạo dữ liệu mẫu ban đầu
npm run seed
```

### 2. Thiết lập Frontend

Di chuyển vào thư mục frontend:

```bash
cd "../thesis-tapestry-main - Copy"
```

Cài đặt các thư viện phụ thuộc:
> **[LẦN ĐẦU]**: Bước này chỉ cần chạy một lần.
```bash
npm install
```

**Cấu hình môi trường (.env):**
> **[LẦN ĐẦU]**: Tạo file `.env` nếu cần thiết (thường frontend Vite sẽ dùng `.env` để chứa API URL). Ví dụ:
```env
VITE_API_URL=http://localhost:5000/api
```

## Chạy ứng dụng (Running the App)

Bạn cần mở 2 cửa sổ terminal để chạy cả Backend và Frontend cùng lúc.

### Chạy Backend

Tại thư mục `thesis-be - Copy`:

```bash
npm run dev
```
Server sẽ khởi động (thường là port 5000).

### Chạy Frontend

Tại thư mục `thesis-tapestry-main - Copy`:

```bash
npm run dev
```
Ứng dụng sẽ chạy tại địa chỉ hiển thị trên terminal (thường là `http://localhost:5173`).

---

## Kế hoạch kiểm thử (Test Plan) - Kiểm tra thủ công

Do dự án chưa có nhiều test tự động, hãy làm theo các bước sau để kiểm tra hệ thống hoạt động đúng.

### 1. Xác thực (Authentication)
- **Đăng ký (Register)**:
    - Vào trang đăng ký.
    - Tạo tài khoản mới với email và mật khẩu.
    - Kiểm tra xem có chuyển hướng đến trang Login hoặc Dashboard không.
    - (Tùy chọn) Kiểm tra database xem user đã được tạo chưa.
- **Đăng nhập (Login)**:
    - Đăng nhập với tài khoản vừa tạo.
    - Kiểm tra chuyển hướng thành công vào Dashboard.
- **Đăng xuất (Logout)**:
    - Nhấn nút đăng xuất.
    - Kiểm tra chuyển hướng về trang Login.

### 2. Dashboard & Điều hướng
- **Phân quyền (Role-based Access)**:
    - Đăng nhập với vai trò **Sinh viên (Student)**: Kiểm tra các menu dành cho sinh viên (Ví dụ: Đăng ký đề tài, Nộp bài).
    - Đăng nhập với vai trò **Giảng viên (Teacher/Reviewer)**: Kiểm tra các menu dành cho giảng viên (Ví dụ: Chấm điểm, Quản lý đề tài).
- **Điều hướng (Navigation)**:
    - Click vào các mục trên thanh menu (Sidebar).
    - Đảm bảo không có lỗi 404 hoặc trang trắng.

### 3. Chức năng chính (Core Features)
- **Đề tài (Topics)**:
    - (Giảng viên) Tạo đề tài mới.
    - Xem danh sách đề tài.
    - (Sinh viên) Đăng ký đề tài.
- **Bài tập (Assignments)**:
    - (Giảng viên) Tạo bài tập mới, đặt hạn nộp.
    - (Sinh viên) Xem bài tập và nộp file/text.
- **Chấm điểm (Grading)**:
    - (Giảng viên) Xem danh sách bài nộp.
    - (Giảng viên) Nhập điểm và nhận xét.
    - (Sinh viên) Xem điểm và nhận xét của mình.

### 4. Xử lý lỗi (Error Handling)
- **Sai mật khẩu**: Thử đăng nhập sai pass -> Mong đợi thông báo lỗi.
- **Thiếu thông tin**: Thử submit form (Đăng ký, Tạo bài tập) mà bỏ trống trường bắt buộc -> Mong đợi lỗi validate.

## Khắc phục sự cố (Troubleshooting)

- **Lỗi kết nối Database**: Kiểm tra `DATABASE_URL` trong file `.env` backend. Đảm bảo PostgreSQL đang chạy.
- **Lỗi CORS**: Nếu frontend không gọi được API backend, kiểm tra cấu hình `cors` trong `src/server.ts` hoặc `src/index.ts` ở backend.
- **Module Not Found**: Đảm bảo bạn đã chạy `npm install` ở cả 2 thư mục (backend và frontend).
