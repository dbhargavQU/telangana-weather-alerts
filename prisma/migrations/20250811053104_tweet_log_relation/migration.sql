-- CreateTable
CREATE TABLE "TweetLog" (
    "id" TEXT NOT NULL,
    "areaId" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "bucket" TEXT NOT NULL,
    "windowLabel" TEXT,
    "hash" TEXT NOT NULL,
    "tweetId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TweetLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TweetLog_hash_key" ON "TweetLog"("hash");

-- CreateIndex
CREATE INDEX "TweetLog_areaId_scope_createdAt_idx" ON "TweetLog"("areaId", "scope", "createdAt");

-- AddForeignKey
ALTER TABLE "TweetLog" ADD CONSTRAINT "TweetLog_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "Area"("id") ON DELETE CASCADE ON UPDATE CASCADE;
