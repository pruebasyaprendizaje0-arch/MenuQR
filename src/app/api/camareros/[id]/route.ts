import { NextRequest, NextResponse } from "next/server";
import { pool, ensureDbTables } from "@/lib/db-pool";

export const dynamic = "force-dynamic";

// PUT /api/camareros/[id] - Editar nombre del mesero y datos
export async function PUT(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    await ensureDbTables();

    const { id } = await context.params;
    const body = await req.json();
    const { nombre, pin, activo } = body;

    if (!nombre || !nombre.trim()) {
      return NextResponse.json(
        { ok: false, error: "El nombre del camarero no puede estar vacío" },
        { status: 400 }
      );
    }

    const { rows } = await pool.query(
      `UPDATE camareros 
       SET 
         nombre = $1,
         pin = CASE WHEN $2::text IS NOT NULL THEN $2::text ELSE pin END,
         activo = COALESCE($3, activo)
       WHERE id = $4
       RETURNING id, negocio_id, nombre, pin, activo, created_at`,
      [nombre.trim(), pin !== undefined ? String(pin).trim() : null, activo !== undefined ? activo : null, id]
    );

    if (rows.length === 0) {
      return NextResponse.json(
        { ok: false, error: "Camarero no encontrado" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      ok: true,
      camarero: rows[0],
      message: "Nombre del mesero actualizado correctamente",
    });
  } catch (err: any) {
    console.error("[PUT /api/camareros/[id]] Error:", err);
    return NextResponse.json(
      { ok: false, error: err.message || "Error al actualizar camarero" },
      { status: 500 }
    );
  }
}

// DELETE /api/camareros/[id] - Desactivar o eliminar camarero
export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    await ensureDbTables();

    const { id } = await context.params;

    // Verificar si el camarero tiene pedidos históricos
    const { rows: pedidosRows } = await pool.query(
      "SELECT COUNT(*)::int as c FROM pedidos WHERE camarero_id = $1",
      [id]
    );

    if (pedidosRows[0]?.c > 0) {
      // Si tiene pedidos históricos, desmarcar activo para preservar métricas y trazabilidad
      const { rows } = await pool.query(
        "UPDATE camareros SET activo = false WHERE id = $1 RETURNING id, nombre",
        [id]
      );
      return NextResponse.json({
        ok: true,
        message: "Mesero desactivado para preservar historial de comandas",
        camarero: rows[0],
      });
    } else {
      // Si no tiene pedidos, se puede eliminar físicamente
      const { rows } = await pool.query(
        "DELETE FROM camareros WHERE id = $1 RETURNING id, nombre",
        [id]
      );
      return NextResponse.json({
        ok: true,
        message: "Mesero eliminado correctamente",
        camarero: rows[0],
      });
    }
  } catch (err: any) {
    console.error("[DELETE /api/camareros/[id]] Error:", err);
    return NextResponse.json(
      { ok: false, error: err.message || "Error al eliminar camarero" },
      { status: 500 }
    );
  }
}
