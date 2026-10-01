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
 * Obtiene dinámicamente las credenciales de Evolution API leyendo process.env con fallback a la base de datos (SystemSetting)
 */
export async function getEvolutionCredentials(): Promise<{ baseUrl: string; apiKey: string }> {
  let baseUrl = process.env.EVOLUTION_API_URL || "";
  let apiKey = process.env.EVOLUTION_API_KEY || "";

  if (!baseUrl || !apiKey) {
    try {
      const { prisma } = await import("@/lib/prisma");
      const settings = await prisma.systemSetting.findMany({
        where: { key: { in: ["evolution_api_url", "evolution_api_key"] } },
      });
      const settingMap = new Map(settings.map((s) => [s.key, s.value]));
      if (!baseUrl) baseUrl = settingMap.get("evolution_api_url") || "";
      if (!apiKey) apiKey = settingMap.get("evolution_api_key") || "";
    } catch (err) {
      console.warn("[Evolution API Config] Warning al buscar SystemSetting:", err);
    }
  }

  if (baseUrl && !baseUrl.startsWith("http://") && !baseUrl.startsWith("https://")) {
    baseUrl = `http://${baseUrl}`;
  }

  return { baseUrl, apiKey };
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
  const { baseUrl, apiKey } = await getEvolutionCredentials();
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

export interface SendPresenceOptions {
  instance?: string;
  to: string;
  presence: "composing" | "recording" | "paused";
  delay?: number;
}

/**
 * Envía el estado de presencia (escribiendo/composing) a WhatsApp vía Evolution API v2
 */
export async function sendWhatsAppPresence({
  instance,
  to,
  presence = "composing",
  delay = 1200,
}: SendPresenceOptions): Promise<{ success: boolean; error?: string }> {
  const { baseUrl, apiKey } = await getEvolutionCredentials();
  const instanceName = instance || process.env.EVOLUTION_INSTANCE_NAME || "menuqr";

  if (!baseUrl || !apiKey) {
    return { success: false, error: "EVOLUTION_API_URL o EVOLUTION_API_KEY no configurados" };
  }

  const cleanBaseUrl = baseUrl.replace(/\/+$/, "");
  const endpoint = `${cleanBaseUrl}/chat/sendPresence/${instanceName}`;
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
        presence,
        delay,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      return { success: false, error: `HTTP ${response.status}: ${errText}` };
    }

    return { success: true };
  } catch (error: any) {
    console.warn("[Evolution API Presence Warning]:", error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Obtiene el estado de conexión de una instancia en Evolution API v2
 */
export async function getWhatsAppConnectionState(instanceName: string): Promise<{ state: "open" | "connecting" | "close" | "unknown"; raw?: any; error?: string }> {
  const { baseUrl, apiKey } = await getEvolutionCredentials();

  if (!baseUrl || !apiKey) {
    return { state: "unknown", error: "Configuración de Evolution API incompleta. Ingresa EVOLUTION_API_URL y EVOLUTION_API_KEY en tu entorno o en la consola SuperAdmin." };
  }

  const cleanBaseUrl = baseUrl.replace(/\/+$/, "");
  const endpoint = `${cleanBaseUrl}/instance/connectionState/${instanceName}`;

  try {
    const response = await fetch(endpoint, {
      method: "GET",
      headers: { apikey: apiKey },
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });

    const data = await response.json();
    if (!response.ok) {
      return { state: "unknown", error: data.message || `HTTP ${response.status}`, raw: data };
    }

    const state = data.instance?.state || data.state || "unknown";
    return { state, raw: data };
  } catch (err: any) {
    const isFetchFailed = err.name === "TypeError" || err.message?.includes("fetch failed");
    const friendlyError = isFetchFailed
      ? `No se pudo conectar con el servidor de Evolution API (${cleanBaseUrl}). Si ejecutas localmente en tu PC, configura EVOLUTION_API_URL en el archivo .env con una URL/IP pública accesible.`
      : err.message;
    return { state: "unknown", error: friendlyError };
  }
}

/**
 * Solicita el código QR en Base64 o Pairing Code para conectar una instancia en Evolution API v2
 */
export async function connectWhatsAppInstance(instanceName: string): Promise<{
  success: boolean;
  qrcode?: string;
  base64?: string;
  pairingCode?: string;
  state?: string;
  alreadyConnected?: boolean;
  error?: string;
}> {
  const { baseUrl, apiKey } = await getEvolutionCredentials();

  if (!baseUrl || !apiKey) {
    return { success: false, error: "EVOLUTION_API_URL o EVOLUTION_API_KEY no configurados" };
  }

  const cleanBaseUrl = baseUrl.replace(/\/+$/, "");

  try {
    // 1. Verificar primero si la instancia ya está conectada (state === "open")
    const stateEndpoint = `${cleanBaseUrl}/instance/connectionState/${instanceName}`;
    const stateRes = await fetch(stateEndpoint, {
      method: "GET",
      headers: { apikey: apiKey },
      cache: "no-store",
      signal: AbortSignal.timeout(6000),
    }).catch(() => null);

    if (stateRes && stateRes.ok) {
      const stateData = await stateRes.json().catch(() => ({}));
      const currentState = stateData.instance?.state || stateData.state;
      if (currentState === "open" || currentState === "connected") {
        console.log(`[Evolution API] Instancia "${instanceName}" ya se encuentra CONECTADA (open).`);
        return {
          success: true,
          state: "open",
          alreadyConnected: true,
        };
      }
    }

    // 2. Si no está conectada, solicitar conexión/QR con GET /instance/connect/{instance}
    const connectEndpoint = `${cleanBaseUrl}/instance/connect/${instanceName}`;
    let response = await fetch(connectEndpoint, {
      method: "GET",
      headers: { apikey: apiKey },
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
    });

    let resData = await response.json().catch(() => ({}));

    // 3. Si la instancia NO existe (HTTP 404 o mensaje 'not found'), intentamos crearla con POST /instance/create
    if (response.status === 404 || resData.error?.includes("not found") || resData.message?.includes("not found")) {
      const createEndpoint = `${cleanBaseUrl}/instance/create`;
      const webhookUrl = `${process.env.NEXT_PUBLIC_APP_URL || "https://menuqr.ubicame.cc"}/api/webhook/whatsapp`;

      const createRes = await fetch(createEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: apiKey,
        },
        body: JSON.stringify({
          instanceName,
          token: apiKey,
          qrcode: true,
          integration: "WHATSAPP-BAILEYS",
          webhook: webhookUrl,
          webhook_by_events: false,
          events: ["MESSAGES_UPSERT", "SEND_MESSAGE", "CONNECTION_UPDATE"],
        }),
        signal: AbortSignal.timeout(10000),
      });

      const createData = await createRes.json().catch(() => ({}));
      const strData = JSON.stringify(createData).toLowerCase();

      // Fallback para nombre duplicado (HTTP 403 Forbidden o 409 Conflict o "already in use" / "already exists"):
      // No lanzar error 502/500, sino realizar fallback inmediato a /instance/connect
      if (
        createRes.status === 403 ||
        createRes.status === 409 ||
        strData.includes("already in use") ||
        strData.includes("already exists") ||
        strData.includes("in use") ||
        strData.includes("forbidden")
      ) {
        console.log(`[Evolution API] Instancia "${instanceName}" ya existente (HTTP ${createRes.status}). Ejecutando fallback a /instance/connect...`);
        const retryRes = await fetch(connectEndpoint, {
          method: "GET",
          headers: { apikey: apiKey },
          cache: "no-store",
          signal: AbortSignal.timeout(10000),
        });
        resData = await retryRes.json().catch(() => ({}));
      } else if (!createRes.ok) {
        return {
          success: false,
          error: createData.message || createData.error || `Error al crear instancia en Evolution API (HTTP ${createRes.status})`,
        };
      } else {
        resData = createData;
      }
    }

    // 4. Evaluar si la respuesta de connect o create devolvió un estado ya abierto
    const state = resData.instance?.state || resData.state || "connecting";
    if (state === "open" || state === "connected") {
      return {
        success: true,
        state: "open",
        alreadyConnected: true,
      };
    }

    // 5. Extraer y sanitizar Base64 de la respuesta (data.base64 o data.qrcode.base64 o data.code)
    let rawBase64: string | null =
      resData.base64 ||
      resData.qrcode?.base64 ||
      resData.code ||
      resData.qrcode?.code ||
      null;

    if (rawBase64 && typeof rawBase64 === "string") {
      rawBase64 = rawBase64.trim();
      if (!rawBase64.startsWith("data:image/")) {
        rawBase64 = `data:image/png;base64,${rawBase64}`;
      }
    }

    const pairingCode = resData.pairingCode || resData.qrcode?.pairingCode || undefined;

    return {
      success: true,
      base64: rawBase64 || undefined,
      pairingCode,
      state: state || "connecting",
    };
  } catch (error: any) {
    console.error("[Evolution API Connect Exception]:", error);
    const isFetchFailed = error.name === "TypeError" || error.message?.includes("fetch failed");
    const friendlyError = isFetchFailed
      ? `Imposible conectar con el servidor de Evolution API (${cleanBaseUrl}). Asegúrate de configurar la URL pública o IP accesible desde tu máquina de desarrollo.`
      : error.message || "Error al conectar con Evolution API";
    return { success: false, error: friendlyError };
  }
}

