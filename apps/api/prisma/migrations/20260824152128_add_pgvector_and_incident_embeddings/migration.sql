-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "vector";

-- CreateTable
CREATE TABLE "public"."IncidentEmbedding" (
    "id" TEXT NOT NULL,
    "incidentId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "embedding" vector(384) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IncidentEmbedding_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "IncidentEmbedding_incidentId_key" ON "public"."IncidentEmbedding"("incidentId");

-- CreateIndex
CREATE INDEX "IncidentEmbedding_organizationId_idx" ON "public"."IncidentEmbedding"("organizationId");

-- AddForeignKey
ALTER TABLE "public"."IncidentEmbedding" ADD CONSTRAINT "IncidentEmbedding_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "public"."Incident"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
