import { NextRequest, NextResponse } from "next/server";
import { pool, ensureDbTables } from "@/lib/db-pool";
import { emitPedidoActualizado, emitPedidoCancelado } from "@/lib/socket-server";

export const dynamic = "force-dynamic";

// PUT /api/pedidos/[id] - Cambia estado (nuevo -> en_cocina -> listo -> por_pagar -> pagado -> cancelado)
export async function PUT(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    await ensureDbTables();

    const { id } = await context.params;
    const body = await req.json();
    const { estado, solicita_mesero, motivo, cancelado_por } = body;

    const validStates = ["nuevo", "en_cocina", "listo", "por_pagar", "pagado", "cancelado"];
    if (estado && !validStates.includes(estado)) {
      return NextResponse.json(
        {
          ok: false,
          error: `Estado inválido. Debe ser uno de: ${validStates.join(", ")}`,
        },
        { status: 400 }
      );
    }

    const { rows: updatedRows } = await pool.query(
      `UPDATE pedidos 
       SET estado = COALESCE($1, estado),
           solicita_mesero = COALESCE($2, solicita_mesero),
           motivo_cancelacion = CASE WHEN $1 = 'cancelado' THEN COALESCE($3, motivo_cancelacion, 'Cancelado por usuario') ELSE motivo_cancelacion END,
           cancelado_por = CASE WHEN $1 = 'cancelado' THEN COALESCE($4, cancelado_por, 'sistema') ELSE cancelado_por END,
           cancelado_at = CASE WHEN $1 = 'cancelado' THEN NOW() ELSE cancelado_at END
       WHERE id = $5 
       RETURNING id, negocio_id, mesa, estado, camarero_id, total::float, created_at, cliente_nombre, solicita_mesero, motivo_cancelacion, cancelado_por`,
      [
        estado || null,
        typeof solicita_mesero === "boolean" ? solicita_mesero : null,
        motivo || null,
        cancelado_por || null,
        id,
      ]
    );

    if (updatedRows.length === 0) {
      return NextResponse.json(
        { ok: false, error: "Pedido no encontrado" },
        { status: 404 }
      );
    }

    const pedido = updatedRows[0];

    // Si se canceló el pedido completo, cancelar también sus items
    if (estado === "cancelado") {
      await pool.query(
        `UPDATE pedido_items 
         SET estado_item = 'cancelado',
             motivo_cancelacion = COALESCE($1, 'Pedido cancelado'),
             cancelado_por = COALESCE($2, 'sistema'),
             cancelado_at = NOW()
         WHERE pedido_id = $3 AND (estado_item IS NULL OR estado_item != 'cancelado')`,
        [motivo || null, cancelado_por || null, id]
      );
    }

    // Obtener camarero
    let camareroNombre = "Sin camarero";
    if (pedido.camarero_id) {
      const { rows: camRows } = await pool.query(
        "SELECT nombre FROM camareros WHERE id = $1",
        [pedido.camarero_id]
      );
      if (camRows[0]) camareroNombre = camRows[0].nombre;
    }

    // Obtener items activos
    const { rows: items } = await pool.query(
      `SELECT id, nombre, cantidad, precio::float, notas, es_añadido, estado_item 
       FROM pedido_items 
       WHERE pedido_id = $1 AND (estado_item IS NULL OR estado_item != 'cancelado')
       ORDER BY es_añadido ASC, nombre ASC`,
      [id]
    );

    const fullOrder = {
      ...pedido,
      camarero_nombre: camareroNombre,
      items,
    };

    // Emitir cambio de estado a la cocina y meseros
    emitPedidoActualizado(pedido.negocio_id, fullOrder);

    if (estado === "cancelado") {
      emitPedidoCancelado(pedido.negocio_id, {
        pedido_id: id,
        mesa: pedido.mesa,
        motivo: pedido.motivo_cancelacion || "Pedido cancelado",
        cancelado_por: pedido.cancelado_por || "sistema",
      });
    }

    return NextResponse.json({
      ok: true,
      pedido: fullOrder,
    });
  } catch (err: any) {
    console.error("[PUT /api/pedidos/[id]] Error:", err);
    return NextResponse.json(
      { ok: false, error: err.message || "Error al actualizar estado del pedido" },
      { status: 500 }
    );
  }
}

// DELETE /api/pedidos/[id] - Cancelar y anular pedido con auditoría de motivo
export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    await ensureDbTables();
    const { id } = await context.params;

    let body: any = {};
    try {
      body = await req.json();
    } catch {}

    const { searchParams } = new URL(req.url);
    const motivo = body?.motivo || searchParams.get("motivo") || "Anulado por usuario";
    const cancelado_por = (body?.cancelado_por || searchParams.get("cancelado_por") || "mesero") as "cocina" | "mesero";

    // Marcar pedido como cancelado
    const { rows } = await pool.query(
      `UPDATE pedidos 
       SET estado = 'cancelado',
           motivo_cancelacion = $1,
           cancelado_por = $2,
           cancelado_at = NOW()
       WHERE id = $3 
       RETURNING id, negocio_id, mesa, estado, motivo_cancelacion, cancelado_por`,
      [motivo, cancelado_por, id]
    );

    if (rows.length === 0) {
      return NextResponse.json({ ok: false, error: "Pedido no encontrado" }, { status: 404 });
    }

    const pedido = rows[0];

    // Marcar items como cancelados
    await pool.query(
      `UPDATE pedido_items 
       SET estado_item = 'cancelado',
           motivo_cancelacion = $1,
           cancelado_por = $2,
           cancelado_at = NOW()
       WHERE pedido_id = $3 AND (estado_item IS NULL OR estado_item != 'cancelado')`,
      [motivo, cancelado_por, id]
    );

    emitPedidoActualizado(pedido.negocio_id, {
      id,
      estado: "cancelado",
      mesa: pedido.mesa,
      motivo,
      cancelado_por,
    });

    emitPedidoCancelado(pedido.negocio_id, {
      pedido_id: id,
      mesa: pedido.mesa,
      motivo,
      cancelado_por,
    });

    return NextResponse.json({ ok: true, deleted: pedido });
  } catch (err: any) {
    console.error("[DELETE /api/pedidos/[id]] Error:", err);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
