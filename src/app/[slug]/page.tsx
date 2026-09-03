import { prisma } from "@/lib/db";
import { MenuClient } from "./components/MenuClient";
import { UtensilsCrossed } from "lucide-react";
import Link from "next/link";
import { getUserSession, getSuperAdminSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import { generateRestaurantJsonLd, getBaseUrl } from "@/lib/seo";

interface PageProps {
  params: {
    slug: string;
  };
}

const IGNORED_STATIC_SLUGS = [
  "favicon.ico",
  "robots.txt",
  "sitemap.xml",
  "icon.png",
  "apple-touch-icon.png",
  "manifest.json",
];

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const slug = params.slug.toLowerCase().trim();

  if (IGNORED_STATIC_SLUGS.includes(slug)) {
    return {};
  }

  try {
    const restaurant = await prisma.restaurant.findUnique({
      where: { slug },
      select: {
        name: true,
        specialty: true,
        locality: true,
        description: true,
        logoUrl: true,
        coverUrl: true,
      },
    });

    if (!restaurant) {
      return {
        title: "Menú no encontrado | MenuQR Pro",
      };
    }

    const title = `Menú Digital de ${restaurant.name} ${restaurant.locality ? `(${restaurant.locality})` : "en Ecuador"}`;
    const description = restaurant.description || `Escanea el código QR y consulta la carta digital completa de ${restaurant.name}. Especialidad: ${restaurant.specialty || "Gastronomía"}. Haz tu pedido directo a WhatsApp.`;

    return {
      title,
      description,
      alternates: {
        canonical: `/${slug}`,
      },
      keywords: [
        `Menú digital ${restaurant.name}`,
        `Carta ${restaurant.name}`,
        `Pedir por WhatsApp ${restaurant.name}`,
        restaurant.locality ? `Restaurante en ${restaurant.locality}` : "Restaurante en Ecuador",
        restaurant.specialty || "Gastronomía",
        "MenuQR Pro",
      ],
      openGraph: {
        title: `${restaurant.name} | Menú Digital QR`,
        description,
        url: `https://menuqrpro.com/${slug}`,
        images: [
          {
            url: restaurant.logoUrl || restaurant.coverUrl || "/icon.png",
            alt: `Logo de ${restaurant.name}`,
          },
        ],
      },
      twitter: {
        card: "summary_large_image",
        title: `${restaurant.name} | Menú Digital QR`,
        description,
        images: [restaurant.logoUrl || restaurant.coverUrl || "/icon.png"],
      },
      other: {
        "geo.region": "EC",
        "geo.placename": restaurant.locality || "Ecuador",
      },
    };
  } catch {
    return {
      title: "Menú Digital QR | MenuQR Pro",
    };
  }
}

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

export default async function RestaurantMenuPage({ params }: PageProps) {
  const pageStartTime = performance.now();
  const slug = params.slug.toLowerCase().trim();

  if (IGNORED_STATIC_SLUGS.includes(slug)) {
    return null;
  }

  const prismaStartTime = performance.now();
  try {
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
        seasonRates: {
          where: { isActive: true },
          orderBy: { startDate: "asc" },
        },
      },
    });

    const prismaDuration = Math.round(performance.now() - prismaStartTime);

    if (!restaurant) {
      return (
        <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center p-6 text-center relative overflow-hidden">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] bg-red-600/10 rounded-full blur-[100px] pointer-events-none"></div>
          <div className="relative z-10 max-w-md space-y-6">
            <div className="h-16 w-16 bg-slate-900 border border-slate-800 rounded-2xl flex items-center justify-center mx-auto text-red-500 shadow-xl">
              <UtensilsCrossed className="h-8 w-8" />
            </div>
            <div className="space-y-2">
              <h1 className="text-3xl font-extrabold tracking-tight text-white">Menú no encontrado</h1>
              <p className="text-slate-400 text-sm">
                El restaurante <code className="text-slate-300 bg-slate-900 px-1.5 py-0.5 rounded">/{params.slug}</code> no existe o ha sido modificado.
              </p>
            </div>
            <div className="pt-4 flex flex-col gap-2">
              <Link href="/admin" className="px-6 py-3 rounded-xl bg-gradient-to-r from-red-600 to-amber-600 hover:from-red-500 hover:to-amber-500 text-white font-bold text-sm shadow-lg transition-all">
                Ir al Panel Admin
              </Link>
              <Link href="/mamma-mia" className="text-xs text-slate-500 hover:text-slate-400 underline transition">
                Ver menú de muestra (Mamma Mia)
              </Link>
            </div>
          </div>
        </div>
      );
    }

    const totalDuration = Math.round(performance.now() - pageStartTime);
    const isPlanPro = restaurant.plan === "PRO";
    const isTrialValid = !restaurant.trialEndsAt || new Date(restaurant.trialEndsAt) >= new Date();
    const isSubscriptionActive = isPlanPro || isTrialValid;

    console.log(
      `[MenuPage Subscription Log] Slug: '${slug}' | Plan: '${restaurant.plan}' | TrialEndsAt: '${restaurant.trialEndsAt}' | IsActive: ${isSubscriptionActive} | (Prisma: ${prismaDuration}ms | Total Servidor: ${totalDuration}ms)`
    );

    if (!isSubscriptionActive) {
      return (
        <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center p-6 text-center relative overflow-hidden">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] bg-amber-600/10 rounded-full blur-[100px] pointer-events-none"></div>
          <div className="relative z-10 max-w-md space-y-6">
            <h1 className="text-2xl font-bold text-amber-400">Suscripción Expirada</h1>
            <p className="text-slate-300 text-sm">El menú de {restaurant.name} se encuentra temporalmente inactivo por vencimiento de plan.</p>
          </div>
        </div>
      );
    }

    const [session, isSuperAdmin] = await Promise.all([
      getUserSession(),
      getSuperAdminSession(),
    ]);

    const serializedRestaurant = {
      ...restaurant,
      whatsappNumber: restaurant.whatsapp || "",
      paymentQrUrl: restaurant.qrCobroUrl || null,
      trialEndsAt: toIso(restaurant.trialEndsAt),
      createdAt: toIso(restaurant.createdAt),
      updatedAt: toIso(restaurant.updatedAt),
      isOwner: !!session || isSuperAdmin,
      categories: (restaurant.categories || []).map((cat: any) => ({
        ...cat,
        createdAt: toIso(cat.createdAt),
        updatedAt: toIso(cat.updatedAt),
        dishes: (cat.dishes || []).map((dish: any) => ({
          ...dish,
          createdAt: toIso(dish.createdAt),
          updatedAt: toIso(dish.updatedAt),
        })),
      })),
      seasonRates: (restaurant.seasonRates || []).map((rate: any) => ({
        ...rate,
        startDate: toIso(rate.startDate),
        endDate: toIso(rate.endDate),
        createdAt: toIso(rate.createdAt),
        updatedAt: toIso(rate.updatedAt),
      })),
    };

    const restaurantSchema = generateRestaurantJsonLd(restaurant);

    return (
      <>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(restaurantSchema) }}
        />
        <MenuClient restaurant={serializedRestaurant as any} />
      </>
    );
  } catch (err: any) {
    console.error("[MenuPage Error] Fallo critico en Server Component:", err);
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center p-6 text-center">
        <h1 className="text-xl font-bold text-red-500">Error al cargar el restaurante</h1>
        <p className="text-slate-400 text-xs mt-2">{err?.message || "Ocurrió un error inesperado."}</p>
      </div>
    );
  }
}
