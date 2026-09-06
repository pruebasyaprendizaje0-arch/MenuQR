-- AlterTable
ALTER TABLE "Restaurant" ADD COLUMN     "googleBusinessUrl" TEXT,
ADD COLUMN     "priceRange" TEXT DEFAULT '$$',
ADD COLUMN     "structuredSchedule" TEXT;
