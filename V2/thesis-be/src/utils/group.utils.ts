import prisma from '../config/database';

/**
 * Utility class for Group management logic
 * Adheres to Engineering Standards: No Type Casting, Scalability, Data Integrity
 */
export class GroupUtils {
  static async generateGroupCode(topicId: string, topicCode?: string): Promise<string> {
    // 1. Fetch topic with department and semester
    const topic = await prisma.topic.findUnique({
      where: { id: topicId },
      include: {
        department: true,
        semester: true,
      }
    });

    if (!topic) {
      throw new Error('Topic not found');
    }

    const deptCode = topic.department?.code || 'XX';
    const semCode = topic.semester?.code || '';

    // 2. Parse Year and Semester number from semester code (e.g., HK2_2025_2026)
    let semNumber = '1';
    let yearShort = String(new Date().getFullYear()).slice(-2); // Fallback

    const semMatch = semCode.match(/HK(\d+)/i);
    if (semMatch) {
      semNumber = semMatch[1];
    }

    const yearMatch = semCode.match(/_(\d{4})_/);
    if (yearMatch) {
      yearShort = yearMatch[1].slice(-2);
    } else {
      const anyYearMatch = semCode.match(/\d{4}/);
      if (anyYearMatch) {
        yearShort = anyYearMatch[0].slice(-2);
      }
    }

    // 3. Count existing groups in this department and semester
    const groupCount = await prisma.group.count({
      where: {
        semester_id: topic.semester_id,
        topic: {
          departmentId: topic.departmentId,
        }
      }
    });

    const nextIndex = groupCount + 1;
    return `${deptCode}.${yearShort}${semNumber}.${nextIndex}`;
  }

  /**
   * Get standardized group name for a topic
   * If multiple groups exist, returns them separated by comma
   */
  static formatGroupDisplay(groups: any[], topicCode: string): string {
    if (!groups || groups.length === 0) return topicCode;
    return groups.map(g => g.name).join(', ');
  }

  /**
   * Validates group members count
   * @param memberCount Current members count
   * @returns boolean
   */
  static isValidGroupSize(memberCount: number): boolean {
    return memberCount >= 1 && memberCount <= 2;
  }
}
