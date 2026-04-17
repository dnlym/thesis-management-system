import { PrismaClient, UserRole, TopicStatus, RegistrationStatus, AssignmentStatus, AssignmentType, SubmissionType, SubmissionStatus, GroupMemberStatus, SemesterPhase, StudentProgressStatus, SemesterStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Bắt đầu seed dữ liệu...');

  // 0. Database is cleared by prisma migrate reset

  // ============================================
  // 1️⃣ DEPARTMENTS
  // ============================================
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

  // ============================================
  // 2️⃣ SEMESTERS
  // ============================================
  console.log('📅 Tạo học kỳ...');
  const currentSemester = await prisma.semester.upsert({
    where: { code: 'HK1_2024' },
    update: {},
    create: {
      code: 'HK1_2024',
      name: 'Học kỳ 1 năm 2024-2025',
      status: SemesterStatus.ACTIVE,
      start_date: new Date('2026-01-01'),
      end_date: new Date('2026-07-15'),
      topic_viewing_start: new Date('2026-01-01'),
      topic_viewing_end: new Date('2026-01-07'),
      topic_registration_start: new Date('2026-01-08'),
      topic_registration_end: new Date('2026-01-20'),
      proposal_deadline: new Date('2026-03-31'),
      thesis_deadline: new Date('2026-06-30'),
      defense_start: new Date('2026-07-05'),
      defense_end: new Date('2026-07-15'),
    },
  });

  // Create 2 more semesters (past and future)
  const extraSemesters = [];
  for (let i = 1; i <= 2; i++) {
    const year = 2020 + Math.floor(i / 2);
    const term = i % 2 === 0 ? 2 : 1;
    const code = `HK${term}_${year}_${i}`; // Unique code
    const status: SemesterStatus = i < 8 ? SemesterStatus.COMPLETED : SemesterStatus.PLANNING;

    const sem = await prisma.semester.upsert({
      where: { code: code },
      update: {},
      create: {
        code: code,
        name: `Học kỳ ${term} năm ${year}-${year + 1}`,
        status: status,
        start_date: new Date(`${year}-09-01`),
        end_date: new Date(`${year + 1}-01-15`),
        topic_viewing_start: new Date(`${year}-09-01`),
        topic_viewing_end: new Date(`${year}-09-10`),
        topic_registration_start: new Date(`${year}-09-11`),
        topic_registration_end: new Date(`${year}-09-30`),
        proposal_deadline: new Date(`${year}-10-31`),
        thesis_deadline: new Date(`${year}-12-31`),
        defense_start: new Date(`${year + 1}-01-05`),
        defense_end: new Date(`${year + 1}-01-15`),
      },
    });
    extraSemesters.push(sem);
  }

  // ============================================
  // 3️⃣ USERS
  // ============================================
  console.log('👥 Tạo người dùng...');
  const commonPassword = await bcrypt.hash('Password@123', 10); 

  // Admin & Head (Real faculty as Head)
  const admin = await prisma.user.upsert({
    where: { email: 'admin@university.edu.vn' },
    update: {},
    create: {
      email: 'admin@university.edu.vn',
      password_hash: commonPassword,
      full_name: 'Quản trị viên hệ thống',
      role: 'ADMIN',
      departmentId: deptMap['IT'].id,
    },
  });

  const head = await prisma.user.upsert({
    where: { email: 'ts.ngo.huu.dung@university.edu.vn' },
    update: {},
    create: {
      email: 'ts.ngo.huu.dung@university.edu.vn',
      password_hash: commonPassword,
      full_name: 'TS. Ngô Hữu Dũng (Trưởng bộ môn)',
      role: 'HEAD',
      departmentId: deptMap['IS'].id,
    },
  });

  // Real Lecturer Names
  const facultyData = [
    {
      deptCode: 'SE',
      names: [
        "ThS. Phạm Quảng Tri", "TS. Tôn Long Phước", "TS. Nguyễn Thị Hạnh",
        "ThS. Bùi Đình Tiền", "ThS. Châu Thị Bảo Hà", "TS. Nguyễn Minh Hải",
        "ThS. Nguyễn Thị Hoàng Khánh", "ThS. Nguyễn Thị Hồng Lương", "TS. Nguyễn Trọng Tiến",
        "ThS. Nguyễn Văn Thắng", "TS. Nguyễn Vũ Lâm", "TS. Nguyễn Đình Quyền",
        "ThS. Phạm Thanh Hùng", "ThS. Trần Thế Trung", "ThS. Trần Thị Anh Thi",
        "ThS. Đặng Thị Thu Hà", "ThS. Đặng Văn Thuận"
      ]
    },
    {
      deptCode: 'CS',
      names: [
        "TS. Lê Nhật Duy", "TS. Hồ Đắc Quán", "TS. Phạm Thị Thiết",
        "TS. Phạm Văn Chung", "PGS.TS Huỳnh Tường Nguyên", "TS. Đặng Thị Phúc",
        "ThS. Bùi Công Danh", "ThS. Giảng Thanh Trọn", "TS. Lê Thị Vĩnh Thanh",
        "ThS. Lê Vũ Hạo", "TS. Lê Đình Long", "ThS. Nguyễn Ngọc Lễ",
        "TS. Nguyễn Thanh Chuyên", "TS. Nguyễn Tiến Thịnh", "ThS. Võ Quang Hoàng Khang",
        "TS. Võ Đăng Khoa", "TS. Đoàn Văn Thắng"
      ]
    },
    {
      deptCode: 'IT',
      names: [
        "TS. Tạ Duy Công Chiến", "TS. Trần Thị Minh Khoa", "ThS. Hoàng Đình Hạnh",
        "TS. Lê Thị Thủy", "ThS. Võ Công Minh", "ThS. Nguyễn Thành Thái",
        "ThS. Nguyễn Văn Quang", "ThS. Nguyễn Xuân Lô", "ThS. Phạm Thái Khanh",
        "ThS. Trương Bá Phúc", "TS. Đặng Thanh Bình", "ThS. Đỗ Hà Phương"
      ]
    },
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
    {
      deptCode: 'DA',
      names: [
        "GS.TS. Huỳnh Trung Hiếu", "TS. Lê Trọng Ngọc", "TS. Bùi Thanh Hùng",
        "ThS. Nguyễn Hữu Tình", "TS. Huỳnh Công Bằng", "PGS.TS Nguyễn Hòa",
        "TS. Nguyễn Hữu Vũ", "TS. Nguyễn Lê Linh", "TS. Nguyễn Minh Hạnh",
        "TS. Phan Hồng Tín", "ThS. Trần Nhật Hoàng Anh", "KS. Trần Tấn Thành",
        "TS. Trịnh Thanh Sơn", "ThS. Trương Vĩnh Linh", "TS. Vũ Đức Thịnh"
      ]
    }
  ];

  const lecturers = [];
  for (const dept of facultyData) {
    for (const name of dept.names) {
      // Fix: First remove trailing dots from prefixes (ThS. -> ThS, TS. -> TS) 
      // Then replace space with dot.
      const emailName = name
        .replace(/\./g, '') // Remove all existing dots first
        .toLowerCase()
        .replace(/\s+/g, '.')
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .replace(/[đĐ]/g, 'd');

      const email = `${emailName}@university.edu.vn`;

      // Skip if it's the head (already created)
      if (email === head.email) {
        lecturers.push(head);
        continue;
      }

      const user = await prisma.user.upsert({
        where: { email: email },
        update: { full_name: name, departmentId: deptMap[dept.deptCode].id },
        create: {
          email: email,
          password_hash: commonPassword,
          full_name: name,
          role: 'LECTURER',
          departmentId: deptMap[dept.deptCode].id,
          active: true,
        },
      });
      lecturers.push(user);
    }
  }

  // Generate 50 Students (grouped by dept to facilitate clean grouping)
  const students = [];
  const deptList = Object.values(deptMap);
  const studentsByDept: Record<string, any[]> = {};
  
  for (let i = 1; i <= 50; i++) {
    const dept = deptList[i % deptList.length];
    if (!studentsByDept[dept.id]) studentsByDept[dept.id] = [];
    
    const email = `student${i}.${dept.code}@student.edu.vn`;
    const user = await prisma.user.upsert({
      where: { email: email },
      update: {},
      create: {
        email: email,
        password_hash: commonPassword,
        full_name: `Sinh viên ${i}`,
        role: 'STUDENT',
        student_code: `SV2024${dept.code}${i.toString().padStart(3, '0')}`,
        departmentId: dept.id,
        active: true,
      },
    });
    students.push(user);
    studentsByDept[dept.id].push(user);
  }

  // ============================================
  // 4️⃣ TOPICS
  // ============================================
  console.log('📖 Tạo đề tài...');
  const topics = [];

  // Helper for title normalization in seed
  const normalizeTitle = (title: string) => {
    return title
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^\w\s+#-]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  };

  // Create 20 topics
  for (let i = 1; i <= 20; i++) {
    const supervisor = lecturers[i % lecturers.length];
    const title = `Đề tài nghiên cứu số ${i}: Ứng dụng công nghệ mới`;
    const topic = await prisma.topic.create({
      data: { 
        code: `DT-${currentSemester.code}-${i.toString().padStart(3, '0')}`,
        title: title,
        normalized_title: normalizeTitle(title),
        description: `Mô tả chi tiết cho đề tài số ${i}. Nghiên cứu về các vấn đề cấp thiết hiện nay.`,
        objectives: `Mục tiêu của đề tài ${i} là giải quyết vấn đề X, Y, Z.`,
        requirements: `Sinh viên cần có kiến thức về lập trình, cơ sở dữ liệu và thuật toán.`,
        max_students: 2,
        current_students: 0, // Will update later
        status: i % 3 === 0 ? TopicStatus.REGISTERED : (i % 3 === 1 ? TopicStatus.APPROVED : TopicStatus.DRAFT),
        supervisor_id: supervisor.id,
        departmentId: supervisor.departmentId,
        semester_id: currentSemester.id,
        approved_at: new Date(),
        approved_by: head.id,
      },
    });
    topics.push(topic);
  }

  // ============================================
  // 5️⃣ REGISTRATIONS & GROUPS (Topic First Flow)
  // ============================================
  console.log('👨‍👩‍👦 Tạo đăng ký và lập nhóm...');

  const activeTopics = topics.filter(t => t.status === TopicStatus.APPROVED || t.status === TopicStatus.REGISTERED);
  let groupCount = 0;

  // For each department, register students into its topics
  const topicsWithSlots = activeTopics.map(t => ({ ...t, slots_left: t.max_students }));

  for (const deptId in studentsByDept) {
    const deptStudents = [...studentsByDept[deptId]];
    const deptTopics = topicsWithSlots.filter(t => t.departmentId === deptId);

    if (deptTopics.length === 0) continue;

    let studentIndex = 0;
    for (const topic of deptTopics) {
      // While this topic has slots AND we have students left in this dept
      while (topic.slots_left > 0 && studentIndex < deptStudents.length) {
        const student = deptStudents[studentIndex];
        
        await prisma.topicRegistration.create({
          data: {
            student_id: student.id,
            topic_id: topic.id,
            semester_id: currentSemester.id,
            status: RegistrationStatus.CONFIRMED,
            student_progress_status: StudentProgressStatus.HAS_TOPIC,
            confirmed_at: new Date(),
          },
        });

        // Update topic count and slots
        await prisma.topic.update({
          where: { id: topic.id },
          data: { current_students: { increment: 1 } }
        });

        topic.slots_left--;
        studentIndex++;
      }
    }
  }

  // ============================================
  // 6️⃣ ASSIGNMENTS
  // ============================================
  console.log('📋 Tạo phân công...');

  for (let i = 0; i < topics.length; i++) {
    const topic = topics[i];
    // Assign 2 reviewers for each topic from the lecturers array (offset to avoid supervisor being reviewer)
    const r1 = lecturers[(i + 5) % lecturers.length];
    const r2 = lecturers[(i + 6) % lecturers.length];

    await prisma.assignment.createMany({
      data: [
        {
          topic_id: topic.id,
          reviewer_id: r1.id,
          assignment_type: 'REVIEWER',
          reviewer_order: 1,
          status: 'ACCEPTED',
          assigned_by: head.id,
          deadline_at: new Date('2024-12-31'),
        },
        {
          topic_id: topic.id,
          reviewer_id: r2.id,
          assignment_type: 'REVIEWER',
          reviewer_order: 2,
          status: 'PENDING',
          assigned_by: head.id,
          deadline_at: new Date('2024-12-31'),
        }
      ],
      skipDuplicates: true
    });
  }

  // ============================================
  // 7️⃣ GRADING CRITERIA
  // ============================================
  console.log('📊 Tạo tiêu chí đánh giá...');

  // Descriptive LOs (LO1-LO10) for Final Grading
  const loCriteria = [
    { name: "Phân tích vấn đề và mô hình hóa được yêu cầu của đề tài.", weight: 0.1 },
    { name: "Áp dụng các nguyên tắc, phương pháp chuyên môn để xác định được giải pháp cho đề tài.", weight: 0.1 },
    { name: "Thiết kế được một hệ thống hoặc quy trình đáp ứng được yêu cầu của đề tài.", weight: 0.1 },
    { name: "Hiện thực được một hệ thống hoặc quy trình đáp ứng được yêu cầu của đề tài.", weight: 0.15 },
    { name: "Đánh giá được một hệ thống, quy trình đáp ứng yêu cầu của đề tài.", weight: 0.15 },
    { name: "Thuyết trình hiệu quả trong các lĩnh vực chuyên môn của đề tài.", weight: 0.1 },
    { name: "Phỏng vấn theo những lĩnh vực khác nhau để thu thập yêu cầu của khách hàng.", weight: 0.1 },
    { name: "Viết được báo cáo khóa luận tốt nghiệp", weight: 0.1 },
    { name: "Chứng tỏ được khả năng làm việc hiệu quả với các thành viên trong nhóm", weight: 0.05 },
    { name: "Khả năng hỗ trợ triển khai và vận hành hệ thống thông tin", weight: 0.05 },
  ];

  for (let i = 0; i < loCriteria.length; i++) {
    const lo = loCriteria[i];
    await prisma.gradingCriterion.create({
      data: {
        name: lo.name,
        description: `Đánh giá: ${lo.name}`,
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

  // ============================================
  // 8️⃣ SUBMISSIONS
  // ============================================
  console.log('📄 Tạo submissions...');

  const allActiveGroups = await prisma.group.findMany({
    where: { topic_id: { not: null } }
  });

  for (let i = 0; i < allActiveGroups.length; i++) {
    const group = allActiveGroups[i];

    const submission = await prisma.submission.create({
      data: {
        topic_id: group.topic_id!,
        group_id: group.id,
        type: 'PROPOSAL',
        status: 'SUBMITTED',
        current_version: 1,
      }
    });

    await prisma.submissionVersion.create({
      data: {
        submission_id: submission.id,
        version: 1,
        file_url: `/uploads/file_${i}.pdf`,
        file_name: `Báo cáo tiến độ - ${group.name}.pdf`,
        file_size: 1024 * 1024,
        mime_type: 'application/pdf',
        checksum: 'dummy_checksum',
        uploaded_by: group.leader_id,
      }
    });
  }

  // ============================================
  // 9️⃣ DEFENSE SCHEDULES
  // ============================================
  console.log('📅 Tạo lịch bảo vệ...');

  for (let i = 0; i < topics.length; i++) {
    // Only schedule for some topics
    if (i < 12) {
      await prisma.defenseSchedule.create({
        data: {
          topic_id: topics[i].id,
          semester_id: currentSemester.id,
          defense_date: new Date('2025-01-10'),
          defense_time: `${8 + (i % 8)}:00 - ${9 + (i % 8)}:00`,
          room: `Phòng ${100 + (i % 5)}`,
          committee_chair: lecturers[10]?.id,
          committee_secretary: lecturers[11]?.id,
          notes: 'Chuẩn bị máy chiếu',
        }
      });
    }
  }

  console.log('✅ Seed dữ liệu hoàn tất!');
}

main()
  .catch((err) => {
    console.error('❌ Lỗi khi seed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
