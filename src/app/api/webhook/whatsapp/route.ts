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
  const startTime = Date.now();
  
  try {
    console.log(`[WhatsApp Webhook] Petición POST recibida a las ${new Date().toISOString()}`);

    // 1. Validar Autenticación/Seguridad del Webhook mediante Headers
    if (!verifyWebhookAuth(req.headers)) {
      console.warn("[WhatsApp Webhook Error 401] Intento de acceso no autorizado: Header 'apikey' / 'x-webhook-secret' no válido");
      return NextResponse.json(
        { error: "Unauthorized", message: "API key o Webhook Secret no válido" },
        { status: 401 }
      );
    }

    // 2. Extraer y Parsear el Payload JSON
    let payload: EvolutionWebhookPayload;
    try {
      payload = await req.json();
    } catch (parseErr) {
      console.error("[WhatsApp Webhook Error 400] Error al decodificar el cuerpo JSON de la petición:", parseErr);
      return NextResponse.json(
        { error: "Bad Request", message: "El cuerpo de la petición no es un JSON válido" },
        { status: 400 }
      );
    }

    if (!payload || !payload.event) {
      console.warn("[WhatsApp Webhook Error 400] Payload sin campo 'event':", payload);
      return NextResponse.json(
        { error: "Bad Request", message: "Falta el campo 'event' en el payload" },
        { status: 400 }
      );
    }

    // Normalizar el evento (Evolution API v2 maneja eventos tipo 'messages.upsert' o 'MESSAGES_UPSERT')
    const rawEvent = payload.event;
    const normalizedEvent = rawEvent.toLowerCase().replace(/_/g, ".");

    console.log(`[WhatsApp Webhook] Evento detectado: '${rawEvent}' (Normalizado: '${normalizedEvent}') | Instancia: '${payload.instance || "desconocida"}'`);

    // 3. Procesar Eventos de Mensajes Entrantes (MESSAGES_UPSERT / messages.upsert)
    if (normalizedEvent === "messages.upsert") {
      const msgData = parseEvolutionPayload(payload);

      // Si no es un mensaje de texto válido o fue enviado por el propio bot (fromMe === true), ignorar
      if (!msgData) {
        console.log("[WhatsApp Webhook] Payload de mensaje vacío o no compatible. Evento ignorado.");
        return NextResponse.json({ status: "ignored", reason: "Payload de mensaje no procesable" });
      }

      if (msgData.fromMe) {
        console.log(`[WhatsApp Webhook] Mensaje saliente de la propia instancia (${msgData.messageId}). Ignorado para evitar bucles.`);
        return NextResponse.json({ status: "ignored", reason: "Mensaje generado por la propia instancia (fromMe)" });
      }

      console.log(
        `[WhatsApp Webhook] 📩 Mensaje entrante de ${msgData.phone} (${msgData.senderName}): "${msgData.text}"`
      );

      // Normalización del texto para detectar comandos (remueve tildes y convierte a minúsculas)
      const cleanText = msgData.text
        .toLowerCase()
        .trim()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");

      // -------------------------------------------------------------
      // Detección de Comandos y Respuesta Automática via Evolution API
      // -------------------------------------------------------------
      if (cleanText === "menu") {
        console.log(`[WhatsApp Webhook] Comando 'MENÚ' detectado para ${msgData.phone}. Enviando carta digital...`);
        
        const sendResult = await sendWhatsAppText({
          instance: msgData.instance,
          to: msgData.phone,
          text: `👋 ¡Hola ${msgData.senderName}! Bienvenido a MenuQR Pro.\n\n📱 Puedes explorar nuestra carta interactiva, platos del día y promociones aquí:\nhttps://menuqr.ubicame.cc\n\n¿Deseas realizar un pedido? Escribe *PEDIDO*.`,
        });

        if (sendResult.success) {
          console.log(`[WhatsApp Webhook] ✅ Respuesta con el Menú enviada con éxito a ${msgData.phone}`);
        } else {
          console.error(`[WhatsApp Webhook] ❌ Error al enviar mensaje con el Menú a ${msgData.phone}:`, sendResult.error);
        }

      } else if (cleanText === "pedido" || cleanText === "pedidos") {
        console.log(`[WhatsApp Webhook] Comando 'PEDIDO' detectado para ${msgData.phone}. Enviando enlace de orden...`);
        
        const sendResult = await sendWhatsAppText({
          instance: msgData.instance,
          to: msgData.phone,
          text: `🍔 ¡Excelente! Puedes armar tu pedido directamente desde nuestro menú digital:\nhttps://menuqr.ubicame.cc\n\nTu orden será recibida inmediatamente en nuestra cocina.`,
        });

        if (sendResult.success) {
          console.log(`[WhatsApp Webhook] ✅ Respuesta de Pedido enviada con éxito a ${msgData.phone}`);
        } else {
          console.error(`[WhatsApp Webhook] ❌ Error al enviar mensaje de Pedido a ${msgData.phone}:`, sendResult.error);
        }

      } else {
        console.log(`[WhatsApp Webhook] Mensaje estándar recibido. Enviando respuesta por defecto...`);
        
        const sendResult = await sendWhatsAppText({
          instance: msgData.instance,
          to: msgData.phone,
          text: `🤖 Hola ${msgData.senderName}, hemos recibido tu mensaje: "${msgData.text}".\n\nComandos disponibles:\n• Escribe *MENÚ* para ver nuestra carta digital.\n• Escribe *PEDIDO* para realizar un pedido en línea.`,
        });

        if (sendResult.success) {
          console.log(`[WhatsApp Webhook] ✅ Respuesta por defecto enviada con éxito a ${msgData.phone}`);
        } else {
          console.error(`[WhatsApp Webhook] ❌ Error al enviar respuesta por defecto a ${msgData.phone}:`, sendResult.error);
        }
      }

      const duration = Date.now() - startTime;
      console.log(`[WhatsApp Webhook] Evento 'messages.upsert' procesado exitosamente en ${duration}ms`);

      return NextResponse.json({
        status: "success",
        event: "messages.upsert",
        processedInMs: duration,
      });
    }

    // 4. Procesar Eventos de Conexión (CONNECTION_UPDATE / connection.update)
    if (normalizedEvent === "connection.update") {
      const state = payload.data?.state;
      const statusReason = payload.data?.statusReason;

      console.log(
        `[WhatsApp Webhook] Estado de conexión de la instancia '${payload.instance}': ${state} (Razón: ${statusReason || "N/A"})`
      );

      if (state === "open") {
        console.log(`✅ [WhatsApp Webhook] Instancia '${payload.instance}' activa y lista.`);
      } else if (state === "close") {
        console.warn(`⚠️ [WhatsApp Webhook] Instancia '${payload.instance}' se ha desconectado.`);
      }

      return NextResponse.json({
        status: "success",
        event: "connection.update",
        state,
      });
    }

    // Eventos no manejados explícitamente (ej: qrcode.updated, presence.update)
    console.log(`[WhatsApp Webhook] Evento '${rawEvent}' recibido pero no requiere acción. Ignorando.`);
    return NextResponse.json({ status: "ignored", event: rawEvent });

  } catch (error: any) {
    const duration = Date.now() - startTime;
    console.error(`[WhatsApp Webhook Exception Critical] Error no controlado en Webhook tras ${duration}ms:`, {
      message: error.message,
      stack: error.stack,
    });

    return NextResponse.json(
      {
        error: "Internal Server Error",
        message: "Ocurrió un error inesperado al procesar el webhook",
        details: process.env.NODE_ENV === "development" ? error.message : undefined,
      },
      { status: 500 }
    );
  }
}
