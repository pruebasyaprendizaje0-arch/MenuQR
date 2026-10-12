-- AlterTable
ALTER TABLE "Dish" ADD COLUMN IF NOT EXISTS "isSuggested" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Dish_isSuggested_isAvailable_idx" ON "Dish"("isSuggested", "isAvailable");
