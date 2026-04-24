import prisma from '../config/database';
import { UserRole } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

export class UserService {
    async getUsers(currentUserId: string, filters?: { role?: UserRole; departmentId?: string; search?: string }) {
        const currentUser = await prisma.user.findUnique({ where: { id: currentUserId } });
        const where: any = {};

        if (filters?.role) {
            where.role = filters.role;
        }
        if (filters?.departmentId) {
            where.departmentId = filters.departmentId;
        }

        if (filters?.search) {
            if (currentUser?.role === UserRole.STUDENT) {
                // STUDENTS: Can only search for other students BY EXACT STUDENT CODE
                where.role = UserRole.STUDENT;
                where.student_code = filters.search; // Exact match only
                
                // Also default to same department unless it's a cross-dept search
                if (!filters.departmentId) {
                    // where.departmentId = currentUser.departmentId; // Optional: restrict to same dept search
                }
            } else {
                // FACULTY/ADMIN: Can search by name, email, or code
                where.OR = [
                    { full_name: { contains: filters.search, mode: 'insensitive' } },
                    { email: { contains: filters.search, mode: 'insensitive' } },
                    { student_code: { contains: filters.search, mode: 'insensitive' } },
                ];
            }
        }

        const users = await prisma.user.findMany({
            where,
            include: {
                department: true,
            },
            orderBy: { created_at: 'desc' },
        });

        return users;
    }

    async getUserById(id: string) {
        const user = await prisma.user.findUnique({
            where: { id },
            include: {
                department: true,
            },
        });

        if (!user) {
            throw new Error('User not found');
        }

        return user;
    }

    async createUser(data: any) {
        const existingUser = await prisma.user.findUnique({
            where: { email: data.email },
        });

        if (existingUser) {
            throw new Error('Email already exists');
        }

        const hashedPassword = await bcrypt.hash(data.password || '123456', 10);

        const user = await prisma.user.create({
            data: {
                email: data.email,
                password_hash: hashedPassword,
                full_name: data.fullName,
                role: data.role,
                departmentId: data.departmentId,
                student_code: data.studentCode,
                phone: data.phone,
            },
        });

        return user;
    }

    async updateUser(id: string, data: any) {
        const user = await prisma.user.update({
            where: { id },
            data: {
                full_name: data.fullName,
                role: data.role,
                departmentId: data.departmentId,
                student_code: data.studentCode,
                phone: data.phone,
                active: data.active,
            },
        });

        return user;
    }

    async deleteUser(id: string) {
        await prisma.user.delete({
            where: { id },
        });
        return { message: 'User deleted successfully' };
    }

    async getRoleSummary() {
        const roles = Object.values(UserRole);
        const summary = await Promise.all(
            roles.map(async (role) => {
                const count = await prisma.user.count({
                    where: { role },
                });
                return {
                    id: role,
                    userCount: count,
                };
            })
        );
        return summary;
    }
}

export default new UserService();
