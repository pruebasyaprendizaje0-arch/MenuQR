import { NextRequest, NextResponse } from "next/server";
import { pool, ensureDbTables } from "@/lib/db-pool";

export const dynamic = "force-dynamic";

// PATCH /api/citas/[id] - Actualizar estado, notas internas, o reprogramación de cita
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await ensureDbTables();
    const { id } = await params;
    const body = await req.json();

    const {
      estado,
      notas_internas,
      fecha_cita,
      hora_cita,
      especialista_id,
      especialista_nombre,
      servicio_nombre,
      precio_estimado,
      cliente_nombre,
      cliente_telefono,
    } = body;

    // Obtener la cita actual
    const { rows: currentRows } = await pool.query(
      `SELECT * FROM pedidos WHERE id = $1 AND vertical = 'citas' LIMIT 1`,
      [id]
    );

    if (currentRows.length === 0) {
      return NextResponse.json(
        { ok: false, error: "Cita no encontrada" },
        { status: 404 }
      );
    }

    const currentOrder = currentRows[0];
    let currentMeta: any = {};
    if (typeof currentOrder.metadata === "string") {
      try {
        currentMeta = JSON.parse(currentOrder.metadata);
      } catch {}
    } else if (currentOrder.metadata && typeof currentOrder.metadata === "object") {
      currentMeta = { ...currentOrder.metadata };
    }

    // Actualizar metadata si se enviaron nuevos campos
    if (notas_internas !== undefined) {
      currentMeta.notas_internas = notas_internas;
    }
    if (fecha_cita !== undefined) {
      currentMeta.fecha_cita = fecha_cita;
    }
    if (hora_cita !== undefined) {
      currentMeta.hora_cita = hora_cita;
    }
    if (especialista_id !== undefined) {
      currentMeta.especialista_id = especialista_id;
    }
    if (especialista_nombre !== undefined) {
      currentMeta.especialista_nombre = especialista_nombre;
    }
    if (servicio_nombre !== undefined) {
      currentMeta.servicio_nombre = servicio_nombre;
    }

    const newEstado = estado || currentOrder.estado;
    const newTotal = precio_estimado !== undefined ? parseFloat(precio_estimado) || 0 : currentOrder.total;
    const newNombre = cliente_nombre ? String(cliente_nombre).trim() : currentOrder.cliente_nombre;
    const newTelefono = cliente_telefono ? String(cliente_telefono).trim() : currentOrder.cliente_telefono;

    const { rows: updatedRows } = await pool.query(
      `UPDATE pedidos 
       SET estado = $1,
           metadata = $2,
           total = $3,
           cliente_nombre = $4,
           cliente_telefono = $5
       WHERE id = $6 
       RETURNING id, negocio_id, mesa, estado, total::float, created_at, cliente_nombre, cliente_telefono, vertical, metadata`,
      [
        newEstado,
        JSON.stringify(currentMeta),
        newTotal,
        newNombre,
        newTelefono,
        id,
      ]
    );

    return NextResponse.json({
      ok: true,
      cita: updatedRows[0],
    });
  } catch (err: any) {
    console.error("[PATCH /api/citas/[id]] Error:", err);
    return NextResponse.json(
      { ok: false, error: err.message || "Error al actualizar cita" },
      { status: 500 }
    );
  }
}

// DELETE /api/citas/[id] - Eliminar o cancelar cita
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await ensureDbTables();
    const { id } = await params;

    // Marcamos como cancelada en lugar de eliminar completamente para mantener historial de auditoría
    const { rows } = await pool.query(
      `UPDATE pedidos 
       SET estado = 'cancelada' 
       WHERE id = $1 AND vertical = 'citas'
       RETURNING id, estado`,
      [id]
    );

    if (rows.length === 0) {
      return NextResponse.json(
        { ok: false, error: "Cita no encontrada" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      ok: true,
      mensaje: "Cita cancelada con éxito",
      id: rows[0].id,
    });
  } catch (err: any) {
    console.error("[DELETE /api/citas/[id]] Error:", err);
    return NextResponse.json(
      { ok: false, error: err.message || "Error al cancelar cita" },
      { status: 500 }
    );
  }
}
