-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "public"."MetricField" ADD VALUE 'NETWORK_IN';
ALTER TYPE "public"."MetricField" ADD VALUE 'NETWORK_OUT';
ALTER TYPE "public"."MetricField" ADD VALUE 'DISK_READ_RATE';
ALTER TYPE "public"."MetricField" ADD VALUE 'DISK_WRITE_RATE';
ALTER TYPE "public"."MetricField" ADD VALUE 'PROCESS_COUNT';
ALTER TYPE "public"."MetricField" ADD VALUE 'LOAD_AVERAGE';
