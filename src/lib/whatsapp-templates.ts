import { prisma } from "./prisma";

export interface TemplateVariables {
  nombre: string;
  link_menu: string;
  horario: string;
  direccion: string;
  maps?: string;
  datos_banco: string;
}

export const DEFAULT_TEMPLATES = [
  {
    key: "welcome",
    title: "Saludo y Menú de Opciones",
    trigger: "hola,buenas,buenos dias,buenas tardes,buenas noches,menu,menú,inicio,empezar",
    content: `👋 *¡Hola! Bienvenido a {nombre}* 🍽️

¿En qué podemos ayudarte hoy? Por favor elige una de las siguientes opciones respondiendo con el número (del 1 al 5):

1️⃣ *Ver Carta Digital y Pedir:* Consulta platos, precios y arma tu orden.
2️⃣ *Horarios de Atención:* Conoce nuestras horas de servicio.
3️⃣ *Ubicación y Cómo Llegar:* Dirección y mapa de nuestro local.
4️⃣ *Datos de Transferencia:* Cuentas bancarias para pagos directos.
5️⃣ *Agente Humano:* Hablar con un asesor de nuestro equipo.

━━━━━━━━━━━━━━━━━━━━
_Responde con el número de tu opción (ejemplo: *1*)._`,
    order: 0,
  },
  {
    key: "option_1",
    title: "Opción 1: Carta Digital y Pedidos",
    trigger: "1,carta,pedir,menu,menú,platos,orden,ordenar",
    content: `🍽️ *Carta Digital Interactiva de {nombre}*

Explora nuestro menú completo con fotos, promociones y arma tu pedido con carrito de compras aquí:
👉 *{link_menu}*

_(Los pedidos ingresados en el enlace se envían automáticamente a nuestra cocina)_`,
    order: 1,
  },
  {
    key: "option_2",
    title: "Opción 2: Horarios de Atención",
    trigger: "2,horario,horarios,hora,abren,cierran,abierto",
    content: `🕒 *Horarios de Atención - {nombre}*

{horario}

👉 Puedes revisar la carta y realizar pedidos en: {link_menu}`,
    order: 2,
  },
  {
    key: "option_3",
    title: "Opción 3: Ubicación y Dirección",
    trigger: "3,ubicacion,ubicación,direccion,dirección,donde,dónde,llegar,mapa,local",
    content: `📍 *Ubicación de {nombre}*

🏠 *Dirección:* {direccion}
🗺️ *Google Maps:* {maps}

¡Te esperamos con los brazos abiertos!`,
    order: 3,
  },
  {
    key: "option_4",
    title: "Opción 4: Datos Bancarios",
    trigger: "4,transferencia,banco,cuenta,cuentas,datos,transferir,pago",
    content: `💳 *Datos Bancarios para Transferencias*

{datos_banco}

_Una vez realizada la transferencia, envía el comprobante por este chat._`,
    order: 4,
  },
  {
    key: "option_5",
    title: "Opción 5: Asesor Humano",
    trigger: "5,humano,asesor,persona,ayuda,atencion,atención,contactar",
    content: `👨‍💼 *Atención Personalizada - {nombre}*

Un miembro de nuestro equipo atenderá este chat a la brevedad posible.
Por favor descríbenos tu consulta detalladamente para poder asistirte mejor.`,
    order: 5,
  },
  {
    key: "fallback",
    title: "Respuesta si no se reconoce la opción (Sin IA)",
    trigger: "", // Fallback no tiene triggers directos
    content: `👋 Hola, no pude reconocer tu opción.

Por favor responde con un número del *1 al 5* para ayudarte o escribe *menú* para ver las alternativas de {nombre}.`,
    order: 99,
  },
];

/**
 * Reemplaza las variables dinámicas en el texto de una plantilla
 */
export function renderTemplateContent(content: string, vars: TemplateVariables): string {
  let text = content || "";
  text = text.replace(/{nombre}/gi, vars.nombre || "nuestro local");
  text = text.replace(/{nombre_local}/gi, vars.nombre || "nuestro local");
  text = text.replace(/{link_menu}/gi, vars.link_menu || "");
  text = text.replace(/{carta}/gi, vars.link_menu || "");
  text = text.replace(/{horario}/gi, vars.horario || "Consultar directamente");
  text = text.replace(/{direccion}/gi, vars.direccion || "Local principal");
  text = text.replace(/{maps}/gi, vars.maps || "Consulta en recepción");
  text = text.replace(/{datos_banco}/gi, vars.datos_banco || "Consultar con el personal");
  text = text.replace(/{banco}/gi, vars.datos_banco || "Consultar con el personal");
  return text.trim();
}

/**
 * Obtiene o inicializa las plantillas de un restaurante en la base de datos
 */
export async function getOrSeedRestaurantTemplates(restaurantId: string) {
  let templates = await prisma.whatsAppTemplate.findMany({
    where: { restaurantId, isActive: true },
    orderBy: { order: "asc" },
  });

  if (templates.length === 0) {
    // Inicializar con las plantillas por defecto
    const dataToCreate = DEFAULT_TEMPLATES.map((tmpl) => ({
      restaurantId,
      key: tmpl.key,
      title: tmpl.title,
      trigger: tmpl.trigger,
      content: tmpl.content,
      order: tmpl.order,
      isActive: true,
    }));

    await prisma.whatsAppTemplate.createMany({
      data: dataToCreate,
      skipDuplicates: true,
    });

    templates = await prisma.whatsAppTemplate.findMany({
      where: { restaurantId, isActive: true },
      orderBy: { order: "asc" },
    });
  }

  return templates;
}

/**
 * Encuentra una plantilla que coincida con el mensaje recibido
 */
export function matchTemplate(
  message: string,
  templates: Array<{ key: string; trigger: string | null; content: string }>
): { key: string; content: string } | null {
  const clean = message.trim().toLowerCase();
  if (!clean) return null;

  // 1. Coincidencia exacta con número (ej. "1", "2") o trigger de bienvenida
  for (const tmpl of templates) {
    if (!tmpl.trigger) continue;
    const triggers = tmpl.trigger
      .split(",")
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean);

    for (const trig of triggers) {
      if (clean === trig || (clean.length > 2 && clean.includes(trig))) {
        return tmpl;
      }
    }
  }

  return null;
}
