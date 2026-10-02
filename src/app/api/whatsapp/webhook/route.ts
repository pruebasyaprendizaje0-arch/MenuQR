import { POST as handleWhatsappWebhook } from "@/app/api/webhook/whatsapp/route";

/**
 * Endpoint de alias para compatibilidad con la ruta /api/whatsapp/webhook
 */
export async function POST(req: any) {
  return handleWhatsappWebhook(req);
}
