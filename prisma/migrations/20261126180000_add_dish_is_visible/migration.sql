-- AlterTable
ALTER TABLE "Dish" ADD COLUMN IF NOT EXISTS "isVisible" BOOLEAN NOT NULL DEFAULT true;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Dish_categoryId_isVisible_idx" ON "Dish"("categoryId", "isVisible");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Dish_restaurantId_isVisible_idx" ON "Dish"("restaurantId", "isVisible");
