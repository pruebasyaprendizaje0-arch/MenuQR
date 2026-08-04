-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Restaurant" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL DEFAULT 'admin@admin.com',
    "logoUrl" TEXT,
    "paymentQrUrl" TEXT,
    "whatsappNumber" TEXT NOT NULL,
    "themeColor" TEXT NOT NULL DEFAULT '#f59e0b',
    "password" TEXT NOT NULL DEFAULT 'admin123',
    "trialEndsAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Restaurant" ("createdAt", "id", "logoUrl", "name", "password", "paymentQrUrl", "slug", "themeColor", "updatedAt", "whatsappNumber") SELECT "createdAt", "id", "logoUrl", "name", "password", "paymentQrUrl", "slug", "themeColor", "updatedAt", "whatsappNumber" FROM "Restaurant";
DROP TABLE "Restaurant";
ALTER TABLE "new_Restaurant" RENAME TO "Restaurant";
CREATE UNIQUE INDEX "Restaurant_slug_key" ON "Restaurant"("slug");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
