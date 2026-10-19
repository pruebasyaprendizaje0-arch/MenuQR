import { getUserSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { CajaClient } from "./CajaClient";
import Link from "next/link";
import { Store, ArrowLeft, Barcode } from "lucide-react";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Caja POS Escáner | MenuQR Pro",
  description: "Terminal punto de venta con lector de código de barras para entradas de stock y ventas rápidas.",
};

export default async function CajaPage() {
  let session: any = null;
  try {
    session = await getUserSession();
  } catch (err) {
    console.error("Error fetching user session in CajaPage:", err);
  }

  if (!session) {
    redirect("/login?next=/caja");
  }

  const cookieStore = await cookies();
  const activeRestaurantId = session.restaurantId || cookieStore.get("active_restaurant_id")?.value;

  let restaurant: any = null;

  try {
    if (activeRestaurantId) {
      restaurant = await prisma.restaurant.findFirst({
        where: { id: activeRestaurantId, userId: session.userId },
        select: {
          id: true,
          name: true,
          slug: true,
          themeColor: true,
          customLabels: true,
        },
      });
    }

    if (!restaurant) {
      restaurant = await prisma.restaurant.findFirst({
        where: { userId: session.userId },
        select: {
          id: true,
          name: true,
          slug: true,
          themeColor: true,
          customLabels: true,
        },
      });
    }
  } catch (dbErr) {
    console.error("Error querying restaurant in CajaPage:", dbErr);
  }

  if (!restaurant) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 rounded-3xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mb-4">
          <Store className="w-8 h-8" />
        </div>
        <h1 className="text-xl font-bold mb-2">No se encontró ningún negocio</h1>
        <p className="text-sm text-slate-400 max-w-sm mb-6">
          Necesitas tener al menos un negocio activo en tu cuenta para poder operar la Caja POS.
        </p>
        <Link
          href="/admin"
          className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm transition shadow-lg shadow-emerald-600/20"
        >
          <ArrowLeft className="w-4 h-4" /> Ir al Panel de Control
        </Link>
      </div>
    );
  }

  // Verify if Caja POS is disabled by Super Admin
  let customObj: any = {};
  if (restaurant.customLabels) {
    try {
      customObj = typeof restaurant.customLabels === "string" 
        ? JSON.parse(restaurant.customLabels) 
        : restaurant.customLabels;
    } catch {}
  }
  const disabledModules: string[] = Array.isArray(customObj.disabledModules) 
    ? customObj.disabledModules 
    : [];

  if (disabledModules.includes("caja")) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 rounded-3xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mb-4">
          <Barcode className="w-8 h-8" />
        </div>
        <h1 className="text-xl font-bold mb-2">Herramienta no habilitada</h1>
        <p className="text-sm text-slate-400 max-w-sm mb-6">
          El módulo de <strong>Caja POS Móvil</strong> no se encuentra activo para tu negocio. Comunícate con soporte de Ubicame.cc para activarlo en tu cuenta.
        </p>
        <Link
          href="/admin"
          className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-sm transition border border-slate-700"
        >
          <ArrowLeft className="w-4 h-4" /> Volver al Panel de Control
        </Link>
      </div>
    );
  }

  // Fetch categories for quick product creation
  let categories: { id: string; name: string }[] = [];
  try {
    categories = await prisma.category.findMany({
      where: { restaurantId: restaurant.id },
      orderBy: { order: "asc" },
      select: {
        id: true,
        name: true,
      },
    });
  } catch (catErr) {
    console.error("Error querying categories for Caja:", catErr);
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <CajaClient
        restaurant={{
          id: restaurant.id,
          name: restaurant.name,
          slug: restaurant.slug,
          themeColor: restaurant.themeColor || "#059669",
        }}
        categories={categories}
      />
    </main>
  );
}
