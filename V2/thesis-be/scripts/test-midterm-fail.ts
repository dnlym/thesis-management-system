import { PrismaClient } from '@prisma/client';
import { GradingService } from '../src/services/grading.service';
import { TopicService } from '../src/services/topic.service';

const prisma = new PrismaClient();
const gradingService = new GradingService();
const topicService = new TopicService();

async function runTest() {
  console.log('=== KHỞI CHẠY THỬ NGHIỆM WORKFLOW SINH VIÊN RỚT GIỮA KỲ ===');

  // Find the active semester
  const activeSemester = await prisma.semester.findFirst({
    where: { status: 'ACTIVE' }
  });

  if (!activeSemester) {
    console.log('Không tìm thấy học kỳ ACTIVE nào.');
    return;
  }

  // Find a student and their registration in the active semester to test with
  const reg = await prisma.topicRegistration.findFirst({
    where: {
      status: 'CONFIRMED',
      semester_id: activeSemester.id
    },
    include: {
      topic: true,
      student: true
    }
  });

  if (!reg) {
    console.log('Không tìm thấy đăng ký nào có trạng thái CONFIRMED trong học kỳ ACTIVE để test.');
    return;
  }

  // Backup active semester timelines
  const originalMidtermStart = activeSemester.midterm_start;
  const originalMidtermEnd = activeSemester.midterm_end;
  const originalDefenseStart = activeSemester.defense_start;
  const originalDefenseEnd = activeSemester.defense_end;
  const originalProposalDeadline = activeSemester.proposal_deadline;
  const originalRegEnd = activeSemester.topic_registration_end;

  const now = new Date();
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  const studentId = reg.student_id;
  const topicId = reg.topic_id;
  const supervisorId = reg.topic.supervisor_id;

  console.log(`Đang chạy thử nghiệm với Sinh viên: ${reg.student.full_name} (${reg.student.student_code})`);
  console.log(`Đề tài: ${reg.topic.title}`);
  console.log(`Giảng viên hướng dẫn ID: ${supervisorId}`);

  // Backup current state to restore later
  const originalMidtermStatus = reg.midterm_status;
  const originalMidtermFeedback = reg.midterm_feedback;
  const originalStatus = reg.status;

  try {
    // 1. Evaluate as FAIL in WORK phase
    console.log('\nThiết lập Học kỳ sang giai đoạn WORK với Đánh giá giữa kỳ đang mở...');
    await prisma.semester.update({
      where: { id: activeSemester.id },
      data: {
        midterm_start: yesterday,
        midterm_end: tomorrow,
        proposal_deadline: tomorrow,
        topic_registration_end: yesterday
      }
    });

    console.log('\nStep 1: Đánh giá GIỮA KỲ là FAIL...');
    await gradingService.updateMidtermStatus(supervisorId, reg.id, 'FAIL', 'Kiểm tra tiến độ không đạt yêu cầu đề ra.');

    // Verify database registration updated status
    const updatedReg = await prisma.topicRegistration.findUnique({
      where: { id: reg.id }
    });

    console.log('-> Trạng thái midterm_status sau cập nhật:', updatedReg?.midterm_status);
    console.log('-> Trạng thái đăng ký (registration status) sau cập nhật:', updatedReg?.status);
    console.log('-> Ý kiến phản hồi:', updatedReg?.midterm_feedback);

    if (updatedReg?.midterm_status !== 'FAIL') {
      throw new Error('FAIL: midterm_status không phải là FAIL');
    }
    if (updatedReg?.status !== 'FAILED') {
      throw new Error('FAIL: Trạng thái đăng ký không tự động đổi sang FAILED');
    }
    console.log('=> Step 1 thành công: Trạng thái đăng ký chuyển sang FAILED và khóa học thuật.');

    // 2. Attempt final grading - must throw error in DEFENSE phase
    console.log('\nThiết lập Học kỳ sang giai đoạn DEFENSE để mở cổng nhập điểm cuối kỳ...');
    await prisma.semester.update({
      where: { id: activeSemester.id },
      data: {
        midterm_start: yesterday,
        midterm_end: tomorrow,
        defense_start: yesterday,
        defense_end: tomorrow,
        proposal_deadline: yesterday,
        topic_registration_end: yesterday
      }
    });

    console.log('\nStep 2: Thử nhập điểm cuối kỳ cho sinh viên đã rớt giữa kỳ...');
    try {
      await gradingService.submitGrade(supervisorId, {
        topicId,
        studentId,
        grades: [
          { criterionId: 'some-criterion-id', score: 8.5 }
        ]
      }, 'SUPERVISOR');
      
      throw new Error('FAIL: Hệ thống vẫn cho phép nhập điểm cuối kỳ cho sinh viên rớt giữa kỳ!');
    } catch (error: any) {
      console.log('-> Nhận được lỗi mong đợi:', error.message);
      if (error.message.includes('rớt đánh giá giữa kỳ') || error.message.includes('khóa toàn bộ quyền thao tác học thuật')) {
        console.log('=> Step 2 thành công: Quyền nhập điểm cuối kỳ đã bị khóa hoàn toàn.');
      } else {
        throw error;
      }
    }

    // 3. Check topic lists - topic should still be returned but status maps correctly
    console.log('\nStep 3: Kiểm tra hiển thị đề tài và sinh viên ở danh sách kết quả...');
    const result = await topicService.getTopics(supervisorId, { status: 'FINALIZED', semesterId: reg.semester_id });
    const finalizedTopics = result.topics;
    const matchedTopic = finalizedTopics.find(t => t.id === topicId);
    
    if (!matchedTopic) {
      console.log('-> Cảnh báo: Đề tài chưa ở trạng thái FINALIZED nên chưa hiển thị trong getTopics({status: "FINALIZED"}).');
    } else {
      const matchedStudent = matchedTopic.students.find((s: any) => s.id === studentId);
      console.log('-> Tìm thấy sinh viên trong danh sách kết quả:', matchedStudent?.full_name);
      console.log('-> Trạng thái trong kết quả:', matchedStudent?.midtermStatus);
      if (matchedStudent?.midtermStatus !== 'FAIL') {
        throw new Error('FAIL: midtermStatus của sinh viên không map đúng trong danh sách kết quả.');
      }
      console.log('=> Step 3 thành công: Sinh viên vẫn hiển thị đầy đủ thông tin rớt.');
    }

    // 4. Verify that failed registration is returned in getRegistrationsForMidtermGrading
    console.log('\nStep 4: Kiểm tra danh sách đánh giá giữa kỳ của giảng viên...');
    const midtermRegs = await gradingService.getRegistrationsForMidtermGrading(supervisorId);
    const foundReg = midtermRegs.find(r => r.id === reg.id);
    if (!foundReg) {
      throw new Error('FAIL: Không tìm thấy sinh viên đã rớt giữa kỳ trong danh sách getRegistrationsForMidtermGrading!');
    }
    console.log('-> Trạng thái sinh viên tìm thấy trong danh sách giữa kỳ:', foundReg.status);
    console.log('=> Step 4 thành công: Sinh viên rớt giữa kỳ vẫn hiển thị đầy đủ trong danh sách đánh giá giữa kỳ.');

    console.log('\n=== TẤT CẢ CÁC BƯỚC THỬ NGHIỆM ĐỀU THÀNH CÔNG ===');

  } finally {
    // Restore original database state
    console.log('\nĐang khôi phục lại trạng thái ban đầu của CSDL...');
    await prisma.topicRegistration.update({
      where: { id: reg.id },
      data: {
        midterm_status: originalMidtermStatus,
        midterm_feedback: originalMidtermFeedback,
        status: originalStatus
      }
    });

    // Restore original semester state
    await prisma.semester.update({
      where: { id: activeSemester.id },
      data: {
        midterm_start: originalMidtermStart,
        midterm_end: originalMidtermEnd,
        defense_start: originalDefenseStart,
        defense_end: originalDefenseEnd,
        proposal_deadline: originalProposalDeadline,
        topic_registration_end: originalRegEnd
      }
    });
    console.log('Đã khôi phục dữ liệu và thông tin học kỳ xong.');
  }
}

runTest().catch(console.error).finally(() => prisma.$disconnect());
