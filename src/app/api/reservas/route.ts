import { NextRequest, NextResponse } from "next/server";
import { pool, ensureDbTables } from "@/lib/db-pool";

export const dynamic = "force-dynamic";

// GET /api/reservas?negocio_id=...&slug=...&estado=...
export async function GET(req: NextRequest) {
  try {
    await ensureDbTables();

    const { searchParams } = new URL(req.url);
    const negocioId = searchParams.get("negocio_id");
    const slug = searchParams.get("slug");
    const estadoFiltro = searchParams.get("estado");

    let targetNegocioId = negocioId;

    if (!targetNegocioId && slug) {
      const { rows: negRows } = await pool.query(
        `SELECT id FROM "Restaurant" WHERE slug = $1 LIMIT 1`,
        [slug.toLowerCase().trim()]
      );
      if (negRows[0]) {
        targetNegocioId = negRows[0].id;
      }
    }

    if (!targetNegocioId) {
      return NextResponse.json({ ok: false, error: "Falta negocio_id o slug" }, { status: 400 });
    }

    let query = `
      SELECT 
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
        COALESCE(
          json_agg(
            json_build_object(
              'id', pi.id,
              'nombre', pi.nombre,
              'cantidad', pi.cantidad,
              'precio', pi.precio::float,
              'notas', pi.notas
            ) ORDER BY pi.nombre ASC
          ) FILTER (WHERE pi.id IS NOT NULL),
          '[]'
        ) as items
      FROM pedidos p
      LEFT JOIN pedido_items pi ON pi.pedido_id = p.id
      WHERE (p.negocio_id = $1 OR p.negocio_id::text = $1)
        AND (p.vertical = 'reservas' OR p.mesa = 'RESERVA')
    `;

    const params: any[] = [targetNegocioId];

    if (estadoFiltro && estadoFiltro !== "todos") {
      params.push(estadoFiltro);
      query += ` AND p.estado = $${params.length}`;
    }

    query += `
      GROUP BY p.id, p.negocio_id, p.mesa, p.estado, p.total, p.created_at, p.cliente_nombre, p.cliente_telefono, p.vertical, p.metadata
      ORDER BY p.created_at DESC
    `;

    const { rows: reservasRaw } = await pool.query(query, params);

    // Calcular métricas del motor de reservas
    let totalReservas = 0;
    let totalNoches = 0;
    let totalHuespedes = 0;
    let totalIngresos = 0;
    const conteoEstados: Record<string, number> = {
      nuevo: 0,
      confirmado: 0,
      hospedado: 0,
      finalizado: 0,
      cancelado: 0,
    };

    const reservas = reservasRaw.map((r: any) => {
      let meta: any = {};
      if (r.metadata) {
        try {
          meta = typeof r.metadata === "string" ? JSON.parse(r.metadata) : r.metadata;
        } catch {}
      }

      const noches = parseInt(meta.noches) || 1;
      const adultos = parseInt(meta.huespedes_adultos) || 1;
      const ninos = parseInt(meta.huespedes_ninos) || 0;
      const huespedes = adultos + ninos;
      const totalNum = Number(r.total) || 0;

      if (r.estado !== "cancelado") {
        totalReservas++;
        totalNoches += noches;
        totalHuespedes += huespedes;
        totalIngresos += totalNum;
      }

      if (conteoEstados[r.estado] !== undefined) {
        conteoEstados[r.estado]++;
      }

      return {
        id: r.id,
        estado: r.estado,
        cliente_nombre: r.cliente_nombre || "Huésped Titular",
        cliente_telefono: r.cliente_telefono || "",
        total: totalNum,
        created_at: r.created_at,
        check_in: meta.check_in || "",
        check_out: meta.check_out || "",
        noches,
        huespedes_adultos: adultos,
        huespedes_ninos: ninos,
        tipo_habitacion: meta.tipo_habitacion || "Alojamiento",
        hora_llegada_estimada: meta.hora_llegada_estimada || "14:00",
        extras: Array.isArray(meta.extras) ? meta.extras : [],
        notas_hospedaje: meta.notas_entrega || meta.notas_hospedaje || "",
        items: r.items,
      };
    });

    return NextResponse.json({
      ok: true,
      reservas,
      metricas: {
        totalReservas,
        totalNoches,
        totalHuespedes,
        totalIngresos,
        pendientes: conteoEstados.nuevo || 0,
        confirmadas: conteoEstados.confirmado || 0,
        hospedados: conteoEstados.hospedado || 0,
        finalizadas: conteoEstados.finalizado || 0,
        canceladas: conteoEstados.cancelado || 0,
      },
    });
  } catch (err: any) {
    console.error("[GET /api/reservas] Error:", err);
    return NextResponse.json(
      { ok: false, error: err.message || "Error al obtener reservas" },
      { status: 500 }
    );
  }
}

// POST /api/reservas - Creación manual de reserva desde el panel administrativo
export async function POST(req: NextRequest) {
  try {
    await ensureDbTables();

    const body = await req.json();
    const {
      negocio_id,
      cliente_nombre,
      cliente_telefono,
      check_in,
      check_out,
      noches = 1,
      huespedes_adultos = 2,
      huespedes_ninos = 0,
      tipo_habitacion = "Habitación Estándar",
      total = 0,
      hora_llegada_estimada = "15:00",
      notas_hospedaje = "",
      estado = "confirmado",
    } = body;

    if (!negocio_id || !cliente_nombre || !check_in || !check_out) {
      return NextResponse.json(
        { ok: false, error: "Faltan campos obligatorios (negocio_id, cliente_nombre, check_in, check_out)" },
        { status: 400 }
      );
    }

    const metadata = {
      check_in,
      check_out,
      noches: parseInt(noches) || 1,
      huespedes_adultos: parseInt(huespedes_adultos) || 1,
      huespedes_ninos: parseInt(huespedes_ninos) || 0,
      tipo_habitacion,
      hora_llegada_estimada,
      extras: [],
      notas_hospedaje,
      creado_desde: "admin_manual",
    };

    const { rows: orderRows } = await pool.query(
      `INSERT INTO pedidos (negocio_id, mesa, estado, total, cliente_nombre, cliente_telefono, vertical, metadata)
       VALUES ($1, 'RESERVA', $2, $3, $4, $5, 'reservas', $6)
       RETURNING id, negocio_id, mesa, estado, total::float, created_at, cliente_nombre, cliente_telefono, vertical, metadata`,
      [
        negocio_id,
        estado,
        parseFloat(total) || 0,
        String(cliente_nombre).trim(),
        cliente_telefono ? String(cliente_telefono).trim() : null,
        JSON.stringify(metadata),
      ]
    );

    const createdId = orderRows[0].id;

    // Registrar item de alojamiento
    await pool.query(
      `INSERT INTO pedido_items (pedido_id, nombre, cantidad, precio, notas)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        createdId,
        `Estadía: ${tipo_habitacion}`,
        parseInt(noches) || 1,
        parseFloat(total) || 0,
        `Check-in: ${check_in} | Check-out: ${check_out} | Reserva manual admin`,
      ]
    );

    return NextResponse.json({
      ok: true,
      reserva: orderRows[0],
    });
  } catch (err: any) {
    console.error("[POST /api/reservas] Error:", err);
    return NextResponse.json(
      { ok: false, error: err.message || "Error al crear reserva manual" },
      { status: 500 }
    );
  }
}
