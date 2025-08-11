-- AlterTable
ALTER TABLE "Alert" ADD COLUMN     "scope" TEXT NOT NULL DEFAULT 'now';

-- AlterTable
ALTER TABLE "Observation" ADD COLUMN     "maxProb12h" INTEGER,
ADD COLUMN     "nowProb" INTEGER,
ADD COLUMN     "peakHourLocal" TIMESTAMP(3),
ADD COLUMN     "sumPrecip12h" DOUBLE PRECISION;
