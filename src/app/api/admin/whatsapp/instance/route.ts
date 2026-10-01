import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserSession, getSuperAdminSession } from "@/lib/auth";
import {
  getWhatsAppConnectionState,
  connectWhatsAppInstance,
  logoutWhatsAppInstance,
  deleteWhatsAppInstance,
} from "@/lib/evolution";

/**
 * Proxy Endpoint para Gestión del Ciclo de Vida de Instancias WhatsApp (Evolution API v2)
 * Ruta: GET / POST /api/admin/whatsapp/instance
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
        select: { userId: true, slug: true, whatsapp: true },
      });
      if (!restaurant || restaurant.userId !== (userSession as any).userId) {
        return NextResponse.json({ error: "Acceso denegado a este restaurante" }, { status: 403 });
      }
    }

    const restaurant = await prisma.restaurant.findUnique({
      where: { id: restaurantId },
      select: { slug: true, name: true, whatsapp: true },
    });

    if (!restaurant) {
      return NextResponse.json({ error: "Restaurante no encontrado" }, { status: 404 });
    }

    // Obtener estado real de Evolution API (Backend-to-Backend seguro)
    const connState = await getWhatsAppConnectionState(restaurant.slug);

    // Sincronizar en PostgreSQL
    await prisma.whatsAppInstance.upsert({
      where: { restaurantId },
      create: {
        restaurantId,
        instanceName: restaurant.slug,
        status: connState.state || "close",
      },
      update: {
        status: connState.state || "close",
        updatedAt: new Date(),
      },
    }).catch(() => {});

    return NextResponse.json({
      success: true,
      instanceName: restaurant.slug,
      status: connState.state || "close",
      whatsappNumber: restaurant.whatsapp,
    });
  } catch (error: any) {
    console.error("[API Admin WhatsApp Instance GET Error]:", error);
    return NextResponse.json({ error: "Internal Server Error", details: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { restaurantId, action } = body;

    if (!restaurantId || !action) {
      return NextResponse.json({ error: "Parámetros restaurantId y action requeridos" }, { status: 400 });
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

    if (action === "disconnect" || action === "delete") {
      const logoutRes = action === "delete"
        ? await deleteWhatsAppInstance(restaurant.slug)
        : await logoutWhatsAppInstance(restaurant.slug);

      if (!logoutRes.success) {
        console.warn(`[WhatsApp Action Warning] Fallback intent en ${action}:`, logoutRes.error);
      }

      await prisma.whatsAppInstance.update({
        where: { restaurantId },
        data: { status: "close", qrcode: null, pairingCode: null },
      }).catch(() => {});

      return NextResponse.json({
        success: true,
        message: action === "delete" ? "Instancia eliminada con éxito" : "Instancia desconectada con éxito",
      });
    }

    return NextResponse.json({ error: "Acción no soportada" }, { status: 400 });
  } catch (error: any) {
    console.error("[API Admin WhatsApp Instance POST Error]:", error);
    return NextResponse.json({ error: "Internal Server Error", details: error.message }, { status: 500 });
  }
}

