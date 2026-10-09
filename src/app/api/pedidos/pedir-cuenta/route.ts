import { NextRequest, NextResponse } from "next/server";
import { pool, ensureDbTables } from "@/lib/db-pool";
import { emitPedidoActualizado } from "@/lib/socket-server";

export const dynamic = "force-dynamic";

// POST /api/pedidos/pedir-cuenta
// El comensal pulsa "Pedir la Cuenta" desde su teléfono
export async function POST(req: NextRequest) {
  try {
    await ensureDbTables();

    const body = await req.json();
    const { negocio_id, mesa, comensal, metodo_pago, propina, total } = body;

    if (!negocio_id || !mesa) {
      return NextResponse.json(
        { ok: false, error: "negocio_id y mesa son obligatorios" },
        { status: 400 }
      );
    }

    const { rows: existing } = await pool.query(
      `SELECT id, total::float as total, cliente_nombre FROM pedidos 
       WHERE negocio_id = $1 AND mesa = $2 AND estado NOT IN ('pagado', 'cancelado')
       ORDER BY created_at DESC LIMIT 1`,
      [negocio_id, String(mesa)]
    );

    if (existing.length === 0) {
      return NextResponse.json(
        { ok: false, error: "No hay comanda activa para esta mesa" },
        { status: 404 }
      );
    }

    const pedido = existing[0];
    const finalTotal = typeof total === "number" && total > 0 ? total : pedido.total;
    const finalCliente = comensal || pedido.cliente_nombre;

    // Cambiar estado a 'por_pagar'
    await pool.query(
      `UPDATE pedidos 
       SET estado = 'por_pagar',
           solicita_mesero = false,
           cliente_nombre = COALESCE($1, cliente_nombre)
       WHERE id = $2`,
      [finalCliente ? String(finalCliente).trim() : null, pedido.id]
    );

    // Notificar en tiempo real al mesero por Socket.IO
    emitPedidoActualizado(negocio_id, {
      id: pedido.id,
      negocio_id,
      mesa: String(mesa),
      estado: "por_pagar",
      cliente_nombre: finalCliente || "Comensal",
      metodo_pago: metodo_pago || "Efectivo",
      propina: propina || 0,
      total: finalTotal,
      tipo_alerta: "pedir_cuenta",
    });

    return NextResponse.json({
      ok: true,
      message: `Cuenta solicitada para la Mesa #${mesa}. El mesero se acercará con la cuenta.`,
      pedido_id: pedido.id,
      estado: "por_pagar",
      total: finalTotal,
    });
  } catch (err: any) {
    console.error("[POST /api/pedidos/pedir-cuenta] Error:", err);
    return NextResponse.json(
      { ok: false, error: err.message || "Error al solicitar cuenta" },
      { status: 500 }
    );
  }
}
