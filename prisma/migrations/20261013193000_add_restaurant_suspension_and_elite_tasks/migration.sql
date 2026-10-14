-- AlterTable
ALTER TABLE "Restaurant" ADD COLUMN IF NOT EXISTS "isSuspended" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Restaurant" ADD COLUMN IF NOT EXISTS "suspendedReason" TEXT;
ALTER TABLE "Restaurant" ADD COLUMN IF NOT EXISTS "lastMaintenanceAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE IF NOT EXISTS "EliteTask" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "requestType" TEXT NOT NULL DEFAULT 'CARGA_MENU',
    "priority" TEXT NOT NULL DEFAULT 'MEDIA',
    "status" TEXT NOT NULL DEFAULT 'PENDIENTE',
    "dueDate" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EliteTask_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "EliteTask_restaurantId_status_idx" ON "EliteTask"("restaurantId", "status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "EliteTask_status_priority_idx" ON "EliteTask"("status", "priority");

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'EliteTask_restaurantId_fkey'
    ) THEN
        ALTER TABLE "EliteTask" ADD CONSTRAINT "EliteTask_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
