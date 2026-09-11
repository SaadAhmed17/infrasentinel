-- AlterEnum
ALTER TYPE "public"."RuleType" ADD VALUE 'UNUSUAL_ACCESS';

-- AlterTable
ALTER TABLE "public"."Rule" ADD COLUMN     "approvedUsernames" TEXT,
ADD COLUMN     "businessHourEndUTC" INTEGER,
ADD COLUMN     "businessHourStartUTC" INTEGER;
