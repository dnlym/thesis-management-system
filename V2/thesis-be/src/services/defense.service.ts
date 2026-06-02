import prisma from '../config/database';
import { SemesterPhase } from '@prisma/client';
import semesterService from './semester.service';
import dayjs from 'dayjs';

export class DefenseService {
    async getSchedules(userId: string, userRole: string, semesterId?: string) {
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
                        supervisor_id: true,
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
            }
        });

        const reviewerAssignments = await prisma.assignment.findMany({
            where: {
                assignment_type: 'REVIEWER',
                start_time: {
                    not: null
                },
                topic: {
                    semester_id: targetSemesterId
                }
            },
            include: {
                reviewer: {
                    select: {
                        id: true,
                        full_name: true
                    }
                },
                topic: {
                    select: {
                        id: true,
                        title: true,
                        status: true,
                        supervisor_id: true,
                        supervisor: {
                            select: {
                                full_name: true
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
            }
        });

        const councilEvents = schedules.map(s => {
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

            const committee = topic?.assignments
                ?.filter((a: any) => a.assignment_type === 'COMMITTEE')
                ?.map((a: any) => ({
                    id: a.reviewer_id,
                    fullName: a.reviewer?.full_name,
                    role: a.committee_role,
                    type: a.assignment_type
                })) || [];

            return {
                id: s.id,
                topicId: s.topic_id,
                topicTitle: topic?.title || 'N/A',
                supervisor: topic?.supervisor?.full_name || 'N/A',
                supervisorId: topic?.supervisor_id,
                date: s.defense_date,
                time: s.defense_time || 'Chưa xếp giờ',
                room: s.room || 'N/A',
                status: topic?.status,
                type: 'COUNCIL_MEETING',
                students,
                committee
            };
        });

        const reviewerEventsMap = new Map<string, any>();

        reviewerAssignments.forEach(a => {
            const key = `${a.topic_id}-${a.start_time ? new Date(a.start_time).getTime() : 'no-time'}-${a.room || 'no-room'}`;

            const member = {
                id: a.reviewer_id,
                fullName: a.reviewer?.full_name || 'N/A',
                role: 'REVIEWER',
                type: 'REVIEWER'
            };

            if (reviewerEventsMap.has(key)) {
                const existing = reviewerEventsMap.get(key);
                // Avoid duplicates if same reviewer appears twice
                if (!existing.committee.some((c: any) => c.id === a.reviewer_id)) {
                    existing.committee.push(member);
                }
            } else {
                const topic = a.topic;
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

                const timeStr = a.start_time && a.end_time
                    ? `${dayjs(a.start_time).format('HH:mm')} - ${dayjs(a.end_time).format('HH:mm')}`
                    : a.start_time
                    ? dayjs(a.start_time).format('HH:mm')
                    : 'Chưa xếp giờ';

                reviewerEventsMap.set(key, {
                    id: a.id,
                    topicId: a.topic_id,
                    topicTitle: topic?.title || 'N/A',
                    supervisor: topic?.supervisor?.full_name || 'N/A',
                    supervisorId: topic?.supervisor_id,
                    date: a.start_time,
                    time: timeStr,
                    room: a.room || 'N/A',
                    status: topic?.status,
                    type: 'DEFENSE',
                    students,
                    committee: [member]
                });
            }
        });

        const reviewerEvents = Array.from(reviewerEventsMap.values());

        const allEvents = [...councilEvents, ...reviewerEvents];
        
        let filteredEvents = allEvents;

        if (userRole === 'LECTURER') {
            filteredEvents = allEvents.filter(e => {
                const isSupervisor = e.supervisorId === userId;
                const isCommitteeOrReviewer = e.committee.some((c: any) => c.id === userId);
                return isSupervisor || isCommitteeOrReviewer;
            });
        } else if (userRole === 'STUDENT') {
            filteredEvents = allEvents.filter(e => {
                return e.students.some((s: any) => s.id === userId);
            });
        }

        filteredEvents.sort((x, y) => {
            const timeX = x.date ? new Date(x.date).getTime() : 0;
            const timeY = y.date ? new Date(y.date).getTime() : 0;
            return timeX - timeY;
        });

        return filteredEvents;
    }
}

export default new DefenseService();
