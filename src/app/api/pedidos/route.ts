import { NextRequest, NextResponse } from "next/server";
import { pool, ensureDbTables } from "@/lib/db-pool";
import { emitNuevoPedido, emitItemsAñadidos, emitPedidoActualizado, emitNuevaCita, emitNuevaReserva } from "@/lib/socket-server";
import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { deductStockUniversal } from "@/lib/stock-service";
import { sendTelegramAlert } from "@/lib/telegram-alert";
import { notificarSuperAdmin } from "@/lib/telegramAdmin";
import { syncSinglePedidoToPrisma, reconcileUndispatchedOrders } from "@/lib/order-sync";
import { verifyKdsDispatchToken, signTableSessionToken, verifyTableSessionToken } from "@/lib/jwt";
import { getUserSession, getSuperAdminSession } from "@/lib/auth";
import { verifyOrderStaffAuth, verifyTableSessionAuth, extractTableToken, TableAuthContext } from "@/lib/order-auth";
import { cookies } from "next/headers";
import { __testDispatchHooks } from "@/lib/caja-test-hooks";
import {
  calculatePostOrderTotals,
  buildPricingSnapshot,
  calculateV4OrderTotals,
  extractPricingSnapshot,
  attachPricingSnapshot,
  stripClientPricingFields,
} from "@/lib/order-pricing";

export const dynamic = "force-dynamic";

// Helper para limpiar teléfono de WhatsApp (Ecuador o internacional)
function formatWhatsAppNumber(phone: string): string {
  if (!phone) return "";
  let cleaned = phone.replace(/\D/g, "");
  // Si empieza con 09 (móvil común de Ecuador), reemplazar por 5939
  if (cleaned.startsWith("09") && cleaned.length === 10) {
    cleaned = "593" + cleaned.slice(1);
  }
  return cleaned;
}

// Helper para escapar expresiones regulares de forma segura
function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Helper para generar variantes seguras de identificación de mesa (sin REGEXP SQL)
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

