import { getUserSession, getCentralApiToken } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import { AdminDashboard } from "./components/AdminDashboard";
import { centralApiService, isCentralApiEnabled } from "@/lib/api-service";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const session = await getUserSession();

  if (!session) {
    redirect("/login");
  }

  // Si la API Central está habilitada y tenemos token
  const token = (session as any).token || (await getCentralApiToken());
  if (isCentralApiEnabled() && token) {
    try {
      if (process.env.NODE_ENV === "development") {
        console.log(`[AdminPage] Consultando GET /v1/businesses a la API Central (token: ${token.substring(0, 12)}...)`);
      }
      const bizRes = await centralApiService.getBusinesses(token);
      let businessList = Array.isArray(bizRes) ? bizRes : bizRes?.businesses || bizRes?.data || [];
      
      let biz = businessList[0];
      if (!biz) {
        // Si el usuario no tiene negocio en la API central, creamos uno
        biz = await centralApiService.createBusiness({ name: "Mi Restaurante", slug: `restaurante-${session.userId.substring(0, 5)}` }, token);
      }

      const businessId = biz.id || biz.slug;
      let branches = await centralApiService.getBranches(businessId, token);
      let branchList = Array.isArray(branches) ? branches : branches?.branches || branches?.data || [];
      let branch = branchList[0];

      let categories = [];
      let products = [];
      let orders = [];

      if (branch) {
        const branchId = branch.id;
        try {
          const catRes = await centralApiService.getCategories(branchId, token);
          categories = Array.isArray(catRes) ? catRes : catRes?.categories || [];
        } catch {}

        try {
          const prodRes = await centralApiService.getProducts(branchId, token);
          products = Array.isArray(prodRes) ? prodRes : prodRes?.products || [];
        } catch {}

        try {
          const ordRes = await centralApiService.getOrders(branchId, token);
          orders = Array.isArray(ordRes) ? ordRes : ordRes?.orders || [];
        } catch {}
      }

      // Estructurar categorías con productos (dishes)
      const mappedCategories = categories.map((c: any) => ({
        id: c.id,
        name: c.name,
        order: c.order ?? 0,
        isActive: c.isActive ?? true,
        dishes: products
          .filter((p: any) => p.categoryId === c.id)
          .map((p: any) => ({
            id: p.id,
            name: p.name,
            description: p.description || null,
            price: p.price,
            imageUrl: p.imageUrl || null,
            isAvailable: p.isAvailable ?? true,
          })),
      }));

      const serializedRestaurant = {
        id: branch?.id || biz.id || session.userId,
        name: biz.name || "Mi Restaurante",
        slug: biz.slug || `restaurante-${session.userId.substring(0, 5)}`,
        logoUrl: biz.logoUrl || null,
        coverUrl: biz.coverUrl || null,
        whatsappNumber: biz.whatsapp || "",
        paymentQrUrl: null,
        trialEndsAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
        tablesConfig: "1,2,3,4,5,6,7,8,9,10",
        ivaPercent: branch?.ivaPercent ?? 15,
        servicePercent: branch?.servicePercent ?? 10,
        deliveryCost: branch?.deliveryCost ?? 0.0,
        deliveryEnabled: true,
        bankName: null,
        bankAccountType: null,
        bankAccountNumber: null,
        bankAccountName: null,
        bankAccountDocument: null,
        bankAccountEmail: null,
        ivaOnTable: true,
        ivaOnTakeout: true,
        serviceOnTable: true,
        serviceOnTakeout: false,
        categories: mappedCategories,
        orders: orders.map((o: any) => ({
          ...o,
          createdAt: typeof o.createdAt === "string" ? o.createdAt : new Date(o.createdAt).toISOString(),
          updatedAt: typeof o.updatedAt === "string" ? o.updatedAt : new Date(o.updatedAt).toISOString(),
          items: o.items || [],
        })),
        seasonRates: [],
        customers: [],
      };

      return <AdminDashboard restaurant={serializedRestaurant as unknown as Parameters<typeof AdminDashboard>[0]["restaurant"]} />;
    } catch (err) {
      if (process.env.NODE_ENV === "development") {
        console.warn("[AdminPage Warning] Central API query failed, falling back to local Prisma:", err);
      }
    }
  }

  // Fallback a Prisma local
  try {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    await prisma.order.deleteMany({
      where: {
        createdAt: {
          lt: twentyFourHoursAgo,
        },
      },
    });
  } catch (err) {
    console.error("Error cleaning up old orders:", err);
  }

  const restaurant = await prisma.restaurant.findFirst({
    where: { userId: session.userId },
    include: {
      categories: {
        orderBy: { order: "asc" },
        include: {
          dishes: {
            orderBy: { createdAt: "desc" },
          },
        },
      },
      orders: {
        orderBy: { createdAt: "desc" },
        include: {
          items: true
        }
      },
      seasonRates: {
        orderBy: { startDate: "asc" }
      },
      customers: {
        orderBy: { lastOrderAt: "desc" }
      }
    },
  });

  if (!restaurant) {
    const cleanSlug = `restaurante-${session.userId.substring(0, 5)}`;
    await prisma.restaurant.create({
      data: {
        userId: session.userId,
        name: "Mi Restaurante",
        slug: cleanSlug,
        whatsapp: "",
        themeColor: "#ef4444",
        plan: "FREE",
      },
    });
    
    redirect("/admin/restaurante");
  }

  const serializedRestaurant = {
    ...restaurant,
    logoUrl: restaurant.logoUrl,
    whatsappNumber: restaurant.whatsapp,
    paymentQrUrl: restaurant.qrCobroUrl,
    coverUrl: (restaurant as any).coverUrl ?? null,
    trialEndsAt: restaurant.trialEndsAt.toISOString(),
    tablesConfig: (restaurant as any).tablesConfig ?? "1,2,3,4,5,6,7,8,9,10",
    ivaPercent: (restaurant as any).ivaPercent ?? 15,
    servicePercent: (restaurant as any).servicePercent ?? 10,
    deliveryCost: (restaurant as any).deliveryCost ?? 0.0,
    deliveryEnabled: (restaurant as any).deliveryEnabled ?? true,
    bankName: (restaurant as any).bankName ?? null,
    bankAccountType: (restaurant as any).bankAccountType ?? null,
    bankAccountNumber: (restaurant as any).bankAccountNumber ?? null,
    bankAccountName: (restaurant as any).bankAccountName ?? null,
    bankAccountDocument: (restaurant as any).bankAccountDocument ?? null,
    bankAccountEmail: (restaurant as any).bankAccountEmail ?? null,
    ivaOnTable: (restaurant as any).ivaOnTable ?? true,
    ivaOnTakeout: (restaurant as any).ivaOnTakeout ?? true,
    serviceOnTable: (restaurant as any).serviceOnTable ?? true,
    serviceOnTakeout: (restaurant as any).serviceOnTakeout ?? false,
    categories: restaurant.categories.map(c => ({
      ...c,
      dishes: c.dishes.map(d => ({
        ...d,
        description: d.description || null,
        imageUrl: d.imageUrl || null
      }))
    })),
    orders: (restaurant.orders ?? []).map(o => ({
      ...o,
      createdAt: o.createdAt.toISOString(),
      updatedAt: o.updatedAt.toISOString(),
      items: o.items
    })),
    seasonRates: ((restaurant as any).seasonRates ?? []).map((sr: any) => ({
      ...sr,
      startDate: sr.startDate.toISOString().split("T")[0],
      endDate: sr.endDate.toISOString().split("T")[0],
      createdAt: sr.createdAt.toISOString(),
      updatedAt: sr.updatedAt.toISOString(),
    })),
    customers: ((restaurant as any).customers ?? []).map((c: any) => ({
      ...c,
      lastOrderAt: c.lastOrderAt ? c.lastOrderAt.toISOString() : c.createdAt.toISOString(),
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
    }))
  };

  return <AdminDashboard restaurant={serializedRestaurant as unknown as Parameters<typeof AdminDashboard>[0]["restaurant"]} />;
}
