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
  if (norm === "preparando" || norm === "preparing" || norm === "listo") return "PREPARING";
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
      select: { id: true, testMode: true },
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

    const existing = await prisma.order.findUnique({
      where: { id: p.id },
      select: { id: true, status: true, total: true },
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
          subtotal: pTotal,
          iva: 0.0,
          serviceCharge: 0.0,
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
      });
    } else {
      await prisma.order.update({
        where: { id: p.id },
        data: {
          status: pStatus,
          total: pTotal,
          tableName: pTable,
          customerName: p.cliente_nombre?.trim() || null,
          isTest: isTestOrder,
        },
      });
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
      select: { id: true, testMode: true },
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

      if (!existing) {
        const rawItems = Array.isArray(p.items) ? p.items : [];
        const validItems = rawItems.filter((it: any) => it && it.estado_item !== "cancelado");
        const itemsToSave = validItems.length > 0 ? validItems : rawItems;

        await prisma.order.create({
          data: {
            id: p.id,
            restaurantId: rest.id,
            tableName: pTable,
            customerName: p.cliente_nombre?.trim() || null,
            customerPhone: p.cliente_telefono?.trim() || null,
            status: pStatus,
            subtotal: pTotal,
            iva: 0.0,
            serviceCharge: 0.0,
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
        });
        syncedCount++;
      } else {
        if (existing.status !== pStatus || existing.total !== pTotal) {
          await prisma.order.update({
            where: { id: p.id },
            data: {
              status: pStatus,
              total: pTotal,
            },
          });
          syncedCount++;
        }
      }
    }

    return syncedCount;
  } catch (err) {
    console.error("[syncPedidosToPrismaOrders] Error:", err);
    return 0;
  }
}
