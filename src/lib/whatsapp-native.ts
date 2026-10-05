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
          if (!msg.message || msg.key.fromMe) continue;
          const remoteJid = msg.key.remoteJid;
          if (!remoteJid || remoteJid.endsWith("@g.us") || remoteJid === "status@broadcast") {
            continue; // Ignorar grupos y difusiones
          }

          const text = (
            msg.message.conversation ||
            msg.message.extendedTextMessage?.text ||
            msg.message.imageMessage?.caption ||
            ""
          ).trim();

          if (!text) continue;
          const lowerText = text.toLowerCase();

          // Consultar datos reales del restaurante en PostgreSQL
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
            },
          });

          if (!restaurant || !restaurant.whatsappBotEnabled) continue;

          const isGreetingOrMenu =
            lowerText === "hola" ||
            lowerText === "menu" ||
            lowerText === "menú" ||
            lowerText === "buenas" ||
            lowerText === "buenas tardes" ||
            lowerText === "buenos dias" ||
            lowerText.startsWith("hola") ||
            lowerText.includes("menu");

          if (isGreetingOrMenu) {
            let menuMsg = `👋 *¡Hola! Bienvenido a ${restaurant.name}* 🍽️\n\n`;
            menuMsg += `¿En qué podemos ayudarte hoy? Por favor elige una de las siguientes opciones respondiendo con el número (del 1 al 5):\n\n`;
            menuMsg += `1️⃣ *Ver Carta Digital y Pedir:* Consulta platos, precios y arma tu orden.\n`;
            menuMsg += `2️⃣ *Horarios de Atención:* Conoce nuestras horas de servicio.\n`;
            menuMsg += `3️⃣ *Ubicación y Cómo Llegar:* Dirección y mapa de nuestro local.\n`;
            menuMsg += `4️⃣ *Datos de Transferencia:* Cuentas bancarias para pagos directos.\n`;
            menuMsg += `5️⃣ *Agente Humano:* Hablar con un asesor de nuestro equipo.\n\n`;
            menuMsg += `━━━━━━━━━━━━━━━━━━━━\n`;
            menuMsg += `_Responde únicamente con el número de tu opción (ejemplo: *1*)._`;

            await sock.sendMessage(remoteJid, { text: menuMsg }, { quoted: msg });
            continue;
          }

          // Respuesta interactiva a las opciones del 1 al 5
          if (lowerText === "1" || lowerText.includes("carta") || lowerText.includes("pedir")) {
            let reply = `🍽️ *Carta Digital Interactiva de ${restaurant.name}*\n\n`;
            reply += `Explora nuestro menú completo con fotos, descripciones, promociones y arma tu pedido con carrito de compras aquí:\n`;
            reply += `👉 *https://menuqr.ubicame.cc/${restaurant.slug}*\n\n`;
            reply += `_(Los pedidos ingresados en el enlace se envían automáticamente a nuestra cocina)_`;
            await sock.sendMessage(remoteJid, { text: reply }, { quoted: msg });
            continue;
          }

          if (lowerText === "2" || lowerText.includes("horario")) {
            const horario = restaurant.localSchedule || restaurant.schedule || "Lunes a Domingo de 09:00 a 22:00";
            let reply = `🕒 *Horarios de Atención - ${restaurant.name}*\n\n`;
            reply += `${horario}\n\n`;
            reply += `👉 Puedes realizar pedidos online en: https://menuqr.ubicame.cc/${restaurant.slug}`;
            await sock.sendMessage(remoteJid, { text: reply }, { quoted: msg });
            continue;
          }

          if (lowerText === "3" || lowerText.includes("ubicacion") || lowerText.includes("ubicación")) {
            let reply = `📍 *Ubicación de ${restaurant.name}*\n\n`;
            reply += `🏠 *Dirección:* ${restaurant.address || "Local principal"}${restaurant.city ? `, ${restaurant.city}` : ""}\n`;
            if (restaurant.googleBusinessUrl) {
              reply += `🗺️ *Google Maps:* ${restaurant.googleBusinessUrl}\n`;
            }
            reply += `\n¡Te esperamos con los brazos abiertos!`;
            await sock.sendMessage(remoteJid, { text: reply }, { quoted: msg });
            continue;
          }

          if (lowerText === "4" || lowerText.includes("transferencia") || lowerText.includes("banco") || lowerText.includes("cuenta")) {
            let reply = `💳 *Datos Bancarios para Transferencias*\n\n`;
            if (restaurant.bankName && restaurant.bankAccountNumber) {
              reply += `• *Banco:* ${restaurant.bankName}\n`;
              reply += `• *Tipo de Cuenta:* ${restaurant.bankAccountType || "Ahorros"}\n`;
              reply += `• *Número:* ${restaurant.bankAccountNumber}\n`;
              if (restaurant.bankAccountName) reply += `• *Titular:* ${restaurant.bankAccountName}\n`;
              if (restaurant.bankAccountDocument) reply += `• *C.I. / RUC:* ${restaurant.bankAccountDocument}\n`;
            } else {
              reply += `Por favor consulta los datos de cuenta actualizados directamente con nuestro personal en el local o en el proceso de checkout.\n`;
            }
            reply += `\n_Una vez realizada la transferencia, envía el comprobante por este chat._`;
            await sock.sendMessage(remoteJid, { text: reply }, { quoted: msg });
            continue;
          }

          if (lowerText === "5" || lowerText.includes("humano") || lowerText.includes("asesor") || lowerText.includes("ayuda")) {
            let reply = `👨‍💼 *Atención Personalizada - ${restaurant.name}*\n\n`;
            reply += `Un miembro de nuestro equipo atenderá este chat a la brevedad posible.\n`;
            reply += `Por favor descríbenos tu consulta detalladamente para poder asistirte mejor.`;
            await sock.sendMessage(remoteJid, { text: reply }, { quoted: msg });
            continue;
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

// ==========================================
// 5. MÉTODOS DE DESCONEXIÓN Y ENVÍO EXTERNO
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
