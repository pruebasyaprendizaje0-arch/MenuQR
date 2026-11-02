import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyInternalApiKey } from "@/lib/internal-auth";
import { createNotification } from "@/lib/notifications";

export interface SubscriptionCheckItem {
  id: string;
  name: string;
  slug: string;
  plan: string;
  whatsapp: string | null;
  trialEndsAt: string | null;
  diffDays: number;
  status: "ACTIVE" | "EXPIRING" | "OVERDUE" | "SUSPENDED" | "NO_EXPIRATION";
  isSuspended: boolean;
  suspendedReason: string | null;
  user: {
    id: string;
    name: string;
    email: string;
  };
  suggestedNotification: {
    restaurantId: string;
    restaurantSlug: string;
    type: "WARNING_EXPIRING" | "SUSPENDED";
    priority: "LOW" | "NORMAL" | "HIGH" | "URGENT";
    title: string;
    message: string;
    actionUrl: string;
    actionLabel: string;
    source: string;
  };
}

/**
 * Lógica central para auditar y clasificar el estado de las suscripciones.
 */
async function processSubscriptionChecks(options: {
  daysThreshold?: number;
  statusFilter?: string;
  restaurantId?: string | null;
  restaurantSlug?: string | null;
  autoNotify?: boolean;
}) {
  const daysThreshold = typeof options.daysThreshold === "number" && !isNaN(options.daysThreshold)
    ? options.daysThreshold
    : 5;
  const statusFilter = (options.statusFilter || "ACTION_REQUIRED").toUpperCase();
  const now = new Date();

  // 1. Consulta en PostgreSQL con Prisma
  const restaurants = await prisma.restaurant.findMany({
    where: {
      ...(options.restaurantId ? { id: options.restaurantId } : {}),
      ...(options.restaurantSlug ? { slug: options.restaurantSlug } : {}),
    },
    select: {
      id: true,
      name: true,
      slug: true,
      whatsapp: true,
      plan: true,
      trialEndsAt: true,
      isSuspended: true,
      suspendedReason: true,
      leadStatus: true,
      createdAt: true,
      user: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
    orderBy: {
      trialEndsAt: "asc",
    },
  });

  // 2. Clasificación y cálculo de métricas de vencimiento
  let totalActive = 0;
  let totalExpiringSoon = 0;
  let totalOverdue = 0;
  let totalSuspended = 0;

  const processedList: SubscriptionCheckItem[] = restaurants.map((r) => {
    const trialEnd = r.trialEndsAt ? new Date(r.trialEndsAt) : null;
    let diffDays = 0;
    if (trialEnd) {
      const diffMs = trialEnd.getTime() - now.getTime();
      diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    }

    const isSuspended = Boolean(r.isSuspended);
    let status: SubscriptionCheckItem["status"];

    if (isSuspended) {
      status = "SUSPENDED";
      totalSuspended++;
    } else if (!trialEnd) {
      status = "NO_EXPIRATION";
      totalActive++;
    } else if (diffDays < 0) {
      status = "OVERDUE";
      totalOverdue++;
    } else if (diffDays <= daysThreshold) {
      status = "EXPIRING";
      totalExpiringSoon++;
    } else {
      status = "ACTIVE";
      totalActive++;
    }

    // Payload sugerido 100% compatible con /api/internal/notifications/create
    const isUrgent = diffDays <= 1 || status === "OVERDUE" || status === "SUSPENDED";
    const suggestedType = status === "OVERDUE" || status === "SUSPENDED" ? "SUSPENDED" : "WARNING_EXPIRING";

    let title = "";
    let message = "";

    if (status === "OVERDUE") {
      title = `Tu suscripción de ${r.name} ha vencido`;
      message = `El periodo de tu plan ${r.plan} para "${r.name}" finalizó el ${trialEnd?.toLocaleDateString("es-ES")}. Renueva ahora para mantener tu menú digital y pedidos online activos sin interrupción.`;
    } else if (status === "SUSPENDED") {
      title = `El menú de ${r.name} está pausado`;
      message = `El servicio de tu catálogo está temporalmente suspendido. Motivo: ${r.suspendedReason || "Mora en pago de suscripción"}. Contacta a soporte para reactivarlo inmediatamente.`;
    } else if (diffDays === 0) {
      title = `¡Atención! Tu plan de ${r.name} vence hoy`;
      message = `Hoy finaliza tu periodo activo en MenuQR Pro (${r.plan}). Renueva hoy para evitar la desconexión del menú digital en mesas y delivery.`;
    } else {
      title = `Tu suscripción de ${r.name} vence en ${diffDays} día${diffDays > 1 ? "s" : ""}`;
      message = `Te recordamos que tu período de ${r.plan} para "${r.name}" finaliza en ${diffDays} días (${trialEnd?.toLocaleDateString("es-ES")}). Renueva tu suscripción para continuar recibiendo pedidos.`;
    }

    return {
      id: r.id,
      name: r.name,
      slug: r.slug,
      plan: r.plan,
      whatsapp: r.whatsapp || null,
      trialEndsAt: trialEnd ? trialEnd.toISOString() : null,
      diffDays,
      status,
      isSuspended,
      suspendedReason: r.suspendedReason || null,
      user: {
        id: r.user.id,
        name: r.user.name,
        email: r.user.email,
      },
      suggestedNotification: {
        restaurantId: r.id,
        restaurantSlug: r.slug,
        type: suggestedType,
        priority: isUrgent ? "URGENT" : "HIGH",
        title,
        message,
        actionUrl: "/admin?tab=subscription",
        actionLabel: "Renovar Plan",
        source: "N8N_SUBSCRIPTION_CHECK",
      },
    };
  });

  // 3. Filtrado según parámetro status
  let filteredData = processedList;
  if (statusFilter === "ACTION_REQUIRED") {
    // Por defecto retorna aquellos que requieren atención de n8n / ventas: por vencer o vencidos
    filteredData = processedList.filter((item) => item.status === "EXPIRING" || item.status === "OVERDUE");
  } else if (statusFilter === "EXPIRING") {
    filteredData = processedList.filter((item) => item.status === "EXPIRING");
  } else if (statusFilter === "OVERDUE" || statusFilter === "EXPIRED") {
    filteredData = processedList.filter((item) => item.status === "OVERDUE");
  } else if (statusFilter === "SUSPENDED") {
    filteredData = processedList.filter((item) => item.status === "SUSPENDED");
  } else if (statusFilter === "ACTIVE") {
    filteredData = processedList.filter((item) => item.status === "ACTIVE");
  }
  // Si statusFilter === "ALL", no se filtra nada.

  // 4. AutoNotificación opcional (si autoNotify === true)
  const notificationsCreated: Array<{ restaurantId: string; notificationId?: string; status: string }> = [];
  if (options.autoNotify && filteredData.length > 0) {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    for (const item of filteredData) {
      if (item.status === "EXPIRING" || item.status === "OVERDUE" || item.status === "SUSPENDED") {
        // Prevenir spam: comprobar si ya se envió una notificación similar en las últimas 24h
        const recentNotif = await prisma.inAppNotification.findFirst({
          where: {
            restaurantId: item.id,
            type: item.suggestedNotification.type,
            createdAt: { gte: twentyFourHoursAgo },
          },
        });

        if (!recentNotif) {
          const createRes = await createNotification(item.suggestedNotification);
          notificationsCreated.push({
            restaurantId: item.id,
            notificationId: createRes.notificationId,
            status: createRes.success ? "CREATED" : `ERROR: ${createRes.error}`,
          });
        } else {
          notificationsCreated.push({
            restaurantId: item.id,
            notificationId: recentNotif.id,
            status: "SKIPPED_ALREADY_NOTIFIED_RECENTLY",
          });
        }
      }
    }
  }

  return {
    success: true,
    timestamp: now.toISOString(),
    summary: {
      total: restaurants.length,
      active: totalActive,
      expiringSoon: totalExpiringSoon,
      overdue: totalOverdue,
      suspended: totalSuspended,
    },
    filterApplied: {
      daysThreshold,
      status: statusFilter,
      restaurantId: options.restaurantId || null,
      restaurantSlug: options.restaurantSlug || null,
    },
    count: filteredData.length,
    data: filteredData,
    ...(options.autoNotify ? { notificationsCreated } : {}),
  };
}

/**
 * Handler GET: Consultar cuentas por vencer / vencidas vía parámetros URL.
 * Ej: GET /api/internal/subscriptions/check-status?status=EXPIRING&daysThreshold=5
 */
export async function GET(req: NextRequest) {
  if (!verifyInternalApiKey(req)) {
    return NextResponse.json(
      { success: false, error: "No autorizado. Token de API interno inválido o ausente." },
      { status: 401 }
    );
  }

  try {
    const { searchParams } = req.nextUrl;
    const daysThresholdParam = searchParams.get("daysThreshold");
    const statusFilter = searchParams.get("status") || "ACTION_REQUIRED";
    const restaurantId = searchParams.get("restaurantId");
    const restaurantSlug = searchParams.get("restaurantSlug");
    const autoNotify = searchParams.get("autoNotify") === "true";

    const daysThreshold = daysThresholdParam ? parseInt(daysThresholdParam, 10) : 5;

    const result = await processSubscriptionChecks({
      daysThreshold,
      statusFilter,
      restaurantId,
      restaurantSlug,
      autoNotify,
    });

    return NextResponse.json(result, { status: 200 });
  } catch (error: any) {
    console.error("Error en GET /api/internal/subscriptions/check-status:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Error interno al verificar estado de suscripciones",
        message: error?.message || "Error desconocido",
      },
      { status: 500 }
    );
  }
}

