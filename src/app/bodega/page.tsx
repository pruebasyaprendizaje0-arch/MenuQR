import { getUserSession, getSuperAdminSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { BodegaMobileClient } from "./BodegaMobileClient";
import Link from "next/link";
import { Boxes, ArrowLeft } from "lucide-react";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Escáner Móvil de Bodega | MenuQR Pro",
  description: "Terminal móvil para escanear e ingresar productos a bodega con la cámara del teléfono o lector láser.",
};

export default async function BodegaPage() {
  const session = await getUserSession();
  const isSuperAdmin = await getSuperAdminSession();

  if (!session && !isSuperAdmin) {
    redirect("/login?next=/bodega");
  }

  const cookieStore = await cookies();
  const sessionUserId = session?.userId || "";
  const activeRestaurantId = session?.restaurantId || cookieStore.get("active_restaurant_id")?.value;

  type BodegaRestaurant = NonNullable<
    Awaited<
      ReturnType<
        typeof prisma.restaurant.findFirst<{
          select: {
            id: true;
            name: true;
            slug: true;
            themeColor: true;
            customLabels: true;
            businessType: true;
          };
        }>
      >
    >
  >;

  let restaurant: BodegaRestaurant | null = null;

  try {
    if (activeRestaurantId) {
      restaurant = await prisma.restaurant.findFirst({
        where: isSuperAdmin
          ? { id: activeRestaurantId }
          : { id: activeRestaurantId, ...(sessionUserId ? { userId: sessionUserId } : {}) },
        select: {
          id: true,
          name: true,
          slug: true,
          themeColor: true,
          customLabels: true,
          businessType: true,
        },
      });
    }

    if (!restaurant && sessionUserId) {
      restaurant = await prisma.restaurant.findFirst({
        where: { userId: sessionUserId },
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          name: true,
          slug: true,
          themeColor: true,
          customLabels: true,
          businessType: true,
        },
      });
    }

    if (!restaurant && isSuperAdmin) {
      restaurant = await prisma.restaurant.findFirst({
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          name: true,
          slug: true,
          themeColor: true,
          customLabels: true,
          businessType: true,
        },
      });
    }
  } catch (err) {
    console.error("Error querying restaurant in BodegaPage:", err);
  }

  if (!restaurant) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 rounded-3xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mb-4">
          <Boxes className="w-8 h-8" />
        </div>
        <h1 className="text-xl font-bold mb-2">No se encontró ningún negocio</h1>
        <p className="text-sm text-slate-400 max-w-sm mb-6">
          Necesitas tener al menos un negocio activo en tu cuenta para poder operar el Escáner de Bodega.
        </p>
        <Link
          href="/admin"
          className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-sm transition shadow-lg shadow-amber-600/20"
        >
          <ArrowLeft className="w-4 h-4" /> Ir al Panel de Control
        </Link>
      </div>
    );
  }

  // Traer categorías y todos los productos (incluso agotados para poder reingresar stock)
  let categories: Array<{ id: string; name: string }> = [];
  try {
    categories = await prisma.category.findMany({
      where: { restaurantId: restaurant.id },
      select: { id: true, name: true },
      orderBy: { order: "asc" },
    });
  } catch {}

  let dishes: Array<{
    id: string;
    name: string;
    price: number;
    costPrice?: number | null;
    imageUrl: string | null;
    barcode: string | null;
    sku: string | null;
    variants: any | null;
    stock: number | null;
    trackStock: boolean;
    isAvailable: boolean;
    categoryId: string | null;
    category?: { id: string; name: string } | null;
  }> = [];

  try {
    dishes = await prisma.dish.findMany({
      where: { restaurantId: restaurant.id },
      select: {
        id: true,
        name: true,
        price: true,
        costPrice: true,
        imageUrl: true,
        barcode: true,
        sku: true,
        variants: true,
        stock: true,
        trackStock: true,
        isAvailable: true,
        categoryId: true,
        category: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: { name: "asc" },
    });
  } catch (err) {
    console.error("Error querying dishes for BodegaPage:", err);
  }

  const currentUser = {
    id: session?.userId || "admin",
    name: session?.email?.split("@")[0] || "Bodeguero",
    email: session?.email || "bodega@ubicame.cc",
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <BodegaMobileClient
        restaurant={{
          id: restaurant.id,
          name: restaurant.name,
          slug: restaurant.slug,
          themeColor: restaurant.themeColor || "#f59e0b",
          customLabels: restaurant.customLabels || null,
          businessType: restaurant.businessType || null,
        }}
        categories={categories}
        dishes={dishes}
        currentUser={currentUser}
      />
    </main>
  );
}

