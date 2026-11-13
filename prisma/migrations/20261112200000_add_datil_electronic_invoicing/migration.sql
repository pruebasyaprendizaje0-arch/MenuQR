-- AlterTable Order
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "invoiceStatus" TEXT,
ADD COLUMN IF NOT EXISTS "invoiceAccessKey" TEXT,
ADD COLUMN IF NOT EXISTS "invoiceAuthNumber" TEXT,
ADD COLUMN IF NOT EXISTS "invoiceAuthDate" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "invoiceSequential" TEXT,
ADD COLUMN IF NOT EXISTS "invoiceRideUrl" TEXT,
ADD COLUMN IF NOT EXISTS "invoiceXmlUrl" TEXT,
ADD COLUMN IF NOT EXISTS "invoiceCustomerDoc" TEXT,
ADD COLUMN IF NOT EXISTS "invoiceCustomerDocType" TEXT,
ADD COLUMN IF NOT EXISTS "invoiceCustomerEmail" TEXT,
ADD COLUMN IF NOT EXISTS "invoiceCustomerAddress" TEXT,
ADD COLUMN IF NOT EXISTS "invoiceErrorMessage" TEXT;

-- CreateTable DatilConfig
CREATE TABLE IF NOT EXISTS "DatilConfig" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT false,
    "environment" TEXT NOT NULL DEFAULT 'TEST',
    "apiKey" TEXT NOT NULL,
    "apiPasswordEncrypted" TEXT NOT NULL,
    "ruc" TEXT NOT NULL,
    "razonSocial" TEXT NOT NULL,
    "nombreComercial" TEXT,
    "direccionMatriz" TEXT NOT NULL,
    "direccionEstablecimiento" TEXT,
    "regimen" TEXT NOT NULL DEFAULT 'GENERAL',
    "obligadoContabilidad" BOOLEAN NOT NULL DEFAULT false,
    "contribuyenteEspecial" TEXT,
    "establecimiento" TEXT NOT NULL DEFAULT '001',
    "puntoEmision" TEXT NOT NULL DEFAULT '001',
    "secuencialFactura" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DatilConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "DatilConfig_restaurantId_key" ON "DatilConfig"("restaurantId");
CREATE INDEX IF NOT EXISTS "DatilConfig_restaurantId_idx" ON "DatilConfig"("restaurantId");

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'DatilConfig_restaurantId_fkey'
    ) THEN
        ALTER TABLE "DatilConfig" ADD CONSTRAINT "DatilConfig_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