/**
 * Handler POST: Mismo procesamiento pero admitiendo cuerpo JSON para flujos n8n.
 * Ej: POST /api/internal/subscriptions/check-status con { "status": "EXPIRING", "daysThreshold": 5 }
 */
export async function POST(req: NextRequest) {
  if (!verifyInternalApiKey(req)) {
    return NextResponse.json(
      { success: false, error: "No autorizado. Token de API interno inválido o ausente." },
      { status: 401 }
    );
  }

  try {
    const body = await req.json().catch(() => ({}));
    const daysThreshold = typeof body?.daysThreshold === "number" ? body.daysThreshold : 5;
    const statusFilter = body?.status || "ACTION_REQUIRED";
    const restaurantId = body?.restaurantId || null;
    const restaurantSlug = body?.restaurantSlug || null;
    const autoNotify = Boolean(body?.autoNotify);

    const result = await processSubscriptionChecks({
      daysThreshold,
      statusFilter,
      restaurantId,
      restaurantSlug,
      autoNotify,
    });

    return NextResponse.json(result, { status: 200 });
  } catch (error: any) {
    console.error("Error en POST /api/internal/subscriptions/check-status:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Error interno al verificar estado de suscripciones",
        message: error?.message || "Error desconocido",
      },
      { status: 500 }
    );
  }
}
