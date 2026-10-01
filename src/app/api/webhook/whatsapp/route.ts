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
 *
 * Características:
 * - Respuesta HTTP 200 ultrarrápida para evitar timeouts de pasarela.
 * - Validación flexible/permisiva de seguridad con warnings descriptivos.
 * - Registro estructurado y detallado en consola.
 * - Detección de comandos ('menu', 'menú', 'hola', 'pedido').
 */
export async function POST(req: NextRequest) {
  const startTime = Date.now();
  console.log(`\n==================================================`);
  console.log(`[WhatsApp Webhook] 🚀 Petición POST recibida: ${new Date().toISOString()}`);

  try {
    // 1. Loguear Headers relevantes para trazabilidad
    const authHeader = req.headers.get("apikey") || req.headers.get("x-webhook-secret") || "ausente";
    console.log(`[WhatsApp Webhook Header] apikey/x-webhook-secret: "${authHeader !== "ausente" ? authHeader.substring(0, 5) + "***" : "ausente"}"`);

    // 2. Validar Seguridad (Permisivo si EVOLUTION_STRICT_AUTH no es true)
    const authCheck = verifyWebhookAuth(req.headers);
    if (!authCheck.valid) {
      console.warn(`[WhatsApp Webhook 401] Rechazado: ${authCheck.reason}`);
      return NextResponse.json(
        { error: "Unauthorized", message: authCheck.reason },
        { status: 401 }
      );
    }

    // 3. Extraer Body
    let payload: EvolutionWebhookPayload;
    try {
      payload = await req.json();
    } catch (parseErr) {
      console.error("[WhatsApp Webhook 400] Error decodificando cuerpo JSON:", parseErr);
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    // Trazar estructura del payload recibido
    console.log(`[WhatsApp Webhook Payload Dump]:`, JSON.stringify({
      event: payload.event,
      instance: payload.instance,
      sender: payload.sender,
      remoteJid: payload.data?.key?.remoteJid,
      fromMe: payload.data?.key?.fromMe,
      messageType: payload.data?.messageType,
    }, null, 2));

    if (!payload || !payload.event) {
      console.warn("[WhatsApp Webhook 400] Payload sin evento.");
      return NextResponse.json({ error: "Missing event field" }, { status: 400 });
    }

    // Normalizar nombre de evento ('MESSAGES_UPSERT', 'messages.upsert', 'messages_upsert')
    const rawEvent = payload.event;
    const normalizedEvent = rawEvent.toLowerCase().replace(/_/g, ".");

    // 4. Procesar Eventos de Mensajes Entrantes (messages.upsert)
    if (normalizedEvent === "messages.upsert") {
      const msgData = parseEvolutionPayload(payload);

      if (!msgData) {
        console.log("[WhatsApp Webhook] Mensaje sin estructura procesable. Ignorando.");
        return NextResponse.json({ status: "ignored", reason: "Unprocessable message structure" });
      }

      // Descartar si el mensaje fue enviado por el propio bot
      if (msgData.fromMe) {
        console.log(`[WhatsApp Webhook] Mensaje propio (${msgData.messageId}). Ignorando para evitar bucles.`);
        return NextResponse.json({ status: "ignored", reason: "fromMe is true" });
      }

      // Descartar si es un mensaje de grupo (a menos que se desee habilitar)
      if (msgData.isGroup) {
        console.log(`[WhatsApp Webhook] Mensaje de grupo (${msgData.remoteJid}). Ignorando.`);
        return NextResponse.json({ status: "ignored", reason: "Group message ignored" });
      }

      console.log(`[WhatsApp Webhook] 📩 Mensaje procesable de [${msgData.phone}] (${msgData.senderName}): "${msgData.text}"`);

      // Ejecutar el procesamiento de la respuesta sin bloquear la respuesta HTTP 200 al webhook
      processIncomingMessageAsync(msgData).catch((err) => {
        console.error("[WhatsApp Webhook Background Process Exception]:", err);
      });

      const elapsed = Date.now() - startTime;
      console.log(`[WhatsApp Webhook] ⚡ Respuesta HTTP 200 retornada al webhook en ${elapsed}ms`);
      return NextResponse.json({ status: "success", event: "messages.upsert", messageId: msgData.messageId });
    }

    // 5. Procesar Eventos de Estado de Conexión (connection.update)
    if (normalizedEvent === "connection.update") {
      const state = payload.data?.state;
      console.log(`[WhatsApp Webhook] Estado de conexión de '${payload.instance}': ${state}`);
      return NextResponse.json({ status: "success", event: "connection.update", state });
    }

    console.log(`[WhatsApp Webhook] Evento '${rawEvent}' ignorado.`);
    return NextResponse.json({ status: "ignored", event: rawEvent });

  } catch (error: any) {
    const elapsed = Date.now() - startTime;
    console.error(`[WhatsApp Webhook Critical Error] Invocación falló tras ${elapsed}ms:`, error);
    return NextResponse.json({ error: "Internal Server Error", details: error.message }, { status: 500 });
  }
}

/**
 * Función asíncrona para procesar la lógica de negocio y responder vía WhatsApp
 */
async function processIncomingMessageAsync(msgData: ReturnType<typeof parseEvolutionPayload> & {}) {
  if (!msgData || !msgData.text) {
    console.log("[WhatsApp Async Worker] Mensaje de texto vacío. No se envía respuesta.");
    return;
  }

  // Normalizar texto (remover tildes, minúsculas)
  const cleanText = msgData.text
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  console.log(`[WhatsApp Async Worker] Evalundo texto limpio: "${cleanText}" para cliente ${msgData.phone}`);

  let responseText = "";

  if (cleanText === "menu" || cleanText === "carta") {
    responseText = `👋 ¡Hola ${msgData.senderName}! Bienvenido a MenuQR Pro.\n\n📱 Consulta nuestra carta digital y promociones en:\nhttps://menuqr.ubicame.cc\n\n¿Deseas realizar un pedido? Escribe *PEDIDO*.`;
  } else if (cleanText === "hola" || cleanText === "buenas" || cleanText === "inicio") {
    responseText = `👋 ¡Hola ${msgData.senderName}! Gracias por escribirnos a MenuQR Pro.\n\nComandos disponibles:\n• Escribe *MENÚ* para ver la carta.\n• Escribe *PEDIDO* para ordenar en línea.`;
  } else if (cleanText === "pedido" || cleanText === "pedidos" || cleanText === "orden") {
    responseText = `🍔 ¡Excelente! Realiza tu pedido directamente en:\nhttps://menuqr.ubicame.cc\n\nTu orden se enviará directo a la cocina.`;
  } else {
    responseText = `🤖 Hola ${msgData.senderName}, recibimos tu mensaje: "${msgData.text}".\n\n• Escribe *MENÚ* para ver nuestra carta.\n• Escribe *PEDIDO* para solicitar una orden.`;
  }

  const result = await sendWhatsAppText({
    instance: msgData.instance,
    to: msgData.phone,
    text: responseText,
  });

  if (result.success) {
    console.log(`[WhatsApp Async Worker] ✅ Respuesta auto-reply enviada con éxito a ${msgData.phone}`);
  } else {
    console.error(`[WhatsApp Async Worker] ❌ Error enviando respuesta a ${msgData.phone}:`, result.error);
  }
}
