import { NextRequest, NextResponse } from "next/server";
import { pool, ensureDbTables } from "@/lib/db-pool";
import { emitReservaActualizada } from "@/lib/socket-server";

export const dynamic = "force-dynamic";

// PATCH /api/reservas/[id] - Actualizar estado, fechas, noches, habitación o notas de la reserva
export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    await ensureDbTables();

    const { id } = await context.params;
    const body = await req.json();
    const {
      estado,
      check_in,
      check_out,
      noches,
      tipo_habitacion,
      huespedes_adultos,
      huespedes_ninos,
      total,
      notas_hospedaje,
      hora_llegada_estimada,
    } = body;

    const validStates = ["nuevo", "confirmado", "hospedado", "finalizado", "cancelado"];
    if (estado && !validStates.includes(estado)) {
      return NextResponse.json(
        { ok: false, error: `Estado inválido. Debe ser: ${validStates.join(", ")}` },
        { status: 400 }
      );
    }

    // Obtener pedido actual para mergear metadata y verificar pertenencia
    const { rows: currentRows } = await pool.query(
      `SELECT id, negocio_id, estado, total::float, metadata FROM pedidos WHERE id = $1 LIMIT 1`,
      [id]
    );

    if (currentRows.length === 0) {
      return NextResponse.json({ ok: false, error: "Reserva no encontrada" }, { status: 404 });
    }

    const currentOrder = currentRows[0];
    let meta: any = {};
    if (currentOrder.metadata) {
      try {
        meta = typeof currentOrder.metadata === "string" ? JSON.parse(currentOrder.metadata) : currentOrder.metadata;
      } catch {}
    }

    const targetRoom = String(tipo_habitacion || meta.tipo_habitacion || "").trim();
    const targetCheckIn = String(check_in || meta.check_in || "").trim();
    const targetCheckOut = String(check_out || meta.check_out || "").trim();

    // Si se modifican fechas o habitación, verificar que no solape con otra reserva existente
    if (targetRoom && targetCheckIn && targetCheckOut) {
      const { rows: conflictRows } = await pool.query(
        `SELECT id, cliente_nombre, metadata
         FROM pedidos
         WHERE (negocio_id = $1 OR negocio_id::text = $1)
           AND (vertical = 'reservas' OR mesa = 'RESERVA')
           AND estado NOT IN ('cancelada', 'cancelado')
           AND id != $2
           AND TRIM(LOWER(metadata->>'tipo_habitacion')) = TRIM(LOWER($3))
           AND (metadata->>'check_in') < $4
           AND (metadata->>'check_out') > $5
         LIMIT 1`,
        [currentOrder.negocio_id, id, targetRoom, targetCheckOut, targetCheckIn]
      );

      if (conflictRows.length > 0) {
        return NextResponse.json(
          {
            ok: false,
            error: `La habitación "${targetRoom}" ya cuenta con otra reserva para el rango ${targetCheckIn} al ${targetCheckOut}. Por favor selecciona otras fechas.`,
          },
          { status: 409 }
        );
      }
    }

    // Actualizar campos de metadata
    if (check_in !== undefined) meta.check_in = targetCheckIn;
    if (check_out !== undefined) meta.check_out = targetCheckOut;
    if (noches !== undefined) meta.noches = parseInt(noches, 10) || 1;
    if (tipo_habitacion !== undefined) meta.tipo_habitacion = targetRoom;
    if (huespedes_adultos !== undefined) meta.huespedes_adultos = parseInt(huespedes_adultos, 10) || 1;
    if (huespedes_ninos !== undefined) meta.huespedes_ninos = parseInt(huespedes_ninos, 10) || 0;
    if (notas_hospedaje !== undefined) meta.notas_hospedaje = notas_hospedaje;
    if (hora_llegada_estimada !== undefined) meta.hora_llegada_estimada = hora_llegada_estimada;

    const newTotal = total !== undefined ? parseFloat(total) : null;

    const { rows: updatedRows } = await pool.query(
      `UPDATE pedidos
       SET estado = COALESCE($1, estado),
           total = COALESCE($2, total),
           metadata = $3
       WHERE id = $4
       RETURNING id, negocio_id, mesa, estado, total::float, created_at, cliente_nombre, cliente_telefono, vertical, metadata`,
      [estado || null, newTotal !== null ? newTotal : null, JSON.stringify(meta), id]
    );

    // Si cambiaron noches o total, actualizar item en pedido_items
    if (noches !== undefined || newTotal !== null) {
      await pool.query(
        `UPDATE pedido_items
         SET cantidad = COALESCE($1, cantidad),
             precio = COALESCE($2, precio),
             notas = $3
         WHERE pedido_id = $4 AND nombre LIKE 'Estadía:%'`,
        [
          noches !== undefined ? parseInt(noches, 10) || 1 : null,
          newTotal !== null ? newTotal : null,
          `Check-in: ${targetCheckIn} | Check-out: ${targetCheckOut} | Huéspedes: ${meta.huespedes_adultos || 1} adultos`,
          id,
        ]
      );
    }

    // Consultar items actualizados para Socket.IO
    const { rows: itemRows } = await pool.query(
      `SELECT id, pedido_id, nombre, cantidad, precio::float, notas FROM pedido_items WHERE pedido_id = $1`,
      [id]
    );

    const fullUpdatedReserva = {
      ...updatedRows[0],
      items: itemRows,
    };

    // Emitir notificación en tiempo real a clientes conectados (Admin y Caja POS)
    try {
      emitReservaActualizada(updatedRows[0].negocio_id, fullUpdatedReserva);
    } catch (sockErr) {
      console.warn("[PATCH /api/reservas/[id]] Error al emitir reserva_actualizada:", sockErr);
    }

    return NextResponse.json({
      ok: true,
      reserva: fullUpdatedReserva,
    });
  } catch (err: any) {
    console.error("[PATCH /api/reservas/[id]] Error:", err);
    return NextResponse.json(
      { ok: false, error: err.message || "Error al actualizar reserva" },
      { status: 500 }
    );
  }
}

