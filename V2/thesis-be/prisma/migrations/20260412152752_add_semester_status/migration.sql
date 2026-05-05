-- CreateEnum
CREATE TYPE "SemesterStatus" AS ENUM ('PLANNING', 'ACTIVE', 'COMPLETED');

-- AlterTable
ALTER TABLE "semesters" ADD COLUMN     "status" "SemesterStatus" NOT NULL DEFAULT 'PLANNING';
