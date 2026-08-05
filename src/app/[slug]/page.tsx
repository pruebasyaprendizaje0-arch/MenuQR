import { prisma } from "@/lib/db";
import { MenuClient } from "./components/MenuClient";
import { UtensilsCrossed } from "lucide-react";
import Link from "next/link";

export const dynamic = "force-dynamic";

interface PageProps {
  params: {
    slug: string;
  };
}

export default async function RestaurantMenuPage({ params }: PageProps) {
  const slug = params.slug.toLowerCase().trim();

  const restaurant = await prisma.restaurant.findUnique({
    where: { slug },
    include: {
      categories: {
        orderBy: { order: "asc" },
        include: {
          dishes: {
            orderBy: { createdAt: "desc" },
          },
        },
      },
    },
  });

  if (!restaurant) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center p-6 text-center relative overflow-hidden">
        {/* Glowing background */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] bg-red-600/10 rounded-full blur-[100px] pointer-events-none"></div>

        <div className="relative z-10 max-w-md space-y-6">
          <div className="h-16 w-16 bg-slate-900 border border-slate-800 rounded-2xl flex items-center justify-center mx-auto text-red-500 shadow-xl">
            <UtensilsCrossed className="h-8 w-8" />
          </div>
          
          <div className="space-y-2">
            <h1 className="text-3xl font-extrabold tracking-tight text-white">Menú no encontrado</h1>
            <p className="text-slate-400 text-sm">
              El restaurante con la dirección <code className="text-slate-300 bg-slate-900 px-1.5 py-0.5 rounded">/{params.slug}</code> no existe o ha sido modificado.
            </p>
          </div>

          <div className="pt-4 flex flex-col gap-2">
            <Link 
              href="/admin" 
              className="px-6 py-3 rounded-xl bg-gradient-to-r from-red-600 to-amber-600 hover:from-red-500 hover:to-amber-500 text-white font-bold text-sm shadow-lg transition-all"
            >
              Ir al Panel Admin
            </Link>
            <Link 
              href="/mamma-mia" 
              className="text-xs text-slate-500 hover:text-slate-400 underline transition"
            >
              Ver menú de muestra (Mamma Mia)
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (restaurant.trialEndsAt < new Date()) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center p-6 text-center relative overflow-hidden">
        {/* Glowing background */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] bg-amber-600/10 rounded-full blur-[100px] pointer-events-none"></div>

        <div className="relative z-10 max-w-md space-y-6">
          <div className="h-16 w-16 bg-slate-900 border border-slate-800 rounded-2xl flex items-center justify-center mx-auto text-amber-500 shadow-xl">
            <UtensilsCrossed className="h-8 w-8" />
          </div>
          
          <div className="space-y-2">
            <h1 className="text-3xl font-extrabold tracking-tight text-white">Demo Expirada</h1>
            <p className="text-slate-400 text-sm">
              El período de prueba gratuito de 30 días para <strong>{restaurant.name}</strong> ha finalizado.
            </p>
            <p className="text-xs text-slate-500 leading-relaxed">
              Por favor contacta al administrador del restaurante para renovar tu suscripción y reactivar tu menú QR.
            </p>
          </div>

          <div className="pt-4 flex flex-col gap-2">
            <Link 
              href="/admin" 
              className="px-6 py-3 rounded-xl bg-slate-900 border border-slate-800 hover:bg-slate-800 text-white font-bold text-sm shadow-lg transition-all"
            >
              Acceder al Panel Admin
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Deep copy / serialisation helper for Next.js server components boundary pass
  const serializedRestaurant = {
    ...restaurant,
    whatsappNumber: restaurant.whatsapp,
    paymentQrUrl: restaurant.qrCobroUrl,
    trialEndsAt: restaurant.trialEndsAt.toISOString(),
    // Provide safe defaults for new fields that may not exist in older DB versions
    tablesConfig: (restaurant as any).tablesConfig ?? "1,2,3,4,5,6,7,8,9,10",
    ivaPercent: (restaurant as any).ivaPercent ?? 15,
    servicePercent: (restaurant as any).servicePercent ?? 10,
    ivaOnTable: (restaurant as any).ivaOnTable ?? true,
    ivaOnTakeout: (restaurant as any).ivaOnTakeout ?? true,
    serviceOnTable: (restaurant as any).serviceOnTable ?? true,
    serviceOnTakeout: (restaurant as any).serviceOnTakeout ?? false,
    categories: restaurant.categories.map((c) => ({
      ...c,
      dishes: c.dishes.map((d) => ({
        ...d,
        description: d.description,
        imageUrl: d.imageUrl,
      })),
    })),
  };

  return <MenuClient restaurant={serializedRestaurant} />;
}
