import { getUserSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import { AdminDashboard } from "./components/AdminDashboard";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const session = await getUserSession();

  if (!session) {
    redirect("/login");
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

  let restaurant: any = null;
  try {
    restaurant = await prisma.restaurant.findFirst({
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
  } catch (err) {
    console.error("Error fetching restaurant for admin page:", err);
    restaurant = null;
  }

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
