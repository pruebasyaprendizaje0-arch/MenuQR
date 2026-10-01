-- CreateEnum
CREATE TYPE "WhatsAppBotState" AS ENUM ('MENU', 'AWAITING_ORDER_ID', 'IN_HUMAN_HANDOFF');

-- CreateTable
CREATE TABLE "WhatsAppSession" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT,
    "phone" TEXT NOT NULL,
    "remoteJid" TEXT NOT NULL,
    "customerName" TEXT,
    "state" "WhatsAppBotState" NOT NULL DEFAULT 'MENU',
    "fallbackCount" INTEGER NOT NULL DEFAULT 0,
    "humanHandoffUntil" TIMESTAMP(3),
    "lastInteractionAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WhatsAppSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WhatsAppLog" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT,
    "restaurantId" TEXT,
    "messageId" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "fromMe" BOOLEAN NOT NULL DEFAULT false,
    "phone" TEXT NOT NULL,
    "text" TEXT,
    "rawPayload" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WhatsAppLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WhatsAppSession_remoteJid_idx" ON "WhatsAppSession"("remoteJid");

-- CreateIndex
CREATE INDEX "WhatsAppSession_phone_idx" ON "WhatsAppSession"("phone");

-- CreateIndex
CREATE INDEX "WhatsAppSession_restaurantId_idx" ON "WhatsAppSession"("restaurantId");

-- CreateIndex
CREATE UNIQUE INDEX "WhatsAppSession_phone_restaurantId_key" ON "WhatsAppSession"("phone", "restaurantId");

-- CreateIndex
CREATE UNIQUE INDEX "WhatsAppLog_messageId_key" ON "WhatsAppLog"("messageId");

-- CreateIndex
CREATE INDEX "WhatsAppLog_messageId_idx" ON "WhatsAppLog"("messageId");

-- CreateIndex
CREATE INDEX "WhatsAppLog_phone_idx" ON "WhatsAppLog"("phone");

-- CreateIndex
CREATE INDEX "WhatsAppLog_restaurantId_idx" ON "WhatsAppLog"("restaurantId");

-- AddForeignKey
ALTER TABLE "WhatsAppSession" ADD CONSTRAINT "WhatsAppSession_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsAppLog" ADD CONSTRAINT "WhatsAppLog_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "WhatsAppSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsAppLog" ADD CONSTRAINT "WhatsAppLog_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "Restaurant" ADD COLUMN IF NOT EXISTS "whatsappBotEnabled" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE IF NOT EXISTS "WhatsAppInstance" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "instanceName" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'close',
    "qrcode" TEXT,
    "pairingCode" TEXT,
    "ownerJid" TEXT,
    "profileName" TEXT,
    "profilePicture" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WhatsAppInstance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "WhatsAppInstance_restaurantId_key" ON "WhatsAppInstance"("restaurantId");
CREATE UNIQUE INDEX IF NOT EXISTS "WhatsAppInstance_instanceName_key" ON "WhatsAppInstance"("instanceName");
CREATE INDEX IF NOT EXISTS "WhatsAppInstance_restaurantId_idx" ON "WhatsAppInstance"("restaurantId");
CREATE INDEX IF NOT EXISTS "WhatsAppInstance_instanceName_idx" ON "WhatsAppInstance"("instanceName");

-- AddForeignKey
ALTER TABLE "WhatsAppInstance" ADD CONSTRAINT "WhatsAppInstance_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;


