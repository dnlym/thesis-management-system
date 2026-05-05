import permissionService from '../src/services/permission.service';
import prisma from '../src/config/database';

async function main() {
    try {
        console.log('Starting permission re-seed...');
        await permissionService.seedPermissions();
        console.log('Successfully re-seeded permissions.');
    } catch (error) {
        console.error('Error seeding permissions:', error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
