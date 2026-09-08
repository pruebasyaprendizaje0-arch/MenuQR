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

export default async function SuperAdminPage() {
  let isSuperAdmin = false;
  try {
    isSuperAdmin = await getSuperAdminSession();
  } catch (e) {
    console.error("Error reading super admin session:", e);
  }

  if (!isSuperAdmin) {
    return <SuperAdminLoginForm />;
  }

  // Load all restaurants
  let restaurants: any[] = [];
  try {
    restaurants = await prismaTenant.restaurant.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        _count: {
          select: { categories: true }
        }
      }
    });
  } catch (err) {
    console.error("Error loading restaurants in SuperAdminPage:", err);
  }

  let manualPayments: any[] = [];
  try {
    manualPayments = await prismaTenant.manualSubscriptionPayment.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
      include: { restaurant: { select: { id: true, name: true, slug: true } } },
    });
  } catch (err) {
    console.error("Error loading manual subscription payments:", err);
  }

  // Load all registered users
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
      nextFollowUpAt: r.nextFollowUpAt ? toIso(r.nextFollowUpAt) : null,
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
    />
  );
}
