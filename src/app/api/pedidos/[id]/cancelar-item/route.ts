import { NextRequest, NextResponse } from "next/server";
import { pool, ensureDbTables } from "@/lib/db-pool";
import { prisma } from "@/lib/db";
import { verifyOrderStaffAuth } from "@/lib/order-auth";
import {
  emitPedidoActualizado,
  emitPedidoCancelado,
  emitItemCancelado,
  emitProductoActualizado,
} from "@/lib/socket-server";

export const dynamic = "force-dynamic";

// Helper para reintentos acotados (hasta 3) ante interbloqueos (deadlocks) o fallos de serialización de PostgreSQL
async function withDeadlockRetry<T>(fn: (attempt: number) => Promise<T>, maxRetries = 3): Promise<T> {
  let attempt = 0;
  while (true) {
    try {
      attempt++;
      return await fn(attempt);
    } catch (err: any) {
      const isDeadlock =
        err?.code === "40P01" ||
        err?.code === "40001" ||
        err?.message?.includes("deadlock detected") ||
        err?.message?.includes("could not serialize access") ||
        err?.message?.includes("TEST_SIMULATE_DEADLOCK");
      if (isDeadlock && attempt < maxRetries) {
        const jitter = Math.floor(Math.random() * 50) + 20 * attempt;
        await new Promise((r) => setTimeout(r, jitter));
        continue;
      }
      throw err;
    }
  }
}

