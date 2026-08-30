import { getSuperAdminSession } from "@/lib/auth";
import { prismaControl, prismaTenant } from "@/lib/db";
import { SuperAdminLoginForm } from "./components/SuperAdminLoginForm";
import { SuperAdminDashboard } from "./components/SuperAdminDashboard";

export const dynamic = "force-dynamic";

export default async function SuperAdminPage() {
  const isSuperAdmin = await getSuperAdminSession();

  if (!isSuperAdmin) {
    return <SuperAdminLoginForm />;
  }

  // Load all restaurants
  const restaurants = await prismaTenant.restaurant.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      _count: {
        select: { categories: true }
      }
    }
  });

  // Load users to match owner details
  const userIds = [...new Set(restaurants.map((r) => r.userId))];
  const users = await prismaControl.user.findMany({
    where: { id: { in: userIds } },
  });
  const userMap = new Map(users.map((u) => [u.id, u]));

  // Load all prospect leads
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

  // Calculate metrics
  const now = new Date();
  const totalRestaurants = restaurants.length;
  const activeTrials = restaurants.filter(r => new Date(r.trialEndsAt) > now).length;
  const expiredTrials = totalRestaurants - activeTrials;

  const totalCategories = await prismaTenant.category.count();
  const totalDishes = await prismaTenant.dish.count();

  const metrics = {
    totalRestaurants,
    activeTrials,
    expiredTrials,
    totalCategories,
    totalDishes
  };

  // Serialize dates for Client Boundary
  const serializedRestaurants = restaurants.map((r: any) => {
    const owner = userMap.get(r.userId) as any;
    return {
      ...r,
      userName: owner?.name || "Usuario",
      email: owner?.email || "",
      whatsappNumber: r.whatsapp,
      qrCobroUrl: r.qrCobroUrl,
      leadStatus: r.leadStatus || "LEAD_NUEVO",
      nextFollowUpAt: r.nextFollowUpAt ? r.nextFollowUpAt.toISOString() : null,
      crmNotes: [],
      createdAt: r.createdAt.toISOString(),
      trialEndsAt: r.trialEndsAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    };
  });

  const serializedLeads = leads.map(l => ({
    ...l,
    nextFollowUpAt: l.nextFollowUpAt ? l.nextFollowUpAt.toISOString() : null,
    crmNotes: (l.crmNotes || []).map((n: any) => ({
      ...n,
      createdAt: n.createdAt.toISOString()
    })),
    createdAt: l.createdAt.toISOString(),
    updatedAt: l.updatedAt.toISOString(),
  }));

  let whatsappSupport = "";
  try {
    const whatsappSupportSetting = await prismaControl.systemSetting.findUnique({
      where: { key: "whatsapp_support" }
    });
    whatsappSupport = whatsappSupportSetting?.value || "";
  } catch (error) {
    console.warn("WARNING: SystemSetting table is missing or not migrated yet.", error);
  }

  return (
    <SuperAdminDashboard 
      restaurants={serializedRestaurants as any}
      leads={serializedLeads}
      metrics={metrics} 
      whatsappSupport={whatsappSupport}
    />
  );
}
