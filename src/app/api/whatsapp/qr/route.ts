import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getOrInitWhatsAppSocket, disconnectWhatsApp } from "@/lib/whatsapp-native";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const restaurantId = searchParams.get("restaurantId");
    const autoInit = searchParams.get("init") !== "false";

    if (!restaurantId) {
      return NextResponse.json(
        { error: "El parámetro restaurantId es obligatorio" },
        { status: 400 }
      );
    }

    const restaurant = await prisma.restaurant.findUnique({
      where: { id: restaurantId },
      select: { id: true, name: true, slug: true, whatsappBotEnabled: true },
    });

    if (!restaurant) {
      return NextResponse.json({ error: "Restaurante no encontrado" }, { status: 404 });
    }

    // Si el SuperAdmin tiene desactivado el bot para este negocio, bloquear acceso
    if (!restaurant.whatsappBotEnabled) {
      return NextResponse.json(
        {
          success: false,
          error: "El servicio de WhatsApp está desactivado para este negocio en el panel de SuperAdmin.",
          disabledBySuperAdmin: true,
        },
        { status: 403 }
      );
    }

    let session = await prisma.whatsAppSession.findUnique({
      where: { restaurantId },
    });

    // Si el panel admin entra y la sesión está desconectada, inicializamos el socket para generar el QR
    if (autoInit && (!session || session.status === "DISCONNECTED")) {
      getOrInitWhatsAppSocket(restaurantId).catch((err) => {
        console.error(`[WhatsApp API] Error inicializando socket para ${restaurantId}:`, err);
      });

      // Refrescar el registro de inmediato
      session = await prisma.whatsAppSession.findUnique({
        where: { restaurantId },
      });
    }

    return NextResponse.json({
      success: true,
      restaurantId,
      restaurantName: restaurant.name,
      restaurantSlug: restaurant.slug,
      status: session?.status || "DISCONNECTED",
      qr: session?.qr || null,
      phoneNumber: session?.phoneNumber || null,
      updatedAt: session?.updatedAt || null,
    });
  } catch (error: any) {
    console.error("[WhatsApp API GET] Error:", error);
    return NextResponse.json(
      { error: "Error interno al consultar el estado de WhatsApp" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { restaurantId, action } = body;

    if (!restaurantId) {
      return NextResponse.json(
        { error: "El parámetro restaurantId es obligatorio" },
        { status: 400 }
      );
    }

    const restaurant = await prisma.restaurant.findUnique({
      where: { id: restaurantId },
      select: { id: true, name: true, slug: true, whatsappBotEnabled: true },
    });

    if (!restaurant) {
      return NextResponse.json({ error: "Restaurante no encontrado" }, { status: 404 });
    }

    if (!restaurant.whatsappBotEnabled) {
      return NextResponse.json(
        {
          success: false,
          error: "El servicio de WhatsApp está desactivado para este negocio en el panel de SuperAdmin.",
          disabledBySuperAdmin: true,
        },
        { status: 403 }
      );
    }

    if (action === "disconnect") {
      await disconnectWhatsApp(restaurantId);
      return NextResponse.json({ success: true, status: "DISCONNECTED" });
    }

    if (action === "connect" || action === "restart") {
      await getOrInitWhatsAppSocket(restaurantId, true);
      const session = await prisma.whatsAppSession.findUnique({
        where: { restaurantId },
      });
      return NextResponse.json({
        success: true,
        status: session?.status || "CONNECTING",
        qr: session?.qr || null,
      });
    }

    return NextResponse.json({ error: "Acción no reconocida" }, { status: 400 });
  } catch (error: any) {
    console.error("[WhatsApp API POST] Error:", error);
    return NextResponse.json(
      { error: "Error interno al ejecutar la acción de WhatsApp" },
      { status: 500 }
    );
  }
}
