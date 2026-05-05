import { PrismaClient, UserRole } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const depts = {
  "Kỹ thuật phần mềm": "c6d1d63f-88c4-4833-b906-bca117b81711",
  "Khoa học máy tính": "034d777a-24a5-4ebf-a85c-157502364a07",
  "Công nghệ thông tin": "b7b529de-9532-4669-9ab8-4b9773fe4ff6",
  "Hệ thống thông tin": "62382f66-6713-42af-a345-d59a7ab6181c",
  "Khoa học dữ liệu": "7c22ec3a-5c56-4d58-bb44-553879b456d0"
};

const rawData = {
  "Kỹ thuật phần mềm": [
    "ThS. Phạm Quảng Tri",
    "TS. Tôn Long Phước",
    "TS. Nguyễn Thị Hạnh (Trưởng bộ môn)",
    "ThS. Bùi Đình Tiền",
    "ThS. Châu Thị Bảo Hà",
    "TS. Nguyễn Minh Hải",
    "ThS. Nguyễn Thị Hoàng Khánh",
    "ThS. Nguyễn Thị Hồng Lương",
    "TS. Nguyễn Trọng Tiến",
    "ThS. Nguyễn Văn Thắng",
    "TS. Nguyễn Vũ Lâm",
    "TS. Nguyễn Đình Quyền",
    "ThS. Phạm Thanh Hùng",
    "ThS. Trần Thế Trung",
    "ThS. Trần Thị Anh Thi",
    "ThS. Đặng Thị Thu Hà (Phó bộ môn)",
    "ThS. Đặng Văn Thuận"
  ],
  "Khoa học máy tính": [
    "TS. Lê Nhật Duy (Trưởng khoa)",
    "TS. Hồ Đắc Quán (Trưởng bộ môn)",
    "TS. Phạm Thị Thiết (Phó bộ môn)",
    "TS. Phạm Văn Chung",
    "PGS.TS Huỳnh Tường Nguyên (Phó trưởng Khoa)",
    "TS. Đặng Thị Phúc (Phó trưởng Khoa)",
    "ThS. Bùi Công Danh",
    "ThS. Giảng Thanh Trọn (Tổ trưởng tổ kỹ thuật)",
    "TS. Lê Thị Vĩnh Thanh",
    "ThS. Lê Vũ Hạo (NCS)",
    "TS. Lê Đình Long",
    "ThS. Nguyễn Ngọc Lễ(NCS)",
    "TS. Nguyễn Thanh Chuyên",
    "TS. Nguyễn Tiến Thịnh",
    "ThS. Võ Quang Hoàng Khang",
    "TS. Võ Đăng Khoa",
    "TS. Đoàn Văn Thắng"
  ],
  "Công nghệ thông tin": [
    "TS. Tạ Duy Công Chiến (Trưởng bộ môn)",
    "TS. Trần Thị Minh Khoa",
    "ThS. Hoàng Đình Hạnh",
    "TS. Lê Thị Thủy",
    "ThS. NCS. Võ Công Minh (Phó bộ môn)",
    "ThS. Nguyễn Thành Thái (NCS)",
    "ThS. Nguyễn Văn Quang",
    "ThS. Nguyễn Xuân Lô",
    "ThS. Phạm Thái Khanh",
    "ThS. Trương Bá Phúc",
    "TS. Đặng Thanh Bình",
    "ThS. Đỗ Hà Phương"
  ],
  "Hệ thống thông tin": [
    "ThS. Trần Thị Kim Chi (Phó bộ môn)",
    "ThS. Nguyễn Phúc Hưng (NCS)",
    "TS. Ngô Hữu Dũng (Trưởng bộ môn)",
    "ThS. Bùi Văn Đồng",
    "ThS. Huỳnh Nam (NCS)",
    "ThS. Huỳnh Tấn Hát",
    "ThS. Lê Thị Ánh Tuyết",
    "ThS. Lê Thùy Trang",
    "ThS. Lê Trọng Hiền (NCS)",
    "ThS. Nguyễn Hữu Quang (NCS)",
    "ThS. Nguyễn Ngọc Dung",
    "TS. Nguyễn Tấn Hoàng",
    "ThS. Nguyễn Thị Thanh Bình",
    "ThS. Nguyễn Trần Kỹ",
    "ThS. Phạm Thị Xuân Hiền",
    "ThS. Phan Thị Bảo Trân",
    "ThS. Võ Ngọc Tấn Phước"
  ],
  "Khoa học dữ liệu": [
    "GS.TS. Huỳnh Trung Hiếu",
    "TS. Lê Trọng Ngọc ( PGĐ trung tâm NN - TH)",
    "TS. Bùi Thanh Hùng (TTCĐ) (Trưởng bộ môn)",
    "ThS. Nguyễn Hữu Tình (Phó bộ môn)",
    "TS. Huỳnh Công Bằng",
    "PGS.TS Nguyễn Hòa",
    "TS. Nguyễn Hữu Vũ",
    "TS. Nguyễn Lê Linh",
    "TS. Nguyễn Minh Hạnh",
    "TS. Phan Hồng Tín",
    "ThS. Trần Nhật Hoàng Anh",
    "KS. Trần Tấn Thành",
    "TS. Trịnh Thanh Sơn",
    "ThS. Trương Vĩnh Linh",
    "TS. Vũ Đức Thịnh"
  ]
};

function removeAccents(str: string) {
  return str.normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd').replace(/Đ/g, 'D');
}

function generateEmailPrefix(fullName: string) {
  let name = fullName.replace(/^(ThS\.|TS\.|PGS\.TS\.|GS\.TS\.|KS\.|ThS\. NCS\.)\s+/i, '');
  name = name.replace(/\s*\(.*\)$/, '');
  name = removeAccents(name).toLowerCase();
  const parts = name.split(/\s+/);
  if (parts.length < 2) return name;
  const firstName = parts[parts.length - 1];
  const lastName = parts[0];
  const middleNames = parts.slice(1, parts.length - 1).map(p => p[0]).join('');
  return `${firstName}.${lastName}${middleNames}`;
}

async function main() {
  const passwordHash = await bcrypt.hash('Password123@', 10);
  
  for (const [deptName, names] of Object.entries(rawData)) {
    const departmentId = depts[deptName as keyof typeof depts];
    
    for (const rawName of names) {
      const isHod = rawName.includes('Trưởng bộ môn');
      const fullName = rawName.replace(/\s*\(.*\)$/, '');
      const role = isHod ? UserRole.HEAD : UserRole.LECTURER;
      
      // SEARCH BY FULL NAME FIRST
      const existingUser = await prisma.user.findFirst({
        where: { full_name: fullName }
      });
      
      if (existingUser) {
        // UPDATE EXISTING USER
        const updateData: any = { departmentId };
        if (isHod && existingUser.role !== UserRole.HEAD) {
          updateData.role = UserRole.HEAD;
        }
        
        await prisma.user.update({
          where: { id: existingUser.id },
          data: updateData
        });
        console.log(`Updated: ${fullName} - Keep email: ${existingUser.email}`);
      } else {
        // CREATE NEW USER
        const emailPrefix = generateEmailPrefix(rawName);
        const email = `${emailPrefix}@vnu.edu.vn`;
        
        await prisma.user.create({
          data: {
            email,
            password_hash: passwordHash,
            full_name: fullName,
            role,
            departmentId,
            active: true
          }
        });
        console.log(`Created: ${fullName} (${role}) - ${email}`);
      }
    }
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
