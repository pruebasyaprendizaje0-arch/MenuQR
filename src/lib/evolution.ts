/**
 * Evolution API v2.3.7 Integration Helper for MenuQR Pro
 */

// Interfaces para payloads de Evolution API v2.3.7
export interface EvolutionWebhookPayload {
  event: string;
  instance: string;
  destination?: string;
  date_time?: string;
  sender?: string;
  server_url?: string;
  apikey?: string;
  data: {
    key?: {
      remoteJid: string;
      fromMe: boolean;
      id: string;
      participant?: string;
    };
    pushName?: string;
    message?: {
      conversation?: string;
      extendedTextMessage?: {
        text?: string;
      };
      imageMessage?: {
        caption?: string;
      };
      documentMessage?: {
        caption?: string;
      };
      buttonsResponseMessage?: {
        selectedButtonId?: string;
        displayText?: string;
      };
      listResponseMessage?: {
        title?: string;
        singleSelectReply?: {
          selectedRowId?: string;
        };
      };
      [key: string]: any;
    };
    messageType?: string;
    messageTimestamp?: number;
    owner?: string;
    source?: string;
    // Campos para CONNECTION_UPDATE
    state?: string;
    statusReason?: number;
    instance?: string;
    [key: string]: any;
  };
}

export interface ParsedWhatsAppMessage {
  instance: string;
  remoteJid: string;
  phone: string;
  senderName: string;
  fromMe: boolean;
  messageId: string;
  text: string;
  messageType?: string;
  timestamp?: number;
}

export interface SendMessageOptions {
  instance?: string;
  to: string;
  text: string;
  delay?: number;
}

/**
 * Valida la autenticación del Webhook entrante
 * Compara el header 'apikey' o 'x-webhook-secret' enviado por Evolution API con el secret del archivo .env
 */
export function verifyWebhookAuth(headers: Headers): boolean {
  const secret = process.env.EVOLUTION_WEBHOOK_SECRET || process.env.EVOLUTION_API_KEY;
  if (!secret) {
    // Si no se definió secreto en el entorno, logueamos advertencia (para dev)
    console.warn("[Evolution API] ADVERTENCIA: EVOLUTION_WEBHOOK_SECRET no está configurado en .env");
    return true;
  }

  const apiKeyHeader = headers.get("apikey") || headers.get("x-webhook-secret") || headers.get("authorization");
  
  if (!apiKeyHeader) {
    return false;
  }

  // Permite formatos "Bearer TOKEN" o token directo
  const cleanHeader = apiKeyHeader.replace(/^Bearer\s+/i, "").trim();
  return cleanHeader === secret.trim();
}

/**
 * Extrae y normaliza los datos relevantes de un mensaje entrante de Evolution API
 */
export function parseEvolutionPayload(payload: EvolutionWebhookPayload): ParsedWhatsAppMessage | null {
  if (!payload || !payload.data) return null;

  const { data, instance } = payload;
  const key = data.key;

  if (!key || !key.remoteJid) return null;

  const remoteJid = key.remoteJid;
  // Limpia el remoteJid dejando solo el número de teléfono (ej: 593999999999@s.whatsapp.net -> 593999999999)
  const phone = remoteJid.replace(/@.*$/, "");

  // Extraer el contenido del mensaje según el tipo
  const messageObj = data.message;
  let text = "";

  if (messageObj) {
    text =
      messageObj.conversation ||
      messageObj.extendedTextMessage?.text ||
      messageObj.imageMessage?.caption ||
      messageObj.documentMessage?.caption ||
      messageObj.buttonsResponseMessage?.displayText ||
      messageObj.listResponseMessage?.title ||
      "";
  }

  return {
    instance: instance || payload.data.instance || process.env.EVOLUTION_INSTANCE_NAME || "default",
    remoteJid,
    phone,
    senderName: data.pushName || "Cliente",
    fromMe: Boolean(key.fromMe),
    messageId: key.id || "",
    text: text.trim(),
    messageType: data.messageType,
    timestamp: data.messageTimestamp,
  };
}

/**
 * Envía un mensaje de texto plano a través de Evolution API v2.3.7
 */
export async function sendWhatsAppText({
  instance,
  to,
  text,
  delay = 1200,
}: SendMessageOptions): Promise<{ success: boolean; data?: any; error?: string }> {
  const baseUrl = process.env.EVOLUTION_API_URL;
  const apiKey = process.env.EVOLUTION_API_KEY;
  const instanceName = instance || process.env.EVOLUTION_INSTANCE_NAME;

  if (!baseUrl || !apiKey || !instanceName) {
    const missing = [
      !baseUrl && "EVOLUTION_API_URL",
      !apiKey && "EVOLUTION_API_KEY",
      !instanceName && "EVOLUTION_INSTANCE_NAME",
    ]
      .filter(Boolean)
      .join(", ");
    console.error(`[Evolution API Error] Faltan variables de entorno: ${missing}`);
    return { success: false, error: `Configuración incompleta: Faltan variables (${missing})` };
  }

  // Limpiar URL base para asegurar que no tenga slash final
  const cleanBaseUrl = baseUrl.replace(/\/+$/, "");
  const endpoint = `${cleanBaseUrl}/message/sendText/${instanceName}`;

  // Formatear el número de destino (acepta '593999999999' o '593999999999@s.whatsapp.net')
  const formattedNumber = to.includes("@") ? to : `${to}@s.whatsapp.net`;

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: apiKey,
      },
      body: JSON.stringify({
        number: formattedNumber,
        text: text,
        options: {
          delay: delay,
          presence: "composing",
          linkPreview: true,
        },
      }),
    });

    const resData = await response.json();

    if (!response.ok) {
      console.error(`[Evolution API HTTP Error ${response.status}]:`, resData);
      return {
        success: false,
        error: resData.message || resData.error || `HTTP ${response.status}`,
        data: resData,
      };
    }

    return { success: true, data: resData };
  } catch (error: any) {
    console.error("[Evolution API Fetch Exception]:", error);
    return { success: false, error: error.message || "Error al conectar con Evolution API" };
  }
}
