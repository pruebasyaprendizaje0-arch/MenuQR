-- AlterTable
ALTER TABLE "OrderItem" ADD COLUMN IF NOT EXISTS "sourcePedidoItemId" TEXT;
ALTER TABLE "OrderItem" ADD COLUMN IF NOT EXISTS "lineStatus" TEXT NOT NULL DEFAULT 'ACTIVE';

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "OrderItem_sourcePedidoItemId_key" ON "OrderItem"("sourcePedidoItemId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "OrderItem_lineStatus_idx" ON "OrderItem"("lineStatus");
