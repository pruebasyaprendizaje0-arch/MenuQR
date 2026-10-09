import { Pool } from "pg";
import fs from "fs";
import path from "path";

const globalForPg = globalThis as unknown as {
  pgPool?: Pool;
  tablesInitialized?: boolean;
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
  try {
    const initSqlPath = path.join(process.cwd(), "init.sql");
    if (fs.existsSync(initSqlPath)) {
      const sqlContent = fs.readFileSync(initSqlPath, "utf-8");
      await pool.query(sqlContent);
    } else {
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
    }

    // Migraciones seguras para comensales en mesa abierta, llamada a mesero y cancelación de pedidos/platos
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
      CREATE INDEX IF NOT EXISTS idx_pedido_items_estado ON pedido_items(estado_item);

      ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS es_prueba BOOLEAN DEFAULT false;
      CREATE INDEX IF NOT EXISTS idx_pedidos_es_prueba ON pedidos(negocio_id, es_prueba);
    `);

    // Sincronizar negocios a partir de la tabla Restaurant de Prisma si existe
    await pool.query(`
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'Restaurant') THEN
          INSERT INTO negocios (id, nombre, slug, numero_mesas)
          SELECT 
            id::uuid, 
            name, 
            slug, 
            10
          FROM "Restaurant"
          WHERE id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
          ON CONFLICT (id) DO NOTHING;
        END IF;
      EXCEPTION
        WHEN OTHERS THEN
          -- Ignorar si la tabla Restaurant no tiene formato UUID en ID
          NULL;
      END $$;
    `);

    // Asegurar al menos 1 negocio de demostración o sincronizado si no hay ninguno
    const { rows: negocioRows } = await pool.query(`SELECT id FROM negocios LIMIT 1`);
    if (negocioRows.length === 0) {
      const { rows: inserted } = await pool.query(`
        INSERT INTO negocios (nombre, slug, numero_mesas)
        VALUES ('Restaurante Demo', 'demo', 12)
        RETURNING id
      `);
      if (inserted[0]?.id) {
        await pool.query(`
          INSERT INTO camareros (negocio_id, nombre, pin)
          VALUES 
            ($1, 'Carlos Gómez', '1234'),
            ($1, 'María López', '5678'),
            ($1, 'Andrés Torres', '0000')
        `, [inserted[0].id]);
      }
    } else {
      // Asegurar camareros para cada negocio existente si no tienen
      const { rows: allNegocios } = await pool.query(`SELECT id, nombre FROM negocios`);
      for (const neg of allNegocios) {
        const { rows: camCount } = await pool.query(`SELECT COUNT(*)::int as c FROM camareros WHERE negocio_id = $1`, [neg.id]);
        if (camCount[0]?.c === 0) {
          await pool.query(`
            INSERT INTO camareros (negocio_id, nombre, pin)
            VALUES 
              ($1, 'Mesero 1', '1234'),
              ($1, 'Mesero 2', '5678')
          `, [neg.id]);
        }
      }
    }

    globalForPg.tablesInitialized = true;
    console.log("[db-pool] Tablas de Cocina y Mesero verificadas con éxito en PostgreSQL.");
  } catch (err) {
    console.error("[db-pool] Error asegurando tablas de base de datos:", err);
  }
}
