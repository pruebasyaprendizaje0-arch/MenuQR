import { prisma } from "./db";
import { pool } from "./db-pool";
import {
  computeSyncCreateTotals,
  computeSyncUpdateTotals,
  extractPricingSnapshot,
  buildMirrorPaymentDetails,
  buildReconciledPedidoMetadata,
} from "./order-pricing";

/**
 * Hooks de sincronización para pruebas controladas de concurrencia e intercalado.
 * ÚNICAMENTE activos si process.env.NODE_ENV === "test".
 */
export const __testOrderSyncHooks = {
  beforeSingleSyncLock: null as null | ((pedidoId: string) => Promise<void>),
  beforeBatchSyncLock: null as null | ((pedidoId: string) => Promise<void>),
  afterSyncReadBeforeDecision: null as null | ((pedidoId: string) => Promise<void>),
  beforeCreateOrderAttempt: null as null | ((pedidoId: string, isBatch: boolean) => Promise<void>),
  singleSyncHookCount: 0,
  batchSyncHookCount: 0,
  p2002ObservedCount: 0,
  reset() {
    this.beforeSingleSyncLock = null;
    this.beforeBatchSyncLock = null;
    this.afterSyncReadBeforeDecision = null;
    this.beforeCreateOrderAttempt = null;
    this.singleSyncHookCount = 0;
    this.batchSyncHookCount = 0;
    this.p2002ObservedCount = 0;
  },
};

/**
 * Clave canónica única para normalizar ítems y evitar duplicación entre sincronizadores.
 */
export const makeCanonicalLineKey = (name: string, price: number, notes?: string | null): string =>
  `${(name || "").trim()}__${Number(price || 0).toFixed(2)}__${(notes || "").trim()}`;

/**
 * Jerarquía estricta de estados operativos para evitar regresiones de estados avanzados o terminales.
 */
const STATUS_RANK: Record<string, number> = {
  PENDING: 1,
  PREPARING: 2,
  READY: 3,
  IN_TRANSIT: 4,
  DELIVERED: 5,
  COMPLETED: 5,
  CANCELLED: 6,
};

export function resolveSafeOrderStatus(existingStatus: string | null | undefined, newStatus: string): string {
  if (!existingStatus) return newStatus;
  const existingRank = STATUS_RANK[existingStatus] || 1;
  const newRank = STATUS_RANK[newStatus] || 1;

  // Estados terminales o avanzados no retroceden jamás
  if (existingStatus === "COMPLETED" || existingStatus === "DELIVERED" || existingStatus === "CANCELLED") {
    return existingStatus;
  }
  if (existingRank >= newRank) {
    return existingStatus;
  }
  return newStatus;
}

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

export interface RawPedidoItem {
  id: string;
  nombre?: string;
  producto_id?: string | null;
  dishId?: string | null;
  cantidad?: number | string;
  precio?: number | string;
  notas?: string | null;
  estado_item?: string | null;
  unidades_descontadas?: number | null;
  unitsDeducted?: number | null;
}

/**
 * Reconcilia de forma estable los ítems de un pedido con OrderItem en Prisma:
 * 1. Coincidencia directa 1:1 por sourcePedidoItemId existente (o id de origen).
 * 2. Enlace automático de legados (sourcePedidoItemId == null) ÚNICAMENTE en coincidencias 1:1 inequívocas.
 *    Si hay ambigüedad (multiplicidad diferente o firmas idénticas no distinguibles), marca UNRESOLVED.
 * 3. Ítems POS legítimos (sourcePedidoItemId == null sin candidatos en origen) permanecen ACTIVE.
 * 4. Orígenes nuevos o no emparejados se crean con su propio sourcePedidoItemId y lineStatus correspondiente.
 * 5. Conservación de snapshot para pedidos cobrados/prepagados (isSettled).
 */
