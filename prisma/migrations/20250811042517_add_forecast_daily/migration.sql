-- CreateTable
CREATE TABLE "ForecastDaily" (
    "id" TEXT NOT NULL,
    "areaId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "precipitationSum" DOUBLE PRECISION,
    "precipitationProbabilityMax" INTEGER,
    "temperatureMax" DOUBLE PRECISION,
    "temperatureMin" DOUBLE PRECISION,
    "textEn" TEXT,
    "textTe" TEXT,
    "confidence" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ForecastDaily_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ForecastDaily_areaId_date_idx" ON "ForecastDaily"("areaId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "ForecastDaily_areaId_date_key" ON "ForecastDaily"("areaId", "date");

-- AddForeignKey
ALTER TABLE "ForecastDaily" ADD CONSTRAINT "ForecastDaily_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "Area"("id") ON DELETE CASCADE ON UPDATE CASCADE;
