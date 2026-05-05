import { PrismaClient, RaterRole } from '@prisma/client';

const prisma = new PrismaClient();

const loNames = [
    "Phân tích vấn đề và mô hình hóa được yêu cầu của đề tài",
    "Áp dụng các nguyên tắc, phương pháp chuyên môn để xác định được giải pháp",
    "Thiết kế được một hệ thống hoặc quy trình đáp ứng yêu cầu",
    "Hiện thực được một hệ thống hoặc quy trình đáp ứng yêu cầu",
    "Đánh giá được một hệ thống, quy trình đáp ứng yêu cầu",
    "Thuyết trình hiệu quả trong các lĩnh vực chuyên môn",
    "Phỏng vấn theo những lĩnh vực khác nhau để thu thập yêu cầu",
    "Viết được báo cáo khóa luận tốt nghiệp",
    "Chứng tỏ được khả năng làm việc hiệu quả với các thành viên trong nhóm",
    "Khả năng hỗ trợ triển khai và vận hành hệ thống thông tin",
];

const targetRoles = [
    RaterRole.SUPERVISOR,
    RaterRole.REVIEWER_1,
    RaterRole.COMMITTEE_CHAIR
];

async function main() {
    console.log('🧹 Đang dọn dẹp toàn bộ tiêu chí cũ...');
    
    try {
        await prisma.gradingCriterion.deleteMany({});
        console.log('✅ Đã xóa sạch các tiêu chí cũ.');
    } catch (error) {
        console.warn('⚠️ Không thể xóa cứng. Đang chuyển sang vô hiệu hóa...');
        await prisma.gradingCriterion.updateMany({
            data: { active: false }
        });
    }

    console.log('🚀 Đang nạp 10 tiêu chí LO cho từng nhóm vai trò (GVHD, Phản biện, Hội đồng)...');
    
    for (const role of targetRoles) {
        console.log(`\n--- Vai trò: ${role} ---`);
        for (let i = 0; i < loNames.length; i++) {
            const name = loNames[i];
            const loId = `${role}_LO${i+1}`;
            
            await prisma.gradingCriterion.create({
                data: {
                    id: loId,
                    name: name,
                    description: name,
                    weight: 0.1,
                    max_score: 10,
                    min_score: 0,
                    role: role,
                    criteria_type: 'FINAL',
                    order_index: i,
                    active: true,
                }
            });
            console.log(`✅ Đã nạp ${loId}`);
        }
    }
    
    console.log('\n🎉 Đã hoàn thành! Mỗi vai trò hiện có bộ 10 tiêu chí riêng biệt.');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
