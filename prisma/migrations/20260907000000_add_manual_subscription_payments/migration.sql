CREATE TABLE "ManualSubscriptionPayment" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "method" TEXT NOT NULL,
    "reference" TEXT,
    "receiptUrl" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "startsAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ManualSubscriptionPayment_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ManualSubscriptionPayment_restaurantId_status_idx" ON "ManualSubscriptionPayment"("restaurantId", "status");
CREATE INDEX "ManualSubscriptionPayment_status_createdAt_idx" ON "ManualSubscriptionPayment"("status", "createdAt");
ALTER TABLE "ManualSubscriptionPayment" ADD CONSTRAINT "ManualSubscriptionPayment_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
