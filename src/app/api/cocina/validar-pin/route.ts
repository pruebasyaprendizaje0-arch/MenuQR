import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyPinHash } from "@/lib/security-pins";
import {
  extractClientIp,
  verifyDoubleRateLimit,
  recordDoubleFailedAttempt,
  clearDoubleRateLimit,
  COCINA_PIN_LIMIT,
} from "@/lib/security-rate-limit";

export const dynamic = "force-dynamic";

// POST /api/cocina/validar-pin
// Valida el PIN de seguridad (hash bcrypt) para acceder a la Pantalla de Cocina KDS con rate limiting
export async function POST(req: NextRequest) {
  try {
    const clientIp = extractClientIp(req);
    const body = await req.json();
    const { slug, pin } = body;

    if (!slug) {
      return NextResponse.json(
        { ok: false, error: "slug es requerido" },
        { status: 400 }
      );
    }

    const restaurant = await prisma.restaurant.findUnique({
      where: { slug },
      select: { id: true, name: true, customLabels: true },
    });

    if (!restaurant) {
      return NextResponse.json(
        { ok: false, error: "Negocio no encontrado" },
        { status: 404 }
      );
    }

    let customObj: Record<string, unknown> = {};
    if (restaurant.customLabels) {
      try {
        customObj = typeof restaurant.customLabels === "string"
          ? JSON.parse(restaurant.customLabels)
          : (restaurant.customLabels as unknown as Record<string, unknown>);
      } catch {}
    }

    const kitchenPinHash = typeof customObj.kitchenPinHash === "string" ? customObj.kitchenPinHash.trim() : "";
    const kitchenPinRequired = Boolean(customObj.kitchenPinRequired && kitchenPinHash);

    // Si no se requiere PIN configurado, es acceso libre concedido
    if (!kitchenPinRequired || !kitchenPinHash) {
      return NextResponse.json({
        ok: true,
        valido: true,
        required: false,
        message: "Acceso libre concedido a Cocina KDS",
      });
    }

    // Rate Limiting anti fuerza bruta (por negocio de cocina + por IP de origen)
    const entityKey = `cocina:${restaurant.id}`;
    const rateCheck = verifyDoubleRateLimit(entityKey, clientIp, COCINA_PIN_LIMIT);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        {
          ok: false,
          valido: false,
          required: true,
          error: rateCheck.error,
          retryAfterSeconds: rateCheck.retryAfterSeconds,
        },
        { status: 429 }
      );
    }

    const enteredPin = String(pin || "").trim();
    const pinValido = verifyPinHash(enteredPin, kitchenPinHash);

    if (pinValido) {
      clearDoubleRateLimit(entityKey, clientIp);
      return NextResponse.json({
        ok: true,
        valido: true,
        required: true,
        message: "PIN de Cocina verificado con éxito",
      });
    } else {
      const failResult = recordDoubleFailedAttempt(entityKey, clientIp, COCINA_PIN_LIMIT);
      const remainingMsg = failResult.remainingAttempts > 0
        ? ` (${failResult.remainingAttempts} intento${failResult.remainingAttempts > 1 ? "s" : ""} restante${failResult.remainingAttempts > 1 ? "s" : ""})`
        : "";

      return NextResponse.json({
        ok: true,
        valido: false,
        required: true,
        error: failResult.error || `PIN de Cocina incorrecto. Verifica la clave con el administrador${remainingMsg}.`,
        remainingAttempts: failResult.remainingAttempts,
        retryAfterSeconds: failResult.retryAfterSeconds,
      });
    }
  } catch (err: unknown) {
    console.error("[POST /api/cocina/validar-pin] Error:", err);
    const errMsg = err instanceof Error ? err.message : "Error al validar PIN de cocina";
    return NextResponse.json(
      { ok: false, error: errMsg },
      { status: 500 }
    );
  }
}
