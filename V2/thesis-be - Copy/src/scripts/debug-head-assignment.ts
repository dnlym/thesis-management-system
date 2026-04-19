import { PrismaClient, AssignmentType, AssignmentStatus, RaterRole } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // 1. Get the Head of Department user
  const heads = await prisma.user.findMany({
    where: { role: 'HEAD' }
  });

  console.log('--- Head Users ---');
  heads.forEach(h => console.log(`ID: ${h.id}, Name: ${h.full_name}, Dept: ${h.departmentId}`));

  // 2. Check all topics and their eligibility for committee assignment
  const topics = await prisma.topic.findMany({
    include: {
      assignments: true,
      grades: true,
      semester: true
    }
  });

  console.log('\n--- Production-Grade Eligibility Audit ---');
  topics.forEach(t => {
    // 1. Filter only accepted reviewer assignments
    const reviewers = t.assignments.filter((a: any) => 
      a.assignment_type === AssignmentType.REVIEWER && 
      [AssignmentStatus.ACCEPTED, AssignmentStatus.AUTO_ACCEPTED].includes(a.status)
    );

    // 2. Consistency Guard: Ensure at least 2 unique reviewers
    const uniqueReviewerIds = new Set(reviewers.map((r: any) => r.reviewer_id));
    
    // 3. Completion Guard: Check if everyone has submitted grades
    const reviewersWhoGraded = new Set(
      t.grades
        .filter((g: any) =>
          ([RaterRole.REVIEWER_1, RaterRole.REVIEWER_2, RaterRole.REVIEWER_3] as RaterRole[]).includes(g.rater_role)
        )
        .map((g: any) => g.grader_id)
    );

    const allGraded = reviewers.length > 0 && reviewers.every((r: any) => reviewersWhoGraded.has(r.reviewer_id));
    
    let eligible = uniqueReviewerIds.size >= 2 && allGraded;
    let reason = 'OK';
    if (uniqueReviewerIds.size < 2) reason = 'NOT_ENOUGH_UNIQUE_REVIEWERS';
    else if (!allGraded) reason = 'GRADES_INCOMPLETE';

    // Phase Check
    const activeSemester = t.semester;
    // Simple mock logic for phase based on script
    const now = new Date();
    let phase = 'UNKNOWN';
    if (activeSemester) {
      if (now < new Date(activeSemester.topic_registration_start!)) phase = 'PREVIEW';
      else if (now < new Date(activeSemester.topic_registration_end!)) phase = 'REGISTRATION';
      else if (now < new Date(activeSemester.proposal_deadline!)) phase = 'WORK';
      else if (now < new Date(activeSemester.defense_start!)) phase = 'REVIEWING';
      else if (now < new Date(activeSemester.defense_end!)) phase = 'DEFENSE';
      else phase = 'FINAL';
    }

    console.log({
      tag: 'COMMITTEE_ELIGIBILITY_AUDIT',
      topic: t.title,
      code: t.code,
      reviewers: reviewers.length,
      graded: reviewers.map(r => reviewersWhoGraded.has(r.reviewer_id)),
      uniqueReviewers: uniqueReviewerIds.size,
      eligible: eligible,
      reason: reason,
      phase: phase,
      status: t.status
    });
    console.log('-------------------------');
  });

  const activeSemester = await prisma.semester.findFirst({ where: { status: 'ACTIVE' } });
  console.log(`\nActive Semester: ${activeSemester?.name} (ID: ${activeSemester?.id})`);
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect());
