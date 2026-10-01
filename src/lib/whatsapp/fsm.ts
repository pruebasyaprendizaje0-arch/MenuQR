import { prisma } from "@/lib/prisma";
import {
  ParsedWhatsAppMessage,
  sendWhatsAppText,
  sendWhatsAppPresence,
} from "@/lib/evolution";
import { WhatsAppBotState } from "@prisma/client";

const HUMAN_HANDOFF_DURATION_MS = 45 * 60 * 1000; // 45 minutos

export interface ProcessFSMResult {
  status: "success" | "ignored" | "paused" | "error";
  reason?: string;
  sessionState?: WhatsAppBotState;
  responseSent?: boolean;
}

/**
 * Normaliza el texto eliminando tildes, espacios extras y convirtiendo a minúsculas
 */
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/**
 * Calcula un retardo aleatorio entre minMs y maxMs para simular tipeo humano
 */
function getRandomDelay(minMs = 1500, maxMs = 3000): number {
  return Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
}

/**
 * Procesa la máquina de estados finitos (FSM) para un mensaje entrante/saliente de WhatsApp
 */
export async function processWhatsAppFSM(
  msgData: ParsedWhatsAppMessage,
  rawPayload?: any
): Promise<ProcessFSMResult> {
  const { messageId, phone, remoteJid, text, fromMe, instance, senderName } = msgData;

  // 1. DEDUPLICACIÓN E IDEMPOTENCIA
  if (messageId) {
    const existingLog = await prisma.whatsAppLog.findUnique({
      where: { messageId },
    });
    if (existingLog) {
      console.log(`[WhatsApp FSM] Mensaje duplicado ya procesado (ID: ${messageId}). Ignorando.`);
      return { status: "ignored", reason: "duplicate_message" };
    }
  }

  // 2. RESOLUCIÓN DE RESTAURANTE
  let restaurantId: string | null = null;
  let restaurantSlug = "";
  let restaurantName = "MenuQR Pro";

  // Intentar relacionar por slug de instancia o número de WhatsApp
  const matchedRestaurant = await prisma.restaurant.findFirst({
    where: {
      OR: [
        { slug: instance },
        { whatsapp: { contains: phone } },
      ],
    },
    select: { id: true, slug: true, name: true, whatsappBotEnabled: true },
  });

  if (matchedRestaurant) {
    restaurantId = matchedRestaurant.id;
    restaurantSlug = matchedRestaurant.slug;
    restaurantName = matchedRestaurant.name;

    // Verificar si el Super Admin desactivó el bot para este negocio
    if (matchedRestaurant.whatsappBotEnabled === false) {
      console.log(`[WhatsApp FSM] Bot desactivado por Super Admin para el restaurante "${restaurantName}" (${restaurantId}). Ignorando auto-reply.`);
      return { status: "ignored", reason: "whatsapp_bot_disabled" };
    }
  }


  // 3. MANEJO DE MENSAJES ENVIADOS POR EL OPERADOR (fromMe = true)
  if (fromMe) {
    // Si un operador responde desde WhatsApp Web, pausamos el bot por 45 minutos (Human Handoff)
    if (messageId) {
      await prisma.whatsAppLog.create({
        data: {
          messageId,
          direction: "OUTGOING",
          fromMe: true,
          phone,
          text: text || "[Mensaje Enviado por Operador]",
          rawPayload: rawPayload ? JSON.stringify(rawPayload) : null,
          restaurantId,
        },
      }).catch(() => {});
    }

    const handoffUntil = new Date(Date.now() + HUMAN_HANDOFF_DURATION_MS);
    await prisma.whatsAppSession.upsert({
      where: {
        phone_restaurantId: {
          phone,
          restaurantId: restaurantId || "",
        },
      },
      create: {
        phone,
        remoteJid,
        restaurantId,
        customerName: senderName,
        state: "IN_HUMAN_HANDOFF" as WhatsAppBotState,
        humanHandoffUntil: handoffUntil,
        lastInteractionAt: new Date(),
      },
      update: {
        state: "IN_HUMAN_HANDOFF" as WhatsAppBotState,
        humanHandoffUntil: handoffUntil,
        lastInteractionAt: new Date(),
      },
    }).catch(() => {});

    console.log(`[WhatsApp FSM] Operador humano escribió a ${phone}. Pausa de bot activada por 45 min hasta ${handoffUntil.toISOString()}.`);
    return { status: "ignored", reason: "fromMe_operator_handoff_activated" };
  }

  // 4. REGISTRAR MENSAJE ENTRANTE EN WHATSAPP LOG
  const incomingLog = messageId
    ? await prisma.whatsAppLog.create({
        data: {
          messageId,
          direction: "INCOMING",
          fromMe: false,
          phone,
          text: text || "",
          rawPayload: rawPayload ? JSON.stringify(rawPayload) : null,
          restaurantId,
        },
      }).catch(() => null)
    : null;

  // 5. OBTENER O CREAR SESIÓN DEL CLIENTE
  let session = await prisma.whatsAppSession.findFirst({
    where: {
      phone,
      ...(restaurantId ? { restaurantId } : {}),
    },
  });

  if (!session) {
    session = await prisma.whatsAppSession.create({
      data: {
        phone,
        remoteJid,
        restaurantId,
        customerName: senderName,
        state: "MENU" as WhatsAppBotState,
        fallbackCount: 0,
        lastInteractionAt: new Date(),
      },
    });
  }

  // Vincular log a la sesión creada
  if (incomingLog) {
    await prisma.whatsAppLog.update({
      where: { id: incomingLog.id },
      data: { sessionId: session.id },
    }).catch(() => {});
  }

  const cleanText = normalizeText(text);

  // 6. CONTROL DE PAUSA POR ATENCIÓN HUMANA (HUMAN HANDOFF)
  const now = new Date();
  const isHandoffActive = session.humanHandoffUntil && session.humanHandoffUntil > now;

  if (isHandoffActive) {
    // Si el usuario escribe "bot", "reactivar" o "menu", rompemos la pausa manualmente
    if (["bot", "reactivar", "activar"].includes(cleanText)) {
      console.log(`[WhatsApp FSM] Cliente ${phone} solicitó reactivar el bot.`);
      session = await prisma.whatsAppSession.update({
        where: { id: session.id },
        data: {
          state: "MENU" as WhatsAppBotState,
          humanHandoffUntil: null,
          fallbackCount: 0,
          lastInteractionAt: now,
        },
      });
      // Proceder a enviar menú principal más abajo
    } else {
      console.log(`[WhatsApp FSM] Bot pausado para el cliente ${phone} hasta ${session.humanHandoffUntil?.toISOString()}. Ignorando auto-reply.`);
      return { status: "paused", reason: "in_human_handoff", sessionState: session.state };
    }
  }

  // 7. MÁQUINA DE ESTADOS FINITOS (FSM)
  let nextState: WhatsAppBotState = session.state;
  let responseText = "";
  let newFallbackCount = session.fallbackCount;
  let newHandoffUntil: Date | null = session.humanHandoffUntil;

  // Comando global para volver al menú principal en cualquier momento
  if (cleanText === "menu" || cleanText === "inicio" || cleanText === "start" || cleanText === "cancelar") {
    nextState = "MENU" as WhatsAppBotState;
    newFallbackCount = 0;
  }

  switch (nextState) {
    case "IN_HUMAN_HANDOFF": {
      // Handoff expirado o cancelado
      nextState = "MENU" as WhatsAppBotState;
      newHandoffUntil = null;
      newFallbackCount = 0;
      // Fallthrough al bloque MENU
    }

    case "MENU": {
      const menuUrl = restaurantSlug ? `https://menuqr.ubicame.cc/${restaurantSlug}` : `https://menuqr.ubicame.cc`;

      if (cleanText === "1" || cleanText === "menu" || cleanText === "carta" || cleanText === "ver menu") {
        newFallbackCount = 0;
        responseText = `📱 *Carta Digital de ${restaurantName}*\n\nConsulta los platos, bebidas y promociones del día aquí:\n👉 ${menuUrl}\n\nEscribe *2* si deseas consultar el estado de un pedido en curso, o *3* para hablar con un asesor.`;
      } else if (cleanText === "2" || cleanText === "pedido" || cleanText === "estado" || cleanText === "orden") {
        nextState = "AWAITING_ORDER_ID" as WhatsAppBotState;
        newFallbackCount = 0;
        responseText = `🔎 *Consulta de Estado de Pedido*\n\nPor favor, escribe únicamente el número de tu pedido (ejemplo: *105* o *#105*):\n\n_(Escribe *MENU* para volver al menú principal)_`;
      } else if (cleanText === "3" || cleanText === "soporte" || cleanText === "humano" || cleanText === "asesor" || cleanText === "ayuda") {
        nextState = "IN_HUMAN_HANDOFF" as WhatsAppBotState;
        newHandoffUntil = new Date(Date.now() + HUMAN_HANDOFF_DURATION_MS);
        newFallbackCount = 0;
        responseText = `👨‍🍳 *Atención Personalizada*\n\nUn asesor de ${restaurantName} atenderá tu mensaje a la brevedad. El bot automatizado se pausará durante 45 minutos.\n\n_(Si deseas reactivar el bot antes, escribe *BOT*)_`;
      } else if (cleanText === "hola" || cleanText === "buenas" || cleanText === "hola!" || cleanText === "start") {
        newFallbackCount = 0;
        responseText = `👋 ¡Hola ${senderName}! Bienvenido a *${restaurantName}*.\n\n¿En qué podemos ayudarte hoy?\n\n1️⃣ Ver Menú / Carta Digital\n2️⃣ Consultar Estado de mi Pedido\n3️⃣ Hablar con un Asesor Humano\n\nResponde únicamente con el número (*1*, *2* o *3*).`;
      } else {
        // Opción no reconocida -> Incrementar fallbacks
        newFallbackCount += 1;
        if (newFallbackCount >= 2) {
          newFallbackCount = 0;
          responseText = `⚠️ No logramos entender tu solicitud.\n\nTe mostramos nuevamente nuestras opciones principales:\n\n1️⃣ Ver Menú / Carta Digital\n2️⃣ Consultar Estado de Pedido\n3️⃣ Hablar con un Asesor Humano\n\n👉 Responde *1*, *2* o *3*.`;
        } else {
          responseText = `🤖 Opción no válida.\n\nPor favor responde:\n1️⃣ Ver Menú\n2️⃣ Estado de Pedido\n3️⃣ Asesor Humano`;
        }
      }
      break;
    }

    case "AWAITING_ORDER_ID": {
      // Extraer dígitos del texto (ej. "#105" -> 105, "pedido 42" -> 42)
      const digitsMatch = text.match(/\d+/);
      const parsedOrderNum = digitsMatch ? parseInt(digitsMatch[0], 10) : null;

      if (parsedOrderNum) {
        // Buscar el pedido en la base de datos
        const order = await prisma.order.findFirst({
          where: {
            orderNumber: parsedOrderNum,
            ...(restaurantId ? { restaurantId } : {}),
          },
          select: {
            orderNumber: true,
            status: true,
            total: true,
            tableName: true,
            paymentMethod: true,
            createdAt: true,
          },
        });

        if (order) {
          let statusFormatted = "";
          switch (order.status) {
            case "PENDING":
              statusFormatted = "⏳ *PENDIENTE:* Tu orden ha sido recibida por el restaurante.";
              break;
            case "PREPARING":
            case "IN_PREPARATION":
              statusFormatted = "🍳 *EN PREPARACIÓN:* Los cocineros están preparando tu pedido.";
              break;
            case "READY":
            case "IN_TRANSIT":
              statusFormatted = "🚗 *LISTO / EN CAMINO:* Tu orden está lista para servir o entregar.";
              break;
            case "DELIVERED":
            case "COMPLETED":
              statusFormatted = "✅ *ENTREGADO:* Tu pedido ha sido completado con éxito.";
              break;
            case "CANCELLED":
              statusFormatted = "❌ *CANCELADO:* Este pedido ha sido cancelado.";
              break;
            default:
              statusFormatted = `📋 *ESTADO:* ${order.status}`;
          }

          responseText = `📦 *Información del Pedido #${order.orderNumber}*\n\n${statusFormatted}\n\n📍 *Ubicación/Mesa:* ${order.tableName}\n💵 *Total:* $${order.total.toFixed(2)}\n💳 *Método de Pago:* ${order.paymentMethod}\n\nEscribe *1* para volver a ver el menú.`;
          nextState = "MENU" as WhatsAppBotState;
          newFallbackCount = 0;
        } else {
          newFallbackCount += 1;
          if (newFallbackCount >= 2) {
            nextState = "MENU" as WhatsAppBotState;
            newFallbackCount = 0;
            responseText = `❌ No encontramos ningún pedido con el número *#${parsedOrderNum}*.\n\nVolviendo al menú principal. Escribe *1* para ver la carta o *3* para hablar con un asesor.`;
          } else {
            responseText = `❌ No encontramos el pedido *#${parsedOrderNum}*.\n\nPor favor verifica el número o escribe *CANCELAR* para volver al menú.`;
          }
        }
      } else {
        newFallbackCount += 1;
        if (newFallbackCount >= 2) {
          nextState = "MENU" as WhatsAppBotState;
          newFallbackCount = 0;
          responseText = `⚠️ No detectamos un número de pedido válido.\n\nVolviendo al menú principal. Escribe *1* para ver la carta o *3* para hablar con un asesor.`;
        } else {
          responseText = `🤖 Por favor escribe únicamente el número de tu pedido (ejemplo: *105*), o escribe *CANCELAR* para regresar.`;
        }
      }
      break;
    }

    default: {
      nextState = "MENU" as WhatsAppBotState;
      responseText = `👋 ¡Hola ${senderName}! Escribe *MENU* para ver las opciones disponibles.`;
      break;
    }
  }

  // 8. ACTUALIZAR ESTADO DE LA SESIÓN EN BASE DE DATOS
  await prisma.whatsAppSession.update({
    where: { id: session.id },
    data: {
      state: nextState,
      fallbackCount: newFallbackCount,
      humanHandoffUntil: newHandoffUntil,
      lastInteractionAt: new Date(),
    },
  });

  // 9. ENVÍO DE RESPUESTA CON ESTRATEGIA ANTI-BANEO (DELAYS + COMPOSING)
  if (responseText) {
    const artificialDelay = getRandomDelay(1500, 3000);

    // Simular que el bot está escribiendo
    await sendWhatsAppPresence({
      instance,
      to: phone,
      presence: "composing",
      delay: Math.min(artificialDelay, 1500),
    });

    const sendResult = await sendWhatsAppText({
      instance,
      to: phone,
      text: responseText,
      delay: artificialDelay,
    });

    if (sendResult.success && sendResult.data?.key?.id) {
      await prisma.whatsAppLog.create({
        data: {
          sessionId: session.id,
          restaurantId,
          messageId: sendResult.data.key.id,
          direction: "OUTGOING",
          fromMe: true,
          phone,
          text: responseText,
          createdAt: new Date(),
        },
      }).catch(() => {});
    }

    return {
      status: "success",
      sessionState: nextState,
      responseSent: sendResult.success,
    };
  }

  return { status: "success", sessionState: nextState, responseSent: false };
}
