import { NextRequest, NextResponse } from "next/server";
import { pool, ensureDbTables } from "@/lib/db-pool";
import { prisma } from "@/lib/db";
import {
  emitPedidoActualizado,
  emitPedidoCancelado,
  emitItemCancelado,
  emitProductoActualizado,
} from "@/lib/socket-server";

export const dynamic = "force-dynamic";

// POST /api/pedidos/[id]/cancelar-item
// Cancela un plato individual, descuenta la cuenta y opcionalmente apaga el stock en el menú
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    await ensureDbTables();

    const { id: pedidoId } = await context.params;
    const body = await req.json();
    const { itemId, motivo, cancelado_por, marcar_agotado } = body;

    if (!itemId) {
      return NextResponse.json(
        { ok: false, error: "itemId es obligatorio" },
        { status: 400 }
      );
    }

    const motivoFinal = motivo?.trim() || "Plato cancelado";
    const canceladoPorFinal = (cancelado_por === "cocina" ? "cocina" : "mesero") as "cocina" | "mesero";

    // 1. Verificar existencia del pedido y del item
    const { rows: itemRows } = await pool.query(
      `SELECT pi.id, pi.nombre, pi.cantidad, pi.precio::float, pi.estado_item,
              p.id as pedido_id, p.negocio_id, p.mesa, p.estado as pedido_estado,
              n.slug as negocio_slug
       FROM pedido_items pi
       JOIN pedidos p ON pi.pedido_id = p.id
       LEFT JOIN negocios n ON p.negocio_id = n.id
       WHERE pi.id = $1 AND p.id = $2`,
      [itemId, pedidoId]
    );

    if (itemRows.length === 0) {
      return NextResponse.json(
        { ok: false, error: "Item o pedido no encontrado" },
        { status: 404 }
      );
    }

    const item = itemRows[0];

    if (item.estado_item === "cancelado") {
      return NextResponse.json(
        { ok: false, error: "Este plato ya fue cancelado previamente" },
        { status: 400 }
      );
    }

    // 2. Si se solicitó marcar como agotado en el menú (opción de cocina), actualizar en Prisma
    if (marcar_agotado && item.nombre) {
      try {
        const dish = await prisma.dish.findFirst({
          where: {
            name: { equals: item.nombre, mode: "insensitive" },
            restaurant: {
              OR: [
                { id: item.negocio_id },
                ...(item.negocio_slug ? [{ slug: item.negocio_slug }] : []),
              ],
            },
          },
        });

        if (dish) {
          await prisma.dish.update({
            where: { id: dish.id },
            data: { isAvailable: false },
          });

          emitProductoActualizado(item.negocio_id, {
            id: dish.id,
            isAvailable: false,
            negocio_id: item.negocio_id,
            name: dish.name,
          });
        }
      } catch (errDish) {
        console.warn("[cancelar-item] Error actualizando stock en Prisma:", errDish);
      }
    }

    // 3. Marcar el item como cancelado en PostgreSQL
    await pool.query(
      `UPDATE pedido_items 
       SET estado_item = 'cancelado',
           motivo_cancelacion = $1,
           cancelado_por = $2,
           cancelado_at = NOW()
       WHERE id = $3 AND pedido_id = $4`,
      [motivoFinal, canceladoPorFinal, itemId, pedidoId]
    );

    // 4. Recalcular el total del pedido con los items activos restantes
    const { rows: updatedOrderRows } = await pool.query(
      `UPDATE pedidos 
       SET total = GREATEST(0, (
         SELECT COALESCE(SUM(cantidad * precio), 0)
         FROM pedido_items 
         WHERE pedido_id = $1 AND (estado_item IS NULL OR estado_item != 'cancelado')
       ))
       WHERE id = $1
       RETURNING id, negocio_id, mesa, estado, camarero_id, total::float, created_at, cliente_nombre, solicita_mesero, motivo_cancelacion, cancelado_por`,
      [pedidoId]
    );

    // 5. Verificar si quedan items activos en la comanda
    const { rows: activeItemCountRows } = await pool.query(
      `SELECT COUNT(*)::int as count 
       FROM pedido_items 
       WHERE pedido_id = $1 AND (estado_item IS NULL OR estado_item != 'cancelado')`,
      [pedidoId]
    );

    const activeCount = activeItemCountRows[0]?.count || 0;
    let orderWasCancelled = false;
    let finalOrder = updatedOrderRows[0];

    // Si ya no quedan platos en el pedido, anular el pedido completo automáticamente
    if (activeCount === 0) {
      orderWasCancelled = true;
      const { rows: cancelledOrderRows } = await pool.query(
        `UPDATE pedidos 
         SET estado = 'cancelado',
             motivo_cancelacion = $1,
             cancelado_por = $2,
             cancelado_at = NOW()
         WHERE id = $3
         RETURNING id, negocio_id, mesa, estado, camarero_id, total::float, created_at, cliente_nombre, solicita_mesero, motivo_cancelacion, cancelado_por`,
        [`Todos los platos fueron cancelados (${motivoFinal})`, canceladoPorFinal, pedidoId]
      );
      finalOrder = cancelledOrderRows[0];
    }

    // 6. Obtener camarero y lista de items activos
    let camareroNombre = "Sin camarero";
    if (finalOrder.camarero_id) {
      const { rows: camRows } = await pool.query(
        "SELECT nombre FROM camareros WHERE id = $1",
        [finalOrder.camarero_id]
      );
      if (camRows[0]) camareroNombre = camRows[0].nombre;
    }

    const { rows: remainingItems } = await pool.query(
      `SELECT id, nombre, cantidad, precio::float, notas, es_añadido, estado_item 
       FROM pedido_items 
       WHERE pedido_id = $1 AND (estado_item IS NULL OR estado_item != 'cancelado')
       ORDER BY es_añadido ASC, nombre ASC`,
      [pedidoId]
    );

    const fullOrderPayload = {
      ...finalOrder,
      camarero_nombre: camareroNombre,
      items: remainingItems,
    };

    // 7. Emitir eventos en tiempo real
    // Evento específico de plato cancelado (para banners y alertas de sonido en salón/cocina)
    emitItemCancelado(item.negocio_id, {
      pedido_id: pedidoId,
      mesa: item.mesa,
      plato_nombre: `${item.cantidad}x ${item.nombre}`,
      motivo: motivoFinal,
      cancelado_por: canceladoPorFinal,
    });

    if (orderWasCancelled) {
      emitPedidoActualizado(item.negocio_id, {
        id: pedidoId,
        estado: "cancelado",
        mesa: item.mesa,
        motivo: finalOrder.motivo_cancelacion,
        cancelado_por: canceladoPorFinal,
      });

      emitPedidoCancelado(item.negocio_id, {
        pedido_id: pedidoId,
        mesa: item.mesa,
        motivo: finalOrder.motivo_cancelacion,
        cancelado_por: canceladoPorFinal,
      });
    } else {
      emitPedidoActualizado(item.negocio_id, fullOrderPayload);
    }

    return NextResponse.json({
      ok: true,
      pedido: fullOrderPayload,
      pedido_cancelado: orderWasCancelled,
      item_cancelado: {
        id: item.id,
        nombre: item.nombre,
        cantidad: item.cantidad,
        motivo: motivoFinal,
        cancelado_por: canceladoPorFinal,
      },
    });
  } catch (err: any) {
    console.error("[POST /api/pedidos/[id]/cancelar-item] Error:", err);
    return NextResponse.json(
      { ok: false, error: err.message || "Error al cancelar plato" },
      { status: 500 }
    );
  }
}
