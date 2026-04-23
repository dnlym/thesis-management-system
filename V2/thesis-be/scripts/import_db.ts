
import { PrismaClient } from '@prisma/client';
import fs from 'fs';
const prisma = new PrismaClient();

async function main() {
    const importPath = './db_export.json';
    if (!fs.existsSync(importPath)) {
        console.error('❌ File db_export.json not found!');
        return;
    }

    const data = JSON.parse(fs.readFileSync(importPath, 'utf-8'));
    console.log('🚀 Starting database restore from JSON...');

    // 0. Disable constraints or truncate (Caution: this clears current data)
    console.log('🧹 Cleaning existing data...');
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE "audit_logs", "notifications", "grades", "final_scores", "submission_versions", "submissions", "topic_registrations", "group_members", "groups", "assignments", "topics", "semesters", "users", "departments" RESTART IDENTITY CASCADE`);

    // 1. Departments
    console.log('📦 Importing Departments...');
    for (const item of data.departments) {
        await prisma.department.create({ data: item });
    }

    // 2. Semesters
    console.log('📅 Importing Semesters...');
    for (const item of data.semesters) {
        await prisma.semester.create({
            data: {
                ...item,
                start_date: new Date(item.start_date),
                end_date: new Date(item.end_date),
                proposal_deadline: item.proposal_deadline ? new Date(item.proposal_deadline) : null,
                thesis_deadline: item.thesis_deadline ? new Date(item.thesis_deadline) : null,
                defense_start: item.defense_start ? new Date(item.defense_start) : null,
                defense_end: item.defense_end ? new Date(item.defense_end) : null,
            }
        });
    }

    // 3. Users
    console.log('👥 Importing Users...');
    const commonPassword = '$2a$10$v7m7M.D7YvH4nO9m4R8uOe8yZ8V.87n95b2zW2qUf8yP6m5sV7n6O'; // Password@123
    for (const item of data.users) {
        await prisma.user.create({
            data: {
                ...item,
                password_hash: commonPassword, // Set a default password
            }
        });
    }

    // 4. Grading Criteria
    console.log('📊 Importing Grading Criteria...');
    for (const item of data.grading_criteria) {
        await prisma.gradingCriterion.create({ data: item });
    }

    // 5. Topics
    console.log('📖 Importing Topics...');
    for (const item of data.topics) {
        await prisma.topic.create({
            data: {
                ...item,
                created_at: new Date(item.created_at),
                updated_at: new Date(item.updated_at),
                approved_at: item.approved_at ? new Date(item.approved_at) : null,
            }
        });
    }

    // 6. Groups
    console.log('👨‍👩‍👦 Importing Groups...');
    for (const item of data.groups) {
        await prisma.group.create({
            data: {
                ...item,
                created_at: new Date(item.created_at),
            }
        });
    }

    // 7. Group Members
    console.log('🔗 Importing Group Members...');
    for (const item of data.group_members) {
        await prisma.groupMember.create({
            data: {
                ...item,
                joined_at: new Date(item.joined_at),
            }
        });
    }

    // 8. Topic Registrations
    console.log('📝 Importing Registrations...');
    for (const item of data.topic_registrations) {
        await prisma.topicRegistration.create({
            data: {
                ...item,
                registered_at: new Date(item.registered_at),
                confirmed_at: item.confirmed_at ? new Date(item.confirmed_at) : null,
            }
        });
    }

    // 9. Assignments
    console.log('📋 Importing Assignments...');
    for (const item of data.assignments) {
        await prisma.assignment.create({
            data: {
                ...item,
                assigned_at: new Date(item.assigned_at),
                responded_at: item.responded_at ? new Date(item.responded_at) : null,
                deadline_at: item.deadline_at ? new Date(item.deadline_at) : null,
            }
        });
    }

    // 10. Defense Schedules (If available)
    if (data.defense_schedules) {
        console.log('📅 Importing Defense Schedules...');
        for (const item of data.defense_schedules) {
            await prisma.defenseSchedule.create({
                data: {
                    ...item,
                    defense_date: new Date(item.defense_date),
                    created_at: new Date(item.created_at),
                }
            });
        }
    }

    console.log('✅ Restore complete!');
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
