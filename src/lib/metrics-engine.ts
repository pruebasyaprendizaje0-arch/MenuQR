import { prisma } from "@/lib/prisma";
import { resolveBusinessVertical, BusinessVertical } from "@/lib/business-labels";

export interface ChannelMetrics {
  count: number;
  percentage: number;
  revenue: number;
}

export interface VerticalMetricLabels {
  vertical: BusinessVertical;
  ordersCountLabel: string;
  ordersCountSublabel: string;
  topItemTitle: string;
  topItemBadge: string;
  topItemEmpty: string;
  topChannelTitle: string;
  topChannelBadge: string;
  topChannelEmpty: string;
  channelsTitle: string;
  channel1Icon: string;
  channel1Label: string;
  channel2Icon: string;
  channel2Label: string;
  channel3Icon: string;
  channel3Label: string;
  isGastro: boolean;
}

export function getVerticalMetricLabels(vertical: BusinessVertical): VerticalMetricLabels {
  switch (vertical) {
    case "retail":
      return {
        vertical: "retail",
        ordersCountLabel: "Ventas Realizadas",
        ordersCountSublabel: "Pedidos despachados",
        topItemTitle: "Producto Estrella ⭐",
        topItemBadge: "Producto",
        topItemEmpty: "Sin ventas registradas",
        topChannelTitle: "Canal de Entrega Líder 📦",
        topChannelBadge: "Entrega",
        topChannelEmpty: "Sin pedidos registrados",
        channelsTitle: "Distribución por Modalidad de Entrega",
        channel1Icon: "🏪",
        channel1Label: "Retiro en Tienda / Local",
        channel2Icon: "🛵",
        channel2Label: "Envío a Domicilio / Courier",
        channel3Icon: "🛍️",
        channel3Label: "Venta por Mostrador / POS",
        isGastro: false,
      };
    case "citas":
      return {
        vertical: "citas",
        ordersCountLabel: "Citas Atendidas",
        ordersCountSublabel: "Turnos completados",
        topItemTitle: "Servicio / Tratamiento Estrella ⭐",
        topItemBadge: "Servicio",
        topItemEmpty: "Sin citas registradas",
        topChannelTitle: "Modalidad / Especialista Líder 👨‍⚕️",
        topChannelBadge: "Especialista",
        topChannelEmpty: "Sin turnos registrados",
        channelsTitle: "Modalidad de Atención",
        channel1Icon: "🩺",
        channel1Label: "Atención en Consultorio",
        channel2Icon: "🚗",
        channel2Label: "Servicio a Domicilio",
        channel3Icon: "💻",
        channel3Label: "Atención Virtual / Online",
        isGastro: false,
      };
    case "reservas":
      return {
        vertical: "reservas",
        ordersCountLabel: "Reservas Confirmadas",
        ordersCountSublabel: "Estadías registradas",
        topItemTitle: "Alojamiento / Cabaña Estrella 🏡",
        topItemBadge: "Cabaña",
        topItemEmpty: "Sin reservas registradas",
        topChannelTitle: "Canal de Reserva Preferido 📱",
        topChannelBadge: "Canal",
        topChannelEmpty: "Sin reservas en el período",
        channelsTitle: "Origen de la Reserva",
        channel1Icon: "🌐",
        channel1Label: "Reserva Web Directa",
        channel2Icon: "📲",
        channel2Label: "WhatsApp / Reserva Directa",
        channel3Icon: "🛎️",
        channel3Label: "Mostrador / Check-In Directo",
        isGastro: false,
      };
    case "servicios":
      return {
        vertical: "servicios",
        ordersCountLabel: "Cotizaciones Atendidas",
        ordersCountSublabel: "Solicitudes de servicio",
        topItemTitle: "Servicio Técnico Estrella 🔧",
        topItemBadge: "Servicio",
        topItemEmpty: "Sin solicitudes registradas",
        topChannelTitle: "Modalidad / Zona Líder 📍",
        topChannelBadge: "Modalidad",
        topChannelEmpty: "Sin visitas registradas",
        channelsTitle: "Distribución del Servicio",
        channel1Icon: "🚐",
        channel1Label: "Visita Técnica a Domicilio",
        channel2Icon: "🛠️",
        channel2Label: "Atención en Taller / Local",
        channel3Icon: "📞",
        channel3Label: "Diagnóstico Express / Remoto",
        isGastro: false,
      };
    case "restaurante":
    default:
      return {
        vertical: "restaurante",
        ordersCountLabel: "Pedidos Atendidos",
        ordersCountSublabel: "Órdenes completadas",
        topItemTitle: "Plato Estrella ⭐",
        topItemBadge: "Plato",
        topItemEmpty: "Sin ventas registradas",
        topChannelTitle: "Mesa Más Activa 🪑",
        topChannelBadge: "Mesa",
        topChannelEmpty: "Sin pedidos en mesa",
        channelsTitle: "Distribución por Canal de Venta",
        channel1Icon: "🪑",
        channel1Label: "Salón / En Mesa",
        channel2Icon: "🛍️",
        channel2Label: "Para Llevar / Retiro",
        channel3Icon: "🛵",
        channel3Label: "A Domicilio (Delivery)",
        isGastro: true,
      };
  }
}

