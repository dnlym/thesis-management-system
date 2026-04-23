
import { PrismaClient } from '@prisma/client';
import fs from 'fs';
const prisma = new PrismaClient();

async function main() {
    console.log('📦 Starting database export...');

    const data: any = {};

    data.departments = await prisma.department.findMany();
    data.semesters = await prisma.semester.findMany();
    data.users = await prisma.user.findMany({
        select: {
            id: true, email: true, full_name: true, role: true,
            student_code: true, departmentId: true, active: true
        }
    }); // Exclude password_hash for security
    data.topics = await prisma.topic.findMany();
    data.groups = await prisma.group.findMany();
    data.group_members = await prisma.groupMember.findMany();
    data.topic_registrations = await prisma.topicRegistration.findMany();
    data.assignments = await prisma.assignment.findMany();
    data.grading_criteria = await prisma.gradingCriterion.findMany();
    data.defense_schedules = await prisma.defenseSchedule.findMany();


    const exportPath = './db_export.json';
    fs.writeFileSync(exportPath, JSON.stringify(data, null, 2));

    console.log(`✅ Export complete: ${exportPath}`);
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
