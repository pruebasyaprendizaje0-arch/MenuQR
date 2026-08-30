import { PrismaClient as PrismaControlClient } from "@prisma/control";
import { PrismaClient as PrismaTenantClient } from "@prisma/tenant";

const globalForPrisma = globalThis as unknown as {
  prismaControl: PrismaControlClient | undefined;
  prismaTenant: PrismaTenantClient | undefined;
  tenantCache: Map<string, PrismaTenantClient> | undefined;
};

// --- CLIENTE CONTROL (BD Global / Admin) ---
function getControlDatabaseUrl(): string {
  return (
    process.env.CONTROL_DATABASE_URL ||
    process.env.DATABASE_URL_CONTROL ||
    process.env.DATABASE_URL ||
    "postgresql://postgres:postgres@localhost:5432/menuqr_control?schema=public"
  );
}

export const prismaControl =
  globalForPrisma.prismaControl ??
  new PrismaControlClient({
    datasources: {
      db: {
        url: getControlDatabaseUrl(),
      },
    },
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prismaControl = prismaControl;
}

// --- CLIENTE TENANT (BD Inquilino / Restaurante por defecto) ---
function getTenantDatabaseUrl(): string {
  return (
    process.env.TENANT_DATABASE_URL ||
    process.env.DATABASE_URL_TENANT ||
    process.env.DATABASE_URL ||
    "postgresql://postgres:postgres@localhost:5432/menuqr_tenant?schema=public"
  );
}

export const prismaTenant =
  globalForPrisma.prismaTenant ??
  new PrismaTenantClient({
    datasources: {
      db: {
        url: getTenantDatabaseUrl(),
      },
    },
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prismaTenant = prismaTenant;
}

// --- CLIENTES DINÁMICOS POR INQUILINO (OPCIONAL EN PRODUCCIÓN MULTI-BD) ---
if (!globalForPrisma.tenantCache) {
  globalForPrisma.tenantCache = new Map<string, PrismaTenantClient>();
}
const tenantCache = globalForPrisma.tenantCache;

export function getTenantClient(dbUrl?: string): PrismaTenantClient {
  if (!dbUrl) {
    return prismaTenant;
  }

  const existing = tenantCache.get(dbUrl);
  if (existing) return existing;

  let url = dbUrl;
  if (!url.includes("connection_limit")) {
    const separator = url.includes("?") ? "&" : "?";
    url = `${url}${separator}connection_limit=3`;
  }

  const client = new PrismaTenantClient({
    datasources: { db: { url } },
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

  tenantCache.set(dbUrl, client);
  return client;
}

// Retrocompatibilidad con importaciones previas
export const prisma = prismaTenant;
