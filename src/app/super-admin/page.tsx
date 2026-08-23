import { getSuperAdminSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { SuperAdminLoginForm } from "./components/SuperAdminLoginForm";
import { SuperAdminDashboard } from "./components/SuperAdminDashboard";

export const dynamic = "force-dynamic";

export default async function SuperAdminPage() {
  const isSuperAdmin = await getSuperAdminSession();

  if (!isSuperAdmin) {
    return <SuperAdminLoginForm />;
  }

  // Load all restaurants with user and CRM notes
  const restaurants = await prisma.restaurant.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      user: true,
      crmNotes: {
        orderBy: { createdAt: "desc" }
      },
      _count: {
        select: { categories: true }
      }
    }
  });

  // Load all prospect leads
  let leads: any[] = [];
  try {
    leads = await prisma.lead.findMany({
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

  const totalCategories = await prisma.category.count();
  const totalDishes = await prisma.dish.count();

  const metrics = {
    totalRestaurants,
    activeTrials,
    expiredTrials,
    totalCategories,
    totalDishes
  };

  // Serialize dates for Client Boundary
  const serializedRestaurants = restaurants.map(r => ({
    ...r,
    userName: r.user.name,
    email: r.user.email,
    whatsappNumber: r.whatsapp,
    qrCobroUrl: r.qrCobroUrl,
    leadStatus: (r as any).leadStatus || "LEAD_NUEVO",
    nextFollowUpAt: (r as any).nextFollowUpAt ? (r as any).nextFollowUpAt.toISOString() : null,
    crmNotes: (r.crmNotes || []).map(n => ({
      ...n,
      createdAt: n.createdAt.toISOString()
    })),
    createdAt: r.createdAt.toISOString(),
    trialEndsAt: r.trialEndsAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  }));

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
    const whatsappSupportSetting = await prisma.systemSetting.findUnique({
      where: { key: "whatsapp_support" }
    });
    whatsappSupport = whatsappSupportSetting?.value || "";
  } catch (error) {
    console.warn("WARNING: SystemSetting table is missing or not migrated yet.", error);
  }

  return (
    <SuperAdminDashboard 
      restaurants={serializedRestaurants}
      leads={serializedLeads}
      metrics={metrics} 
      whatsappSupport={whatsappSupport}
    />
  );
}
