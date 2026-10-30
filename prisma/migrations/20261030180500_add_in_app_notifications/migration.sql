-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('WARNING_EXPIRING', 'SUSPENDED', 'METRIC_SUMMARY', 'MAINTENANCE', 'PROMO', 'INFO');

-- CreateEnum
CREATE TYPE "NotificationPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');

-- CreateTable
CREATE TABLE "InAppNotification" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT,
    "type" "NotificationType" NOT NULL DEFAULT 'INFO',
    "priority" "NotificationPriority" NOT NULL DEFAULT 'NORMAL',
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "actionUrl" TEXT,
    "actionLabel" TEXT,
    "metadata" JSONB,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "readAt" TIMESTAMP(3),
    "dismissedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "source" TEXT NOT NULL DEFAULT 'N8N',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InAppNotification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InAppNotificationRead" (
    "id" TEXT NOT NULL,
    "notificationId" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "readAt" TIMESTAMP(3),
    "isDismissed" BOOLEAN NOT NULL DEFAULT false,
    "dismissedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InAppNotificationRead_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InAppNotification_restaurantId_isRead_createdAt_idx" ON "InAppNotification"("restaurantId", "isRead", "createdAt");

-- CreateIndex
CREATE INDEX "InAppNotification_restaurantId_expiresAt_idx" ON "InAppNotification"("restaurantId", "expiresAt");

-- CreateIndex
CREATE INDEX "InAppNotification_type_priority_idx" ON "InAppNotification"("type", "priority");

-- CreateIndex
CREATE INDEX "InAppNotification_createdAt_idx" ON "InAppNotification"("createdAt");

-- CreateIndex
CREATE INDEX "InAppNotificationRead_restaurantId_isDismissed_idx" ON "InAppNotificationRead"("restaurantId", "isDismissed");

-- CreateIndex
CREATE UNIQUE INDEX "InAppNotificationRead_notificationId_restaurantId_key" ON "InAppNotificationRead"("notificationId", "restaurantId");

-- AddForeignKey
ALTER TABLE "InAppNotification" ADD CONSTRAINT "InAppNotification_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InAppNotificationRead" ADD CONSTRAINT "InAppNotificationRead_notificationId_fkey" FOREIGN KEY ("notificationId") REFERENCES "InAppNotification"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InAppNotificationRead" ADD CONSTRAINT "InAppNotificationRead_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
