-- AlterTable
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "paymentDetails" TEXT;

-- AlterTable
ALTER TABLE "Restaurant" ADD COLUMN IF NOT EXISTS "deunaPhone" TEXT,
ADD COLUMN IF NOT EXISTS "payphonePhone" TEXT,
ADD COLUMN IF NOT EXISTS "payphoneQrUrl" TEXT,
ADD COLUMN IF NOT EXISTS "payphoneUrl" TEXT;
