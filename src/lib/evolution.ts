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
  let baseUrl = process.env.EVOLUTION_INTERNAL_URL || process.env.EVOLUTION_API_URL || "http://10.0.2.4:8080";
  let apiKey = process.env.EVOLUTION_API_KEY || "";

  if (!apiKey) {
    try {
      const { prisma } = await import("@/lib/prisma");
      const setting = await prisma.systemSetting.findUnique({
        where: { key: "evolution_api_key" },
      });
      if (setting?.value) apiKey = setting.value;
    } catch (err) {
      console.warn("[Evolution API Config] Warning al buscar SystemSetting:", err);
    }
  }

  // Sanitizar URL eliminando prefijos erróneos o slashes finales
  baseUrl = baseUrl.replace(/^public:/i, "").trim().replace(/\/+$/, "");
  if (!baseUrl.startsWith("http://") && !baseUrl.startsWith("https://")) {
    baseUrl = `http://${baseUrl}`;
  }

  return { baseUrl, apiKey };
}

/**
 * Realiza peticiones HTTP directas y ultrarrápidas a Evolution API por su IP interna en la red Docker.
 */
export async function fetchEvolutionRequest(
  path: string,
  options: {
    method?: string;
    body?: any;
    timeoutMs?: number;
  } = {}
): Promise<{ ok: boolean; status: number; data: any; error?: string }> {
  const { baseUrl, apiKey } = await getEvolutionCredentials();
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  const method = options.method || "GET";
  const timeoutMs = options.timeoutMs || 8000;

  const targetUrl = `${baseUrl}${cleanPath}`;

  try {
    const headers: Record<string, string> = {
      apikey: apiKey,
    };
    if (options.body) {
      headers["Content-Type"] = "application/json";
    }

    const res = await fetch(targetUrl, {
      method,
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
      signal: AbortSignal.timeout(timeoutMs),
    });

    const resData = await res.json().catch(() => ({}));
    return {
      ok: res.ok,
      status: res.status,
      data: resData,
      error: res.ok ? undefined : (resData.message || resData.error || `HTTP ${res.status}`),
    };
  } catch (err: any) {
    const errMsg = err.message || String(err);
    console.error(`[Evolution Fetch Error] ${targetUrl} → ${errMsg}`);

    // Fallback de contingencia directa a la IP fija 10.0.2.4:8080 si la URL configurada falló
    if (!targetUrl.includes("10.0.2.4:8080")) {
      try {
        const fallbackUrl = `http://10.0.2.4:8080${cleanPath}`;
        const headers: Record<string, string> = { apikey: apiKey };
        if (options.body) headers["Content-Type"] = "application/json";

        const res = await fetch(fallbackUrl, {
          method,
          headers,
          body: options.body ? JSON.stringify(options.body) : undefined,
          signal: AbortSignal.timeout(timeoutMs),
        });
        const resData = await res.json().catch(() => ({}));
        return {
          ok: res.ok,
          status: res.status,
          data: resData,
          error: res.ok ? undefined : (resData.message || resData.error || `HTTP ${res.status}`),
        };
      } catch (fallbackErr: any) {
        console.error(`[Evolution Fetch Fallback Error] http://10.0.2.4:8080${cleanPath} → ${fallbackErr.message}`);
      }
    }

    return { ok: false, status: 0, data: null, error: errMsg };
  }
}

/**
 * Configura o sincroniza el Webhook y ajustes de recepción en Evolution API para que los mensajes entrantes lleguen al servidor
 */
