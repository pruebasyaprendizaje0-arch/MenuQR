import { prisma } from "./db";
import { pool } from "./db-pool";

/**
 * Mapea los estados de la tabla PostgreSQL `pedidos` hacia el enum de estados de Prisma `Order`.
 */
export function mapPedidoEstadoToPrismaStatus(estado: string | null | undefined): string {
  if (!estado) return "PENDING";
  const norm = estado.toLowerCase().trim();
  if (norm === "pagado" || norm === "completed") return "COMPLETED";
  if (norm === "cancelado" || norm === "cancelled") return "CANCELLED";
  if (norm === "entregado" || norm === "delivered") return "DELIVERED";
  if (norm === "en_camino" || norm === "in_transit") return "IN_TRANSIT";
  if (norm === "en_cocina" || norm === "preparando" || norm === "preparing") return "PREPARING";
  if (norm === "listo" || norm === "ready") return "READY";
  return "PENDING";
}

/**
 * Sincroniza un pedido individual de la tabla PostgreSQL `pedidos` hacia el modelo Prisma `Order`
 */
export async function syncSinglePedidoToPrisma(pedidoId: string, restaurantId?: string): Promise<void> {
  try {
    const { rows: pRows } = await pool.query(
      `SELECT p.*,
              json_agg(
                json_build_object(
                  'id', pi.id,
                  'nombre', pi.nombre,
                  'cantidad', pi.cantidad,
                  'precio', pi.precio,
                  'estado_item', pi.estado_item
                )
              ) FILTER (WHERE pi.id IS NOT NULL) as items
       FROM pedidos p
       LEFT JOIN pedido_items pi ON pi.pedido_id = p.id
       WHERE p.id = $1
       GROUP BY p.id`,
      [pedidoId]
    );

    if (pRows.length === 0) return;
    const p = pRows[0];
    const targetRestId = restaurantId || p.negocio_id;
    if (!targetRestId) return;

    const rest = await prisma.restaurant.findUnique({
      where: { id: targetRestId },
      select: {
        id: true,
        testMode: true,
        ivaPercent: true,
        servicePercent: true,
        ivaOnTable: true,
        serviceOnTable: true,
        ivaOnTakeout: true,
        serviceOnTakeout: true,
      },
    });
    if (!rest) return;

    const pTotal = Number(p.total) || 0;
    const pStatus = mapPedidoEstadoToPrismaStatus(p.estado);

    const pTable = p.mesa
      ? p.mesa.toLowerCase().includes("mesa") || p.mesa.toLowerCase().includes("delivery")
        ? p.mesa
        : `Mesa ${p.mesa}`
      : "Mesa";

    const isTestOrder = rest.testMode ? true : (typeof p.es_prueba === "boolean" ? p.es_prueba : false);

    const rawItems = Array.isArray(p.items) ? p.items : [];
    const validItems = rawItems.filter((it: any) => it && it.estado_item !== "cancelado");
    const itemsToSave = validItems.length > 0 ? validItems : rawItems;

    let meta: any = {};
    try {
      meta = typeof p.metadata === "string" ? JSON.parse(p.metadata) : (p.metadata || {});
    } catch { }

    const itemsSubtotal = itemsToSave.reduce(
      (acc: number, it: any) => acc + (Number(it.precio) || 0) * (parseInt(it.cantidad) || 1),
      0
    );
    const isTableOrder = !pTable.toLowerCase().includes("delivery") && !pTable.toLowerCase().includes("llevar");
    const ivaIncluded = rest.ivaOnTable === false
      ? false
      : (isTableOrder ? (rest.ivaOnTable ?? true) : (rest.ivaOnTakeout ?? true));
    const serviceIncluded = rest.serviceOnTable === false
      ? false
      : (isTableOrder ? (rest.serviceOnTable ?? true) : (rest.serviceOnTakeout ?? false));

    const calcIva = (rest.ivaPercent > 0 && !ivaIncluded)
      ? Math.round(itemsSubtotal * (rest.ivaPercent / 100) * 100) / 100
      : 0;
    const calcService = (isTableOrder && rest.servicePercent > 0 && !serviceIncluded)
      ? Math.round(itemsSubtotal * (rest.servicePercent / 100) * 100) / 100
      : 0;
    const deliveryCost = typeof meta?.costo_envio === "number" ? meta.costo_envio : 0;

    const subtotalFinal = typeof meta?.subtotal === "number" ? meta.subtotal : itemsSubtotal;
    const ivaFinal = typeof meta?.iva === "number" ? meta.iva : calcIva;
    const serviceFinal = typeof meta?.service_charge === "number" ? meta.service_charge : calcService;

    const existing = await prisma.order.findUnique({
      where: { id: p.id },
      include: { items: true },
    });

    if (!existing) {
      await prisma.order.create({
        data: {
          id: p.id,
          restaurantId: rest.id,
          tableName: pTable,
          customerName: p.cliente_nombre?.trim() || null,
          customerPhone: p.cliente_telefono?.trim() || null,
          status: pStatus,
          subtotal: subtotalFinal,
          iva: ivaFinal,
          serviceCharge: serviceFinal,
          deliveryCost: deliveryCost,
          tip: 0.0,
          total: pTotal,
          paymentMethod: p.metodo_pago || "efectivo",
          isTest: isTestOrder,
          createdAt: new Date(p.created_at || Date.now()),
          items: {
            create: itemsToSave.map((it: any) => ({
              dishName: it.nombre || "Producto",
              price: Number(it.precio) || 0,
              quantity: parseInt(it.cantidad) || 1,
              notes: it.notas || null,
            })),
          },
        },
      });
    } else {
      // Mapear cantidades agregadas por clave canónica desde pedido_items
      const makeLineKey = (name: string, price: number, notes?: string | null) =>
        `${(name || "").trim()}__${Number(price || 0).toFixed(2)}__${(notes || "").trim()}`;

      const targetItemsMap = new Map<string, { name: string; price: number; quantity: number; notes: string | null }>();
      for (const it of itemsToSave) {
        const k = makeLineKey(it.nombre, it.precio, it.notas);
        const qty = parseInt(it.cantidad) || 1;
        const curr = targetItemsMap.get(k);
        if (curr) {
          curr.quantity += qty;
        } else {
          targetItemsMap.set(k, {
            name: it.nombre || "Producto",
            price: Number(it.precio) || 0,
            quantity: qty,
            notes: it.notas || null,
          });
        }
      }

      // Mapear ítems existentes en Prisma Order
      const existingItemByKey = new Map<string, typeof existing.items[0]>();
      const existingQtyMap = new Map<string, number>();
      for (const e of existing.items) {
        const k = makeLineKey(e.dishName, e.price, e.notes);
        existingItemByKey.set(k, e);
        existingQtyMap.set(k, (existingQtyMap.get(k) || 0) + e.quantity);
      }

      // Detectar mutaciones en ítems (tanto platos nuevos como aumento de cantidad de líneas existentes)
      let itemsMutated = false;
      const itemsToCreate: Array<{ dishName: string; price: number; quantity: number; notes: string | null }> = [];
      const itemsToUpdate: Array<{ id: string; quantity: number }> = [];

      for (const [k, target] of targetItemsMap.entries()) {
        const existQty = existingQtyMap.get(k) || 0;
        if (existQty === 0) {
          itemsMutated = true;
          itemsToCreate.push({
            dishName: target.name,
            price: target.price,
            quantity: target.quantity,
            notes: target.notes,
          });
        } else if (target.quantity > existQty) {
          itemsMutated = true;
          const existItem = existingItemByKey.get(k);
          if (existItem) {
            itemsToUpdate.push({ id: existItem.id, quantity: target.quantity });
          }
        }
      }

      if (!itemsMutated) {
        // Si no hay platos añadidos ni aumento de cantidades, actualizar ÚNICAMENTE estado y mesa
        await prisma.order.update({
          where: { id: p.id },
          data: {
            status: pStatus,
            tableName: pTable,
          },
        });
      } else {
        // Si hay adiciones o aumentos de cantidad, actualizar OrderItem y recalcular totales
        for (const up of itemsToUpdate) {
          await prisma.orderItem.update({
            where: { id: up.id },
            data: { quantity: up.quantity },
          });
        }

        const preservedTip = existing.tip || 0;
        const preservedDiscount = existing.discountAmount || 0;
        const preservedDelivery = existing.deliveryCost || 0;

        const newItemsSubtotal = itemsToSave.reduce(
          (sum: number, it: any) => sum + (Number(it.precio) || 0) * (parseInt(it.cantidad) || 1),
          0
        );
        const subtotalAfterCoupon = Math.max(0, newItemsSubtotal - preservedDiscount);

        const roundMoney = (val: number) => Math.round((val + Number.EPSILON) * 100) / 100;

        const calcIva = (rest.ivaPercent > 0 && !ivaIncluded)
          ? roundMoney(subtotalAfterCoupon * (rest.ivaPercent / 100))
          : 0;
        const calcService = (isTableOrder && rest.servicePercent > 0 && !serviceIncluded)
          ? roundMoney(subtotalAfterCoupon * (rest.servicePercent / 100))
          : 0;

        const updatedTotal = roundMoney(subtotalAfterCoupon + calcIva + calcService + preservedDelivery + preservedTip);

        await prisma.order.update({
          where: { id: p.id },
          data: {
            status: pStatus,
            subtotal: newItemsSubtotal,
            iva: calcIva,
            serviceCharge: calcService,
            total: updatedTotal,
            tableName: pTable,
            items: itemsToCreate.length > 0 ? {
              create: itemsToCreate.map((it) => ({
                dishName: it.dishName,
                price: it.price,
                quantity: it.quantity,
                notes: it.notes,
              })),
            } : undefined,
          },
        });
      }
    }
  } catch (err) {
    console.error("[syncSinglePedidoToPrisma] Error:", err);
  }
}

