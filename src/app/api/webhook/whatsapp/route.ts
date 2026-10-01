import { NextRequest, NextResponse } from "next/server";
import {
  parseEvolutionPayload,
  verifyWebhookAuth,
  EvolutionWebhookPayload,
} from "@/lib/evolution";
import { processWhatsAppFSM } from "@/lib/whatsapp/fsm";

/**
 * Webhook Handler para Evolution API v2 en Next.js App Router
 * Ruta: POST /api/webhook/whatsapp
 *
 * Características:
 * - Respuesta HTTP 200 ultrarrápida para evitar timeouts en Evolution API.
 * - Validación flexible de seguridad (EVOLUTION_STRICT_AUTH).
 * - Procesamiento asíncrono con Máquina de Estados Finitos (FSM).
 * - Control de duplicados, simulación humana y human handoff.
 */
export async function POST(req: NextRequest) {
  const startTime = Date.now();
  console.log(`\n==================================================`);
  console.log(`[WhatsApp Webhook] 🚀 Petición POST recibida: ${new Date().toISOString()}`);

  try {
    // 1. Validar Seguridad (Permisivo salvo que EVOLUTION_STRICT_AUTH === "true")
    const authCheck = verifyWebhookAuth(req.headers);
    if (!authCheck.valid) {
      console.warn(`[WhatsApp Webhook 401] Rechazado: ${authCheck.reason}`);
      return NextResponse.json(
        { error: "Unauthorized", message: authCheck.reason },
        { status: 401 }
      );
    }

    // 2. Decodificar Cuerpo JSON
    let payload: EvolutionWebhookPayload;
    try {
      payload = await req.json();
    } catch (parseErr) {
      console.error("[WhatsApp Webhook 400] Error decodificando cuerpo JSON:", parseErr);
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    if (!payload || !payload.event) {
      console.warn("[WhatsApp Webhook 400] Payload sin campo event.");
      return NextResponse.json({ error: "Missing event field" }, { status: 400 });
    }

    // Normalizar nombre del evento
    const rawEvent = payload.event;
    const normalizedEvent = rawEvent.toLowerCase().replace(/_/g, ".");

    console.log(`[WhatsApp Webhook] Evento recibido: '${rawEvent}' (Instancia: '${payload.instance || "default"}')`);

    // 3. Procesar Eventos de Mensajes Entrantes (MESSAGES_UPSERT, MESSAGES_SEND)
    if (normalizedEvent === "messages.upsert" || normalizedEvent === "messages.send" || normalizedEvent === "send.message") {
      const msgData = parseEvolutionPayload(payload);

      if (!msgData) {
        return NextResponse.json({ status: "ignored", reason: "Unprocessable message payload" });
      }

      // Descartar mensajes de grupo
      if (msgData.isGroup) {
        console.log(`[WhatsApp Webhook] Mensaje de grupo (${msgData.remoteJid}). Ignorando.`);
        return NextResponse.json({ status: "ignored", reason: "Group message ignored" });
      }

      // Ejecutar la Máquina de Estados Finitos (FSM) de forma asíncrona sin bloquear la respuesta 200
      processWhatsAppFSM(msgData, payload).catch((err) => {
        console.error("[WhatsApp Webhook FSM Background Exception]:", err);
      });

      const elapsed = Date.now() - startTime;
      console.log(`[WhatsApp Webhook 200] ⚡ Respuesta retornada al webhook en ${elapsed}ms`);
      return NextResponse.json({
        status: "success",
        event: rawEvent,
        messageId: msgData.messageId,
      });
    }

    // 4. Procesar Evento de Estado de Conexión (CONNECTION_UPDATE)
    if (normalizedEvent === "connection.update") {
      const state = payload.data?.state;
      console.log(`[WhatsApp Webhook] Estado de conexión de '${payload.instance}': ${state}`);
      return NextResponse.json({ status: "success", event: rawEvent, state });
    }

    return NextResponse.json({ status: "ignored", event: rawEvent });
  } catch (error: any) {
    const elapsed = Date.now() - startTime;
    console.error(`[WhatsApp Webhook Critical Error] Invocación falló tras ${elapsed}ms:`, error);
    return NextResponse.json({ error: "Internal Server Error", details: error.message }, { status: 500 });
  }
}

