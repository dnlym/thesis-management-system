-- CreateEnum
CREATE TYPE "InterdisciplinaryStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- AlterTable
ALTER TABLE "topics" ADD COLUMN     "co_supervisor_id" TEXT,
ADD COLUMN     "interdisciplinary_status" "InterdisciplinaryStatus",
ADD COLUMN     "is_interdisciplinary" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "secondary_department_id" TEXT;

-- AddForeignKey
ALTER TABLE "topics" ADD CONSTRAINT "topics_secondary_department_id_fkey" FOREIGN KEY ("secondary_department_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "topics" ADD CONSTRAINT "topics_co_supervisor_id_fkey" FOREIGN KEY ("co_supervisor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
