import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const loCriteria = [
    { id: 'LO1', name: "Phân tích vấn đề và mô hình hóa được yêu cầu của đề tài (LO1)", weight: 0.1 },
    { id: 'LO2', name: "Áp dụng các nguyên tắc, phương pháp chuyên môn để xác định được giải pháp (LO2)", weight: 0.1 },
    { id: 'LO3', name: "Thiết kế được một hệ thống hoặc quy trình đáp ứng yêu cầu (LO3)", weight: 0.1 },
    { id: 'LO4', name: "Hiện thực được một hệ thống hoặc quy trình đáp ứng yêu cầu (LO4)", weight: 0.1 },
    { id: 'LO5', name: "Đánh giá được một hệ thống, quy trình đáp ứng yêu cầu (LO5)", weight: 0.1 },
    { id: 'LO6', name: "Thuyết trình hiệu quả trong các lĩnh vực chuyên môn (LO6)", weight: 0.1 },
    { id: 'LO7', name: "Phỏng vấn theo những lĩnh vực khác nhau để thu thập yêu cầu (LO7)", weight: 0.1 },
    { id: 'LO8', name: "Viết được báo cáo khóa luận tốt nghiệp (LO8)", weight: 0.1 },
    { id: 'LO9', name: "Chứng tỏ được khả năng làm việc hiệu quả với các thành viên trong nhóm (LO9)", weight: 0.1 },
    { id: 'LO10', name: "Khả năng hỗ trợ triển khai và vận hành hệ thống thông tin (LO10)", weight: 0.1 },
];

async function main() {
    console.log('🧹 Đang dọn dẹp toàn bộ tiêu chí cũ...');
    
    // Disable foreign key checks or handle dependencies if needed. 
    // GradingCriterion is linked to Grade. If there are grades, deletion might fail.
    // Let's set active: false for all and then insert new ones.
    // Or better, delete all if possible.
    
    try {
        await prisma.gradingCriterion.deleteMany({});
        console.log('✅ Đã xóa sạch các tiêu chí cũ.');
    } catch (error) {
        console.warn('⚠️ Không thể xóa cứng (có thể do đã có dữ liệu chấm điểm). Đang chuyển sang vô hiệu hóa...');
        await prisma.gradingCriterion.updateMany({
            data: { active: false }
        });
    }

    console.log('🚀 Đang nạp lại 10 tiêu chí LO chuẩn...');
    
    for (let i = 0; i < loCriteria.length; i++) {
        const lo = loCriteria[i];
        await prisma.gradingCriterion.upsert({
            where: { id: lo.id },
            update: {
                name: lo.name,
                description: lo.name,
                weight: lo.weight,
                active: true,
                order_index: i
            },
            create: {
                id: lo.id,
                name: lo.name,
                description: lo.name,
                weight: lo.weight,
                max_score: 10,
                min_score: 0,
                role: 'SUPERVISOR',
                criteria_type: 'FINAL',
                order_index: i,
                active: true,
            }
        });
        console.log(`✅ Đã nạp ${lo.id}`);
    }
    
    console.log('🎉 Hệ thống đã được chuẩn hóa với đúng 10 tiêu chí!');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