export async function reconcileOrderItems(
  tx: any,
  orderId: string,
  rawItems: RawPedidoItem[],
  isSettled: boolean
): Promise<{
  activeItemsCount: number;
  totalItemsCount: number;
  allCancelled: boolean;
}> {
  const existingItems = await tx.orderItem.findMany({
    where: { orderId },
  });

  // Si la orden ya está cobrada / liquidada:
  // PROTECCIÓN: Solo actualizar lineStatus si en origen se canceló operativamente una línea en cocina,
  // para trazabilidad visual, sin reescribir la venta pasada ni descontar el arqueo.
  if (isSettled) {
    for (const it of rawItems) {
      if (it.estado_item === "cancelado") {
        await tx.orderItem.updateMany({
          where: {
            orderId,
            OR: [
              { sourcePedidoItemId: it.id },
              { id: it.id }
            ]
          },
          data: { lineStatus: "CANCELLED" }
        });
      }
    }
    const current = await tx.orderItem.findMany({ where: { orderId } });
    const active = current.filter((i: any) => i.lineStatus === "ACTIVE");
    return {
      activeItemsCount: active.length,
      totalItemsCount: current.length,
      allCancelled: current.length > 0 && current.every((i: any) => i.lineStatus === "CANCELLED"),
    };
  }

  const matchedExistingIds = new Set<string>();
  const matchedOriginIds = new Set<string>();

  const itemsToCreate: Array<{
    dishName: string;
    dishId?: string | null;
    unitsDeducted?: number | null;
    price: number;
    quantity: number;
    notes: string | null;
    sourcePedidoItemId: string | null;
    lineStatus: string;
  }> = [];

  const itemsToUpdate: Array<{
    id: string;
    quantity: number;
    lineStatus: string;
    sourcePedidoItemId?: string | null;
    dishId?: string | null;
    unitsDeducted?: number | null;
  }> = [];

  // FASE 1: Coincidencia inequívoca por sourcePedidoItemId ya enlazado previamente (o coincidencia directa de ID)
  for (const it of rawItems) {
    if (!it || !it.id) continue;
    const directMatch = existingItems.find(
      (e: any) => !matchedExistingIds.has(e.id) && (e.sourcePedidoItemId === it.id || e.id === it.id)
    );
    if (directMatch) {
      matchedExistingIds.add(directMatch.id);
      matchedOriginIds.add(it.id);
      const targetStatus = it.estado_item === "cancelado" ? "CANCELLED" : "ACTIVE";
      const targetQty = parseInt(String(it.cantidad)) || 1;
      itemsToUpdate.push({
        id: directMatch.id,
        quantity: targetQty,
        lineStatus: targetStatus,
        sourcePedidoItemId: it.id,
        dishId: it.producto_id || directMatch.dishId || null,
        unitsDeducted: typeof it.unidades_descontadas === "number" ? it.unidades_descontadas : (typeof directMatch.unitsDeducted === "number" ? directMatch.unitsDeducted : null),
      });
    }
  }

  // FASE 2: Enlace de ítems legados (existingItems con sourcePedidoItemId == null)
  // REGLA: "enlaza automáticamente solo coincidencias inequívocas 1 a 1, respetando multiplicidad/cantidad/ronda.
  // Si hay ambigüedad, marca UNRESOLVED y no fusiones ni asignes por orden del array.
  // Null en source no implica por sí solo UNRESOLVED: un POS legítimo antes de despacho puede seguir ACTIVE."
  const unlinkedExisting = existingItems.filter(
    (e: any) => !matchedExistingIds.has(e.id) && !e.sourcePedidoItemId
  );
  const unmatchedOrigin = rawItems.filter(
    (it: any) => it && it.id && !matchedOriginIds.has(it.id)
  );

  const makeSig = (name: string, price: number, notes?: string | null) =>
    `${(name || "").trim()}__${Number(price || 0).toFixed(2)}__${(notes || "").trim()}`;

  const existingBySig = new Map<string, typeof unlinkedExisting>();
  for (const e of unlinkedExisting) {
    const sig = makeSig(e.dishName, e.price, e.notes);
    if (!existingBySig.has(sig)) existingBySig.set(sig, []);
    existingBySig.get(sig)!.push(e);
  }

  const originBySig = new Map<string, typeof unmatchedOrigin>();
  for (const it of unmatchedOrigin) {
    const sig = makeSig(it.nombre || "Producto", Number(it.precio) || 0, it.notas);
    if (!originBySig.has(sig)) originBySig.set(sig, []);
    originBySig.get(sig)!.push(it);
  }

  for (const [sig, origins] of originBySig.entries()) {
    const existings = existingBySig.get(sig) || [];
    if (origins.length === 1 && existings.length === 1) {
      const e = existings[0];
      const it = origins[0];
      const originQty = parseInt(String(it.cantidad)) || 1;

      // Comprobar compatibilidad de cantidad y ronda:
      // Si la cantidad coincide exactamente, es un enlace 1a1 inequívoco
      if (e.quantity === originQty) {
        if (e.lineStatus === "UNRESOLVED") {
          // Si la línea ya está marcada persistida como UNRESOLVED, se conserva UNRESOLVED
          // y se absorbe el origen para evitar crear líneas ACTIVE de reemplazo espurias.
          matchedExistingIds.add(e.id);
          matchedOriginIds.add(it.id);
          itemsToUpdate.push({
            id: e.id,
            quantity: e.quantity,
            lineStatus: "UNRESOLVED",
          });
        } else {
          matchedExistingIds.add(e.id);
          matchedOriginIds.add(it.id);
          const targetStatus = it.estado_item === "cancelado" ? "CANCELLED" : "ACTIVE";
          itemsToUpdate.push({
            id: e.id,
            quantity: e.quantity,
            lineStatus: targetStatus,
            sourcePedidoItemId: it.id,
            dishId: it.producto_id || e.dishId || null,
            unitsDeducted: typeof it.unidades_descontadas === "number" ? it.unidades_descontadas : (typeof e.unitsDeducted === "number" ? e.unitsDeducted : null),
          });
        }
      } else {
        // Discrepancia de cantidad (ej: legacy qty 2 vs origen qty 1).
        // No se puede demostrar compatibilidad de cantidad/ronda -> queda No conciliado (UNRESOLVED)
        // y NO se sobrescribe la cantidad con la del origen.
        matchedExistingIds.add(e.id);
        matchedOriginIds.add(it.id); // Consumido para que no cree línea activa en Fase 3
        itemsToUpdate.push({
          id: e.id,
          quantity: e.quantity,
          lineStatus: "UNRESOLVED",
        });
      }
    } else if (existings.length > 0) {
      // AMBIGÜEDAD detectada (múltiples ítems existentes o múltiples orígenes con la misma firma)
      // Se marcan todos los existings como UNRESOLVED sin asignar por orden de array ni fusionar
      for (const e of existings) {
        if (!matchedExistingIds.has(e.id)) {
          matchedExistingIds.add(e.id);
          itemsToUpdate.push({
            id: e.id,
            quantity: e.quantity,
            lineStatus: "UNRESOLVED",
          });
        }
      }
      // CRÍTICO: Todos los orígenes de esta firma ambigua TAMBIÉN se marcan en matchedOriginIds
      // para que NUNCA pasen a Fase 3 y creen una línea nueva ACTIVE cobrable!
      for (const it of origins) {
        matchedOriginIds.add(it.id);
      }
    }
  }

  // FASE 3: Orígenes no emparejados (ítems de rondas nuevas o generados tras ambigüedad)
  for (const it of rawItems) {
    if (!it || !it.id || matchedOriginIds.has(it.id)) continue;
    matchedOriginIds.add(it.id);
    itemsToCreate.push({
      dishName: it.nombre || "Producto",
      dishId: it.producto_id || it.dishId || null,
      unitsDeducted: typeof it.unidades_descontadas === "number" ? it.unidades_descontadas : (typeof it.unitsDeducted === "number" ? it.unitsDeducted : null),
      price: Number(it.precio) || 0,
      quantity: parseInt(String(it.cantidad)) || 1,
      notes: it.notas || null,
      sourcePedidoItemId: it.id,
      lineStatus: it.estado_item === "cancelado" ? "CANCELLED" : "ACTIVE",
    });
  }

  // Ejecutar updates en orden canónico por ID para prevenir deadlocks (40P01)
  itemsToUpdate.sort((a, b) => a.id.localeCompare(b.id));
  for (const up of itemsToUpdate) {
    await tx.orderItem.update({
      where: { id: up.id },
      data: {
        quantity: up.quantity,
        lineStatus: up.lineStatus,
        ...(up.sourcePedidoItemId ? { sourcePedidoItemId: up.sourcePedidoItemId } : {}),
        ...(up.dishId ? { dishId: up.dishId } : {}),
        ...(typeof up.unitsDeducted === "number" ? { unitsDeducted: up.unitsDeducted } : {}),
      },
    });
  }

  // Ejecutar creates
  if (itemsToCreate.length > 0) {
    for (const c of itemsToCreate) {
      await tx.orderItem.create({
        data: {
          orderId,
          dishName: c.dishName,
          dishId: c.dishId ?? null,
          unitsDeducted: typeof c.unitsDeducted === "number" ? c.unitsDeducted : null,
          price: c.price,
          quantity: c.quantity,
          notes: c.notes,
          sourcePedidoItemId: c.sourcePedidoItemId,
          lineStatus: c.lineStatus,
        },
      });
    }
  }

  const current = await tx.orderItem.findMany({ where: { orderId } });
  const active = current.filter((i: any) => i.lineStatus === "ACTIVE");
  return {
    activeItemsCount: active.length,
    totalItemsCount: current.length,
    allCancelled: current.length > 0 && current.every((i: any) => i.lineStatus === "CANCELLED"),
  };
}

