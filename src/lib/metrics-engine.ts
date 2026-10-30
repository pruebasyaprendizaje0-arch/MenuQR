import { prisma } from "@/lib/prisma";

export interface ChannelMetrics {
  count: number;
  percentage: number;
  revenue: number;
}

export interface WeeklyMetricsSummary {
  restaurantId: string;
  restaurantName: string;
  restaurantSlug: string;
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
    },
  });

  if (!restaurant) {
    return null;
  }

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

  // 1. Plato estrella (Top Dish)
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

  // 2. Mesa más usada (Top Table)
  // Excluyendo modalidades no presenciales
  const excludedTables = new Set(["Domicilio", "Llevar", "Para Llevar", "Visita Técnica"]);
  const tableCounts = new Map<string, number>();

  for (const order of orders) {
    const rawTable = (order.tableName || "").trim();
    if (!excludedTables.has(rawTable) && !rawTable.toLowerCase().includes("visita")) {
      tableCounts.set(rawTable, (tableCounts.get(rawTable) || 0) + 1);
    }
  }

  let topTable: { name: string; orderCount: number } | null = null;
  for (const [name, count] of tableCounts.entries()) {
    if (!topTable || count > topTable.orderCount) {
      topTable = {
        name: name.startsWith("Mesa") ? name : `Mesa ${name}`,
        orderCount: count,
      };
    }
  }

  // 3. Distribución por Canales (Salón vs Para Llevar vs Domicilio)
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
