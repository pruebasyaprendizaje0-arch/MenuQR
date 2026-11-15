import { NextResponse } from "next/server";
import { prismaTenant } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Endpoint de verificación de salud ultraliviano para Coolify y monitores de uptime.
 * 
 * Reglas de diseño:
 * 1. Por defecto NO toca la base de datos para responder en <10 ms incluso bajo congestión.
 * 2. Si se solicita ?deep=true o ?db=true, realiza un chequeo opcional de Postgres con timeout estricto.
 * 3. Soporta HEAD para monitores que solo solicitan cabeceras.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const checkDb = url.searchParams.get("deep") === "true" || url.searchParams.get("db") === "true";

  let databaseStatus = "skipped";
  if (checkDb) {
    try {
      // Timeout estricto de 2000 ms para evitar que el chequeo profundo cuelgue la respuesta
      await Promise.race([
        prismaTenant.$queryRaw`SELECT 1`,
        new Promise((_, reject) => setTimeout(() => reject(new Error("DB Timeout")), 2000)),
      ]);
      databaseStatus = "ok";
    } catch {
      databaseStatus = "unavailable";
    }
  }

  return NextResponse.json(
    {
      status: "ok",
      database: databaseStatus,
      uptime: Math.floor(process.uptime()),
      timestamp: Date.now(),
    },
    {
      status: 200,
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        "Content-Type": "application/json",
      },
    }
  );
}

export async function HEAD() {
  return new Response(null, {
    status: 200,
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
    },
  });
}
