/**
 * Utilidad de alertas centralizadas a Telegram vía webhook de n8n para SuperAdmin.
 * Despacho asíncrono no bloqueante (fire-and-forget) para proteger la latencia y rendimiento de Next.js.
 */

export interface AlertaSuperAdmin {
  mensaje: string;
  cliente?: string;
}

export async function notificarSuperAdmin({
  mensaje,
  cliente = "Sistema Ubícame",
}: AlertaSuperAdmin): Promise<void> {
  const webhookUrl =
    process.env.N8N_SUPERADMIN_WEBHOOK_URL ||
    "https://n8n.ubicame.cc/webhook/alertas-superadmin";

  try {
    // Despacho asíncrono no bloqueante (fire-and-forget)
    fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mensaje, cliente }),
    }).catch((err) => console.error("[Telegram Alert Webhook Error]:", err));
  } catch (error) {
    console.error("[Telegram Alert Error]:", error);
  }
}

