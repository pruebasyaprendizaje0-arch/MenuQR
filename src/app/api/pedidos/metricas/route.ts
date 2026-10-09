import { NextRequest, NextResponse } from "next/server";
import { pool, ensureDbTables } from "@/lib/db-pool";

export const dynamic = "force-dynamic";

// GET /api/pedidos/metricas?negocio_id=...
export async function GET(req: NextRequest) {
  try {
    await ensureDbTables();

    const { searchParams } = new URL(req.url);
    const negocioId = searchParams.get("negocio_id");

    if (!negocioId) {
      return NextResponse.json(
        { ok: false, error: "negocio_id es obligatorio" },
        { status: 400 }
      );
    }

    let testMode = true;
    try {
      const { rows: restRows } = await pool.query(
        `SELECT "testMode" FROM "Restaurant" WHERE id = $1 LIMIT 1`,
        [negocioId]
      );
      if (restRows[0] && restRows[0].testMode === false) {
        testMode = false;
      }
    } catch {}

    const filterPrueba = !testMode ? "AND (p.es_prueba IS FALSE OR p.es_prueba IS NULL)" : "";

    const { rows: metricas } = await pool.query(
      `SELECT 
        c.id as camarero_id,
        c.nombre as camarero_nombre,
        COUNT(DISTINCT CASE WHEN p.id IS NOT NULL THEN p.mesa END)::int as mesas_atendidas,
        COALESCE(SUM(p.total), 0)::float as total_vendido,
        CASE 
          WHEN COUNT(p.id) > 0 THEN ROUND((COALESCE(SUM(p.total), 0) / COUNT(p.id))::numeric, 2)::float
          ELSE 0::float 
        END as ticket_promedio
      FROM camareros c
      LEFT JOIN pedidos p ON p.camarero_id = c.id 
        AND p.negocio_id = $1 
        AND p.estado != 'cancelado'
        ${filterPrueba}
        AND DATE(p.created_at) = CURRENT_DATE
      WHERE c.negocio_id = $1
      GROUP BY c.id, c.nombre
      ORDER BY total_vendido DESC, camarero_nombre ASC`,
      [negocioId]
    );

    return NextResponse.json({
      ok: true,
      fecha: new Date().toISOString().split("T")[0],
      metricas,
    });
  } catch (err: any) {
    console.error("[GET /api/pedidos/metricas] Error:", err);
    return NextResponse.json(
      { ok: false, error: err.message || "Error al obtener métricas" },
      { status: 500 }
    );
  }
}
