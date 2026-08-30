import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prismaMain: PrismaClient | undefined;
  tenantCache: Map<string, PrismaClient> | undefined;
};

function getDatabaseUrl(): string {
  return (
    process.env.DATABASE_URL ||
    process.env.CONTROL_DATABASE_URL ||
    process.env.TENANT_DATABASE_URL ||
    "postgresql://postgres:postgres@localhost:5432/menuqr_pro?schema=public"
  );
}

export const prisma =
  globalForPrisma.prismaMain ??
  new PrismaClient({
    datasources: {
      db: {
        url: getDatabaseUrl(),
      },
    },
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

globalForPrisma.prismaMain = prisma;

export const prismaControl = prisma as any;
export const prismaTenant = prisma as any;

if (!globalForPrisma.tenantCache) {
  globalForPrisma.tenantCache = new Map<string, PrismaClient>();
}
const tenantCache = globalForPrisma.tenantCache;

export function getTenantClient(dbUrl?: string): PrismaClient {
  if (!dbUrl || dbUrl === getDatabaseUrl()) {
    return prisma;
  }

  const existing = tenantCache.get(dbUrl);
  if (existing) return existing;

  let url = dbUrl;
  if (!url.includes("connection_limit")) {
    const separator = url.includes("?") ? "&" : "?";
    url = `${url}${separator}connection_limit=3`;
  }

  const client = new PrismaClient({
    datasources: { db: { url } },
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

  tenantCache.set(dbUrl, client);
  return client;
}
