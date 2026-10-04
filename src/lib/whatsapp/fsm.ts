import { prisma } from "@/lib/prisma";
import {
  ParsedWhatsAppMessage,
  sendWhatsAppText,
  sendWhatsAppPresence,
} from "@/lib/evolution";
import { WhatsAppBotState } from "@prisma/client";
import { getBusinessLabels } from "@/lib/business-labels";

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
 * Calcula un retardo aleatorio entre minMs (2500ms) y maxMs (5500ms) para simular tipeo humano
 */
function getRandomDelay(minMs = 2500, maxMs = 5500): number {
  return Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
}

/**
 * Invoca la IA (OpenAI o Google Gemini) cuando el restaurante tiene habilitado aiFallbackEnabled (BYOK)
 */
async function callAiFallback({
  restaurantName,
  restaurantSlug,
  address,
  city,
  schedule,
  categories,
  aiProvider,
  aiApiKey,
  aiModel,
  aiPromptContext,
  userMessage,
}: {
  restaurantName: string;
  restaurantSlug: string;
  address?: string | null;
  city?: string | null;
  schedule?: string | null;
  categories?: any[];
  aiProvider: string;
  aiApiKey: string;
  aiModel?: string | null;
  aiPromptContext?: string | null;
  userMessage: string;
}): Promise<string | null> {
  try {
    if (!aiApiKey || !aiProvider || aiProvider === "NONE") return null;

    let menuSummary = "";
    if (categories && categories.length > 0) {
      menuSummary = categories
        .map((cat) => {
          const dishesList = cat.dishes
            ?.slice(0, 6)
            ?.map((d: any) => `- ${d.name} ($${Number(d.price).toFixed(2)})`)
            ?.join("\n");
          return `*${cat.name}*:\n${dishesList || "Consultar en la carta"}`;
        })
        .join("\n\n");
    }

    const systemPrompt = `Eres el asistente virtual de WhatsApp del restaurante "${restaurantName}".
Ubicación: ${address || "Consultar en el menú web"}${city ? `, ${city}` : ""}
Horario de atención: ${schedule || "Abierto hoy"}
Carta Web: https://menuqr.ubicame.cc/${restaurantSlug}

${menuSummary ? `PLATTOS Y PRECIOS DESTACADOS:\n${menuSummary}\n` : ""}
${aiPromptContext ? `INFORMACIÓN ADICIONAL DEL RESTAURANTE:\n${aiPromptContext}\n` : ""}

INSTRUCCIONES DE RESPUESTA:
- Responde de forma amable, corta y profesional en español (máximo 2 a 3 párrafos breves).
- Si te preguntan sobre platos, precios o recomendaciones, usa la información del menú.
- Al finalizar tu mensaje, invita amablemente al cliente a revisar la carta web (https://menuqr.ubicame.cc/${restaurantSlug}) o escribir MENU para volver al menú numérico principal.`;

    if (aiProvider === "GEMINI") {
      let model = aiModel || "gemini-1.5-flash";
      if (model === "gemini-1.5-pro") model = "gemini-1.5-pro-latest";
      if (model === "gemini-2.0-flash") model = "gemini-2.5-flash";

      const tryCall = async (modelToUse: string) => {
        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${modelToUse}:generateContent?key=${aiApiKey.trim()}`;
        return fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [
              {
                parts: [{ text: `${systemPrompt}\n\nCliente en WhatsApp: ${userMessage}` }],
              },
            ],
          }),
          signal: AbortSignal.timeout(10000),
        });
      };

      let res = await tryCall(model);
      let data = await res.json().catch(() => ({}));

      // Si Google responde que el modelo ya no está disponible, reintentar automáticamente con gemini-1.5-flash
      if (!res.ok && (data.error?.message?.includes("no longer available") || data.error?.message?.includes("not found"))) {
        res = await tryCall("gemini-1.5-flash");
        data = await res.json().catch(() => ({}));
      }

      const textResponse = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
      return textResponse || null;
    } else if (aiProvider === "DEEPSEEK") {
      const model = aiModel || "deepseek-chat";
      const endpoint = "https://api.deepseek.com/chat/completions";

      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${aiApiKey.trim()}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userMessage },
          ],
          max_tokens: 250,
        }),
        signal: AbortSignal.timeout(10000),
      });

      const data = await res.json().catch(() => ({}));
      const textResponse = data.choices?.[0]?.message?.content?.trim();
      return textResponse || null;
    } else {
      const model = aiModel || "gpt-4o-mini";
      const endpoint = "https://api.openai.com/v1/chat/completions";

      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${aiApiKey.trim()}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userMessage },
          ],
          max_tokens: 250,
        }),
        signal: AbortSignal.timeout(10000),
      });

      const data = await res.json().catch(() => ({}));
      const textResponse = data.choices?.[0]?.message?.content?.trim();
      return textResponse || null;
    }
  } catch (err) {
    console.error("[WhatsApp AI Fallback Exception]:", err);
    return null;
  }
}

/**
 * Procesa la máquina de estados finitos (FSM) determinista para WhatsApp
 */
export async function processWhatsAppFSM(
  msgData: ParsedWhatsAppMessage,
  rawPayload?: any
): Promise<ProcessFSMResult> {
  const { messageId, phone, remoteJid, text, fromMe, instance, senderName } = msgData;

  // 1. DEDUPLICACIÓN E IDEMPOTENCIA DE ENTRADA
  if (messageId) {
    const existingLog = await prisma.whatsAppLog.findUnique({
      where: { messageId },
    });
    if (existingLog) {
      console.log(`[WhatsApp FSM] Mensaje duplicado ya procesado (ID: ${messageId}). Ignorando.`);
      return { status: "ignored", reason: "duplicate_message" };
    }
  }

  // 2. RESOLUCIÓN DE RESTAURANTE POR SLUG DE INSTANCIA O TELÉFONO
  let restaurantId: string | null = null;
  let restaurantSlug = "";
  let restaurantName = "MenuQR Pro";

  const matchedRestaurant = await prisma.restaurant.findFirst({
    where: {
      OR: [
        { slug: instance },
        { whatsapp: { contains: phone } },
      ],
    },
    select: {
      id: true,
      slug: true,
      name: true,
      whatsappBotEnabled: true,
      businessType: true,
      catalogMode: true,
      customLabels: true,
      bankName: true,
      bankAccountType: true,
      bankAccountNumber: true,
      bankAccountName: true,
      bankAccountDocument: true,
      schedule: true,
      address: true,
      city: true,
      aiProvider: true,
      aiApiKey: true,
      aiModel: true,
      aiPromptContext: true,
      aiFallbackEnabled: true,
      categories: {
        select: {
          name: true,
          dishes: {
            where: { isAvailable: true },
            select: { name: true, price: true, description: true },
          },
        },
      },
    },
  });

  if (matchedRestaurant) {
    restaurantId = matchedRestaurant.id;
    restaurantSlug = matchedRestaurant.slug;
    restaurantName = matchedRestaurant.name;

    if (matchedRestaurant.whatsappBotEnabled === false) {
      console.log(`[WhatsApp FSM] Bot desactivado por Super Admin para el restaurante "${restaurantName}" (${restaurantId}). Ignorando auto-reply.`);
      return { status: "ignored", reason: "whatsapp_bot_disabled" };
    }
  }

  // 3. MANEJO DE MENSAJES ENVIADOS POR EL OPERADOR (fromMe = true)
  if (fromMe) {
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

  // 4. REGISTRAR MENSAJE ENTRANTE EN LOG DE AUDITORÍA
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

  if (incomingLog) {
    await prisma.whatsAppLog.update({
      where: { id: incomingLog.id },
      data: { sessionId: session.id },
    }).catch(() => {});
  }

  const cleanText = normalizeText(text);

  // 6. CONTROL DE PAUSA POR ATENCIÓN HUMANA (HUMAN HANDOFF 45 MIN)
  const now = new Date();
  const isHandoffActive = session.humanHandoffUntil && session.humanHandoffUntil > now;

  if (isHandoffActive) {
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
    } else {
      console.log(`[WhatsApp FSM] Bot pausado para el cliente ${phone} hasta ${session.humanHandoffUntil?.toISOString()}. Permanece en silencio absoluto.`);
      return { status: "paused", reason: "in_human_handoff", sessionState: session.state };
    }
  }

  // 7. MÁQUINA DE ESTADOS FINITOS (FSM DETERMINISTA)
  let nextState: WhatsAppBotState = session.state;
  let responseText = "";
  let newFallbackCount = session.fallbackCount;
  let newHandoffUntil: Date | null = session.humanHandoffUntil;

  // Comando global para volver al menú principal
  if (cleanText === "menu" || cleanText === "inicio" || cleanText === "start" || cleanText === "cancelar") {
    nextState = "MENU" as WhatsAppBotState;
    newFallbackCount = 0;
  }

  const menuUrl = restaurantSlug ? `https://menuqr.ubicame.cc/${restaurantSlug}` : `https://menuqr.ubicame.cc`;

  switch (nextState) {
    case "IN_HUMAN_HANDOFF": {
      nextState = "MENU" as WhatsAppBotState;
      newHandoffUntil = null;
      newFallbackCount = 0;
    }

    case "MENU": {
      const bLabels = getBusinessLabels(matchedRestaurant?.customLabels, matchedRestaurant?.businessType);
      const isGastro = (matchedRestaurant?.businessType || "RESTAURANT") === "RESTAURANT";

      const option2Title = isGastro ? "Llamar al Mesero / Pedir Cuenta en Mesa" : "Consultar Estado de Envío / Guía de Despacho";

      if (cleanText === "1" || cleanText === "menu" || cleanText === "carta" || cleanText === "ver menu" || cleanText === "catalogo") {
        newFallbackCount = 0;
        responseText = `📱 *${bLabels.items} y Promociones de ${restaurantName}*\n\nConsulta nuestro catálogo interactivo aquí:\n👉 ${menuUrl}\n\nEscribe *MENU* para volver a ver las opciones.`;
      } else if (cleanText === "2" || cleanText === "mesero" || cleanText === "cuenta" || cleanText === "mesa" || cleanText === "envio" || cleanText === "despacho" || cleanText === "guia") {
        newFallbackCount = 0;
        if (isGastro) {
          responseText = `🔔 *Llamar al Mesero / Pedir Cuenta*\n\nPor favor indícanos tu número de mesa para avisar inmediatamente al personal de *${restaurantName}* (Ejemplo: *Mesa 4*).\n\n_(Escribe *MENU* para regresar al menú principal)_`;
        } else {
          responseText = `📦 *Consulta de Envíos y Rastreo de Pedido*\n\nSi realizaste una compra en *${restaurantName}*, por favor indícanos tu nombre o número de pedido para enviarte el estado de tu despacho.\n\n_(Escribe *MENU* para regresar al menú principal)_`;
        }
      } else if (cleanText === "3" || cleanText === "horario" || cleanText === "ubicacion" || cleanText === "direccion" || cleanText === "donde") {
        newFallbackCount = 0;
        responseText = `📍 *Horarios y Ubicación (${restaurantName})*\n\n🗺️ *Dirección:* ${matchedRestaurant?.address || "Consultar en el catálogo web"}${matchedRestaurant?.city ? `, ${matchedRestaurant.city}` : ""}\n🕒 *Horario:* ${matchedRestaurant?.schedule || "Abierto hoy"}\n📱 *Catálogo Web:* ${menuUrl}`;
      } else if (cleanText === "4" || cleanText === "pago" || cleanText === "banco" || cleanText === "cuenta" || cleanText === "transferencia") {
        newFallbackCount = 0;
        if (matchedRestaurant?.bankAccountNumber) {
          responseText = `💳 *Datos de Transferencia / Pago (${restaurantName})*\n\n🏦 *Banco:* ${matchedRestaurant.bankName || "Pichincha"}\n📋 *Tipo de Cuenta:* ${matchedRestaurant.bankAccountType || "Ahorros"}\n🔢 *N° de Cuenta:* ${matchedRestaurant.bankAccountNumber}\n👤 *Titular:* ${matchedRestaurant.bankAccountName || restaurantName}\n🆔 *Identificación / RUC:* ${matchedRestaurant.bankAccountDocument || "N/A"}\n\nPor favor envía el comprobante por este chat para verificar tu pago.`;
        } else {
          responseText = `💳 *Datos de Pago (${restaurantName})*\n\nPuedes realizar tu pago por transferencia bancaria o al recibir/retirar tu producto.`;
        }
      } else if (cleanText === "5" || cleanText === "soporte" || cleanText === "humano" || cleanText === "asesor" || cleanText === "ayuda" || cleanText === "personal") {
        nextState = "IN_HUMAN_HANDOFF" as WhatsAppBotState;
        newHandoffUntil = new Date(Date.now() + HUMAN_HANDOFF_DURATION_MS);
        newFallbackCount = 0;
        responseText = `👤 Un miembro de nuestro equipo de ventas te atenderá en este chat en breve. He pausado mis respuestas automáticas durante 45 minutos.\n\n_(Si deseas reactivar el bot antes, escribe *BOT*)_`;
      } else if (cleanText === "hola" || cleanText === "buenas" || cleanText === "hola!" || cleanText === "start") {
        newFallbackCount = 0;
        responseText = `¡Hola! Te damos la bienvenida a *${restaurantName}* 👋\n\nPor favor elige una opción escribiendo el número:\n1️⃣ Ver ${bLabels.items} y Realizar Pedido\n2️⃣ ${option2Title}\n3️⃣ Horarios y Ubicación\n4️⃣ Datos de Transferencia / Pago\n5️⃣ Hablar con un Asesor Humano`;
      } else {
        // Ocultar opción no reconocida -> Intentar Fallback de IA si el negocio configuró BYOK
        let aiResponse: string | null = null;

        if (
          matchedRestaurant?.aiFallbackEnabled &&
          matchedRestaurant?.aiApiKey &&
          matchedRestaurant?.aiProvider &&
          matchedRestaurant.aiProvider !== "NONE"
        ) {
          aiResponse = await callAiFallback({
            restaurantName,
            restaurantSlug,
            address: matchedRestaurant.address,
            city: matchedRestaurant.city,
            schedule: matchedRestaurant.schedule,
            categories: matchedRestaurant.categories,
            aiProvider: matchedRestaurant.aiProvider,
            aiApiKey: matchedRestaurant.aiApiKey,
            aiModel: matchedRestaurant.aiModel,
            aiPromptContext: matchedRestaurant.aiPromptContext,
            userMessage: text,
          });
        }

        if (aiResponse) {
          newFallbackCount = 0;
          responseText = aiResponse;
        } else {
          newFallbackCount += 1;
          if (newFallbackCount >= 2) {
            newFallbackCount = 0;
            responseText = `⚠️ Opción no válida.\n\nTe mostramos nuevamente nuestras opciones principales:\n1️⃣ Ver ${bLabels.items}\n2️⃣ ${option2Title}\n3️⃣ Horarios y Ubicación\n4️⃣ Datos de Transferencia / Pago\n5️⃣ Hablar con un Asesor Humano\n\n👉 Responde escribiendo el número del 1 al 5.`;
          } else {
            responseText = `🤖 Opción no reconocida.\n\nPor favor responde con el número:\n1️⃣ Ver ${bLabels.items}\n2️⃣ ${option2Title}\n3️⃣ Horarios y Ubicación\n4️⃣ Datos de Pago\n5️⃣ Hablar con un Asesor Humano`;
          }
        }
      }
      break;
    }

    case "AWAITING_ORDER_ID": {
      const digitsMatch = text.match(/\d+/);
      const parsedOrderNum = digitsMatch ? parseInt(digitsMatch[0], 10) : null;

      if (parsedOrderNum) {
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
            responseText = `❌ No encontramos ningún pedido con el número *#${parsedOrderNum}*.\n\nVolviendo al menú principal. Escribe *1* para ver la carta o *5* para hablar con un asesor.`;
          } else {
            responseText = `❌ No encontramos el pedido *#${parsedOrderNum}*.\n\nPor favor verifica el número o escribe *CANCELAR* para volver al menú.`;
          }
        }
      } else {
        newFallbackCount += 1;
        if (newFallbackCount >= 2) {
          nextState = "MENU" as WhatsAppBotState;
          newFallbackCount = 0;
          responseText = `⚠️ No detectamos un número de pedido válido.\n\nVolviendo al menú principal. Escribe *1* para ver la carta o *5* para hablar con un asesor.`;
        } else {
          responseText = `🤖 Por favor escribe únicamente el número de tu pedido (ejemplo: *105*), o escribe *CANCELAR* para regresar.`;
        }
      }
      break;
    }

    default: {
      nextState = "MENU" as WhatsAppBotState;
      responseText = `¡Hola ${senderName}! Te damos la bienvenida a *${restaurantName}* 🍽️\n\n1️⃣ Ver Menú Digital\n2️⃣ Llamar al Mesero\n3️⃣ Horarios y Ubicación\n4️⃣ Datos de Pago\n5️⃣ Hablar con Asesor`;
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

  // 9. ENVÍO DE RESPUESTA CON ESTRATEGIA ANTI-BANEO (DELAYS ALEATORIOS 2500ms - 5500ms + COMPOSING)
  if (responseText) {
    const artificialDelay = getRandomDelay(2500, 5500);

    // a) Disparar presencia "composing"
    await sendWhatsAppPresence({
      instance,
      to: phone,
      presence: "composing",
      delay: Math.min(artificialDelay, 2000),
    });

    // b) Esperar el delay aleatorio realista de emulación humana
    await new Promise((resolve) => setTimeout(resolve, artificialDelay));

    // c) Enviar el mensaje con sendWhatsAppText
    const sendResult = await sendWhatsAppText({
      instance,
      to: phone,
      text: responseText,
      delay: 0,
    });

    // d) Cambiar presencia a "paused" para concluir la simulación
    await sendWhatsAppPresence({
      instance,
      to: phone,
      presence: "paused",
      delay: 0,
    }).catch(() => {});

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

/**
 * Envía notificaciones transaccionales automáticas al cliente cuando cambia el estado de su pedido
 */
export async function sendOrderStatusNotification(
  restaurantId: string,
  customerPhone: string,
  orderNumber: number,
  newStatus: string
) {
  try {
    if (!customerPhone) return;

    const restaurant = await prisma.restaurant.findUnique({
      where: { id: restaurantId },
      select: { slug: true, name: true, whatsappBotEnabled: true },
    });

    if (!restaurant || restaurant.whatsappBotEnabled === false) return;

    const instanceName = restaurant.slug;

    let messageText = "";
    if (newStatus === "CONFIRMED" || newStatus === "PREPARING" || newStatus === "IN_PREPARATION") {
      messageText = `👨‍🍳 *¡Tu pedido #${orderNumber} ha sido CONFIRMADO!*\n\nRestaurante: *${restaurant.name}*\nEstado: En cocina en preparación.\n\nTe notificaremos por aquí cuando esté listo para retiro o entrega.`;
    } else if (newStatus === "READY" || newStatus === "IN_TRANSIT") {
      messageText = `🎉 *¡Tu pedido #${orderNumber} está LISTO!*\n\nRestaurante: *${restaurant.name}*\nEstado: Listo para entrega / retiro.\n\n¡Gracias por preferirnos!`;
    } else if (newStatus === "CANCELLED") {
      messageText = `❌ *Tu pedido #${orderNumber} ha sido CANCELADO.*\n\nRestaurante: *${restaurant.name}*\nSi tienes alguna duda, por favor contáctanos.`;
    }

    if (!messageText) return;

    const artificialDelay = getRandomDelay(2500, 4000);

    await sendWhatsAppPresence({
      instance: instanceName,
      to: customerPhone,
      presence: "composing",
      delay: 1500,
    });

    await new Promise((resolve) => setTimeout(resolve, artificialDelay));

    await sendWhatsAppText({
      instance: instanceName,
      to: customerPhone,
      text: messageText,
      delay: 0,
    });

    await sendWhatsAppPresence({
      instance: instanceName,
      to: customerPhone,
      presence: "paused",
      delay: 0,
    }).catch(() => {});
  } catch (error) {
    console.error("[WhatsApp Transactional] Error enviando notificación:", error);
  }
}
