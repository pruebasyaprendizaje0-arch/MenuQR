import { getUserSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import { AdminDashboard } from "./components/AdminDashboard";

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

export default async function AdminPage() {
  let session: any = null;
  try {
    session = await getUserSession();
  } catch (err) {
    console.error("Error fetching user session in AdminPage:", err);
  }

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
    try {
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
    } catch (err) {
      console.error("Error creating default restaurant:", err);
    }
    
    redirect("/admin/restaurante");
  }

  const serializedRestaurant = {
    ...restaurant,
    logoUrl: restaurant.logoUrl,
    whatsappNumber: restaurant.whatsapp,
    paymentQrUrl: restaurant.qrCobroUrl,
    coverUrl: (restaurant as any).coverUrl ?? null,
    trialEndsAt: toIso(restaurant.trialEndsAt),
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
    categories: (restaurant.categories || []).map((c: any) => ({
      ...c,
      dishes: (c.dishes || []).map((d: any) => ({
        ...d,
        description: d.description || null,
        imageUrl: d.imageUrl || null
      }))
    })),
    orders: (restaurant.orders ?? []).map((o: any) => ({
      ...o,
      createdAt: toIso(o.createdAt),
      updatedAt: toIso(o.updatedAt),
      items: o.items || []
    })),
    seasonRates: ((restaurant as any).seasonRates ?? []).map((sr: any) => ({
      ...sr,
      startDate: toIso(sr.startDate).split("T")[0],
      endDate: toIso(sr.endDate).split("T")[0],
      createdAt: toIso(sr.createdAt),
      updatedAt: toIso(sr.updatedAt),
    })),
    customers: ((restaurant as any).customers ?? []).map((c: any) => ({
      ...c,
      lastOrderAt: toIso(c.lastOrderAt),
      createdAt: toIso(c.createdAt),
      updatedAt: toIso(c.updatedAt),
    }))
  };

  return <AdminDashboard restaurant={serializedRestaurant as unknown as Parameters<typeof AdminDashboard>[0]["restaurant"]} />;
}
