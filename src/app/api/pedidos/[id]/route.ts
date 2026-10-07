import { NextRequest, NextResponse } from "next/server";
import { pool, ensureDbTables } from "@/lib/db-pool";
import { emitPedidoActualizado } from "@/lib/socket-server";

export const dynamic = "force-dynamic";

// PUT /api/pedidos/[id] - Cambia estado (nuevo -> en_cocina -> listo -> por_pagar -> pagado)
export async function PUT(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    await ensureDbTables();

    const { id } = await context.params;
    const body = await req.json();
    const { estado } = body;

    const validStates = ["nuevo", "en_cocina", "listo", "por_pagar", "pagado"];
    if (!estado || !validStates.includes(estado)) {
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
       SET estado = $1 
       WHERE id = $2 
       RETURNING id, negocio_id, mesa, estado, camarero_id, total::float, created_at`,
      [estado, id]
    );

    if (updatedRows.length === 0) {
      return NextResponse.json(
        { ok: false, error: "Pedido no encontrado" },
        { status: 404 }
      );
    }

    const pedido = updatedRows[0];

    // Obtener camarero
    let camareroNombre = "Sin camarero";
    if (pedido.camarero_id) {
      const { rows: camRows } = await pool.query(
        "SELECT nombre FROM camareros WHERE id = $1",
        [pedido.camarero_id]
      );
      if (camRows[0]) camareroNombre = camRows[0].nombre;
    }

    // Obtener items
    const { rows: items } = await pool.query(
      `SELECT id, nombre, cantidad, precio::float, notas, es_añadido, estado_item 
       FROM pedido_items 
       WHERE pedido_id = $1 
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

// DELETE /api/pedidos/[id] - Cancelar o eliminar pedido
export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    await ensureDbTables();
    const { id } = await context.params;

    const { rows } = await pool.query(
      "DELETE FROM pedidos WHERE id = $1 RETURNING id, negocio_id, mesa",
      [id]
    );

    if (rows.length === 0) {
      return NextResponse.json({ ok: false, error: "Pedido no encontrado" }, { status: 404 });
    }

    emitPedidoActualizado(rows[0].negocio_id, { id, estado: "cancelado", mesa: rows[0].mesa });

    return NextResponse.json({ ok: true, deleted: rows[0] });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
