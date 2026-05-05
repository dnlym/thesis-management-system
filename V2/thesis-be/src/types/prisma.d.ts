import { Prisma } from '@prisma/client';

declare module '@prisma/client' {
  interface PrismaClient {
    departmentSemesterConfig: Prisma.DepartmentSemesterConfigDelegate<any>;
  }
}