/**
 * Sincroniza pedidos recientes o activos de PostgreSQL `pedidos` hacia Prisma `Order`.
 * Optimizado para alta velocidad: filtra por los últimos 3 días o pedidos activos y limita a 100 registros.
 */
export async function syncPedidosToPrismaOrders(restaurantId: string): Promise<number> {
  try {
    const rest = await prisma.restaurant.findUnique({
      where: { id: restaurantId },
      select: {
        id: true,
        testMode: true,
        ivaPercent: true,
        servicePercent: true,
        ivaOnTable: true,
        serviceOnTable: true,
        ivaOnTakeout: true,
        serviceOnTakeout: true,
      },
    });
    if (!rest) return 0;

    const { rows: pedidos } = await pool.query(
      `SELECT p.*,
              json_agg(
                json_build_object(
                  'id', pi.id,
                  'nombre', pi.nombre,
                  'cantidad', pi.cantidad,
                  'precio', pi.precio,
                  'estado_item', pi.estado_item
                )
              ) FILTER (WHERE pi.id IS NOT NULL) as items
       FROM pedidos p
       LEFT JOIN pedido_items pi ON pi.pedido_id = p.id
       WHERE p.negocio_id = $1
         AND (p.created_at >= NOW() - INTERVAL '3 days' OR p.estado NOT IN ('pagado', 'cancelado'))
       GROUP BY p.id
       ORDER BY p.created_at DESC
       LIMIT 100`,
      [restaurantId]
    );

    if (!pedidos || pedidos.length === 0) return 0;

    const existingOrders = await prisma.order.findMany({
      where: {
        restaurantId,
        createdAt: { gte: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000) },
      },
      select: { id: true, status: true, total: true, isTest: true },
    });
    const existingMap = new Map(existingOrders.map((o) => [o.id, o]));

    let syncedCount = 0;

    for (const p of pedidos) {
      const pTotal = Number(p.total) || 0;
      const pStatus = mapPedidoEstadoToPrismaStatus(p.estado);

      const pTable = p.mesa
        ? p.mesa.toLowerCase().includes("mesa") || p.mesa.toLowerCase().includes("delivery")
          ? p.mesa
          : `Mesa ${p.mesa}`
        : "Mesa";

      const isTestOrder = rest.testMode ? true : (typeof p.es_prueba === "boolean" ? p.es_prueba : false);

      const existing = existingMap.get(p.id);

      let meta: any = {};
      try {
        meta = typeof p.metadata === "string" ? JSON.parse(p.metadata) : (p.metadata || {});
      } catch { }

      const rawItems = Array.isArray(p.items) ? p.items : [];
      const validItems = rawItems.filter((it: any) => it && it.estado_item !== "cancelado");
      const itemsToSave = validItems.length > 0 ? validItems : rawItems;

      const itemsSubtotal = itemsToSave.reduce(
        (acc: number, it: any) => acc + (Number(it.precio) || 0) * (parseInt(it.cantidad) || 1),
        0
      );
      const isTableOrder = !pTable.toLowerCase().includes("delivery") && !pTable.toLowerCase().includes("llevar");
      const ivaIncluded = rest.ivaOnTable === false
        ? false
        : (isTableOrder ? (rest.ivaOnTable ?? true) : (rest.ivaOnTakeout ?? true));
      const serviceIncluded = rest.serviceOnTable === false
        ? false
        : (isTableOrder ? (rest.serviceOnTable ?? true) : (rest.serviceOnTakeout ?? false));

      const calcIva = (rest.ivaPercent > 0 && !ivaIncluded)
        ? Math.round(itemsSubtotal * (rest.ivaPercent / 100) * 100) / 100
        : 0;
      const calcService = (isTableOrder && rest.servicePercent > 0 && !serviceIncluded)
        ? Math.round(itemsSubtotal * (rest.servicePercent / 100) * 100) / 100
        : 0;
      const deliveryCost = typeof meta?.costo_envio === "number" ? meta.costo_envio : 0;

      const subtotalFinal = typeof meta?.subtotal === "number" ? meta.subtotal : itemsSubtotal;
      const ivaFinal = typeof meta?.iva === "number" ? meta.iva : calcIva;
      const serviceFinal = typeof meta?.service_charge === "number" ? meta.service_charge : calcService;

      try {
        await prisma.order.upsert({
          where: { id: p.id },
          create: {
            id: p.id,
            restaurantId: rest.id,
            tableName: pTable,
            customerName: p.cliente_nombre?.trim() || null,
            customerPhone: p.cliente_telefono?.trim() || null,
            status: pStatus,
            subtotal: subtotalFinal,
            iva: ivaFinal,
            serviceCharge: serviceFinal,
            deliveryCost: deliveryCost,
            tip: 0.0,
            total: pTotal,
            paymentMethod: p.metodo_pago || "efectivo",
            isTest: isTestOrder,
            createdAt: new Date(p.created_at || Date.now()),
            items: {
              create: itemsToSave.map((it: any) => ({
                dishName: it.nombre || "Producto",
                price: Number(it.precio) || 0,
                quantity: parseInt(it.cantidad) || 1,
              })),
            },
          },
          update: {
            status: pStatus,
            subtotal: subtotalFinal,
            iva: ivaFinal,
            serviceCharge: serviceFinal,
            deliveryCost: deliveryCost,
            total: pTotal,
            customerName: p.cliente_nombre?.trim() || undefined,
            customerPhone: p.cliente_telefono?.trim() || undefined,
          },
        });
        syncedCount++;
      } catch (itemErr: any) {
        if (itemErr?.code === "P2002") {
          // Clave duplicada por concurrencia paralela en base de datos: ignorar de forma segura
          continue;
        }
        console.warn(`[syncPedidosToPrismaOrders] Error en pedido ${p.id}:`, itemErr?.message || itemErr);
      }
    }

    return syncedCount;
  } catch (err) {
    console.error("[syncPedidosToPrismaOrders] Error:", err);
    return 0;
  }
}

