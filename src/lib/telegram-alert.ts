/**
 * Servicio de alertas instantáneas hacia Telegram a través de webhook de n8n.
 * Ejecución no bloqueante (fire-and-forget) con timeout estricto para proteger
 * la latencia del servidor y la experiencia del usuario.
 */

export interface TelegramAlertPayload {
  mensaje: string;
  cliente?: string;
  negocio?: string;
}

const DEFAULT_N8N_WEBHOOK_URL = "https://n8n.ubicame.cc/webhook/66e559a3-2ce2-4878-a77e-5deace6ab14e";

/**
 * Envía una alerta a Telegram a través de n8n.
 * Maneja excepciones de forma silenciosa y no bloqueante.
 */
export async function sendTelegramAlert(payload: TelegramAlertPayload): Promise<boolean> {
  const webhookUrl = process.env.N8N_TELEGRAM_WEBHOOK_URL || DEFAULT_N8N_WEBHOOK_URL;

  if (!webhookUrl || typeof webhookUrl !== "string") {
    return false;
  }

  try {
    const postBody = {
      mensaje: payload.mensaje,
      cliente: payload.cliente?.trim() || "Cliente",
      ...(payload.negocio ? { negocio: payload.negocio } : {}),
    };

    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(postBody),
      signal: AbortSignal.timeout(3500),
    });

    if (!res.ok) {
      console.warn(`[Telegram Alert] n8n respondió con código ${res.status}: ${res.statusText}`);
      return false;
    }

    return true;
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[Telegram Alert] Error no bloqueante al disparar webhook n8n:", msg);
    return false;
  }
}
