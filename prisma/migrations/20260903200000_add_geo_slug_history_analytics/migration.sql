-- AlterTable
ALTER TABLE "Restaurant" ADD COLUMN IF NOT EXISTS "country" TEXT DEFAULT 'Ecuador';
ALTER TABLE "Restaurant" ADD COLUMN IF NOT EXISTS "province" TEXT;
ALTER TABLE "Restaurant" ADD COLUMN IF NOT EXISTS "city" TEXT;
ALTER TABLE "Restaurant" ADD COLUMN IF NOT EXISTS "parish" TEXT;
ALTER TABLE "Restaurant" ADD COLUMN IF NOT EXISTS "sector" TEXT;
ALTER TABLE "Restaurant" ADD COLUMN IF NOT EXISTS "neighborhood" TEXT;
ALTER TABLE "Restaurant" ADD COLUMN IF NOT EXISTS "postalCode" TEXT;
ALTER TABLE "Restaurant" ADD COLUMN IF NOT EXISTS "latitude" DOUBLE PRECISION;
ALTER TABLE "Restaurant" ADD COLUMN IF NOT EXISTS "longitude" DOUBLE PRECISION;
ALTER TABLE "Restaurant" ADD COLUMN IF NOT EXISTS "seoTitle" TEXT;
ALTER TABLE "Restaurant" ADD COLUMN IF NOT EXISTS "seoDescription" TEXT;
ALTER TABLE "Restaurant" ADD COLUMN IF NOT EXISTS "seoKeywords" TEXT;
ALTER TABLE "Restaurant" ADD COLUMN IF NOT EXISTS "seoImage" TEXT;
ALTER TABLE "Restaurant" ADD COLUMN IF NOT EXISTS "customFaq" TEXT;

-- CreateTable
CREATE TABLE IF NOT EXISTS "SlugHistory" (
    "id" TEXT NOT NULL,
    "oldSlug" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SlugHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "AnalyticsEvent" (
    "id" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "restaurantId" TEXT,
    "metadata" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnalyticsEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "SlugHistory_oldSlug_key" ON "SlugHistory"("oldSlug");
CREATE INDEX IF NOT EXISTS "SlugHistory_oldSlug_idx" ON "SlugHistory"("oldSlug");
CREATE INDEX IF NOT EXISTS "SlugHistory_restaurantId_idx" ON "SlugHistory"("restaurantId");
CREATE INDEX IF NOT EXISTS "AnalyticsEvent_eventType_createdAt_idx" ON "AnalyticsEvent"("eventType", "createdAt");
CREATE INDEX IF NOT EXISTS "AnalyticsEvent_restaurantId_idx" ON "AnalyticsEvent"("restaurantId");
CREATE INDEX IF NOT EXISTS "Restaurant_province_city_idx" ON "Restaurant"("province", "city");
CREATE INDEX IF NOT EXISTS "Restaurant_latitude_longitude_idx" ON "Restaurant"("latitude", "longitude");
CREATE INDEX IF NOT EXISTS "Dish_name_idx" ON "Dish"("name");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "SlugHistory" ADD CONSTRAINT "SlugHistory_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "AnalyticsEvent" ADD CONSTRAINT "AnalyticsEvent_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
