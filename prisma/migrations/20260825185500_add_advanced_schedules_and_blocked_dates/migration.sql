-- AlterTable
ALTER TABLE "Restaurant" ADD COLUMN IF NOT EXISTS "localSchedule" TEXT,
ADD COLUMN IF NOT EXISTS "deliverySchedule" TEXT,
ADD COLUMN IF NOT EXISTS "blockedDates" TEXT;
