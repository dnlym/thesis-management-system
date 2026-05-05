import prisma from '../src/config/database';

async function main() {
    try {
        const user = await prisma.user.findFirst({
            where: { full_name: { contains: 'Nguyễn Thị Hạnh' } }
        });
        
        if (!user) {
            console.log('User not found.');
            return;
        }
        
        console.log(`User: ${user.full_name} (${user.id})`);
        console.log(`Role: ${user.role}`);
        console.log(`Department: ${user.departmentId}`);
    } catch (error) {
        console.error('Error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
