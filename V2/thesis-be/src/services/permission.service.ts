import prisma from '../config/database';
import { UserRole } from '@prisma/client';
import { ALL_PERMISSIONS, DEFAULT_ROLE_PERMISSIONS } from '../constants/permission.defaults';

export class PermissionService {
    private permissionCache: Map<UserRole, Set<string>> = new Map();

    async seedPermissions() {
        console.log('Seeding permissions...');

        // 1. Create all permissions
        for (const p of ALL_PERMISSIONS) {
            await prisma.permission.upsert({
                where: { code: p.code },
                update: {
                    name: p.name,
                    category: p.category,
                    description: p.description,
                },
                create: {
                    code: p.code,
                    name: p.name,
                    category: p.category,
                    description: p.description,
                },
            });
        }

        // 2. Map default permissions to roles
        for (const [role, permissionCodes] of Object.entries(DEFAULT_ROLE_PERMISSIONS)) {
            const userRole = role as UserRole;

            // Get permission IDs
            const permissions = await prisma.permission.findMany({
                where: {
                    code: { in: permissionCodes },
                },
            });

            // Create mappings
            for (const p of permissions) {
                await prisma.rolePermission.upsert({
                    where: {
                        role_permissionId: {
                            role: userRole,
                            permissionId: p.id,
                        },
                    },
                    update: {},
                    create: {
                        role: userRole,
                        permissionId: p.id,
                    },
                });
            }
        }

        console.log('Permissions seeded successfully.');
        this.clearCache();
    }

    async getRolePermissions(role: UserRole): Promise<Set<string>> {
        if (this.permissionCache.has(role)) {
            return this.permissionCache.get(role)!;
        }

        try {
            const rolePermissions = await prisma.rolePermission.findMany({
                where: { role },
                include: { permission: true },
            });

            const permissionSet = new Set<string>(rolePermissions.map((rp: any) => rp.permission.code));

            // If DB returns empty, fallback to defaults
            if (permissionSet.size === 0) {
                console.warn(`No permissions found for role ${role} in DB, falling back to defaults.`);
                const defaults = DEFAULT_ROLE_PERMISSIONS[role] || [];
                const fallbackSet = new Set(defaults);
                this.permissionCache.set(role, fallbackSet);
                return fallbackSet;
            }

            this.permissionCache.set(role, permissionSet);
            return permissionSet;
        } catch (error) {
            console.error(`Error fetching permissions for role ${role}:`, error);
            // Fallback strategy
            return new Set<string>(DEFAULT_ROLE_PERMISSIONS[role] || []);
        }
    }

    async hasPermission(role: UserRole, permissionCode: string): Promise<boolean> {
        // ADMIN always has all permissions (Sovereignty)
        if (role === UserRole.ADMIN) return true;

        const permissions = await this.getRolePermissions(role);
        return permissions.has(permissionCode);
    }

    async getPermissionMatrix() {
        const roles = Object.values(UserRole);

        try {
            // Use (prisma as any) to avoid TS errors if client not generated yet
            let permissions = await (prisma as any).permission.findMany({
                orderBy: [{ category: 'asc' }, { name: 'asc' }],
            });

            // Auto-seed if empty
            if (permissions.length === 0) {
                console.log('No permissions found in DB, auto-seeding...');
                await this.seedPermissions();
                permissions = await (prisma as any).permission.findMany({
                    orderBy: [{ category: 'asc' }, { name: 'asc' }],
                });
            }

            const rolePermissions = await (prisma as any).rolePermission.findMany({
                include: { permission: true }
            });

            const matrix: Record<string, string[]> = {};
            roles.forEach(role => {
                matrix[role] = rolePermissions
                    .filter((rp: any) => rp.role === role)
                    .map((rp: any) => rp.permission.code);
            });

            return {
                roles,
                permissions,
                matrix,
            };
        } catch (error: any) {
            console.warn('Permission system not fully ready in DB, falling back to hardcoded defaults:', error.message);
            // FAIL-SAFE: Return defaults from constants if DB is not synced yet
            return {
                roles,
                permissions: ALL_PERMISSIONS,
                matrix: DEFAULT_ROLE_PERMISSIONS,
            };
        }
    }

    async updateRolePermissions(role: UserRole, permissionCodes: string[]) {
        // 1. Get permission IDs for the provided codes
        const permissions = await prisma.permission.findMany({
            where: {
                code: { in: permissionCodes },
            },
            select: { id: true },
        });

        const permissionIds = permissions.map(p => p.id);

        // 2. Delete existing
        await prisma.rolePermission.deleteMany({
            where: { role },
        });

        // 3. Create new
        const data = permissionIds.map(id => ({
            role,
            permissionId: id,
        }));

        await prisma.rolePermission.createMany({
            data,
        });

        this.clearCache();
        return { success: true };
    }

    clearCache() {
        this.permissionCache.clear();
    }
}

export default new PermissionService();
