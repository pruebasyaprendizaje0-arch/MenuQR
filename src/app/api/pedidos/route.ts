import { NextRequest, NextResponse } from "next/server";
import { pool, ensureDbTables } from "@/lib/db-pool";
import { emitNuevoPedido, emitItemsAñadidos, emitPedidoActualizado } from "@/lib/socket-server";
import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { deductStockUniversal } from "@/lib/stock-service";
import { sendTelegramAlert } from "@/lib/telegram-alert";

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

    let targetNegocioId = negocioId;

    if (!targetNegocioId && slug) {
      const { rows: negRows } = await pool.query(
        "SELECT id FROM negocios WHERE slug = $1 LIMIT 1",
        [slug.toLowerCase().trim()]
      );
      if (negRows[0]) {
        targetNegocioId = negRows[0].id;
      }
    }

    if (!targetNegocioId) {
      // Tomar el primer negocio disponible si no se envía negocio_id
      const { rows: firstNegocio } = await pool.query("SELECT id FROM negocios LIMIT 1");
      if (firstNegocio.length === 0) {
        return NextResponse.json({ ok: true, pedidos: [] });
      }
      return NextResponse.json({
        ok: true,
        pedidos: [],
        sugerencia_negocio_id: firstNegocio[0].id,
      });
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
      WHERE p.negocio_id = $1
    `;

    const params: (string | number | boolean)[] = [targetNegocioId];

    if (soloActivos) {
      params.push("pagado");
      params.push("cancelado");
      query += ` AND p.estado NOT IN ($${params.length - 1}, $${params.length})`;
    }

    if (mesa) {
      params.push(mesa);
      query += ` AND p.mesa = $${params.length}`;
    }

    if (vertical) {
      params.push(vertical);
      query += ` AND p.vertical = $${params.length}`;
    }

    query += `
      GROUP BY p.id, c.nombre, p.cliente_nombre, p.cliente_telefono, p.solicita_mesero, p.vertical, p.metadata
      ORDER BY p.created_at ASC
    `;

    const { rows: pedidos } = await pool.query(query, params);

    return NextResponse.json({ ok: true, pedidos });
  } catch (err: unknown) {
    console.error("[GET /api/pedidos] Error:", err);
    const msg = err instanceof Error ? err.message : "Error al obtener pedidos";
    return NextResponse.json(
      { ok: false, error: msg },
      { status: 500 }
    );
  }
}

// POST /api/pedidos - Endpoint unificado para procesar pedidos/solicitudes de todas las verticales
export async function POST(req: NextRequest) {
  try {
    await ensureDbTables();

    const body = await req.json();
    const {
      vertical = "menuqr", // "menuqr" | "catalogo" | "servicios" | "citas" | "reservas"
      negocio_id,
      slug,
      cliente_nombre,
      cliente_telefono,
      cliente_direccion,
      // Vertical menuqr
      mesa,
      camarero_id,
      items = [],
      // Vertical catalogo
      metodo_entrega = "domicilio",
      costo_envio = 0,
      notas_entrega,
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

    // 1. Resolver ID del negocio y obtener datos de contacto para WhatsApp
    let resolvedNegocioId = negocio_id;
    let businessName = "Comercio";
    let businessPhone = "";

    // Buscar negocio por slug si no se proveyó ID
    if (!resolvedNegocioId && slug) {
      const { rows: negSlugRows } = await pool.query(
        "SELECT id, nombre, slug FROM negocios WHERE slug = $1 LIMIT 1",
        [String(slug).toLowerCase().trim()]
      );
      if (negSlugRows[0]) {
        resolvedNegocioId = negSlugRows[0].id;
        businessName = negSlugRows[0].nombre;
      }
    }

    // Si aún no hay negocio, intentar buscar el primer negocio o crear uno demo
    if (!resolvedNegocioId) {
      const { rows: fallbackNeg } = await pool.query("SELECT id, nombre FROM negocios LIMIT 1");
      if (fallbackNeg[0]) {
        resolvedNegocioId = fallbackNeg[0].id;
        businessName = fallbackNeg[0].nombre;
      }
    }

    // Buscar teléfono de WhatsApp configurado en Restaurant
    try {
      const { rows: restRows } = await pool.query(
        `SELECT id, name, slug, whatsapp FROM "Restaurant" WHERE id::text = $1 OR slug = $2 LIMIT 1`,
        [resolvedNegocioId || "", slug || ""]
      );
      if (restRows[0]) {
        if (restRows[0].name) businessName = restRows[0].name;
        if (restRows[0].whatsapp) businessPhone = restRows[0].whatsapp;
        if (!resolvedNegocioId) resolvedNegocioId = restRows[0].id;
      }
    } catch {}

    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      let createdOrderId: string;
      let responseOrder: Record<string, unknown> | null = null;
      let whatsappMessageText = "";
      let orderTotal = 0;
      const insertedItems: Record<string, unknown>[] = [];

      // =========================================================================
      // CASO A: VERTICAL MENUQR (Restaurantes, Bares, Cafeterías - Mesa Abierta o Delivery)
      // =========================================================================
      if (vertical === "menuqr") {
        const mesaStr = mesa ? String(mesa).trim() : "Delivery";

        if (!Array.isArray(items) || items.length === 0) {
          await client.query("ROLLBACK");
          return NextResponse.json(
            { ok: false, error: "El pedido de restaurante debe contener al menos un item" },
            { status: 400 }
          );
        }

        // Deducción y validación atómica universal de stock en Prisma
        if (resolvedNegocioId) {
          const deductRes = await deductStockUniversal(
            resolvedNegocioId,
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

        // Verificar si la mesa ya tiene un pedido activo (ni 'pagado' ni 'cancelado')
        const { rows: existingOrders } = await pool.query(
          `SELECT * FROM pedidos 
           WHERE negocio_id = $1 AND mesa = $2 AND estado NOT IN ('pagado', 'cancelado')
           ORDER BY created_at DESC LIMIT 1`,
          [resolvedNegocioId, mesaStr]
        );

        if (existingOrders.length > 0 && mesaStr !== "Delivery") {
          // --- MESA ABIERTA: Añadir items al pedido existente ---
          const currentOrder = existingOrders[0];
          createdOrderId = currentOrder.id;

          let itemsAddTotal = 0;
          for (const item of items) {
            const cantidad = parseInt(item.cantidad) || 1;
            const precio = parseFloat(item.precio) || 0;
            itemsAddTotal += cantidad * precio;

            const { rows: itemRows } = await client.query(
              `INSERT INTO pedido_items (pedido_id, nombre, cantidad, precio, notas, es_añadido, estado_item)
               VALUES ($1, $2, $3, $4, $5, true, 'nuevo')
               RETURNING id, pedido_id, nombre, cantidad, precio::float, notas, es_añadido, estado_item`,
              [createdOrderId, item.nombre, cantidad, precio, item.notas || null]
            );
            insertedItems.push(itemRows[0]);
          }

          const { rows: updatedOrderRows } = await client.query(
            `UPDATE pedidos 
             SET total = total + $1,
                 cliente_nombre = COALESCE($2, cliente_nombre),
                 cliente_telefono = COALESCE($3, cliente_telefono)
             WHERE id = $4 
             RETURNING id, negocio_id, mesa, estado, camarero_id, total::float, created_at, cliente_nombre, cliente_telefono, solicita_mesero, vertical, metadata`,
            [
              itemsAddTotal,
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

          // Alerta instantánea a Telegram vía webhook n8n (no bloqueante)
          void sendTelegramAlert({
            mensaje: `🍽️ Platos adicionales en ${mesaStr} (${businessName}): ${insertedItems.map((it) => `${it.cantidad}x ${it.nombre}`).join(", ")} | Total acumulado mesa: $${responseOrder.total.toFixed(2)}`,
            cliente: cliente_nombre ? String(cliente_nombre).trim() : "Comensal",
            negocio: businessName,
          });

          // Generar mensaje WhatsApp para comensal
          whatsappMessageText = `*🍽️ Platos adicionales en Mesa ${mesaStr}*\n` +
            `*Local:* ${businessName}\n` +
            `*Comensal:* ${cliente_nombre || "Cliente"}\n\n` +
            `*Platos añadidos:*\n` +
            insertedItems.map((it) => `• ${it.cantidad}x ${it.nombre} ($${(it.precio * it.cantidad).toFixed(2)})`).join("\n") +
            `\n\n*Total acumulado de la mesa:* $${responseOrder.total.toFixed(2)}`;

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
          for (const item of items) {
            const cantidad = parseInt(item.cantidad) || 1;
            const precio = parseFloat(item.precio) || 0;
            orderTotal += cantidad * precio;
          }

          let finalCamareroId = camarero_id || null;
          if (!finalCamareroId) {
            const { rows: defaultCam } = await client.query(
              "SELECT id FROM camareros WHERE negocio_id = $1 AND activo = true LIMIT 1",
              [resolvedNegocioId]
            );
            if (defaultCam[0]) finalCamareroId = defaultCam[0].id;
          }

          const metaObj = {
            tipo_pedido: mesaStr === "Delivery" ? "delivery" : "mesa",
            cliente_direccion: cliente_direccion || null,
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

          // Alerta instantánea a Telegram vía webhook n8n (no bloqueante)
          void sendTelegramAlert({
            mensaje: `🍽️ Nuevo pedido en ${mesaStr.toLowerCase().includes("mesa") ? mesaStr : "Mesa " + mesaStr} (${businessName}) por $${orderTotal.toFixed(2)} (${insertedItems.length} platos): ${insertedItems.map((it) => `${it.cantidad}x ${it.nombre}`).join(", ")}`,
            cliente: cliente_nombre ? String(cliente_nombre).trim() : "Cliente",
            negocio: businessName,
          });

          whatsappMessageText = `*🍽️ Nuevo Pedido - MenuQR Pro*\n` +
            `*Restaurante:* ${businessName}\n` +
            `*Lugar:* ${mesaStr.toLowerCase().includes("mesa") ? mesaStr : "Mesa " + mesaStr}\n` +
            `*Cliente:* ${cliente_nombre || "Cliente"}\n` +
            (cliente_telefono ? `*Teléfono:* ${cliente_telefono}\n` : "") +
            `\n*Detalle del pedido:*\n` +
            insertedItems.map((it) => `• ${it.cantidad}x ${it.nombre} ($${(it.precio * it.cantidad).toFixed(2)})`).join("\n") +
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
      else if (vertical === "catalogo" || vertical === "ctalo") {
        if (!Array.isArray(items) || items.length === 0) {
          await client.query("ROLLBACK");
          return NextResponse.json(
            { ok: false, error: "El pedido de catálogo debe incluir al menos un producto" },
            { status: 400 }
          );
        }

        // Deducción y validación atómica universal de stock en Prisma
        if (resolvedNegocioId) {
          const deductRes = await deductStockUniversal(
            resolvedNegocioId,
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

        orderTotal = Math.max(0, subtotal - descuento) + envio + propina;

        const metadataCatalogo = {
          metodo_entrega,
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

        // Alerta instantánea a Telegram vía webhook n8n (no bloqueante)
        void sendTelegramAlert({
          mensaje: `🛍️ Nuevo pedido de catálogo (${businessName}) por $${orderTotal.toFixed(2)} [${metodo_entrega === "domicilio" ? "Domicilio 🛵" : "Retiro en Tienda 🏬"}]: ${insertedItems.map((it) => `${it.cantidad}x ${it.nombre}`).join(", ")}`,
          cliente: cliente_nombre ? String(cliente_nombre).trim() : "Cliente Tienda",
          negocio: businessName,
        });

        whatsappMessageText = `*🛍️ Nuevo Pedido de Tienda / Catálogo*\n` +
          `*Tienda:* ${businessName}\n` +
          `*Cliente:* ${cliente_nombre || "Cliente"}\n` +
          `*Teléfono:* ${cliente_telefono || "No especificado"}\n` +
          `*Modalidad:* ${metodo_entrega === "domicilio" ? `Envío a Domicilio 🛵 ${zonaEnvio ? `(${zonaEnvio})` : ""}` : "Retiro en Tienda 🏬"}\n` +
          (cliente_direccion ? `*Dirección:* ${cliente_direccion}\n` : "") +
          `*Método de Pago:* ${metodoPago}\n` +
          (notas_entrega ? `*Notas:* ${notas_entrega}\n` : "") +
          `\n*Artículos seleccionados:*\n` +
          insertedItems.map((it) => `• ${it.cantidad}x ${it.nombre} ${it.notas ? `(${it.notas})` : ""} - $${(it.precio * it.cantidad).toFixed(2)}`).join("\n") +
          `\n\n*Subtotal Base:* $${subtotal.toFixed(2)}\n` +
          (descuento > 0 ? `*Descuento (${codigoCupon || "Cupón"}):* -$${descuento.toFixed(2)}\n` : "") +
          (envio > 0 ? `*Envío ${zonaEnvio ? `(${zonaEnvio})` : ""}:* $${envio.toFixed(2)}\n` : "") +
          (propina > 0 ? `*Propina:* $${propina.toFixed(2)}\n` : "") +
          `*TOTAL A PAGAR: $${orderTotal.toFixed(2)}*` +
          (metodoPago.toLowerCase().includes("transferencia") || metodoPago.toLowerCase().includes("qr") || metodoPago.toLowerCase().includes("deuna") || metodoPago.toLowerCase().includes("payphone") ? `\n\n📸 *Adjunto comprobante de pago.*` : "");

        const targetPhone = formatWhatsAppNumber(businessPhone || cliente_telefono || "");
        const waUrl = targetPhone ? `https://wa.me/${targetPhone}?text=${encodeURIComponent(whatsappMessageText)}` : "";

        return NextResponse.json({
          ok: true,
          id: createdOrderId,
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
        const metadataCitas = {
          servicio_nombre: servicio_nombre || "Cita General",
          especialista_id: especialista_id || null,
          especialista_nombre: especialista_nombre || "Profesional de Turno",
          fecha_cita: fecha_cita || new Date().toISOString().split("T")[0],
          hora_cita: hora_cita || "Por confirmar",
          duracion_min: duracion_min || 30,
          notas_cita: notas_cita || "",
        };

        orderTotal = parseFloat(precio_estimado) || 0;

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
          (notas_cita ? `*Notas adicionales:* ${notas_cita}\n` : "") +
          `\n_Por favor confirma la reserva de este turno._`;

        const targetPhone = formatWhatsAppNumber(businessPhone || cliente_telefono || "");
        const waUrl = targetPhone ? `https://wa.me/${targetPhone}?text=${encodeURIComponent(whatsappMessageText)}` : "";

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
    return NextResponse.json(
      { ok: false, error: msg },
      { status: 500 }
    );
  }
}