export interface WeeklyMetricsSummary {
  restaurantId: string;
  restaurantName: string;
  restaurantSlug: string;
  vertical: BusinessVertical;
  labels: VerticalMetricLabels;
  period: {
    startDate: string;
    endDate: string;
    formattedRange: string;
    weekNumber: number;
    year: number;
  };
  financials: {
    totalRevenue: number;
    totalOrders: number;
    averageTicket: number;
  };
  topDish: {
    name: string;
    quantitySold: number;
    revenue: number;
  } | null;
  topTable: {
    name: string;
    orderCount: number;
  } | null;
  channelDistribution: {
    dineIn: ChannelMetrics;
    takeout: ChannelMetrics;
    delivery: ChannelMetrics;
  };
  generatedAt: string;
}

/**
 * Retorna el rango de fechas de la semana cerrada anterior (Lunes 00:00:00 a Domingo 23:59:59).
 * weekOffset = 1 indica la semana inmediatamente anterior.
 */
export function getPreviousWeekDateRange(weekOffset = 1): {
  startDate: Date;
  endDate: Date;
  weekNumber: number;
  year: number;
  formattedRange: string;
} {
  const now = new Date();
  
  // Encontrar el lunes de la semana actual
  const currentDay = now.getDay(); // 0 es Domingo, 1 es Lunes, etc.
  const distanceToMonday = (currentDay + 6) % 7;
  
  const mondayThisWeek = new Date(now);
  mondayThisWeek.setDate(now.getDate() - distanceToMonday);
  mondayThisWeek.setHours(0, 0, 0, 0);

  // Retroceder 'weekOffset' semanas para el inicio (Lunes)
  const startDate = new Date(mondayThisWeek);
  startDate.setDate(mondayThisWeek.getDate() - (7 * weekOffset));
  startDate.setHours(0, 0, 0, 0);

  // El fin es el Domingo de esa semana (23:59:59.999)
  const endDate = new Date(startDate);
  endDate.setDate(startDate.getDate() + 6);
  endDate.setHours(23, 59, 59, 999);

  // Calcular número de semana ISO
  const d = new Date(Date.UTC(startDate.getFullYear(), startDate.getMonth(), startDate.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNumber = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);

  // Formatear texto amigable (ej: "19 Oct - 25 Oct")
  const startDay = startDate.getDate().toString().padStart(2, "0");
  const endDay = endDate.getDate().toString().padStart(2, "0");
  const months = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
  const startMonth = months[startDate.getMonth()];
  const endMonth = months[endDate.getMonth()];

  const formattedRange = startMonth === endMonth
    ? `${startDay} - ${endDay} ${startMonth}`
    : `${startDay} ${startMonth} - ${endDay} ${endMonth}`;

  return {
    startDate,
    endDate,
    weekNumber,
    year: startDate.getFullYear(),
    formattedRange,
  };
}

/**
 * Calcula las métricas semanales completas para un restaurante determinado.
 */
export async function calculateWeeklyMetrics(
  restaurantId: string,
  startDate?: Date,
  endDate?: Date
): Promise<WeeklyMetricsSummary | null> {
  const range = (!startDate || !endDate) ? getPreviousWeekDateRange(1) : null;
  const start = startDate || range!.startDate;
  const end = endDate || range!.endDate;

  const restaurant = await prisma.restaurant.findUnique({
    where: { id: restaurantId },
    select: {
      id: true,
      name: true,
      slug: true,
      isSuspended: true,
      businessType: true,
      catalogMode: true,
      specialty: true,
      description: true,
      customLabels: true,
    },
  });

  if (!restaurant) {
    return null;
  }

  const vertical = resolveBusinessVertical(restaurant);
  const labels = getVerticalMetricLabels(vertical);

  // Traer los pedidos del período ignorando pruebas y cancelaciones
  const orders = await prisma.order.findMany({
    where: {
      restaurantId,
      isTest: false,
      status: { not: "CANCELLED" },
      createdAt: {
        gte: start,
        lte: end,
      },
    },
    select: {
      id: true,
      total: true,
      tableName: true,
      items: {
        select: {
          dishName: true,
          quantity: true,
          price: true,
        },
      },
    },
  });

  const totalOrders = orders.length;
  const totalRevenue = Math.round(orders.reduce((sum, o) => sum + (o.total || 0), 0) * 100) / 100;
  const averageTicket = totalOrders > 0
    ? Math.round((totalRevenue / totalOrders) * 100) / 100
    : 0;

  // 1. Ítem estrella (Top Dish / Producto / Servicio)
  const dishMap = new Map<string, { quantity: number; revenue: number }>();
  for (const order of orders) {
    for (const item of order.items) {
      const current = dishMap.get(item.dishName) || { quantity: 0, revenue: 0 };
      current.quantity += item.quantity || 1;
      current.revenue += (item.price || 0) * (item.quantity || 1);
      dishMap.set(item.dishName, current);
    }
  }

  let topDish: { name: string; quantitySold: number; revenue: number } | null = null;
  for (const [name, stats] of dishMap.entries()) {
    if (!topDish || stats.quantity > topDish.quantitySold) {
      topDish = {
        name,
        quantitySold: stats.quantity,
        revenue: Math.round(stats.revenue * 100) / 100,
      };
    }
  }

  // 2. Mesa / Canal / Ubicación líder (Top Table / Channel)
  const excludedTables = new Set(["Domicilio", "Llevar", "Para Llevar", "Visita Técnica"]);
  const tableCounts = new Map<string, number>();

  for (const order of orders) {
    const rawTable = (order.tableName || "").trim();
    if (vertical === "restaurante") {
      if (!excludedTables.has(rawTable) && !rawTable.toLowerCase().includes("visita")) {
        tableCounts.set(rawTable, (tableCounts.get(rawTable) || 0) + 1);
      }
    } else {
      // Para verticales no gastronómicas, contabilizar canales y modalidades
      if (rawTable) {
        tableCounts.set(rawTable, (tableCounts.get(rawTable) || 0) + 1);
      }
    }
  }

  let topTable: { name: string; orderCount: number } | null = null;
  for (const [name, count] of tableCounts.entries()) {
    if (!topTable || count > topTable.orderCount) {
      topTable = {
        name: vertical === "restaurante" ? (name.startsWith("Mesa") ? name : `Mesa ${name}`) : name,
        orderCount: count,
      };
    }
  }

  // 3. Distribución por Canales
  let dineInCount = 0;
  let dineInRev = 0;
  let takeoutCount = 0;
  let takeoutRev = 0;
  let deliveryCount = 0;
  let deliveryRev = 0;

  for (const order of orders) {
    const t = (order.tableName || "").trim();
    const orderTotal = order.total || 0;

    if (t === "Domicilio") {
      deliveryCount += 1;
      deliveryRev += orderTotal;
    } else if (t === "Llevar" || t === "Para Llevar") {
      takeoutCount += 1;
      takeoutRev += orderTotal;
    } else {
      dineInCount += 1;
      dineInRev += orderTotal;
    }
  }

  // Fallback si no hubo mesas pero sí pedidos en canales en verticales no gastronómicas
  if (!topTable && vertical !== "restaurante" && totalOrders > 0) {
    if (deliveryCount >= dineInCount && deliveryCount >= takeoutCount && deliveryCount > 0) {
      topTable = { name: labels.channel2Label, orderCount: deliveryCount };
    } else if (takeoutCount >= dineInCount && takeoutCount > 0) {
      topTable = { name: labels.channel1Label, orderCount: takeoutCount };
    } else if (dineInCount > 0) {
      topTable = { name: labels.channel3Label, orderCount: dineInCount };
    }
  }

  const calcPercentage = (count: number) =>
    totalOrders > 0 ? Math.round(((count / totalOrders) * 100) * 10) / 10 : 0;

  const channelDistribution = {
    dineIn: {
      count: dineInCount,
      percentage: calcPercentage(dineInCount),
      revenue: Math.round(dineInRev * 100) / 100,
    },
    takeout: {
      count: takeoutCount,
      percentage: calcPercentage(takeoutCount),
      revenue: Math.round(takeoutRev * 100) / 100,
    },
    delivery: {
      count: deliveryCount,
      percentage: calcPercentage(deliveryCount),
      revenue: Math.round(deliveryRev * 100) / 100,
    },
  };

  const formattedRange = range ? range.formattedRange : `${start.toLocaleDateString()} - ${end.toLocaleDateString()}`;
  const weekNumber = range ? range.weekNumber : 1;
  const year = range ? range.year : start.getFullYear();

  return {
    restaurantId: restaurant.id,
    restaurantName: restaurant.name,
    restaurantSlug: restaurant.slug,
    vertical,
    labels,
    period: {
      startDate: start.toISOString(),
      endDate: end.toISOString(),
      formattedRange,
      weekNumber,
      year,
    },
    financials: {
      totalRevenue,
      totalOrders,
      averageTicket,
    },
    topDish,
    topTable,
    channelDistribution,
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Itera sobre todos los restaurantes activos y genera su consolidado semanal.
 * Devuelve únicamente aquellos restaurantes con actividad o configuración válida.
 */
export async function generateAllActiveRestaurantsWeeklySummaries(
  startDate?: Date,
  endDate?: Date
): Promise<WeeklyMetricsSummary[]> {
  const activeRestaurants = await prisma.restaurant.findMany({
    where: {
      isSuspended: false,
    },
    select: { id: true },
    orderBy: { createdAt: "asc" },
  });

  const summaries: WeeklyMetricsSummary[] = [];

  for (const r of activeRestaurants) {
    try {
      const summary = await calculateWeeklyMetrics(r.id, startDate, endDate);
      if (summary) {
        summaries.push(summary);
      }
    } catch (error) {
      console.error(`Error calculando métricas semanales para restaurante ${r.id}:`, error);
    }
  }

  return summaries;
}
