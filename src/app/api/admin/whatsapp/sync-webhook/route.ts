import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserSession, getSuperAdminSession } from "@/lib/auth";
import { ensureWhatsAppWebhook, sendWhatsAppText } from "@/lib/evolution";

/**
 * Endpoint para Sincronizar Webhook de Evolution API y Validar el Bot de WhatsApp
 * Ruta: POST /api/admin/whatsapp/sync-webhook
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { restaurantId, testPhone } = body;

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
      select: { id: true, slug: true, name: true, whatsapp: true, whatsappBotEnabled: true },
    });

    if (!restaurant) {
      return NextResponse.json({ error: "Restaurante no encontrado" }, { status: 404 });
    }

    // 1. Asegurar que whatsappBotEnabled esté en TRUE
    if (!restaurant.whatsappBotEnabled) {
      await prisma.restaurant.update({
        where: { id: restaurantId },
        data: { whatsappBotEnabled: true },
      });
    }

    // 2. Limpiar pausas de atención humana (human handoff) activas para que el bot responda
    await prisma.whatsAppSession.updateMany({
      where: { restaurantId },
      data: {
        humanHandoffUntil: null,
        state: "MENU",
      },
    });

    // 3. Sincronizar Webhook en Evolution API
    const webhookResult = await ensureWhatsAppWebhook(restaurant.slug);

    // 4. Si se proporcionó un número de prueba, enviar un mensaje de prueba
    let testResult: any = null;
    const phoneToSend = testPhone || restaurant.whatsapp;
    if (phoneToSend && phoneToSend.replace(/\D/g, "").length >= 8) {
      const cleanPhone = phoneToSend.replace(/\D/g, "");
      testResult = await sendWhatsAppText({
        instance: restaurant.slug,
        to: cleanPhone,
        text: `🤖 *Prueba de Conexión Exitosa - ${restaurant.name}*\n\n¡Tu bot de WhatsApp está conectado y listo para atender a tus clientes automáticamente! Escribe *MENU* para ver las opciones disponibles.`,
      });
    }

    return NextResponse.json({
      success: true,
      message: `Webhook de '${restaurant.slug}' sincronizado con éxito. Recepción automática activada.`,
      webhookResult,
      testResult,
    });
  } catch (error: any) {
    console.error("[Sync Webhook Error]:", error);
    return NextResponse.json({ error: error.message || "Error al sincronizar webhook" }, { status: 500 });
  }
}
