import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

// POST /api/cocina/validar-pin
// Valida el PIN de seguridad para acceder a la Pantalla de Cocina KDS
export async function POST(req: NextRequest) {
  try {
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

    const kitchenPin = typeof customObj.kitchenPin === "string" ? customObj.kitchenPin.trim() : "";
    const kitchenPinRequired = Boolean(customObj.kitchenPinRequired && kitchenPin);

    // Si no se requiere PIN, es válido directamente
    if (!kitchenPinRequired || !kitchenPin) {
      return NextResponse.json({
        ok: true,
        valido: true,
        required: false,
        message: "Acceso libre concedido a Cocina KDS",
      });
    }

    const enteredPin = String(pin || "").trim();

    if (enteredPin === kitchenPin) {
      return NextResponse.json({
        ok: true,
        valido: true,
        required: true,
        message: "PIN de Cocina verificado con éxito",
      });
    } else {
      return NextResponse.json({
        ok: true,
        valido: false,
        required: true,
        error: "PIN de Cocina incorrecto. Verifica la clave con el administrador.",
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