// POST /api/pedidos/[id]/cancelar-item
// Cancela un plato individual identificado por su ID, devuelve stock si cocina no lo ha aceptado,
// recalcula la cuenta y protege contra doble clic y carreras concurrentes.
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

    return await withDeadlockRetry(async (retryAttempt) => {
      let client: any = null;
      try {
        // 1. Iniciar transacción con bloqueo pesimista ordenado (padre pedidos primero para prevenir interbloqueos/deadlocks)
        client = await pool.connect();
        await client.query("BEGIN");

        // Gancho de prueba exclusivo para verificar reintentos ante 40P01 / 40001
        if (
          process.env.NODE_ENV === "test" &&
          (globalThis as any).__testHooks?.simulateDeadlockAttempt1 &&
          retryAttempt === 1
        ) {
          const dlErr: any = new Error("deadlock detected [TEST_SIMULATE_DEADLOCK]");
          dlErr.code = "40P01";
          throw dlErr;
        }

    const { rows: orderRows } = await client.query(
      `SELECT id, negocio_id, mesa, estado as pedido_estado, metadata 
       FROM pedidos 
       WHERE id = $1 
       FOR UPDATE`,
      [pedidoId]
    );

    if (orderRows.length === 0) {
      await client.query("ROLLBACK");
      return NextResponse.json(
        { ok: false, error: "Pedido no encontrado" },
        { status: 404 }
      );
    }

    const orderRow = orderRows[0];

    // Si el pedido completo ya fue cancelado por otra transacción, abortar inmediatamente con 409 Conflict
    if (orderRow.pedido_estado === "cancelado") {
      await client.query("ROLLBACK");
      return NextResponse.json(
        { ok: false, error: "El pedido ya se encuentra cancelado", already_cancelled: true },
        { status: 409 }
      );
    }

    // 2. Bloquear la línea específica del pedido en PostgreSQL (hijo segundo)
    const { rows: itemRows } = await client.query(
      `SELECT id, producto_id, nombre, cantidad, precio::float, estado_item, motivo_cancelacion, es_añadido, unidades_descontadas 
       FROM pedido_items 
       WHERE id = $1 AND pedido_id = $2 
       FOR UPDATE`,
      [itemId, pedidoId]
    );

    if (itemRows.length === 0) {
      await client.query("ROLLBACK");
      return NextResponse.json(
        { ok: false, error: "Item no encontrado en el pedido" },
        { status: 404 }
      );
    }

    const item = {
      ...itemRows[0],
      pedido_id: orderRow.id,
      negocio_id: orderRow.negocio_id,
      mesa: orderRow.mesa,
      pedido_estado: orderRow.pedido_estado,
      metadata: orderRow.metadata,
    };

    // 2. Control de Autorización Estricta en el Servidor
    const auth = await verifyOrderStaffAuth(req, item.negocio_id);
    if (!auth.authorized) {
      await client.query("ROLLBACK");
      return NextResponse.json(
        { ok: false, error: auth.error || "No autorizado para cancelar platos en este negocio." },
        { status: auth.status || 401 }
      );
    }

    // 3. Protección contra doble clic e idempotencia estricta
    // Si ya fue cancelado previamente, abortar inmediatamente sin devolver stock dos veces
    if (item.estado_item === "cancelado") {
      await client.query("ROLLBACK");
      return NextResponse.json(
        { ok: false, error: "Este plato ya fue cancelado previamente", already_cancelled: true },
        { status: 409 }
      );
    }

    // 4. Determinar si cocina ya aceptó o inició la preparación de ESTA LÍNEA ESPECÍFICA
    // Criterio técnico y de negocio aprobado:
    // - Para cancelar, consulta la aceptación de CADA LÍNEA (item.estado_item), no solo el estado general del pedido.
    // - Si esa línea aún no fue aceptada (estado_item === 'nuevo' o NULL o distinto de 'en_cocina'/'preparando'/'listo'),
    //   devuelve exactamente las unidades que se le descontaron (unidades_descontadas).
    // - Si esa línea ya fue aceptada por cocina (estado_item en ('en_cocina', 'preparando', 'listo')),
    //   NO devuelve stock automáticamente.
    const isLineAcceptedByKitchen =
      item.estado_item === "en_cocina" ||
      item.estado_item === "preparando" ||
      item.estado_item === "listo" ||
      (!item.es_añadido && (
        item.pedido_estado === "en_cocina" ||
        item.pedido_estado === "preparando" ||
        item.pedido_estado === "listo"
      ));

    const shouldReturnStock = !isLineAcceptedByKitchen;

    // 5. Gestión de Inventario mediante ID INMUTABLE de producto (producto_id)
    // Para registros antiguos con débito desconocido (producto_id nulo o unidades_descontadas nulo/0),
    // no se asume que se descontó toda la cantidad ni se hacen reposiciones históricas.
    let returnedStockUnits = 0;
    let matchedDishId: string | null = null;
    let dishStockBefore: number | null = null;
    let dishStockAfter: number | null = null;
    let dishTrackStock = false;
    let dishNameForEmit = item.nombre;

    const hasKnownDebit =
      Boolean(item.producto_id) &&
      typeof item.unidades_descontadas === "number" &&
      item.unidades_descontadas > 0;

    if (item.producto_id) {
      const { rows: dishRows } = await client.query(
        `SELECT id, name, stock, "trackStock", "isAvailable", "restaurantId"
         FROM "Dish"
         WHERE id = $1 AND ("restaurantId" = $2 OR "restaurantId" IN (SELECT id FROM "Restaurant" WHERE id = $2 OR slug = $2))
         LIMIT 1
         FOR UPDATE`,
        [item.producto_id, item.negocio_id]
      );

      if (dishRows.length > 0) {
        const dish = dishRows[0];
        matchedDishId = dish.id;
        dishNameForEmit = dish.name;
        dishTrackStock = Boolean(dish.trackStock);
        dishStockBefore = dish.stock !== null ? Number(dish.stock) : null;
        dishStockAfter = dishStockBefore;

        const qtyToReturn = Math.min(Number(item.cantidad) || 1, Number(item.unidades_descontadas || 0));

        if (hasKnownDebit && dish.trackStock && typeof dish.stock === "number" && shouldReturnStock && qtyToReturn > 0) {
          const newStock = Number(dish.stock) + qtyToReturn;
          returnedStockUnits = qtyToReturn;
          dishStockAfter = newStock;

          // Actualizar stock de Dish en la MISMA conexión y transacción de PostgreSQL
          await client.query(
            `UPDATE "Dish"
             SET stock = $1
             WHERE id = $2`,
            [newStock, dish.id]
          );
        }

        // Regla 4: Desacoplada de hasKnownDebit
        // "Separa la cancelación de marcar el producto como agotado."
        // Solo si el usuario marcó explícitamente la casilla marcar_agotado y existe un producto_id inequívoco
        // Valida pertenencia estricta al restaurante
        if (marcar_agotado === true) {
          await client.query(
            `UPDATE "Dish"
             SET "isAvailable" = false
             WHERE id = $1 AND ("restaurantId" = $2 OR "restaurantId" IN (SELECT id FROM "Restaurant" WHERE id = $2 OR slug = $2))`,
            [dish.id, item.negocio_id]
          );
        }
      }
    }
    // NOTA: Se eliminó el fallback que buscaba por nombre con LIMIT 1 cuando falta producto_id.
    // Un registro antiguo puede cancelarse sin reposición, pero no debe apagar un producto ambiguo.

    // 6. Marcar el item como cancelado en PostgreSQL
    await client.query(
      `UPDATE pedido_items 
       SET estado_item = 'cancelado',
           motivo_cancelacion = $1,
           cancelado_por = $2,
           cancelado_at = NOW()
       WHERE id = $3 AND pedido_id = $4`,
      [motivoFinal, canceladoPorFinal, itemId, pedidoId]
    );

    // 7. Sincronizar espejo OrderItem en la MISMA conexión transaccional de PostgreSQL
    await client.query(
      `UPDATE "OrderItem"
       SET "lineStatus" = 'CANCELLED'
       WHERE "sourcePedidoItemId" = $1`,
      [itemId]
    );

    // 8. Recalcular el total del pedido con los items activos restantes aplicando recargos fiscales y de servicio
    const { rows: activeRemainingItems } = await client.query(
      `SELECT cantidad, precio::float
       FROM pedido_items 
       WHERE pedido_id = $1 AND (estado_item IS NULL OR estado_item != 'cancelado')`,
      [pedidoId]
    );
    const remainingSubtotal = activeRemainingItems.reduce(
      (acc, it) => acc + (Number(it.precio) || 0) * (parseInt(it.cantidad) || 1),
      0
    );

    let restConfig = {
      ivaPercent: 15.0,
      servicePercent: 10.0,
      ivaOnTable: true,
      serviceOnTable: true,
      ivaOnTakeout: true,
      serviceOnTakeout: false,
    };

    const { rows: restRows } = await client.query(
      `SELECT "ivaPercent", "servicePercent", "ivaOnTable", "serviceOnTable", "ivaOnTakeout", "serviceOnTakeout"
       FROM "Restaurant"
       WHERE id = $1
       LIMIT 1`,
      [item.negocio_id]
    );
    if (restRows.length > 0) {
      const restDb = restRows[0];
      restConfig = {
        ivaPercent: typeof restDb.ivaPercent === "number" ? restDb.ivaPercent : 15.0,
        servicePercent: typeof restDb.servicePercent === "number" ? restDb.servicePercent : 10.0,
        ivaOnTable: restDb.ivaOnTable ?? true,
        serviceOnTable: restDb.serviceOnTable ?? true,
        ivaOnTakeout: restDb.ivaOnTakeout ?? restDb.ivaOnTable ?? true,
        serviceOnTakeout: restDb.serviceOnTakeout ?? restDb.serviceOnTable ?? true,
      };
    }

    const isTable = !String(item.mesa || "").toLowerCase().includes("delivery") && !String(item.mesa || "").toLowerCase().includes("llevar");
    const ivaIncluded = restConfig.ivaOnTable === true
      ? true
      : (restConfig.ivaOnTable === false
          ? false
          : (isTable ? restConfig.ivaOnTable : restConfig.ivaOnTakeout));
    const serviceIncluded = restConfig.serviceOnTable === true
      ? true
      : (restConfig.serviceOnTable === false
          ? false
          : (isTable ? restConfig.serviceOnTable : restConfig.serviceOnTakeout));

    let meta: any = {};
    try {
      meta = typeof item.metadata === "string" ? JSON.parse(item.metadata) : (item.metadata || {});
    } catch {}
    const deliveryCost = typeof meta?.costo_envio === "number" ? meta.costo_envio : 0;

    const calcIva = (activeRemainingItems.length > 0 && restConfig.ivaPercent > 0 && !ivaIncluded)
      ? Math.round(remainingSubtotal * (restConfig.ivaPercent / 100) * 100) / 100
      : 0;
    const calcService = (activeRemainingItems.length > 0 && isTable && restConfig.servicePercent > 0 && !serviceIncluded)
      ? Math.round(remainingSubtotal * (restConfig.servicePercent / 100) * 100) / 100
      : 0;
    const newTotal = activeRemainingItems.length > 0
      ? Math.round((remainingSubtotal + calcIva + calcService + deliveryCost) * 100) / 100
      : 0;

    meta.subtotal = remainingSubtotal;
    meta.iva = calcIva;
    meta.service_charge = calcService;

    let orderWasCancelled = false;
    let finalOrder: any = null;

    // Regla 5:
    // Conserva el historial. Recalcula la cuenta solo con las líneas activas; si no queda ninguna,
    // conserva la cancelación de la comanda y el total cero, sin cobro ni borrado físico.
    if (activeRemainingItems.length === 0) {
      orderWasCancelled = true;
      const { rows: cancelledOrderRows } = await client.query(
        `UPDATE pedidos 
         SET total = 0,
             metadata = $1,
             estado = 'cancelado',
             motivo_cancelacion = $2,
             cancelado_por = $3,
             cancelado_at = NOW()
         WHERE id = $4
         RETURNING id, negocio_id, mesa, estado, camarero_id, total::float, created_at, cliente_nombre, solicita_mesero, motivo_cancelacion, cancelado_por`,
        [
          JSON.stringify(meta),
          `Todos los platos fueron cancelados (${motivoFinal})`,
          canceladoPorFinal,
          pedidoId,
        ]
      );
      finalOrder = cancelledOrderRows[0];

      // Sincronizar espejo Order en la MISMA transacción de PostgreSQL
      await client.query(
        `UPDATE "Order"
         SET status = 'CANCELLED',
             total = 0,
             subtotal = 0,
             iva = 0,
             "serviceCharge" = 0,
             "updatedAt" = NOW()
         WHERE id = $1`,
        [pedidoId]
      );
    } else {
      // Determinar si los items restantes siguen en_cocina, están listos o si todos son nuevo
      const { rows: remStatusRows } = await client.query(
        `SELECT estado_item FROM pedido_items
         WHERE pedido_id = $1 AND (estado_item IS NULL OR estado_item != 'cancelado')`,
        [pedidoId]
      );
      const remStatuses = remStatusRows.map((r: any) => r.estado_item || "nuevo");
      let targetOrderEstado = item.pedido_estado;
      if (remStatuses.length > 0 && remStatuses.every((s: string) => s === "listo")) {
        targetOrderEstado = "listo";
      } else if (remStatuses.some((s: string) => s === "en_cocina" || s === "preparando")) {
        targetOrderEstado = "en_cocina";
      } else if (remStatuses.every((s: string) => s === "nuevo")) {
        targetOrderEstado = "nuevo";
      } else if (remStatuses.some((s: string) => s === "listo")) {
        targetOrderEstado = "listo";
      } else {
        targetOrderEstado = "nuevo";
      }

      const { rows: updatedOrderRows } = await client.query(
        `UPDATE pedidos 
         SET total = $1,
             metadata = $2,
             estado = $3
         WHERE id = $4
         RETURNING id, negocio_id, mesa, estado, camarero_id, total::float, created_at, cliente_nombre, solicita_mesero, motivo_cancelacion, cancelado_por`,
        [newTotal, JSON.stringify(meta), targetOrderEstado, pedidoId]
      );
      finalOrder = updatedOrderRows[0];

      // Sincronizar espejo Order en la MISMA transacción de PostgreSQL
      const prismaStatus = targetOrderEstado === "nuevo" ? "PENDING" : "ACTIVE";
      await client.query(
        `UPDATE "Order"
         SET total = $1,
             subtotal = $2,
             iva = $3,
             "serviceCharge" = $4,
             status = $5,
             "updatedAt" = NOW()
         WHERE id = $6`,
        [newTotal, remainingSubtotal, calcIva, calcService, prismaStatus, pedidoId]
      );
    }

    // Gancho de prueba exclusivo para el entorno aislado de test (sin inyección en body)
    if (process.env.NODE_ENV === "test" && (globalThis as any).__testHooks?.failAfterStockUpdate) {
      throw new Error("[TEST INDUCED FAILURE] Simulación de error tras escrituras para verificar reversión atómica de líneas, pedido y espejos.");
    }

    // Confirmar transacción de forma atómica en PostgreSQL
    await client.query("COMMIT");

    // 9. Obtener camarero y lista de items activos
    let camareroNombre = "Sin camarero";
    if (finalOrder?.camarero_id) {
      const { rows: camRows } = await pool.query(
        "SELECT nombre FROM camareros WHERE id = $1",
        [finalOrder.camarero_id]
      );
      if (camRows[0]) camareroNombre = camRows[0].nombre;
    }

    const { rows: remainingItems } = await pool.query(
      `SELECT id, producto_id, nombre, cantidad, precio::float, notas, es_añadido, estado_item, unidades_descontadas 
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

    // 10. Emitir eventos en tiempo real ÚNICAMENTE DESPUÉS DEL COMMIT
    emitItemCancelado(item.negocio_id, {
      pedido_id: pedidoId,
      mesa: item.mesa,
      plato_nombre: `${item.cantidad}x ${item.nombre}`,
      motivo: motivoFinal,
      cancelado_por: canceladoPorFinal,
    });

    if (marcar_agotado === true && matchedDishId) {
      emitProductoActualizado(item.negocio_id, {
        id: matchedDishId,
        isAvailable: false,
        negocio_id: item.negocio_id,
        name: dishNameForEmit,
      });
    }

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
        devuelve_stock: returnedStockUnits > 0,
        unidades_devueltas: returnedStockUnits,
        cocina_habia_aceptado: isLineAcceptedByKitchen,
        stock_anterior: dishStockBefore,
        stock_nuevo: dishStockAfter,
        producto_controla_stock: dishTrackStock,
      },
    });
      } catch (err: any) {
        if (client) {
          try {
            await client.query("ROLLBACK");
          } catch {}
        }
        throw err;
      } finally {
        if (client) {
          client.release();
        }
      }
    });
  } catch (err: any) {
    console.error("[POST /api/pedidos/[id]/cancelar-item] Error:", err);
    return NextResponse.json(
      { ok: false, error: err.message || "Error al cancelar plato" },
      { status: 500 }
    );
  }
}