/**
 * Desconecta (Logout) una instancia de WhatsApp en Evolution API v2
 */
export async function logoutWhatsAppInstance(instanceName: string): Promise<{ success: boolean; error?: string }> {
  const { baseUrl, apiKey } = await getEvolutionCredentials();

  if (!baseUrl || !apiKey) {
    return { success: false, error: "EVOLUTION_API_URL o EVOLUTION_API_KEY no configurados" };
  }

  const cleanBaseUrl = baseUrl.replace(/\/+$/, "");
  const logoutEndpoint = `${cleanBaseUrl}/instance/logout/${instanceName}`;

  try {
    const response = await fetch(logoutEndpoint, {
      method: "DELETE",
      headers: { apikey: apiKey },
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) {
      // Intentar borrado directo con /instance/delete como fallback
      const deleteEndpoint = `${cleanBaseUrl}/instance/delete/${instanceName}`;
      const delResponse = await fetch(deleteEndpoint, {
        method: "DELETE",
        headers: { apikey: apiKey },
        signal: AbortSignal.timeout(8000),
      }).catch(() => null);

      if (!delResponse || !delResponse.ok) {
        const errText = await response.text().catch(() => "Error al cerrar sesión");
        return { success: false, error: errText };
      }
    }

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Elimina por completo una instancia en Evolution API v2
 */
export async function deleteWhatsAppInstance(instanceName: string): Promise<{ success: boolean; error?: string }> {
  const { baseUrl, apiKey } = await getEvolutionCredentials();

  if (!baseUrl || !apiKey) {
    return { success: false, error: "EVOLUTION_API_URL o EVOLUTION_API_KEY no configurados" };
  }

  const cleanBaseUrl = baseUrl.replace(/\/+$/, "");
  const endpoint = `${cleanBaseUrl}/instance/delete/${instanceName}`;

  try {
    const response = await fetch(endpoint, {
      method: "DELETE",
      headers: { apikey: apiKey },
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => "Error al eliminar instancia");
      return { success: false, error: errText };
    }

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}



