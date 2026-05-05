import { PrismaClient, UserRole, TopicStatus, RegistrationStatus, AssignmentStatus, AssignmentType, StudentProgressStatus, SemesterStatus, ProgressStage } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

function removeAccents(str: string) {
  return str.normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd').replace(/Đ/g, 'D');
}

function generateEmail(fullName: string, counts: Record<string, number>) {
  // Remove titles like ThS., TS., PGS.TS., GS.TS., KS., NCS., etc.
  let name = fullName.replace(/^(ThS\.|TS\.|PGS\.TS\.|GS\.TS\.|KS\.|ThS\. NCS\.)\s+/i, '');
  name = name.replace(/\s*\(.*\)$/, '');
  name = removeAccents(name).toLowerCase();
  
  const parts = name.split(/\s+/).filter(p => p.length > 0);
  if (parts.length < 1) return 'user1@iuh.edu.vn';
  
  const lastName = parts[0];
  const firstName = parts[parts.length - 1];
  
  const base = `${lastName}${firstName}`;
  counts[base] = (counts[base] || 0) + 1;
  
  return `${base}${counts[base]}@iuh.edu.vn`;
}

async function main() {
  console.log('🌱 Bắt đầu nạp dữ liệu mới (Full Faculty)...');

  const commonPassword = await bcrypt.hash('Password@123', 10);

  // 1. DEPARTMENTS
  console.log('📚 Tạo bộ môn...');
  const departments = [
    { code: 'SE', name: 'Kỹ thuật phần mềm', description: 'Bộ môn Kỹ thuật phần mềm' },
    { code: 'CS', name: 'Khoa học máy tính', description: 'Bộ môn Khoa học máy tính' },
    { code: 'IT', name: 'Công nghệ thông tin', description: 'Bộ môn Công nghệ thông tin' },
    { code: 'IS', name: 'Hệ thống thông tin', description: 'Bộ môn Hệ thống thông tin' },
    { code: 'DA', name: 'Khoa học dữ liệu', description: 'Bộ môn Khoa học dữ liệu' },
  ];

  const deptMap: Record<string, any> = {};
  for (const d of departments) {
    deptMap[d.code] = await prisma.department.upsert({
      where: { code: d.code },
      update: { name: d.name, description: d.description },
      create: d
    });
  }

  // 2. SEMESTERS
  console.log('📅 Tạo học kỳ hiện tại...');
  const semester = await prisma.semester.upsert({
    where: { code: 'HK2_2025_2026' },
    update: { status: SemesterStatus.ACTIVE },
    create: {
      code: 'HK2_2025_2026',
      name: 'Học kỳ 2 2025-2026',
      status: SemesterStatus.ACTIVE,
      start_date: new Date('2026-05-05'),
      end_date: new Date('2026-07-15'),
      topic_viewing_start: new Date('2026-05-05'),
      topic_viewing_end: new Date('2026-05-10'),
      topic_registration_start: new Date('2026-05-11'),
      topic_registration_end: new Date('2026-05-20'),
      proposal_deadline: new Date('2026-06-15'),
      thesis_deadline: new Date('2026-07-01'),
      defense_start: new Date('2026-07-05'),
      defense_end: new Date('2026-07-15'),
    },
  });

  // 3. FULL FACULTY DATA
  console.log('👥 Tạo đội ngũ giảng viên...');
  const rawFacultyData: Record<string, string[]> = {
    "SE": [
      "ThS. Phạm Quảng Tri", "TS. Tôn Long Phước", "TS. Nguyễn Thị Hạnh (Trưởng bộ môn)",
      "ThS. Bùi Đình Tiền", "ThS. Châu Thị Bảo Hà", "TS. Nguyễn Minh Hải",
      "ThS. Nguyễn Thị Hoàng Khánh", "ThS. Nguyễn Thị Hồng Lương", "TS. Nguyễn Trọng Tiến",
      "ThS. Nguyễn Văn Thắng", "TS. Nguyễn Vũ Lâm", "TS. Nguyễn Đình Quyền",
      "ThS. Phạm Thanh Hùng", "ThS. Trần Thế Trung", "ThS. Trần Thị Anh Thi",
      "ThS. Đặng Thị Thu Hà (Phó bộ môn)", "ThS. Đặng Văn Thuận"
    ],
    "CS": [
      "TS. Lê Nhật Duy (Trưởng khoa)", "TS. Hồ Đắc Quán (Trưởng bộ môn)", "TS. Phạm Thị Thiết (Phó bộ môn)",
      "TS. Phạm Văn Chung", "PGS.TS Huỳnh Tường Nguyên (Phó trưởng Khoa)", "TS. Đặng Thị Phúc (Phó trưởng Khoa)",
      "ThS. Bùi Công Danh", "ThS. Giảng Thanh Trọn (Tổ trưởng tổ kỹ thuật)", "TS. Lê Thị Vĩnh Thanh",
      "ThS. Lê Vũ Hạo (NCS)", "TS. Lê Đình Long", "ThS. Nguyễn Ngọc Lễ(NCS)",
      "TS. Nguyễn Thanh Chuyên", "TS. Nguyễn Tiến Thịnh", "ThS. Võ Quang Hoàng Khang",
      "TS. Võ Đăng Khoa", "TS. Đoàn Văn Thắng"
    ],
    "IT": [
      "TS. Tạ Duy Công Chiến (Trưởng bộ môn)", "TS. Trần Thị Minh Khoa", "ThS. Hoàng Đình Hạnh",
      "TS. Lê Thị Thủy", "ThS. NCS. Võ Công Minh (Phó bộ môn)", "ThS. Nguyễn Thành Thái (NCS)",
      "ThS. Nguyễn Văn Quang", "ThS. Nguyễn Xuân Lô", "ThS. Phạm Thái Khanh",
      "ThS. Trương Bá Phúc", "TS. Đặng Thanh Bình", "ThS. Đỗ Hà Phương"
    ],
    "IS": [
      "ThS. Trần Thị Kim Chi (Phó bộ môn)", "ThS. Nguyễn Phúc Hưng (NCS)", "TS. Ngô Hữu Dũng (Trưởng bộ môn)",
      "ThS. Bùi Văn Đồng", "ThS. Huỳnh Nam (NCS)", "ThS. Huỳnh Tấn Hát",
      "ThS. Lê Thị Ánh Tuyết", "ThS. Lê Thùy Trang", "ThS. Lê Trọng Hiền (NCS)",
      "ThS. Nguyễn Hữu Quang (NCS)", "ThS. Nguyễn Ngọc Dung", "TS. Nguyễn Tấn Hoàng",
      "ThS. Nguyễn Thị Thanh Bình", "ThS. Nguyễn Trần Kỹ", "ThS. Phạm Thị Xuân Hiền",
      "ThS. Phan Thị Bảo Trân", "ThS. Võ Ngọc Tấn Phước"
    ],
    "DA": [
      "GS.TS. Huỳnh Trung Hiếu", "TS. Lê Trọng Ngọc ( PGĐ trung tâm NN - TH)", "TS. Bùi Thanh Hùng (TTCĐ) (Trưởng bộ môn)",
      "ThS. Nguyễn Hữu Tình (Phó bộ môn)", "TS. Huỳnh Công Bằng", "PGS.TS Nguyễn Hòa",
      "TS. Nguyễn Hữu Vũ", "TS. Nguyễn Lê Linh", "TS. Nguyễn Minh Hạnh",
      "TS. Phan Hồng Tín", "ThS. Trần Nhật Hoàng Anh", "KS. Trần Tấn Thành",
      "TS. Trịnh Thanh Sơn", "ThS. Trương Vĩnh Linh", "TS. Vũ Đức Thịnh"
    ]
  };

  const emailCounts: Record<string, number> = {};
  const facultyMap: Record<string, any[]> = { SE: [], CS: [], IT: [], IS: [], DA: [] };

  for (const [deptCode, names] of Object.entries(rawFacultyData)) {
    for (const rawName of names) {
      const isHod = rawName.includes('Trưởng bộ môn');
      const fullName = rawName.replace(/\s*\(.*\)$/, '');
      const email = generateEmail(rawName, emailCounts);
      
      const user = await prisma.user.upsert({
        where: { email },
        update: { 
          full_name: fullName, 
          departmentId: deptMap[deptCode].id,
          role: isHod ? UserRole.HEAD : UserRole.LECTURER 
        },
        create: {
          email, password_hash: commonPassword,
          full_name: fullName, 
          role: isHod ? UserRole.HEAD : UserRole.LECTURER,
          departmentId: deptMap[deptCode].id, 
          active: true
        }
      });
      facultyMap[deptCode].push(user);
    }
  }

  // 4. ADMIN
  await prisma.user.upsert({
    where: { email: 'admin@iuh.edu.vn' },
    update: {},
    create: {
      email: 'admin@iuh.edu.vn', password_hash: commonPassword,
      full_name: 'Quản trị viên hệ thống', role: UserRole.ADMIN,
      departmentId: deptMap['IS'].id
    }
  });

  // 5. SAMPLE STUDENTS & TOPICS (Optional - Commented out to keep DB clean)
  /*
  console.log('🎓 Tạo sinh viên và đề tài mẫu...');
  ...
  */

  // 6. GRADING CRITERIA
  console.log('📊 Tạo tiêu chí đánh giá...');
  const loCriteria = [
    { name: "Phân tích vấn đề (LO1)", weight: 0.1 },
    { name: "Giải pháp kỹ thuật (LO2)", weight: 0.1 },
    { name: "Thiết kế hệ thống (LO3)", weight: 0.1 },
    { name: "Hiện thực mã nguồn (LO4)", weight: 0.15 },
    { name: "Đánh giá & Thử nghiệm (LO5)", weight: 0.15 },
    { name: "Thuyết trình & Phản biện (LO6)", weight: 0.1 },
    { name: "Thu thập yêu cầu (LO7)", weight: 0.1 },
    { name: "Báo cáo khóa luận (LO8)", weight: 0.1 },
    { name: "Làm việc nhóm (LO9)", weight: 0.05 },
    { name: "Vận hành hệ thống (LO10)", weight: 0.05 },
  ];

  for (let i = 0; i < loCriteria.length; i++) {
    const lo = loCriteria[i];
    await prisma.gradingCriterion.upsert({
      where: { id: `LO${i+1}` }, // Not stable but for seeding
      update: {},
      create: {
        id: `LO${i+1}`,
        name: lo.name,
        description: `Tiêu chí ${lo.name}`,
        weight: lo.weight,
        max_score: 10,
        min_score: 0,
        role: 'SUPERVISOR',
        criteria_type: 'FINAL',
        order_index: i,
        active: true,
      }
    });
  }

  console.log('✅ Nạp dữ liệu hoàn tất!');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
