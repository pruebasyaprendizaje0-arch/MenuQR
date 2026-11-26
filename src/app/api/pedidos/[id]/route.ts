import { NextRequest, NextResponse } from "next/server";
import { pool, ensureDbTables } from "@/lib/db-pool";
import { prisma } from "@/lib/db";
import { emitPedidoActualizado, emitPedidoCancelado } from "@/lib/socket-server";
import { syncSinglePedidoToPrisma } from "@/lib/order-sync";
import {
  verifyOrderStaffAuth,
  checkRoleCanTransitionOrder,
  checkRoleCanDeleteOrder,
} from "@/lib/order-auth";

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

function getMesaVariants(mesa: string): string[] {
  if (!mesa) return [];
  const trimmed = mesa.trim();
  const clean = trimmed.replace(/^(mesa\s*#?|#)/i, "").trim();
  const variants = new Set<string>([
    trimmed.toLowerCase(),
    clean.toLowerCase(),
    `mesa ${clean}`.toLowerCase(),
    `mesa #${clean}`.toLowerCase(),
    `#${clean}`.toLowerCase(),
  ]);
  return Array.from(variants).filter(Boolean);
}

// PUT /api/pedidos/[id] - Cambia estado (nuevo -> en_cocina -> listo -> por_pagar -> pagado -> cancelado)
export async function PUT(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    await ensureDbTables();

    const { id } = await context.params;
    const body = await req.json();
    const { estado, solicita_mesero, motivo, cancelado_por, item_ids, accion } = body;

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

    // 1. Iniciar transacción con reintentos acotados ante deadlock y bloqueo pesimista en PostgreSQL
    return await withDeadlockRetry(async (retryAttempt) => {
      const client = await pool.connect();
      let pedido: any = null;
      let existingOrder: any = null;

      try {
        await client.query("BEGIN");

        if (
          process.env.NODE_ENV === "test" &&
          (globalThis as any).__testHooks?.simulateDeadlockInPutAttempt1 &&
          retryAttempt === 1
        ) {
          const dlErr: any = new Error("deadlock detected [TEST_SIMULATE_DEADLOCK]");
          dlErr.code = "40P01";
          throw dlErr;
        }

        if (
          process.env.NODE_ENV === "test" &&
          (globalThis as any).__testHooks?.simulateSerializationFailureInPutAttempt1 &&
          retryAttempt === 1
        ) {
          const sfErr: any = new Error("could not serialize access due to concurrent update [TEST_SIMULATE_SERIALIZATION_FAILURE]");
          sfErr.code = "40001";
          throw sfErr;
        }

        const { rows: existingRows } = await client.query(
          "SELECT id, negocio_id, mesa, estado, metadata FROM pedidos WHERE id = $1 FOR UPDATE",
          [id]
        );

        if (existingRows.length === 0) {
          await client.query("ROLLBACK");
          return NextResponse.json(
            { ok: false, error: "Pedido no encontrado" },
            { status: 404 }
          );
        }

        existingOrder = existingRows[0];

      // 2. Control de Autorización Estricta en el Servidor (Multi-Tenant y Credenciales Requeridas)
      const auth = await verifyOrderStaffAuth(req, existingOrder.negocio_id);
      if (!auth.authorized) {
        await client.query("ROLLBACK");
        return NextResponse.json(
          { ok: false, error: auth.error || "No autorizado para modificar pedidos de este negocio." },
          { status: auth.status || 401 }
        );
      }

      // 3. Matriz de Permisos por Rol:
      // Cocina SOLO puede avanzar a 'en_cocina' o 'listo'. No puede cobrar ('pagado', 'por_pagar') ni cancelar.
      const transitionCheck = checkRoleCanTransitionOrder(auth.role!, estado);
      if (!transitionCheck.allowed) {
        await client.query("ROLLBACK");
        return NextResponse.json(
          { ok: false, error: transitionCheck.error },
          { status: 403 }
        );
      }

      // 4. Validación de Política de Prepago en el Servidor (Condición 1):
      // Si el pedido exige prepago y no ha sido confirmado por caja o administración,
      // queda estrictamente bloqueado el inicio de preparación ('en_cocina' o 'listo').
      let orderMeta: any = {};
      try {
        orderMeta = typeof existingOrder.metadata === "string"
          ? JSON.parse(existingOrder.metadata)
          : (existingOrder.metadata || {});
      } catch {}

      if (
        orderMeta?.exige_prepago === true &&
        !orderMeta?.pago_confirmado &&
        (estado === "en_cocina" || estado === "listo")
      ) {
        await client.query("ROLLBACK");
        return NextResponse.json(
          {
            ok: false,
            error: "No se puede iniciar preparación: el pedido exige prepago y el pago aún no ha sido confirmado por caja o administración.",
          },
          { status: 403 }
        );
      }

      // 5. Protección contra reactivación tardía de pedidos cancelados o vacíos (Regla de Inventario / Punto 3):
      // Si el pedido ya está cancelado, o si no le queda ninguna línea activa, queda estrictamente
      // prohibida su reactivación o aceptación en cocina.
      if (existingOrder.estado === "cancelado" && (estado === "en_cocina" || estado === "listo")) {
        await client.query("ROLLBACK");
        return NextResponse.json(
          {
            ok: false,
            error: "No se puede reactivar ni aceptar en cocina un pedido que ya ha sido cancelado.",
          },
          { status: 409 }
        );
      }

      if (estado === "en_cocina" || estado === "listo") {
        const { rows: activeCheckRows } = await client.query(
          `SELECT COUNT(*)::int as active_count
           FROM pedido_items
           WHERE pedido_id = $1 AND (estado_item IS NULL OR estado_item != 'cancelado')`,
          [id]
        );
        if ((activeCheckRows[0]?.active_count || 0) === 0) {
          await client.query("ROLLBACK");
          return NextResponse.json(
            {
              ok: false,
              error: "No se puede iniciar preparación: el pedido no tiene líneas activas (todos los platos fueron cancelados).",
            },
            { status: 409 }
          );
        }

        // Si se especificaron item_ids puntuales, validar que al menos uno no esté cancelado
        if (Array.isArray(item_ids) && item_ids.length > 0) {
          const { rows: targetActiveRows } = await client.query(
            `SELECT COUNT(*)::int as target_count
             FROM pedido_items
             WHERE pedido_id = $1 AND id = ANY($2::uuid[]) AND (estado_item IS NULL OR estado_item != 'cancelado')`,
            [id, item_ids]
          );
          if ((targetActiveRows[0]?.target_count || 0) === 0) {
            await client.query("ROLLBACK");
            return NextResponse.json(
              {
                ok: false,
                error: "Los platos solicitados ya fueron cancelados.",
              },
              { status: 409 }
            );
          }
        }
      }

      // Bloquear los items con FOR UPDATE para proteger carreras con cancelaciones concurrentes
      await client.query(
        `SELECT id, estado_item FROM pedido_items WHERE pedido_id = $1 ORDER BY id ASC FOR UPDATE`,
        [id]
      );

      // Transición granular de líneas según el estado solicitado
      if (estado === "en_cocina") {
        if (Array.isArray(item_ids) && item_ids.length > 0) {
          await client.query(
            `UPDATE pedido_items
             SET estado_item = 'en_cocina'
             WHERE pedido_id = $1 AND id = ANY($2::uuid[]) AND (estado_item IS NULL OR estado_item = 'nuevo')`,
            [id, item_ids]
          );
        } else if (accion === "aceptar_ronda") {
          await client.query(
            `UPDATE pedido_items
             SET estado_item = 'en_cocina'
             WHERE pedido_id = $1 AND es_añadido = true AND (estado_item IS NULL OR estado_item = 'nuevo')`,
            [id]
          );
        } else {
          // Aceptación general: solo actualiza líneas en 'nuevo'; no altera ni reinicia platos que ya estaban 'en_cocina'
          await client.query(
            `UPDATE pedido_items
             SET estado_item = 'en_cocina'
             WHERE pedido_id = $1 AND (estado_item IS NULL OR estado_item = 'nuevo')`,
            [id]
          );
        }
      } else if (estado === "listo") {
        if (Array.isArray(item_ids) && item_ids.length > 0) {
          await client.query(
            `UPDATE pedido_items
             SET estado_item = 'listo'
             WHERE pedido_id = $1 AND id = ANY($2::uuid[]) AND estado_item = 'en_cocina'`,
            [id, item_ids]
          );
        } else {
          await client.query(
            `UPDATE pedido_items
             SET estado_item = 'listo'
             WHERE pedido_id = $1 AND estado_item = 'en_cocina'`,
            [id]
          );
        }
      }

      // Determinar estado consolidado del pedido a nivel de comanda
      let targetOrderEstado = estado || existingOrder.estado;
      if (estado !== "cancelado" && estado !== "pagado" && estado !== "por_pagar") {
        const { rows: remStatusRows } = await client.query(
          `SELECT estado_item FROM pedido_items
           WHERE pedido_id = $1 AND (estado_item IS NULL OR estado_item != 'cancelado')`,
          [id]
        );
        const remStatuses = remStatusRows.map((r: any) => r.estado_item || "nuevo");
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
      }

      const { rows: updatedRows } = await client.query(
        `UPDATE pedidos 
         SET estado = COALESCE($1, estado),
             solicita_mesero = CASE WHEN $1 IN ('pagado', 'cancelado') THEN false ELSE COALESCE($2, solicita_mesero) END,
             motivo_cancelacion = CASE WHEN $1 = 'cancelado' THEN COALESCE($3, motivo_cancelacion, 'Cancelado por usuario') ELSE motivo_cancelacion END,
             cancelado_por = CASE WHEN $1 = 'cancelado' THEN COALESCE($4, cancelado_por, 'sistema') ELSE cancelado_por END,
             cancelado_at = CASE WHEN $1 = 'cancelado' THEN NOW() ELSE cancelado_at END
         WHERE id = $5 
         RETURNING id, negocio_id, mesa, estado, camarero_id, total::float, created_at, cliente_nombre, solicita_mesero, motivo_cancelacion, cancelado_por, metadata`,
        [
          targetOrderEstado || null,
          typeof solicita_mesero === "boolean" ? solicita_mesero : null,
          motivo || null,
          cancelado_por || null,
          id,
        ]
      );

      if (updatedRows.length === 0) {
        await client.query("ROLLBACK");
        return NextResponse.json(
          { ok: false, error: "Pedido no encontrado" },
          { status: 404 }
        );
      }

      pedido = updatedRows[0];

      // Si se canceló el pedido completo, cancelar también sus items
      if (estado === "cancelado") {
        // Recalcular a total 0 y limpiar metadatos de recargos
        let cancelMeta: any = {};
        try {
          cancelMeta = typeof pedido.metadata === "string" ? JSON.parse(pedido.metadata) : (pedido.metadata || {});
        } catch {}
        cancelMeta.subtotal = 0;
        cancelMeta.iva = 0;
        cancelMeta.service_charge = 0;

        await client.query(
          `UPDATE pedidos 
           SET total = 0,
               metadata = $1
           WHERE id = $2`,
          [JSON.stringify(cancelMeta), id]
        );
        pedido.total = 0;
        pedido.metadata = cancelMeta;

        // Devolver stock ÚNICAMENTE de las líneas que NO fueron aceptadas por cocina (estado_item !== 'en_cocina' y !== 'listo')
        const { rows: activeItems } = await client.query(
          `SELECT id, producto_id, cantidad, unidades_descontadas, estado_item, es_añadido FROM pedido_items 
           WHERE pedido_id = $1 AND (estado_item IS NULL OR estado_item != 'cancelado')
           ORDER BY id ASC
           FOR UPDATE`,
          [id]
        );

        const returnUnitsByDish = new Map<string, number>();
        for (const it of activeItems) {
          const isLineAccepted =
            it.estado_item === "en_cocina" ||
            it.estado_item === "preparando" ||
            it.estado_item === "listo" ||
            (!it.es_añadido && (
              existingOrder.estado === "en_cocina" ||
              existingOrder.estado === "preparando" ||
              existingOrder.estado === "listo"
            ));
          if (!isLineAccepted && it.producto_id && typeof it.unidades_descontadas === "number" && it.unidades_descontadas > 0) {
            const qty = Math.min(Number(it.cantidad) || 1, Number(it.unidades_descontadas));
            if (qty > 0) {
              returnUnitsByDish.set(it.producto_id, (returnUnitsByDish.get(it.producto_id) || 0) + qty);
            }
          }
        }

          const sortedDishIds = Array.from(returnUnitsByDish.keys()).sort();
          for (const dishId of sortedDishIds) {
            const qty = returnUnitsByDish.get(dishId) || 0;
            const { rows: dishRows } = await client.query(
              `SELECT id, stock, "trackStock" 
               FROM "Dish" 
               WHERE id = $1
               LIMIT 1 
               FOR UPDATE`,
              [dishId]
            );
            if (dishRows.length > 0) {
              const dish = dishRows[0];
              if (dish.trackStock && typeof dish.stock === "number" && qty > 0) {
                await client.query(
                  `UPDATE "Dish" SET stock = stock + $1 WHERE id = $2`,
                  [qty, dish.id]
                );
              }
            }
          }

        await client.query(
          `UPDATE pedido_items 
           SET estado_item = 'cancelado',
               motivo_cancelacion = COALESCE($1, 'Pedido cancelado'),
               cancelado_por = COALESCE($2, 'sistema'),
               cancelado_at = NOW()
           WHERE pedido_id = $3 AND (estado_item IS NULL OR estado_item != 'cancelado')`,
          [motivo || null, cancelado_por || null, id]
        );

        // Sincronizar espejos Order y OrderItem en la MISMA conexión transaccional
        await client.query(
          `UPDATE "OrderItem"
           SET "lineStatus" = 'CANCELLED'
           WHERE "orderId" = $1`,
          [id]
        );
        await client.query(
          `UPDATE "Order"
           SET status = 'CANCELLED',
               total = 0,
               subtotal = 0,
               iva = 0,
               "serviceCharge" = 0,
               "updatedAt" = NOW()
           WHERE id = $1`,
          [id]
        );
      }

      if (process.env.NODE_ENV === "test" && (globalThis as any).__testHooks?.failBeforeCommitInPut) {
        throw new Error("TEST_FAIL_BEFORE_COMMIT_IN_PUT");
      }

      await client.query("COMMIT");
    } catch (errTx) {
      await client.query("ROLLBACK");
      throw errTx;
    } finally {
      client.release();
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

    void syncSinglePedidoToPrisma(id, pedido.negocio_id);

      return NextResponse.json({
        ok: true,
        pedido: fullOrder,
      });
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

    return await withDeadlockRetry(async (retryAttempt) => {
      // Iniciar transacción en PostgreSQL para anulación atómica
      const client = await pool.connect();
      let pedido: any = null;

      try {
        await client.query("BEGIN");

        // Gancho para simular error de deadlock/serialización 40P01 en intento 1
        if (
          process.env.NODE_ENV === "test" &&
          (globalThis as any).__testHooks?.simulateDeadlockInDeleteAttempt1 &&
          retryAttempt === 1
        ) {
          const dlErr: any = new Error("deadlock detected [TEST_SIMULATE_DEADLOCK]");
          dlErr.code = "40P01";
          throw dlErr;
        }

      // 1. Bloqueo estricto del pedido al inicio con SELECT ... FOR UPDATE
      const { rows: existingRows } = await client.query(
        "SELECT id, negocio_id, mesa, estado, total, metadata FROM pedidos WHERE id = $1 FOR UPDATE",
        [id]
      );

      if (existingRows.length === 0) {
        await client.query("ROLLBACK");
        return NextResponse.json({ ok: false, error: "Pedido no encontrado" }, { status: 404 });
      }

      const existingOrder = existingRows[0];

      // Si ya está cancelado, responde 409 Conflict (already_cancelled: true) sin reoperar
      if (existingOrder.estado === "cancelado") {
        await client.query("ROLLBACK");
        return NextResponse.json(
          { ok: false, error: "El pedido ya se encuentra cancelado.", already_cancelled: true },
          { status: 409 }
        );
      }

      // 2. Control de Autorización Estricta en el Servidor
      const auth = await verifyOrderStaffAuth(req, existingOrder.negocio_id);
      if (!auth.authorized) {
        await client.query("ROLLBACK");
        return NextResponse.json(
          { ok: false, error: auth.error || "No autorizado para anular pedidos de este negocio." },
          { status: auth.status || 401 }
        );
      }

      // 3. Matriz de Permisos: Cocina NO puede anular pedidos completos
      const deleteCheck = checkRoleCanDeleteOrder(auth.role!);
      if (!deleteCheck.allowed) {
        await client.query("ROLLBACK");
        return NextResponse.json(
          { ok: false, error: deleteCheck.error },
          { status: 403 }
        );
      }

      // 4. Devolver stock ÚNICAMENTE de las líneas que NO fueron aceptadas por cocina
      // Consulta la aceptación de CADA línea individual (it.estado_item !== 'en_cocina' y !== 'listo')
      // Revalida líneas activas bloqueadas con FOR UPDATE en orden canónico
      // Usando producto_id inmutable y unidades_descontadas registradas (sin búsquedas por nombre)
      const { rows: activeItems } = await client.query(
        `SELECT id, producto_id, cantidad, unidades_descontadas, estado_item, es_añadido FROM pedido_items 
         WHERE pedido_id = $1 AND (estado_item IS NULL OR estado_item != 'cancelado')
         ORDER BY id ASC
         FOR UPDATE`,
        [id]
      );

      // Agrupar devoluciones por dishId y ordenar canónicamente para eliminar interbloqueos
      const returnUnitsByDish = new Map<string, number>();
      for (const it of activeItems) {
        const isLineAccepted =
          it.estado_item === "en_cocina" ||
          it.estado_item === "preparando" ||
          it.estado_item === "listo" ||
          (!it.es_añadido && (
            existingOrder.estado === "en_cocina" ||
            existingOrder.estado === "preparando" ||
            existingOrder.estado === "listo"
          ));
        if (!isLineAccepted && it.producto_id && typeof it.unidades_descontadas === "number" && it.unidades_descontadas > 0) {
          const qty = Math.min(Number(it.cantidad) || 1, Number(it.unidades_descontadas));
          if (qty > 0) {
            returnUnitsByDish.set(it.producto_id, (returnUnitsByDish.get(it.producto_id) || 0) + qty);
          }
        }
      }

        const sortedDishIds = Array.from(returnUnitsByDish.keys()).sort();
        for (const dishId of sortedDishIds) {
          const qty = returnUnitsByDish.get(dishId) || 0;
          const { rows: dishRows } = await client.query(
            `SELECT id, stock, "trackStock" 
             FROM "Dish" 
             WHERE id = $1 
             LIMIT 1 
             FOR UPDATE`,
            [dishId]
          );

          if (dishRows.length > 0) {
            const dish = dishRows[0];
            if (dish.trackStock && typeof dish.stock === "number" && qty > 0) {
              await client.query(
                `UPDATE "Dish" SET stock = stock + $1 WHERE id = $2`,
                [qty, dish.id]
              );
            }
          }
        }

      // 5. Marcar pedido como cancelado lógicamente con total = 0 y metadatos reseteados
      let cancelMeta: any = {};
      try {
        cancelMeta = typeof existingOrder.metadata === "string" ? JSON.parse(existingOrder.metadata) : (existingOrder.metadata || {});
      } catch {}
      cancelMeta.subtotal = 0;
      cancelMeta.iva = 0;
      cancelMeta.service_charge = 0;

      const { rows } = await client.query(
        `UPDATE pedidos 
         SET estado = 'cancelado',
             total = 0,
             solicita_mesero = false,
             motivo_cancelacion = $1,
             cancelado_por = $2,
             cancelado_at = NOW(),
             metadata = $3
         WHERE id = $4 
         RETURNING id, negocio_id, mesa, estado, motivo_cancelacion, cancelado_por`,
        [motivo, cancelado_por, JSON.stringify(cancelMeta), id]
      );

      pedido = rows[0];

      // 6. Marcar todos los items activos como cancelados
      await client.query(
        `UPDATE pedido_items 
         SET estado_item = 'cancelado',
             motivo_cancelacion = $1,
             cancelado_por = $2,
             cancelado_at = NOW()
         WHERE pedido_id = $3 AND (estado_item IS NULL OR estado_item != 'cancelado')`,
        [motivo, cancelado_por, id]
      );

      // 7. Sincronizar espejos Order y OrderItem en la MISMA transacción de PostgreSQL
      await client.query(
        `UPDATE "OrderItem"
         SET "lineStatus" = 'CANCELLED'
         WHERE "orderId" = $1`,
        [id]
      );
      await client.query(
        `UPDATE "Order"
         SET status = 'CANCELLED',
             total = 0,
             subtotal = 0,
             iva = 0,
             "serviceCharge" = 0,
             "updatedAt" = NOW()
         WHERE id = $1`,
        [id]
      );

      // Gancho de prueba exclusivo para simular fallos y verificar rollback atómico
      if (process.env.NODE_ENV === "test" && (globalThis as any).__testHooks?.failInDelete) {
        throw new Error("[TEST INDUCED FAILURE] Simulación de error en DELETE tras actualización de espejos.");
      }

      await client.query("COMMIT");
    } catch (errTx) {
      await client.query("ROLLBACK");
      throw errTx;
    } finally {
      client.release();
    }

    // 8. Publicar eventos ÚNICAMENTE DESPUÉS DEL COMMIT
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

    void syncSinglePedidoToPrisma(id, pedido.negocio_id);

      return NextResponse.json({ ok: true, deleted: pedido });
    });
  } catch (err: any) {
    console.error("[DELETE /api/pedidos/[id]] Error:", err);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
