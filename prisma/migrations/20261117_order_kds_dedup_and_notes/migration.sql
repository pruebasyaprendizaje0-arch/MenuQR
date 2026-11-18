-- AlterTable: Adición de columnas nullables y con default para idempotencia y comanda autoritativa
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "claimHash" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "kdsDispatched" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex: Optimización de búsqueda de órdenes pendientes para el reconciliador pasivo
CREATE INDEX IF NOT EXISTS "Order_restaurantId_kdsDispatched_idx" ON "Order"("restaurantId", "kdsDispatched");

-- AlterTable: Adición de notas y variantes para la comanda de cocina autoritativa
ALTER TABLE "OrderItem" ADD COLUMN IF NOT EXISTS "notes" TEXT;