/**
 * Reconciliador pasivo: recupera pedidos web de los últimos 30 minutos marcados explícitamente como
 * pendientes de despacho hacia el KDS (pedidos), estrictamente para el negocio consultado y no cancelados.
 *
 * DOCUMENTACIÓN OPERATIVA:
 * Esta reconciliación en segundo plano inserta la orden directamente en PostgreSQL (pedidos / pedido_items),
 * pero NO emite avisos sonoros en el navegador ni notificaciones push a Telegram. La confirmación visual y
 * operativa de estos pedidos recuperados en la pantalla de cocina queda pendiente de comprobarse en la prueba
 * real de cocina en el entorno integrado.
 */
export async function reconcileUndispatchedOrders(restaurantId: string): Promise<number> {
  if (!restaurantId) return 0;
  try {
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
    const pendingOrders = await prisma.order.findMany({
      where: {
        restaurantId,
        claimHash: { not: null },
        kdsDispatched: false,
        status: { not: "CANCELLED" },
        createdAt: { gte: thirtyMinutesAgo },
      },
      include: { items: true },
      take: 10,
    });

    if (!pendingOrders || pendingOrders.length === 0) return 0;

    let reconciledCount = 0;
    for (const ord of pendingOrders) {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const metaObj = {
          tipo_pedido: ord.tableName === "Domicilio" ? "delivery" : ord.tableName === "Llevar" ? "llevar" : "mesa",
          tipo_entrega: ord.tableName === "Domicilio" ? "DOMICILIO" : ord.tableName === "Llevar" ? "RETIRO" : "SALON",
          cliente_direccion: ord.customerAddress || null,
          costo_envio: ord.deliveryCost || 0,
          subtotal: ord.subtotal,
          iva: ord.iva,
          service_charge: ord.serviceCharge,
          notas_entrega: null,
          reconciled: true,
        };

        const insertRes = await client.query(
          `INSERT INTO pedidos (id, negocio_id, mesa, camarero_id, estado, total, cliente_nombre, cliente_telefono, vertical, metadata)
           VALUES ($1::uuid, $2, $3, NULL, 'nuevo', $4, $5, $6, 'menuqr', $7)
           ON CONFLICT (id) DO NOTHING
           RETURNING id`,
          [
            ord.id,
            ord.restaurantId,
            ord.tableName,
            ord.total,
            ord.customerName,
            ord.customerPhone,
            JSON.stringify(metaObj),
          ]
        );

        if (insertRes.rows.length > 0) {
          for (const it of ord.items) {
            await client.query(
              `INSERT INTO pedido_items (pedido_id, nombre, cantidad, precio, notas, es_añadido, estado_item)
               VALUES ($1, $2, $3, $4, $5, false, 'nuevo')`,
              [ord.id, it.dishName, it.quantity, it.price, it.notes || null]
            );
          }
        }

        await client.query("COMMIT");

        await prisma.order.update({
          where: { id: ord.id },
          data: { kdsDispatched: true },
        });

        reconciledCount++;
      } catch (e) {
        await client.query("ROLLBACK");
        console.error("[reconcileUndispatchedOrders] Error en orden:", ord.id, e);
      } finally {
        client.release();
      }
    }

    return reconciledCount;
  } catch (err) {
    console.error("[reconcileUndispatchedOrders] Error general:", err);
    return 0;
  }
}
