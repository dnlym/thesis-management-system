import api from './client';

export type RaterRole = 'SUPERVISOR' | 'REVIEWER_1' | 'REVIEWER_2' | 'REVIEWER_3' | 'COMMITTEE_CHAIR' | 'COMMITTEE_SECRETARY' | 'COMMITTEE_MEMBER' | 'COMMITTEE_MEMBER_1' | 'COMMITTEE_MEMBER_2' | 'ORAL_COMMITTEE' | 'POSTER_COMMITTEE' | 'ADVISOR' | 'REVIEWER' | 'COUNCIL_MEMBER';

export interface GradeScore {
    criterion_id: string;
    score: number;
    comment?: string;
}

export interface GradeSubmission {
    topic_id: string;
    student_id: string;
    rater_role: RaterRole;
    scores: GradeScore[];
}

export const GradingApi = {
    /**
     * Submit grades for a student in a topic
     */
    async submitGrade(data: GradeSubmission) {
        const payload = {
            topicId: data.topic_id,
            studentId: data.student_id,
            raterRole: data.rater_role,
            grades: data.scores.map(s => ({
                criterionId: s.criterion_id,
                score: s.score,
                comments: s.comment,
            })),
        };
        const res = await api.post('/grading/submit', payload);
        return res.data;
    },

    /**
     * Get current user's grades for a topic (for reading/confirmed state)
     */
    async getMyGrades(topicId: string, raterRole?: RaterRole) {
        const res = await api.get(`/grading/${topicId}/my-grades`, {
            params: { raterRole }
        });
        return res.data.data;
    },

    /**
     * Get grading criteria with filters
     */
    async getCriteria(filters?: { criteriaType?: string; topicId?: string; departmentId?: string }) {
        const res = await api.get('/grading/criteria', { params: filters });
        return res.data.data;
    },

    /**
     * Get registrations for midterm grading (if needed, though user said mostly final)
     */
    async getMidtermRegistrations() {
        const res = await api.get('/grading/midterm');
        return res.data.data;
    }
};
