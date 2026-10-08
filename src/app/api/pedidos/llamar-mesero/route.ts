import { NextRequest, NextResponse } from "next/server";
import { pool, ensureDbTables } from "@/lib/db-pool";
import { emitPedidoActualizado } from "@/lib/socket-server";

export const dynamic = "force-dynamic";

// POST /api/pedidos/llamar-mesero
// El comensal pulsa "Llamar al Mesero" desde su teléfono
// O el camarero marca la llamada como "atendida" (atendido: true)
export async function POST(req: NextRequest) {
  try {
    await ensureDbTables();

    const body = await req.json();
    const { negocio_id, mesa, comensal, atendido } = body;

    if (!negocio_id || !mesa) {
      return NextResponse.json(
        { ok: false, error: "negocio_id y mesa son obligatorios" },
        { status: 400 }
      );
    }

    const isAtender = Boolean(atendido);

    // Buscar si existe un pedido activo para esta mesa
    const { rows: existing } = await pool.query(
      `SELECT id, negocio_id, mesa, estado, camarero_id, total::float, cliente_nombre 
       FROM pedidos 
       WHERE negocio_id = $1 AND mesa = $2 AND estado != 'pagado'
       ORDER BY created_at DESC LIMIT 1`,
      [negocio_id, String(mesa)]
    );

    let pedidoId: string;
    let finalNombre = comensal ? String(comensal).trim() : "Comensal";

    if (existing.length > 0) {
      pedidoId = existing[0].id;
      finalNombre = existing[0].cliente_nombre || finalNombre;
      await pool.query(
        `UPDATE pedidos 
         SET solicita_mesero = $1,
             cliente_nombre = COALESCE($2, cliente_nombre)
         WHERE id = $3`,
        [!isAtender, comensal ? String(comensal).trim() : null, pedidoId]
      );
    } else {
      if (isAtender) {
        return NextResponse.json({ ok: true, message: "Mesa no tiene pedidos activos" });
      }
      // Si la mesa aún no tiene comanda pero el cliente ya llama al mesero para ordenar
      const { rows: newPedido } = await pool.query(
        `INSERT INTO pedidos (negocio_id, mesa, cliente_nombre, solicita_mesero, estado, total)
         VALUES ($1, $2, $3, true, 'nuevo', 0)
         RETURNING id`,
        [negocio_id, String(mesa), finalNombre]
      );
      pedidoId = newPedido[0].id;
    }

    // Notificar en tiempo real por socket a la sala del negocio
    emitPedidoActualizado(negocio_id, {
      id: pedidoId,
      negocio_id,
      mesa: String(mesa),
      cliente_nombre: finalNombre,
      solicita_mesero: !isAtender,
      tipo_alerta: isAtender ? "mesero_atendido" : "llamar_mesero",
    });

    return NextResponse.json({
      ok: true,
      solicita_mesero: !isAtender,
      message: isAtender
        ? `Llamada atendida para la Mesa #${mesa}.`
        : `El mesero ha sido notificado para la Mesa #${mesa}. Enseguida se acercará.`,
    });
  } catch (err: any) {
    console.error("[POST /api/pedidos/llamar-mesero] Error:", err);
    return NextResponse.json(
      { ok: false, error: err.message || "Error al solicitar mesero" },
      { status: 500 }
    );
  }
}