// GET /api/pedidos?negocio_id=...&activos=true&vertical=...
export async function GET(req: NextRequest) {
  try {
    await ensureDbTables();

    const { searchParams } = new URL(req.url);
    const negocioId = searchParams.get("negocio_id");
    const slug = searchParams.get("slug");
    const soloActivos = searchParams.get("activos") !== "false";
    const mesa = searchParams.get("mesa");
    const vertical = searchParams.get("vertical");
    const clienteTelefono = searchParams.get("cliente_telefono") || searchParams.get("telefono");

    // Consulta de pedidos por número de cliente (para Ubícame Pass)
    if (clienteTelefono) {
      const cleanPhone = clienteTelefono.replace(/\D/g, "");
      if (cleanPhone.length >= 7) {
        const { rows: clientOrders } = await pool.query(
          `SELECT 
             p.id,
             p.negocio_id,
             p.mesa,
             p.estado,
             p.total::float as total,
             p.created_at,
             p.cliente_nombre,
             p.cliente_telefono,
             p.vertical,
             p.metadata,
             n.nombre as negocio_nombre,
             n.slug as negocio_slug,
             COALESCE(
               json_agg(
                 json_build_object(
                   'id', pi.id,
                   'nombre', pi.nombre,
                   'cantidad', pi.cantidad,
                   'precio', pi.precio::float,
                   'notas', pi.notas
                 )
               ) FILTER (WHERE pi.id IS NOT NULL),
               '[]'
             ) as items
           FROM pedidos p
           LEFT JOIN negocios n ON p.negocio_id = n.id
           LEFT JOIN pedido_items pi ON pi.pedido_id = p.id
           WHERE REPLACE(REPLACE(REPLACE(p.cliente_telefono, ' ', ''), '-', ''), '+', '') LIKE $1
           GROUP BY p.id, n.nombre, n.slug
           ORDER BY p.created_at DESC
           LIMIT 50`,
          [`%${cleanPhone.slice(-8)}%`]
        );
        return NextResponse.json({ ok: true, pedidos: clientOrders });
      }
    }

    const isUuid = (str: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
    const validNegocioIds = new Set<string>();

    if (negocioId && isUuid(negocioId)) {
      validNegocioIds.add(negocioId);
    }

    if (slug) {
      const { rows: negRows } = await pool.query(
        "SELECT id FROM negocios WHERE slug = $1",
        [slug.toLowerCase().trim()]
      );
      negRows.forEach((r) => {
        if (isUuid(r.id)) validNegocioIds.add(r.id);
      });

      try {
        const { rows: restRows } = await pool.query(
          `SELECT id FROM "Restaurant" WHERE slug = $1`,
          [slug.toLowerCase().trim()]
        );
        restRows.forEach((r) => {
          if (isUuid(r.id)) validNegocioIds.add(r.id);
        });
      } catch {}
    }

    if (negocioId) {
      const { rows: idRows } = await pool.query(
        "SELECT id, slug FROM negocios WHERE id::text = $1",
        [negocioId]
      );
      idRows.forEach((r) => {
        if (isUuid(r.id)) validNegocioIds.add(r.id);
      });

      try {
        const { rows: restIdRows } = await pool.query(
          `SELECT id, slug FROM "Restaurant" WHERE id::text = $1`,
          [negocioId]
        );
        for (const r of restIdRows) {
          if (isUuid(r.id)) validNegocioIds.add(r.id);
          if (r.slug) {
            const { rows: negBySlug } = await pool.query(
              "SELECT id FROM negocios WHERE slug = $1",
              [r.slug.toLowerCase().trim()]
            );
            negBySlug.forEach((nb) => {
              if (isUuid(nb.id)) validNegocioIds.add(nb.id);
            });
          }
        }
      } catch {}
    }

    // Reconciliador pasivo: asegura que pedidos web pendientes se sincronicen a KDS
    for (const vNegId of validNegocioIds) {
      try {
        await reconcileUndispatchedOrders(vNegId);
      } catch (e) {
        console.warn("[GET /api/pedidos] Error en recuperador pasivo:", e);
      }
    }

    const targetIdsArray = Array.from(validNegocioIds);

    if (targetIdsArray.length === 0) {
      return NextResponse.json(
        { ok: false, error: "negocio_id o slug es requerido para consultar pedidos." },
        { status: 400 }
      );
    }

    // 1. Control estricto de privacidad, roles y multi-tenant en el servidor
    // Se admiten dos vías de autorización validadas en el servidor:
    // A) Personal Autorizado (Dueño, SuperAdmin, Mesero con PIN o Cocina KDS)
    // B) Comensal con Sesión de Mesa Activa Criptográfica (firmada por servidor en POST /api/pedidos o handshake)
    let isAuthorizedStaff = false;
    let authError = "Acceso no autorizado. Inicie sesión en el panel o autentique su terminal para consultar pedidos.";
    let authStatus = 401;

    for (const vNegId of targetIdsArray) {
      const auth = await verifyOrderStaffAuth(req, vNegId);
      if (auth.authorized) {
        isAuthorizedStaff = true;
        break;
      } else {
        authError = auth.error || authError;
        if (auth.status) authStatus = auth.status;
      }
    }

    let isAuthorizedTable = false;
    let tableAuthContext: TableAuthContext | null = null;

    if (!isAuthorizedStaff && mesa) {
      for (const vNegId of targetIdsArray) {
        const tableAuth = await verifyTableSessionAuth(req, vNegId, mesa);
        if (tableAuth.authorized) {
          isAuthorizedTable = true;
          tableAuthContext = tableAuth;
          break;
        } else if (tableAuth.status === 403) {
          authError = tableAuth.error || authError;
          authStatus = 403;
        }
      }
    }

    if (!isAuthorizedStaff && !isAuthorizedTable) {
      return NextResponse.json(
        { ok: false, error: authError },
        { status: authStatus }
      );
    }

    let query = `
      SELECT 
        p.id,
        p.negocio_id,
        p.mesa,
        p.estado,
        p.camarero_id,
        p.total::float as total,
        p.created_at,
        p.cliente_nombre,
        p.cliente_telefono,
        p.solicita_mesero,
        p.vertical,
        p.es_prueba,
        p.metadata,
        c.nombre as camarero_nombre,
        COALESCE(
          json_agg(
            json_build_object(
              'id', pi.id,
              'producto_id', pi.producto_id,
              'nombre', pi.nombre,
              'cantidad', pi.cantidad,
              'precio', pi.precio::float,
              'notas', pi.notas,
              'es_añadido', pi.es_añadido,
              'estado_item', pi.estado_item,
              'unidades_descontadas', pi.unidades_descontadas
            ) ORDER BY pi.es_añadido ASC, pi.nombre ASC
          ) FILTER (WHERE pi.id IS NOT NULL AND (pi.estado_item IS NULL OR pi.estado_item != 'cancelado')),
          '[]'
        ) as items
      FROM pedidos p
      LEFT JOIN camareros c ON p.camarero_id = c.id
      LEFT JOIN pedido_items pi ON pi.pedido_id = p.id AND (pi.estado_item IS NULL OR pi.estado_item != 'cancelado')
      WHERE p.negocio_id = ANY($1::uuid[])
    `;

    const params: (string | number | boolean | string[])[] = [targetIdsArray];

    if (isAuthorizedTable) {
      // Para comensal con sesión de mesa activa: vincular estrictamente a su comanda exacta (orderId)
      // Nunca devolver la comanda más reciente de la mesa si corresponde a otro grupo.
      const orderIdParam = tableAuthContext?.orderId;
      if (!orderIdParam) {
        return NextResponse.json(
          { ok: false, error: "Token de mesa no contiene comanda válida vinculada." },
          { status: 401 }
        );
      }
      params.push(orderIdParam);
      query += ` AND p.id::text = $${params.length}::text`;
    } else {
      if (soloActivos) {
        params.push("pagado");
        params.push("cancelado");
        query += ` AND p.estado NOT IN ($${params.length - 1}, $${params.length})`;
      }

      if (mesa) {
        const mesaVariants = getMesaVariants(mesa);
        params.push(mesaVariants);
        query += ` AND LOWER(TRIM(p.mesa)) = ANY($${params.length}::text[])`;
      }

      if (vertical) {
        params.push(vertical);
        query += ` AND p.vertical = $${params.length}`;
      }
    }

    query += `
      GROUP BY p.id, c.nombre, p.cliente_nombre, p.cliente_telefono, p.solicita_mesero, p.vertical, p.es_prueba, p.metadata
      ORDER BY p.created_at DESC
    `;

    if (isAuthorizedTable) {
      query += ` LIMIT 1`;
    }

    const { rows: pedidos } = await pool.query(query, params);

    // Si la consulta proviene de un comensal con sesión de mesa:
    if (isAuthorizedTable) {
      if (pedidos.length === 0) {
        // La comanda vinculada no existe o no pertenece a este restaurante
        const res = NextResponse.json({
          ok: true,
          active: false,
          sesion_cerrada: true,
          pedidos: [],
        });
        res.cookies.delete("table_session");
        res.cookies.set("table_session", "", {
          path: "/",
          maxAge: 0,
          httpOnly: true,
          sameSite: "lax",
          secure: process.env.NODE_ENV === "production",
        });
        return res;
      }

      const tableOrder = pedidos[0];
      const isClosed = tableOrder.estado === "pagado" || tableOrder.estado === "cancelado";

      const sanitizedTableOrder = {
        ...tableOrder,
        cliente_telefono: null, // Nunca exponer números telefónicos a terceros
        cliente_nombre: tableOrder.cliente_nombre ? tableOrder.cliente_nombre.split(" ")[0] : "Comensal",
      };

      if (isClosed) {
        // La sesión de mesa está cerrada (cobrada o cancelada por el restaurante):
        // Invalidar el acceso a la cuenta en vivo y eliminar la cookie httpOnly
        const res = NextResponse.json({
          ok: true,
          active: false,
          sesion_cerrada: true,
          estado: tableOrder.estado,
          pedidos: [sanitizedTableOrder],
        });
        res.cookies.delete("table_session");
        res.cookies.set("table_session", "", {
          path: "/",
          maxAge: 0,
          httpOnly: true,
          sameSite: "lax",
          secure: process.env.NODE_ENV === "production",
        });
        return res;
      }

      return NextResponse.json({
        ok: true,
        active: true,
        sesion_cerrada: false,
        pedidos: [sanitizedTableOrder],
      });
    }

    // Consulta de Personal Autorizado (Cocina, Mesero, Admin, Superadmin)
    return NextResponse.json({ ok: true, pedidos });
  } catch (err: unknown) {
    console.error("[GET /api/pedidos] Error:", err);
    const msg = err instanceof Error ? err.message : "Error al obtener pedidos";
    notificarSuperAdmin({
      mensaje: `⚠️ Error Crítico en GET /api/pedidos: ${msg}`,
      cliente: "Alerta Servidor",
    });
    return NextResponse.json(
      { ok: false, error: msg },
      { status: 500 }
    );
  }
}

interface InsertedOrderItem {
  id?: string;
  pedido_id?: string;
  nombre: string;
  cantidad: number;
  precio: number;
  notas?: string | null;
  es_añadido?: boolean;
  estado_item?: string | null;
  [key: string]: unknown;
}

interface ResponseOrder {
  id: string;
  total: number;
  mesa?: string | null;
  estado?: string | null;
  camarero_id?: string | null;
  camarero_nombre?: string | null;
  items?: InsertedOrderItem[] | unknown[];
  [key: string]: unknown;
}

/**
 * Conciliación estricta de identidad para reintentos de despacho en /api/pedidos.
 * - Elimina la asociación por existingItems[i] y la elección del primer origen disponible.
 * - No asume ordenación, nombre/precio/notas ni heurísticas.
 * - Conserva vínculos existentes (sourcePedidoItemId ya asignado).
 * - Repara vínculos ausentes (sourcePedidoItemId == null) ÚNICAMENTE ante identidad explícita y validada del mismo pedido/negocio.
 * - Un origen no puede asignarse a dos líneas (máximo un uso por fila de pedido_items).
 * - Si no hay evidencia suficiente para reparar, persiste UNRESOLVED en la base de datos y marca el despacho como incompleto.
 */
async function reconcileRetryLinks(
  client: any,
  explicitOrderId: string,
  authoritativeOrderItems: any[],
  existingPgItems: any[],
  requestItems: any[]
): Promise<{
  allReconciled: boolean;
  unresolvedCount: number;
  repairedCount: number;
  unresolvedItemIds: string[];
}> {
  // 1. Conservar vínculos existentes y registrar orígenes ya reclamados
  const claimedSourceIds = new Set<string>();
  for (const oi of authoritativeOrderItems) {
    if (oi.sourcePedidoItemId) {
      claimedSourceIds.add(String(oi.sourcePedidoItemId));
    }
  }

  // 2. Extraer identidad explícita y validada provista en la petición
  // La correspondencia debe ser 1:1, inequívoca y comprobada contra existingPgItems
  const explicitReqMap = new Map<string, string>();
  const reqItemsList = Array.isArray(requestItems) ? requestItems : [];
  for (const reqIt of reqItemsList) {
    const targetOid = reqIt.orderItemId || reqIt.id;
    const targetSid = reqIt.sourcePedidoItemId || reqIt.pedidoItemId || reqIt.originId || reqIt.sourceId;
    if (targetOid && targetSid) {
      const sIdStr = String(targetSid);
      // Validar que el origen pertenece estrictamente a las filas de este pedido en PostgreSQL
      const existsInPg = existingPgItems.some((e: any) => String(e.id) === sIdStr);
      if (existsInPg) {
        // Un origen no puede asignarse a dos líneas
        if (!claimedSourceIds.has(sIdStr) && !Array.from(explicitReqMap.values()).includes(sIdStr)) {
          explicitReqMap.set(String(targetOid), sIdStr);
        }
      }
    }
  }

  // 3. Procesar líneas no vinculadas (sourcePedidoItemId == null)
  const unlinked = authoritativeOrderItems.filter((i: any) => !i.sourcePedidoItemId);
  let unresolvedCount = 0;
  let repairedCount = 0;
  const unresolvedItemIds: string[] = [];

  for (const uItem of unlinked) {
    const explicitSid = explicitReqMap.get(String(uItem.id));
    if (explicitSid && !claimedSourceIds.has(explicitSid)) {
      // Reparar con identidad explícita y validada
      claimedSourceIds.add(explicitSid);
      repairedCount++;
      await client.query(
        `UPDATE "OrderItem"
         SET "sourcePedidoItemId" = $1, "lineStatus" = 'ACTIVE'
         WHERE id = $2 AND "sourcePedidoItemId" IS NULL`,
        [explicitSid, uItem.id]
      );
    } else {
      // Sin evidencia suficiente para reparar: persistir UNRESOLVED en la base de datos
      unresolvedCount++;
      unresolvedItemIds.push(String(uItem.id));
      await client.query(
        `UPDATE "OrderItem"
         SET "lineStatus" = 'UNRESOLVED'
         WHERE id = $1 AND "sourcePedidoItemId" IS NULL`,
        [uItem.id]
      );
    }
  }

  return {
    allReconciled: unresolvedCount === 0,
    unresolvedCount,
    repairedCount,
    unresolvedItemIds,
  };
}

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

// Helper para validación estricta de cantidad entera positiva sin permitir conversiones permisivas
function validateItemQuantity(rawQty: any, itemName?: string): number {
  if (rawQty === undefined || rawQty === null || String(rawQty).trim() === "") {
    throw new Error(`Cantidad inválida para "${itemName || "producto"}": la cantidad es obligatoria.`);
  }

  let qty: number;
  if (typeof rawQty === "number") {
    if (!Number.isInteger(rawQty) || rawQty <= 0) {
      throw new Error(`Cantidad inválida para "${itemName || "producto"}": debe ser un número entero positivo mayor a cero.`);
    }
    qty = rawQty;
  } else if (typeof rawQty === "string") {
    const trimmed = rawQty.trim();
    if (!/^\d+$/.test(trimmed) || Number(trimmed) <= 0) {
      throw new Error(`Cantidad inválida para "${itemName || "producto"}": debe ser un número entero positivo mayor a cero.`);
    }
    qty = Number(trimmed);
  } else {
    throw new Error(`Cantidad inválida para "${itemName || "producto"}": debe ser un número entero positivo mayor a cero.`);
  }
  return qty;
}

// Función auxiliar para resolver de forma atómica y estricta el ID inmutable de Dish y deducir existencias en flujo directo
// Valida siempre que el producto pertenezca al negocio y no utiliza nombres para reconstruir identidades
async function resolveDirectProductAndDebit(
  client: any,
  restaurantId: string,
  item: {
    dishId?: string;
    productId?: string;
    id?: string;
    nombre?: string;
    dishName?: string;
    cantidad?: string | number;
    quantity?: number;
    isService?: boolean;
    tipo?: string;
    itemType?: string;
    serviceId?: string;
  },
  wasStockDeducted: boolean,
  executeDeduction: boolean = false,
  isDemo: boolean = false,
  isServiceOrder: boolean = false
): Promise<{ producto_id: string | null; unidades_descontadas: number; validQuantity: number }> {
  // 1. Validar estrictamente la cantidad: debe ser un número entero positivo mayor a cero (sin usar parseInt permisivo)
  const rawQty = item.quantity !== undefined ? item.quantity : item.cantidad;
  const qty = validateItemQuantity(rawQty, item.nombre || item.dishName);

  const rawId =
    item.dishId ||
    item.productId ||
    item.serviceId ||
    (item.id && typeof item.id === "string" && !item.id.startsWith("cart-") && item.id.length > 5 ? item.id : null) ||
    null;

  const candidateId = rawId;
  if (!candidateId) {
    throw new Error(`El producto o servicio "${item.nombre || item.dishName || "sin nombre"}" debe incluir un identificador válido registrado en el negocio.`);
  }

  // 2. Validar pertenencia estricta al restaurante mediante bloqueo pesimista
  const { rows: dRows } = await client.query(
    `SELECT id, name, "trackStock", stock, "isAvailable", "isVisible", "isService", "restaurantId"
     FROM "Dish"
     WHERE id = $1 AND ("restaurantId" = $2 OR "restaurantId" IN (SELECT id FROM "Restaurant" WHERE id = $2 OR slug = $2))
     LIMIT 1
     FOR UPDATE`,
    [candidateId, restaurantId]
  );

  if (dRows.length === 0) {
    // Si no pertenece a este restaurante, verificar si pertenece a otro para rechazar explícitamente en el alta
    const { rows: foreignRows } = await client.query(
      `SELECT id, name, "restaurantId" FROM "Dish" WHERE id = $1 LIMIT 1`,
      [candidateId]
    );
    if (foreignRows.length > 0) {
      throw new Error(`El producto o servicio "${item.nombre || item.dishName || foreignRows[0].name}" con ID ${candidateId} no pertenece a este negocio.`);
    }
    throw new Error(`El producto o servicio "${item.nombre || item.dishName || candidateId}" no existe en el catálogo de este negocio.`);
  }

  const dbDish = dRows[0];

  // 3. Validar visibilidad y disponibilidad bajo bloqueo: NO vender productos ocultos o deshabilitados (incluso en Modo Demo o rondas)
  if (dbDish.isVisible === false) {
    throw new Error(`El producto "${dbDish.name}" está oculto y no está disponible para ordenar.`);
  }
  if (dbDish.isAvailable === false || dbDish.isAvailable === null) {
    throw new Error(`El producto "${dbDish.name}" no está disponible actualmente.`);
  }

  // 4. Validar stock numérico válido cuando trackStock = true
  let unidadesDebitadas = 0;

  if (dbDish.trackStock === true) {
    if (typeof dbDish.stock !== "number" || isNaN(dbDish.stock) || dbDish.stock === null) {
      throw new Error(`El producto "${dbDish.name}" tiene control de stock activado pero sus existencias no están configuradas.`);
    }

    if (dbDish.stock <= 0) {
      throw new Error(`El producto "${dbDish.name}" se encuentra agotado.`);
    }

    if (dbDish.stock < qty) {
      throw new Error(`Stock insuficiente para "${dbDish.name}". Disponible: ${dbDish.stock}, solicitado: ${qty}.`);
    }

    if (isDemo) {
      // Modo DEMO: No altera Dish.stock ni isAvailable, y registra explícitamente 0 unidades debitadas
      unidadesDebitadas = 0;
    } else if (executeDeduction) {
      const newStock = dbDish.stock - qty;
      const isStillAvailable = newStock > 0;
      await client.query(
        `UPDATE "Dish"
         SET stock = $1, "isAvailable" = $2
         WHERE id = $3`,
        [newStock, isStillAvailable, dbDish.id]
      );
      unidadesDebitadas = qty;
    } else if (wasStockDeducted) {
      unidadesDebitadas = qty;
    }
  } else {
    // trackStock es false: producto sin control de inventario (incluso si tiene stock numérico)
    unidadesDebitadas = 0;
  }

  return { producto_id: dbDish.id, unidades_descontadas: unidadesDebitadas, validQuantity: qty };
}

// POST /api/pedidos - Endpoint unificado para procesar pedidos/solicitudes de todas las verticales
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      vertical = "menuqr", // "menuqr" | "catalogo" | "ctalo" | "servicios" | "citas" | "reservas"
      negocio_id,
      restaurantId, // Soporte unificado de ID de restaurante
      slug,
      skip_stock_deduction = false, // Evita deducción doble cuando ya se ejecutó createOrderAction en el cliente
      cliente_nombre,
      cliente_telefono,
      cliente_direccion,
      // Vertical menuqr / catalogo
      mesa,
      camarero_id,
      items = [],
      tipo_entrega, // 'RETIRO' | 'DOMICILIO' | 'SALON'
      metodo_entrega,
      costo_envio = 0,
      notas_entrega,
      total,
      // Vertical servicios (cotizador express)
      servicio_solicitado,
      descripcion_problema,
      fotos_urls = [],
      urgencia = "normal",
      marca_equipo,
      tipo_tecnologia,
      sintomas_detectados = [],
      franja_horaria,
      visita_condicion,
      latitud,
      longitud,
      direccion_referencia,
      fecha_preferida,
      // Vertical citas (agenda de turnos)
      especialista_id,
      especialista_nombre,
      servicio_nombre,
      fecha_cita,
      hora_cita,
      duracion_min,
      notas_cita,
      precio_estimado = 0,
      modalidad_pago = "RECEPCION",
      monto_abono = 0,
      comprobante_ref = null,
      // Vertical reservas (hospedaje)
      check_in,
      check_out,
      noches = 1,
      huespedes_adultos = 1,
      huespedes_ninos = 0,
      tipo_habitacion,
      extras = [],
      total_reserva,
      hora_llegada_estimada,
    } = body;

    // 1. Resolver identidad, vertical y estado real del negocio en el servidor ANTES de inicializar tablas o escribir
    const rawRestaurantId = restaurantId ? String(restaurantId).trim() : null;
    const rawNegocioId = negocio_id ? String(negocio_id).trim() : null;
    let businessSlug = slug ? String(slug).toLowerCase().trim() : null;

    if (!rawRestaurantId && !rawNegocioId && !businessSlug) {
      return NextResponse.json(
        { ok: false, error: "Identificador de comercio requerido." },
        { status: 400 }
      );
    }

    type ResolvedStore = {
      id: string;
      name?: string | null;
      slug?: string | null;
      whatsapp?: string | null;
      address?: string | null;
      isSuspended?: boolean | null;
      businessType?: string | null;
      catalogMode?: string | null;
    };

    const queryRestaurant = async (
      byId: string | null,
      bySlug: string | null
    ): Promise<{
      store: ResolvedStore | null;
      conflict: boolean;
      error: boolean;
    }> => {
      if (!byId && !bySlug) return { store: null, conflict: false, error: false };

      let sqlError = false;
      try {
        const conditions: string[] = [];
        const params: string[] = [];
        if (byId) {
          params.push(byId);
          conditions.push(`id::text = $${params.length}`);
        }
        if (bySlug) {
          params.push(bySlug);
          conditions.push(`slug = $${params.length}`);
        }
        const { rows } = await pool.query(
          `SELECT id, name, slug, whatsapp, address, "isSuspended", "businessType", "catalogMode" FROM "Restaurant" WHERE ${conditions.join(" OR ")} LIMIT 2`,
          params
        );
        if (rows.length > 1) return { store: null, conflict: true, error: false };
        if (rows[0]) {
          const rowSlug = String(rows[0].slug || "").toLowerCase().trim();
          if (byId && String(rows[0].id) !== byId) return { store: null, conflict: true, error: false };
          if (bySlug && rowSlug !== bySlug) return { store: null, conflict: true, error: false };
          return { store: rows[0], conflict: false, error: false };
        }
      } catch {
        sqlError = true;
      }

      let prismaError = false;
      try {
        const whereClause = {
          OR: [
            ...(byId ? [{ id: byId }] : []),
            ...(bySlug ? [{ slug: bySlug }] : []),
          ],
        };
        const selectClause = {
          id: true,
          name: true,
          slug: true,
          whatsapp: true,
          address: true,
          isSuspended: true,
          businessType: true,
          catalogMode: true,
        };
        const pRows: ResolvedStore[] =
          typeof (prisma.restaurant as any).findMany === "function"
            ? await (prisma.restaurant as any).findMany({
                where: whereClause,
                take: 2,
                select: selectClause,
              })
            : await prisma.restaurant
                .findFirst({ where: whereClause, select: selectClause })
                .then((r) => (r ? [r] : []));

        if (pRows.length > 1) return { store: null, conflict: true, error: false };
        if (pRows[0]) {
          const rowSlug = String(pRows[0].slug || "").toLowerCase().trim();
          if (byId && String(pRows[0].id) !== byId) return { store: null, conflict: true, error: false };
          if (bySlug && rowSlug !== bySlug) return { store: null, conflict: true, error: false };
          return { store: pRows[0], conflict: false, error: false };
        }
      } catch {
        prismaError = true;
      }

      return { store: null, conflict: false, error: sqlError || prismaError };
    };

    let resolvedStore: ResolvedStore | null = null;
    let verifiedNegocioId: string | null = null;

    if (rawRestaurantId) {
      // restaurantId es identificador estricto de Restaurant
      const res = await queryRestaurant(rawRestaurantId, businessSlug);
      if (res.conflict) {
        return NextResponse.json(
          { ok: false, error: "El identificador y el slug del comercio no coinciden." },
          { status: 400 }
        );
      }
      if (res.error && !res.store) {
        return NextResponse.json(
          { ok: false, error: "No se pudo verificar el estado del comercio en este momento." },
          { status: 503 }
        );
      }
      if (!res.store) {
        return NextResponse.json(
          { ok: false, error: "Comercio no encontrado." },
          { status: 404 }
        );
      }
      resolvedStore = res.store;

      // Si además vino negocio_id distinto, verificar que no apunte a otro negocio
      if (rawNegocioId && rawNegocioId !== resolvedStore.id) {
        try {
          const { rows: negCheck } = await pool.query(
            `SELECT id, slug FROM negocios WHERE id::text = $1 LIMIT 2`,
            [rawNegocioId]
          );
          if (negCheck.length > 1) {
            return NextResponse.json(
              { ok: false, error: "Correspondencia ambigua para el identificador del negocio." },
              { status: 400 }
            );
          }
          if (!negCheck[0]) {
            return NextResponse.json(
              { ok: false, error: "Identificador de negocio no encontrado." },
              { status: 404 }
            );
          }
          const negSlug = String(negCheck[0].slug || "").toLowerCase().trim();
          const restSlug = String(resolvedStore.slug || "").toLowerCase().trim();
          if (!negSlug || negSlug !== restSlug) {
            return NextResponse.json(
              { ok: false, error: "El identificador de negocio y el comercio no coinciden." },
              { status: 400 }
            );
          }
          verifiedNegocioId = negCheck[0].id;
        } catch {
          return NextResponse.json(
            { ok: false, error: "No se pudo verificar el estado del comercio en este momento." },
            { status: 503 }
          );
        }
      }
    } else if (rawNegocioId) {
      // negocio_id puede ser Restaurant.id (legado) o negocios.id (ej. MesasClient)
      const directRest = await queryRestaurant(rawNegocioId, businessSlug);
      if (directRest.store) {
        resolvedStore = directRest.store;
      } else {
        // Consultar negocios en solo lectura y verificar correspondencia única con Restaurant vía slug
        let negRows: Array<{ id: string; nombre?: string; slug?: string | null }> = [];
        try {
          const qNeg = await pool.query(
            `SELECT id, nombre, slug FROM negocios WHERE id::text = $1 LIMIT 2`,
            [rawNegocioId]
          );
          negRows = qNeg.rows || [];
        } catch {
          return NextResponse.json(
            { ok: false, error: "No se pudo verificar el estado del comercio en este momento." },
            { status: 503 }
          );
        }

        if (negRows.length > 1) {
          return NextResponse.json(
            { ok: false, error: "Correspondencia ambigua para el identificador del negocio." },
            { status: 400 }
          );
        }

        if (negRows.length === 0) {
          if (directRest.error) {
            return NextResponse.json(
              { ok: false, error: "No se pudo verificar el estado del comercio en este momento." },
              { status: 503 }
            );
          }
          if (directRest.conflict) {
            return NextResponse.json(
              { ok: false, error: "El identificador y el slug del comercio no coinciden." },
              { status: 400 }
            );
          }
          return NextResponse.json(
            { ok: false, error: "Comercio no encontrado." },
            { status: 404 }
          );
        }

        const negSlug = negRows[0].slug ? String(negRows[0].slug).toLowerCase().trim() : null;
        if (!negSlug) {
          return NextResponse.json(
            { ok: false, error: "No se pudo verificar la correspondencia del negocio." },
            { status: 400 }
          );
        }
        if (businessSlug && negSlug !== businessSlug) {
          return NextResponse.json(
            { ok: false, error: "El identificador y el slug del comercio no coinciden." },
            { status: 400 }
          );
        }

        verifiedNegocioId = negRows[0].id;
        const byNegSlug = await queryRestaurant(null, negSlug);
        if (byNegSlug.conflict) {
          return NextResponse.json(
            { ok: false, error: "Correspondencia ambigua para el slug del comercio." },
            { status: 400 }
          );
        }
        if (byNegSlug.error && !byNegSlug.store) {
          return NextResponse.json(
            { ok: false, error: "No se pudo verificar el estado del comercio en este momento." },
            { status: 503 }
          );
        }
        if (!byNegSlug.store) {
          return NextResponse.json(
            { ok: false, error: "Comercio no encontrado." },
            { status: 404 }
          );
        }
        resolvedStore = byNegSlug.store;
      }
    } else if (businessSlug) {
      const bySlug = await queryRestaurant(null, businessSlug);
      if (bySlug.conflict) {
        return NextResponse.json(
          { ok: false, error: "Correspondencia ambigua para el slug del comercio." },
          { status: 400 }
        );
      }
      if (bySlug.error && !bySlug.store) {
        return NextResponse.json(
          { ok: false, error: "No se pudo verificar el estado del comercio en este momento." },
          { status: 503 }
        );
      }
      if (!bySlug.store) {
        return NextResponse.json(
          { ok: false, error: "Comercio no encontrado." },
          { status: 404 }
        );
      }
      resolvedStore = bySlug.store;
    }

    if (!resolvedStore) {
      return NextResponse.json(
        { ok: false, error: "No se pudo verificar el estado del comercio en este momento." },
        { status: 503 }
      );
    }

    const effectiveRestId = verifiedNegocioId || resolvedStore.id;

    const restaurantPrismaId: string = resolvedStore.id;
    let businessName = resolvedStore.name || "Comercio";
    if (resolvedStore.slug) businessSlug = String(resolvedStore.slug).toLowerCase().trim();
    const businessPhone = resolvedStore.whatsapp ? String(resolvedStore.whatsapp) : "";
    const businessAddress = resolvedStore.address ? String(resolvedStore.address) : "";
    const resolvedIsSuspended = Boolean(resolvedStore.isSuspended);
    const resolvedBusinessType = String(resolvedStore.businessType || "").toUpperCase().trim();
    const resolvedCatalogMode = String(resolvedStore.catalogMode || "").toUpperCase().trim();

    const isServerCatalog =
      resolvedBusinessType === "RETAIL" ||
      resolvedBusinessType === "GENERAL_CATALOG" ||
      resolvedCatalogMode === "CATALOG";

    if (resolvedIsSuspended && isServerCatalog) {
      return NextResponse.json(
        { ok: false, error: "Este catálogo se encuentra temporalmente no disponible." },
        { status: 403 }
      );
    }

    const clientRequestsCatalog =
      vertical === "catalogo" ||
      vertical === "ctalo" ||
      String(mesa || "").toUpperCase().trim() === "CATALOGO";

    if (!isServerCatalog && clientRequestsCatalog) {
      return NextResponse.json(
        { ok: false, error: "Este comercio no opera en modalidad de catálogo." },
        { status: 403 }
      );
    }

    const isCatalogOrder = isServerCatalog && clientRequestsCatalog;

    await ensureDbTables();

    let negocioDbId: string | null = null;

    // Consultar en "negocios"
    const { rows: negRows } = await pool.query(
      `SELECT id, nombre, slug FROM negocios WHERE id::text = $1 OR slug = $2 LIMIT 1`,
      [effectiveRestId || "", businessSlug || ""]
    );
    if (negRows[0]) {
      negocioDbId = negRows[0].id;
      if (!businessName || businessName === "Comercio") businessName = negRows[0].nombre;
    } else {
      // Sincronizar negocio en tabla negocios si aún no existe para garantizar foreign keys válidas
      const isUuid = restaurantPrismaId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(restaurantPrismaId);
      const { rows: createdNeg } = await pool.query(
        `INSERT INTO negocios (id, nombre, slug, numero_mesas)
         VALUES (${isUuid ? "$1::uuid" : "gen_random_uuid()"}, $2, $3, 10)
         ON CONFLICT (slug) DO UPDATE SET nombre = EXCLUDED.nombre
         RETURNING id`,
        isUuid
          ? [restaurantPrismaId, businessName, businessSlug || `negocio-${Date.now()}`]
          : [businessName, businessSlug || `negocio-${Date.now()}`]
      );
      if (createdNeg[0]) {
        negocioDbId = createdNeg[0].id;
      }
    }

    if (!negocioDbId) {
      const { rows: fallbackNeg } = await pool.query("SELECT id, nombre FROM negocios LIMIT 1");
      if (fallbackNeg[0]) {
        negocioDbId = fallbackNeg[0].id;
        businessName = fallbackNeg[0].nombre;
      }
    }

    const resolvedNegocioId = negocioDbId;

    // VALIDACIÓN TEMPRANA DE IDENTIDAD Y AUTORIDAD:
    // Si la petición trae un ID de pedido explícito (order_id o id), se exige estrictamente un dispatch_token válido.
    // Si no lo trae o es inválido, se rechaza inmediatamente con 4xx SIN insertar nada y SIN caer al flujo nativo.
    const explicitOrderId = body.order_id || body.id;
    const targetPedidoId = body.pedido_id || body.target_pedido_id || body.parent_order_id;
    const dispatchToken = body.dispatch_token;
    const isRoundReq = Boolean(body.is_round);
    const roundAttemptId = body.round_attempt_id ? String(body.round_attempt_id).trim() : "";

    if (explicitOrderId) {
      const staffAuth = await verifyOrderStaffAuth(req, resolvedNegocioId);
      if (!staffAuth.authorized) {
        if (!dispatchToken || typeof dispatchToken !== "string") {
          return NextResponse.json(
            { ok: false, error: "Token de autorización requerido cuando se proporciona ID de pedido." },
            { status: 400 }
          );
        }

        const verifiedToken = verifyKdsDispatchToken(dispatchToken);
        if (
          !verifiedToken ||
          verifiedToken.orderId !== explicitOrderId ||
          (verifiedToken.restaurantId !== resolvedNegocioId && verifiedToken.restaurantId !== restaurantPrismaId)
        ) {
          return NextResponse.json(
            { ok: false, error: "Token de despacho inválido o no autorizado." },
            { status: 403 }
          );
        }
      }
    }

    let authoritativeOrder: any = null;
    if (explicitOrderId) {
      try {
        authoritativeOrder = await prisma.order.findUnique({
          where: { id: explicitOrderId },
          include: { items: true },
        });
      } catch {}
    }

    return await withDeadlockRetry(async (retryAttempt) => {
      const client = await pool.connect();

      try {
        await client.query("BEGIN");

        if (retryAttempt === 1 && (globalThis as any).__testHooks?.simulateDeadlockInPostOrderAttempt1) {
          delete (globalThis as any).__testHooks.simulateDeadlockInPostOrderAttempt1;
          const deadlockErr: any = new Error("deadlock detected");
          deadlockErr.code = "40P01";
          throw deadlockErr;
        }

        let createdOrderId: string;
      let responseOrder: ResponseOrder | null = null;
      let whatsappMessageText = "";
      let orderTotal = 0;
      let insertedItems: InsertedOrderItem[] = [];

      // =========================================================================
      // CASO A: VERTICAL MENUQR (Restaurantes, Bares, Cafeterías - Mesa Abierta o Delivery)
      // =========================================================================
      if (vertical === "menuqr" && !isCatalogOrder) {
        const rawMesaUpper = String(mesa || "").toUpperCase().trim();
        const tipoEntregaUpper = String(tipo_entrega || "").toUpperCase().trim();
        const metodoEntregaUpper = String(metodo_entrega || "").toUpperCase().trim();

        // 1. Detectar si es para llevar / retiro (prioridad absoluta cuando se solicita retiro)
        const isLlevarReq =
          tipoEntregaUpper === "RETIRO" ||
          rawMesaUpper === "LLEVAR" ||
          rawMesaUpper === "RETIRO" ||
          rawMesaUpper === "TAKEAWAY" ||
          rawMesaUpper === "MOSTRADOR" ||
          metodoEntregaUpper === "RETIRO" ||
          metodoEntregaUpper === "LLEVAR";

        // 2. Detectar si es a domicilio (excluyendo órdenes explícitas de retiro)
        const isDeliveryReq =
          !isLlevarReq && (
            tipoEntregaUpper === "DOMICILIO" ||
            rawMesaUpper === "DELIVERY" ||
            rawMesaUpper === "DOMICILIO" ||
            metodoEntregaUpper === "DOMICILIO"
          );

        const rawMesa = mesa ? String(mesa).trim() : (isDeliveryReq ? "DELIVERY" : (isLlevarReq ? "LLEVAR" : "1"));
        const cleanMesa = rawMesa.replace(/^(mesa\s*#?|#)/i, "").trim();
        const mesaStr = isDeliveryReq ? "DELIVERY" : (isLlevarReq ? "LLEVAR" : (cleanMesa || "1"));
        const channelLabel = isDeliveryReq ? "Domicilio" : isLlevarReq ? "Para Llevar" : `Mesa ${mesaStr}`;

        if (!Array.isArray(items) || items.length === 0) {
          await client.query("ROLLBACK");
          return NextResponse.json(
            { ok: false, error: "El pedido de restaurante debe contener al menos un item" },
            { status: 400 }
          );
        }

        // Deducción y validación atómica de stock (si no fue deducido previamente en createOrderAction)
        // No se confía en skip_stock_deduction ni en autenticación de personal para saltar el consumo de líneas reales nuevas.
        // Exige un débito persistido confiable o valida y descuenta exactamente una vez bajo bloqueo.

        // Bloqueo pesimista canónico en orden lexicográfico de IDs para prevenir deadlocks
        const candidateDishIds = (items || [])
          .map((it: any) => it.dishId || it.productId || (it.id && typeof it.id === "string" && !it.id.startsWith("cart-") && it.id.length > 5 ? it.id : null))
          .filter(Boolean) as string[];
        const sortedDishIds = Array.from(new Set(candidateDishIds)).sort();
        if (sortedDishIds.length > 0) {
          await client.query(
            `SELECT id FROM "Dish" WHERE id = ANY($1::text[]) ORDER BY id FOR UPDATE`,
            [sortedDishIds]
          );
        }

        // Consultar configuración fiscal, de servicio y modo de pruebas del restaurante
        let restaurantTestMode = false;
        let restConfig: {
          ivaPercent: number;
          servicePercent: number;
          ivaOnTable: boolean;
          serviceOnTable: boolean;
          ivaOnTakeout: boolean;
          serviceOnTakeout: boolean;
          customLabels?: string | null;
        } = {
          ivaPercent: 15.0,
          servicePercent: 10.0,
          ivaOnTable: true,
          serviceOnTable: true,
          ivaOnTakeout: true,
          serviceOnTakeout: false,
          customLabels: null,
        };
        try {
          const restDb = await prisma.restaurant.findFirst({
            where: {
              OR: [
                ...(restaurantPrismaId ? [{ id: restaurantPrismaId }] : []),
                ...(businessSlug ? [{ slug: businessSlug }] : []),
                ...(resolvedNegocioId ? [{ id: resolvedNegocioId }] : []),
              ],
            },
            select: {
              testMode: true,
              ivaPercent: true,
              servicePercent: true,
              ivaOnTable: true,
              serviceOnTable: true,
              ivaOnTakeout: true,
              serviceOnTakeout: true,
              customLabels: true,
            },
          });
          if (restDb) {
            restaurantTestMode = Boolean(restDb.testMode);
            restConfig = {
              ivaPercent: typeof restDb.ivaPercent === "number" ? restDb.ivaPercent : 15.0,
              servicePercent: typeof restDb.servicePercent === "number" ? restDb.servicePercent : 10.0,
              ivaOnTable: restDb.ivaOnTable ?? true,
              serviceOnTable: restDb.serviceOnTable ?? true,
              ivaOnTakeout: restDb.ivaOnTakeout ?? restDb.ivaOnTable ?? true,
              serviceOnTakeout: restDb.serviceOnTakeout ?? restDb.serviceOnTable ?? true,
              customLabels: restDb.customLabels || null,
            };
          }
        } catch (confErr) {
          console.warn("[POST /api/pedidos] Advertencia obteniendo restConfig:", confErr);
        }

        const isTable = !isDeliveryReq && !isLlevarReq;
        const calcChargesForSubtotal = (subtotal: number, deliveryFee = 0) => {
          const res = calculatePostOrderTotals({
            itemsSubtotal: subtotal,
            isTable,
            config: restConfig,
            hasActiveItems: true,
            deliveryCost: deliveryFee,
          });
          return {
            subtotal: res.subtotal,
            iva: res.iva,
            service_charge: res.serviceCharge,
            costo_envio: res.deliveryCost,
            total: res.total,
          };
        };

        // Si viene explicitOrderId (despacho desde comanda MenuClient/Prisma), verificar la orden autoritativa
        if (explicitOrderId) {
          if (!authoritativeOrder) {
            authoritativeOrder = await prisma.order.findUnique({
              where: { id: explicitOrderId },
              include: { items: true },
            });
          }

          if (!authoritativeOrder || (authoritativeOrder.restaurantId !== resolvedNegocioId && authoritativeOrder.restaurantId !== restaurantPrismaId)) {
            await client.query("ROLLBACK");
            return NextResponse.json(
              { ok: false, error: "Orden autoritativa no encontrada para el restaurante especificado." },
              { status: 404 }
            );
          }
        }

        // Cada comensal o grupo abre su propia comanda independiente en la mesa (mesas compartidas).
        // Las rondas se añaden y acumulan de forma estricta según el ID de comanda autorizada (targetPedidoId o explicitOrderId).
        // Si la orden es autoritativa de Prisma, fluye hacia la conciliación autoritativa transaccional.
        const targetComandaId = authoritativeOrder ? null : (targetPedidoId || (isRoundReq ? explicitOrderId : null));
        let existingOrders: any[] = [];

        if (targetComandaId) {
          const searchIds = Array.from(new Set([resolvedNegocioId, restaurantPrismaId].filter(Boolean)));
          const { rows } = await pool.query(
            `SELECT * FROM pedidos 
             WHERE id::text = $1::text
               AND (negocio_id = ANY($2::uuid[])${businessSlug ? " OR negocio_id IN (SELECT id FROM negocios WHERE slug = $3)" : ""})
               AND estado NOT IN ('pagado', 'cancelado')
             LIMIT 1`,
            businessSlug ? [targetComandaId, searchIds, businessSlug] : [targetComandaId, searchIds]
          );

          if (rows.length === 0) {
            await client.query("ROLLBACK");
            return NextResponse.json(
              {
                ok: false,
                error: "La comanda especificada no existe, no pertenece a este negocio o ya ha sido pagada/cancelada.",
              },
              { status: 404 }
            );
          }
          existingOrders = rows;
        }

        if (existingOrders.length > 0) {
          // --- MESA ABIERTA: Verificar autorización previa antes de añadir items o emitir credenciales ---
          const currentOrder = existingOrders[0];

          let isCallerAuthorizedForTable = false;
          // 1. Personal del restaurante autorizado (Mesero, Cocina, Admin, Superadmin)
          const staffAuth = await verifyOrderStaffAuth(req, resolvedNegocioId);
          if (staffAuth.authorized) {
            isCallerAuthorizedForTable = true;
          } else {
            // 2. Comensal con sesión de mesa activa vinculada a esta comanda exacta
            const tableToken = extractTableToken(req);
            if (tableToken) {
              const decoded = verifyTableSessionToken(tableToken);
              const cleanMesaStr = (m: string) => String(m || "").replace(/^(mesa\s*#?|#)/i, "").trim().toLowerCase();
              if (
                decoded &&
                decoded.negocioId === resolvedNegocioId &&
                cleanMesaStr(decoded.mesa) === cleanMesaStr(rawMesa) &&
                decoded.orderId === currentOrder.id
              ) {
                isCallerAuthorizedForTable = true;
              }
            }
          }

          if (!isCallerAuthorizedForTable) {
            await client.query("ROLLBACK");
            return NextResponse.json(
              {
                ok: false,
                error: "La mesa ya tiene una comanda activa. Para añadir platos a esta comanda debe contar con la sesión activa de la mesa o solicitarlo al mesero.",
              },
              { status: 403 }
            );
          }

          createdOrderId = currentOrder.id;
          const isRoundDemo = Boolean(currentOrder.es_prueba);

          for (const item of items) {
            const { producto_id, unidades_descontadas, validQuantity } = await resolveDirectProductAndDebit(
              client,
              resolvedNegocioId!,
              item,
              !isRoundDemo,
              !isRoundDemo,
              isRoundDemo
            );
            const cantidad = validQuantity;
            const precio = parseFloat(item.precio) || 0;

            if ((globalThis as any).__testHooks?.failAfterStockDeductBeforeItemInsert) {
              delete (globalThis as any).__testHooks.failAfterStockDeductBeforeItemInsert;
              throw new Error("TEST_FAIL_AFTER_STOCK_DEDUCT_BEFORE_ITEM_INSERT");
            }

            const { rows: itemRows } = await client.query(
              `INSERT INTO pedido_items (pedido_id, producto_id, nombre, cantidad, precio, notas, es_añadido, estado_item, unidades_descontadas)
               VALUES ($1, $2, $3, $4, $5, $6, true, 'nuevo', $7)
               RETURNING id, pedido_id, producto_id, nombre, cantidad, precio::float, notas, es_añadido, estado_item, unidades_descontadas`,
              [createdOrderId, producto_id, item.nombre, cantidad, precio, item.notas || null, unidades_descontadas]
            );
            insertedItems.push(itemRows[0]);
          }

          // Recalcular subtotal e impuestos de forma atómica con todos los platos activos de la mesa
          const { rows: allActiveOrderItems } = await client.query(
            `SELECT precio::float, cantidad FROM pedido_items 
             WHERE pedido_id = $1 AND (estado_item IS NULL OR estado_item != 'cancelado')`,
            [createdOrderId]
          );
          const accumulatedItemsSubtotal = allActiveOrderItems.reduce(
            (acc, it) => acc + (Number(it.precio) || 0) * (parseInt(it.cantidad) || 1),
            0
          );

          let existingMeta: any = {};
          try {
            existingMeta = typeof currentOrder.metadata === "string" ? JSON.parse(currentOrder.metadata) : (currentOrder.metadata || {});
          } catch {}

          const existingDelivery = Number(existingMeta.costo_envio) || 0;
          const existingDiscount = Number(existingMeta.discount_amount ?? existingMeta.descuento) || 0;
          const existingSeason = Number(existingMeta.season_rate_amount ?? existingMeta.temporada) || 0;
          const existingTip = Number(existingMeta.tip ?? existingMeta.propina) || 0;

          const existingSnapshot = extractPricingSnapshot(existingMeta);
          const updatedCharges = existingSnapshot
            ? calculateV4OrderTotals({
                itemsSubtotal: accumulatedItemsSubtotal,
                isTable,
                snapshot: existingSnapshot,
                hasActiveItems: allActiveOrderItems.length > 0,
                discountAmount: existingDiscount,
                seasonRateAmount: existingSeason,
                deliveryCost: existingDelivery,
                tip: existingTip,
              })
            : calculatePostOrderTotals({
                itemsSubtotal: accumulatedItemsSubtotal,
                isTable,
                config: restConfig,
                hasActiveItems: allActiveOrderItems.length > 0,
                discountAmount: existingDiscount,
                seasonRateAmount: existingSeason,
                deliveryCost: existingDelivery,
                tip: existingTip,
              });
          const finalTableTotal = updatedCharges.total;

          const cleanExistingMeta = stripClientPricingFields(existingMeta);
          const updatedMeta = {
            ...cleanExistingMeta,
            ...(existingSnapshot
              ? { pricing_version: existingSnapshot.pricingVersion, pricing_snapshot: existingSnapshot }
              : {}),
            subtotal: updatedCharges.subtotal,
            iva: updatedCharges.iva,
            service_charge: updatedCharges.serviceCharge,
            costo_envio: updatedCharges.deliveryCost,
            discount_amount: updatedCharges.discountAmount,
            season_rate_amount: updatedCharges.seasonRateAmount,
            tip: updatedCharges.tip,
          };

          const { rows: updatedOrderRows } = await client.query(
            `UPDATE pedidos 
             SET total = $1,
                 metadata = $2,
                 cliente_nombre = COALESCE($3, cliente_nombre),
                 cliente_telefono = COALESCE($4, cliente_telefono)
             WHERE id = $5 
             RETURNING id, negocio_id, mesa, estado, camarero_id, total::float, created_at, cliente_nombre, cliente_telefono, solicita_mesero, vertical, metadata`,
            [
              finalTableTotal,
              JSON.stringify(updatedMeta),
              cliente_nombre ? String(cliente_nombre).trim() : null,
              cliente_telefono ? String(cliente_telefono).trim() : null,
              createdOrderId,
            ]
          );

          await client.query("COMMIT");

          // Obtener nombre del camarero
          let camareroNombre = "Sin camarero";
          if (currentOrder.camarero_id) {
            const { rows: camRows } = await pool.query(
              "SELECT nombre FROM camareros WHERE id = $1",
              [currentOrder.camarero_id]
            );
            if (camRows[0]) camareroNombre = camRows[0].nombre;
          }

          const { rows: allItems } = await pool.query(
            `SELECT id, nombre, cantidad, precio::float, notas, es_añadido, estado_item 
             FROM pedido_items WHERE pedido_id = $1 AND (estado_item IS NULL OR estado_item != 'cancelado') ORDER BY es_añadido ASC, nombre ASC`,
            [createdOrderId]
          );

          responseOrder = {
            ...updatedOrderRows[0],
            camarero_nombre: camareroNombre,
            items: allItems,
          };

          // Notificar vía Socket.IO en tiempo real a cocina/camareros
          emitItemsAñadidos(
            resolvedNegocioId,
            mesaStr,
            insertedItems,
            createdOrderId,
            Number(responseOrder?.total ?? updatedCharges?.total ?? orderTotal ?? 0),
            (responseOrder as any)?.order_number
          );
          emitPedidoActualizado(resolvedNegocioId, responseOrder);
          void syncSinglePedidoToPrisma(createdOrderId, resolvedNegocioId);

          // Alerta instantánea a Telegram vía webhook n8n (no bloqueante)
          void sendTelegramAlert({
            mensaje: `🍽️ Platos adicionales en ${mesaStr} (${businessName}): ${insertedItems.map((it) => `${it.cantidad}x ${it.nombre}`).join(", ")} | Total acumulado mesa: $${Number(responseOrder?.total ?? orderTotal ?? 0).toFixed(2)}`,
            cliente: cliente_nombre ? String(cliente_nombre).trim() : "Comensal",
            negocio: businessName,
          });

          // Generar mensaje WhatsApp para comensal
          whatsappMessageText = `*Platos adicionales en Mesa ${mesaStr}*\n` +
            `*Local:* ${businessName}\n` +
            `*Comensal:* ${cliente_nombre || "Cliente"}\n\n` +
            `*Platos añadidos:*\n` +
            insertedItems.map((it) => `• ${it.cantidad}x ${it.nombre} ($${(Number(it.precio || 0) * Number(it.cantidad || 1)).toFixed(2)})`).join("\n") +
            `\n\n*Total acumulado de la mesa:* $${Number(responseOrder?.total ?? orderTotal ?? 0).toFixed(2)}`;

          const targetPhone = formatWhatsAppNumber(businessPhone || cliente_telefono || "");
          const waUrl = targetPhone ? `https://wa.me/${targetPhone}?text=${encodeURIComponent(whatsappMessageText)}` : "";

          let tableSessionToken: string | undefined;
          if (mesaStr && mesaStr !== "Llevar" && mesaStr !== "Delivery") {
            const mesaStrClean = mesaStr.replace(/^(mesa\s*#?|#)/i, "").trim();
            tableSessionToken = signTableSessionToken({
              negocioId: (responseOrder as any)?.negocio_id || resolvedNegocioId,
              mesa: mesaStrClean,
              orderId: responseOrder?.id,
              customerName: cliente_nombre ? String(cliente_nombre).trim() : undefined,
              createdAt: Date.now(),
            });
          }

          const res = NextResponse.json({
            ok: true,
            tipo: "items_añadidos",
            pedido: responseOrder,
            nuevos_items: insertedItems,
            whatsapp_url: waUrl,
            vertical: "menuqr",
            table_session_token: tableSessionToken,
            subtotal: updatedCharges.subtotal,
            iva: updatedCharges.iva,
            service_charge: updatedCharges.serviceCharge,
            costo_envio: existingDelivery,
            discount_amount: existingDiscount,
            season_rate_amount: existingSeason,
            tip: existingTip,
            total: finalTableTotal,
          });

          if (tableSessionToken) {
            res.cookies.set("table_session", tableSessionToken, {
              httpOnly: true,
              secure: process.env.NODE_ENV === "production",
              path: "/",
              sameSite: "lax",
              maxAge: 12 * 3600,
            });
          }

          return res;
        } else {
          // --- NUEVO PEDIDO RESTAURANTE ---
          let itemsTotal = 0;
          for (const item of items) {
            const rawQty = item.quantity !== undefined ? item.quantity : item.cantidad;
            const cantidad = validateItemQuantity(rawQty, item.nombre || item.dishName);
            const precio = typeof item.price === "number" ? item.price : (parseFloat(item.precio) || 0);
            itemsTotal += cantidad * precio;
          }

          const parsedDeliveryCost = parseFloat(String(costo_envio)) || 0;
          const nativeSnapshot = buildPricingSnapshot(restConfig, isTable);
          const v4Native = calculateV4OrderTotals({
            itemsSubtotal: itemsTotal,
            isTable,
            snapshot: nativeSnapshot,
            hasActiveItems: true,
            deliveryCost: parsedDeliveryCost,
          });
          const charges = {
            subtotal: v4Native.subtotal,
            iva: v4Native.iva,
            service_charge: v4Native.serviceCharge,
            costo_envio: v4Native.deliveryCost,
            total: v4Native.total,
          };

          orderTotal = typeof total === "number" && total > 0
            ? (Math.abs(total - charges.total) < 0.05 ? total : Math.max(total, charges.total))
            : charges.total;

          let finalCamareroId = camarero_id || null;
          if (!finalCamareroId) {
            const { rows: defaultCam } = await client.query(
              "SELECT id FROM camareros WHERE negocio_id = $1 AND activo = true LIMIT 1",
              [resolvedNegocioId]
            );
            if (defaultCam[0]) finalCamareroId = defaultCam[0].id;
          }

          let cLabels: any = {};
          try {
            cLabels = restConfig.customLabels ? JSON.parse(restConfig.customLabels) : {};
          } catch {}

          const exigePrepagoPolicy = !isTable && (
            (isDeliveryReq && cLabels.prepagoDelivery === true) ||
            (isLlevarReq && cLabels.prepagoTakeout === true)
          );

          const metaObj: any = attachPricingSnapshot({
            tipo_pedido: isDeliveryReq ? "delivery" : isLlevarReq ? "llevar" : "mesa",
            tipo_entrega: isDeliveryReq ? "DOMICILIO" : isLlevarReq ? "RETIRO" : "SALON",
            cliente_direccion: cliente_direccion || null,
            costo_envio: parsedDeliveryCost,
            subtotal: charges.subtotal,
            iva: charges.iva,
            service_charge: charges.service_charge,
            notas_entrega: notas_entrega || null,
            metodo_pago: (body as any)?.metodo_pago || (body as any)?.paymentMethod || null,
            exige_prepago: Boolean(exigePrepagoPolicy),
            pago_confirmado: false,
            pago_estado: exigePrepagoPolicy ? "pendiente_prepago" : "pendiente",
          }, nativeSnapshot);

          if (authoritativeOrder) {
            // Totales siempre autoritativos del servidor
            orderTotal = authoritativeOrder.total;
            metaObj.subtotal = typeof authoritativeOrder.subtotal === "number" ? authoritativeOrder.subtotal : metaObj.subtotal;
            metaObj.iva = typeof authoritativeOrder.iva === "number" ? authoritativeOrder.iva : metaObj.iva;
            metaObj.service_charge = typeof authoritativeOrder.serviceCharge === "number" ? authoritativeOrder.serviceCharge : metaObj.service_charge;
            metaObj.costo_envio = typeof authoritativeOrder.deliveryCost === "number" ? authoritativeOrder.deliveryCost : metaObj.costo_envio;
            metaObj.discount_amount = typeof authoritativeOrder.discountAmount === "number" ? authoritativeOrder.discountAmount : (metaObj.discount_amount ?? 0);
            metaObj.season_rate_amount = typeof authoritativeOrder.seasonRateAmount === "number" ? authoritativeOrder.seasonRateAmount : (metaObj.season_rate_amount ?? 0);
            metaObj.tip = typeof authoritativeOrder.tip === "number" ? authoritativeOrder.tip : (metaObj.tip ?? 0);
            const authSnapshot = extractPricingSnapshot(authoritativeOrder.paymentDetails);
            if (authSnapshot) {
              metaObj.pricing_version = authSnapshot.pricingVersion;
              metaObj.pricing_snapshot = authSnapshot;
            } else {
              delete metaObj.pricing_version;
              delete metaObj.pricing_snapshot;
            }
            if (authoritativeOrder.paymentDetails && authoritativeOrder.paymentDetails.startsWith("{")) {
              try {
                const parsedDetails = JSON.parse(authoritativeOrder.paymentDetails);
                if (typeof parsedDetails.exige_prepago === "boolean") {
                  metaObj.exige_prepago = parsedDetails.exige_prepago;
                }
                if (typeof parsedDetails.pago_confirmado === "boolean") {
                  metaObj.pago_confirmado = parsedDetails.pago_confirmado;
                }
                if (parsedDetails.pago_estado) {
                  metaObj.pago_estado = parsedDetails.pago_estado;
                }
              } catch {}
            }
            if (authoritativeOrder.paymentMethod) {
              metaObj.metodo_pago = authoritativeOrder.paymentMethod;
            }
          }

          let isConflictRetry = false;
          let newOrderRows: any[] = [];

          if (explicitOrderId && authoritativeOrder) {
            const isOrderDemo = Boolean(authoritativeOrder.isTest);
            // Inserción atómica con ON CONFLICT DO NOTHING
            const insertRes = await client.query(
              `INSERT INTO pedidos (id, negocio_id, mesa, camarero_id, estado, total, cliente_nombre, cliente_telefono, vertical, metadata, es_prueba)
               VALUES ($1::uuid, $2, $3, $4, 'nuevo', $5, $6, $7, 'menuqr', $8, $9)
               ON CONFLICT (id) DO NOTHING
               RETURNING id, negocio_id, mesa, estado, camarero_id, total::float, created_at, cliente_nombre, cliente_telefono, solicita_mesero, vertical, metadata, es_prueba`,
              [
                explicitOrderId,
                resolvedNegocioId,
                mesaStr,
                finalCamareroId,
                orderTotal,
                cliente_nombre ? String(cliente_nombre).trim() : null,
                cliente_telefono ? String(cliente_telefono).trim() : null,
                JSON.stringify(metaObj),
                isOrderDemo,
              ]
            );

            if (insertRes.rows.length === 0) {
              const { rows: existingRows } = await client.query(
                `SELECT id, negocio_id, mesa, estado, camarero_id, total::float, created_at, cliente_nombre, cliente_telefono, solicita_mesero, vertical, metadata, es_prueba
                 FROM pedidos WHERE id = $1::uuid`,
                [explicitOrderId]
              );
              createdOrderId = explicitOrderId;

              if (isRoundReq) {
                // --- RONDA EXTRA / AÑADIDO A COMANDA EXISTENTE ---
                const existingRow = existingRows[0];
                let currentMeta: any = {};
                try {
                  currentMeta = typeof existingRow.metadata === "string" ? JSON.parse(existingRow.metadata) : (existingRow.metadata || {});
                } catch {}
                const processedRounds = Array.isArray(currentMeta.processed_round_ids) ? currentMeta.processed_round_ids : [];

                if (roundAttemptId && processedRounds.includes(roundAttemptId)) {
                  // Idempotencia: esta ronda ya fue despachada e insertada previamente
                  isConflictRetry = true;
                  newOrderRows = existingRows;
                  orderTotal = existingRow.total;
                  metaObj.subtotal = currentMeta.subtotal ?? metaObj.subtotal;
                  metaObj.iva = currentMeta.iva ?? metaObj.iva;
                  metaObj.service_charge = currentMeta.service_charge ?? metaObj.service_charge;
                  metaObj.costo_envio = currentMeta.costo_envio ?? metaObj.costo_envio;
                  metaObj.discount_amount = currentMeta.discount_amount ?? metaObj.discount_amount;
                  metaObj.season_rate_amount = currentMeta.season_rate_amount ?? metaObj.season_rate_amount;
                  metaObj.tip = currentMeta.tip ?? metaObj.tip;
                  const { rows: existingItems } = await client.query(
                    `SELECT id, pedido_id, nombre, cantidad, precio::float, notas, es_añadido, estado_item
                     FROM pedido_items WHERE pedido_id = $1::uuid`,
                    [explicitOrderId]
                  );
                  insertedItems = existingItems;

                  // Conciliación estricta de identidad en reintento de ronda ya procesada
                  const reconcileRes = await reconcileRetryLinks(
                    client,
                    explicitOrderId,
                    authoritativeOrder.items || [],
                    existingItems,
                    items
                  );

                  if (!reconcileRes.allReconciled) {
                    // Despacho incompleto: marcar kdsDispatched = false
                    await client.query(
                      `UPDATE "Order"
                       SET "kdsDispatched" = false, "updatedAt" = NOW()
                       WHERE id = $1`,
                      [createdOrderId]
                    );
                    await client.query("COMMIT");
                    return NextResponse.json(
                      {
                        ok: false,
                        error: "Conciliación pendiente: existen líneas no conciliadas (UNRESOLVED) sin correspondencia explícita verificada.",
                        pendingReconciliation: true,
                        isConflictRetry: true,
                        orderId: createdOrderId,
                        unresolvedItemIds: reconcileRes.unresolvedItemIds,
                      },
                      { status: 409 }
                    );
                  }

                  await client.query(
                    `UPDATE "Order"
                     SET "kdsDispatched" = true, "updatedAt" = NOW()
                     WHERE id = $1`,
                    [createdOrderId]
                  );
                } else {
                  // Identificar ítems de la ronda autoritativa que aún no tienen sourcePedidoItemId
                  const undispatchedRoundItems = (authoritativeOrder.items || []).filter((i: any) => !i.sourcePedidoItemId);
                  const isDirectRound = undispatchedRoundItems.length === 0;

                  // Separar débitos confiables leídos de OrderItem de los datos de líneas nuevas enviados por el navegador
                  let roundItemIndex = 0;
                  const itemsToInsert = undispatchedRoundItems.length > 0
                    ? undispatchedRoundItems.map((oi: any) => ({
                        id: oi.id,
                        dishId: oi.dishId || null,
                        dishName: oi.dishName,
                        quantity: oi.quantity,
                        price: oi.price,
                        notes: oi.notes,
                        // Débito confiable SOLAMENTE si fue leído de OrderItem persistido en base de datos
                        confirmedUnitsDeducted: typeof oi.unitsDeducted === "number" ? oi.unitsDeducted : null,
                        isFromOrderItem: true,
                      }))
                    : (Array.isArray(items) ? items : []).map((it: any) => ({
                        id: null,
                        dishId: it.dishId || it.productId || null,
                        dishName: it.nombre || it.dishName,
                        quantity: it.quantity !== undefined ? it.quantity : it.cantidad,
                        price: it.price !== undefined ? it.price : it.precio,
                        notes: it.notes || it.notas || null,
                        // Datos de línea nueva del navegador: NUNCA autoritativos. Ignorar unitsDeducted o unidades_descontadas del cuerpo
                        confirmedUnitsDeducted: null,
                        isFromOrderItem: false,
                      }));

                  for (const it of itemsToInsert) {
                    roundItemIndex++;
                    const targetOrderItemId = it.isFromOrderItem ? it.id : null;

                    if (process.env.NODE_ENV === "test" && __testDispatchHooks.beforeItemInsert) {
                      await __testDispatchHooks.beforeItemInsert(roundItemIndex, targetOrderItemId);
                    }

                    const cantidad = validateItemQuantity(it.quantity, it.dishName);
                    const precio = typeof it.price === "number" ? it.price : (parseFloat(it.price) || 0);
                    const notasItem = it.notes || null;
                    let producto_id: string | null = null;
                    let unidades_descontadas: number | null = null;

                    const isOrderDemo = Boolean(existingRow.es_prueba);

                    if (it.isFromOrderItem && typeof it.confirmedUnitsDeducted === "number") {
                      // Débito confiable leído directamente de OrderItem en la base de datos
                      if (it.dishId) {
                        const { rows: dishRows } = await client.query(
                          `SELECT id FROM "Dish" WHERE id = $1 AND ("restaurantId" = $2 OR "restaurantId" = $3) LIMIT 1`,
                          [it.dishId, resolvedNegocioId, restaurantPrismaId]
                        );
                        if (dishRows.length > 0) {
                          producto_id = dishRows[0].id;
                          unidades_descontadas = it.confirmedUnitsDeducted;
                        }
                      }
                    } else {
                      // Línea nueva enviada por el navegador o OrderItem sin débito confirmado:
                      // Autenticarse como mesero/staff no demuestra que el stock ya se descontó.
                      // No se permite saltar el descuento mediante skip_stock_deduction.
                      // Una ronda REAL directa debe validar y descontar exactamente una vez bajo bloqueo.
                      // Una ronda DEMO conserva débito 0.
                      const executeDeductionForNewLine = !isOrderDemo;
                      const resDirect = await resolveDirectProductAndDebit(
                        client,
                        resolvedNegocioId!,
                        it,
                        executeDeductionForNewLine,
                        executeDeductionForNewLine,
                        isOrderDemo
                      );
                      producto_id = resDirect.producto_id;
                      unidades_descontadas = resDirect.unidades_descontadas;
                    }

                    const { rows: itemRows } = await client.query(
                      `INSERT INTO pedido_items (pedido_id, producto_id, nombre, cantidad, precio, notas, es_añadido, estado_item, unidades_descontadas)
                       VALUES ($1, $2, $3, $4, $5, $6, true, 'nuevo', $7)
                       RETURNING id, pedido_id, producto_id, nombre, cantidad, precio::float, notas, es_añadido, estado_item, unidades_descontadas`,
                      [createdOrderId, producto_id, it.dishName || "Plato", cantidad, precio, notasItem, unidades_descontadas]
                    );
                    const insertedPi = itemRows[0];
                    insertedItems.push(insertedPi);

                    if (process.env.NODE_ENV === "test" && (globalThis as any).__testHooks?.failDuringRoundDispatch) {
                      delete (globalThis as any).__testHooks.failDuringRoundDispatch;
                      throw new Error("TEST_FAIL_DURING_ROUND_DISPATCH");
                    }

                    if (process.env.NODE_ENV === "test" && __testDispatchHooks.afterItemInsert) {
                      await __testDispatchHooks.afterItemInsert(roundItemIndex, targetOrderItemId, String(insertedPi.id));
                    }

                    // Sincronizar o crear espejo en OrderItem en la MISMA transacción de PostgreSQL
                    if (targetOrderItemId) {
                      await client.query(
                        `UPDATE "OrderItem"
                         SET "sourcePedidoItemId" = $1, "lineStatus" = 'ACTIVE', "unitsDeducted" = COALESCE("unitsDeducted", $3)
                         WHERE id = $2`,
                        [String(insertedPi.id), targetOrderItemId, unidades_descontadas]
                      );
                    } else if (explicitOrderId) {
                      const newOiId = crypto.randomUUID();
                      await client.query(
                        `INSERT INTO "OrderItem" (id, "orderId", "dishId", "dishName", price, quantity, notes, "sourcePedidoItemId", "lineStatus", "unitsDeducted")
                         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'ACTIVE', $9)`,
                        [
                          newOiId,
                          explicitOrderId,
                          producto_id,
                          it.dishName || "Plato",
                          precio,
                          cantidad,
                          notasItem,
                          String(insertedPi.id),
                          unidades_descontadas,
                        ]
                      );
                    }
                  }

                  let roundFinalTotal = authoritativeOrder.total;
                  let roundFinalSubtotal = authoritativeOrder.subtotal;
                  let roundFinalIva = authoritativeOrder.iva;
                  let roundFinalService = authoritativeOrder.serviceCharge;

                  const existingDiscount = typeof authoritativeOrder.discountAmount === "number"
                    ? authoritativeOrder.discountAmount
                    : (Number(currentMeta.discount_amount ?? currentMeta.descuento) || 0);

                  const existingSeason = typeof authoritativeOrder.seasonRateAmount === "number"
                    ? authoritativeOrder.seasonRateAmount
                    : (Number(currentMeta.season_rate_amount ?? currentMeta.temporada) || 0);

                  const existingDelivery = typeof authoritativeOrder.deliveryCost === "number"
                    ? authoritativeOrder.deliveryCost
                    : (Number(currentMeta.costo_envio) || 0);

                  const existingTip = typeof authoritativeOrder.tip === "number"
                    ? authoritativeOrder.tip
                    : (Number(currentMeta.tip ?? currentMeta.propina) || 0);

                  const existingSnapshot = extractPricingSnapshot(currentMeta) ?? extractPricingSnapshot(authoritativeOrder.paymentDetails);
                  if (isDirectRound) {
                    const { rows: allActivePi } = await client.query(
                      `SELECT precio::float, cantidad FROM pedido_items
                       WHERE pedido_id = $1 AND (estado_item IS NULL OR estado_item != 'cancelado')`,
                      [createdOrderId]
                    );
                    const accumulatedSubtotal = allActivePi.reduce(
                      (acc, pi) => acc + (Number(pi.precio) || 0) * (parseInt(pi.cantidad) || 1),
                      0
                    );
                    const charges = existingSnapshot
                      ? calculateV4OrderTotals({
                          itemsSubtotal: accumulatedSubtotal,
                          isTable,
                          snapshot: existingSnapshot,
                          hasActiveItems: allActivePi.length > 0,
                          discountAmount: existingDiscount,
                          seasonRateAmount: existingSeason,
                          deliveryCost: existingDelivery,
                          tip: existingTip,
                        })
                      : calculatePostOrderTotals({
                          itemsSubtotal: accumulatedSubtotal,
                          isTable,
                          config: restConfig,
                          hasActiveItems: allActivePi.length > 0,
                          discountAmount: existingDiscount,
                          seasonRateAmount: existingSeason,
                          deliveryCost: existingDelivery,
                          tip: existingTip,
                        });
                    roundFinalSubtotal = charges.subtotal;
                    roundFinalIva = charges.iva;
                    roundFinalService = charges.serviceCharge;
                    roundFinalTotal = charges.total;
                  }

                  const cleanCurrentMeta = stripClientPricingFields(currentMeta);
                  const updatedMeta = {
                    ...cleanCurrentMeta,
                    ...(existingSnapshot
                      ? { pricing_version: existingSnapshot.pricingVersion, pricing_snapshot: existingSnapshot }
                      : {}),
                    subtotal: isDirectRound ? roundFinalSubtotal : (typeof authoritativeOrder.subtotal === "number" ? authoritativeOrder.subtotal : currentMeta.subtotal),
                    iva: isDirectRound ? roundFinalIva : (typeof authoritativeOrder.iva === "number" ? authoritativeOrder.iva : currentMeta.iva),
                    service_charge: isDirectRound ? roundFinalService : (typeof authoritativeOrder.serviceCharge === "number" ? authoritativeOrder.serviceCharge : currentMeta.service_charge),
                    costo_envio: isDirectRound ? existingDelivery : (typeof authoritativeOrder.deliveryCost === "number" ? authoritativeOrder.deliveryCost : (currentMeta.costo_envio ?? 0)),
                    discount_amount: isDirectRound ? existingDiscount : (typeof authoritativeOrder.discountAmount === "number" ? authoritativeOrder.discountAmount : (currentMeta.discount_amount ?? 0)),
                    season_rate_amount: isDirectRound ? existingSeason : (typeof authoritativeOrder.seasonRateAmount === "number" ? authoritativeOrder.seasonRateAmount : (currentMeta.season_rate_amount ?? 0)),
                    tip: isDirectRound ? existingTip : (typeof authoritativeOrder.tip === "number" ? authoritativeOrder.tip : (currentMeta.tip ?? 0)),
                    processed_round_ids: roundAttemptId ? [...processedRounds, roundAttemptId] : processedRounds,
                  };

                  const { rows: updatedRows } = await client.query(
                    `UPDATE pedidos 
                     SET total = $1, metadata = $2
                     WHERE id = $3::uuid
                     RETURNING id, negocio_id, mesa, estado, camarero_id, total::float, created_at, cliente_nombre, cliente_telefono, solicita_mesero, vertical, metadata`,
                    [roundFinalTotal, JSON.stringify(updatedMeta), createdOrderId]
                  );
                  newOrderRows = updatedRows;

                  // Actualizar kdsDispatched y desglose completo en "Order" en la MISMA transacción
                  await client.query(
                    `UPDATE "Order"
                     SET total = $1, subtotal = $2, iva = $3, "serviceCharge" = $4, "kdsDispatched" = true, "updatedAt" = NOW()
                     WHERE id = $5`,
                    [roundFinalTotal, roundFinalSubtotal, roundFinalIva, roundFinalService, createdOrderId]
                  );

                  orderTotal = roundFinalTotal;
                  metaObj.subtotal = roundFinalSubtotal;
                  metaObj.iva = roundFinalIva;
                  metaObj.service_charge = roundFinalService;
                  metaObj.costo_envio = isDirectRound ? existingDelivery : (metaObj.costo_envio ?? existingDelivery);
                  metaObj.discount_amount = isDirectRound ? existingDiscount : (metaObj.discount_amount ?? existingDiscount);
                  metaObj.season_rate_amount = isDirectRound ? existingSeason : (metaObj.season_rate_amount ?? existingSeason);
                  metaObj.tip = isDirectRound ? existingTip : (metaObj.tip ?? existingTip);
                }
              } else {
                // Conflicto de idempotencia detectado: el pedido ya existe en pedidos
                isConflictRetry = true;
                newOrderRows = existingRows;
                const { rows: existingItems } = await client.query(
                  `SELECT id, pedido_id, nombre, cantidad, precio::float, notas, es_añadido, estado_item
                   FROM pedido_items WHERE pedido_id = $1::uuid`,
                  [explicitOrderId]
                );
                insertedItems = existingItems;

                // Conciliación estricta de identidad en reintento de pedido inicial
                const reconcileRes = await reconcileRetryLinks(
                  client,
                  explicitOrderId,
                  authoritativeOrder.items || [],
                  existingItems,
                  items
                );

                if (!reconcileRes.allReconciled) {
                  // Despacho incompleto: marcar kdsDispatched = false
                  await client.query(
                    `UPDATE "Order"
                     SET "kdsDispatched" = false, "updatedAt" = NOW()
                     WHERE id = $1`,
                    [createdOrderId]
                  );
                  await client.query("COMMIT");
                  return NextResponse.json(
                    {
                      ok: false,
                      error: "Conciliación pendiente: existen líneas no conciliadas (UNRESOLVED) sin correspondencia explícita verificada.",
                      pendingReconciliation: true,
                      isConflictRetry: true,
                      orderId: createdOrderId,
                      unresolvedItemIds: reconcileRes.unresolvedItemIds,
                    },
                    { status: 409 }
                  );
                }

                await client.query(
                  `UPDATE "Order"
                   SET "kdsDispatched" = true, "updatedAt" = NOW()
                   WHERE id = $1`,
                  [createdOrderId]
                );
              }
            } else {
              newOrderRows = insertRes.rows;
              createdOrderId = newOrderRows[0].id;

              // Insertar ítems desde la orden autoritativa (con notas y precios de servidor)
              // y vincular atómicamente cada OrderItem en la MISMA transacción de PostgreSQL
              let itemIdx = 0;
              for (const it of authoritativeOrder.items) {
                itemIdx++;
                if (process.env.NODE_ENV === "test" && __testDispatchHooks.beforeItemInsert) {
                  await __testDispatchHooks.beforeItemInsert(itemIdx, it.id);
                }

                const cantidad = it.quantity || 1;
                const precio = it.price || 0;
                const notasItem = it.notes || null;
                let producto_id: string | null = null;
                let unidades_descontadas: number | null = null;

                if (typeof it.unitsDeducted === "number") {
                  if (it.dishId) {
                    const { rows: dishRows } = await client.query(
                      `SELECT id FROM "Dish" WHERE id = $1 AND ("restaurantId" = $2 OR "restaurantId" = $3) LIMIT 1`,
                      [it.dishId, resolvedNegocioId, restaurantPrismaId]
                    );
                    if (dishRows.length > 0) {
                      producto_id = dishRows[0].id;
                      unidades_descontadas = it.unitsDeducted;
                    }
                  }
                } else {
                  // Si el OrderItem autoritativo no tenía débito confirmado en base de datos,
                  // resolver producto y debitar exactamente una vez bajo bloqueo
                  const isOrderDemo = Boolean(authoritativeOrder.isTest);
                  const executeDeductionForUnconfirmed = !isOrderDemo;
                  const resDirect = await resolveDirectProductAndDebit(
                    client,
                    resolvedNegocioId!,
                    it,
                    executeDeductionForUnconfirmed,
                    executeDeductionForUnconfirmed,
                    isOrderDemo
                  );
                  producto_id = resDirect.producto_id;
                  unidades_descontadas = resDirect.unidades_descontadas;
                  await client.query(
                    `UPDATE "OrderItem" SET "unitsDeducted" = $1 WHERE id = $2`,
                    [unidades_descontadas, it.id]
                  );
                }

                const { rows: itemRows } = await client.query(
                  `INSERT INTO pedido_items (pedido_id, producto_id, nombre, cantidad, precio, notas, es_añadido, estado_item, unidades_descontadas)
                   VALUES ($1, $2, $3, $4, $5, $6, false, 'nuevo', $7)
                   RETURNING id, pedido_id, producto_id, nombre, cantidad, precio::float, notas, es_añadido, estado_item, unidades_descontadas`,
                  [createdOrderId, producto_id, it.dishName, cantidad, precio, notasItem, unidades_descontadas]
                );
                const insertedPi = itemRows[0];
                insertedItems.push(insertedPi);

                if (process.env.NODE_ENV === "test" && __testDispatchHooks.afterItemInsert) {
                  await __testDispatchHooks.afterItemInsert(itemIdx, it.id, String(insertedPi.id));
                }

                // Vínculo atómico en la MISMA transacción PostgreSQL
                await client.query(
                  `UPDATE "OrderItem"
                   SET "sourcePedidoItemId" = $1, "lineStatus" = 'ACTIVE'
                   WHERE id = $2`,
                  [String(insertedPi.id), it.id]
                );
              }

              // Marcar kdsDispatched dentro de la MISMA transacción
              await client.query(
                `UPDATE "Order"
                 SET "kdsDispatched" = true, "updatedAt" = NOW()
                 WHERE id = $1`,
                [createdOrderId]
              );
            }
          } else {
            // Flujo normal nativo (sin orden previa autoritativa)
            const isOrderDemo = restaurantTestMode;
            const insertRes = await client.query(
              `INSERT INTO pedidos (negocio_id, mesa, camarero_id, estado, total, cliente_nombre, cliente_telefono, vertical, metadata, es_prueba)
               VALUES ($1, $2, $3, 'nuevo', $4, $5, $6, 'menuqr', $7, $8)
               RETURNING id, negocio_id, mesa, estado, camarero_id, total::float, created_at, cliente_nombre, cliente_telefono, solicita_mesero, vertical, metadata, es_prueba`,
              [
                resolvedNegocioId,
                mesaStr,
                finalCamareroId,
                orderTotal,
                cliente_nombre ? String(cliente_nombre).trim() : null,
                cliente_telefono ? String(cliente_telefono).trim() : null,
                JSON.stringify(metaObj),
                isOrderDemo,
              ]
            );
            newOrderRows = insertRes.rows;
            createdOrderId = newOrderRows[0].id;

            for (const item of items) {
              const { producto_id, unidades_descontadas, validQuantity } = await resolveDirectProductAndDebit(
                client,
                resolvedNegocioId!,
                item,
                !isOrderDemo,
                !isOrderDemo,
                isOrderDemo
              );
              const cantidad = validQuantity;
              const precio = parseFloat(item.precio) || 0;

              if ((globalThis as any).__testHooks?.failAfterStockDeductBeforeItemInsert) {
                delete (globalThis as any).__testHooks.failAfterStockDeductBeforeItemInsert;
                throw new Error("TEST_FAIL_AFTER_STOCK_DEDUCT_BEFORE_ITEM_INSERT");
              }

              const { rows: itemRows } = await client.query(
                `INSERT INTO pedido_items (pedido_id, producto_id, nombre, cantidad, precio, notas, es_añadido, estado_item, unidades_descontadas)
                 VALUES ($1, $2, $3, $4, $5, $6, false, 'nuevo', $7)
                 RETURNING id, pedido_id, producto_id, nombre, cantidad, precio::float, notas, es_añadido, estado_item, unidades_descontadas`,
                [createdOrderId, producto_id, item.nombre, cantidad, precio, item.notas || null, unidades_descontadas]
              );
              insertedItems.push(itemRows[0]);
            }
          }

          await client.query("COMMIT");

          let camareroNombre = "Sin camarero";
          if (finalCamareroId) {
            const { rows: camRows } = await pool.query(
              "SELECT nombre FROM camareros WHERE id = $1",
              [finalCamareroId]
            );
            if (camRows[0]) camareroNombre = camRows[0].nombre;
          }

          // Si es una ronda, cargar todos los platos activos acumulados de la comanda
          if (isRoundReq) {
            const { rows: allOrderItems } = await pool.query(
              `SELECT id, nombre, cantidad, precio::float, notas, es_añadido, estado_item 
               FROM pedido_items WHERE pedido_id = $1 AND (estado_item IS NULL OR estado_item != 'cancelado') ORDER BY es_añadido ASC, nombre ASC`,
              [createdOrderId]
            );

            responseOrder = {
              ...newOrderRows[0],
              camarero_nombre: camareroNombre,
              items: allOrderItems,
            };
          } else {
            responseOrder = {
              ...newOrderRows[0],
              camarero_nombre: camareroNombre,
              items: insertedItems,
            };
          }

          // Notificar vía Socket.IO y Telegram SOLO SI NO ES REINTENTO DUPLICADO
          if (!isConflictRetry) {
            if (isRoundReq) {
              emitItemsAñadidos(
                resolvedNegocioId,
                mesaStr,
                insertedItems,
                createdOrderId,
                Number(responseOrder?.total ?? orderTotal ?? 0),
                (responseOrder as any)?.order_number
              );
              emitPedidoActualizado(resolvedNegocioId, responseOrder);
            } else {
              emitNuevoPedido(resolvedNegocioId, responseOrder);
            }

            if (!authoritativeOrder) {
              void syncSinglePedidoToPrisma(createdOrderId, resolvedNegocioId);
            }

            const channelLabel = isDeliveryReq 
              ? "Domicilio" 
              : isLlevarReq 
              ? "Para Llevar" 
              : (mesaStr.toLowerCase().includes("mesa") ? mesaStr : "Mesa " + mesaStr);

            if (isRoundReq) {
              void sendTelegramAlert({
                mensaje: `🍽️ Platos adicionales en ${channelLabel} (${businessName}): ${insertedItems.map((it) => `${it.cantidad}x ${it.nombre}`).join(", ")} | Total acumulado comanda: $${Number(responseOrder?.total ?? orderTotal ?? 0).toFixed(2)}`,
                cliente: cliente_nombre ? String(cliente_nombre).trim() : "Comensal",
                negocio: businessName,
              });
            } else {
              void sendTelegramAlert({
                mensaje: `🍽️ Nuevo pedido [${channelLabel}] (${businessName}) por $${Number(responseOrder?.total ?? orderTotal ?? 0).toFixed(2)} (${insertedItems.length} platos): ${insertedItems.map((it) => `${it.cantidad}x ${it.nombre}`).join(", ")}`,
                cliente: cliente_nombre ? String(cliente_nombre).trim() : "Cliente",
                negocio: businessName,
              });
            }
          }

          if (isRoundReq) {
            whatsappMessageText = `*Platos adicionales en Mesa ${mesaStr}*\n` +
              `*Local:* ${businessName}\n` +
              `*Comensal:* ${cliente_nombre || "Cliente"}\n\n` +
              `*Platos añadidos:*\n` +
              insertedItems.map((it) => `• ${it.cantidad}x ${it.nombre} ($${(Number(it.precio || 0) * Number(it.cantidad || 1)).toFixed(2)})`).join("\n") +
              `\n\n*Total acumulado de la comanda:* $${Number(responseOrder?.total ?? orderTotal ?? 0).toFixed(2)}`;
          } else {
            whatsappMessageText = `*Nuevo Pedido - MenuQR Pro*\n` +
              `*Restaurante:* ${businessName}\n` +
              `*Modalidad:* ${channelLabel}\n` +
              `*Cliente:* ${cliente_nombre || "Cliente"}\n` +
              (cliente_telefono ? `*Teléfono:* ${cliente_telefono}\n` : "") +
              (cliente_direccion ? `*Dirección:* ${cliente_direccion}\n` : "") +
              `\n*Detalle del pedido:*\n` +
              insertedItems.map((it) => `• ${it.cantidad}x ${it.nombre} ($${(Number(it.precio || 0) * Number(it.cantidad || 1)).toFixed(2)})`).join("\n") +
              (parsedDeliveryCost > 0 ? `\n*Costo de Envío:* $${parsedDeliveryCost.toFixed(2)}` : "") +
              `\n\n*Total a pagar:* $${Number(responseOrder?.total ?? orderTotal ?? 0).toFixed(2)}`;
          }

          const targetPhone = formatWhatsAppNumber(businessPhone || cliente_telefono || "");
          const waUrl = targetPhone ? `https://wa.me/${targetPhone}?text=${encodeURIComponent(whatsappMessageText)}` : "";

          let tableSessionToken: string | undefined;
          if (mesaStr && mesaStr !== "Llevar" && mesaStr !== "Delivery") {
            const mesaStrClean = mesaStr.replace(/^(mesa\s*#?|#)/i, "").trim();
            tableSessionToken = signTableSessionToken({
              negocioId: (responseOrder as any)?.negocio_id || resolvedNegocioId,
              mesa: mesaStrClean,
              orderId: responseOrder?.id,
              customerName: cliente_nombre ? String(cliente_nombre).trim() : undefined,
              createdAt: Date.now(),
            });
          }

          const res = NextResponse.json({
            ok: true,
            id: createdOrderId,
            tipo: "nuevo_pedido",
            pedido: responseOrder,
            items: insertedItems,
            whatsapp_url: waUrl,
            vertical: "menuqr",
            table_session_token: tableSessionToken,
            is_retry: isConflictRetry,
            subtotal: metaObj.subtotal,
            iva: metaObj.iva,
            service_charge: metaObj.service_charge,
            costo_envio: metaObj.costo_envio,
            discount_amount: metaObj.discount_amount,
            season_rate_amount: metaObj.season_rate_amount,
            tip: metaObj.tip,
            total: orderTotal,
          });

          if (tableSessionToken) {
            res.cookies.set("table_session", tableSessionToken, {
              httpOnly: true,
              secure: process.env.NODE_ENV === "production",
              path: "/",
              sameSite: "lax",
              maxAge: 12 * 3600,
            });
          }

          return res;
        }
      }

      // =========================================================================
      // CASO B: VERTICAL CTALO (Tiendas de Ropa, Calzado, Joyería, Retail)
      // =========================================================================
      else if (isCatalogOrder) {
        if (!Array.isArray(items) || items.length === 0) {
          await client.query("ROLLBACK");
          return NextResponse.json(
            { ok: false, error: "El pedido de catálogo debe incluir al menos un producto" },
            { status: 400 }
          );
        }

        // Bloqueo pesimista canónico en orden lexicográfico de IDs para prevenir deadlocks
        const deductTarget = restaurantPrismaId || resolvedNegocioId;
        const candidateDishIds = (items || [])
          .map((it: any) => it.dishId || it.productId || (it.id && typeof it.id === "string" && !it.id.startsWith("cart-") && it.id.length > 5 ? it.id : null))
          .filter(Boolean) as string[];
        const sortedDishIds = Array.from(new Set(candidateDishIds)).sort();
        if (sortedDishIds.length > 0) {
          await client.query(
            `SELECT id FROM "Dish" WHERE id = ANY($1::text[]) ORDER BY id FOR UPDATE`,
            [sortedDishIds]
          );
        }

        let subtotal = 0;
        for (const it of items) {
          const rawQty = it.quantity !== undefined ? it.quantity : it.cantidad;
          const qty = validateItemQuantity(rawQty, it.nombre || it.dishName);
          const pr = typeof it.price === "number" ? it.price : (parseFloat(it.precio) || 0);
          subtotal += qty * pr;
        }

        const envio = parseFloat(costo_envio) || 0;
        const descuento = parseFloat(body.descuento) || 0;
        const propina = parseFloat(body.propina) || 0;
        const zonaEnvio = body.zona_envio || null;
        const metodoPago = body.metodo_pago || "Efectivo / Local";
        const codigoCupon = body.codigo_cupon || null;
        const effectiveDelivery = tipo_entrega
          ? (String(tipo_entrega).toUpperCase() === "RETIRO" ? "retiro" : "domicilio")
          : (metodo_entrega === "retiro" ? "retiro" : "domicilio");

        orderTotal = typeof total === "number" && total > 0 ? total : Math.max(0, subtotal - descuento) + envio + propina;

        const metadataCatalogo = {
          metodo_entrega: effectiveDelivery,
          tipo_entrega: effectiveDelivery.toUpperCase(),
          cliente_direccion: cliente_direccion || "",
          costo_envio: envio,
          subtotal,
          zona_envio: zonaEnvio,
          metodo_pago: metodoPago,
          codigo_cupon: codigoCupon,
          descuento,
          propina,
          notas_entrega: notas_entrega || "",
        };

        const { rows: orderRows } = await client.query(
          `INSERT INTO pedidos (negocio_id, mesa, estado, total, cliente_nombre, cliente_telefono, vertical, metadata)
           VALUES ($1, 'CATALOGO', 'nuevo', $2, $3, $4, 'ctalo', $5)
           RETURNING id, negocio_id, mesa, estado, total::float, created_at, cliente_nombre, cliente_telefono, vertical, metadata`,
          [
            resolvedNegocioId,
            orderTotal,
            cliente_nombre ? String(cliente_nombre).trim() : "Cliente Tienda",
            cliente_telefono ? String(cliente_telefono).trim() : null,
            JSON.stringify(metadataCatalogo),
          ]
        );

        createdOrderId = orderRows[0].id;

        for (const item of items) {
          const pr = parseFloat(item.precio) || 0;
          
          // Construir descripción de variante una sola vez sin duplicar
          let variantDesc = "";
          if (item.talla || item.color) {
            const parts: string[] = [];
            if (item.talla) parts.push(`Talla: ${item.talla}`);
            if (item.color) parts.push(`Color: ${item.color}`);
            variantDesc = parts.join(" · ");
          } else if (item.notas) {
            variantDesc = String(item.notas).trim();
          }

          const { producto_id, unidades_descontadas, validQuantity } = await resolveDirectProductAndDebit(
            client,
            resolvedNegocioId!,
            item,
            Boolean(deductTarget),
            Boolean(deductTarget)
          );
          const qty = validQuantity;

          if ((globalThis as any).__testHooks?.failAfterStockDeductBeforeItemInsert) {
            delete (globalThis as any).__testHooks.failAfterStockDeductBeforeItemInsert;
            throw new Error("TEST_FAIL_AFTER_STOCK_DEDUCT_BEFORE_ITEM_INSERT");
          }

          const { rows: itemRows } = await client.query(
            `INSERT INTO pedido_items (pedido_id, producto_id, nombre, cantidad, precio, notas, es_añadido, estado_item, unidades_descontadas)
             VALUES ($1, $2, $3, $4, $5, $6, false, 'nuevo', $7)
             RETURNING id, pedido_id, producto_id, nombre, cantidad, precio::float, notas, es_añadido, estado_item, unidades_descontadas`,
            [createdOrderId, producto_id, item.nombre, qty, pr, variantDesc || null, unidades_descontadas]
          );
          insertedItems.push(itemRows[0]);
        }

        await client.query("COMMIT");

        // --- PERSISTENCIA EN PRISMA ORDER (Para /admin Monitor de Pedidos y Métricas) ---
        let prismaOrderId: string | null = null;
        try {
          const targetPrismaRestId = restaurantPrismaId || (await prisma.restaurant.findFirst({
            where: {
              OR: [
                ...(resolvedNegocioId ? [{ id: resolvedNegocioId }] : []),
                ...(businessSlug ? [{ slug: businessSlug }] : []),
              ],
            },
            select: { id: true },
          }))?.id;

          if (targetPrismaRestId) {
            const activeShift = await prisma.cashShift.findFirst({
              where: { restaurantId: targetPrismaRestId, status: "OPEN" },
              select: { id: true },
            });

            const newPrismaOrder = await prisma.order.create({
              data: {
                restaurantId: targetPrismaRestId,
                cashShiftId: activeShift?.id || null,
                tableName: "CATALOGO",
                customerName: cliente_nombre ? String(cliente_nombre).trim().slice(0, 200) : "Cliente Catálogo",
                customerPhone: cliente_telefono ? String(cliente_telefono).trim().slice(0, 50) : null,
                customerAddress: cliente_direccion ? String(cliente_direccion).slice(0, 500) : null,
                status: "PENDING",
                subtotal: subtotal,
                iva: 0,
                serviceCharge: 0,
                tip: propina,
                deliveryCost: envio,
                discountAmount: descuento,
                total: orderTotal,
                paymentMethod: metodoPago,
                isTest: false,
                items: {
                  create: items.map((it: any) => {
                    let itemDesc = "";
                    if (it.talla || it.color) {
                      const parts: string[] = [];
                      if (it.talla) parts.push(`Talla: ${it.talla}`);
                      if (it.color) parts.push(`Color: ${it.color}`);
                      itemDesc = parts.join(" · ");
                    } else if (it.notas) {
                      itemDesc = String(it.notas).trim();
                    }
                    return {
                      dishName: it.nombre + (itemDesc ? ` (${itemDesc})` : ""),
                      price: parseFloat(it.precio) || 0,
                      quantity: parseInt(it.cantidad) || 1,
                    };
                  }),
                },
              },
            });
            prismaOrderId = newPrismaOrder.id;

            // Actualizar o registrar cliente en CRM de clientes
            if (cliente_telefono) {
              const cleanPhone = String(cliente_telefono).trim();
              const existingCust = await prisma.customer.findFirst({
                where: { restaurantId: targetPrismaRestId, phone: cleanPhone },
              });
              if (existingCust) {
                await prisma.customer.update({
                  where: { id: existingCust.id },
                  data: {
                    name: cliente_nombre ? String(cliente_nombre).trim() : existingCust.name,
                    totalOrders: { increment: 1 },
                    totalSpent: { increment: orderTotal },
                    lastOrderAt: new Date(),
                  },
                });
              } else {
                await prisma.customer.create({
                  data: {
                    restaurantId: targetPrismaRestId,
                    name: cliente_nombre ? String(cliente_nombre).trim() : "Cliente Catálogo",
                    phone: cleanPhone,
                    address: cliente_direccion ? String(cliente_direccion).slice(0, 500) : null,
                    totalOrders: 1,
                    totalSpent: orderTotal,
                    lastOrderAt: new Date(),
                  },
                });
              }
            }

            // Revalidar caché de /admin para refresco inmediato
            try {
              revalidatePath("/admin");
            } catch {}
          }
        } catch (errPrisma) {
          console.error("[POST /api/pedidos] Error al guardar en Prisma Order:", errPrisma);
        }

        // Alerta instantánea a Telegram vía webhook n8n (no bloqueante)
        void sendTelegramAlert({
          mensaje: `🛍️ Nuevo pedido de catálogo (${businessName}) por $${orderTotal.toFixed(2)} [${effectiveDelivery === "domicilio" ? "Domicilio 🛵" : "Retiro en Tienda 🏬"}]: ${insertedItems.map((it) => `${it.cantidad}x ${it.nombre}`).join(", ")}`,
          cliente: cliente_nombre ? String(cliente_nombre).trim() : "Cliente Tienda",
          negocio: businessName,
        });

        whatsappMessageText = `🛍️ *NUEVO PEDIDO - CATÁLOGO ${businessName.toUpperCase()}*\n\n` +
          `👤 *Datos del Cliente:*\n` +
          `• *Nombre:* ${cliente_nombre ? String(cliente_nombre).trim() : "Cliente"}\n` +
          `• *Teléfono:* ${cliente_telefono ? String(cliente_telefono).trim() : "No especificado"}\n` +
          `• *Modalidad:* ${effectiveDelivery === "domicilio" ? `Envío a Domicilio 🛵 ${zonaEnvio ? `(${zonaEnvio})` : ""}` : "Retiro en Tienda 🏬"}\n` +
          (effectiveDelivery === "domicilio" && cliente_direccion ? `• *Dirección:* ${cliente_direccion}\n` : "") +
          (effectiveDelivery === "retiro" ? `• *Punto de Retiro:* ${businessAddress || "Local Comercial principal"}\n` : "") +
          (notas_entrega ? `• *Notas:* ${notas_entrega}\n` : "") +
          `\n📦 *Productos Solicitados:*\n` +
          insertedItems.map((it) => `• ${it.cantidad}x ${it.nombre} ${it.notas ? `[${it.notas}]` : ""} -> $${(Number(it.precio || 0) * Number(it.cantidad || 1)).toFixed(2)}`).join("\n") +
          `\n\n💰 *Resumen Financiero:*\n` +
          `• *Subtotal:* $${subtotal.toFixed(2)}\n` +
          (envio > 0 ? `• *Costo de Envío:* $${envio.toFixed(2)}\n` : "") +
          (descuento > 0 ? `• *Descuento (${codigoCupon || "Cupón"}):* -$${descuento.toFixed(2)}\n` : "") +
          (propina > 0 ? `• *Propina:* $${propina.toFixed(2)}\n` : "") +
          `• *TOTAL: $${orderTotal.toFixed(2)}*\n\n` +
          `💳 *Método de Pago:* ${metodoPago}` +
          (metodoPago.toLowerCase().includes("transferencia") || metodoPago.toLowerCase().includes("qr") || metodoPago.toLowerCase().includes("deuna") || metodoPago.toLowerCase().includes("payphone") ? `\n📸 *Adjunto comprobante de pago.*` : "");

        const targetPhone = formatWhatsAppNumber(businessPhone || cliente_telefono || "");
        const waUrl = targetPhone ? `https://wa.me/${targetPhone}?text=${encodeURIComponent(whatsappMessageText)}` : "";

        return NextResponse.json({
          ok: true,
          id: prismaOrderId || createdOrderId,
          pedidoId: createdOrderId,
          prismaOrderId,
          pedido: { ...orderRows[0], items: insertedItems },
          whatsapp_url: waUrl,
          vertical: "ctalo",
        });
      }

      // =========================================================================
      // CASO C: VERTICAL SERVICIOS (Técnicos, Plomeros, Electricistas - Cotizador Express)
      // =========================================================================
      else if (vertical === "servicios") {
        const metadataServicios = {
          servicio_solicitado: servicio_solicitado || "Cotización Técnica",
          descripcion_problema: descripcion_problema || "",
          urgencia: urgencia || "normal",
          marca_equipo: marca_equipo || null,
          tipo_tecnologia: tipo_tecnologia || null,
          sintomas_detectados: Array.isArray(sintomas_detectados) ? sintomas_detectados : [],
          franja_horaria: franja_horaria || null,
          visita_condicion: visita_condicion || "100% deducible si se realiza el trabajo",
          latitud: latitud || null,
          longitud: longitud || null,
          direccion_referencia: direccion_referencia || cliente_direccion || "",
          fecha_preferida: fecha_preferida || "Lo antes posible",
          fotos_urls: Array.isArray(fotos_urls) ? fotos_urls : [],
        };

        const { rows: orderRows } = await client.query(
          `INSERT INTO pedidos (negocio_id, mesa, estado, total, cliente_nombre, cliente_telefono, vertical, metadata)
           VALUES ($1, 'COTIZACION', 'nuevo', 0, $2, $3, 'servicios', $4)
           RETURNING id, negocio_id, mesa, estado, total::float, created_at, cliente_nombre, cliente_telefono, vertical, metadata`,
          [
            resolvedNegocioId,
            cliente_nombre ? String(cliente_nombre).trim() : "Cliente Solicitante",
            cliente_telefono ? String(cliente_telefono).trim() : null,
            JSON.stringify(metadataServicios),
          ]
        );

        createdOrderId = orderRows[0].id;

        // Insertar item de solicitud
        const { rows: itemRows } = await client.query(
          `INSERT INTO pedido_items (pedido_id, nombre, cantidad, precio, notas)
           VALUES ($1, $2, 1, 0, $3)
           RETURNING id, nombre, cantidad, precio::float, notas`,
          [createdOrderId, servicio_solicitado || "Servicio Técnico Solicitado", descripcion_problema || null]
        );
        insertedItems.push(itemRows[0]);

        await client.query("COMMIT");

        // =========================================================================
        // SINCRONIZACIÓN AUTOMÁTICA DUAL (Prisma Order para Historial & Customer para CRM)
        // =========================================================================
        try {
          let targetRestaurant = null;
          if (slug) {
            targetRestaurant = await prisma.restaurant.findUnique({
              where: { slug: String(slug).toLowerCase().trim() },
              select: { id: true, name: true, slug: true }
            });
          }
          if (!targetRestaurant && resolvedNegocioId) {
            targetRestaurant = await prisma.restaurant.findFirst({
              where: {
                OR: [
                  { id: String(resolvedNegocioId) },
                  { slug: String(slug || "").toLowerCase().trim() }
                ]
              },
              select: { id: true, name: true, slug: true }
            });
          }

          if (targetRestaurant) {
            const rawCustPhone = cliente_telefono ? String(cliente_telefono).trim() : "";
            const cleanCustName = cliente_nombre ? String(cliente_nombre).trim() : "Cliente Solicitante";
            const fullAddress = `${direccion_referencia || cliente_direccion || ""}${latitud && longitud ? ` [GPS: ${latitud},${longitud}]` : ""}`.trim();

            // A. Registrar en Order (para que aparezca en "Historial de Pedidos")
            const orderItemsData: Array<{ dishName: string; price: number; quantity: number }> = [
              {
                dishName: servicio_solicitado || "Cotización de Servicio Técnico",
                price: 0,
                quantity: 1,
              }
            ];

            if (marca_equipo) {
              orderItemsData.push({
                dishName: `Marca: ${marca_equipo}${tipo_tecnologia ? ` • ${tipo_tecnologia}` : ""}`,
                price: 0,
                quantity: 1,
              });
            }

            if (Array.isArray(sintomas_detectados) && sintomas_detectados.length > 0) {
              orderItemsData.push({
                dishName: `Síntomas: ${sintomas_detectados.join(", ")}`,
                price: 0,
                quantity: 1,
              });
            }

            if (franja_horaria) {
              orderItemsData.push({
                dishName: `Horario: ${franja_horaria}`,
                price: 0,
                quantity: 1,
              });
            }

            await prisma.order.create({
              data: {
                restaurantId: targetRestaurant.id,
                tableName: "Visita Técnica",
                customerName: cleanCustName,
                customerPhone: rawCustPhone || null,
                customerAddress: fullAddress || null,
                status: "PENDING",
                subtotal: 0,
                iva: 0,
                serviceCharge: 0,
                tip: 0,
                deliveryCost: 0,
                discountAmount: 0,
                total: 0,
                paymentMethod: "WHATSAPP_COTIZACION",
                isTest: false,
                items: {
                  create: orderItemsData,
                },
              },
            });

            // B. Capturar Lead en Customer (CRM Clientes)
            if (rawCustPhone) {
              const existingCustomer = await prisma.customer.findFirst({
                where: {
                  restaurantId: targetRestaurant.id,
                  phone: rawCustPhone,
                },
              });

              if (existingCustomer) {
                let existingMeta: Record<string, unknown> = {};
                try {
                  existingMeta = JSON.parse(existingCustomer.notes || "{}");
                } catch {}

                const updatedMeta = JSON.stringify({
                  ...existingMeta,
                  lastService: servicio_solicitado || existingMeta.lastService || "Servicio Técnico",
                  equipmentBrand: marca_equipo || existingMeta.equipmentBrand || "",
                  equipmentTech: tipo_tecnologia || existingMeta.equipmentTech || "",
                  symptoms: Array.isArray(sintomas_detectados) && sintomas_detectados.length > 0
                    ? sintomas_detectados
                    : existingMeta.symptoms || [],
                  preferredTimeSlot: franja_horaria || existingMeta.preferredTimeSlot || "",
                  lastQuoteAt: new Date().toISOString(),
                });

                await prisma.customer.update({
                  where: { id: existingCustomer.id },
                  data: {
                    name: cleanCustName !== "Cliente Solicitante" ? cleanCustName : existingCustomer.name,
                    address: fullAddress || existingCustomer.address,
                    totalOrders: existingCustomer.totalOrders + 1,
                    lastOrderAt: new Date(),
                    notes: updatedMeta,
                  },
                });
              } else {
                const initialMeta = JSON.stringify({
                  dietary: [],
                  allergies: "",
                  birthDate: "",
                  points: 0,
                  favoriteDish: servicio_solicitado || "Servicio Técnico",
                  lastService: servicio_solicitado || "Servicio Técnico",
                  equipmentBrand: marca_equipo || "",
                  equipmentTech: tipo_tecnologia || "",
                  symptoms: Array.isArray(sintomas_detectados) ? sintomas_detectados : [],
                  preferredTimeSlot: franja_horaria || "",
                  lastQuoteAt: new Date().toISOString(),
                });

                await prisma.customer.create({
                  data: {
                    restaurantId: targetRestaurant.id,
                    name: cleanCustName,
                    phone: rawCustPhone,
                    address: fullAddress || null,
                    category: "NUEVO",
                    totalOrders: 1,
                    totalSpent: 0,
                    lastOrderAt: new Date(),
                    notes: initialMeta,
                  },
                });
              }
            }

            try {
              revalidatePath("/admin");
            } catch {}
          }
        } catch (prismaSyncErr) {
          console.error("Error sincronizando cotización con Prisma Order/Customer:", prismaSyncErr);
        }

        // Construir enlace de Google Maps si se envió lat/lng
        let mapsLink = "";
        if (latitud && longitud) {
          mapsLink = `https://www.google.com/maps/search/?api=1&query=${latitud},${longitud}`;
        }

        const formattedSymptoms = Array.isArray(sintomas_detectados) && sintomas_detectados.length > 0
          ? sintomas_detectados.join(", ")
          : "";

        whatsappMessageText = `*🔧 Nueva Solicitud de Cotización Express*\n` +
          `*Profesional / Empresa:* ${businessName}\n` +
          `*Cliente:* ${cliente_nombre || "Cliente"}\n` +
          `*Teléfono:* ${cliente_telefono || "No indicado"}\n` +
          `*Servicio Requerido:* ${servicio_solicitado || "Asistencia Técnica"}\n` +
          `*Nivel de Urgencia:* ${urgencia === "urgente_24_7" ? "🚨 Urgencia Inmediata (24/7)" : "Estándar / Programada"}\n` +
          (marca_equipo ? `*Marca del Equipo:* ${marca_equipo}\n` : "") +
          (tipo_tecnologia ? `*Tecnología:* ${tipo_tecnologia}\n` : "") +
          (formattedSymptoms ? `*Síntomas:* ${formattedSymptoms}\n` : "") +
          (franja_horaria ? `*Franja Horaria:* ${franja_horaria}\n` : "") +
          `*Condición de Visita:* Diagnóstico en domicilio (100% deducible si se realiza el trabajo)\n` +
          `*Fecha Preferida:* ${fecha_preferida || "A convenir"}\n` +
          (direccion_referencia ? `*Dirección / Referencia:* ${direccion_referencia}\n` : "") +
          (mapsLink ? `*📍 Ubicación GPS:* ${mapsLink}\n` : "") +
          (descripcion_problema ? `\n*Detalles adicionales:*\n"${descripcion_problema}"\n` : "") +
          (fotos_urls.length > 0 ? `\n*Fotos adjuntas (${fotos_urls.length}):*\n` + fotos_urls.slice(0, 3).map((f: string, i: number) => `• Foto ${i + 1}: ${f}`).join("\n") + "\n" : "") +
          `\n--------------------------------\n` +
          `📸🎙️ *ADJUNTA AQUÍ:* Envía a continuación fotos, audios o videos de la avería para darte el presupuesto exacto.\n\n` +
          `_Por favor confirma disponibilidad y presupuesto preliminar._`;

        const targetPhone = formatWhatsAppNumber(businessPhone || cliente_telefono || "");
        const waUrl = targetPhone ? `https://wa.me/${targetPhone}?text=${encodeURIComponent(whatsappMessageText)}` : "";

        // Alerta instantánea a Telegram vía webhook n8n (no bloqueante)
        void sendTelegramAlert({
          mensaje: `🛠️ Nueva cotización técnica (${businessName}): ${servicio_solicitado || "Servicio Técnico"}${marca_equipo ? ` [${marca_equipo}]` : ""}${franja_horaria ? ` | Horario: ${franja_horaria}` : ""}`,
          cliente: cliente_nombre ? String(cliente_nombre).trim() : "Cliente Solicitante",
          negocio: businessName,
        });

        return NextResponse.json({
          ok: true,
          id: createdOrderId,
          pedido: { ...orderRows[0], items: insertedItems },
          whatsapp_url: waUrl,
          vertical: "servicios",
        });
      }

      // =========================================================================
      // CASO D: VERTICAL CITAS (Consultorios, Barberías, Dentistas, Spas)
      // =========================================================================
      else if (vertical === "citas") {
        const abonoNum = parseFloat(monto_abono as any) || 0;
        const totalEstimado = parseFloat(precio_estimado as any) || 0;

        const metadataCitas = {
          servicio_nombre: servicio_nombre || "Cita General",
          especialista_id: especialista_id || null,
          especialista_nombre: especialista_nombre || "Profesional de Turno",
          fecha_cita: fecha_cita || new Date().toISOString().split("T")[0],
          hora_cita: hora_cita || "Por confirmar",
          duracion_min: duracion_min || 30,
          notas_cita: notas_cita || "",
          modalidad_pago: modalidad_pago || "RECEPCION",
          monto_abono: modalidad_pago === "ABONO_PREVIO" ? abonoNum : 0,
          saldo_pendiente: Math.max(0, totalEstimado - (modalidad_pago === "ABONO_PREVIO" ? abonoNum : 0)),
          comprobante_ref: comprobante_ref ? String(comprobante_ref).trim() : null,
        };

        orderTotal = totalEstimado;

        const { rows: orderRows } = await client.query(
          `INSERT INTO pedidos (negocio_id, mesa, estado, total, cliente_nombre, cliente_telefono, vertical, metadata)
           VALUES ($1, 'CITA', 'nuevo', $2, $3, $4, 'citas', $5)
           RETURNING id, negocio_id, mesa, estado, total::float, created_at, cliente_nombre, cliente_telefono, vertical, metadata`,
          [
            resolvedNegocioId,
            orderTotal,
            cliente_nombre ? String(cliente_nombre).trim() : "Paciente / Cliente",
            cliente_telefono ? String(cliente_telefono).trim() : null,
            JSON.stringify(metadataCitas),
          ]
        );

        createdOrderId = orderRows[0].id;

        const itemDesc = `Cita: ${servicio_nombre || "Servicio"} (${duracion_min || 30} min) con ${especialista_nombre || "Especialista"}`;
        const { rows: itemRows } = await client.query(
          `INSERT INTO pedido_items (pedido_id, nombre, cantidad, precio, notas)
           VALUES ($1, $2, 1, $3, $4)
           RETURNING id, nombre, cantidad, precio::float, notas`,
          [createdOrderId, itemDesc, orderTotal, `Fecha: ${fecha_cita} Hora: ${hora_cita}`]
        );
        insertedItems.push(itemRows[0]);

        await client.query("COMMIT");

        whatsappMessageText = `*📅 Solicitud de Cita / Turno*\n` +
          `*Establecimiento:* ${businessName}\n` +
          `*Paciente / Cliente:* ${cliente_nombre || "Cliente"}\n` +
          `*Teléfono:* ${cliente_telefono || "No indicado"}\n` +
          `*Tratamiento / Servicio:* ${servicio_nombre || "Consulta"}\n` +
          `*Especialista:* ${especialista_nombre || "Cualquier profesional disponible"}\n` +
          `*Fecha solicitada:* ${fecha_cita}\n` +
          `*Hora solicitada:* ${hora_cita}\n` +
          (duracion_min ? `*Duración estimada:* ${duracion_min} minutos\n` : "") +
          (orderTotal > 0 ? `*Valor referencial:* $${orderTotal.toFixed(2)}\n` : "") +
          (modalidad_pago === "ABONO_PREVIO" && abonoNum > 0
            ? `*Modalidad:* Anticipo de $${abonoNum.toFixed(2)} (Saldo en recepción: $${Math.max(0, orderTotal - abonoNum).toFixed(2)})\n` +
              (comprobante_ref ? `*Ref. Transferencia:* ${comprobante_ref}\n` : `_Adjunto foto del comprobante de transferencia_\n`)
            : `*Modalidad:* Pago en recepción al llegar ($${orderTotal.toFixed(2)})\n`) +
          (notas_cita ? `*Notas adicionales:* ${notas_cita}\n` : "") +
          `\n_Por favor confirma la reserva de este turno._`;

        const targetPhone = formatWhatsAppNumber(businessPhone || cliente_telefono || "");
        const waUrl = targetPhone ? `https://wa.me/${targetPhone}?text=${encodeURIComponent(whatsappMessageText)}` : "";

        // Sincronización automática de Cita hacia Customer en Prisma (CRM sin trabajo manual)
        if (cliente_telefono) {
          try {
            const rawPhone = String(cliente_telefono).trim();
            const cleanPhone = rawPhone.replace(/\D/g, "");
            const searchPhone = cleanPhone || rawPhone;

            const existingCustomer = await prisma.customer.findFirst({
              where: {
                restaurantId: resolvedNegocioId,
                phone: searchPhone,
              },
            });

            if (!existingCustomer) {
              await prisma.customer.create({
                data: {
                  restaurantId: resolvedNegocioId,
                  name: cliente_nombre ? String(cliente_nombre).trim() : "Paciente / Cliente",
                  phone: searchPhone,
                  category: "NUEVO",
                  totalOrders: 1,
                  totalSpent: orderTotal,
                  lastOrderAt: new Date(),
                },
              });
            } else {
              const newTotalOrders = (existingCustomer.totalOrders || 0) + 1;
              const newTotalSpent = Number(existingCustomer.totalSpent || 0) + orderTotal;
              const shouldPromote = newTotalOrders >= 3 && existingCustomer.category === "NUEVO";

              await prisma.customer.update({
                where: { id: existingCustomer.id },
                data: {
                  name: (!existingCustomer.name || existingCustomer.name === "Cliente") && cliente_nombre ? String(cliente_nombre).trim() : existingCustomer.name,
                  totalOrders: newTotalOrders,
                  totalSpent: newTotalSpent,
                  lastOrderAt: new Date(),
                  category: shouldPromote ? "FRECUENTE" : existingCustomer.category,
                },
              });
            }
          } catch (crmErr) {
            console.error("[POST /api/pedidos citas] Error no bloqueante al sincronizar cliente en CRM:", crmErr);
          }
        }

        // Notificación en tiempo real vía Socket.IO
        try {
          emitNuevaCita(resolvedNegocioId, {
            ...orderRows[0],
            items: insertedItems,
          });
        } catch (sockErr) {
          console.warn("[POST /api/pedidos citas] Error emitiendo nueva_cita por socket:", sockErr);
        }

        // Alerta instantánea a Telegram vía webhook n8n (no bloqueante)
        void sendTelegramAlert({
          mensaje: `🗓️ Nueva cita agendada (${businessName}): ${servicio_nombre || "Cita"} con ${especialista_nombre || "Profesional"} | Fecha: ${fecha_cita || "Por confirmar"} ${hora_cita || ""}`,
          cliente: cliente_nombre ? String(cliente_nombre).trim() : "Paciente / Cliente",
          negocio: businessName,
        });

        return NextResponse.json({
          ok: true,
          id: createdOrderId,
          pedido: { ...orderRows[0], items: insertedItems },
          whatsapp_url: waUrl,
          vertical: "citas",
        });
      }

      // =========================================================================
      // CASO E: VERTICAL RESERVAS (Hostales, Cabañas, Hospedaje, Glamping)
      // =========================================================================
      else if (vertical === "reservas") {
        const targetRoomName = tipo_habitacion ? String(tipo_habitacion).trim() : "";
        const targetCheckIn = check_in ? String(check_in).trim() : "";
        const targetCheckOut = check_out ? String(check_out).trim() : "";

        // Verificación de disponibilidad atómica para evitar overbooking
        if (targetRoomName && targetCheckIn && targetCheckOut) {
          const { rows: conflictRows } = await client.query(
            `SELECT id, cliente_nombre, metadata
             FROM pedidos
             WHERE negocio_id::text = $1::text
               AND (vertical = 'reservas' OR mesa = 'RESERVA')
               AND estado NOT IN ('cancelada', 'cancelado')
               AND TRIM(LOWER(metadata->>'tipo_habitacion')) = TRIM(LOWER($2))
               AND (metadata->>'check_in') < $3
               AND (metadata->>'check_out') > $4
             LIMIT 1`,
            [resolvedNegocioId, targetRoomName, targetCheckOut, targetCheckIn]
          );

          if (conflictRows.length > 0) {
            await client.query("ROLLBACK");
            return NextResponse.json(
              {
                ok: false,
                error: `La habitación "${targetRoomName}" ya se encuentra reservada para las fechas seleccionadas (${targetCheckIn} al ${targetCheckOut}). Por favor elige otra habitación o cambia las fechas de estadía.`,
              },
              { status: 409 }
            );
          }
        }

        const metadataReservas = {
          check_in: check_in || new Date().toISOString().split("T")[0],
          check_out: check_out || "",
          noches: parseInt(noches) || 1,
          huespedes_adultos: parseInt(huespedes_adultos) || 1,
          huespedes_ninos: parseInt(huespedes_ninos) || 0,
          tipo_habitacion: tipo_habitacion || "Hospedaje Estándar",
          hora_llegada_estimada: hora_llegada_estimada || "14:00",
          extras: Array.isArray(extras) ? extras : [],
        };

        orderTotal = parseFloat(total_reserva) || 0;

        const { rows: orderRows } = await client.query(
          `INSERT INTO pedidos (negocio_id, mesa, estado, total, cliente_nombre, cliente_telefono, vertical, metadata)
           VALUES ($1, 'RESERVA', 'nuevo', $2, $3, $4, 'reservas', $5)
           RETURNING id, negocio_id, mesa, estado, total::float, created_at, cliente_nombre, cliente_telefono, vertical, metadata`,
          [
            resolvedNegocioId,
            orderTotal,
            cliente_nombre ? String(cliente_nombre).trim() : "Huésped Titular",
            cliente_telefono ? String(cliente_telefono).trim() : null,
            JSON.stringify(metadataReservas),
          ]
        );

        createdOrderId = orderRows[0].id;

        // Registrar item principal de la habitación
        const { rows: itemRows } = await client.query(
          `INSERT INTO pedido_items (pedido_id, nombre, cantidad, precio, notas)
           VALUES ($1, $2, $3, $4, $5)
           RETURNING id, nombre, cantidad, precio::float, notas`,
          [
            createdOrderId,
            `Estadía: ${tipo_habitacion || "Cabaña/Habitación"}`,
            parseInt(noches) || 1,
            orderTotal,
            `Check-in: ${check_in} | Check-out: ${check_out} | Huéspedes: ${huespedes_adultos} adultos, ${huespedes_ninos} niños`,
          ]
        );
        insertedItems.push(itemRows[0]);

        await client.query("COMMIT");

        whatsappMessageText = `*🏡 Nueva Solicitud de Reserva de Hospedaje*\n` +
          `*Lugar:* ${businessName}\n` +
          `*Titular de la reserva:* ${cliente_nombre || "Huésped"}\n` +
          `*Teléfono:* ${cliente_telefono || "No indicado"}\n` +
          `*Alojamiento:* ${tipo_habitacion || "Habitación Seleccionada"}\n` +
          `*Check-in:* ${check_in}\n` +
          `*Check-out:* ${check_out}\n` +
          `*Noches:* ${noches}\n` +
          `*Huéspedes:* ${huespedes_adultos} Adulto(s)` + (huespedes_ninos > 0 ? `, ${huespedes_ninos} Niño(s)` : "") + `\n` +
          (hora_llegada_estimada ? `*Hora estimada de llegada:* ${hora_llegada_estimada}\n` : "") +
          (extras.length > 0 ? `*Servicios adicionales:* ${extras.map((e: { nombre?: string } | string) => (typeof e === "object" ? e.nombre : e) || e).join(", ")}\n` : "") +
          `\n*VALOR TOTAL ESTIMADO:* $${orderTotal.toFixed(2)}\n\n` +
          `_Por favor confirmar disponibilidad y detalles para el abono o garantía de reserva._`;

        const targetPhone = formatWhatsAppNumber(businessPhone || cliente_telefono || "");
        const waUrl = targetPhone ? `https://wa.me/${targetPhone}?text=${encodeURIComponent(whatsappMessageText)}` : "";

        // Sincronización automática de Huésped hacia Customer en Prisma (CRM Hospedaje)
        if (cliente_telefono) {
          try {
            const rawPhone = String(cliente_telefono).trim();
            const cleanPhone = rawPhone.replace(/\D/g, "");
            const searchPhone = cleanPhone || rawPhone;

            const existingCustomer = await prisma.customer.findFirst({
              where: {
                restaurantId: resolvedNegocioId,
                phone: searchPhone,
              },
            });

            if (!existingCustomer) {
              await prisma.customer.create({
                data: {
                  restaurantId: resolvedNegocioId,
                  name: cliente_nombre ? String(cliente_nombre).trim() : "Huésped Titular",
                  phone: searchPhone,
                  category: "NUEVO",
                  totalOrders: 1,
                  totalSpent: orderTotal,
                  lastOrderAt: new Date(),
                },
              });
            } else {
              const newTotalOrders = (existingCustomer.totalOrders || 0) + 1;
              const newTotalSpent = Number(existingCustomer.totalSpent || 0) + orderTotal;
              const shouldPromote = newTotalOrders >= 2 && existingCustomer.category === "NUEVO";

              await prisma.customer.update({
                where: { id: existingCustomer.id },
                data: {
                  name: (!existingCustomer.name || existingCustomer.name === "Huésped Titular") && cliente_nombre ? String(cliente_nombre).trim() : existingCustomer.name,
                  totalOrders: newTotalOrders,
                  totalSpent: newTotalSpent,
                  lastOrderAt: new Date(),
                  category: shouldPromote ? "FRECUENTE" : existingCustomer.category,
                },
              });
            }
          } catch (crmErr) {
            console.error("[POST /api/pedidos reservas] Error no bloqueante al sincronizar huésped en CRM:", crmErr);
          }
        }

        // Notificación en tiempo real vía Socket.IO
        try {
          emitNuevaReserva(resolvedNegocioId, {
            ...orderRows[0],
            items: insertedItems,
          });
        } catch (sockErr) {
          console.warn("[POST /api/pedidos reservas] Error emitiendo nueva_reserva por socket:", sockErr);
        }

        // Alerta instantánea a Telegram vía webhook n8n (no bloqueante)
        void sendTelegramAlert({
          mensaje: `🏡 Nueva reserva de hospedaje (${businessName}): ${tipo_habitacion || "Alojamiento"} por $${orderTotal.toFixed(2)} | Check-in: ${check_in} -> Check-out: ${check_out} (${noches} noche/s)`,
          cliente: cliente_nombre ? String(cliente_nombre).trim() : "Huésped Titular",
          negocio: businessName,
        });

        return NextResponse.json({
          ok: true,
          id: createdOrderId,
          pedido: { ...orderRows[0], items: insertedItems },
          whatsapp_url: waUrl,
          vertical: "reservas",
        });
      }

      // Si se envía una vertical no reconocida
      await client.query("ROLLBACK");
      return NextResponse.json(
        { ok: false, error: `Vertical '${vertical}' no reconocida` },
        { status: 400 }
      );
    } catch (txErr) {
      await client.query("ROLLBACK");
      throw txErr;
    } finally {
      client.release();
    }
    });
  } catch (err: unknown) {
    console.error("[POST /api/pedidos] Error:", err);
    const msg = err instanceof Error ? err.message : "Error al procesar pedido";
    const status = (
      msg.includes("Stock insuficiente") ||
      msg.includes("no pertenece") ||
      msg.includes("no reconocida") ||
      msg.includes("Cantidad inválida") ||
      msg.includes("no está disponible") ||
      msg.includes("no están configuradas")
    ) ? 400 : 500;
    notificarSuperAdmin({
      mensaje: `⚠️ Error Crítico en POST /api/pedidos: ${msg}`,
      cliente: "Alerta Servidor",
    });
    return NextResponse.json(
      { ok: false, error: msg },
      { status }
    );
  }
}
