-- AlterTable
ALTER TABLE "Order" ADD COLUMN "seasonRateName" TEXT,
ADD COLUMN "seasonRateAmount" DOUBLE PRECISION NOT NULL DEFAULT 0.0;

-- CreateTable
CREATE TABLE "SeasonRate" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "percentageBonus" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "fixedBonus" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "isHoliday" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SeasonRate_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "SeasonRate" ADD CONSTRAINT "SeasonRate_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
