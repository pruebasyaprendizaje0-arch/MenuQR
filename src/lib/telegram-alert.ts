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

function resolveN8nWebhookUrl(): string | null {
  const raw =
    process.env.N8N_TELEGRAM_WEBHOOK_URL ||
    process.env.N8N_WEBHOOK_URL ||
    process.env.TELEGRAM_WEBHOOK_URL ||
    DEFAULT_N8N_WEBHOOK_URL;

  if (!raw || typeof raw !== "string") return null;
  let clean = raw.trim();
  if (!clean || clean.toLowerCase() === "disabled" || clean.toLowerCase() === "none") {
    return null;
  }

  // Prevenir uso accidental de URL de prueba (/webhook-test/) que retorna 404 fuera del editor de n8n
  if (clean.includes("/webhook-test/")) {
    clean = clean.replace("/webhook-test/", "/webhook/");
  }

  return clean;
}

function maskWebhookUrl(url: string): string {
  try {
    const u = new URL(url);
    const segments = u.pathname.split("/").filter(Boolean);
    if (segments.length > 0) {
      const last = segments[segments.length - 1];
      const maskedLast = last.length > 8 ? `${last.substring(0, 4)}...${last.slice(-4)}` : "***";
      segments[segments.length - 1] = maskedLast;
      u.pathname = "/" + segments.join("/");
    }
    return u.toString();
  } catch {
    return "https://n8n.../***";
  }
}

/**
 * Envía una alerta a Telegram a través de n8n.
 * Maneja excepciones de forma silenciosa y no bloqueante.
 */
export async function sendTelegramAlert(payload: TelegramAlertPayload): Promise<boolean> {
  const webhookUrl = resolveN8nWebhookUrl();

  if (!webhookUrl) {
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
      if (res.status === 404) {
        console.warn(
          `[Telegram Alert] n8n respondió 404 Not Found en [${maskWebhookUrl(webhookUrl)}]. ` +
          `Asegúrese de que el workflow en n8n esté en estado ACTIVO (Active: ON) y que la ruta coincida con N8N_TELEGRAM_WEBHOOK_URL en Coolify.`
        );
      } else {
        console.warn(`[Telegram Alert] n8n respondió con código ${res.status}: ${res.statusText}`);
      }
      return false;
    }

    return true;
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[Telegram Alert] Error no bloqueante al disparar webhook n8n:", msg);
    return false;
  }
}
