import { NextRequest, NextResponse } from "next/server";
import { pool, ensureDbTables } from "@/lib/db-pool";

export const dynamic = "force-dynamic";

// PATCH /api/reservas/[id] - Actualizar estado o notas de la reserva
export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    await ensureDbTables();

    const { id } = await context.params;
    const body = await req.json();
    const { estado, notas_hospedaje, hora_llegada_estimada } = body;

    const validStates = ["nuevo", "confirmado", "hospedado", "finalizado", "cancelado"];
    if (estado && !validStates.includes(estado)) {
      return NextResponse.json(
        { ok: false, error: `Estado inválido. Debe ser: ${validStates.join(", ")}` },
        { status: 400 }
      );
    }

    // Obtener pedido actual para mergear metadata
    const { rows: currentRows } = await pool.query(
      `SELECT id, estado, metadata FROM pedidos WHERE id = $1 LIMIT 1`,
      [id]
    );

    if (currentRows.length === 0) {
      return NextResponse.json({ ok: false, error: "Reserva no encontrada" }, { status: 404 });
    }

    let meta: any = {};
    if (currentRows[0].metadata) {
      try {
        meta = typeof currentRows[0].metadata === "string" ? JSON.parse(currentRows[0].metadata) : currentRows[0].metadata;
      } catch {}
    }

    if (notas_hospedaje !== undefined) {
      meta.notas_hospedaje = notas_hospedaje;
    }
    if (hora_llegada_estimada !== undefined) {
      meta.hora_llegada_estimada = hora_llegada_estimada;
    }

    const { rows: updatedRows } = await pool.query(
      `UPDATE pedidos
       SET estado = COALESCE($1, estado),
           metadata = $2
       WHERE id = $3
       RETURNING id, negocio_id, mesa, estado, total::float, created_at, cliente_nombre, cliente_telefono, vertical, metadata`,
      [estado || null, JSON.stringify(meta), id]
    );

    return NextResponse.json({
      ok: true,
      reserva: updatedRows[0],
    });
  } catch (err: any) {
    console.error("[PATCH /api/reservas/[id]] Error:", err);
    return NextResponse.json(
      { ok: false, error: err.message || "Error al actualizar reserva" },
      { status: 500 }
    );
  }
}

// DELETE /api/reservas/[id] - Cancelar reserva
export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    await ensureDbTables();

    const { id } = await context.params;

    const { rows: updatedRows } = await pool.query(
      `UPDATE pedidos
       SET estado = 'cancelado',
           motivo_cancelacion = 'Cancelado desde panel de reservas CRM',
           cancelado_por = 'admin',
           cancelado_at = NOW()
       WHERE id = $1
       RETURNING id, estado`,
      [id]
    );

    if (updatedRows.length === 0) {
      return NextResponse.json({ ok: false, error: "Reserva no encontrada" }, { status: 404 });
    }

    return NextResponse.json({
      ok: true,
      message: "Reserva cancelada con éxito",
    });
  } catch (err: any) {
    console.error("[DELETE /api/reservas/[id]] Error:", err);
    return NextResponse.json(
      { ok: false, error: err.message || "Error al cancelar reserva" },
      { status: 500 }
    );
  }
}
