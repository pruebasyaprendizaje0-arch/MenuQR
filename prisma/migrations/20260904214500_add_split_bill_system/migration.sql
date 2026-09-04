-- CreateTable
CREATE TABLE "TableSession" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "tableName" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "totalAmount" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "paidAmount" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TableSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TableSplitPayment" (
    "id" TEXT NOT NULL,
    "tableSessionId" TEXT NOT NULL,
    "payerName" TEXT,
    "amount" DOUBLE PRECISION NOT NULL,
    "subtotalPart" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "ivaPart" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "servicePart" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "paymentMethod" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'COMPLETED',
    "idempotencyKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TableSplitPayment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TableSession_restaurantId_tableName_status_idx" ON "TableSession"("restaurantId", "tableName", "status");

-- CreateIndex
CREATE UNIQUE INDEX "TableSplitPayment_idempotencyKey_key" ON "TableSplitPayment"("idempotencyKey");

-- CreateIndex
CREATE INDEX "TableSplitPayment_tableSessionId_idx" ON "TableSplitPayment"("tableSessionId");

-- AddForeignKey
ALTER TABLE "TableSession" ADD CONSTRAINT "TableSession_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TableSplitPayment" ADD CONSTRAINT "TableSplitPayment_tableSessionId_fkey" FOREIGN KEY ("tableSessionId") REFERENCES "TableSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
