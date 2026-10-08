import { NextRequest, NextResponse } from "next/server";
import { pool, ensureDbTables } from "@/lib/db-pool";
import { emitNuevoPedido, emitItemsAñadidos, emitPedidoActualizado } from "@/lib/socket-server";

export const dynamic = "force-dynamic";

// GET /api/pedidos?negocio_id=...&activos=true
export async function GET(req: NextRequest) {
  try {
    await ensureDbTables();

    const { searchParams } = new URL(req.url);
    const negocioId = searchParams.get("negocio_id");
    const soloActivos = searchParams.get("activos") !== "false";
    const mesa = searchParams.get("mesa");

    if (!negocioId) {
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
          ) FILTER (WHERE pi.id IS NOT NULL),
          '[]'
        ) as items
      FROM pedidos p
      LEFT JOIN camareros c ON p.camarero_id = c.id
      LEFT JOIN pedido_items pi ON pi.pedido_id = p.id
      WHERE p.negocio_id = $1
    `;

    const params: any[] = [negocioId];

    if (soloActivos) {
      params.push("pagado");
      query += ` AND p.estado != $${params.length}`;
    }

    if (mesa) {
      params.push(mesa);
      query += ` AND p.mesa = $${params.length}`;
    }

    query += `
      GROUP BY p.id, c.nombre, p.cliente_nombre, p.cliente_telefono, p.solicita_mesero
      ORDER BY p.created_at ASC
    `;

    const { rows: pedidos } = await pool.query(query, params);

    return NextResponse.json({ ok: true, pedidos });
  } catch (err: any) {
    console.error("[GET /api/pedidos] Error:", err);
    return NextResponse.json(
      { ok: false, error: err.message || "Error al obtener pedidos" },
      { status: 500 }
    );
  }
}

// POST /api/pedidos - Lógica de MESA ABIERTA
export async function POST(req: NextRequest) {
  try {
    await ensureDbTables();

    const body = await req.json();
    const { negocio_id, mesa, camarero_id, items, cliente_nombre, cliente_telefono } = body;

    if (!negocio_id || !mesa) {
      return NextResponse.json(
        { ok: false, error: "negocio_id y mesa son obligatorios" },
        { status: 400 }
      );
    }

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { ok: false, error: "El pedido debe contener al menos un item" },
        { status: 400 }
      );
    }

    // 1. Verificar si la mesa ya tiene un pedido activo (!= 'pagado')
    const { rows: existingOrders } = await pool.query(
      `SELECT * FROM pedidos 
       WHERE negocio_id = $1 AND mesa = $2 AND estado != 'pagado'
       ORDER BY created_at DESC LIMIT 1`,
      [negocio_id, String(mesa)]
    );

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      let orderId: string;
      let isExisting = false;
      let currentOrder: any = null;

      if (existingOrders.length > 0) {
        // --- CASO MESA ABIERTA: Ya existe pedido activo ---
        isExisting = true;
        currentOrder = existingOrders[0];
        orderId = currentOrder.id;

        // Calcular incremento de total
        let itemsAddTotal = 0;
        const insertedItems: any[] = [];

        for (const item of items) {
          const cantidad = parseInt(item.cantidad) || 1;
          const precio = parseFloat(item.precio) || 0;
          itemsAddTotal += cantidad * precio;

          const { rows: itemRows } = await client.query(
            `INSERT INTO pedido_items (pedido_id, nombre, cantidad, precio, notas, es_añadido, estado_item)
             VALUES ($1, $2, $3, $4, $5, true, 'nuevo')
             RETURNING id, pedido_id, nombre, cantidad, precio::float, notas, es_añadido, estado_item`,
            [orderId, item.nombre, cantidad, precio, item.notas || null]
          );
          insertedItems.push(itemRows[0]);
        }

        // Actualizar total del pedido y vincular nombre si aplica
        const { rows: updatedOrderRows } = await client.query(
          `UPDATE pedidos 
           SET total = total + $1,
               cliente_nombre = COALESCE($2, cliente_nombre),
               cliente_telefono = COALESCE($3, cliente_telefono)
           WHERE id = $4 
           RETURNING id, negocio_id, mesa, estado, camarero_id, total::float, created_at, cliente_nombre, cliente_telefono, solicita_mesero`,
          [
            itemsAddTotal,
            cliente_nombre ? String(cliente_nombre).trim() : null,
            cliente_telefono ? String(cliente_telefono).trim() : null,
            orderId,
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

        // Obtener todos los items actualizados del pedido
        const { rows: allItems } = await pool.query(
          `SELECT id, nombre, cantidad, precio::float, notas, es_añadido, estado_item 
           FROM pedido_items WHERE pedido_id = $1 ORDER BY es_añadido ASC, nombre ASC`,
          [orderId]
        );

        const fullUpdatedOrder = {
          ...updatedOrderRows[0],
          camarero_nombre: camareroNombre,
          items: allItems,
        };

        // Notificar en tiempo real por Socket.IO
        emitItemsAñadidos(negocio_id, String(mesa), insertedItems);
        emitPedidoActualizado(negocio_id, fullUpdatedOrder);

        return NextResponse.json({
          ok: true,
          tipo: "items_añadidos",
          pedido: fullUpdatedOrder,
          nuevos_items: insertedItems,
        });
      } else {
        // --- CASO NUEVO PEDIDO: Crear pedido y asociar items ---
        let initialTotal = 0;
        for (const item of items) {
          const cantidad = parseInt(item.cantidad) || 1;
          const precio = parseFloat(item.precio) || 0;
          initialTotal += cantidad * precio;
        }

        // Obtener camarero predeterminado si no se envió
        let finalCamareroId = camarero_id || null;
        if (!finalCamareroId) {
          const { rows: defaultCam } = await client.query(
            "SELECT id FROM camareros WHERE negocio_id = $1 AND activo = true LIMIT 1",
            [negocio_id]
          );
          if (defaultCam[0]) finalCamareroId = defaultCam[0].id;
        }

        const { rows: newOrderRows } = await client.query(
          `INSERT INTO pedidos (negocio_id, mesa, camarero_id, estado, total, cliente_nombre, cliente_telefono)
           VALUES ($1, $2, $3, 'nuevo', $4, $5, $6)
           RETURNING id, negocio_id, mesa, estado, camarero_id, total::float, created_at, cliente_nombre, cliente_telefono, solicita_mesero`,
          [
            negocio_id,
            String(mesa),
            finalCamareroId,
            initialTotal,
            cliente_nombre ? String(cliente_nombre).trim() : null,
            cliente_telefono ? String(cliente_telefono).trim() : null,
          ]
        );

        orderId = newOrderRows[0].id;
        const insertedItems: any[] = [];

        for (const item of items) {
          const cantidad = parseInt(item.cantidad) || 1;
          const precio = parseFloat(item.precio) || 0;

          const { rows: itemRows } = await client.query(
            `INSERT INTO pedido_items (pedido_id, nombre, cantidad, precio, notas, es_añadido, estado_item)
             VALUES ($1, $2, $3, $4, $5, false, 'nuevo')
             RETURNING id, pedido_id, nombre, cantidad, precio::float, notas, es_añadido, estado_item`,
            [orderId, item.nombre, cantidad, precio, item.notas || null]
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

        const fullNewOrder = {
          ...newOrderRows[0],
          camarero_nombre: camareroNombre,
          items: insertedItems,
        };

        // Notificar en tiempo real por Socket.IO
        emitNuevoPedido(negocio_id, fullNewOrder);

        return NextResponse.json({
          ok: true,
          tipo: "nuevo_pedido",
          pedido: fullNewOrder,
          items: insertedItems,
        });
      }
    } catch (txErr) {
      await client.query("ROLLBACK");
      throw txErr;
    } finally {
      client.release();
    }
  } catch (err: any) {
    console.error("[POST /api/pedidos] Error:", err);
    return NextResponse.json(
      { ok: false, error: err.message || "Error al procesar pedido" },
      { status: 500 }
    );
  }
}
