/**
 * Evolution API v2.3.7 Integration Helper for MenuQR Pro
 */

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
  isGroup: boolean;
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
 * Valida la autenticación del Webhook de forma flexible y tolerante.
 * 
 * Regla de Oro:
 * - Si EVOLUTION_STRICT_AUTH no es explícitamente "true", SIEMPRE retorna { valid: true },
 *   logueando advertencias detalladas en consola para evitar cualquier error 401 durante pruebas.
 * - Si EVOLUTION_STRICT_AUTH === "true", exige coincidencia exacta de 'apikey' o 'x-webhook-secret'.
 */
export function verifyWebhookAuth(headers: Headers): { valid: boolean; reason?: string } {
  const webhookSecret = process.env.EVOLUTION_WEBHOOK_SECRET;
  const apiKeySecret = process.env.EVOLUTION_API_KEY;
  const isStrict = String(process.env.EVOLUTION_STRICT_AUTH).toLowerCase() === "true";

  // Buscar el header de autenticación en múltiples variaciones conocidas de Evolution API
  const incomingHeaderRaw =
    headers.get("apikey") ||
    headers.get("x-webhook-secret") ||
    headers.get("x-api-key") ||
    headers.get("x-evolution-apikey") ||
    headers.get("authorization");

  const incomingClean = incomingHeaderRaw ? incomingHeaderRaw.replace(/^Bearer\s+/i, "").trim() : null;

  // Registrar en logs para trazabilidad
  console.log(`[Evolution Auth Check] Strictly Enforced: ${isStrict} | Header Recibido: ${incomingClean ? incomingClean.substring(0, 5) + "***" : "AUSENTE"}`);

  // Si no hay ningún secreto configurado en el entorno
  if (!webhookSecret && !apiKeySecret) {
    const msg = "Ni EVOLUTION_WEBHOOK_SECRET ni EVOLUTION_API_KEY están configurados en el archivo .env.";
    console.warn(`[Evolution Auth Warning] ${msg} Permitiendo petición.`);
    return { valid: true, reason: "No secrets configured in env" };
  }

  // Verificar si coincide con alguno de los secretos de entorno válidos
  const matchesWebhookSecret = webhookSecret ? incomingClean === webhookSecret.trim() : false;
  const matchesApiKeySecret = apiKeySecret ? incomingClean === apiKeySecret.trim() : false;

  const isMatched = matchesWebhookSecret || matchesApiKeySecret;

  if (isMatched) {
    console.log("[Evolution Auth Success] ✅ Cabecera de autenticación validada correctamente.");
    return { valid: true };
  }

  // Si no hubo coincidencia:
  const reasonText = !incomingClean
    ? "Header de autenticación (apikey / x-webhook-secret) ausente en la petición HTTP."
    : `Header recibido ('${incomingClean.substring(0, 4)}***') no coincide con los secretos del entorno.`;

  if (isStrict) {
    console.warn(`[Evolution Auth Blocked 401] ❌ Petición rechazada debido a EVOLUTION_STRICT_AUTH=true. Razón: ${reasonText}`);
    return { valid: false, reason: reasonText };
  }

  // MODO PERMISIVO (Bypass por defecto cuando strict no es true)
  console.warn(`[Evolution Auth Permissive Bypass] ⚠️ ${reasonText} PERMITIENDO acceso para pruebas en producción (EVOLUTION_STRICT_AUTH=false).`);
  return { valid: true, reason: `Permissive Mode: ${reasonText}` };
}

/**
 * Extrae y normaliza los datos de un mensaje entrante de Evolution API v2.3.7
 */
export function parseEvolutionPayload(payload: EvolutionWebhookPayload): ParsedWhatsAppMessage | null {
  if (!payload || !payload.data) return null;

  const { data, instance } = payload;
  const key = data.key;

  if (!key || !key.remoteJid) return null;

  const remoteJid = key.remoteJid;
  const isGroup = remoteJid.endsWith("@g.us");
  const phone = remoteJid.replace(/@.*$/, "");

  // Extraer el contenido del mensaje contemplando todos los subtipos de la v2.3.7
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
    instance: instance || payload.data.instance || process.env.EVOLUTION_INSTANCE_NAME || "menuqr",
    remoteJid,
    phone,
    senderName: data.pushName || "Cliente WhatsApp",
    fromMe: Boolean(key.fromMe),
    isGroup,
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
  const instanceName = instance || process.env.EVOLUTION_INSTANCE_NAME || "menuqr";

  if (!baseUrl || !apiKey) {
    const missing = [!baseUrl && "EVOLUTION_API_URL", !apiKey && "EVOLUTION_API_KEY"].filter(Boolean).join(", ");
    console.error(`[Evolution API Client Error] Faltan variables de entorno: ${missing}`);
    return { success: false, error: `Configuración incompleta: ${missing}` };
  }

  const cleanBaseUrl = baseUrl.replace(/\/+$/, "");
  const endpoint = `${cleanBaseUrl}/message/sendText/${instanceName}`;
  const formattedNumber = to.includes("@") ? to : `${to}@s.whatsapp.net`;

  console.log(`[Evolution API Client] Enviando mensaje a ${formattedNumber} via ${endpoint}...`);

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
      console.error(`[Evolution API Client HTTP Error ${response.status}]:`, JSON.stringify(resData, null, 2));
      return {
        success: false,
        error: resData.message || resData.error || `HTTP ${response.status}`,
        data: resData,
      };
    }

    console.log(`[Evolution API Client Success] Mensaje enviado a ${formattedNumber}. ResId: ${resData.key?.id || "N/A"}`);
    return { success: true, data: resData };
  } catch (error: any) {
    console.error("[Evolution API Client Exception]:", error);
    return { success: false, error: error.message || "Error al conectar con Evolution API" };
  }
}
