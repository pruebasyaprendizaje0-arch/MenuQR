import { getUserSession, getSuperAdminSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

export default async function MesasRootPage() {
  const session = await getUserSession();
  const isSuperAdmin = await getSuperAdminSession();

  if (!session && !isSuperAdmin) {
    redirect("/login");
  }

  const cookieStore = await cookies();
  const sessionUserId = session?.userId || "";
  const activeRestId = session?.restaurantId || cookieStore.get("active_restaurant_id")?.value;

  let restaurant = null;

  // 1. Prioridad estricta al negocio activo actual (en sesión o cookie)
  if (activeRestId) {
    restaurant = await prisma.restaurant.findFirst({
      where: isSuperAdmin
        ? { id: activeRestId }
        : { id: activeRestId, ...(sessionUserId ? { userId: sessionUserId } : {}) },
      select: { slug: true },
    });
  }

  // 2. Si no hay negocio activo específico, buscar un negocio del usuario que sea restaurante
  if (!restaurant && sessionUserId) {
    restaurant = await prisma.restaurant.findFirst({
      where: {
        userId: sessionUserId,
        OR: [
          { businessType: "RESTAURANT" },
          { enableTableOrdering: true },
        ],
      },
      orderBy: { createdAt: "asc" },
      select: { slug: true },
    });

    // 3. Fallback al primer negocio del usuario
    if (!restaurant) {
      restaurant = await prisma.restaurant.findFirst({
        where: { userId: sessionUserId },
        orderBy: { createdAt: "asc" },
        select: { slug: true },
      });
    }
  }

  // 4. Si es SuperAdmin sin sesión de usuario específica
  if (!restaurant && isSuperAdmin) {
    restaurant = await prisma.restaurant.findFirst({
      where: {
        OR: [
          { businessType: "RESTAURANT" },
          { enableTableOrdering: true },
        ],
      },
      orderBy: { createdAt: "asc" },
      select: { slug: true },
    });

    if (!restaurant) {
      restaurant = await prisma.restaurant.findFirst({
        orderBy: { createdAt: "asc" },
        select: { slug: true },
      });
    }
  }

  if (restaurant?.slug) {
    redirect(`/${restaurant.slug}/mesas`);
  }

  redirect("/admin");
}
