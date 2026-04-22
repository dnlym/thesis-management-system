import { PrismaClient, UserRole, TopicStatus, RegistrationStatus, AssignmentStatus, AssignmentType, StudentProgressStatus, SemesterStatus, ProgressStage } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Bắt đầu nạp dữ liệu mới (IS Focus)...');

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
  console.log('📅 Tạo học kỳ...');
  const semester = await prisma.semester.upsert({
    where: { code: 'HK2_2023_2024' },
    update: { status: SemesterStatus.ACTIVE },
    create: {
      code: 'HK2_2023_2024',
      name: 'Học kỳ 2 năm 2023-2024',
      status: SemesterStatus.ACTIVE,
      start_date: new Date('2024-01-01'),
      end_date: new Date('2024-07-15'),
      topic_viewing_start: new Date('2024-01-01'),
      topic_viewing_end: new Date('2024-01-15'),
      topic_registration_start: new Date('2024-01-16'),
      topic_registration_end: new Date('2024-01-30'),
      proposal_deadline: new Date('2024-03-31'),
      thesis_deadline: new Date('2024-06-30'),
      defense_start: new Date('2024-07-05'),
      defense_end: new Date('2024-07-15'),
    },
  });

  // 3. LECTURERS (IS Focus first)
  console.log('👥 Tạo giảng viên...');
  const facultyData = [
    {
      deptCode: 'IS',
      names: [
        "ThS. Trần Thị Kim Chi", "ThS. Nguyễn Phúc Hưng", "TS. Ngô Hữu Dũng",
        "ThS. Bùi Văn Đồng", "ThS. Huỳnh Nam", "ThS. Huỳnh Tấn Hát",
        "ThS. Lê Thị Ánh Tuyết", "ThS. Lê Thùy Trang", "ThS. Lê Trọng Hiền",
        "ThS. Nguyễn Hữu Quang", "ThS. Nguyễn Ngọc Dung", "TS. Nguyễn Tấn Hoàng",
        "ThS. Nguyễn Thị Thanh Bình", "ThS. Nguyễn Trần Kỹ", "ThS. Phạm Thị Xuân Hiền",
        "ThS. Phan Thị Bảo Trân", "ThS. Võ Ngọc Tấn Phước"
      ]
    },
    { deptCode: 'SE', names: ["TS. Nguyễn Minh Hải", "ThS. Phạm Quảng Tri"] },
    { deptCode: 'CS', names: ["TS. Lê Nhật Duy", "TS. Hồ Đắc Quán"] },
    { deptCode: 'IT', names: ["TS. Tạ Duy Công Chiến", "TS. Trần Thị Minh Khoa"] },
    { deptCode: 'DA', names: ["GS.TS. Huỳnh Trung Hiếu", "TS. Bùi Thanh Hùng"] }
  ];

  const admin = await prisma.user.upsert({
    where: { email: 'admin@university.edu.vn' },
    update: {},
    create: {
      email: 'admin@university.edu.vn', password_hash: commonPassword,
      full_name: 'Quản trị viên hệ thống', role: UserRole.ADMIN,
      departmentId: deptMap['IS'].id
    }
  });

  const isLecturers = [];
  const otherLecturers: Record<string, any[]> = { SE: [], CS: [], IT: [], DA: [] };

  for (const dept of facultyData) {
    for (const name of dept.names) {
      const email = name.toLowerCase()
        .replace(/\./g, '').replace(/\s+/g, '.')
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .replace(/[đĐ]/g, 'd') + '@university.edu.vn';
      
      const user = await prisma.user.upsert({
        where: { email },
        update: { full_name: name, departmentId: deptMap[dept.deptCode].id },
        create: {
          email, password_hash: commonPassword,
          full_name: name, role: dept.names.indexOf(name) === 2 && dept.deptCode === 'IS' ? UserRole.HEAD : UserRole.LECTURER,
          departmentId: deptMap[dept.deptCode].id, active: true
        }
      });
      if (dept.deptCode === 'IS') isLecturers.push(user);
      else otherLecturers[dept.deptCode].push(user);
    }
  }

  // 4. PASSED STUDENT DATA (Transcribed from chat)
  console.log('🎓 Tạo sinh viên và đề tài từ danh sách...');
  const rawData = [
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
    { masv: "21080031", hoDem: "Lê Hoàng", Nhớ: "Nhớ", lop: "DHHTTT17A", nhóm: "1713", deTai: "Nền tảng thương mại điện tử cho mua bán hàng hóa tự do giữa người tiêu dùng" },
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

  // Grouping the data by topic title
  const topicsByTitle: Record<string, any[]> = {};
  rawData.forEach(row => {
    if (!topicsByTitle[row.deTai]) topicsByTitle[row.deTai] = [];
    topicsByTitle[row.deTai].push(row);
  });

  const topicEntries = Object.entries(topicsByTitle);
  for (let i = 0; i < topicEntries.length; i++) {
    const [title, members] = topicEntries[i];
    const supervisor = isLecturers[i % isLecturers.length];

    const topic = await prisma.topic.create({
      data: {
        code: `IS-2023-HK2-${(i + 1).toString().padStart(3, '0')}`,
        title,
        normalized_title: title.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\w\s]/g, '').trim(),
        description: `Mô tả cho đề tài: ${title}`,
        objectives: "Mục tiêu nghiên cứu và hiện thực hệ thống.",
        requirements: "Có kiến thức về lập trình và chuyên ngành.",
        max_students: members.length > 1 ? 2 : 1,
        current_students: members.length,
        status: TopicStatus.REGISTERED,
        progress_stage: ProgressStage.WORKING,
        supervisor_id: supervisor.id,
        departmentId: deptMap['IS'].id,
        semester_id: semester.id,
        approved_at: new Date(),
        approved_by: isLecturers[2].id, // TS. Ngô Hữu Dũng as HOD
      }
    });

    // Create students and registrations
    for (const m of members) {
      const studentEmail = `${m.masv}@student.edu.vn`;
      const studentUser = await prisma.user.upsert({
        where: { email: studentEmail },
        update: {},
        create: {
          email: studentEmail, password_hash: commonPassword,
          full_name: `${m.hoDem} ${m.ten}`, role: UserRole.STUDENT,
          student_code: m.masv, departmentId: deptMap['IS'].id, active: true
        }
      });

      await prisma.topicRegistration.create({
        data: {
          student_id: studentUser.id,
          topic_id: topic.id,
          semester_id: semester.id,
          status: RegistrationStatus.CONFIRMED,
          student_progress_status: StudentProgressStatus.HAS_TOPIC,
          confirmed_at: new Date(),
        }
      });
    }
  }

  // 5. CROSS-DEPT SAMPLE DATA
  console.log('📑 Tạo đề tài mẫu cho các bộ môn khác...');
  const deptCodes = ['SE', 'CS', 'IT', 'DA'];
  for (const code of deptCodes) {
    const deptsLecturers = otherLecturers[code];
    for (let j = 1; j <= 3; j++) {
      const supervisor = deptsLecturers[j % deptsLecturers.length];
      const title = `Đề tài mẫu ${code} số ${j}`;
      await prisma.topic.create({
        data: {
          code: `${code}-2023-HK2-${j.toString().padStart(3, '0')}`,
          title,
          normalized_title: title.toLowerCase(),
          description: `Mô tả mẫu cho ${code}`,
          objectives: `Mục tiêu mẫu cho bộ môn ${code}`,
          requirements: `Yêu cầu mẫu cho bộ môn ${code}`,
          max_students: 2,
          status: TopicStatus.APPROVED,
          supervisor_id: supervisor.id,
          departmentId: deptMap[code].id,
          semester_id: semester.id,
        }
      });
    }
  }

  // 6. GRADING CRITERIA (LO1-LO10)
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
    await prisma.gradingCriterion.create({
      data: {
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
