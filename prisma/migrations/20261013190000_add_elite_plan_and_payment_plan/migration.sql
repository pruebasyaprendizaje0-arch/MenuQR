-- AlterEnum
ALTER TYPE "Plan" ADD VALUE 'ELITE';

-- AlterTable
ALTER TABLE "ManualSubscriptionPayment" ADD COLUMN "plan" "Plan" NOT NULL DEFAULT 'PRO';
