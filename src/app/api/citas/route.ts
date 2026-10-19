import { NextRequest, NextResponse } from "next/server";
import { pool, ensureDbTables } from "@/lib/db-pool";

export const dynamic = "force-dynamic";

// GET /api/citas?negocio_id=...&fecha=...&estado=...&especialista=...&search=...
export async function GET(req: NextRequest) {
  try {
    await ensureDbTables();

    const { searchParams } = new URL(req.url);
    const negocioId = searchParams.get("negocio_id");
    const slug = searchParams.get("slug");
    const fecha = searchParams.get("fecha"); // YYYY-MM-DD o vacío/all
    const estado = searchParams.get("estado"); // nuevo, confirmada, en_atencion, etc.
    const especialista = searchParams.get("especialista");
    const search = searchParams.get("search");

    let resolvedNegocioId = negocioId;

    if (!resolvedNegocioId && slug) {
      const { rows: negRows } = await pool.query(
        "SELECT id FROM negocios WHERE slug = $1 LIMIT 1",
        [slug.toLowerCase().trim()]
      );
      if (negRows[0]) {
        resolvedNegocioId = negRows[0].id;
      } else {
        const { rows: restRows } = await pool.query(
          `SELECT id FROM "Restaurant" WHERE slug = $1 LIMIT 1`,
          [slug.toLowerCase().trim()]
        );
        if (restRows[0]) resolvedNegocioId = restRows[0].id;
      }
    }

    if (!resolvedNegocioId) {
      return NextResponse.json({
        ok: true,
        citas: [],
        metricas: {
          total_hoy: 0,
          pendientes: 0,
          confirmadas: 0,
          en_atencion: 0,
          completadas: 0,
          canceladas: 0,
          ingresos_estimados_hoy: 0,
        },
      });
    }

    // Consulta de citas
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
            ) ORDER BY pi.id ASC
          ) FILTER (WHERE pi.id IS NOT NULL),
          '[]'
        ) as items
      FROM pedidos p
      LEFT JOIN pedido_items pi ON pi.pedido_id = p.id
      WHERE p.negocio_id = $1 
        AND p.vertical = 'citas'
    `;

    const params: any[] = [resolvedNegocioId];

    if (fecha && fecha !== "all") {
      params.push(fecha);
      query += ` AND p.metadata->>'fecha_cita' = $${params.length}`;
    }

    if (estado && estado !== "all") {
      params.push(estado);
      query += ` AND p.estado = $${params.length}`;
    }

    if (especialista && especialista !== "all") {
      params.push(`%${especialista.toLowerCase()}%`);
      query += ` AND LOWER(COALESCE(p.metadata->>'especialista_nombre', '')) LIKE $${params.length}`;
    }

    if (search && search.trim()) {
      params.push(`%${search.trim().toLowerCase()}%`);
      query += ` AND (
        LOWER(COALESCE(p.cliente_nombre, '')) LIKE $${params.length} OR
        LOWER(COALESCE(p.cliente_telefono, '')) LIKE $${params.length} OR
        LOWER(COALESCE(p.metadata->>'servicio_nombre', '')) LIKE $${params.length}
      )`;
    }

    query += `
      GROUP BY p.id, p.negocio_id, p.mesa, p.estado, p.total, p.created_at, p.cliente_nombre, p.cliente_telefono, p.vertical, p.metadata
      ORDER BY 
        COALESCE(p.metadata->>'fecha_cita', '') ASC, 
        COALESCE(p.metadata->>'hora_cita', '') ASC, 
        p.created_at DESC
    `;

    const { rows: citas } = await pool.query(query, params);

    // Métricas del día de hoy
    const hoyStr = new Date().toISOString().split("T")[0];
    const { rows: metricRows } = await pool.query(
      `
      SELECT 
        COUNT(*)::int as total_hoy,
        COUNT(CASE WHEN estado IN ('nuevo', 'pendiente') THEN 1 END)::int as pendientes,
        COUNT(CASE WHEN estado = 'confirmada' THEN 1 END)::int as confirmadas,
        COUNT(CASE WHEN estado = 'en_atencion' THEN 1 END)::int as en_atencion,
        COUNT(CASE WHEN estado IN ('completada', 'pagado') THEN 1 END)::int as completadas,
        COUNT(CASE WHEN estado = 'cancelada' THEN 1 END)::int as canceladas,
        COALESCE(SUM(CASE WHEN estado NOT IN ('cancelada') THEN total::float ELSE 0 END), 0)::float as ingresos_estimados_hoy
      FROM pedidos
      WHERE negocio_id = $1 
        AND vertical = 'citas'
        AND metadata->>'fecha_cita' = $2
      `,
      [resolvedNegocioId, hoyStr]
    );

    const metricas = metricRows[0] || {
      total_hoy: 0,
      pendientes: 0,
      confirmadas: 0,
      en_atencion: 0,
      completadas: 0,
      canceladas: 0,
      ingresos_estimados_hoy: 0,
    };

    return NextResponse.json({
      ok: true,
      citas,
      metricas,
      fecha_consulta: fecha || "all",
    });
  } catch (err: any) {
    console.error("[GET /api/citas] Error:", err);
    return NextResponse.json(
      { ok: false, error: err.message || "Error al obtener citas" },
      { status: 500 }
    );
  }
}

// POST /api/citas - Crear cita manual desde el panel de administración
export async function POST(req: NextRequest) {
  try {
    await ensureDbTables();

    const body = await req.json();
    const {
      negocio_id,
      cliente_nombre,
      cliente_telefono,
      servicio_nombre,
      especialista_id,
      especialista_nombre,
      fecha_cita,
      hora_cita,
      duracion_min = 30,
      precio_estimado = 0,
      notas_cita = "",
      notas_internas = "",
      estado = "confirmada",
    } = body;

    if (!negocio_id || !cliente_nombre || !fecha_cita || !hora_cita) {
      return NextResponse.json(
        { ok: false, error: "Faltan campos obligatorios (negocio, nombre, fecha, hora)" },
        { status: 400 }
      );
    }

    const metadata = {
      servicio_nombre: servicio_nombre || "Cita General",
      especialista_id: especialista_id || null,
      especialista_nombre: especialista_nombre || "Profesional de Turno",
      fecha_cita,
      hora_cita,
      duracion_min: Number(duracion_min) || 30,
      notas_cita,
      notas_internas,
      origen: "admin_manual",
    };

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const total = parseFloat(precio_estimado) || 0;

      const { rows: orderRows } = await client.query(
        `INSERT INTO pedidos (negocio_id, mesa, estado, total, cliente_nombre, cliente_telefono, vertical, metadata)
         VALUES ($1, 'CITA', $2, $3, $4, $5, 'citas', $6)
         RETURNING id, negocio_id, mesa, estado, total::float, created_at, cliente_nombre, cliente_telefono, vertical, metadata`,
        [
          negocio_id,
          estado,
          total,
          String(cliente_nombre).trim(),
          cliente_telefono ? String(cliente_telefono).trim() : null,
          JSON.stringify(metadata),
        ]
      );

      const createdOrder = orderRows[0];

      const itemDesc = `Cita: ${servicio_nombre || "Servicio"} (${duracion_min} min) con ${especialista_nombre || "Especialista"}`;
      await client.query(
        `INSERT INTO pedido_items (pedido_id, nombre, cantidad, precio, notas)
         VALUES ($1, $2, 1, $3, $4)`,
        [createdOrder.id, itemDesc, total, `Fecha: ${fecha_cita} Hora: ${hora_cita}`]
      );

      await client.query("COMMIT");

      return NextResponse.json({
        ok: true,
        cita: createdOrder,
      });
    } catch (dbErr) {
      await client.query("ROLLBACK");
      throw dbErr;
    } finally {
      client.release();
    }
  } catch (err: any) {
    console.error("[POST /api/citas] Error:", err);
    return NextResponse.json(
      { ok: false, error: err.message || "Error al registrar cita manual" },
      { status: 500 }
    );
  }
}
