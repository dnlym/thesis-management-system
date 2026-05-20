/**
 * fix-stale-scores.ts
 * One-time migration script: recompute all FinalScore records.
 * Replaces stale `0.0` values (stored when no grade existed in old code)
 * with proper `null` values so the UI shows "—" instead of "0.0".
 *
 * Run: npx ts-node --transpile-only scripts/fix-stale-scores.ts
 */
import prisma from '../src/config/database';
import { RaterRole } from '@prisma/client';
import { calculateWeightedScore, calculateFinalScore, roundScore, validateScores } from '../src/utils/grading.utils';
import { isReviewer, isCommittee } from '../src/utils/grading.utils';
import { GRADING } from '../src/constants';

function getGradeClassification(score: number): string {
  if (score >= GRADING.CLASSIFICATION.EXCELLENT.min) return GRADING.CLASSIFICATION.EXCELLENT.label;
  if (score >= GRADING.CLASSIFICATION.GOOD.min) return GRADING.CLASSIFICATION.GOOD.label;
  if (score >= GRADING.CLASSIFICATION.FAIR.min) return GRADING.CLASSIFICATION.FAIR.label;
  if (score >= GRADING.CLASSIFICATION.AVERAGE.min) return GRADING.CLASSIFICATION.AVERAGE.label;
  return GRADING.CLASSIFICATION.FAIL.label;
}

async function main() {
  console.log('🔧 Starting stale FinalScore fix...\n');

  // Get all distinct topic IDs that have FinalScore records
  const distinctTopics = await prisma.finalScore.findMany({
    distinct: ['topic_id'],
    select: { topic_id: true },
  });

  console.log(`Found ${distinctTopics.length} topics with FinalScore records.\n`);

  let fixed = 0;
  let skipped = 0;
  let errors = 0;

  for (const { topic_id } of distinctTopics) {
    try {
      // Get topic info
      const topic = await prisma.topic.findUnique({
        where: { id: topic_id },
        select: { id: true, defense_type: true },
      });

      // Get all FinalScore records for this topic
      const finalScores = await prisma.finalScore.findMany({
        where: { topic_id },
      });

      for (const fs of finalScores) {
        const studentId = fs.student_id;
        const groupId = fs.group_id;
        const defenseType = topic?.defense_type;

        // Get actual grades for this student/topic
        const studentGrades = await prisma.grade.findMany({
          where: { topic_id, student_id: studentId },
          include: { criterion: true },
        });

        // Supervisor score
        const sGrades = studentGrades.filter(g => g.rater_role === RaterRole.SUPERVISOR);
        const supervisorScore = sGrades.length > 0 ? calculateWeightedScore(sGrades as any) : null;

        // Reviewer avg score
        const rGrades = studentGrades.filter(g => isReviewer(g.rater_role));
        const rGraderIds = [...new Set(rGrades.map(g => g.grader_id))];
        const rScores = rGraderIds.map(gid =>
          calculateWeightedScore(rGrades.filter(g => g.grader_id === gid) as any)
        );
        const reviewerAvgScore = rScores.length > 0
          ? rScores.reduce((a, b) => a + b, 0) / rScores.length
          : null;

        // Committee avg score
        const cGrades = studentGrades.filter(g => {
          if (!isCommittee(g.rater_role)) return false;
          if (defenseType === 'ORAL' && g.rater_role === RaterRole.POSTER_COMMITTEE) return false;
          if (defenseType === 'POSTER' && g.rater_role !== RaterRole.POSTER_COMMITTEE) return false;
          return true;
        });
        const cGraderIds = [...new Set(cGrades.map(g => g.grader_id))];
        const cScores = cGraderIds.map(gid =>
          calculateWeightedScore(cGrades.filter(g => g.grader_id === gid) as any)
        );
        const committeeAvgScore = cScores.length > 0
          ? cScores.reduce((a, b) => a + b, 0) / cScores.length
          : null;

        // Compute final if all present
        const isComplete = supervisorScore !== null && reviewerAvgScore !== null && committeeAvgScore !== null;
        let finalScoreValue: number | null = null;
        let computedScore: number | null = null;
        let gradeClassification: string | null = null;

        if (isComplete) {
          finalScoreValue = calculateFinalScore({
            supervisor: supervisorScore!,
            reviewerAvg: reviewerAvgScore!,
            committeeAvg: committeeAvgScore!,
            bonus: fs.extra_points,
          });
          computedScore = roundScore(Math.max(finalScoreValue - fs.extra_points, 0));
          gradeClassification = getGradeClassification(finalScoreValue);
        }

        // Update the record
        await prisma.finalScore.update({
          where: { id: fs.id },
          data: {
            supervisor_score: supervisorScore as any,
            reviewer_avg_score: reviewerAvgScore as any,
            committee_score: committeeAvgScore as any,
            computed_score: computedScore as any,
            final_score: finalScoreValue as any,
            grade_classification: gradeClassification,
            finalized: isComplete,
          } as any,
        });

        const label = `[topic=${topic_id.slice(-6)} student=${studentId.slice(-6)}]`;
        console.log(
          `  ✅ ${label}  HD=${supervisorScore?.toFixed(1) ?? '—'}` +
          `  PB=${reviewerAvgScore?.toFixed(1) ?? '—'}` +
          `  HĐ=${committeeAvgScore?.toFixed(1) ?? '—'}` +
          `  → ${finalScoreValue?.toFixed(1) ?? '—'}`
        );
        fixed++;
      }
    } catch (err: any) {
      console.error(`  ❌ Error for topic ${topic_id}: ${err.message}`);
      errors++;
    }
  }

  console.log(`\n✅ Done. Fixed: ${fixed} | Errors: ${errors}`);
  await prisma.$disconnect();
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
