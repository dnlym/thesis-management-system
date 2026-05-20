import { PrismaClient, UserRole, TopicStatus, RegistrationStatus, StudentProgressStatus, SemesterStatus, ProgressStage, RaterRole, MidtermStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { normalizeTitle } from '../src/utils/string';

const prisma = new PrismaClient();

const rawStudentData = [
  { masv: "22653531", hoDem: "Nguyễn Trần", ten: "Thành", lop: "DHHTTT18BT", nhóm: "Làm một mình", deTai: "Xây dựng hệ thống thi trực tuyến tích hợp AI nhận diện khuôn mặt chống gian lận" },
  { masv: "21077161", hoDem: "Nguyễn Thanh", ten: "Phới", lop: "DHHTTT17A", nhóm: "Làm một mình", deTai: "Tìm hiểu hệ thống Odoo và ứng dụng vào quá trình tạo và quản lý 1 hệ thống thông tin quản lý cụ thể." },
  { masv: "21105841", hoDem: "Đào Hoa Anh", ten: "Thư", lop: "DHHTTT17B", nhóm: "Làm một mình", deTai: "Xây dựng hệ thống xét duyệt thi đua, khen thưởng." },
  { masv: "21128931", hoDem: "Cao Bình", ten: "Uy", lop: "DHHTTT17B", nhóm: "Làm một mình", deTai: "Hệ thống quản lý rạp chiếu phim" },
  { masv: "21079291", hoDem: "Lê Minh", ten: "Khánh", lop: "DHHTTT17AT", nhóm: "Làm một mình", deTai: "Xây dựng ứng dụng website đặt và quản lý tour du lịch" },
  { masv: "21014621", hoDem: "Lư Minh", ten: "Thuận", lop: "DHHTTT17A", nhóm: "1653", deTai: "Xây dựng website quản lý sản xuất cho nhà máy" },
  { masv: "21078301", hoDem: "Nguyễn Thị Diệu", ten: "Thu", lop: "DHHTTT17A", nhóm: "1653", deTai: "Xây dựng website quản lý sản xuất cho nhà máy" },
  { masv: "22684591", hoDem: "Trần Thị Thanh", ten: "Thảo", lop: "DHHTTT18ATT", nhóm: "1655", deTai: "Nền tảng Lakehouse đa khách hàng tích hợp thu thập và phân tích dữ liệu CDC từ nhiều nguồn cơ sở dữ liệu quan hệ" },
  { masv: "22637851", hoDem: "Nguyễn Thị Ngọc", ten: "Bích", lop: "DHHTTT18ATT", nhóm: "1655", deTai: "Nền tảng Lakehouse đa khách hàng tích hợp thu thập và phân tích dữ liệu CDC từ nhiều nguồn cơ sở dữ liệu quan hệ" },
  { masv: "21028331", hoDem: "Huỳnh Thanh", ten: "Hoàng", lop: "DHHTTT17A", nhóm: "1659", deTai: "Tìm hiểu và ứng dụng công nghệ mới trong xây dựng hệ thống quản lý rạp chiếu phim" },
  { masv: "21083181", hoDem: "Trương Huỳnh Kim", ten: "Yến", lop: "DHHTTT17B", nhóm: "1659", deTai: "Tìm hiểu và ứng dụng công nghệ mới trong xây dựng hệ thống quản lý rạp chiếu phim" },
  { masv: "21092831", hoDem: "Mã Đan", ten: "Ly", lop: "DHHTTT17BT", nhóm: "1660", deTai: "Xây dựng hệ thống quản lý quá trình đăng ký và thực hiện Khóa luận tốt nghiệp tại trường Đại học Công nghiệp Thành phố Hồ Chí Minh" },
  { masv: "21023301", hoDem: "Nguyễn Thanh", ten: "Kha", lop: "DHHTTT17AT", nhóm: "1660", deTai: "Xây dựng hệ thống quản lý quá trình đăng ký và thực hiện Khóa luận tốt nghiệp tại trường Đại học Công nghiệp Thành phố Hồ Chí Minh" },
  { masv: "21005841", hoDem: "Lê Đỗ Trung", ten: "Kiên", lop: "DHHTTT17A", nhóm: "1661", deTai: "Xây dựng ứng dụng quản lý giao hàng ..." },
  { masv: "21011671", hoDem: "Lý Thạch Phúc", ten: "Lộc", lop: "DHHTTT17A", nhóm: "1661", deTai: "Xây dựng ứng dụng quản lý giao hàng ..." },
  { masv: "21027161", hoDem: "Lê Văn", ten: "Vinh", lop: "DHHTTT17A", nhóm: "1662", deTai: "Xây dựng website bán quần áo thời trang" },
  { masv: "21004365", hoDem: "Nguyễn Bá", ten: "Điền", lop: "DHHTTT17A", nhóm: "1662", deTai: "Xây dựng website bán quần áo thời trang" },
  { masv: "18032061", hoDem: "Trương Văn Thanh", ten: "Lâm", lop: "DHHTTT14", nhóm: "1665", deTai: "Xây dựng hệ thống thương mại điện tử tích hợp chăm sóc khách hàng" },
  { masv: "21024151", hoDem: "Võ Duy", ten: "Anh", lop: "DHHTTT17AT", nhóm: "1665", deTai: "Xây dựng hệ thống thương mại điện tử tích hợp chăm sóc khách hàng" },
  { masv: "21083761", hoDem: "Nguyễn Đức", ten: "Mạnh", lop: "DHHTTT17BT", nhóm: "1670", deTai: "Hệ thống đặt sân bóng đá và quản lý lịch thi đấu" },
  { masv: "21096461", hoDem: "Lương Tấn", ten: "Thành", lop: "DHHTTT17BT", nhóm: "1670", deTai: "Hệ thống đặt sân bóng đá và quản lý lịch thi đấu" },
  { masv: "21041641", hoDem: "Nguyễn Nhường", ten: "Em", lop: "DHHTTT17A", nhóm: "1674", deTai: "Xây dựng hệ thống điểm danh sinh viên tự động bằng nhận diện khuôn mặt sử dụng học sâu ..." },
  { masv: "21034871", hoDem: "Huỳnh Ngọc", ten: "Phú", lop: "DHHTTT17A", nhóm: "1674", deTai: "Xây dựng hệ thống điểm danh sinh viên tự động bằng nhận diện khuôn mặt sử dụng học sâu ..." },
  { masv: "21029471", hoDem: "Nguyễn Nhựt", ten: "Huỳnh", lop: "DHHTTT17A", nhóm: "1678", deTai: "Nghiên cứu các kỹ thuật bảo mật web, áp dụng xây dựng hệ thống web app (sinh viên tự chọn tên hệ thống)" },
  { masv: "21036841", hoDem: "Nguyễn Anh", ten: "Kiệt", lop: "DHHTTT17A", nhóm: "1678", deTai: "Nghiên cứu các kỹ thuật bảo mật web, áp dụng xây dựng hệ thống web app (sinh viên tự chọn tên hệ thống)" },
  { masv: "21074041", hoDem: "Trần Minh", ten: "Mính", lop: "DHHTTT17B", nhóm: "1680", deTai: "Tìm hiểu các công nghệ mới và xây dựng hệ thống quản lý nhà hàng" },
  { masv: "21076111", hoDem: "Dương Tuấn", ten: "Kiệt", lop: "DHHTTT17B", nhóm: "1680", deTai: "Tìm hiểu các công nghệ mới và xây dựng hệ thống quản lý nhà hàng" },
  { masv: "21099691", hoDem: "Đỗ Duy", ten: "Kha", lop: "DHHTTT17BT", nhóm: "1695", deTai: "Xây dựng Website quản lý giao hàng" },
  { masv: "21105371", hoDem: "Nguyễn Trần Bảo", ten: "Yến", lop: "DHHTTT17CT", nhóm: "1695", deTai: "Xây dựng Website quản lý giao hàng" },
  { masv: "21029771", hoDem: "Đồng Tuấn", ten: "Anh", lop: "DHHTTT17AT", nhóm: "1697", deTai: "Triển khai hệ thống ERP trong doanh nghiệp" },
  { masv: "21012641", hoDem: "Phan Ngô Ngọc", ten: "Tín", lop: "DHHTTT17AT", nhóm: "1697", deTai: "Triển khai hệ thống ERP trong doanh nghiệp" },
  { masv: "21004421", hoDem: "Trần Minh", ten: "Trí", lop: "DHHTTT17AT", nhóm: "1700", deTai: "Chatbot tư vấn và bán điện thoại" },
  { masv: "21078891", hoDem: "Trần Hồ Hải", ten: "Phong", lop: "DHHTTT17AT", nhóm: "1700", deTai: "Chatbot tư vấn và bán điện thoại" },
  { masv: "21117241", hoDem: "Vũ Phạm Anh", ten: "Thư", lop: "DHHTTT17CT", nhóm: "1702", deTai: "Xây dựng hệ thống xét duyệt thi đua, khen thưởng." },
  { masv: "21128631", hoDem: "Phan Nguyễn Văn", ten: "Phúc", lop: "DHHTTT17AT", nhóm: "1702", deTai: "Xây dựng hệ thống xét duyệt thi đua, khen thưởng." },
  { masv: "21003231", hoDem: "Võ Văn", ten: "Nhí", lop: "DHHTTT17A", nhóm: "1704", deTai: "Phân tích dữ liệu ứng dụng trong bài toán dự đoán." },
  { masv: "21066721", hoDem: "Đoàn Thị Mai", ten: "Linh", lop: "DHHTTT17B", nhóm: "1704", deTai: "Phân tích dữ liệu ứng dụng trong bài toán dự đoán." },
  { masv: "21139231", hoDem: "Võ Hoàng Nhã", ten: "Quyên", lop: "DHHTTT17AT", nhóm: "1708", deTai: "Xây dựng hệ thống quản lý trung tâm tin học." },
  { masv: "21120491", hoDem: "Nguyễn Võ Tú", ten: "Uyên", lop: "DHHTTT17CT", nhóm: "1708", deTai: "Xây dựng hệ thống quản lý trung tâm tin học." },
  { masv: "21080031", hoDem: "Lê Hoàng", ten: "Nhớ", lop: "DHHTTT17A", nhóm: "1713", deTai: "Nền tảng thương mại điện tử cho mua bán hàng hóa tự do giữa người tiêu dùng" },
  { masv: "21101221", hoDem: "Phùng Nguyên", ten: "Tân", lop: "DHHTTT17CT", nhóm: "1713", deTai: "Nền tảng thương mại điện tử cho mua bán hàng hóa tự do giữa người tiêu dùng" },
  { masv: "22640841", hoDem: "Trần Quốc", ten: "Sáng", lop: "DHHTTT18A", nhóm: "1716", deTai: "Thiết kế và xây dựng hệ thống đặt xe dịch vụ thời gian thực theo hướng kiến trúc vi dịch vụ" },
  { masv: "21131061", hoDem: "Dương Đức", ten: "Quý", lop: "DHHTTT17CT", nhóm: "1716", deTai: "Thiết kế và xây dựng hệ thống đặt xe dịch vụ thời gian thực theo hướng kiến trúc vi dịch vụ" },
  { masv: "21011611", hoDem: "Nguyễn Tấn", ten: "Phúc", lop: "DHHTTT17A", nhóm: "1717", deTai: "Xây dựng ứng dụng Thương mại điện tử tích hợp tính năng giao hàng" },
  { masv: "21009881", hoDem: "Lê Đạt", ten: "Thành", lop: "DHHTTT17A", nhóm: "1717", deTai: "Xây dựng ứng dụng Thương mại điện tử tích hợp tính năng giao hàng" },
  { masv: "21060901", hoDem: "Mai Hoàng", ten: "Lân", lop: "DHHTTT17BT", nhóm: "1720", deTai: "Tìm hiểu các công nghệ mới và Xây dựng hệ thống quản lý du lịch" },
  { masv: "21087771", hoDem: "Phạm Quốc", ten: "Đại", lop: "DHHTTT17BT", nhóm: "1720", deTai: "Tìm hiểu các công nghệ mới và Xây dựng hệ thống quản lý du lịch" },
  { masv: "21123091", hoDem: "Ân Hiền Bảo", ten: "Phúc", lop: "DHHTTT17B", nhóm: "1727", deTai: "Hệ thống quản lý kho thông minh tích hợp AI" },
  { masv: "21064111", hoDem: "Dương Thái", ten: "Bảo", lop: "DHHTTT17B", nhóm: "1727", deTai: "Hệ thống quản lý kho thông minh tích hợp AI" }
];

async function main() {
  const commonPassword = await bcrypt.hash('Password@123', 10);
  console.log('🌱 Bắt đầu nạp dữ liệu chuẩn...');

  // 0. CLEAR OLD DATA
  console.log('🧹 Đang dọn dẹp dữ liệu cũ...');
  await prisma.auditLog.deleteMany();
  await prisma.topicVersion.deleteMany();
  await prisma.extraPointRequest.deleteMany();
  await prisma.gradeHistory.deleteMany();
  await prisma.grade.deleteMany();
  await prisma.finalScore.deleteMany();
  await prisma.assignment.deleteMany();
  await prisma.defenseSchedule.deleteMany();
  await prisma.topicRegistration.deleteMany();
  await prisma.groupMember.deleteMany();
  await prisma.group.deleteMany();
  await prisma.topic.deleteMany();
  await prisma.user.deleteMany({ where: { role: UserRole.STUDENT } });

  // 1. DEPARTMENTS
  const departments = [{ code: 'SE', name: 'Kỹ thuật phần mềm' }, { code: 'CS', name: 'Khoa học máy tính' }, { code: 'IT', name: 'Công nghệ thông tin' }, { code: 'IS', name: 'Hệ thống thông tin' }, { code: 'DA', name: 'Khoa học dữ liệu' }];
  const deptMap: any = {};
  for (const d of departments) { deptMap[d.code] = await prisma.department.upsert({ where: { code: d.code }, update: { name: d.name }, create: { code: d.code, name: d.name } }); }

  // 2. SEMESTER
  const semester = await prisma.semester.upsert({
    where: { code: 'HK2_2025_2026' }, update: { status: SemesterStatus.ACTIVE },
    create: { code: 'HK2_2025_2026', name: 'Học kỳ 2 2025-2026', status: SemesterStatus.ACTIVE, start_date: new Date('2026-05-05'), end_date: new Date('2026-07-15'), proposal_deadline: new Date('2026-06-15'), thesis_deadline: new Date('2026-07-01') }
  });

  const oldSemester = await prisma.semester.upsert({
    where: { code: 'HK1_2025_2026' }, update: { status: SemesterStatus.COMPLETED },
    create: { code: 'HK1_2025_2026', name: 'Học kỳ 1 2025-2026', status: SemesterStatus.COMPLETED, start_date: new Date('2025-09-01'), end_date: new Date('2026-01-15'), proposal_deadline: new Date('2025-10-15'), thesis_deadline: new Date('2026-01-01') }
  });

  // 3. FACULTY
  const rawFacultyData: any = {
    "SE": ["ThS. Phạm Quảng Tri", "TS. Tôn Long Phước", "TS. Nguyễn Thị Hạnh (Trưởng bộ môn)", "ThS. Bùi Đình Tiền", "ThS. Châu Thị Bảo Hà", "TS. Nguyễn Minh Hải", "ThS. Nguyễn Thị Hoàng Khánh", "ThS. Nguyễn Thị Hồng Lương", "TS. Nguyễn Trọng Tiến", "ThS. Nguyễn Văn Thắng", "TS. Nguyễn Vũ Lâm", "TS. Nguyễn Đình Quyền", "ThS. Phạm Thanh Hùng", "ThS. Trần Thế Trung", "ThS. Trần Thị Anh Thi", "ThS. Đặng Thị Thu Hà (Phó bộ môn)", "ThS. Đặng Văn Thuận"],
    "CS": ["TS. Lê Nhật Duy (Trưởng khoa)", "TS. Hồ Đắc Quán (Trưởng bộ môn)", "TS. Phạm Thị Thiết (Phó bộ môn)", "TS. Phạm Văn Chung", "PGS.TS Huỳnh Tường Nguyên (Phó trưởng Khoa)", "TS. Đặng Thị Phúc (Phó trưởng Khoa)", "ThS. Bùi Công Danh", "ThS. Giảng Thanh Trọn (Tổ trưởng tổ kỹ thuật)", "TS. Lê Thị Vĩnh Thanh", "ThS. Lê Vũ Hạo (NCS)", "TS. Lê Đình Long", "ThS. Nguyễn Ngọc Lễ (NCS)", "TS. Nguyễn Thanh Chuyên", "TS. Nguyễn Tiến Thịnh", "ThS. Võ Quang Hoàng Khang", "TS. Võ Đăng Khoa", "TS. Đoàn Văn Thắng"],
    "IT": ["TS. Tạ Duy Công Chiến (Trưởng bộ môn)", "TS. Trần Thị Minh Khoa", "ThS. Hoàng Đình Hạnh", "TS. Lê Thị Thủy", "ThS. NCS. Võ Công Minh (Phó bộ môn)", "ThS. Nguyễn Thành Thái (NCS)", "ThS. Nguyễn Văn Quang", "ThS. Nguyễn Xuân Lô", "ThS. Phạm Thái Khanh", "ThS. Trương Bá Phúc", "TS. Đặng Thanh Bình", "ThS. Đỗ Hà Phương"],
    "IS": ["ThS. Trần Thị Kim Chi (Phó bộ môn)", "ThS. Nguyễn Phúc Hưng (NCS)", "TS. Ngô Hữu Dũng (Trưởng bộ môn)", "ThS. Bùi Văn Đồng", "ThS. Huỳnh Nam (NCS)", "ThS. Huỳnh Tấn Hát", "ThS. Lê Thị Ánh Tuyết", "ThS. Lê Thùy Trang", "ThS. Lê Trọng Hiền (NCS)", "ThS. Nguyễn Hữu Quang (NCS)", "ThS. Nguyễn Ngọc Dung", "TS. Nguyễn Tấn Hoàng", "ThS. Nguyễn Thị Thanh Bình", "ThS. Nguyễn Trần Kỹ", "ThS. Phạm Thị Xuân Hiền", "ThS. Phan Thị Bảo Trân", "ThS. Võ Ngọc Tấn Phước"],
    "DA": ["GS.TS. Huỳnh Trung Hiếu", "TS. Lê Trọng Ngọc ( PGĐ trung tâm NN - TH)", "TS. Bùi Thanh Hùng (TTCĐ) (Trưởng bộ môn)", "ThS. Nguyễn Hữu Tình (Phó bộ môn)", "TS. Huỳnh Công Bằng", "PGS.TS Nguyễn Hòa", "TS. Nguyễn Hữu Vũ", "TS. Nguyễn Lê Linh", "TS. Nguyễn Minh Hạnh", "TS. Phan Hồng Tín", "ThS. Trần Nhật Hoàng Anh", "KS. Trần Tấn Thành", "TS. Trịnh Thanh Sơn", "ThS. Trương Vĩnh Linh", "TS. Vũ Đức Thịnh"]
  };
  const isLecturers: any[] = [];
  for (const [deptCode, names] of Object.entries(rawFacultyData)) {
    for (const rawName of names as string[]) {
      const isHod = rawName.includes('Trưởng bộ môn');
      const isCoordinator = rawName.includes('Nguyễn Hữu Quang');
      const fullName = rawName.replace(/\s*\(.*\)$/, '');
      let cleaned = fullName.toLowerCase().trim()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\s+/g, '')
        .replace(/đ/g, 'd');
      
      let emailPrefix = cleaned;
      if (cleaned.startsWith('ths')) {
        emailPrefix = 'ths.' + cleaned.substring(3);
      } else if (cleaned.startsWith('ts')) {
        emailPrefix = 'ts.' + cleaned.substring(2);
      } else if (cleaned.startsWith('pgsts')) {
        emailPrefix = 'pgs.ts.' + cleaned.substring(5);
      } else if (cleaned.startsWith('gsts')) {
        emailPrefix = 'gs.ts.' + cleaned.substring(4);
      } else if (cleaned.startsWith('ks')) {
        emailPrefix = 'ks.' + cleaned.substring(2);
      }
      const email = emailPrefix + "@iuh.edu.vn";
      const role = isHod ? UserRole.HEAD : (isCoordinator ? UserRole.COORDINATOR : UserRole.LECTURER);
      const user = await prisma.user.upsert({ where: { email }, update: { full_name: fullName, role, departmentId: deptMap[deptCode].id }, create: { email, full_name: fullName, password_hash: commonPassword, role, departmentId: deptMap[deptCode].id, active: true } });
      if (deptCode === 'IS') isLecturers.push(user);
    }
  }

  // 3.5. OLD TOPICS SEEDING (2 per Dept in HK1)
  console.log('🏛️ Nạp 10 đề tài cũ cho Học kỳ 1...');
  for (const dept of Object.values(deptMap) as any[]) {
    const lecturer = await prisma.user.findFirst({ where: { departmentId: dept.id, role: { in: [UserRole.LECTURER, UserRole.HEAD] } } });
    if (lecturer) {
      for (let i = 1; i <= 2; i++) {
        const title = `Đề tài cũ ${i} - ${dept.code} (HK1)`;
        await prisma.topic.create({
          data: {
            code: `${dept.code}_OLD_${i}`, title, normalized_title: normalizeTitle(title),
            description: `Mô tả cho ${title}`, objectives: 'Hoàn thành tốt', requirements: 'Vững kiến thức chuyên môn',
            status: TopicStatus.COMPLETED, progress_stage: ProgressStage.DONE,
            max_students: 2, current_students: 0, semester_id: oldSemester.id, departmentId: dept.id, supervisor_id: lecturer.id,
          }
        });
      }
    }
  }

  // 4. GROUPS & TOPICS RECOVERY (ACTIVE SEMESTER)
  console.log('📊 Nạp danh sách sinh viên và đề tài (Tách biệt theo nhóm)...');
  const topicsByGroup: Record<string, any[]> = {};
  rawStudentData.forEach(row => {
    const groupKey = row.nhóm === "Làm một mình" ? `SINGLE_${row.masv}` : `GROUP_${row.nhóm}`;
    if (!topicsByGroup[groupKey]) topicsByGroup[groupKey] = [];
    topicsByGroup[groupKey].push(row);
  });

  const topicEntries = Object.entries(topicsByGroup);
  for (let i = 0; i < topicEntries.length; i++) {
    const [groupKey, members] = topicEntries[i];
    const title = members[0].deTai;
    const supervisor = isLecturers[i % isLecturers.length];
    
    // Create topic with correct current_students and shorter code format
    const topic = await prisma.topic.create({
      data: {
        code: `IS${i + 1}`, // Shorter code format: IS1, IS2...
        title, normalized_title: normalizeTitle(title),
        description: `Đề tài Khóa luận: ${title}`, objectives: "Hoàn thành tốt.", requirements: "Vững kiến thức.",
        max_students: members.length > 1 ? 2 : 1, 
        current_students: members.length, // FIX: Update current_students count
        status: TopicStatus.REGISTERED, supervisor_id: supervisor.id, departmentId: deptMap['IS'].id, semester_id: semester.id,
      }
    });
    const createdStudentIds: string[] = [];
    for (const m of members) {
      const studentEmail = `${m.masv}@student.iuh.edu.vn`;
      const studentUser = await prisma.user.upsert({
        where: { email: studentEmail }, update: {},
        create: { email: studentEmail, password_hash: commonPassword, full_name: `${m.hoDem} ${m.ten}`, role: UserRole.STUDENT, student_code: m.masv, departmentId: deptMap['IS'].id, class_name: m.lop, active: true }
      });
      createdStudentIds.push(studentUser.id);
    }
    const groupName = `G1-${topic.code}`;
    const group = await prisma.group.create({ data: { name: groupName, leader_id: createdStudentIds[0], semester_id: semester.id, topic_id: topic.id } });
    const groupId = group.id;
    for (const sid of createdStudentIds) { await prisma.groupMember.create({ data: { group_id: groupId, user_id: sid, status: 'ACCEPTED' } }); }
    for (const sid of createdStudentIds) {
      await prisma.topicRegistration.create({ data: { student_id: sid, topic_id: topic.id, semester_id: semester.id, group_id: groupId, status: RegistrationStatus.CONFIRMED, student_progress_status: StudentProgressStatus.HAS_TOPIC, midterm_status: MidtermStatus.PASS, confirmed_at: new Date() } });
    }
  }

  // 5. CRITERIA
  const loNames = ["Phân tích vấn đề và mô hình hóa được yêu cầu của đề tài.", "Áp dụng các nguyên tắc, phương pháp chuyên môn để xác định được giải pháp cho đề tài.", "Thiết kế được một hệ thống hoặc quy trình đáp ứng được yêu cầu của đề tài.", "Hiện thực được một hệ thống hoặc quy trình đáp ứng được yêu cầu của đề tài.", "Đánh giá được một hệ thống, quy trình đáp ứng yêu cầu của đề tài.", "Thuyết trình hiệu quả trong các lĩnh vực chuyên môn của đề tài.", "Phỏng vấn theo những lĩnh vực khác nhau để thu thập yêu cầu của khách hàng.", "Viết được báo cáo khóa luận tốt nghiệp", "Chứng tỏ được khả năng làm việc hiệu quả với các thành viên trong nhóm", "Khả năng hỗ trợ triển khai và vận hành hệ thống thông tin"];
  const raterRoles = [RaterRole.SUPERVISOR, RaterRole.REVIEWER, RaterRole.COMMITTEE];
  for (const role of raterRoles) {
    for (let i = 0; i < loNames.length; i++) {
      const name = loNames[i];
      await prisma.gradingCriterion.upsert({ where: { id: `${role}_LO${i+1}` }, update: { name, description: name, weight: 0.1 }, create: { id: `${role}_LO${i+1}`, name, description: name, weight: 0.1, max_score: 10, min_score: 0, role, criteria_type: 'FINAL', order_index: i, active: true } });
    }
  }

  // 6. ADMIN
  await prisma.user.upsert({ where: { email: 'admin@iuh.edu.vn' }, update: {}, create: { email: 'admin@iuh.edu.vn', password_hash: commonPassword, full_name: 'Quản trị viên hệ thống', role: UserRole.ADMIN, departmentId: deptMap['IS'].id, active: true } });
  console.log('✅ Nạp dữ liệu hoàn tất!');
}

main().catch(console.error).finally(() => prisma.$disconnect());
