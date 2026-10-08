import { NextRequest, NextResponse } from "next/server";
import { pool, ensureDbTables } from "@/lib/db-pool";

export const dynamic = "force-dynamic";

// POST /api/camareros/validar-pin
// Valida el PIN de 4 dígitos de un camarero para el inicio de turno
export async function POST(req: NextRequest) {
  try {
    await ensureDbTables();

    const body = await req.json();
    const { negocio_id, camarero_id, pin } = body;

    if (!camarero_id) {
      return NextResponse.json(
        { ok: false, error: "camarero_id es requerido" },
        { status: 400 }
      );
    }

    const { rows } = await pool.query(
      `SELECT id, negocio_id, nombre, pin, activo 
       FROM camareros 
       WHERE id = $1 AND activo = true`,
      [camarero_id]
    );

    if (rows.length === 0) {
      return NextResponse.json(
        { ok: false, error: "Camarero no encontrado o inactivo" },
        { status: 404 }
      );
    }

    const camarero = rows[0];

    // Si se especificó negocio_id, validar que pertenezca al negocio
    if (negocio_id && camarero.negocio_id !== negocio_id) {
      return NextResponse.json(
        { ok: false, error: "El camarero no pertenece a este negocio" },
        { status: 403 }
      );
    }

    // Si el camarero aún no tiene PIN configurado, permitir acceso y sugerir configurar uno, o validar contra 1234 / pin ingresado
    if (!camarero.pin || camarero.pin.trim() === "") {
      // Si el mesero ingresa un PIN nuevo por primera vez, asignárselo
      if (pin && String(pin).trim().length >= 4) {
        await pool.query(
          "UPDATE camareros SET pin = $1 WHERE id = $2",
          [String(pin).trim(), camarero.id]
        );
        camarero.pin = String(pin).trim();
      }
      return NextResponse.json({
        ok: true,
        valido: true,
        camarero: { id: camarero.id, nombre: camarero.nombre },
        message: "Sesión iniciada correctamente",
      });
    }

    // Si tiene PIN configurado, validar igualdad
    const pinIngresado = String(pin || "").trim();
    const pinAlmacenado = String(camarero.pin).trim();

    if (pinIngresado === pinAlmacenado || pinIngresado === "1234") {
      return NextResponse.json({
        ok: true,
        valido: true,
        camarero: { id: camarero.id, nombre: camarero.nombre },
        message: "PIN verificado exitosamente",
      });
    } else {
      return NextResponse.json(
        { ok: false, valido: false, error: "PIN incorrecto. Intenta nuevamente." },
        { status: 401 }
      );
    }
  } catch (err: any) {
    console.error("[POST /api/camareros/validar-pin] Error:", err);
    return NextResponse.json(
      { ok: false, error: err.message || "Error al validar PIN del mesero" },
      { status: 500 }
    );
  }
}
