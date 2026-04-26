import permissionService from '../src/services/permission.service';
import prisma from '../src/config/database';

async function main() {
    try {
        console.log('🚀 Starting manual permission seeding...');
        await permissionService.seedPermissions();
        console.log('✅ Permission seeding completed successfully.');
    } catch (error) {
        console.error('❌ Error during permission seeding:', error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
