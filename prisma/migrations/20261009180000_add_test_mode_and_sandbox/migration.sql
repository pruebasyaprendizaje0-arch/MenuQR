-- AlterTable
ALTER TABLE "Restaurant" ADD COLUMN IF NOT EXISTS "testMode" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "isTest" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Order_restaurantId_isTest_idx" ON "Order"("restaurantId", "isTest");

-- AlterTable
ALTER TABLE "AnalyticsEvent" ADD COLUMN IF NOT EXISTS "isTest" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AnalyticsEvent_restaurantId_isTest_idx" ON "AnalyticsEvent"("restaurantId", "isTest");

-- AlterTable
ALTER TABLE "TableSession" ADD COLUMN IF NOT EXISTS "isTest" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "TableSession_restaurantId_isTest_idx" ON "TableSession"("restaurantId", "isTest");

-- Mark existing test records as test data
UPDATE "Restaurant" SET "testMode" = true;
UPDATE "Order" SET "isTest" = true;
UPDATE "AnalyticsEvent" SET "isTest" = true;
UPDATE "TableSession" SET "isTest" = true;
