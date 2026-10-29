-- DropForeignKey
ALTER TABLE IF EXISTS "WhatsAppLog" DROP CONSTRAINT IF EXISTS "WhatsAppLog_sessionId_fkey";
ALTER TABLE IF EXISTS "WhatsAppLog" DROP CONSTRAINT IF EXISTS "WhatsAppLog_restaurantId_fkey";
ALTER TABLE IF EXISTS "WhatsAppSession" DROP CONSTRAINT IF EXISTS "WhatsAppSession_restaurantId_fkey";

-- DropTable
DROP TABLE IF EXISTS "WhatsAppLog";
DROP TABLE IF EXISTS "WhatsAppSession";
