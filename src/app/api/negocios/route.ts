import { NextRequest, NextResponse } from "next/server";
import { pool, ensureDbTables } from "@/lib/db-pool";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    await ensureDbTables();

    const { searchParams } = new URL(req.url);
    const slug = searchParams.get("slug");

    if (slug) {
      const { rows } = await pool.query(
        "SELECT id, nombre, slug, numero_mesas, created_at FROM negocios WHERE slug = $1 LIMIT 1",
        [slug]
      );
      if (rows.length > 0) {
        return NextResponse.json({ ok: true, negocio: rows[0] });
      }
    }

    const cookieStore = await cookies();
    const activeRestId = cookieStore.get("active_restaurant_id")?.value;

    const { rows: negocios } = await pool.query(
      "SELECT id, nombre, slug, numero_mesas, created_at FROM negocios ORDER BY nombre ASC"
    );

    return NextResponse.json({
      ok: true,
      negocios,
      active_id: activeRestId || (negocios[0]?.id ?? null),
    });
  } catch (err: any) {
    console.error("[GET /api/negocios] Error:", err);
    return NextResponse.json(
      { ok: false, error: err.message || "Error al obtener negocios" },
      { status: 500 }
    );
  }
}
