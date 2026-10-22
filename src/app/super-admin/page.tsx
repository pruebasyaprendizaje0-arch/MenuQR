import { getSuperAdminSession } from "@/lib/auth";
import { prismaControl, prismaTenant } from "@/lib/db";
import { SuperAdminLoginForm } from "./components/SuperAdminLoginForm";
import { SuperAdminDashboard } from "./components/SuperAdminDashboard";

export const dynamic = "force-dynamic";

function toIso(val: any): string {
  if (!val) return new Date().toISOString();
  if (typeof val === "string") return val;
  if (val instanceof Date) return val.toISOString();
  try {
    return new Date(val).toISOString();
  } catch {
    return new Date().toISOString();
  }
}

export default async function SuperAdminPage({
  searchParams,
}: {
  searchParams?: Promise<{ tab?: string }>;
}) {
  let isSuperAdmin = false;
  try {
    isSuperAdmin = await getSuperAdminSession();
  } catch (e) {
    console.error("Error reading super admin session:", e);
  }

  if (!isSuperAdmin) {
    return <SuperAdminLoginForm />;
  }

  const resolvedSearchParams = searchParams ? await searchParams : {};
  const validTabs = ["directory", "analytics", "announcements", "collections", "elite_ops", "kanban", "prospects", "reminders", "bots", "ops"];
  const initialTab = (
    resolvedSearchParams?.tab && validTabs.includes(resolvedSearchParams.tab)
  ) ? (resolvedSearchParams.tab as "directory" | "analytics" | "announcements" | "collections" | "elite_ops" | "kanban" | "prospects" | "reminders" | "bots" | "ops") : "directory";

  // Cargar todos los restaurantes incluyendo conteo de categorías, platos, fotos y órdenes para Health Score
  let restaurants: any[] = [];
  try {
    restaurants = await prismaTenant.restaurant.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        _count: {
          select: { categories: true, dishes: true, orders: true }
        },
        dishes: {
          select: { id: true, imageUrl: true }
        },
        orders: {
          select: { id: true, total: true, createdAt: true, status: true },
          take: 5,
          orderBy: { createdAt: "desc" }
        }
      }
    });
  } catch (err) {
    console.error("Error loading restaurants in SuperAdminPage:", err);
  }

  // Cargar tareas del Plan Elite (VIP Operations Queue)
  let eliteTasks: any[] = [];
  try {
    eliteTasks = await prismaTenant.eliteTask.findMany({
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      include: {
        restaurant: {
          select: { id: true, name: true, slug: true, plan: true, whatsapp: true, logoUrl: true }
        }
      }
    });
  } catch (err) {
    console.error("Error loading elite tasks in SuperAdminPage:", err);
  }

  let manualPayments: any[] = [];
  try {
    manualPayments = await prismaTenant.manualSubscriptionPayment.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
      include: { restaurant: { select: { id: true, name: true, slug: true } } },
    });
  } catch (err) {
    console.error("Error loading manual subscription payments:", err);
  }

  // Cargar usuarios registrados
  let allUsers: any[] = [];
  try {
    allUsers = await prismaControl.user.findMany({
      select: { id: true, name: true, email: true },
      orderBy: { email: "asc" }
    });
  } catch (err) {
    console.error("Error loading users in SuperAdminPage:", err);
  }
  const userMap = new Map(allUsers.map((u) => [u.id, u]));

  // Cargar prospectos / leads
  let leads: any[] = [];
  try {
    leads = await prismaControl.lead.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        crmNotes: {
          orderBy: { createdAt: "desc" }
        }
      }
    });
  } catch (err) {
    console.warn("Leads table query fallback", err);
  }

  // Calcular métricas
  const now = new Date();
  const totalRestaurants = restaurants.length;
  const activeTrials = restaurants.filter(r => r.trialEndsAt && new Date(r.trialEndsAt) > now).length;
  const expiredTrials = totalRestaurants - activeTrials;

  let totalCategories = 0;
  let totalDishes = 0;
  try {
    totalCategories = await prismaTenant.category.count();
    totalDishes = await prismaTenant.dish.count();
  } catch (err) {
    console.error("Error counting categories/dishes:", err);
  }

  let gmvTotal = 0;
  let totalOrdersCount = 0;
  let ordersLast30DaysGmv = 0;
  let ordersLast30DaysCount = 0;
  const analyticsEventStats = {
    qrScans: 0,
    menuViews: 0,
    whatsappClicks: 0,
    dishViews: 0,
    totalEvents: 0,
  };

  try {
    const orderAgg = await prismaTenant.order.aggregate({
      where: { status: { not: "CANCELLED" } },
      _sum: { total: true },
      _count: { id: true },
    });
    gmvTotal = orderAgg._sum.total || 0;
    totalOrdersCount = orderAgg._count.id || 0;

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const orderAgg30 = await prismaTenant.order.aggregate({
      where: {
        status: { not: "CANCELLED" },
        createdAt: { gte: thirtyDaysAgo },
      },
      _sum: { total: true },
      _count: { id: true },
    });
    ordersLast30DaysGmv = orderAgg30._sum.total || 0;
    ordersLast30DaysCount = orderAgg30._count.id || 0;

    const eventCounts = await prismaTenant.analyticsEvent.groupBy({
      by: ["eventType"],
      _count: { id: true },
    });
    eventCounts.forEach((item) => {
      analyticsEventStats.totalEvents += item._count.id;
      if (item.eventType === "QR_SCAN") analyticsEventStats.qrScans = item._count.id;
      if (item.eventType === "MENU_VIEW" || item.eventType === "RESTAURANT_VIEW") analyticsEventStats.menuViews += item._count.id;
      if (item.eventType === "WHATSAPP_CLICK") analyticsEventStats.whatsappClicks += item._count.id;
      if (item.eventType === "DISH_VIEW") analyticsEventStats.dishViews += item._count.id;
    });
  } catch (err) {
    console.warn("Analytics / Order aggregation fallback:", err);
  }

  const metrics = {
    totalRestaurants,
    activeTrials,
    expiredTrials,
    totalCategories,
    totalDishes,
    gmvTotal,
    totalOrdersCount,
  };

  // Serialización para Client Boundary con métricas de salud (Health Score)
  const serializedRestaurants = restaurants.map((r: any) => {
    const owner = userMap.get(r.userId) as any;
    const totalDishes = r.dishes?.length || r._count?.dishes || 0;
    const dishesWithPhoto = (r.dishes || []).filter((d: any) => Boolean(d.imageUrl)).length;
    const photoPercentage = totalDishes > 0 ? Math.round((dishesWithPhoto / totalDishes) * 100) : 0;
    const totalOrders = r._count?.orders || (r.orders || []).length;
    const recentOrders = (r.orders || []).filter((o: any) => {
      const d = new Date(o.createdAt).getTime();
      return !isNaN(d) && d > (Date.now() - 7 * 86400000);
    }).length;
    const lastOrderDate = r.orders?.[0]?.createdAt ? toIso(r.orders[0].createdAt) : null;

    return {
      ...r,
      userName: owner?.name || "Usuario",
      email: owner?.email || "",
      whatsappNumber: r.whatsapp,
      whatsappBotEnabled: r.whatsappBotEnabled ?? true,
      qrCobroUrl: r.qrCobroUrl,
      leadStatus: r.leadStatus || "LEAD_NUEVO",
      nextFollowUpAt: r.nextFollowUpAt ? toIso(r.nextFollowUpAt) : null,
      lastMaintenanceAt: r.lastMaintenanceAt ? toIso(r.lastMaintenanceAt) : null,
      isSuspended: Boolean(r.isSuspended),
      suspendedReason: r.suspendedReason || null,
      health: {
        totalDishes,
        dishesWithPhoto,
        photoPercentage,
        totalOrders,
        recentOrders,
        lastOrderDate,
      },
      crmNotes: [],
      createdAt: toIso(r.createdAt),
      trialEndsAt: toIso(r.trialEndsAt),
      updatedAt: toIso(r.updatedAt),
    };
  });

  const serializedLeads = leads.map(l => ({
    ...l,
    nextFollowUpAt: l.nextFollowUpAt ? toIso(l.nextFollowUpAt) : null,
    crmNotes: (l.crmNotes || []).map((n: any) => ({
      ...n,
      createdAt: toIso(n.createdAt)
    })),
    createdAt: toIso(l.createdAt),
    updatedAt: toIso(l.updatedAt),
  }));

  const serializedEliteTasks = eliteTasks.map((task: any) => ({
    ...task,
    dueDate: task.dueDate ? toIso(task.dueDate) : null,
    completedAt: task.completedAt ? toIso(task.completedAt) : null,
    createdAt: toIso(task.createdAt),
    updatedAt: toIso(task.updatedAt),
  }));

  const serializedManualPayments = manualPayments.map((payment: any) => ({
    ...payment,
    createdAt: toIso(payment.createdAt),
    approvedAt: payment.approvedAt ? toIso(payment.approvedAt) : null,
    startsAt: payment.startsAt ? toIso(payment.startsAt) : null,
    expiresAt: payment.expiresAt ? toIso(payment.expiresAt) : null,
  }));

  let whatsappSupport = "";
  let subscriptionPaymentQrUrl = "";
  let subscriptionBankName = "";
  let subscriptionBankAccountType = "";
  let subscriptionBankAccountNumber = "";
  let subscriptionBankAccountName = "";
  let subscriptionBankAccountDocument = "";
  let subscriptionDeunaPhone = "";
  let globalAnnouncement = {
    text: "",
    type: "info" as "info" | "success" | "warning" | "promo",
    link: "",
    active: false,
    updatedAt: "",
  };

  try {
    const settings = await prismaControl.systemSetting.findMany({
      where: { key: { in: [
        "whatsapp_support",
        "subscription_payment_qr_url",
        "subscription_bank_name",
        "subscription_bank_account_type",
        "subscription_bank_account_number",
        "subscription_bank_account_name",
        "subscription_bank_account_document",
        "subscription_deuna_phone",
        "global_announcement_text",
        "global_announcement_type",
        "global_announcement_link",
        "global_announcement_active",
        "global_announcement_updated_at",
      ] } },
    });
    const settingValue = (key: string) => settings.find((setting) => setting.key === key)?.value || "";
    whatsappSupport = settingValue("whatsapp_support");
    subscriptionPaymentQrUrl = settingValue("subscription_payment_qr_url");
    subscriptionBankName = settingValue("subscription_bank_name");
    subscriptionBankAccountType = settingValue("subscription_bank_account_type");
    subscriptionBankAccountNumber = settingValue("subscription_bank_account_number");
    subscriptionBankAccountName = settingValue("subscription_bank_account_name");
    subscriptionBankAccountDocument = settingValue("subscription_bank_account_document");
    subscriptionDeunaPhone = settingValue("subscription_deuna_phone");

    const rawActive = settingValue("global_announcement_active");
    globalAnnouncement = {
      text: settingValue("global_announcement_text"),
      type: (settingValue("global_announcement_type") || "info") as any,
      link: settingValue("global_announcement_link"),
      active: rawActive === "true",
      updatedAt: settingValue("global_announcement_updated_at"),
    };
  } catch (error) {
    console.warn("WARNING: SystemSetting table is missing or not migrated yet.", error);
  }

  return (
    <SuperAdminDashboard 
      restaurants={serializedRestaurants as any}
      leads={serializedLeads}
      metrics={metrics} 
      whatsappSupport={whatsappSupport}
      subscriptionPaymentQrUrl={subscriptionPaymentQrUrl}
      subscriptionBankName={subscriptionBankName}
      subscriptionBankAccountType={subscriptionBankAccountType}
      subscriptionBankAccountNumber={subscriptionBankAccountNumber}
      subscriptionBankAccountName={subscriptionBankAccountName}
      subscriptionBankAccountDocument={subscriptionBankAccountDocument}
      subscriptionDeunaPhone={subscriptionDeunaPhone}
      allUsers={allUsers}
      manualPayments={serializedManualPayments}
      eliteTasks={serializedEliteTasks}
      initialTab={initialTab}
      analyticsData={{
        gmvTotal,
        totalOrdersCount,
        ordersLast30DaysGmv,
        ordersLast30DaysCount,
        analyticsEventStats,
      }}
      globalAnnouncement={globalAnnouncement}
    />
  );
}
