import prisma from '../config/database';
import { SemesterPhase } from '@prisma/client';
import semesterService from './semester.service';

export class DefenseService {
    async getSchedules(semesterId?: string) {
        let targetSemesterId = semesterId;

        if (!targetSemesterId) {
            const activeSemester = await semesterService.getActiveSemester();
            targetSemesterId = activeSemester?.id;
        }

        if (!targetSemesterId) {
            return [];
        }

        const schedules = await prisma.defenseSchedule.findMany({
            where: {
                topic: {
                    semester_id: targetSemesterId
                }
            },
            include: {
                topic: {
                    select: {
                        id: true,
                        title: true,
                        status: true,
                        defense_type: true,
                        supervisor: {
                            select: {
                                full_name: true
                            }
                        }
                    }
                }
            },
            orderBy: {
                defense_date: 'asc'
            }
        });

        return schedules.map(s => ({
            id: s.id,
            topicId: s.topic_id,
            topicTitle: s.topic?.title || 'N/A',
            supervisor: s.topic?.supervisor?.full_name || 'N/A',
            date: s.defense_date,
            time: s.defense_time,
            room: s.room,
            status: s.topic?.status,
            type: s.topic?.defense_type || 'DEFENSE'
        }));
    }
}

export default new DefenseService();
