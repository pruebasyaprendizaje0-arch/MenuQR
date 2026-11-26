-- AlterTable
ALTER TABLE "OrderItem" ADD COLUMN IF NOT EXISTS "dishId" TEXT;
ALTER TABLE "OrderItem" ADD COLUMN IF NOT EXISTS "unitsDeducted" INTEGER;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "OrderItem_dishId_idx" ON "OrderItem"("dishId");
