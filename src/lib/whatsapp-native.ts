import makeWASocket, {
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  BufferJSON,
  initAuthCreds,
  proto,
  type AuthenticationCreds,
  type AuthenticationState,
  type SignalDataTypeMap,
  type WASocket,
} from "@whiskeysockets/baileys";
import { Boom } from "@hapi/boom";
import pino from "pino";
import crypto from "crypto";
import { prisma } from "./prisma";
import { 
  getOrSeedRestaurantTemplates, 
  matchTemplate, 
  renderTemplateContent, 
  type TemplateVariables 
} from "./whatsapp-templates";
import { queryWhatsAppAI } from "./whatsapp-ai";

// ==========================================
// 1. HELPERS DE CIFRADO Y SEGURIDAD (AES-256)
// ==========================================
const ENCRYPTION_KEY = crypto
  .createHash("sha256")
  .update(process.env.JWT_SECRET || "menuqr-pro-baileys-session-fallback-secret-32")
  .digest();

function encryptPayload(plainText: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv("aes-256-cbc", ENCRYPTION_KEY, iv);
  let encrypted = cipher.update(plainText, "utf8", "hex");
  encrypted += cipher.final("hex");
  return `${iv.toString("hex")}:${encrypted}`;
}

function decryptPayload(cipherText: string): string {
  if (cipherText.startsWith("{") || cipherText.startsWith("[")) {
    return cipherText;
  }
  const parts = cipherText.split(":");
  if (parts.length !== 2) return cipherText;
  const iv = Buffer.from(parts[0], "hex");
  const encrypted = parts[1];
  const decipher = crypto.createDecipheriv("aes-256-cbc", ENCRYPTION_KEY, iv);
  let decrypted = decipher.update(encrypted, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}

// ==========================================
// 2. PRISMA AUTH STATE ADAPTER PARA BAILEYS
// ==========================================
interface PrismaAuthStateResult {
  state: AuthenticationState;
  saveCreds: () => Promise<void>;
}

async function usePrismaAuthState(restaurantId: string): Promise<PrismaAuthStateResult> {
  const session = await prisma.whatsAppSession.upsert({
    where: { restaurantId },
    create: {
      restaurantId,
      status: "DISCONNECTED",
    },
    update: {},
  });

  // Rehidratar Credenciales
  let creds: AuthenticationCreds;
  if (session.creds) {
    try {
      const decrypted = decryptPayload(session.creds);
      creds = JSON.parse(decrypted, BufferJSON.reviver);
    } catch {
      creds = initAuthCreds();
    }
  } else {
    creds = initAuthCreds();
  }

  // Rehidratar Signal Keys
  let keysStore: Record<string, Record<string, any>> = {};
  if (session.keys) {
    try {
      const decrypted = decryptPayload(session.keys);
      keysStore = JSON.parse(decrypted, BufferJSON.reviver);
    } catch {
      keysStore = {};
    }
  }

  // Debounce para guardar llaves criptográficas sin sobrecargar PostgreSQL
  let saveKeysTimeout: NodeJS.Timeout | null = null;
  const scheduleSaveKeys = () => {
    if (saveKeysTimeout) clearTimeout(saveKeysTimeout);
    saveKeysTimeout = setTimeout(async () => {
      try {
        const serialized = JSON.stringify(keysStore, BufferJSON.replacer);
        const encrypted = encryptPayload(serialized);
        await prisma.whatsAppSession.update({
          where: { restaurantId },
          data: { keys: encrypted },
        });
      } catch (err) {
        console.error(`[WhatsApp Auth] Error persistiendo llaves para ${restaurantId}:`, err);
      }
    }, 1000);
  };

  const saveCreds = async () => {
    try {
      const serialized = JSON.stringify(creds, BufferJSON.replacer);
      const encrypted = encryptPayload(serialized);
      await prisma.whatsAppSession.update({
        where: { restaurantId },
        data: { creds: encrypted },
      });
    } catch (err) {
      console.error(`[WhatsApp Auth] Error guardando credenciales para ${restaurantId}:`, err);
    }
  };

  const get = async <T extends keyof SignalDataTypeMap>(type: T, ids: string[]) => {
    const result: { [id: string]: SignalDataTypeMap[T] } = {};
    const category = keysStore[type] || {};
    for (const id of ids) {
      let val = category[id];
      if (type === "app-state-sync-key" && val) {
        val = proto.Message.AppStateSyncKeyData.fromObject(val);
      }
      if (val) {
        result[id] = val;
      }
    }
    return result;
  };

  const set = async (data: { [category: string]: { [id: string]: any } }) => {
    for (const category in data) {
      if (!keysStore[category]) {
        keysStore[category] = {};
      }
      for (const id in data[category]) {
        const value = data[category][id];
        if (value) {
          keysStore[category][id] = value;
        } else {
          delete keysStore[category][id];
        }
      }
    }
    scheduleSaveKeys();
  };

  const logger = pino({ level: "silent" });

  return {
    state: {
      creds,
      keys: makeCacheableSignalKeyStore({ get, set }, logger),
    },
    saveCreds,
  };
}

// ==========================================
// 3. REGISTRO EN MEMORIA (MULTI-TENANT SOCKET POOL)
// ==========================================
interface SocketsPool {
  sockets: Map<string, WASocket>;
  connectingPromises: Map<string, Promise<WASocket>>;
}

const globalForWA = globalThis as unknown as {
  waPool?: SocketsPool;
};

const pool: SocketsPool = globalForWA.waPool ?? {
  sockets: new Map(),
  connectingPromises: new Map(),
};
globalForWA.waPool = pool;

// ==========================================
// 4. INICIALIZADOR Y GESTOR DE INSTANCIAS
// ==========================================
export async function getOrInitWhatsAppSocket(
  restaurantId: string,
  forceNew = false
): Promise<WASocket> {
  const existingSocket = pool.sockets.get(restaurantId);
  if (existingSocket && !forceNew) {
    return existingSocket;
  }

  const inFlight = pool.connectingPromises.get(restaurantId);
  if (inFlight && !forceNew) {
    return inFlight;
  }

  const connectPromise = (async () => {
    try {
      if (existingSocket) {
        try {
          existingSocket.end(undefined);
        } catch {}
        pool.sockets.delete(restaurantId);
      }

      await prisma.whatsAppSession.upsert({
        where: { restaurantId },
        create: { restaurantId, status: "CONNECTING" },
        update: { status: "CONNECTING" },
      });

      const { state, saveCreds } = await usePrismaAuthState(restaurantId);
      const { version } = await fetchLatestBaileysVersion();

      const sock = makeWASocket({
        version,
        logger: pino({ level: "silent" }),
        printQRInTerminal: false,
        auth: {
          creds: state.creds,
          keys: state.keys,
        },
        browser: ["MenuQR Pro", "Chrome", "1.0.0"],
        syncFullHistory: false, // Optimización crítica de memoria en VPS
        markOnlineOnConnect: true,
      });

      // 1. Guardado automático de credenciales
      sock.ev.on("creds.update", saveCreds);

      // 2. Control de conexión y persistencia del QR en PostgreSQL
      sock.ev.on("connection.update", async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
          await prisma.whatsAppSession.update({
            where: { restaurantId },
            data: {
              qr,
              status: "QR_READY",
            },
          });
        }

        if (connection === "open") {
          const rawId = sock.user?.id || "";
          const cleanPhone = rawId.split(":")[0]?.replace(/\D/g, "") || null;

          pool.sockets.set(restaurantId, sock);
          pool.connectingPromises.delete(restaurantId);

          await prisma.whatsAppSession.update({
            where: { restaurantId },
            data: {
              status: "CONNECTED",
              qr: null,
              phoneNumber: cleanPhone,
            },
          });
        }

        if (connection === "close") {
          pool.sockets.delete(restaurantId);
          pool.connectingPromises.delete(restaurantId);

          const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
          const isLoggedOut = statusCode === DisconnectReason.loggedOut;

          if (isLoggedOut) {
            await prisma.whatsAppSession.update({
              where: { restaurantId },
              data: {
                status: "DISCONNECTED",
                qr: null,
                creds: null,
                keys: null,
                phoneNumber: null,
              },
            });
          } else {
            await prisma.whatsAppSession.update({
              where: { restaurantId },
              data: { status: "CONNECTING" },
            });
            // Reintento automático ante caídas de red temporales
            setTimeout(() => {
              getOrInitWhatsAppSocket(restaurantId).catch(console.error);
            }, 4000);
          }
        }
      });

      // 3. BOT DE MENÚ AUTOMATIZADO (1 AL 5)
      sock.ev.on("messages.upsert", async ({ messages, type }) => {
        if (type !== "notify") return;

        for (const msg of messages) {
          try {
            if (!msg.message || msg.key.fromMe) continue;
            const remoteJid = msg.key.remoteJid;
            if (!remoteJid || remoteJid.endsWith("@g.us") || remoteJid === "status@broadcast") {
              continue; // Ignorar grupos y difusiones
            }

            const text = extractMessageText(msg);
            if (!text) continue;

            // Consultar datos reales del restaurante en PostgreSQL incluyendo campos de IA
            const restaurant = await prisma.restaurant.findUnique({
              where: { id: restaurantId },
              select: {
                id: true,
                name: true,
                slug: true,
                whatsappBotEnabled: true,
                schedule: true,
                localSchedule: true,
                address: true,
                city: true,
                googleBusinessUrl: true,
                bankName: true,
                bankAccountType: true,
                bankAccountNumber: true,
                bankAccountName: true,
                bankAccountDocument: true,
                whatsapp: true,
                aiProvider: true,
                aiApiKey: true,
                aiModel: true,
                aiPromptContext: true,
                aiFallbackEnabled: true,
              },
            });

            if (!restaurant || !restaurant.whatsappBotEnabled) continue;

            console.log(`[WhatsApp Bot] 📩 Mensaje entrante de ${remoteJid} para "${restaurant.name}": "${text}"`);

            // Registrar mensaje entrante en WhatsAppLog
            const cleanPhone = remoteJid.split("@")[0].replace(/\D/g, "");
            const incomingMsgId = msg.key.id || `inc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

            await prisma.whatsAppLog.upsert({
              where: { messageId: incomingMsgId },
              create: {
                messageId: incomingMsgId,
                restaurantId,
                direction: "INCOMING",
                fromMe: false,
                phone: cleanPhone,
                text,
              },
              update: {},
            }).catch(() => {});

            // Helper seguro para enviar respuestas con fallback y log en BD
            const sendBotReply = async (replyText: string) => {
              try {
                try {
                  await sock.sendMessage(remoteJid, { text: replyText }, { quoted: msg });
                } catch {
                  await sock.sendMessage(remoteJid, { text: replyText });
                }

                const outMsgId = `out-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
                await prisma.whatsAppLog.create({
                  data: {
                    messageId: outMsgId,
                    restaurantId,
                    direction: "OUTGOING",
                    fromMe: true,
                    phone: cleanPhone,
                    text: replyText,
                  },
                }).catch(() => {});

                console.log(`[WhatsApp Bot] 🚀 Respuesta enviada a ${remoteJid}: "${replyText.substring(0, 45)}..."`);
              } catch (sendErr) {
                console.error(`[WhatsApp Bot] ❌ Error enviando mensaje a ${remoteJid}:`, sendErr);
              }
            };

            // 1. Obtener las plantillas activas del restaurante (o crearlas por defecto)
            const templates = await getOrSeedRestaurantTemplates(restaurantId);

            const vars: TemplateVariables = {
              nombre: restaurant.name,
              link_menu: `https://menuqr.ubicame.cc/${restaurant.slug}`,
              horario: restaurant.localSchedule || restaurant.schedule || "Lunes a Domingo de 09:00 a 22:00",
              direccion: `${restaurant.address || "Local principal"}${restaurant.city ? `, ${restaurant.city}` : ""}`,
              maps: restaurant.googleBusinessUrl || "Consultar en el local",
              datos_banco: restaurant.bankName && restaurant.bankAccountNumber
                ? `• *Banco:* ${restaurant.bankName}\n• *Tipo de Cuenta:* ${restaurant.bankAccountType || "Ahorros"}\n• *Número:* ${restaurant.bankAccountNumber}${restaurant.bankAccountName ? `\n• *Titular:* ${restaurant.bankAccountName}` : ""}${restaurant.bankAccountDocument ? `\n• *C.I. / RUC:* ${restaurant.bankAccountDocument}` : ""}`
                : "Por favor consulta los datos de cuenta actualizados directamente con nuestro personal en el local.",
            };

            // 2. Intentar coincidencia con las plantillas configuradas por el restaurante
            const matched = matchTemplate(text, templates);
            if (matched) {
              const reply = renderTemplateContent(matched.content, vars);
              await sendBotReply(reply);
              continue;
            }

            // 3. Cascada a IA (si el negocio configuró su propia API Key y habilitó IA)
            const aiResponse = await queryWhatsAppAI(restaurant, text);
            if (aiResponse) {
              await sendBotReply(aiResponse);
              continue;
            }

            // 4. Si no hubo coincidencia y no hay IA disponible, enviar plantilla de Fallback o Bienvenida
            const fallbackTmpl = templates.find((t) => t.key === "fallback") || templates.find((t) => t.key === "welcome");
            if (fallbackTmpl) {
              const reply = renderTemplateContent(fallbackTmpl.content, vars);
              await sendBotReply(reply);
              continue;
            }
          } catch (itemErr) {
            console.error(`[WhatsApp Bot] Error procesando mensaje individual:`, itemErr);
          }
        }
      });

      pool.sockets.set(restaurantId, sock);
      return sock;
    } finally {
      pool.connectingPromises.delete(restaurantId);
    }
  })();

  pool.connectingPromises.set(restaurantId, connectPromise);
  return connectPromise;
}

