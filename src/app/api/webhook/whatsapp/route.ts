import { NextRequest, NextResponse } from "next/server";
import {
  parseEvolutionPayload,
  sendWhatsAppText,
  verifyWebhookAuth,
  EvolutionWebhookPayload,
} from "@/lib/evolution";

/**
 * Webhook Handler para Evolution API v2.3.7 en Next.js App Router
 * Ruta: POST /api/webhook/whatsapp
 */
export async function POST(req: NextRequest) {
  try {
    // 1. Validar autenticación/seguridad del Webhook
    if (!verifyWebhookAuth(req.headers)) {
      console.warn("[WhatsApp Webhook] Intento de acceso no autorizado (Header API Key inválido)");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const payload: EvolutionWebhookPayload = await req.json();

    if (!payload || !payload.event) {
      return NextResponse.json({ error: "Payload no válido" }, { status: 400 });
    }

    // Normalizar el evento (Evolution API v2 usa nombres tipo 'messages.upsert' o 'MESSAGES_UPSERT')
    const event = payload.event.toLowerCase();

    // 2. Procesar eventos de mensajes entrantes (MESSAGES_UPSERT / messages.upsert)
    if (event === "messages.upsert" || event === "messages_upsert") {
      const msgData = parseEvolutionPayload(payload);

      // Si no es un mensaje válido o fue enviado por el propio bot (fromMe === true), ignorar
      if (!msgData || msgData.fromMe) {
        return NextResponse.json({ status: "ignored", reason: "fromMe or empty message" });
      }

      console.log(
        `[WhatsApp Webhook] Mensaje recibido de ${msgData.phone} (${msgData.senderName}): "${msgData.text}"`
      );

      // -------------------------------------------------------------
      // Lógica de Procesamiento y Respuesta (Menú / Pedidos MenuQR)
      // -------------------------------------------------------------
      const normalizedText = msgData.text.toLowerCase().trim();

      if (normalizedText === "menu" || normalizedText === "menú") {
        await sendWhatsAppText({
          instance: msgData.instance,
          to: msgData.phone,
          text: `👋 ¡Hola ${msgData.senderName}! Bienvenido a MenuQR Pro.\n\n📱 Puedes explorar nuestra carta interactiva y platos del día en:\nhttps://menuqr.ubicame.cc\n\n¿Deseas ayuda con un pedido? Escribe *PEDIDO*.`,
        });
      } else if (normalizedText === "pedido" || normalizedText === "pedidos") {
        await sendWhatsAppText({
          instance: msgData.instance,
          to: msgData.phone,
          text: `🍔 ¡Excelente! Puedes armar tu pedido directamente desde el menú digital:\nhttps://menuqr.ubicame.cc\n\nUna vez seleccionado, tu pedido será enviado directamente a la cocina.`,
        });
      } else if (normalizedText.startsWith("pedido #")) {
        // Ejemplo de extracción de ID de pedido
        const orderId = normalizedText.replace("pedido #", "").trim();
        await sendWhatsAppText({
          instance: msgData.instance,
          to: msgData.phone,
          text: `🔎 Consultando el estado del pedido #${orderId}...\nTe notificaremos por aquí tan pronto cambie de estado.`,
        });
      } else {
        // Respuesta por defecto / Eco
        await sendWhatsAppText({
          instance: msgData.instance,
          to: msgData.phone,
          text: `🤖 Hola ${msgData.senderName}, recibimos tu mensaje: "${msgData.text}".\n\nComandos disponibles:\n• Escribe *MENÚ* para ver la carta.\n• Escribe *PEDIDO* para ordenar en línea.`,
        });
      }

      return NextResponse.json({ status: "success", event: "messages.upsert" });
    }

    // 3. Procesar eventos de actualización de conexión (CONNECTION_UPDATE / connection.update)
    if (event === "connection.update" || event === "connection_update") {
      const connectionState = payload.data?.state;
      const statusReason = payload.data?.statusReason;

      console.log(
        `[WhatsApp Webhook] Estado de conexión (${payload.instance}): ${connectionState} (Reason: ${statusReason})`
      );

      if (connectionState === "open") {
        console.log(`✅ Instancia de WhatsApp '${payload.instance}' conectada correctamente.`);
      } else if (connectionState === "close") {
        console.warn(`⚠️ Instancia de WhatsApp '${payload.instance}' desconectada.`);
      }

      return NextResponse.json({ status: "success", event: "connection.update", state: connectionState });
    }

    // Para cualquier otro evento no manejado explícitamente (ej: qrcode.updated, presence.update)
    return NextResponse.json({ status: "ignored", event: payload.event });
  } catch (error: any) {
    console.error("[WhatsApp Webhook Critical Error]:", error);
    return NextResponse.json({ error: "Internal Server Error", details: error.message }, { status: 500 });
  }
}
