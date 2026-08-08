-- AlterTable
ALTER TABLE "public"."Metric" ADD COLUMN     "diskReadRate" DOUBLE PRECISION,
ADD COLUMN     "diskWriteRate" DOUBLE PRECISION,
ADD COLUMN     "loadAverage" DOUBLE PRECISION,
ADD COLUMN     "networkIn" DOUBLE PRECISION,
ADD COLUMN     "networkOut" DOUBLE PRECISION,
ADD COLUMN     "processCount" INTEGER;
