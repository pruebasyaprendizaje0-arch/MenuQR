import { Pool } from "pg";

const globalForPg = globalThis as unknown as {
  pgPool?: Pool;
  tablesInitialized?: boolean;
  initializationPromise?: Promise<void> | null;
};

function getConnectionString(): string {
  return (
    process.env.DATABASE_URL ||
    process.env.CONTROL_DATABASE_URL ||
    process.env.TENANT_DATABASE_URL ||
    "postgresql://postgres:postgres@localhost:5432/menuqr_pro?schema=public"
  );
}

export const pool: Pool =
  globalForPg.pgPool ??
  new Pool({
    connectionString: getConnectionString(),
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  });

if (process.env.NODE_ENV !== "production") {
  globalForPg.pgPool = pool;
}

export async function ensureDbTables(): Promise<void> {
  // 1. Si ya se inicializó exitosamente en memoria, retornar inmediatamente sin tocar PostgreSQL
  if (globalForPg.tablesInitialized) {
    return Promise.resolve();
  }

  // 2. Si ya hay una inicialización concurrente en curso, esperar esa misma promesa (patrón Singleton)
  if (globalForPg.initializationPromise) {
    return globalForPg.initializationPromise;
  }

  // 3. Crear promesa compartida para resolver de forma atómica y neutralizar contención de locks DDL
  globalForPg.initializationPromise = (async () => {
    try {
      await pool.query(`
        CREATE EXTENSION IF NOT EXISTS "pgcrypto";

        CREATE TABLE IF NOT EXISTS negocios (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          nombre VARCHAR(200) NOT NULL,
          slug VARCHAR(200) UNIQUE,
          numero_mesas INT DEFAULT 10,
          created_at TIMESTAMPTZ DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS camareros (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          negocio_id UUID REFERENCES negocios(id) ON DELETE CASCADE,
          nombre VARCHAR(100) NOT NULL,
          pin VARCHAR(10),
          rol VARCHAR(20) DEFAULT 'MESERO',
          telefono VARCHAR(50),
          activo BOOLEAN DEFAULT true,
          created_at TIMESTAMPTZ DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS pedidos (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          negocio_id UUID REFERENCES negocios(id),
          mesa VARCHAR(20),
          estado VARCHAR(20) DEFAULT 'nuevo',
          camarero_id UUID REFERENCES camareros(id),
          total DECIMAL(10,2) DEFAULT 0,
          created_at TIMESTAMPTZ DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS pedido_items (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          pedido_id UUID REFERENCES pedidos(id) ON DELETE CASCADE,
          nombre VARCHAR(200),
          cantidad INT,
          precio DECIMAL(10,2),
          notas TEXT,
          es_añadido BOOLEAN DEFAULT false,
          estado_item VARCHAR(20) DEFAULT 'nuevo'
        );

        CREATE INDEX IF NOT EXISTS idx_pedidos_negocio_estado ON pedidos(negocio_id, estado);
        CREATE INDEX IF NOT EXISTS idx_pedidos_mesa_estado ON pedidos(negocio_id, mesa, estado);
        CREATE INDEX IF NOT EXISTS idx_pedidos_camarero_fecha ON pedidos(camarero_id, created_at);
        CREATE INDEX IF NOT EXISTS idx_pedido_items_pedido ON pedido_items(pedido_id);
      `);

      // Migraciones estructurales idempotentes para columnas de mesa abierta, cancelación y multi-rol
      await pool.query(`
        ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS cliente_nombre VARCHAR(200);
        ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS cliente_telefono VARCHAR(50);
        ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS solicita_mesero BOOLEAN DEFAULT false;
        ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS motivo_cancelacion VARCHAR(255);
        ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS cancelado_por VARCHAR(50);
        ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS cancelado_at TIMESTAMPTZ;

        ALTER TABLE pedido_items ADD COLUMN IF NOT EXISTS motivo_cancelacion VARCHAR(255);
        ALTER TABLE pedido_items ADD COLUMN IF NOT EXISTS cancelado_por VARCHAR(50);
        ALTER TABLE pedido_items ADD COLUMN IF NOT EXISTS cancelado_at TIMESTAMPTZ;
        ALTER TABLE pedido_items ADD COLUMN IF NOT EXISTS producto_id VARCHAR(50);
        ALTER TABLE pedido_items ADD COLUMN IF NOT EXISTS unidades_descontadas INT;
        ALTER TABLE pedido_items ALTER COLUMN unidades_descontadas DROP DEFAULT;
        CREATE INDEX IF NOT EXISTS idx_pedido_items_estado ON pedido_items(estado_item);
        CREATE INDEX IF NOT EXISTS idx_pedido_items_producto ON pedido_items(producto_id);

        ALTER TABLE "OrderItem" ADD COLUMN IF NOT EXISTS "dishId" TEXT;
        ALTER TABLE "OrderItem" ADD COLUMN IF NOT EXISTS "unitsDeducted" INT;
        CREATE INDEX IF NOT EXISTS "OrderItem_dishId_idx" ON "OrderItem"("dishId");

        ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS es_prueba BOOLEAN DEFAULT false;
        ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS vertical VARCHAR(50) DEFAULT 'menuqr';
        ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';
        CREATE INDEX IF NOT EXISTS idx_pedidos_es_prueba ON pedidos(negocio_id, es_prueba);
        CREATE INDEX IF NOT EXISTS idx_pedidos_vertical ON pedidos(vertical);

        -- Soporte multi-rol para equipo: Meseros, Cajeros y Repartidores
        ALTER TABLE camareros ADD COLUMN IF NOT EXISTS rol VARCHAR(20) DEFAULT 'MESERO';
        ALTER TABLE camareros ADD COLUMN IF NOT EXISTS telefono VARCHAR(50);
        CREATE INDEX IF NOT EXISTS idx_camareros_rol ON camareros(negocio_id, rol);

        -- Soporte para hash seguro bcrypt de PINs (60 caracteres)
        ALTER TABLE camareros ALTER COLUMN pin TYPE VARCHAR(255);
      `);

      globalForPg.tablesInitialized = true;
      console.log("[db-pool] Tablas de Cocina y Mesero verificadas con éxito en PostgreSQL.");
    } catch (err) {
      globalForPg.initializationPromise = null;
      console.error("[db-pool] Error asegurando tablas de base de datos:", err);
    }
  })();

  return globalForPg.initializationPromise;
}
