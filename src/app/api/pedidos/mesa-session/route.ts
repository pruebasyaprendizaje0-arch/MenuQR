import { NextRequest, NextResponse } from "next/server";
import { pool, ensureDbTables } from "@/lib/db-pool";
import { signTableSessionToken } from "@/lib/jwt";

export const dynamic = "force-dynamic";

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

// POST /api/pedidos/mesa-session
// Valida en el servidor la existencia de una comanda activa para la mesa y emite
// un token criptográfico firmado para sincronizar la cuenta en vivo de esa mesa.
export async function POST(req: NextRequest) {
  try {
    await ensureDbTables();
    const body = await req.json();
    const { slug, mesa, customerName, customerPhone, orderId, orderNumber } = body;

    if (!slug || !mesa) {
      return NextResponse.json(
        { ok: false, error: "slug y mesa son obligatorios" },
        { status: 400 }
      );
    }

    const { rows: negRows } = await pool.query(
      "SELECT id, slug, nombre FROM negocios WHERE slug = $1",
      [slug.toLowerCase().trim()]
    );

    if (negRows.length === 0) {
      return NextResponse.json(
        { ok: false, error: "Negocio no encontrado" },
        { status: 404 }
      );
    }

    const negocio = negRows[0];
    const mesaVariants = getMesaVariants(mesa);

    // Buscar comanda activa para esta mesa
    const { rows: orderRows } = await pool.query(
      `SELECT id, negocio_id, mesa, estado, cliente_nombre, cliente_telefono, created_at, metadata
       FROM pedidos
       WHERE negocio_id = $1 
         AND LOWER(TRIM(mesa)) = ANY($2::text[])
         AND estado NOT IN ('pagado', 'cancelado')
       ORDER BY created_at DESC
       LIMIT 1`,
      [negocio.id, mesaVariants]
    );

    if (orderRows.length === 0) {
      // No hay comanda activa para esta mesa
      return NextResponse.json(
        { ok: false, active: false, message: "No hay comanda activa en esta mesa." },
        { status: 404 }
      );
    }

    const activeOrder = orderRows[0];

    // Validación de seguridad de pertenencia a la comanda:
    // Acepta si coincide:
    // 1. orderId explícito
    // 2. o el nombre del comensal coincide con el comensal de la comanda
    // 3. o el teléfono del comensal coincide
    // 4. o número de pedido
    // Si no se suministraron datos de comprobación o no coinciden, se deniega para evitar sniffing por terceros
    const providedName = String(customerName || "").trim().toLowerCase();
    const orderCustomerName = String(activeOrder.cliente_nombre || "").trim().toLowerCase();
    const cleanPhone = (p: string) => String(p || "").replace(/\D/g, "");

    let isMatch = false;

    if (orderId && orderId === activeOrder.id) {
      isMatch = true;
    } else if (
      providedName &&
      orderCustomerName &&
      (orderCustomerName.includes(providedName) || providedName.includes(orderCustomerName))
    ) {
      isMatch = true;
    } else if (
      customerPhone &&
      cleanPhone(customerPhone).length >= 7 &&
      cleanPhone(activeOrder.cliente_telefono).includes(cleanPhone(customerPhone).slice(-7))
    ) {
      isMatch = true;
    } else if (
      orderNumber &&
      (activeOrder.id.includes(String(orderNumber)) ||
        JSON.stringify(activeOrder.metadata || {}).includes(String(orderNumber)))
    ) {
      isMatch = true;
    }

    if (!isMatch) {
      return NextResponse.json(
        {
          ok: false,
          error: "Los datos del comensal no coinciden con la comanda activa de esta mesa.",
        },
        { status: 401 }
      );
    }

    // Emisión del token firmado por el servidor con JWT_SECRET
    const cleanMesaStr = String(mesa).replace(/^(mesa\s*#?|#)/i, "").trim();
    const tableSessionToken = signTableSessionToken({
      negocioId: negocio.id,
      mesa: cleanMesaStr,
      orderId: activeOrder.id,
      customerName: activeOrder.cliente_nombre || undefined,
      createdAt: Date.now(),
    });

    const res = NextResponse.json({
      ok: true,
      active: true,
      table_session_token: tableSessionToken,
      mesa: cleanMesaStr,
      orderId: activeOrder.id,
    });

    res.cookies.set("table_session", tableSessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      path: "/",
      sameSite: "lax",
      maxAge: 12 * 3600,
    });

    return res;
  } catch (err: unknown) {
    console.error("[POST /api/pedidos/mesa-session] Error:", err);
    return NextResponse.json(
      { ok: false, error: "Error al validar sesión de mesa" },
      { status: 500 }
    );
  }
}
