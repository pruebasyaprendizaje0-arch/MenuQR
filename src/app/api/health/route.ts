import { prismaTenant } from "@/lib/db";

export const dynamic = "force-dynamic";

/** Lightweight readiness endpoint for Coolify and uptime monitors. */
export async function GET() {
  try {
    await prismaTenant.$queryRaw`SELECT 1`;

    return Response.json(
      { status: "ok", database: "ok" },
      {
        status: 200,
        headers: { "Cache-Control": "no-store" },
      }
    );
  } catch {
    // Do not expose connection details or environment information publicly.
    return Response.json(
      { status: "degraded", database: "unavailable" },
      {
        status: 503,
        headers: { "Cache-Control": "no-store" },
      }
    );
  }
}
