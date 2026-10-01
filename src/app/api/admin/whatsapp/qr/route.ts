import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserSession, getSuperAdminSession } from "@/lib/auth";
import { connectWhatsAppInstance } from "@/lib/evolution";

/**
 * Proxy Endpoint Seguro para Obtención de Código QR y Pairing Code (Evolution API v2)
 * Ruta: GET /api/admin/whatsapp/qr
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const restaurantId = searchParams.get("restaurantId");

    if (!restaurantId) {
      return NextResponse.json({ error: "Parámetro restaurantId requerido" }, { status: 400 });
    }

    // Verificar Autorización
    const isSuperAdmin = await getSuperAdminSession();
    if (!isSuperAdmin) {
      const userSession = await getUserSession();
      if (!userSession) {
        return NextResponse.json({ error: "No autorizado" }, { status: 401 });
      }
      const restaurant = await prisma.restaurant.findUnique({
        where: { id: restaurantId },
        select: { userId: true },
      });
      if (!restaurant || restaurant.userId !== (userSession as any).userId) {
        return NextResponse.json({ error: "Acceso denegado a este restaurante" }, { status: 403 });
      }
    }

    const restaurant = await prisma.restaurant.findUnique({
      where: { id: restaurantId },
      select: { slug: true },
    });

    if (!restaurant) {
      return NextResponse.json({ error: "Restaurante no encontrado" }, { status: 404 });
    }

    // Petición backend-to-backend a Evolution API
    const qrResult = await connectWhatsAppInstance(restaurant.slug);

    if (!qrResult.success) {
      return NextResponse.json(
        { error: qrResult.error || "No se pudo obtener el código QR de Evolution API" },
        { status: 502 }
      );
    }

    // Sincronizar en base de datos
    await prisma.whatsAppInstance.upsert({
      where: { restaurantId },
      create: {
        restaurantId,
        instanceName: restaurant.slug,
        status: qrResult.state || "connecting",
        qrcode: qrResult.base64 || null,
        pairingCode: qrResult.pairingCode || null,
      },
      update: {
        status: qrResult.state || "connecting",
        qrcode: qrResult.base64 || null,
        pairingCode: qrResult.pairingCode || null,
        updatedAt: new Date(),
      },
    }).catch(() => {});

    return NextResponse.json({
      success: true,
      base64: qrResult.base64,
      pairingCode: qrResult.pairingCode,
      state: qrResult.state,
    });
  } catch (error: any) {
    console.error("[API Admin WhatsApp QR GET Error]:", error);
    return NextResponse.json({ error: "Internal Server Error", details: error.message }, { status: 500 });
  }
}
