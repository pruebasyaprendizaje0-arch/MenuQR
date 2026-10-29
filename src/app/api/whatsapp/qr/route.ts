import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const restaurantId = searchParams.get("restaurantId");

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

    return NextResponse.json({
      success: true,
      restaurantId,
      restaurantName: restaurant.name,
      restaurantSlug: restaurant.slug,
      status: "DISCONNECTED",
      qr: null,
      phoneNumber: null,
      updatedAt: null,
      isSocketAlive: false,
      nativeDisabled: true,
      message: "La integración nativa de WhatsApp (Baileys) está desactivada para optimizar los recursos de memoria del servidor.",
    });
  } catch (error: unknown) {
    console.error("[WhatsApp API GET] Error:", error);
    return NextResponse.json(
      { error: "Error interno al consultar el estado de WhatsApp" },
      { status: 500 }
    );
  }
}

export async function POST() {
  return NextResponse.json(
    {
      success: false,
      error: "La integración nativa de WhatsApp (Baileys) ha sido desinstalada para optimizar los recursos del servidor.",
      nativeDisabled: true,
    },
    { status: 410 }
  );
}
