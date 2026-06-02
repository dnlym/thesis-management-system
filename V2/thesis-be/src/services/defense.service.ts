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
                        },
                        assignments: {
                            include: {
                                reviewer: {
                                    select: {
                                        id: true,
                                        full_name: true
                                    }
                                }
                            }
                        },
                        registrations: {
                            include: {
                                student: {
                                    select: {
                                        id: true,
                                        full_name: true,
                                        student_code: true
                                    }
                                },
                                group: {
                                    include: {
                                        members: {
                                            where: { status: 'ACCEPTED' },
                                            include: {
                                                user: {
                                                    select: {
                                                        id: true,
                                                        full_name: true,
                                                        student_code: true
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            },
            orderBy: {
                defense_date: 'asc'
            }
        });

        return schedules.map(s => {
            const topic = s.topic;
            const registrations = topic?.registrations || [];
            const firstReg = registrations[0];
            let students: { id: string; fullName: string; studentCode: string; }[] = [];
            if (firstReg?.group?.members && firstReg.group.members.length > 0) {
                students = firstReg.group.members.map((m: any) => ({
                    id: m.user?.id || '',
                    fullName: m.user?.full_name || '',
                    studentCode: m.user?.student_code || ''
                }));
            } else if (firstReg?.student) {
                students = [{
                    id: firstReg.student.id,
                    fullName: firstReg.student.full_name || '',
                    studentCode: firstReg.student.student_code || ''
                }];
            }

            const committee = topic?.assignments?.map((a: any) => ({
                id: a.reviewer?.id,
                fullName: a.reviewer?.full_name,
                role: a.committee_role,
                type: a.assignment_type
            })) || [];

            return {
                id: s.id,
                topicId: s.topic_id,
                topicTitle: topic?.title || 'N/A',
                supervisor: topic?.supervisor?.full_name || 'N/A',
                date: s.defense_date,
                time: s.defense_time,
                room: s.room,
                status: topic?.status,
                type: topic?.defense_type || 'DEFENSE',
                students,
                committee
            };
        });
    }
}

export default new DefenseService();
