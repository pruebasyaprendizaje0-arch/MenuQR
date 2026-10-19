import { NextRequest, NextResponse } from "next/server";
import { pool, ensureDbTables } from "@/lib/db-pool";

export const dynamic = "force-dynamic";

// GET /api/citas/disponibilidad?negocio_id=...&slug=...&fecha=YYYY-MM-DD&especialista_id=...
export async function GET(req: NextRequest) {
  try {
    await ensureDbTables();

    const { searchParams } = new URL(req.url);
    const negocioId = searchParams.get("negocio_id");
    const slug = searchParams.get("slug");
    const fecha = searchParams.get("fecha") || new Date().toISOString().split("T")[0];
    const especialistaId = searchParams.get("especialista_id");
    const especialistaNombre = searchParams.get("especialista_nombre");

    let resolvedNegocioId = negocioId;

    if (!resolvedNegocioId && slug) {
      const { rows: negRows } = await pool.query(
        "SELECT id FROM negocios WHERE slug = $1 LIMIT 1",
        [slug.toLowerCase().trim()]
      );
      if (negRows[0]) {
        resolvedNegocioId = negRows[0].id;
      } else {
        const { rows: restRows } = await pool.query(
          `SELECT id FROM "Restaurant" WHERE slug = $1 LIMIT 1`,
          [slug.toLowerCase().trim()]
        );
        if (restRows[0]) resolvedNegocioId = restRows[0].id;
      }
    }

    if (!resolvedNegocioId) {
      return NextResponse.json({ ok: true, horarios_ocupados: [] });
    }

    let query = `
      SELECT 
        id,
        metadata->>'hora_cita' as hora,
        metadata->>'duracion_min' as duracion,
        metadata->>'especialista_id' as especialista_id,
        metadata->>'especialista_nombre' as especialista_nombre,
        estado
      FROM pedidos
      WHERE negocio_id = $1 
        AND vertical = 'citas'
        AND metadata->>'fecha_cita' = $2
        AND estado NOT IN ('cancelada')
    `;

    const params: any[] = [resolvedNegocioId, fecha];

    // Si se especifica un especialista concreto (distinto de "any" o "Cualquier especialista")
    if (especialistaId && especialistaId !== "any" && especialistaId !== "default") {
      params.push(especialistaId);
      query += ` AND metadata->>'especialista_id' = $${params.length}`;
    } else if (especialistaNombre && !especialistaNombre.toLowerCase().includes("cualquier")) {
      params.push(especialistaNombre);
      query += ` AND metadata->>'especialista_nombre' = $${params.length}`;
    }

    const { rows: bookedRows } = await pool.query(query, params);

    const horariosOcupados = bookedRows
      .map((r) => r.hora)
      .filter((h): h is string => Boolean(h));

    return NextResponse.json({
      ok: true,
      fecha,
      horarios_ocupados: horariosOcupados,
      total_citas_dia: bookedRows.length,
      citas: bookedRows,
    });
  } catch (err: any) {
    console.error("[GET /api/citas/disponibilidad] Error:", err);
    return NextResponse.json(
      { ok: false, error: err.message || "Error al consultar disponibilidad" },
      { status: 500 }
    );
  }
}
