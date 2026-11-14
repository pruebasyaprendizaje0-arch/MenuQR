import { NextRequest, NextResponse } from "next/server";
import { pool, ensureDbTables } from "@/lib/db-pool";

export const dynamic = "force-dynamic";

/**
 * GET /api/reservas/disponibilidad?slug=...&negocio_id=...&checkIn=YYYY-MM-DD&checkOut=YYYY-MM-DD
 * Consulta de habitaciones ocupadas y rangos de fechas reservadas para evitar overbooking.
 */
export async function GET(req: NextRequest) {
  try {
    await ensureDbTables();

    const { searchParams } = new URL(req.url);
    const slug = searchParams.get("slug")?.toLowerCase().trim();
    const negocioId = searchParams.get("negocio_id")?.trim();
    const targetCheckIn = searchParams.get("checkIn")?.trim();
    const targetCheckOut = searchParams.get("checkOut")?.trim();

    let targetNegocioId = negocioId;

    if (!targetNegocioId && slug) {
      const { rows: negRows } = await pool.query(
        `SELECT id FROM "Restaurant" WHERE LOWER(slug) = $1 LIMIT 1`,
        [slug]
      );
      if (negRows[0]) {
        targetNegocioId = negRows[0].id;
      }
    }

    if (!targetNegocioId) {
      return NextResponse.json(
        { ok: false, error: "Falta parámetro 'slug' o 'negocio_id'" },
        { status: 400 }
      );
    }

    // Consultar todas las reservas activas (no canceladas) de la vertical reservas
    const { rows } = await pool.query(
      `SELECT 
         id,
         estado,
         cliente_nombre,
         metadata
       FROM pedidos
       WHERE (negocio_id = $1 OR negocio_id::text = $1)
         AND (vertical = 'reservas' OR mesa = 'RESERVA')
         AND estado NOT IN ('cancelada', 'cancelado')
       ORDER BY created_at DESC`,
      [targetNegocioId]
    );

    const allOccupiedRanges: Array<{
      id: string;
      roomName: string;
      checkIn: string;
      checkOut: string;
      estado: string;
      clienteNombre: string;
    }> = [];

    const occupiedRoomNamesSet = new Set<string>();

    for (const row of rows) {
      let meta: any = {};
      try {
        meta = typeof row.metadata === "string" ? JSON.parse(row.metadata) : (row.metadata || {});
      } catch {}

      const roomName = String(meta.tipo_habitacion || "").trim();
      const checkIn = String(meta.check_in || "").trim();
      const checkOut = String(meta.check_out || "").trim();

      if (!roomName || !checkIn || !checkOut) continue;

      allOccupiedRanges.push({
        id: String(row.id),
        roomName,
        checkIn,
        checkOut,
        estado: row.estado,
        clienteNombre: row.cliente_nombre || "Huésped",
      });

      // Si se especificó un rango de fechas objetivo, verificar si hay solapamiento:
      // Overlap formula: targetCheckIn < checkOut && targetCheckOut > checkIn
      if (targetCheckIn && targetCheckOut) {
        if (targetCheckIn < checkOut && targetCheckOut > checkIn) {
          occupiedRoomNamesSet.add(roomName.toLowerCase());
        }
      }
    }

    return NextResponse.json({
      ok: true,
      checkIn: targetCheckIn || null,
      checkOut: targetCheckOut || null,
      occupiedRoomNames: Array.from(occupiedRoomNamesSet),
      allOccupiedRanges,
    });
  } catch (error: any) {
    console.error("[GET /api/reservas/disponibilidad Error]:", error);
    return NextResponse.json(
      { ok: false, error: error.message || "Error al verificar disponibilidad" },
      { status: 500 }
    );
  }
}
