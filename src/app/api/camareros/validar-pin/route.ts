import { NextRequest, NextResponse } from "next/server";
import { pool, ensureDbTables } from "@/lib/db-pool";
import { verifyPinHash } from "@/lib/security-pins";
import { signStaffToken } from "@/lib/jwt";
import {
  extractClientIp,
  verifyDoubleRateLimit,
  recordDoubleFailedAttempt,
  clearDoubleRateLimit,
  MESERO_PIN_LIMIT,
} from "@/lib/security-rate-limit";

export const dynamic = "force-dynamic";

// POST /api/camareros/validar-pin
// Valida el PIN seguro (hash bcrypt) de un camarero con rate limiting estricto anti fuerza bruta
export async function POST(req: NextRequest) {
  try {
    await ensureDbTables();

    const clientIp = extractClientIp(req);
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

    // Rate Limiting anti fuerza bruta (por mesero + por IP de origen)
    const entityKey = `mesero:${camarero.id}`;
    const rateCheck = verifyDoubleRateLimit(entityKey, clientIp, MESERO_PIN_LIMIT);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        {
          ok: false,
          valido: false,
          error: rateCheck.error,
          retryAfterSeconds: rateCheck.retryAfterSeconds,
        },
        { status: 429 }
      );
    }

    // Si el camarero no tiene PIN configurado por el administrador, denegar acceso
    // NUNCA auto-asignar PIN desde esta pantalla ni permitir acceso sin clave
    if (!camarero.pin || camarero.pin.trim() === "") {
      return NextResponse.json(
        {
          ok: false,
          valido: false,
          error: "Este integrante no tiene un PIN configurado. Contacta al administrador para que asigne tu PIN de acceso.",
        },
        { status: 401 }
      );
    }

    // Verificación criptográfica segura con bcrypt contra el hash almacenado
    const pinIngresado = String(pin || "").trim();
    const pinValido = verifyPinHash(pinIngresado, camarero.pin);

    if (pinValido) {
      // Éxito: restablecer contadores de intentos fallidos
      clearDoubleRateLimit(entityKey, clientIp);

      const token = signStaffToken({
        role: "MESERO",
        negocioId: camarero.negocio_id,
        staffId: camarero.id,
        staffNombre: camarero.nombre,
      });

      const res = NextResponse.json({
        ok: true,
        valido: true,
        token,
        camarero: { id: camarero.id, nombre: camarero.nombre },
        message: "PIN verificado exitosamente",
      });

      res.cookies.set("staff_session", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        path: "/",
        sameSite: "lax",
        maxAge: 24 * 3600,
      });

      res.cookies.set("mesero_session", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        path: "/",
        sameSite: "lax",
        maxAge: 24 * 3600,
      });

      return res;
    } else {
      // Fallo: registrar intento fallido y aplicar bloqueo si se excede el umbral
      const failResult = recordDoubleFailedAttempt(entityKey, clientIp, MESERO_PIN_LIMIT);
      const remainingMsg = failResult.remainingAttempts > 0
        ? ` (${failResult.remainingAttempts} intento${failResult.remainingAttempts > 1 ? "s" : ""} restante${failResult.remainingAttempts > 1 ? "s" : ""})`
        : "";

      return NextResponse.json(
        {
          ok: false,
          valido: false,
          error: failResult.error || `PIN incorrecto. Intenta nuevamente${remainingMsg}.`,
          remainingAttempts: failResult.remainingAttempts,
          retryAfterSeconds: failResult.retryAfterSeconds,
        },
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
