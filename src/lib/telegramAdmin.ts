/**
 * Utilidad de alertas centralizadas a Telegram vía webhook de n8n para SuperAdmin.
 * Despacho asíncrono no bloqueante (fire-and-forget) para proteger la latencia y rendimiento de Next.js.
 */

export interface AlertaSuperAdmin {
  mensaje: string;
  cliente?: string;
}

function resolveSuperAdminWebhookUrl(): string | null {
  const raw =
    process.env.N8N_SUPERADMIN_WEBHOOK_URL ||
    process.env.N8N_TELEGRAM_WEBHOOK_URL ||
    "https://n8n.ubicame.cc/webhook/alertas-superadmin";

  if (!raw || typeof raw !== "string") return null;
  let clean = raw.trim();
  if (!clean || clean.toLowerCase() === "disabled" || clean.toLowerCase() === "none") {
    return null;
  }

  if (clean.includes("/webhook-test/")) {
    clean = clean.replace("/webhook-test/", "/webhook/");
  }

  return clean;
}

export async function notificarSuperAdmin({
  mensaje,
  cliente = "Sistema Ubícame",
}: AlertaSuperAdmin): Promise<void> {
  const webhookUrl = resolveSuperAdminWebhookUrl();
  if (!webhookUrl) return;

  try {
    // Despacho asíncrono no bloqueante (fire-and-forget)
    fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mensaje, cliente }),
      signal: AbortSignal.timeout(3500),
    })
      .then((res) => {
        if (!res.ok && res.status === 404) {
          console.warn(
            `[Telegram Admin Alert] n8n respondió 404 Not Found. Verifique que el workflow en n8n esté ACTIVO (N8N_SUPERADMIN_WEBHOOK_URL).`
          );
        }
      })
      .catch((err) => {
        // Silencioso no bloqueante
      });
  } catch (error) {
    // Silencioso no bloqueante
  }
}

