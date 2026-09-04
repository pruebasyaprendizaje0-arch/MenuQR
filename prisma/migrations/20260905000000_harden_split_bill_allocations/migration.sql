ALTER TABLE "TableSplitPayment" ADD COLUMN "confirmedAt" TIMESTAMP(3);

CREATE TABLE "TableSessionOrder" (
    "id" TEXT NOT NULL,
    "tableSessionId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TableSessionOrder_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TableSplitAllocation" (
    "id" TEXT NOT NULL,
    "tableSplitPaymentId" TEXT NOT NULL,
    "orderItemId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "subtotalPart" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "discountPart" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "ivaPart" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "servicePart" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "seasonRatePart" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "tipPart" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "totalPart" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TableSplitAllocation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TableSessionOrder_tableSessionId_orderId_key" ON "TableSessionOrder"("tableSessionId", "orderId");
CREATE INDEX "TableSessionOrder_orderId_idx" ON "TableSessionOrder"("orderId");
CREATE INDEX "TableSplitAllocation_orderItemId_idx" ON "TableSplitAllocation"("orderItemId");
CREATE INDEX "TableSplitAllocation_tableSplitPaymentId_idx" ON "TableSplitAllocation"("tableSplitPaymentId");
ALTER TABLE "TableSessionOrder" ADD CONSTRAINT "TableSessionOrder_tableSessionId_fkey" FOREIGN KEY ("tableSessionId") REFERENCES "TableSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TableSessionOrder" ADD CONSTRAINT "TableSessionOrder_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TableSplitAllocation" ADD CONSTRAINT "TableSplitAllocation_tableSplitPaymentId_fkey" FOREIGN KEY ("tableSplitPaymentId") REFERENCES "TableSplitPayment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TableSplitAllocation" ADD CONSTRAINT "TableSplitAllocation_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
