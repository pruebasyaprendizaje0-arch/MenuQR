-- CreateEnum
CREATE TYPE "CampaignType" AS ENUM ('PROMO', 'EVENT', 'ACTIVITY');

-- CreateEnum
CREATE TYPE "CampaignDiscountType" AS ENUM ('PERCENTAGE', 'FIXED_PRICE', 'DEAL_2X1', 'CUSTOM');

-- CreateTable
CREATE TABLE "BusinessCampaign" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "type" "CampaignType" NOT NULL DEFAULT 'PROMO',
    "badgeText" TEXT DEFAULT 'Promo Semanal',
    "description" TEXT,
    "imageUrl" TEXT,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "eventDate" TIMESTAMP(3),
    "startTime" TEXT,
    "endTime" TEXT,
    "daysOfWeek" TEXT,
    "discountType" "CampaignDiscountType" NOT NULL DEFAULT 'PERCENTAGE',
    "discountValue" DOUBLE PRECISION DEFAULT 0.0,
    "ctaType" TEXT NOT NULL DEFAULT 'WHATSAPP',
    "ctaText" TEXT DEFAULT 'Aprovechar por WhatsApp',
    "whatsappMessage" TEXT,
    "externalUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "showInProfile" BOOLEAN NOT NULL DEFAULT true,
    "showInCatalog" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BusinessCampaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CampaignDish" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "dishId" TEXT NOT NULL,
    "promoPrice" DOUBLE PRECISION,
    "promoLabel" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CampaignDish_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BusinessCampaign_restaurantId_isActive_idx" ON "BusinessCampaign"("restaurantId", "isActive");

-- CreateIndex
CREATE INDEX "BusinessCampaign_restaurantId_type_idx" ON "BusinessCampaign"("restaurantId", "type");

-- CreateIndex
CREATE INDEX "BusinessCampaign_endDate_idx" ON "BusinessCampaign"("endDate");

-- CreateIndex
CREATE INDEX "CampaignDish_campaignId_idx" ON "CampaignDish"("campaignId");

-- CreateIndex
CREATE INDEX "CampaignDish_dishId_idx" ON "CampaignDish"("dishId");

-- CreateIndex
CREATE UNIQUE INDEX "CampaignDish_campaignId_dishId_key" ON "CampaignDish"("campaignId", "dishId");

-- AddForeignKey
ALTER TABLE "BusinessCampaign" ADD CONSTRAINT "BusinessCampaign_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignDish" ADD CONSTRAINT "CampaignDish_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "BusinessCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignDish" ADD CONSTRAINT "CampaignDish_dishId_fkey" FOREIGN KEY ("dishId") REFERENCES "Dish"("id") ON DELETE CASCADE ON UPDATE CASCADE;
