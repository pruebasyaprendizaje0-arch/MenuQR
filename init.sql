-- init.sql
-- MenuQR Pro - Módulo Cocina + Mesero con Mesa Abierta

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

-- Índices optimizados para tiempo real y agrupaciones diarias
CREATE INDEX IF NOT EXISTS idx_pedidos_negocio_estado ON pedidos(negocio_id, estado);
CREATE INDEX IF NOT EXISTS idx_pedidos_mesa_estado ON pedidos(negocio_id, mesa, estado);
CREATE INDEX IF NOT EXISTS idx_pedidos_camarero_fecha ON pedidos(camarero_id, created_at);
CREATE INDEX IF NOT EXISTS idx_pedido_items_pedido ON pedido_items(pedido_id);
