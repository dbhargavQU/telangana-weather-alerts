-- CreateEnum
CREATE TYPE "AreaType" AS ENUM ('district', 'neighbourhood');

-- CreateEnum
CREATE TYPE "Severity" AS ENUM ('info', 'medium', 'high');

-- CreateTable
CREATE TABLE "Area" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "AreaType" NOT NULL,
    "polygon" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Area_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Observation" (
    "id" TEXT NOT NULL,
    "areaId" TEXT NOT NULL,
    "observedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rain15" DOUBLE PRECISION,
    "rain60" DOUBLE PRECISION,
    "maxDbz" DOUBLE PRECISION,
    "etaMin" INTEGER,
    "durationMin" INTEGER,
    "thunderProb" DOUBLE PRECISION,
    "floodProb" DOUBLE PRECISION,
    "sources" TEXT[],

    CONSTRAINT "Observation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Alert" (
    "id" TEXT NOT NULL,
    "areaId" TEXT NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "windowStart" TIMESTAMP(3) NOT NULL,
    "windowEnd" TIMESTAMP(3) NOT NULL,
    "severity" "Severity" NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "textEn" TEXT NOT NULL,
    "textTe" TEXT NOT NULL,
    "sources" TEXT[],

    CONSTRAINT "Alert_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Area_type_name_idx" ON "Area"("type", "name");

-- CreateIndex
CREATE INDEX "Observation_areaId_observedAt_idx" ON "Observation"("areaId", "observedAt");

-- CreateIndex
CREATE INDEX "Alert_areaId_issuedAt_idx" ON "Alert"("areaId", "issuedAt");

-- AddForeignKey
ALTER TABLE "Observation" ADD CONSTRAINT "Observation_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "Area"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alert" ADD CONSTRAINT "Alert_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "Area"("id") ON DELETE CASCADE ON UPDATE CASCADE;
