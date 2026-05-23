import prisma from '../config/database';
import { UserRole } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { AuditLogger } from '../utils/audit-logger';

export class UserService {
    async getUsers(currentUserId: string, filters?: { role?: UserRole; departmentId?: string; search?: string }) {
        const currentUser = await prisma.user.findUnique({ where: { id: currentUserId } });
        const where: any = {};

        if (filters?.role) {
            if (filters.role === UserRole.LECTURER) {
                where.role = { in: [UserRole.LECTURER, UserRole.HEAD, UserRole.COORDINATOR] };
            } else {
                where.role = filters.role;
            }
        }

        // Role-based scoping
        if (currentUser?.role === UserRole.HEAD || currentUser?.role === UserRole.LECTURER) {
            // HODs and LECTURERs can only see users from their own department
            where.departmentId = currentUser.departmentId;
        } else if (filters?.departmentId) {
            // ADMINs or others can filter by departmentId
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
                topic_registrations: {
                    include: {
                        topic: true,
                    },
                },
                group_memberships: {
                    include: {
                        group: true,
                    },
                },
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

    async createUser(adminId: string, data: any) {
        const existingUser = await prisma.user.findUnique({
            where: { email: data.email },
        });

        if (existingUser) {
            throw new Error('Email đã tồn tại trong hệ thống');
        }

        if (data.studentCode) {
            const existingCode = await prisma.user.findUnique({
                where: { student_code: data.studentCode },
            });
            if (existingCode) {
                throw new Error('Mã số sinh viên/giảng viên này đã tồn tại');
            }
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
                class_name: data.className || data.class_name,
                phone: data.phone,
            },
        });

        await AuditLogger.log({
            userId: adminId,
            action: 'CREATE_USER',
            entityType: 'User',
            entityId: user.id,
            newValue: user,
            description: `Admin ${adminId} đã tạo người dùng mới: ${user.full_name} (${user.role})`
        });

        return user;
    }

    async updateUser(adminId: string, id: string, data: any) {
        const existingUser = await this.getUserById(id);
        const updateData: any = {};
        
        if (data.fullName !== undefined) updateData.full_name = data.fullName;
        if (data.full_name !== undefined) updateData.full_name = data.full_name;
        
        if (data.role !== undefined) updateData.role = data.role;
        
        if (data.departmentId !== undefined) updateData.departmentId = data.departmentId;
        if (data.department_id !== undefined) updateData.departmentId = data.department_id;
        
         if (data.studentCode !== undefined || data.student_code !== undefined) {
            const newCode = data.studentCode || data.student_code;
            if (newCode) {
                const existingCode = await prisma.user.findFirst({
                    where: { 
                        student_code: newCode,
                        id: { not: id } 
                    },
                });
                if (existingCode) {
                    throw new Error('Mã số sinh viên/giảng viên này đã bị trùng với người dùng khác');
                }
            }
            updateData.student_code = newCode;
        }
        
        if (data.className !== undefined) updateData.class_name = data.className;
        if (data.class_name !== undefined) updateData.class_name = data.class_name;
        
        if (data.phone !== undefined) updateData.phone = data.phone;
        if (data.active !== undefined) updateData.active = data.active;
        if (data.email !== undefined) {
            const existingEmail = await prisma.user.findFirst({
                where: { 
                    email: data.email,
                    id: { not: id }
                }
            });
            if (existingEmail) {
                throw new Error('Email này đã được sử dụng bởi người dùng khác');
            }
            updateData.email = data.email;
        }
        if (data.avatar_url !== undefined) updateData.avatar_url = data.avatar_url;

        const user = await prisma.user.update({
            where: { id },
            data: updateData,
        });

        await AuditLogger.log({
            userId: adminId,
            action: 'UPDATE_USER',
            entityType: 'User',
            entityId: id,
            oldValue: existingUser,
            newValue: user,
            description: `Người dùng ${adminId} đã cập nhật thông tin cho: ${user.full_name}`
        });

        return user;
    }

    async deleteUser(adminId: string, id: string) {
        const existingUser = await this.getUserById(id);
        let action = 'DELETE_USER';
        let message = 'User deleted successfully';

        try {
            await prisma.user.delete({
                where: { id },
            });
        } catch (error: any) {
            // P2003 is the Prisma error code for Foreign Key constraint failed
            if (error.code === 'P2003') {
                await prisma.user.update({
                    where: { id },
                    data: { active: false }
                });
                action = 'DEACTIVATE_USER';
                message = 'Người dùng đã có dữ liệu ràng buộc, hệ thống đã chuyển sang trạng thái Vô hiệu hóa.';
            } else {
                throw new Error('Không thể xóa người dùng: ' + error.message);
            }
        }

        await AuditLogger.log({
            userId: adminId,
            action: action,
            entityType: 'User',
            entityId: id,
            oldValue: existingUser,
            description: `Admin ${adminId} đã ${action === 'DELETE_USER' ? 'xóa' : 'vô hiệu hóa'} người dùng: ${existingUser.full_name}`
        });

        return { message };
    }

    async getRoleSummary() {
        const roles = Object.values(UserRole);
        const summary = await Promise.all(
            roles.map(async (role) => {
                const count = await prisma.user.count({
                    where: { role, active: true },
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
