import { PrismaClient, UserRole, AssignmentType, CommitteeRole, ScheduleStatus, AssignmentStatus } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const semester = await prisma.semester.findFirst({
    where: { status: 'ACTIVE' }
  });
  if (!semester) {
    console.error('No active semester found');
    return;
  }
  
  const assigner = await prisma.user.findFirst({
    where: { email: 'nguyenhuuquang@iuh.edu.vn' }
  });
  if (!assigner) {
    console.error('Assigner nguyenhuuquang@iuh.edu.vn not found');
    return;
  }

  const dept = await prisma.department.findUnique({
    where: { code: 'IS' }
  });
  if (!dept) {
    console.error('Department IS not found');
    return;
  }

  const lecturers = await prisma.user.findMany({
    where: {
      departmentId: dept.id,
      role: { in: [UserRole.LECTURER, UserRole.HEAD, UserRole.COORDINATOR] }
    }
  });
  console.log(`Found ${lecturers.length} lecturers in IS department.`);
  if (lecturers.length < 3) {
    console.error('Not enough lecturers to form a committee');
    return;
  }

  const committeeName = 'Hội đồng Hệ thống thông tin 01';
  await prisma.committee.deleteMany({
    where: { semester_id: semester.id, departmentId: dept.id }
  });

  const committee = await prisma.committee.create({
    data: {
      name: committeeName,
      semester_id: semester.id,
      departmentId: dept.id,
      room_preference: 'Phòng H5.01'
    }
  });
  console.log(`Created committee: ${committee.name}`);

  const memberRoles = [
    { lecturer: lecturers[0], role: CommitteeRole.CHAIR },
    { lecturer: lecturers[1], role: CommitteeRole.SECRETARY },
    { lecturer: lecturers[2], role: CommitteeRole.MEMBER }
  ];

  for (const m of memberRoles) {
    await prisma.committeeMember.create({
      data: {
        committee_id: committee.id,
        lecturer_id: m.lecturer.id,
        semester_id: semester.id,
        role: m.role
      }
    });
    console.log(`Added ${m.lecturer.full_name} as ${m.role} to committee.`);
  }

  const groups = await prisma.group.findMany({
    where: { semester_id: semester.id },
    include: { topic: true }
  });
  console.log(`Found ${groups.length} groups in active semester.`);

  const defenseDate = new Date();
  defenseDate.setDate(defenseDate.getDate() + 7);

  for (let i = 0; i < groups.length; i++) {
    const group = groups[i];
    if (!group.topic_id || !group.topic) continue;

    await prisma.defenseSchedule.create({
      data: {
        topic_id: group.topic_id,
        committee_id: committee.id,
        semester_id: semester.id,
        defense_date: defenseDate,
        defense_time: '13:30',
        room: 'Phòng H5.01',
        group_id: group.id,
        status: ScheduleStatus.PENDING
      }
    });

    for (const m of memberRoles) {
      await prisma.assignment.create({
        data: {
          topic_id: group.topic_id,
          reviewer_id: m.lecturer.id,
          assignment_type: AssignmentType.COMMITTEE,
          committee_role: m.role,
          status: AssignmentStatus.ACCEPTED,
          assigned_by: assigner.id,
          deadline_at: defenseDate,
          group_id: group.id
        }
      });
    }

    const possibleReviewers = lecturers.filter(l => l.id !== group.topic?.supervisor_id);
    if (possibleReviewers.length >= 2) {
      const reviewer1 = possibleReviewers[0];
      const reviewer2 = possibleReviewers[1];
      const reviewers = [reviewer1, reviewer2];
      for (let rIdx = 0; rIdx < reviewers.length; rIdx++) {
        const rev = reviewers[rIdx];
        await prisma.assignment.create({
          data: {
            topic_id: group.topic_id,
            reviewer_id: rev.id,
            assignment_type: AssignmentType.REVIEWER,
            reviewer_order: rIdx + 1,
            status: AssignmentStatus.ACCEPTED,
            assigned_by: assigner.id,
            deadline_at: defenseDate,
            group_id: group.id
          }
        });
      }
    }
    console.log(`Assigned committee and reviewers for topic: ${group.topic.title}`);
  }

  console.log('🎉 Auto assignment completed successfully!');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
