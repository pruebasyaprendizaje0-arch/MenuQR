import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * POST /api/pedidos/mesa-session
 * 
 * La recuperación de credenciales basada en conjeturas de nombre, teléfono o número de pedido
 * ha sido deshabilitada de forma definitiva por razones de ciberseguridad y privacidad.
 * La sesión de mesa se emite exclusivamente al abrir la comanda en el servidor y se valida
 * mediante token criptográfico y cookie httpOnly.
 */
export async function POST() {
  return NextResponse.json(
    {
      ok: false,
      error: "La recuperación de sesión mediante nombre, teléfono o número de pedido está deshabilitada por motivos de seguridad.",
    },
    { status: 410 }
  );
}

export async function GET() {
  return NextResponse.json(
    {
      ok: false,
      error: "Método no permitido.",
    },
    { status: 405 }
  );
}
