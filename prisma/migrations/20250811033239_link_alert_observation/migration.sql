-- AlterTable
ALTER TABLE "Alert" ADD COLUMN     "observationId" TEXT;

-- AlterTable
ALTER TABLE "Observation" ADD COLUMN     "intensityClass" TEXT,
ADD COLUMN     "precipHour" DOUBLE PRECISION,
ADD COLUMN     "probability" INTEGER,
ADD COLUMN     "radarDuration" INTEGER,
ADD COLUMN     "radarEtaMin" INTEGER,
ADD COLUMN     "radarIntensity" TEXT,
ADD COLUMN     "staleSources" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AddForeignKey
ALTER TABLE "Alert" ADD CONSTRAINT "Alert_observationId_fkey" FOREIGN KEY ("observationId") REFERENCES "Observation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
