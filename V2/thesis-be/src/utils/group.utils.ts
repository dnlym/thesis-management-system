import prisma from '../config/database';

/**
 * Utility class for Group management logic
 * Adheres to Engineering Standards: No Type Casting, Scalability, Data Integrity
 */
export class GroupUtils {
  /**
   * Generates a group code in the format: G[STT]-[Mã Đề Tài]
   * Example: G1-IS14, G2-IS14
   * 
   * @param topicId The ID of the topic
   * @param topicCode The human-readable code of the topic (e.g., IS14)
   * @returns A Promise that resolves to the generated group code string
   */
  static async generateGroupCode(topicId: string, topicCode: string): Promise<string> {
    // Count existing groups for this topic to determine STT
    const groupCount = await prisma.group.count({
      where: { topic_id: topicId }
    });

    const stt = groupCount + 1;
    return `G${stt}-${topicCode}`;
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