// DELETE /api/reservas/[id] - Anular (soft cancel) o Borrar (hard delete) reserva
export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    await ensureDbTables();

    const { id } = await context.params;
    const { searchParams } = new URL(req.url);
    const hardDelete = searchParams.get("hard") === "true";

    const { rows: orderRows } = await pool.query(
      `SELECT id, negocio_id FROM pedidos WHERE id = $1 LIMIT 1`,
      [id]
    );

    if (orderRows.length === 0) {
      return NextResponse.json({ ok: false, error: "Reserva no encontrada" }, { status: 404 });
    }

    const negocioId = orderRows[0].negocio_id;

    if (hardDelete) {
      // 1. Borrado permanente de la base de datos
      await pool.query(`DELETE FROM pedido_items WHERE pedido_id = $1`, [id]);
      await pool.query(`DELETE FROM pedidos WHERE id = $1`, [id]);

      try {
        emitReservaActualizada(negocioId, { id, estado: "eliminado", deleted: true });
      } catch {}

      return NextResponse.json({
        ok: true,
        deleted: true,
        message: "Reserva eliminada permanentemente de la base de datos.",
      });
    } else {
      // 2. Anulación (Soft cancel: conserva histórico para auditoría y libera fechas)
      const { rows: updatedRows } = await pool.query(
        `UPDATE pedidos
         SET estado = 'cancelado',
             motivo_cancelacion = 'Anulado desde gestión de reservas',
             cancelado_por = 'admin',
             cancelado_at = NOW()
         WHERE id = $1
         RETURNING id, negocio_id, estado`,
        [id]
      );

      try {
        emitReservaActualizada(negocioId, { id, estado: "cancelado" });
      } catch {}

      return NextResponse.json({
        ok: true,
        anulada: true,
        message: "Reserva anulada y fechas liberadas exitosamente.",
      });
    }
  } catch (err: any) {
    console.error("[DELETE /api/reservas/[id]] Error:", err);
    return NextResponse.json(
      { ok: false, error: err.message || "Error al procesar eliminación o anulación" },
      { status: 500 }
    );
  }
}
