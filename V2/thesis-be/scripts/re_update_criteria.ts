import { PrismaClient, RaterRole } from '@prisma/client';

const prisma = new PrismaClient();

const newCriteria = [
    'Phân tích vấn đề và mô hình hóa được yêu cầu của đề tài.',
    'Áp dụng các nguyên tắc, phương pháp chuyên môn để xác định được giải pháp cho đề tài.',
    'Thiết kế được một hệ thống hoặc quy trình đáp ứng được yêu cầu của đề tài.',
    'Hiện thực được một hệ thống hoặc quy trình đáp ứng được yêu cầu của đề tài.',
    'Đánh giá được một hệ thống, quy trình đáp ứng yêu cầu của đề tài.',
    'Thuyết trình hiệu quả trong các lĩnh vực chuyên môn của đề tài.',
    'Phỏng vấn theo những lĩnh vực khác nhau để thu thập yêu cầu của khách hàng.',
    'Viết được báo cáo khóa luận tốt nghiệp',
    'Chứng tỏ được khả năng làm việc hiệu quả với các thành viên trong nhóm',
    'Khả năng hỗ trợ triển khai và vận hành hệ thống thông tin'
];

async function main() {
    console.log('--- Re-inserting Grading Criteria Data ---');

    // 1. Get all departments
    const departments = await prisma.department.findMany();

    // Roles to setup
    const roles = [RaterRole.SUPERVISOR, RaterRole.REVIEWER_1, RaterRole.COMMITTEE_MEMBER];

    // Helper to create criteria set
    const createSet = async (deptId: string | null) => {
        for (const role of roles) {
            for (let i = 0; i < newCriteria.length; i++) {
                await prisma.gradingCriterion.create({
                    data: {
                        name: newCriteria[i],
                        description: `Tiêu chí ${i + 1}`,
                        weight: 0.1,
                        max_score: 10,
                        min_score: 0,
                        role: role,
                        order_index: i + 1,
                        criteria_type: 'REGULAR',
                        departmentId: deptId
                    }
                });
            }
        }
    };

    // 2. Create for each department
    for (const dept of departments) {
        console.log(`Creating criteria for department: ${dept.name}`);
        await createSet(dept.id);
    }

    // 3. Create GLOBAL criteria
    console.log(`Creating GLOBAL criteria`);
    await createSet(null);

    console.log('--- Update Completed ---');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
