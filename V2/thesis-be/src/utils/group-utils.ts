import { PrismaClient } from '@prisma/client';

/**
 * Generates a group name in the format [DeptCode][SequenceNumber]
 * Example: IS01, IS02, SE01
 */
export async function generateGroupName(prisma: any, departmentId: string, semesterId: string): Promise<string> {
  const dept = await prisma.department.findUnique({
    where: { id: departmentId },
    select: { code: true }
  });

  if (!dept) {
    throw new Error('Department not found');
  }

  // Count existing groups in this department and semester
  const groupCount = await prisma.group.count({
    where: {
      semester_id: semesterId,
      OR: [
        {
          topic: {
            departmentId: departmentId
          }
        },
        {
          topic_id: null,
          leader: {
            departmentId: departmentId
          }
        }
      ]
    }
  });

  const sequence = groupCount + 1;
  return `${dept.code}${sequence.toString().padStart(2, '0')}`;
}