/**
 * Sincroniza un pedido individual de la tabla PostgreSQL `pedidos` hacia el modelo Prisma `Order`.
 * Protege la decisión y todas las escrituras bajo transacción atómica y bloqueo pesimista FOR UPDATE.
 */
export async function syncSinglePedidoToPrisma(pedidoId: string, restaurantId?: string): Promise<void> {
  try {
    const { rows: pRows } = await pool.query(
      `SELECT p.*,
              json_agg(
                json_build_object(
                  'id', pi.id,
                  'producto_id', pi.producto_id,
                  'nombre', pi.nombre,
                  'cantidad', pi.cantidad,
                  'precio', pi.precio,
                  'notas', pi.notas,
                  'es_añadido', pi.es_añadido,
                  'estado_item', pi.estado_item,
                  'unidades_descontadas', pi.unidades_descontadas
                ) ORDER BY pi.id
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

    // 1. Validación estricta de pertenencia del pedido al restaurante
    if (restaurantId && p.negocio_id !== restaurantId) {
      console.warn(`[syncSinglePedidoToPrisma] Pedido ${pedidoId} pertenece a ${p.negocio_id}, no coincide con ${restaurantId}`);
      return;
    }

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

    // Comprobación inicial de existencia fuera de transacción
    const initialCheck = await prisma.order.findUnique({
      where: { id: p.id },
      select: { id: true, restaurantId: true, isTest: true },
    });

    const pTable = p.mesa
      ? p.mesa.toLowerCase().includes("mesa") || p.mesa.toLowerCase().includes("delivery")
        ? p.mesa
        : `Mesa ${p.mesa}`
      : "Mesa";

    let isTestOrder: boolean;
    if (initialCheck && typeof (initialCheck as any).isTest === "boolean") {
      // Si existe un espejo con origen conocido, consérvalo
      if (typeof p.es_prueba === "boolean" && p.es_prueba !== (initialCheck as any).isTest) {
        console.warn(`[syncSinglePedidoToPrisma] Conflicto de marcado en pedido ${p.id}: pedidos.es_prueba (${p.es_prueba}) != Order.isTest (${(initialCheck as any).isTest}). Se conserva el origen del espejo conocido.`);
      }
      isTestOrder = (initialCheck as any).isTest;
    } else if (typeof p.es_prueba === "boolean") {
      isTestOrder = p.es_prueba;
    } else {
      console.warn(`[syncSinglePedidoToPrisma] Origen de pedido ${p.id} desconocido (es_prueba null y sin espejo con origen conocido); se deja pendiente sin crear clasificación inventada.`);
      return;
    }

    const rawItems = Array.isArray(p.items) ? p.items : [];
    const validItems = rawItems.filter((it: any) => it && it.estado_item !== "cancelado");
    const itemsToSave = validItems; // Nunca volver a rawItems si todos están cancelados
    const allItemsCancelled = rawItems.length > 0 && validItems.length === 0;
    const isOrderCancelled = p.estado === "cancelado" || p.estado === "cancelled" || allItemsCancelled;
    const pStatus = isOrderCancelled ? "CANCELLED" : mapPedidoEstadoToPrismaStatus(p.estado);

    let meta: any = {};
    try {
      meta = typeof p.metadata === "string" ? JSON.parse(p.metadata) : (p.metadata || {});
    } catch { }

    const itemsSubtotal = itemsToSave.reduce(
      (acc: number, it: any) => acc + (Number(it.precio) || 0) * (parseInt(it.cantidad) || 1),
      0
    );
    const isTableOrder = !pTable.toLowerCase().includes("delivery") && !pTable.toLowerCase().includes("llevar");
    const deliveryCost = isOrderCancelled ? 0 : (typeof meta?.costo_envio === "number" ? meta.costo_envio : 0);
    const hasCancelledItems = validItems.length < rawItems.length;
    const createTotals = computeSyncCreateTotals({
      itemsSubtotal,
      isTableOrder,
      config: rest,
      isOrderCancelled,
      hasCancelledItems,
      hasActiveItems: itemsToSave.length > 0,
      deliveryCost,
      meta,
      originTotal: Number(p.total) || 0,
    });
    const subtotalFinal = createTotals.subtotal;
    const ivaFinal = createTotals.iva;
    const serviceFinal = createTotals.serviceCharge;
    const pTotal = createTotals.total;
    const createPaymentDetails = buildMirrorPaymentDetails(null, meta, createTotals.snapshot);

    // Verificar si el pedido ya fue cobrado y cuenta con cash_shift_id explícito en metadata para este restaurante
    let shiftIdToAssign: string | null = null;
    if (meta?.cash_shift_id && typeof meta.cash_shift_id === "string") {
      const validShift = await prisma.cashShift.findFirst({
        where: { id: meta.cash_shift_id, restaurantId: rest.id },
        select: { id: true },
      });
      if (validShift) {
        shiftIdToAssign = validShift.id;
      }
    }

    // Hook de prueba antes de adquirir bloqueo en sync individual
    if (process.env.NODE_ENV === "test" && __testOrderSyncHooks.beforeSingleSyncLock) {
      __testOrderSyncHooks.singleSyncHookCount++;
      await __testOrderSyncHooks.beforeSingleSyncLock(p.id);
    }

    if (!initialCheck) {
      if (process.env.NODE_ENV === "test" && __testOrderSyncHooks.beforeCreateOrderAttempt) {
        await __testOrderSyncHooks.beforeCreateOrderAttempt(p.id, false);
      }
      // Intentar crear la orden inicialmente fuera de transacción para que un posible P2002
      // no aborte una transacción activa que impida consultas posteriores
      try {
        await prisma.order.create({
          data: {
            id: p.id,
            restaurantId: rest.id,
            cashShiftId: shiftIdToAssign,
            tableName: pTable,
            customerName: p.cliente_nombre?.trim() || null,
            customerPhone: p.cliente_telefono?.trim() || null,
            status: pStatus,
            subtotal: subtotalFinal,
            iva: ivaFinal,
            serviceCharge: serviceFinal,
            deliveryCost: deliveryCost,
            discountAmount: createTotals.discountAmount,
            seasonRateAmount: createTotals.seasonRateAmount,
            tip: createTotals.tip,
            total: pTotal,
            paymentMethod: p.metodo_pago || "efectivo",
            ...(createPaymentDetails ? { paymentDetails: createPaymentDetails } : {}),
            isTest: isTestOrder,
            createdAt: new Date(p.created_at || Date.now()),
            items: {
              create: rawItems.map((it: any) => ({
                id: it.id || undefined,
                dishName: it.nombre || "Producto",
                dishId: it.producto_id || it.dishId || null,
                unitsDeducted: typeof it.unidades_descontadas === "number" ? it.unidades_descontadas : (typeof it.unitsDeducted === "number" ? it.unitsDeducted : null),
                price: Number(it.precio) || 0,
                quantity: parseInt(it.cantidad) || 1,
                notes: it.notas || null,
                sourcePedidoItemId: it.id || null,
                lineStatus: it.estado_item === "cancelado" ? "CANCELLED" : "ACTIVE",
              })),
            },
          },
        });
        return; // Creado exitosamente
      } catch (createErr: any) {
        if (createErr?.code === "P2002") {
          if (process.env.NODE_ENV === "test") {
            __testOrderSyncHooks.p2002ObservedCount++;
          }
          // Colisión concurrente P2002: continuar hacia la transacción limpia para bloquear y recuperar
        } else {
          throw createErr;
        }
      }
    }

    // 2. Operación Atómica Coherente con Bloqueo FOR UPDATE en una transacción limpia y válida
    let syncAttempt = 0;
    while (true) {
      try {
        syncAttempt++;
        await prisma.$transaction(async (tx) => {
      // Adquirir bloqueo pesimista FOR UPDATE en Order utilizando únicamente campos reales del esquema
      const lockedOrders = await tx.$queryRaw<Array<{
        id: string;
        restaurantId: string;
        cashShiftId: string | null;
        status: string;
        paymentMethod: string;
        paymentDetails: string | null;
        total: any;
        subtotal: any;
        iva: any;
        serviceCharge: any;
        deliveryCost: any;
        discountAmount: any;
        seasonRateAmount: any;
        tip: any;
        tableName: string;
        customerName: string | null;
        customerPhone: string | null;
      }>>`
        SELECT id, "restaurantId", "cashShiftId", "status", "paymentMethod", "paymentDetails",
               total, subtotal, iva, "serviceCharge", "deliveryCost", "discountAmount", "seasonRateAmount", tip,
               "tableName", "customerName", "customerPhone"
        FROM "Order"
        WHERE id = ${p.id}
        FOR UPDATE
      `;

      if (!lockedOrders || lockedOrders.length === 0) {
        throw new Error(`[syncSinglePedidoToPrisma] Order ${p.id} no encontrada para recuperación tras P2002`);
      }
      const locked = lockedOrders[0];

      // Validación estricta de restaurante bajo bloqueo
      if (locked.restaurantId !== rest.id) {
        throw new Error(`[syncSinglePedidoToPrisma] Order ${p.id} pertenece a otro restaurante (${locked.restaurantId}) y no coincide con ${rest.id}`);
      }

      // Hook de prueba tras adquirir el lock para verificar intercalado
      if (process.env.NODE_ENV === "test" && __testOrderSyncHooks.afterSyncReadBeforeDecision) {
        await __testOrderSyncHooks.afterSyncReadBeforeDecision(p.id);
      }

      // 3. Evaluar si la orden ya fue cobrada / prepagada / liquidada
      let isPrepaidConfirmed = false;
      if (locked.paymentDetails) {
        try {
          const pd = typeof locked.paymentDetails === "string" ? JSON.parse(locked.paymentDetails) : locked.paymentDetails;
          if (pd?.pago_confirmado === true || pd?.pago_estado === "pagado") {
            isPrepaidConfirmed = true;
          }
        } catch {}
      }
      const isSettled = locked.cashShiftId != null || locked.status === "COMPLETED" || isPrepaidConfirmed;

      // 4. Reconciliación estable de ítems con OrderItem (mantiene correspondencia 1:1, cancelaciones y legados)
      const { allCancelled } = await reconcileOrderItems(
        tx,
        p.id,
        rawItems,
        isSettled
      );

      if (isSettled) {
        // PROTECCIÓN ESTRICTA DE ÓRDENES COBRADAS/PREPAGADAS/LIQUIDADAS:
        // Las órdenes cerradas en turno o con pago confirmado son financieramente inmutables.
        // No se alteran importes ni totales, no se tocan datos de pago ni turno.
        const safeStatus = resolveSafeOrderStatus(locked.status, pStatus);
        await tx.order.update({
          where: { id: p.id },
          data: {
            status: safeStatus,
            tableName: pTable,
            customerName: p.cliente_nombre?.trim() || locked.customerName,
            customerPhone: p.cliente_telefono?.trim() || locked.customerPhone,
          },
        });
        return;
      }

      // Re-consultar todos los ítems actuales para calcular totales estrictamente sobre líneas ACTIVE
      const currentItems = await tx.orderItem.findMany({ where: { orderId: p.id } });
      const activeItems = currentItems.filter((i: any) => i.lineStatus === "ACTIVE");

      const newItemsSubtotal = activeItems.reduce(
        (sum: number, it: any) => sum + (Number(it.price) || 0) * (it.quantity || 1),
        0
      );
      const v4Snapshot = extractPricingSnapshot(locked.paymentDetails) ?? extractPricingSnapshot(meta);
      const preservedTip = (v4Snapshot && allCancelled) ? 0 : (Number(locked.tip) || 0);
      const preservedDiscount = (v4Snapshot && allCancelled) ? 0 : (Number(locked.discountAmount) || 0);
      const preservedSeason = (v4Snapshot && allCancelled) ? 0 : (Number(locked.seasonRateAmount) || 0);
      const preservedDelivery = (v4Snapshot && allCancelled) ? 0 : (Number(locked.deliveryCost) || 0);

      const updateTotals = computeSyncUpdateTotals({
        activeItemsSubtotal: newItemsSubtotal,
        isTableOrder,
        config: rest,
        allCancelled,
        hasActiveItems: activeItems.length > 0,
        preservedDiscount,
        preservedSeason,
        preservedDelivery,
        preservedTip,
        snapshot: v4Snapshot,
        lockedOrderTotals: {
          subtotal: Number(locked.subtotal) || 0,
          iva: Number(locked.iva) || 0,
          serviceCharge: Number(locked.serviceCharge) || 0,
          total: Number(locked.total) || 0,
        },
      });
      const calcIvaFinal = updateTotals.iva;
      const calcServiceFinal = updateTotals.serviceCharge;
      const updatedTotal = updateTotals.total;

      const effectiveStatus = allCancelled ? "CANCELLED" : resolveSafeOrderStatus(locked.status, pStatus);
      const finalShiftId = locked.cashShiftId ?? (shiftIdToAssign ?? null);
      const updatedPaymentDetails = buildMirrorPaymentDetails(locked.paymentDetails, meta, v4Snapshot);

      await tx.order.update({
        where: { id: p.id },
        data: {
          status: effectiveStatus,
          subtotal: updateTotals.subtotal,
          iva: calcIvaFinal,
          serviceCharge: calcServiceFinal,
          total: updatedTotal,
          discountAmount: updateTotals.discountAmount,
          ...(updatedPaymentDetails ? { paymentDetails: updatedPaymentDetails } : {}),
          tableName: pTable,
          cashShiftId: finalShiftId,
          customerName: p.cliente_nombre?.trim() || locked.customerName,
          customerPhone: p.cliente_telefono?.trim() || locked.customerPhone,
        },
      });
    });
        break;
      } catch (txErr: any) {
        const isDeadlock =
          txErr?.code === "40P01" ||
          txErr?.message?.includes("deadlock detected") ||
          txErr?.message?.includes("could not serialize access");
        if (isDeadlock && syncAttempt < 3) {
          await new Promise((r) => setTimeout(r, Math.floor(Math.random() * 50) + 25 * syncAttempt));
          continue;
        }
        throw txErr;
      }
    }
  } catch (err) {
    console.error("[syncSinglePedidoToPrisma] Error:", err);
    if (process.env.NODE_ENV === "test") {
      throw err;
    }
  }
}

/**
 * Sincroniza pedidos recientes o activos de PostgreSQL `pedidos` hacia Prisma `Order`.
 * Protege cada sincronización como una operación coherente bajo FOR UPDATE.
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
                  'producto_id', pi.producto_id,
                  'nombre', pi.nombre,
                  'cantidad', pi.cantidad,
                  'precio', pi.precio,
                  'notas', pi.notas,
                  'es_añadido', pi.es_añadido,
                  'estado_item', pi.estado_item,
                  'unidades_descontadas', pi.unidades_descontadas
                ) ORDER BY pi.id
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

    let syncedCount = 0;

    for (const p of pedidos) {
      if (p.negocio_id !== rest.id) continue;

      const pTable = p.mesa
        ? p.mesa.toLowerCase().includes("mesa") || p.mesa.toLowerCase().includes("delivery")
          ? p.mesa
          : `Mesa ${p.mesa}`
        : "Mesa";

      // Consultar si existe un espejo Order previo con isTest conocido
      const existingOrder = await prisma.order.findUnique({
        where: { id: p.id },
        select: { id: true, isTest: true },
      });

      let isTestOrder: boolean;
      if (existingOrder && typeof (existingOrder as any).isTest === "boolean") {
        if (typeof p.es_prueba === "boolean" && p.es_prueba !== (existingOrder as any).isTest) {
          console.warn(`[syncPedidosToPrismaOrders] Conflicto de marcado en pedido ${p.id}: pedidos.es_prueba (${p.es_prueba}) != Order.isTest (${(existingOrder as any).isTest}). Se conserva el origen del espejo conocido.`);
        }
        isTestOrder = (existingOrder as any).isTest;
      } else if (typeof p.es_prueba === "boolean") {
        isTestOrder = p.es_prueba;
      } else {
        console.warn(`[syncPedidosToPrismaOrders] Origen de pedido ${p.id} desconocido (es_prueba null y sin espejo con origen conocido); se deja pendiente sin crear clasificación inventada.`);
        continue;
      }

      const rawItems = Array.isArray(p.items) ? p.items : [];
      const validItems = rawItems.filter((it: any) => it && it.estado_item !== "cancelado");
      const itemsToSave = validItems; // Nunca volver a rawItems si todos están cancelados
      const allItemsCancelled = rawItems.length > 0 && validItems.length === 0;
      const isOrderCancelled = p.estado === "cancelado" || p.estado === "cancelled" || allItemsCancelled;
      const pStatus = isOrderCancelled ? "CANCELLED" : mapPedidoEstadoToPrismaStatus(p.estado);

      let meta: any = {};
      try {
        meta = typeof p.metadata === "string" ? JSON.parse(p.metadata) : (p.metadata || {});
      } catch { }

      const itemsSubtotal = itemsToSave.reduce(
        (acc: number, it: any) => acc + (Number(it.precio) || 0) * (parseInt(it.cantidad) || 1),
        0
      );
      const isTableOrder = !pTable.toLowerCase().includes("delivery") && !pTable.toLowerCase().includes("llevar");
      const deliveryCost = isOrderCancelled ? 0 : (typeof meta?.costo_envio === "number" ? meta.costo_envio : 0);
      const hasCancelledItems = validItems.length < rawItems.length;
      const createTotals = computeSyncCreateTotals({
        itemsSubtotal,
        isTableOrder,
        config: rest,
        isOrderCancelled,
        hasCancelledItems,
        hasActiveItems: itemsToSave.length > 0,
        deliveryCost,
        meta,
        originTotal: Number(p.total) || 0,
      });
      const subtotalFinal = createTotals.subtotal;
      const ivaFinal = createTotals.iva;
      const serviceFinal = createTotals.serviceCharge;
      const pTotal = createTotals.total;
      const createPaymentDetails = buildMirrorPaymentDetails(null, meta, createTotals.snapshot);

      let shiftIdToAssign: string | null = null;
      if (meta?.cash_shift_id && typeof meta.cash_shift_id === "string") {
        const validShift = await prisma.cashShift.findFirst({
          where: { id: meta.cash_shift_id, restaurantId: rest.id },
          select: { id: true },
        });
        if (validShift) {
          shiftIdToAssign = validShift.id;
        }
      }

      // Hook de prueba en lote para pedido objetivo
      if (process.env.NODE_ENV === "test" && __testOrderSyncHooks.beforeBatchSyncLock) {
        __testOrderSyncHooks.batchSyncHookCount++;
        await __testOrderSyncHooks.beforeBatchSyncLock(p.id);
      }

      // Sincronización atómica individual para cada pedido en el lote bajo FOR UPDATE
      try {
        const initialCheck = await prisma.order.findUnique({
          where: { id: p.id },
          select: { id: true, restaurantId: true },
        });

        if (!initialCheck) {
          if (process.env.NODE_ENV === "test" && __testOrderSyncHooks.beforeCreateOrderAttempt) {
            await __testOrderSyncHooks.beforeCreateOrderAttempt(p.id, true);
          }
          try {
            await prisma.order.create({
              data: {
                id: p.id,
                restaurantId: rest.id,
                cashShiftId: shiftIdToAssign,
                tableName: pTable,
                customerName: p.cliente_nombre?.trim() || null,
                customerPhone: p.cliente_telefono?.trim() || null,
                status: pStatus,
                subtotal: subtotalFinal,
                iva: ivaFinal,
                serviceCharge: serviceFinal,
                deliveryCost: deliveryCost,
                discountAmount: createTotals.discountAmount,
                seasonRateAmount: createTotals.seasonRateAmount,
                tip: createTotals.tip,
                total: pTotal,
                paymentMethod: p.metodo_pago || "efectivo",
                ...(createPaymentDetails ? { paymentDetails: createPaymentDetails } : {}),
                isTest: isTestOrder,
                createdAt: new Date(p.created_at || Date.now()),
                items: {
                  create: rawItems.map((it: any) => ({
                    id: it.id || undefined,
                    dishName: it.nombre || "Producto",
                    dishId: it.producto_id || it.dishId || null,
                    unitsDeducted: typeof it.unidades_descontadas === "number" ? it.unidades_descontadas : (typeof it.unitsDeducted === "number" ? it.unitsDeducted : null),
                    price: Number(it.precio) || 0,
                    quantity: parseInt(it.cantidad) || 1,
                    notes: it.notas || null,
                    sourcePedidoItemId: it.id || null,
                    lineStatus: it.estado_item === "cancelado" ? "CANCELLED" : "ACTIVE",
                  })),
                },
              },
            });
            syncedCount++;
            continue;
          } catch (createErr: any) {
            if (createErr?.code === "P2002") {
              if (process.env.NODE_ENV === "test") {
                __testOrderSyncHooks.p2002ObservedCount++;
              }
              // Colisión concurrente
            } else {
              throw createErr;
            }
          }
        }

        // Transacción válida y limpia para bloquear y recuperar
        await prisma.$transaction(async (tx) => {
          const lockedOrders = await tx.$queryRaw<Array<{
            id: string;
            restaurantId: string;
            cashShiftId: string | null;
            status: string;
            paymentMethod: string;
            paymentDetails: string | null;
            total: any;
            subtotal: any;
            iva: any;
            serviceCharge: any;
            deliveryCost: any;
            discountAmount: any;
            seasonRateAmount: any;
            tip: any;
            tableName: string;
            customerName: string | null;
            customerPhone: string | null;
          }>>`
            SELECT id, "restaurantId", "cashShiftId", "status", "paymentMethod", "paymentDetails",
                   total, subtotal, iva, "serviceCharge", "deliveryCost", "discountAmount", "seasonRateAmount", tip,
                   "tableName", "customerName", "customerPhone"
            FROM "Order"
            WHERE id = ${p.id}
            FOR UPDATE
          `;

          if (!lockedOrders || lockedOrders.length === 0) {
            throw new Error(`[syncPedidosToPrismaOrders] Order ${p.id} no encontrada para recuperación tras P2002`);
          }
          const locked = lockedOrders[0];

          if (locked.restaurantId !== rest.id) {
            throw new Error(`[syncPedidosToPrismaOrders] Order ${p.id} pertenece a otro restaurante (${locked.restaurantId}) y no coincide con ${rest.id}`);
          }

          let isPrepaidConfirmed = false;
          if (locked.paymentDetails) {
            try {
              const pd = typeof locked.paymentDetails === "string" ? JSON.parse(locked.paymentDetails) : locked.paymentDetails;
              if (pd?.pago_confirmado === true || pd?.pago_estado === "pagado") {
                isPrepaidConfirmed = true;
              }
            } catch {}
          }
          const isSettled = locked.cashShiftId != null || locked.status === "COMPLETED" || isPrepaidConfirmed;

          // 4. Reconciliación estable de ítems con OrderItem (mantiene correspondencia 1:1, cancelaciones y legados)
          const { allCancelled } = await reconcileOrderItems(
            tx,
            p.id,
            rawItems,
            isSettled
          );

          if (isSettled) {
            // PROTECCIÓN ESTRICTA DE ÓRDENES COBRADAS/PREPAGADAS/LIQUIDADAS:
            // No alterar líneas, totales ni datos financieros
            const safeStatus = resolveSafeOrderStatus(locked.status, pStatus);
            await tx.order.update({
              where: { id: p.id },
              data: {
                status: safeStatus,
                tableName: pTable,
                customerName: p.cliente_nombre?.trim() || locked.customerName,
                customerPhone: p.cliente_telefono?.trim() || locked.customerPhone,
              },
            });
            return;
          }

          // Re-consultar todos los ítems actuales para calcular totales estrictamente sobre líneas ACTIVE
          const currentItems = await tx.orderItem.findMany({ where: { orderId: p.id } });
          const activeItems = currentItems.filter((i: any) => i.lineStatus === "ACTIVE");

          const newItemsSubtotal = activeItems.reduce(
            (sum: number, it: any) => sum + (Number(it.price) || 0) * (it.quantity || 1),
            0
          );
          const v4Snapshot = extractPricingSnapshot(locked.paymentDetails) ?? extractPricingSnapshot(meta);
          const preservedTip = (v4Snapshot && allCancelled) ? 0 : (Number(locked.tip) || 0);
          const preservedDiscount = (v4Snapshot && allCancelled) ? 0 : (Number(locked.discountAmount) || 0);
          const preservedSeason = (v4Snapshot && allCancelled) ? 0 : (Number(locked.seasonRateAmount) || 0);
          const preservedDelivery = (v4Snapshot && allCancelled) ? 0 : (Number(locked.deliveryCost) || 0);

          const updateTotals = computeSyncUpdateTotals({
            activeItemsSubtotal: newItemsSubtotal,
            isTableOrder,
            config: rest,
            allCancelled,
            hasActiveItems: activeItems.length > 0,
            preservedDiscount,
            preservedSeason,
            preservedDelivery,
            preservedTip,
            snapshot: v4Snapshot,
            lockedOrderTotals: {
              subtotal: Number(locked.subtotal) || 0,
              iva: Number(locked.iva) || 0,
              serviceCharge: Number(locked.serviceCharge) || 0,
              total: Number(locked.total) || 0,
            },
          });
          const calcIvaFinal = updateTotals.iva;
          const calcServiceFinal = updateTotals.serviceCharge;
          const updatedTotal = updateTotals.total;

          const effectiveStatus = allCancelled ? "CANCELLED" : resolveSafeOrderStatus(locked.status, pStatus);
          const finalShiftId = locked.cashShiftId ?? (shiftIdToAssign ?? null);
          const updatedPaymentDetails = buildMirrorPaymentDetails(locked.paymentDetails, meta, v4Snapshot);

          await tx.order.update({
            where: { id: p.id },
            data: {
              status: effectiveStatus,
              subtotal: updateTotals.subtotal,
              iva: calcIvaFinal,
              serviceCharge: calcServiceFinal,
              total: updatedTotal,
              discountAmount: updateTotals.discountAmount,
              ...(updatedPaymentDetails ? { paymentDetails: updatedPaymentDetails } : {}),
              tableName: pTable,
              cashShiftId: finalShiftId,
              customerName: p.cliente_nombre?.trim() || locked.customerName,
              customerPhone: p.cliente_telefono?.trim() || locked.customerPhone,
            },
          });
        });
        syncedCount++;
      } catch (orderErr: any) {
        console.warn(`[syncPedidosToPrismaOrders] Error en orden ${p.id}:`, orderErr?.message || orderErr);
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
        kdsDispatched: false,
        status: { not: "CANCELLED" },
        createdAt: { gte: thirtyMinutesAgo },
      },
      include: { items: true },
      take: 20,
    });

    if (!pendingOrders || pendingOrders.length === 0) return 0;

    let reconciledCount = 0;
    for (const ord of pendingOrders) {
      // 1. REGLA ESTRICTA DE RECUPERACIÓN AUTOMÁTICA:
      // Si la comanda tiene conciliación pendiente (alguna línea UNRESOLVED),
      // se mantiene pendiente hasta una resolución explícita válida.
      // reconcileUndispatchedOrders NO debe crear orígenes en pedido_items,
      // NO debe asignar vínculos, NO debe volver ACTIVE ninguna línea UNRESOLVED,
      // y NO debe marcar su despacho como completado (kdsDispatched = false).
      const hasPendingReconciliation = ord.items.some((it: any) => it.lineStatus === "UNRESOLVED");
      if (hasPendingReconciliation) {
        continue;
      }

      // 2. Despachar únicamente ítems legítimos ACTIVE que aún no tienen sourcePedidoItemId vinculado en PostgreSQL
      const undispatchedItems = ord.items.filter((it: any) => !it.sourcePedidoItemId && it.lineStatus === "ACTIVE");
      if (undispatchedItems.length === 0) {
        // Si no quedan ítems activos por despachar y no hay líneas UNRESOLVED, asegurar kdsDispatched = true
        await prisma.order.update({
          where: { id: ord.id },
          data: { kdsDispatched: true },
        });
        continue;
      }

      const client = await pool.connect();
      try {
        await client.query("BEGIN");

        // Verificar si la comanda ya existe en pedidos de PostgreSQL (conservando metadata existente)
        const { rows: existingPedRows } = await client.query(
          `SELECT id, es_prueba, metadata FROM pedidos WHERE id = $1::uuid LIMIT 1`,
          [ord.id]
        );

        const metaObj = buildReconciledPedidoMetadata(
          ord,
          existingPedRows.length > 0 ? existingPedRows[0].metadata : undefined
        );

        if (existingPedRows.length > 0) {
          const currentEsPrueba = existingPedRows[0].es_prueba;
          const orderIsTest = ord.isTest;

          if (currentEsPrueba === null || typeof currentEsPrueba === "undefined" || typeof orderIsTest !== "boolean" || currentEsPrueba !== orderIsTest) {
            if (currentEsPrueba === null || typeof currentEsPrueba === "undefined" || typeof orderIsTest !== "boolean") {
              console.warn(
                `[reconcileUndispatchedOrders] Deteniendo recuperación de orden ${ord.id}: marcado desconocido detectado (pedidos.es_prueba=${currentEsPrueba}, Order.isTest=${orderIsTest}). No se modifican datos ni se marca despacho.`
              );
            } else {
              console.warn(
                `[reconcileUndispatchedOrders] Deteniendo recuperación de orden ${ord.id}: conflicto de marcado detectado (pedidos.es_prueba=${currentEsPrueba} != Order.isTest=${orderIsTest}). No se modifican datos ni se marca despacho.`
              );
            }
            await client.query("ROLLBACK");
            continue;
          }

          await client.query(
            `UPDATE pedidos SET total = $1, metadata = $2 WHERE id = $3::uuid`,
            [ord.total, JSON.stringify(metaObj), ord.id]
          );
        } else {
          // Inserción de orden nueva que no existía en pedidos
          if (typeof ord.isTest !== "boolean") {
            console.warn(
              `[reconcileUndispatchedOrders] Deteniendo recuperación de orden ${ord.id}: marcado desconocido en Order (isTest no booleano). No se modifican datos ni se marca despacho.`
            );
            await client.query("ROLLBACK");
            continue;
          }

          await client.query(
            `INSERT INTO pedidos (id, negocio_id, mesa, camarero_id, estado, total, cliente_nombre, cliente_telefono, vertical, metadata, es_prueba)
             VALUES ($1::uuid, $2, $3, NULL, 'nuevo', $4, $5, $6, 'menuqr', $7, $8)
             RETURNING id`,
            [
              ord.id,
              ord.restaurantId,
              ord.tableName,
              ord.total,
              ord.customerName,
              ord.customerPhone,
              JSON.stringify(metaObj),
              ord.isTest,
            ]
          );
        }

        // Despachar únicamente ítems ACTIVE que aún no tienen sourcePedidoItemId vinculado en PostgreSQL
        const hasExistingDispatched = ord.items.some((it: any) => Boolean(it.sourcePedidoItemId));

        for (const it of undispatchedItems) {
          const isAddedRound = hasExistingDispatched;
          const piRes = await client.query(
            `INSERT INTO pedido_items (pedido_id, producto_id, nombre, cantidad, precio, notas, es_añadido, estado_item, unidades_descontadas)
             VALUES ($1, $2, $3, $4, $5, $6, $7, 'nuevo', $8)
             RETURNING id`,
            [
              ord.id,
              it.dishId || null,
              it.dishName,
              it.quantity,
              it.price,
              it.notes || null,
              isAddedRound,
              typeof it.unitsDeducted === "number" ? it.unitsDeducted : null,
            ]
          );

          if (piRes.rows.length > 0) {
            const piId = String(piRes.rows[0].id);
            await client.query(
              `UPDATE "OrderItem"
               SET "sourcePedidoItemId" = $1, "lineStatus" = 'ACTIVE'
               WHERE id = $2 AND "lineStatus" = 'ACTIVE'`,
              [piId, it.id]
            );
          }
        }

        await client.query(
          `UPDATE "Order"
           SET "kdsDispatched" = true, "updatedAt" = NOW()
           WHERE id = $1`,
          [ord.id]
        );

        await client.query("COMMIT");

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
