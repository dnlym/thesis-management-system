import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';

const prisma = new PrismaClient();

async function main() {
    let output = '=== KIEM TRA SO LUONG SINH VIEN TRONG DE TAI ===\n\n';

    // Get all topics with their current_students field and actual registrations
    const topics = await prisma.topic.findMany({
        where: {
            status: { in: ['APPROVED', 'REGISTERED', 'UNDER_REVIEW'] }
        },
        include: {
            registrations: {
                include: {
                    student: { select: { full_name: true, student_code: true } }
                }
            },
            supervisor: { select: { full_name: true } }
        },
        orderBy: { code: 'asc' }
    });

    output += `Tong so de tai: ${topics.length}\n\n`;
    output += '| Ma de tai | Ten de tai | current_students (DB) | So dang ky thuc te | Match? |\n';
    output += '|-----------|------------|----------------------|-------------------|--------|\n';

    let mismatchCount = 0;

    for (const topic of topics) {
        const dbCount = topic.current_students;
        const actualCount = topic.registrations.length;
        const isMatch = dbCount === actualCount;

        if (!isMatch) mismatchCount++;

        const shortTitle = topic.title.length > 30 ? topic.title.substring(0, 30) + '...' : topic.title;
        output += `| ${topic.code || 'N/A'} | ${shortTitle} | ${dbCount} | ${actualCount} | ${isMatch ? 'OK' : 'MISMATCH'} |\n`;
    }

    output += '\n';
    output += `=== KET QUA ===\n`;
    output += `So de tai khop: ${topics.length - mismatchCount}\n`;
    output += `So de tai KHONG khop: ${mismatchCount}\n\n`;

    // Show details for mismatched topics
    if (mismatchCount > 0) {
        output += '=== CHI TIET CAC DE TAI KHONG KHOP ===\n\n';

        for (const topic of topics) {
            const dbCount = topic.current_students;
            const actualCount = topic.registrations.length;

            if (dbCount !== actualCount) {
                output += `De tai: ${topic.title}\n`;
                output += `  Ma: ${topic.code || 'N/A'}\n`;
                output += `  GVHD: ${topic.supervisor.full_name}\n`;
                output += `  current_students trong DB: ${dbCount}\n`;
                output += `  So dang ky thuc te: ${actualCount}\n`;
                output += `  Danh sach sinh vien dang ky:\n`;
                for (const reg of topic.registrations) {
                    output += `    - ${reg.student.full_name} (${reg.student.student_code}) - ${reg.status}\n`;
                }
                output += '\n';
            }
        }
    }

    fs.writeFileSync('topic-check.txt', output, 'utf8');
    console.log('Done! Check topic-check.txt');
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
