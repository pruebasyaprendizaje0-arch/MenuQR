import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { 
  getOrInitWhatsAppSocket, 
  disconnectWhatsApp, 
  isWhatsAppSocketActive 
} from "@/lib/whatsapp-native";

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

    const isSocketAlive = isWhatsAppSocketActive(restaurantId);
    const isQrStale = Boolean(
      session?.qr && 
      session.updatedAt && 
      (Date.now() - new Date(session.updatedAt).getTime() > 75000)
    );

    // Detección proactiva de inicialización necesaria:
    // 1. No existe sesión o está explícitamente DISCONNECTED.
    // 2. Existe sesión con credenciales autenticadas pero el socket en memoria murió por reinicio de servidor (rehidratar).
    // 3. La sesión está pendiente de vincular pero no hay socket vivo o el QR expiró (> 75s).
    const needsInit = autoInit && (
      !session ||
      session.status === "DISCONNECTED" ||
      (session.creds && !isSocketAlive) ||
      (!session.creds && (!isSocketAlive || isQrStale))
    );

    if (needsInit) {
      const forceFresh = !session?.creds && (!isSocketAlive || isQrStale);
      getOrInitWhatsAppSocket(restaurantId, forceFresh).catch((err) => {
        console.error(`[WhatsApp API] Error inicializando socket para ${restaurantId}:`, err);
      });

      // Pausa breve de 500ms para permitir que Baileys emita el primer evento si es nuevo QR
      if (forceFresh) {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }

      // Refrescar el registro de inmediato
      session = await prisma.whatsAppSession.findUnique({
        where: { restaurantId },
      });
    }

    // Normalizar status para la vista: si el QR caducó y no hay socket, indicar que está conectando
    let reportedStatus = session?.status || "DISCONNECTED";
    let reportedQr = session?.qr || null;

    if (reportedStatus === "QR_READY" && isQrStale && !isWhatsAppSocketActive(restaurantId)) {
      reportedStatus = "CONNECTING";
      reportedQr = null;
    }

    return NextResponse.json({
      success: true,
      restaurantId,
      restaurantName: restaurant.name,
      restaurantSlug: restaurant.slug,
      status: reportedStatus,
      qr: reportedQr,
      phoneNumber: session?.phoneNumber || null,
      updatedAt: session?.updatedAt || null,
      isSocketAlive: isWhatsAppSocketActive(restaurantId),
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
      // Breve espera de 800ms para permitir que Baileys emita el primer QR
      await new Promise((resolve) => setTimeout(resolve, 800));

      const session = await prisma.whatsAppSession.findUnique({
        where: { restaurantId },
      });
      return NextResponse.json({
        success: true,
        status: session?.status || "CONNECTING",
        qr: session?.qr || null,
        isSocketAlive: isWhatsAppSocketActive(restaurantId),
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