// Extraer texto desempaquetando mensajes efímeros / temporales / vistas únicas / botones
export function extractMessageText(msg: proto.IWebMessageInfo): string {
  const m = msg.message;
  if (!m) return "";

  const actual: any =
    m.ephemeralMessage?.message ||
    m.viewOnceMessage?.message ||
    m.viewOnceMessageV2?.message ||
    m.documentWithCaptionMessage?.message ||
    m;

  return (
    actual.conversation ||
    actual.extendedTextMessage?.text ||
    actual.imageMessage?.caption ||
    actual.videoMessage?.caption ||
    actual.buttonsResponseMessage?.selectedButtonId ||
    actual.templateButtonReplyMessage?.selectedId ||
    actual.listResponseMessage?.singleSelectReply?.selectedRowId ||
    ""
  ).trim();
}

// ==========================================
// 5. MÉTODOS DE CONSULTA Y AUTO-RECONEXIÓN
// ==========================================
export function isWhatsAppSocketActive(restaurantId: string): boolean {
  return pool.sockets.has(restaurantId);
}

export async function initAllConnectedWhatsAppSessions(): Promise<void> {
  try {
    const sessions = await prisma.whatsAppSession.findMany({
      where: {
        creds: { not: null },
        restaurant: {
          whatsappBotEnabled: true,
        },
      },
      select: { restaurantId: true },
    });

    if (sessions.length > 0) {
      console.log(`[WhatsApp Auto-Init] Rehidratando ${sessions.length} sesión(es) conectada(s) de Baileys...`);
      for (const s of sessions) {
        if (!pool.sockets.has(s.restaurantId)) {
          getOrInitWhatsAppSocket(s.restaurantId).catch((err) => {
            console.error(`[WhatsApp Auto-Init] Error conectando socket para ${s.restaurantId}:`, err);
          });
        }
      }
    }
  } catch (err) {
    console.error("[WhatsApp Auto-Init] Error rehidratando sesiones:", err);
  }
}