export async function ensureWhatsAppWebhook(instanceName: string): Promise<{ success: boolean; data?: any; error?: string }> {
  const webhookUrl = `${process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || "https://ubicame.cc"}/api/webhook/whatsapp`;

  console.log(`[Evolution API] Sincronizando Webhook para '${instanceName}' -> ${webhookUrl}`);

  // 1. Configurar Webhook
  const webhookRes = await fetchEvolutionRequest(`/webhook/set/${instanceName}`, {
    method: "POST",
    body: {
      webhook: {
        enabled: true,
        url: webhookUrl,
        byEvents: false,
        base64: false,
        events: [
          "MESSAGES_UPSERT",
          "MESSAGES_UPDATE",
          "SEND_MESSAGE",
          "CONNECTION_UPDATE",
        ],
      },
    },
    timeoutMs: 6000,
  });

  // 2. Configurar Ajustes de Instancia (Auto-lectura y Always Online)
  await fetchEvolutionRequest(`/settings/set/${instanceName}`, {
    method: "POST",
    body: {
      rejectCall: false,
      msgCall: "",
      groupsIgnore: true,
      alwaysOnline: true,
      readMessages: true,
      readStatus: false,
      syncFullHistory: false,
    },
    timeoutMs: 5000,
  }).catch(() => {});

  if (!webhookRes.ok) {
    return {
      success: false,
      error: webhookRes.error || webhookRes.data?.message || `Error configurando webhook (HTTP ${webhookRes.status})`,
      data: webhookRes.data,
    };
  }

  return { success: true, data: webhookRes.data };
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
  const instanceName = instance || process.env.EVOLUTION_INSTANCE_NAME || "menuqr";
  const formattedNumber = to.includes("@") ? to : `${to}@s.whatsapp.net`;

  console.log(`[Evolution API Client] Enviando mensaje a ${formattedNumber} (Instancia: ${instanceName})...`);

  const result = await fetchEvolutionRequest(`/message/sendText/${instanceName}`, {
    method: "POST",
    body: {
      number: formattedNumber,
      text: text,
      options: {
        delay: delay,
        presence: "composing",
        linkPreview: true,
      },
    },
    timeoutMs: 7000,
  });

  if (!result.ok) {
    console.error(`[Evolution API Client Error ${result.status}]:`, result.error || result.data);
    return {
      success: false,
      error: result.data?.message || result.error || `HTTP ${result.status}`,
      data: result.data,
    };
  }

  console.log(`[Evolution API Client Success] Mensaje enviado a ${formattedNumber}. ResId: ${result.data?.key?.id || "N/A"}`);
  return { success: true, data: result.data };
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
  try {
    const instanceName = instance || process.env.EVOLUTION_INSTANCE_NAME || "menuqr";
    const formattedNumber = to.includes("@") ? to : `${to}@s.whatsapp.net`;

    const result = await fetchEvolutionRequest(`/chat/sendPresence/${instanceName}`, {
      method: "POST",
      body: {
        number: formattedNumber,
        presence,
        delay,
      },
      timeoutMs: 3000,
    });

    return { success: result.ok, error: result.error };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Obtiene el estado de conexión de una instancia en Evolution API v2
 */
export async function getWhatsAppConnectionState(instanceName: string): Promise<{ state: "open" | "connecting" | "close" | "unknown"; raw?: any; error?: string }> {
  const result = await fetchEvolutionRequest(`/instance/connectionState/${instanceName}`, {
    method: "GET",
    timeoutMs: 4000,
  });

  if (!result.ok) {
    return { state: "unknown", error: result.error || `HTTP ${result.status}` };
  }

  const state = result.data?.instance?.state || result.data?.state || "unknown";
  return { state, raw: result.data };
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
  const { apiKey } = await getEvolutionCredentials();

  if (!apiKey) {
    return { success: false, error: "EVOLUTION_API_KEY no configurada" };
  }

  try {
    // 1. Solicitar conexión/QR directamente con GET /instance/connect/{instance}
    let response = await fetchEvolutionRequest(`/instance/connect/${instanceName}`, {
      method: "GET",
      timeoutMs: 6000,
    });

    let resData = response.data || {};

    // 2. Si la instancia NO existe (HTTP 404 o mensaje 'not found'), intentamos crearla con POST /instance/create
    if (response.status === 404 || resData.error?.includes("not found") || resData.message?.includes("not found")) {
      const webhookUrl = `${process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || "https://ubicame.cc"}/api/webhook/whatsapp`;

      const createRes = await fetchEvolutionRequest(`/instance/create`, {
        method: "POST",
        body: {
          instanceName,
          token: apiKey,
          qrcode: true,
          integration: "WHATSAPP-BAILEYS",
          webhook: webhookUrl,
          webhook_by_events: false,
          events: ["MESSAGES_UPSERT", "SEND_MESSAGE", "CONNECTION_UPDATE"],
        },
        timeoutMs: 10000,
      });

      const createData = createRes.data || {};
      const strData = JSON.stringify(createData).toLowerCase();

      if (
        createRes.status === 403 ||
        createRes.status === 409 ||
        strData.includes("already in use") ||
        strData.includes("already exists") ||
        strData.includes("in use") ||
        strData.includes("forbidden")
      ) {
        console.log(`[Evolution API] Instancia "${instanceName}" ya existente (HTTP ${createRes.status}). Ejecutando fallback a /instance/connect...`);
        const retryRes = await fetchEvolutionRequest(`/instance/connect/${instanceName}`, {
          method: "GET",
          timeoutMs: 8000,
        });
        resData = retryRes.data || {};
      } else if (!createRes.ok) {
        return {
          success: false,
          error: createData.message || createData.error || `Error al crear instancia en Evolution API (HTTP ${createRes.status})`,
        };
      } else {
        resData = createData;
      }
    }

    // 3. Evaluar si la respuesta de connect o create devolvió un estado ya abierto
    const state = resData.instance?.state || resData.state || "connecting";
    if (state === "open" || state === "connected") {
      ensureWhatsAppWebhook(instanceName).catch((err) => {
        console.warn("[Evolution API Webhook Auto-Sync Warning]:", err);
      });
      return {
        success: true,
        state: "open",
        alreadyConnected: true,
      };
    }

    // 4. Extraer y sanitizar Base64 de la respuesta
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
    return { success: false, error: error.message || "Error al conectar con Evolution API" };
  }
}

/**
 * Desconecta (Logout) una instancia de WhatsApp en Evolution API v2
 */
export async function logoutWhatsAppInstance(instanceName: string): Promise<{ success: boolean; error?: string }> {
  const res = await fetchEvolutionRequest(`/instance/logout/${instanceName}`, {
    method: "DELETE",
    timeoutMs: 8000,
  });

  if (!res.ok) {
    const delRes = await fetchEvolutionRequest(`/instance/delete/${instanceName}`, {
      method: "DELETE",
      timeoutMs: 8000,
    });
    if (!delRes.ok) {
      return { success: false, error: res.error || "Error al cerrar sesión" };
    }
  }

  return { success: true };
}

/**
 * Elimina por completo una instancia en Evolution API v2
 */
export async function deleteWhatsAppInstance(instanceName: string): Promise<{ success: boolean; error?: string }> {
  const res = await fetchEvolutionRequest(`/instance/delete/${instanceName}`, {
    method: "DELETE",
    timeoutMs: 8000,
  });

  if (!res.ok) {
    return { success: false, error: res.error || "Error al eliminar instancia" };
  }

  return { success: true };
}



