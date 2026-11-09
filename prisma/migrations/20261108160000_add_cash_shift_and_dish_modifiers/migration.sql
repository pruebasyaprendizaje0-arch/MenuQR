-- CreateEnum
CREATE TYPE "ShiftStatus" AS ENUM ('OPEN', 'CLOSED');

-- CreateEnum
CREATE TYPE "MovementType" AS ENUM ('CASH_IN', 'CASH_OUT');

-- CreateEnum
CREATE TYPE "VatRate" AS ENUM ('ZERO', 'STANDARD', 'EXEMPT');

-- AlterTable Dish
ALTER TABLE "Dish" ADD COLUMN "vatRate" "VatRate" NOT NULL DEFAULT 'STANDARD',
ADD COLUMN "hasIce" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable Order
ALTER TABLE "Order" ADD COLUMN "cashShiftId" TEXT;

-- CreateTable DishModifierGroup
CREATE TABLE "DishModifierGroup" (
    "id" TEXT NOT NULL,
    "dishId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "minSelect" INTEGER NOT NULL DEFAULT 0,
    "maxSelect" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DishModifierGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable DishModifierOption
CREATE TABLE "DishModifierOption" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "extraPrice" DECIMAL(10,2) NOT NULL DEFAULT 0.0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DishModifierOption_pkey" PRIMARY KEY ("id")
);

-- CreateTable CashShift
CREATE TABLE "CashShift" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "openedById" TEXT NOT NULL,
    "openedByName" TEXT NOT NULL,
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedById" TEXT,
    "closedByName" TEXT,
    "closedAt" TIMESTAMP(3),
    "initialCash" DECIMAL(10,2) NOT NULL DEFAULT 0.0,
    "expectedCash" DECIMAL(10,2) NOT NULL DEFAULT 0.0,
    "actualCash" DECIMAL(10,2),
    "difference" DECIMAL(10,2),
    "totalCash" DECIMAL(10,2) NOT NULL DEFAULT 0.0,
    "totalCard" DECIMAL(10,2) NOT NULL DEFAULT 0.0,
    "totalTransfer" DECIMAL(10,2) NOT NULL DEFAULT 0.0,
    "totalDeuna" DECIMAL(10,2) NOT NULL DEFAULT 0.0,
    "totalSales" DECIMAL(10,2) NOT NULL DEFAULT 0.0,
    "status" "ShiftStatus" NOT NULL DEFAULT 'OPEN',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CashShift_pkey" PRIMARY KEY ("id")
);

-- CreateTable CashMovement
CREATE TABLE "CashMovement" (
    "id" TEXT NOT NULL,
    "shiftId" TEXT NOT NULL,
    "type" "MovementType" NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "reason" TEXT NOT NULL,
    "performedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CashMovement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DishModifierGroup_dishId_idx" ON "DishModifierGroup"("dishId");

-- CreateIndex
CREATE INDEX "DishModifierOption_groupId_idx" ON "DishModifierOption"("groupId");

-- CreateIndex
CREATE INDEX "CashShift_restaurantId_status_idx" ON "CashShift"("restaurantId", "status");

-- CreateIndex
CREATE INDEX "CashMovement_shiftId_idx" ON "CashMovement"("shiftId");

-- CreateIndex
CREATE INDEX "Order_cashShiftId_idx" ON "Order"("cashShiftId");

-- AddForeignKey
ALTER TABLE "DishModifierGroup" ADD CONSTRAINT "DishModifierGroup_dishId_fkey" FOREIGN KEY ("dishId") REFERENCES "Dish"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DishModifierOption" ADD CONSTRAINT "DishModifierOption_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "DishModifierGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashShift" ADD CONSTRAINT "CashShift_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashMovement" ADD CONSTRAINT "CashMovement_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "CashShift"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_cashShiftId_fkey" FOREIGN KEY ("cashShiftId") REFERENCES "CashShift"("id") ON DELETE SET NULL ON UPDATE CASCADE;

