-- AlterTable Order
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "depositDiscount" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
ADD COLUMN IF NOT EXISTS "reservationId" TEXT;

-- CreateTable TableReservation
CREATE TABLE IF NOT EXISTS "TableReservation" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "customerName" TEXT NOT NULL,
    "customerPhone" TEXT NOT NULL,
    "peopleCount" INTEGER NOT NULL DEFAULT 2,
    "reservationDate" TIMESTAMP(3) NOT NULL,
    "reservationTime" TEXT NOT NULL,
    "tableName" TEXT,
    "depositAmount" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "depositPaid" BOOLEAN NOT NULL DEFAULT false,
    "depositMethod" TEXT,
    "status" TEXT NOT NULL DEFAULT 'CONFIRMED',
    "notes" TEXT,
    "usedInOrderId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TableReservation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "TableReservation_restaurantId_reservationDate_idx" ON "TableReservation"("restaurantId", "reservationDate");
CREATE INDEX IF NOT EXISTS "TableReservation_restaurantId_status_idx" ON "TableReservation"("restaurantId", "status");
CREATE INDEX IF NOT EXISTS "TableReservation_restaurantId_customerPhone_idx" ON "TableReservation"("restaurantId", "customerPhone");

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'TableReservation_restaurantId_fkey'
    ) THEN
        ALTER TABLE "TableReservation" ADD CONSTRAINT "TableReservation_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

