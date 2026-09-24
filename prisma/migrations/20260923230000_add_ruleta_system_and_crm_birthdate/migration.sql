-- AlterTable: Add birthDate to Customer
ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "birthDate" TEXT;

-- CreateTable: RuletaConfig
CREATE TABLE IF NOT EXISTS "RuletaConfig" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "titulo" TEXT NOT NULL DEFAULT '¡Gira la Ruleta y Gana!',
    "descripcion" TEXT NOT NULL DEFAULT 'Prueba tu suerte y obtén un premio exclusivo para tu consumo hoy.',
    "colorPrimario" TEXT NOT NULL DEFAULT '#111827',
    "colorSecundario" TEXT NOT NULL DEFAULT '#ef4444',
    "colorFondo" TEXT NOT NULL DEFAULT '#0f172a',
    "premios" TEXT NOT NULL,
    "limiteDiasReGiro" INTEGER NOT NULL DEFAULT 30,
    "maxGirosIpDia" INTEGER NOT NULL DEFAULT 5,
    "expiracionHoras" INTEGER NOT NULL DEFAULT 24,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RuletaConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable: RuletaGiro
CREATE TABLE IF NOT EXISTS "RuletaGiro" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "telefono" TEXT NOT NULL,
    "nombreCliente" TEXT,
    "fechaNacimiento" TEXT,
    "premioId" TEXT NOT NULL,
    "premioLabel" TEXT NOT NULL,
    "premioTipo" TEXT DEFAULT 'descuento',
    "premioValor" DOUBLE PRECISION DEFAULT 0.0,
    "codigoCupon" TEXT NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'PENDIENTE',
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "fechaGiro" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fechaCanjeo" TIMESTAMP(3),
    "fechaExpiracion" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RuletaGiro_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "RuletaConfig_restaurantId_key" ON "RuletaConfig"("restaurantId");
CREATE INDEX IF NOT EXISTS "RuletaConfig_restaurantId_activa_idx" ON "RuletaConfig"("restaurantId", "activa");

CREATE UNIQUE INDEX IF NOT EXISTS "RuletaGiro_codigoCupon_key" ON "RuletaGiro"("codigoCupon");
CREATE INDEX IF NOT EXISTS "RuletaGiro_restaurantId_telefono_idx" ON "RuletaGiro"("restaurantId", "telefono");
CREATE INDEX IF NOT EXISTS "RuletaGiro_restaurantId_estado_idx" ON "RuletaGiro"("restaurantId", "estado");
CREATE INDEX IF NOT EXISTS "RuletaGiro_codigoCupon_idx" ON "RuletaGiro"("codigoCupon");
CREATE INDEX IF NOT EXISTS "RuletaGiro_telefono_idx" ON "RuletaGiro"("telefono");
CREATE INDEX IF NOT EXISTS "RuletaGiro_ipAddress_fechaGiro_idx" ON "RuletaGiro"("ipAddress", "fechaGiro");

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'RuletaConfig_restaurantId_fkey') THEN
        ALTER TABLE "RuletaConfig" ADD CONSTRAINT "RuletaConfig_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'RuletaGiro_restaurantId_fkey') THEN
        ALTER TABLE "RuletaGiro" ADD CONSTRAINT "RuletaGiro_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