// ==========================================
// 6. MÉTODOS DE DESCONEXIÓN Y ENVÍO EXTERNO
// ==========================================
export async function disconnectWhatsApp(restaurantId: string): Promise<void> {
  const sock = pool.sockets.get(restaurantId);
  if (sock) {
    try {
      await sock.logout();
    } catch {
      sock.end(undefined);
    }
    pool.sockets.delete(restaurantId);
  }
  pool.connectingPromises.delete(restaurantId);

  await prisma.whatsAppSession.update({
    where: { restaurantId },
    data: {
      status: "DISCONNECTED",
      qr: null,
      creds: null,
      keys: null,
      phoneNumber: null,
    },
  });
}

export async function sendWhatsAppMessage(
  restaurantId: string,
  toPhone: string,
  text: string
): Promise<boolean> {
  try {
    const sock = await getOrInitWhatsAppSocket(restaurantId);
    if (!sock) return false;
    const cleanNumber = toPhone.replace(/\D/g, "");
    const jid = cleanNumber.includes("@s.whatsapp.net")
      ? cleanNumber
      : `${cleanNumber}@s.whatsapp.net`;
    await sock.sendMessage(jid, { text });
    return true;
  } catch (err) {
    console.error(`[WhatsApp Send] Error enviando mensaje para ${restaurantId}:`, err);
    return false;
  }
}
