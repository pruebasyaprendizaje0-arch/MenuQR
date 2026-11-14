import { NextRequest, NextResponse } from "next/server";
import { pool, ensureDbTables } from "@/lib/db-pool";
import { emitNuevoPedido, emitItemsAñadidos, emitPedidoActualizado, emitNuevaCita, emitNuevaReserva } from "@/lib/socket-server";
import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { deductStockUniversal } from "@/lib/stock-service";
import { sendTelegramAlert } from "@/lib/telegram-alert";
import { notificarSuperAdmin } from "@/lib/telegramAdmin";
import { syncSinglePedidoToPrisma } from "@/lib/order-sync";

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

    const targetIdsArray = Array.from(validNegocioIds);

    if (targetIdsArray.length === 0) {
      // Fallback al primer negocio disponible
      const { rows: firstNegocio } = await pool.query("SELECT id FROM negocios LIMIT 1");
      if (firstNegocio.length === 0) {
        return NextResponse.json({ ok: true, pedidos: [] });
      }
      targetIdsArray.push(firstNegocio[0].id);
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
        p.metadata,
        c.nombre as camarero_nombre,
        COALESCE(
          json_agg(
            json_build_object(
              'id', pi.id,
              'nombre', pi.nombre,
              'cantidad', pi.cantidad,
              'precio', pi.precio::float,
              'notas', pi.notas,
              'es_añadido', pi.es_añadido,
              'estado_item', pi.estado_item
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

    query += `
      GROUP BY p.id, c.nombre, p.cliente_nombre, p.cliente_telefono, p.solicita_mesero, p.vertical, p.metadata
      ORDER BY p.created_at DESC
    `;

    const { rows: pedidos } = await pool.query(query, params);

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

// POST /api/pedidos - Endpoint unificado para procesar pedidos/solicitudes de todas las verticales
export async function POST(req: NextRequest) {
  try {
    await ensureDbTables();

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

    // 1. Resolver negocio tanto en "Restaurant" (Prisma) como en "negocios" (PostgreSQL FK)
    const effectiveRestId = restaurantId || negocio_id;
    const isCatalogOrder =
      vertical === "catalogo" ||
      vertical === "ctalo" ||
      String(mesa || "").toUpperCase().trim() === "CATALOGO";

    let businessSlug = slug ? String(slug).toLowerCase().trim() : null;
    let businessName = "Comercio";
    let businessPhone = "";
    let businessAddress = "";
    let restaurantPrismaId = effectiveRestId ? String(effectiveRestId) : null;
    let negocioDbId: string | null = null;

    // Consultar en "Restaurant"
    try {
      const { rows: restRows } = await pool.query(
        `SELECT id, name, slug, whatsapp, address FROM "Restaurant" WHERE id::text = $1 OR slug = $2 LIMIT 1`,
        [effectiveRestId || "", businessSlug || ""]
      );
      if (restRows[0]) {
        restaurantPrismaId = restRows[0].id;
        businessName = restRows[0].name || businessName;
        if (restRows[0].slug) businessSlug = restRows[0].slug;
        if (restRows[0].whatsapp) businessPhone = restRows[0].whatsapp;
        if (restRows[0].address) businessAddress = restRows[0].address;
      }
    } catch {}

    // Fallback con Prisma Client directo si el pool no lo encontró
    if (!restaurantPrismaId && (effectiveRestId || businessSlug)) {
      try {
        const pRest = await prisma.restaurant.findFirst({
          where: {
            OR: [
              ...(effectiveRestId ? [{ id: String(effectiveRestId) }] : []),
              ...(businessSlug ? [{ slug: String(businessSlug) }] : []),
            ],
          },
          select: { id: true, name: true, slug: true, whatsapp: true, address: true },
        });
        if (pRest) {
          restaurantPrismaId = pRest.id;
          businessName = pRest.name || businessName;
          if (pRest.slug) businessSlug = pRest.slug;
          if (pRest.whatsapp) businessPhone = pRest.whatsapp;
          if (pRest.address) businessAddress = pRest.address;
        }
      } catch {}
    }

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

    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      let createdOrderId: string;
      let responseOrder: ResponseOrder | null = null;
      let whatsappMessageText = "";
      let orderTotal = 0;
      const insertedItems: InsertedOrderItem[] = [];

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

        if (!Array.isArray(items) || items.length === 0) {
          await client.query("ROLLBACK");
          return NextResponse.json(
            { ok: false, error: "El pedido de restaurante debe contener al menos un item" },
            { status: 400 }
          );
        }

        // Deducción y validación atómica universal de stock en Prisma (si no fue deducido previamente en createOrderAction)
        if (!skip_stock_deduction && (restaurantPrismaId || businessSlug || resolvedNegocioId)) {
          const deductTarget = restaurantPrismaId || businessSlug || resolvedNegocioId!;
          const deductRes = await deductStockUniversal(
            deductTarget,
            items.map((it: { dishId?: string; productId?: string; id?: string; nombre?: string; cantidad: string | number }) => ({
              dishId: it.dishId || it.productId || it.id,
              name: it.nombre,
              quantity: parseInt(String(it.cantidad)) || 1,
            }))
          );
          if (!deductRes.success) {
            await client.query("ROLLBACK");
            return NextResponse.json(
              { ok: false, error: deductRes.error || "Existencias insuficientes en bodega." },
              { status: 400 }
            );
          }
        }

        // Consultar configuración fiscal y de servicio del restaurante (IVA, Servicio, reglas de inclusión)
        let restConfig = {
          ivaPercent: 15.0,
          servicePercent: 10.0,
          ivaOnTable: true,
          serviceOnTable: true,
          ivaOnTakeout: true,
          serviceOnTakeout: false,
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
              ivaPercent: true,
              servicePercent: true,
              ivaOnTable: true,
              serviceOnTable: true,
              ivaOnTakeout: true,
              serviceOnTakeout: true,
            },
          });
          if (restDb) {
            restConfig = {
              ivaPercent: typeof restDb.ivaPercent === "number" ? restDb.ivaPercent : 15.0,
              servicePercent: typeof restDb.servicePercent === "number" ? restDb.servicePercent : 10.0,
              ivaOnTable: restDb.ivaOnTable ?? true,
              serviceOnTable: restDb.serviceOnTable ?? true,
              ivaOnTakeout: restDb.ivaOnTakeout ?? restDb.ivaOnTable ?? true,
              serviceOnTakeout: restDb.serviceOnTakeout ?? restDb.serviceOnTable ?? true,
            };
          }
        } catch (confErr) {
          console.warn("[POST /api/pedidos] Advertencia obteniendo restConfig:", confErr);
        }

        const isTable = !isDeliveryReq && !isLlevarReq;
        const calcChargesForSubtotal = (subtotal: number, deliveryFee = 0) => {
          // Si el negocio tiene ivaOnTable === true ("IVA Incluido"), rige en todos los canales (Mesa, Llevar, Delivery).
          // Si el negocio tiene ivaOnTable === false ("IVA Adicional"), aplica como adicional en todos los canales.
          const ivaIncluded = restConfig.ivaOnTable === true
            ? true
            : (restConfig.ivaOnTable === false
                ? false
                : (isTable ? restConfig.ivaOnTable : restConfig.ivaOnTakeout));
          // Si el negocio tiene serviceOnTable === true ("Servicio Incluido"), rige como incluido en todos los canales.
          // Si tiene serviceOnTable === false ("Servicio Adicional"), aplica como adicional.
          const serviceIncluded = restConfig.serviceOnTable === true
            ? true
            : (restConfig.serviceOnTable === false
                ? false
                : (isTable ? restConfig.serviceOnTable : restConfig.serviceOnTakeout));

          const ivaAmount = (restConfig.ivaPercent > 0 && !ivaIncluded)
            ? Math.round(subtotal * (restConfig.ivaPercent / 100) * 100) / 100
            : 0;
          const serviceAmount = (restConfig.servicePercent > 0 && !serviceIncluded)
            ? Math.round(subtotal * (restConfig.servicePercent / 100) * 100) / 100
            : 0;
          const totalAmount = Math.round((subtotal + ivaAmount + serviceAmount + deliveryFee) * 100) / 100;
          return {
            subtotal: Math.round(subtotal * 100) / 100,
            iva: ivaAmount,
            service_charge: serviceAmount,
            costo_envio: Math.round(deliveryFee * 100) / 100,
            total: totalAmount,
          };
        };

        // Verificar si la mesa ya tiene un pedido activo (ni 'pagado' ni 'cancelado')
        // Canales como Domicilio y Para Llevar SIEMPRE generan comandas independientes
        const isNonTableChannel = isDeliveryReq || isLlevarReq;
        const mesaVariants = getMesaVariants(rawMesa);
        const searchIds = Array.from(new Set([resolvedNegocioId, restaurantPrismaId].filter(Boolean)));
        const { rows: existingOrders } = isNonTableChannel
          ? { rows: [] }
          : await pool.query(
              `SELECT * FROM pedidos 
           WHERE (negocio_id = ANY($1::uuid[])${businessSlug ? " OR negocio_id IN (SELECT id FROM negocios WHERE slug = $3)" : ""})
             AND LOWER(TRIM(mesa)) = ANY($2::text[])
             AND estado NOT IN ('pagado', 'cancelado')
           ORDER BY created_at DESC LIMIT 1`,
              businessSlug ? [searchIds, mesaVariants, businessSlug] : [searchIds, mesaVariants]
            );

        if (existingOrders.length > 0 && !isNonTableChannel) {
          // --- MESA ABIERTA: Añadir items al pedido existente ---
          const currentOrder = existingOrders[0];
          createdOrderId = currentOrder.id;

          for (const item of items) {
            const cantidad = parseInt(item.cantidad) || 1;
            const precio = parseFloat(item.precio) || 0;

            const { rows: itemRows } = await client.query(
              `INSERT INTO pedido_items (pedido_id, nombre, cantidad, precio, notas, es_añadido, estado_item)
               VALUES ($1, $2, $3, $4, $5, true, 'nuevo')
               RETURNING id, pedido_id, nombre, cantidad, precio::float, notas, es_añadido, estado_item`,
              [createdOrderId, item.nombre, cantidad, precio, item.notas || null]
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
          const updatedCharges = calcChargesForSubtotal(accumulatedItemsSubtotal, 0);

          let existingMeta: any = {};
          try {
            existingMeta = typeof currentOrder.metadata === "string" ? JSON.parse(currentOrder.metadata) : (currentOrder.metadata || {});
          } catch {}

          const updatedMeta = {
            ...existingMeta,
            subtotal: updatedCharges.subtotal,
            iva: updatedCharges.iva,
            service_charge: updatedCharges.service_charge,
            costo_envio: 0,
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
              updatedCharges.total,
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
          emitItemsAñadidos(resolvedNegocioId, mesaStr, insertedItems);
          emitPedidoActualizado(resolvedNegocioId, responseOrder);
          void syncSinglePedidoToPrisma(createdOrderId, resolvedNegocioId);

          // Alerta instantánea a Telegram vía webhook n8n (no bloqueante)
          void sendTelegramAlert({
            mensaje: `🍽️ Platos adicionales en ${mesaStr} (${businessName}): ${insertedItems.map((it) => `${it.cantidad}x ${it.nombre}`).join(", ")} | Total acumulado mesa: $${Number(responseOrder?.total ?? orderTotal ?? 0).toFixed(2)}`,
            cliente: cliente_nombre ? String(cliente_nombre).trim() : "Comensal",
            negocio: businessName,
          });

          // Generar mensaje WhatsApp para comensal
          whatsappMessageText = `*🍽️ Platos adicionales en Mesa ${mesaStr}*\n` +
            `*Local:* ${businessName}\n` +
            `*Comensal:* ${cliente_nombre || "Cliente"}\n\n` +
            `*Platos añadidos:*\n` +
            insertedItems.map((it) => `• ${it.cantidad}x ${it.nombre} ($${(Number(it.precio || 0) * Number(it.cantidad || 1)).toFixed(2)})`).join("\n") +
            `\n\n*Total acumulado de la mesa:* $${Number(responseOrder?.total ?? orderTotal ?? 0).toFixed(2)}`;

          const targetPhone = formatWhatsAppNumber(businessPhone || cliente_telefono || "");
          const waUrl = targetPhone ? `https://wa.me/${targetPhone}?text=${encodeURIComponent(whatsappMessageText)}` : "";

          return NextResponse.json({
            ok: true,
            tipo: "items_añadidos",
            pedido: responseOrder,
            nuevos_items: insertedItems,
            whatsapp_url: waUrl,
            vertical: "menuqr",
          });
        } else {
          // --- NUEVO PEDIDO RESTAURANTE ---
          let itemsTotal = 0;
          for (const item of items) {
            const cantidad = parseInt(item.cantidad) || 1;
            const precio = parseFloat(item.precio) || 0;
            itemsTotal += cantidad * precio;
          }

          const parsedDeliveryCost = parseFloat(String(costo_envio)) || 0;
          const charges = calcChargesForSubtotal(itemsTotal, parsedDeliveryCost);

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

          const metaObj = {
            tipo_pedido: isDeliveryReq ? "delivery" : isLlevarReq ? "llevar" : "mesa",
            tipo_entrega: isDeliveryReq ? "DOMICILIO" : isLlevarReq ? "RETIRO" : "SALON",
            cliente_direccion: cliente_direccion || null,
            costo_envio: parsedDeliveryCost,
            subtotal: charges.subtotal,
            iva: charges.iva,
            service_charge: charges.service_charge,
            notas_entrega: notas_entrega || null,
          };

          const { rows: newOrderRows } = await client.query(
            `INSERT INTO pedidos (negocio_id, mesa, camarero_id, estado, total, cliente_nombre, cliente_telefono, vertical, metadata)
             VALUES ($1, $2, $3, 'nuevo', $4, $5, $6, 'menuqr', $7)
             RETURNING id, negocio_id, mesa, estado, camarero_id, total::float, created_at, cliente_nombre, cliente_telefono, solicita_mesero, vertical, metadata`,
            [
              resolvedNegocioId,
              mesaStr,
              finalCamareroId,
              orderTotal,
              cliente_nombre ? String(cliente_nombre).trim() : null,
              cliente_telefono ? String(cliente_telefono).trim() : null,
              JSON.stringify(metaObj),
            ]
          );

          createdOrderId = newOrderRows[0].id;

          for (const item of items) {
            const cantidad = parseInt(item.cantidad) || 1;
            const precio = parseFloat(item.precio) || 0;

            const { rows: itemRows } = await client.query(
              `INSERT INTO pedido_items (pedido_id, nombre, cantidad, precio, notas, es_añadido, estado_item)
               VALUES ($1, $2, $3, $4, $5, false, 'nuevo')
               RETURNING id, pedido_id, nombre, cantidad, precio::float, notas, es_añadido, estado_item`,
              [createdOrderId, item.nombre, cantidad, precio, item.notas || null]
            );
            insertedItems.push(itemRows[0]);
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

          responseOrder = {
            ...newOrderRows[0],
            camarero_nombre: camareroNombre,
            items: insertedItems,
          };

          // Notificar vía Socket.IO en tiempo real
          emitNuevoPedido(resolvedNegocioId, responseOrder);
          void syncSinglePedidoToPrisma(createdOrderId, resolvedNegocioId);

          const channelLabel = isDeliveryReq 
            ? "🛵 Domicilio" 
            : isLlevarReq 
            ? "🛍️ Para Llevar" 
            : (mesaStr.toLowerCase().includes("mesa") ? mesaStr : "Mesa " + mesaStr);

          // Alerta instantánea a Telegram vía webhook n8n (no bloqueante)
          void sendTelegramAlert({
            mensaje: `🍽️ Nuevo pedido [${channelLabel}] (${businessName}) por $${orderTotal.toFixed(2)} (${insertedItems.length} platos): ${insertedItems.map((it) => `${it.cantidad}x ${it.nombre}`).join(", ")}`,
            cliente: cliente_nombre ? String(cliente_nombre).trim() : "Cliente",
            negocio: businessName,
          });

          whatsappMessageText = `*🍽️ Nuevo Pedido - MenuQR Pro*\n` +
            `*Restaurante:* ${businessName}\n` +
            `*Destino:* ${channelLabel}\n` +
            `*Cliente:* ${cliente_nombre || "Cliente"}\n` +
            (cliente_telefono ? `*Teléfono:* ${cliente_telefono}\n` : "") +
            (cliente_direccion ? `*Dirección:* ${cliente_direccion}\n` : "") +
            `\n*Detalle del pedido:*\n` +
            insertedItems.map((it) => `• ${it.cantidad}x ${it.nombre} ($${(Number(it.precio || 0) * Number(it.cantidad || 1)).toFixed(2)})`).join("\n") +
            (parsedDeliveryCost > 0 ? `\n*Costo de Envío:* $${parsedDeliveryCost.toFixed(2)}` : "") +
            `\n\n*Total a pagar:* $${orderTotal.toFixed(2)}`;

          const targetPhone = formatWhatsAppNumber(businessPhone || cliente_telefono || "");
          const waUrl = targetPhone ? `https://wa.me/${targetPhone}?text=${encodeURIComponent(whatsappMessageText)}` : "";

          return NextResponse.json({
            ok: true,
            tipo: "nuevo_pedido",
            pedido: responseOrder,
            items: insertedItems,
            whatsapp_url: waUrl,
            vertical: "menuqr",
          });
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

        // Deducción y validación atómica universal de stock en Prisma
        const deductTarget = restaurantPrismaId || resolvedNegocioId;
        if (deductTarget) {
          const deductRes = await deductStockUniversal(
            deductTarget,
            items.map((it: { dishId?: string; productId?: string; id?: string; nombre?: string; cantidad: string | number }) => ({
              dishId: it.dishId || it.productId || it.id,
              name: it.nombre,
              quantity: parseInt(String(it.cantidad)) || 1,
            }))
          );
          if (!deductRes.success) {
            await client.query("ROLLBACK");
            return NextResponse.json(
              { ok: false, error: deductRes.error || "Existencias insuficientes en bodega." },
              { status: 400 }
            );
          }
        }

        let subtotal = 0;
        for (const it of items) {
          const qty = parseInt(it.cantidad) || 1;
          const pr = parseFloat(it.precio) || 0;
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
          const qty = parseInt(item.cantidad) || 1;
          const pr = parseFloat(item.precio) || 0;
          const variantDesc = [
            item.talla ? `Talla: ${item.talla}` : null,
            item.color ? `Color: ${item.color}` : null,
            item.notas ? item.notas : null,
          ].filter(Boolean).join(" | ");

          const { rows: itemRows } = await client.query(
            `INSERT INTO pedido_items (pedido_id, nombre, cantidad, precio, notas, es_añadido, estado_item)
             VALUES ($1, $2, $3, $4, $5, false, 'nuevo')
             RETURNING id, pedido_id, nombre, cantidad, precio::float, notas`,
            [createdOrderId, item.nombre, qty, pr, variantDesc || null]
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
                    const variantDesc = [
                      it.talla ? `Talla: ${it.talla}` : null,
                      it.color ? `Color: ${it.color}` : null,
                      it.notas ? it.notas : null,
                    ].filter(Boolean).join(" | ");
                    return {
                      dishName: it.nombre + (variantDesc ? ` (${variantDesc})` : ""),
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
             WHERE (negocio_id = $1 OR negocio_id::text = $1)
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
  } catch (err: unknown) {
    console.error("[POST /api/pedidos] Error:", err);
    const msg = err instanceof Error ? err.message : "Error al procesar pedido";
    notificarSuperAdmin({
      mensaje: `⚠️ Error Crítico en POST /api/pedidos: ${msg}`,
      cliente: "Alerta Servidor",
    });
    return NextResponse.json(
      { ok: false, error: msg },
      { status: 500 }
    );
  }
}
